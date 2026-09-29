'use client'

import { useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { detectRelayCapabilities, type RelayCapability } from '../lib/relay-capabilities'
import { useRelayPrefs } from '../lib/relay-prefs'
import { useRelayStatus } from '../lib/relay-status'
import { BUTTON_PRIMARY, BUTTON_QUIET, INPUT_BASE } from '../lib/styles'
import { sessionPubkey, useSession } from './SessionProvider'

function Purpose({ name, checked, pending, capability, onChange }: {
  name: string; checked: boolean; pending: boolean; capability?: RelayCapability; onChange: () => void
}): React.ReactNode {
  if (pending) return <span role="status" aria-label={`Checking ${name}`} className="inline-flex items-center gap-1 rounded-full bg-bg-inset px-2 py-1 text-xs text-text-muted"><span aria-hidden="true" className="material-symbols-outlined animate-spin text-[16px]!">progress_activity</span>{name}</span>
  return <button type="button" role="switch" aria-label={name} aria-checked={checked} onClick={onChange}
    title={capability?.detail}
    className={`rounded-full border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${checked ? 'border-success-border bg-success-surface text-success-text' : 'border-border bg-bg-inset text-text-muted'}`}>
    {name}<span aria-hidden="true" className="ml-1">{checked ? '✓' : '○'}</span>
  </button>
}

export function RelaySettings(): React.ReactNode {
  const prefs = useRelayPrefs()
  const { session } = useSession()
  const viewer = sessionPubkey(session)
  const queryClient = useQueryClient()
  const status = useRelayStatus()
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const capabilities = useQueries({ queries: prefs.draft.rows.map(row => ({
    queryKey: ['relay-capabilities', row.url, viewer],
    queryFn: ({ signal }: { signal: AbortSignal }) => detectRelayCapabilities(row.url, { pubkey: viewer, signal }),
    staleTime: 5 * 60_000,
  })) })

  return <section aria-labelledby="relays-heading" className="mt-8">
    <div className="flex items-center justify-between gap-2">
      <h2 id="relays-heading" className="font-brand text-lg font-bold text-text">Relays</h2>
      <button type="button" className={BUTTON_QUIET} onClick={() => void queryClient.invalidateQueries({ queryKey: ['relay-capabilities'] })}>Check again</button>
    </div>
    <p className="mt-1 text-[15px] leading-relaxed text-text-muted">
      Posts controls your social feed and publishing. Read + write, read only, and write only apply to Posts only.
      DMs selects your inbox and stores your sent copies; messages to others go to their inbox relays.
      Press Save to apply changes and publish your Posts (NIP-01, NIP-65) and DM inbox (NIP-17, NIP-44, NIP-59) lists.
    </p>
    <p className="mt-2 text-xs text-text-faint">A spinner means checking. Unknown support remains selectable; advertised support does not guarantee a relay will accept your messages.</p>
    {prefs.loading ? <p role="status" className="mt-4 text-text-muted">Loading your relay lists…</p> : null}
    <ul className="mt-4 divide-y divide-border border-y border-border">
      {prefs.draft.rows.map((row, index) => {
        const result = capabilities[index]
        const pending = prefs.loading || result?.isPending === true
        const connection = status.find(entry => entry.url === row.url)?.state
        return <li key={row.url} className="py-3" aria-label={row.url}>
          <div className="flex flex-wrap items-center gap-2">
            <span aria-label={connection ? `Connection ${connection}` : 'Not subscribed'} className={`size-2 shrink-0 rounded-full ${connection === 'open' ? 'bg-success' : connection === 'connecting' ? 'bg-warning' : 'bg-border'}`} />
            <span className="min-w-40 flex-1 break-all font-mono text-[14px] text-text">{row.url}{row.url === prefs.local ? <span className="ml-2 font-sans text-xs text-text-muted">Localhost</span> : null}</span>
            <div className="flex flex-wrap items-center gap-2">
              <Purpose name="DMs" checked={row.dms} pending={pending} capability={result?.data?.dms} onChange={() => prefs.change(row.url, { dms: !row.dms })} />
              <Purpose name="Posts" checked={row.posts !== 'off'} pending={pending} capability={result?.data?.posts} onChange={() => prefs.change(row.url, { posts: row.posts === 'off' ? 'both' : 'off' })} />
              <select aria-label={`Posts read and write for ${row.url}`} value={row.posts === 'off' ? 'both' : row.posts} disabled={row.posts === 'off' || pending}
                onChange={event => prefs.change(row.url, { posts: event.target.value as 'both' | 'read' | 'write' })}
                className="rounded-full bg-bg-inset px-2 py-1 text-xs text-text-muted disabled:opacity-40">
                <option value="both">read + write</option><option value="read">read only</option><option value="write">write only</option>
              </select>
              <button type="button" aria-label={`Remove ${row.url}`} disabled={row.url === prefs.local} onClick={() => prefs.remove(row.url)} className="flex size-7 items-center justify-center rounded-full text-danger-text disabled:opacity-30"><span aria-hidden="true" className="material-symbols-outlined text-[18px]!">delete</span></button>
            </div>
          </div>
        </li>
      })}
    </ul>
    <form className="mt-4 flex items-start gap-2" onSubmit={event => { event.preventDefault(); const failure = prefs.add(address); setError(failure); if (!failure) setAddress('') }}>
      <div className="min-w-0 flex-1"><label htmlFor="add-relay" className="sr-only">Add a relay</label><input id="add-relay" className={INPUT_BASE} placeholder="wss://relay.example.com" value={address} onChange={event => { setAddress(event.target.value); setError(null) }} />{error ? <p role="alert" className="text-sm text-danger-text">{error}</p> : null}</div>
      <button type="submit" className={BUTTON_PRIMARY}>Add</button>
    </form>
    <div className="mt-4 flex items-center justify-between gap-3">
      <span className="text-sm text-text-muted">{prefs.dirty ? 'Unsaved changes' : 'Settings belong to the active account.'}</span>
      <button type="button" onClick={() => void prefs.save()} disabled={prefs.saving || prefs.loading || !prefs.dirty || session.status !== 'signed'} className={BUTTON_PRIMARY}>{prefs.saving ? 'Saving…' : 'Save'}</button>
    </div>
    {prefs.note ? <p role="status" className="mt-3 text-sm text-text-muted">{prefs.note}</p> : null}
  </section>
}
