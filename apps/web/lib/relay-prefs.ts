'use client'

import { useEffect, useRef, useState } from 'react'
import { buildRelayListEvent, buildDmRelayList, DEFAULT_DM_RELAYS, parseRelayList, parseDmRelayList, tryNormalizeRelayUrl, type NostrEvent, type RelayUrl } from '@nostrich/nostr'
import { sessionPubkey, sessionSigner, useSession } from '../components/SessionProvider'
import { getPool } from './pool'
import { activeScope } from './scope'
import { defaultRelayControls, getSavedRelayControls, localRelayUrl, postEntries, saveRelayControls, useSavedRelayControls, type RelayControls } from './relay-controls'

/** One editor for the separate NIP-65 post and NIP-17 inbox lists. */
export function useRelayPrefs() {
  const { session, ready } = useSession()
  const pubkey = sessionPubkey(session)
  const saved = useSavedRelayControls()
  const savedJson = JSON.stringify(saved)
  const [draft, setDraft] = useState<RelayControls>({ rows: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const identity = useRef(pubkey)
  identity.current = pubkey

  useEffect(() => {
    if (!ready) return
    let canceled = false
    setLoading(true); setDirty(false); setNote(null)
    const stored = getSavedRelayControls()
    const initial = stored ?? defaultRelayControls()
    setDraft(initial)
    if (stored || !pubkey) { setLoading(false); return }
    void getPool().query([{ kinds: [10002, 10050], authors: [pubkey] }], initial.rows.map(row => row.url), 8000).then(events => {
      if (canceled) return
      const newest = (kind: number): NostrEvent | undefined => events.filter(event => event.kind === kind).sort((a, b) => b.created_at - a.created_at)[0]
      const posts = newest(10002), dms = newest(10050)
      const rows = new Map(initial.rows.map(row => [row.url, { ...row }]))
      if (posts && process.env.NEXT_PUBLIC_LOCAL_RELAY_ONLY !== 'true') {
        for (const row of rows.values()) row.posts = 'off'
        for (const entry of parseRelayList(posts).entries) rows.set(entry.url, { url: entry.url, posts: entry.policy.read && entry.policy.write ? 'both' : entry.policy.read ? 'read' : 'write', dms: false })
      }
      const inbox = dms ? parseDmRelayList(dms)?.relays ?? [] : [...DEFAULT_DM_RELAYS]
      for (const url of inbox) rows.set(url, { ...(rows.get(url) ?? { url, posts: 'off' as const }), dms: true })
      setDraft({ rows: [...rows.values()] })
    }).catch(() => { if (!canceled) setNote('Could not load published relay lists. Your current routing remains unchanged.') }).finally(() => { if (!canceled) setLoading(false) })
    return () => { canceled = true }
  }, [pubkey, ready, savedJson])

  const edit = (next: RelayControls): void => { setDraft(next); setDirty(true); setNote(null) }
  const save = async (): Promise<void> => {
    const signer = sessionSigner(session)
    if (!signer || !pubkey) { setNote('Sign in with a signer to save and publish your relay lists.'); return }
    const scope = activeScope(), chosen = draft
    setSaving(true); setNote(null)
    try {
      const posts = await signer.signEvent(buildRelayListEvent(postEntries(chosen)))
      const dmUrls = chosen.rows.filter(row => row.dms).map(row => row.url)
      const inbox = dmUrls.length ? await buildDmRelayList(signer, dmUrls) : await signer.signEvent({ kind: 10050, created_at: Math.floor(Date.now() / 1000), content: '', tags: [] })
      if (identity.current !== pubkey || activeScope() !== scope) return
      const destinations = [...new Set([...getPool().readRelays(), ...chosen.rows.filter(row => row.posts !== 'off' || row.dms).map(row => row.url)])]
      const outcomes = await Promise.all([getPool().publish(posts, destinations), getPool().publish(inbox, destinations)])
      if (identity.current !== pubkey || activeScope() !== scope) return
      if (!outcomes.every(results => results.some(result => result.ok))) {
        setNote('One relay list was not accepted. Your active settings are unchanged; retry Save.'); return
      }
      if (identity.current !== pubkey || activeScope() !== scope) return
      saveRelayControls(chosen)
      setDirty(false); setNote('Saved. Posts (NIP-65) and DM inbox (NIP-17) lists published.')
    } catch { setNote('Could not sign or publish both relay lists. Your active settings are unchanged.') }
    finally { setSaving(false) }
  }
  const add = (raw: string): string | null => {
    const url = tryNormalizeRelayUrl(raw)
    if (!url) return 'Enter a ws:// or wss:// relay address.'
    if (draft.rows.some(row => row.url === url)) return 'Already in your list.'
    if (draft.rows.length >= 30) return 'The limit is 30 relay addresses.'
    edit({ rows: [...draft.rows, { url, posts: 'off', dms: false }] }); return null
  }
  const change = (url: RelayUrl, patch: Partial<RelayControls['rows'][number]>): void => {
    setDraft(current => ({ rows: current.rows.map(row => row.url === url ? { ...row, ...patch, url } : row) }))
    setDirty(true); setNote(null)
  }
  const remove = (url: RelayUrl): void => edit({ rows: draft.rows.filter(row => row.url !== url) })
  return { draft, loading, saving, dirty, note, save, add, change, remove, local: localRelayUrl() }
}
