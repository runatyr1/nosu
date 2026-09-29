import { createPool, type Hex, type Pool, type Filter, type RelayUrl, type NostrEvent } from '@nostrich/nostr'
import { defaultRelayControls, getSavedRelayControls, localRelayUrl, postEntries } from './relay-controls'

import { readCachedNip05, readCachedProfile } from './profile-cache'
import { rejectEvent } from './spam'

let pool: Pool | undefined
let publicationForwarder: ((event: NostrEvent) => void) | undefined

export function setLocalPublicationForwarder(forwarder?: (event: NostrEvent) => void): void {
  publicationForwarder = forwarder
}

/** The one relay pool for the tab. */
export function getPool(): Pool {
  if (typeof window === 'undefined') {
    throw new Error('getPool() is browser-only; call it from an effect or an event handler')
  }
  if (pool === undefined) {
    /** `reject` is the one filter that lives this low. */
    pool = createPool({
      relays: postEntries(getSavedRelayControls() ?? defaultRelayControls()),
      reject: event => rejectEvent(event, hasVerifiedNip05, cachedNames),
      routeRelayUrls: routeContentRelays,
      onPublished: (event, relay) => {
        const target = localRelayUrl()
        if (relay === target) publicationForwarder?.(event)
      },
    })
  }
  return pool
}

/** Local deployment tests preserve signer rendezvous and NWC transports. */
export function routeContentRelays(urls: RelayUrl[], filters: Filter[], operation: 'read' | 'write' = 'read'): RelayUrl[] {
  if (typeof window === 'undefined') return urls
  const independent = [4, 1059, 10002, 10050, 24133, 23194, 23195]
  if (filters.length && filters.every(filter => filter.kinds?.length && filter.kinds.every(kind => independent.includes(kind)))) return urls
  return postEntries(getSavedRelayControls() ?? defaultRelayControls()).filter(entry => entry.policy[operation]).map(entry => entry.url)
}

/** Whether this author's NIP-05 is known-good, answered from cache alone. */
/** The author's name fields, from cache alone, for `spam.ts`'s name rule. */
function cachedNames(pubkey: Hex): { name?: string; displayName?: string; nip05?: string } | undefined {
  return readCachedProfile(pubkey)?.profile
}

function hasVerifiedNip05(pubkey: Hex): boolean {
  const cached = readCachedProfile(pubkey)
  const claim = cached?.profile.nip05?.trim() ?? ''
  if (claim === '') return false
  return readCachedNip05(pubkey, claim)?.ok === true
}
