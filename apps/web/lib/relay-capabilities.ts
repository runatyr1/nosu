'use client'

import { tryNormalizeRelayUrl, type RelayUrl } from '@nostrich/nostr'
import { fetchRelayInfo } from './relay-info'

export interface RelayCapability {
  status: 'supported' | 'unknown' | 'unavailable'
  evidence: 'advertised' | 'observed' | 'none'
  detail: string
}

export interface RelayCapabilities {
  posts: RelayCapability
  dms: RelayCapability
  supportedNips: number[]
}

type ProbeResult = 'answered' | 'auth' | 'refused' | 'unavailable'
const unknown = (detail: string): RelayCapability => ({ status: 'unknown', evidence: 'none', detail })
const unavailable = (): RelayCapability => ({ status: 'unavailable', evidence: 'none', detail: 'Relay could not be reached. Try again later.' })

/** A separate, read-only connection avoids account routing overrides and signer prompts. */
function probe(relay: RelayUrl, pubkey?: string, signal?: AbortSignal): Promise<{ posts: ProbeResult; dms?: ProbeResult }> {
  return new Promise((resolve) => {
    let socket: WebSocket | undefined
    let posts: ProbeResult | undefined
    let dms: ProbeResult | undefined
    let finished = false
    let authSeen = false
    const wantsDms = !!pubkey && /^[a-f0-9]{64}$/i.test(pubkey)
    const finish = (): void => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', finish)
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(['CLOSE', 'cap-posts']))
        if (wantsDms) socket.send(JSON.stringify(['CLOSE', 'cap-dms']))
      }
      socket?.close()
      resolve({ posts: posts ?? (authSeen ? 'auth' : 'unavailable'), ...(wantsDms ? { dms: dms ?? (authSeen ? 'auth' : 'unavailable') } : {}) })
    }
    const timer = setTimeout(finish, 4_000)
    if (signal?.aborted) { finish(); return }
    signal?.addEventListener('abort', finish, { once: true })
    try {
      socket = new WebSocket(relay)
      socket.onopen = () => {
        socket?.send(JSON.stringify(['REQ', 'cap-posts', { kinds: [1], limit: 1 }]))
        if (wantsDms) socket?.send(JSON.stringify(['REQ', 'cap-dms', { kinds: [1059], '#p': [pubkey], limit: 1 }]))
      }
      socket.onmessage = ({ data }) => {
        let message: unknown
        try { message = JSON.parse(String(data)) } catch { return }
        if (!Array.isArray(message)) return
        if (message[0] === 'AUTH') {
          authSeen = true
          return
        }
        const id = message[1]
        if (id !== 'cap-posts' && id !== 'cap-dms') return
        let result: ProbeResult | undefined
        if (message[0] === 'EOSE' || message[0] === 'EVENT') result = 'answered'
        if (message[0] === 'CLOSED') result = String(message[2]).startsWith('auth-required:') ? 'auth' : 'refused'
        if (!result) return
        if (id === 'cap-posts') posts = result
        else dms = result
        if (posts && (!wantsDms || dms)) finish()
      }
      socket.onerror = finish
      socket.onclose = finish
    } catch { finish() }
  })
}

/** Advertisements and read probes indicate compatibility, never guaranteed write admission. */
export async function detectRelayCapabilities(
  relay: RelayUrl,
  options: { pubkey?: string; signal?: AbortSignal } = {},
): Promise<RelayCapabilities> {
  const normalized = tryNormalizeRelayUrl(relay)
  if (!normalized) return { posts: unavailable(), dms: unavailable(), supportedNips: [] }
  const info = await fetchRelayInfo(normalized)
  const supportedNips = info?.supportedNips ?? []
  const postsAdvertised = supportedNips.includes(1)
  // NIP-17 is mostly client behavior; NIP-11 says client NIPs need not be advertised.
  const dmsAdvertised = supportedNips.includes(17) || supportedNips.includes(59)
  const results = !postsAdvertised || !dmsAdvertised
    ? await probe(normalized, options.pubkey, options.signal)
    : undefined
  const posts: RelayCapability = postsAdvertised
    ? { status: 'supported', evidence: 'advertised', detail: 'Advertises NIP-01. Write admission depends on relay policy.' }
    : results?.posts === 'answered'
      ? { status: 'supported', evidence: 'observed', detail: 'Answered a post read request. Writing has not been tested.' }
      : results?.posts === 'unavailable'
        ? unavailable()
        : unknown('Authentication or relay policy prevented the read check. You can enable it manually.')
  const dms: RelayCapability = dmsAdvertised
    ? { status: 'supported', evidence: 'advertised', detail: 'Advertises encrypted-message support. Storage and delivery have not been verified.' }
    : results?.dms === 'answered'
      ? { status: 'unknown', evidence: 'observed', detail: 'Answered a recipient-scoped NIP-59 read request. Empty results do not verify message storage; you can enable it manually.' }
      : results?.dms === 'auth'
        ? unknown('DM reading requires authentication. Storage and delivery are unverified; you can enable it manually.')
        : !postsAdvertised && results?.posts === 'unavailable' && results?.dms === 'unavailable'
          ? unavailable()
          : unknown('DM support is not advertised or verified. You can enable it manually.')
  return { posts, dms, supportedNips }
}
