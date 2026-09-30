'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { DEFAULT_RELAYS, tryNormalizeRelayUrl, type RelayEntry, type RelayUrl } from '@nostrich/nostr'
import { SERVICE_CONFIG } from '../../../packages/nostr/service-config'
import { readScoped, writeScoped, onScopedChange } from './scope'
import { serializeRelayCookie } from './relay-cookie'

export const RELAY_CONTROLS_KEY = 'nosu:relay-controls'
export type PostPolicy = 'off' | 'both' | 'read' | 'write'
export interface RelayControl { url: RelayUrl; posts: PostPolicy; dms: boolean }
export interface RelayControls { rows: RelayControl[] }

export function localRelayUrl(): RelayUrl | undefined {
  if (typeof window === 'undefined') return undefined
  const url = new URL(SERVICE_CONFIG.localRelayPath, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return tryNormalizeRelayUrl(url.href)
}

export function parseRelayControls(raw: string | null): RelayControls | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as RelayControls
    if (!Array.isArray(value.rows) || value.rows.length > 30) return null
    const seen = new Set<string>()
    const rows: RelayControl[] = []
    for (const row of value.rows) {
      const url = tryNormalizeRelayUrl(row?.url ?? '')
      if (!url || seen.has(url) || !['off', 'both', 'read', 'write'].includes(row.posts) || typeof row.dms !== 'boolean') return null
      seen.add(url); rows.push({ url, posts: row.posts, dms: row.dms })
    }
    return { rows }
  } catch { return null }
}

export function getSavedRelayControls(): RelayControls | null { return parseRelayControls(readScoped(RELAY_CONTROLS_KEY)) }
const listen = (changed: () => void): (() => void) => onScopedChange(key => { if (key === undefined || key === RELAY_CONTROLS_KEY) changed() })
export function useSavedRelayControls(): RelayControls | null {
  const raw = useSyncExternalStore(listen, () => readScoped(RELAY_CONTROLS_KEY), () => null)
  return useMemo(() => parseRelayControls(raw), [raw])
}

/** Installer defaults seed a preference; they never override a saved account choice. */
export function defaultRelayControls(): RelayControls {
  const local = localRelayUrl()
  const initialLocal = process.env.NEXT_PUBLIC_LOCAL_RELAY_ONLY === 'true' && local !== undefined
  return { rows: [...new Set([...DEFAULT_RELAYS, ...(local ? [local] : [])])].map(url => ({
    url, posts: initialLocal ? url === local ? 'both' : 'off' : DEFAULT_RELAYS.includes(url) ? 'both' : 'off', dms: false,
  })) }
}

export function postEntries(controls: RelayControls): RelayEntry[] {
  return controls.rows.filter(row => row.posts !== 'off').map(row => ({ url: row.url, policy: { read: row.posts !== 'write', write: row.posts !== 'read' } }))
}

export function saveRelayControls(controls: RelayControls): void {
  const checked = parseRelayControls(JSON.stringify(controls))
  if (!checked) throw new Error('Invalid relay settings')
  writeScoped(RELAY_CONTROLS_KEY, JSON.stringify(checked))
  const posts = checked.rows.filter(row => row.posts !== 'off')
  document.cookie = `nostrich_relays=${encodeURIComponent(serializeRelayCookie(posts.map(row => row.url), 'imported', Object.fromEntries(posts.map(row => [row.url, row.posts as 'both' | 'read' | 'write']))))}; path=/; max-age=31536000; SameSite=Lax`
}

export function useDmRoutingKey(): string {
  return useSyncExternalStore(listen, () => readScoped(RELAY_CONTROLS_KEY) ?? '', () => '')
}
