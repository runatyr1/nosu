import { describe, expect, it, vi, afterEach } from 'vitest'
import type { Signer } from '@nostrich/nostr'
import { signSyncChallenge } from './relay-sync'
import { routeContentRelays } from './pool'

const capabilities = { enabled: true, peer: 'wss://relay.ditto.pub', localRelay: 'ws://localhost/relay' }
const signer = { signEvent: vi.fn(async event => event) } as unknown as Signer

afterEach(() => vi.unstubAllEnvs())
describe('sync challenge signing', () => {
  it('signs only a known connection challenge with correct NIP-42 tags', async () => {
    const signed = await signSyncChallenge(signer, { id: 'one', relay: capabilities.peer, challenge: 'challenge' }, capabilities)
    expect(signed.kind).toBe(22242)
    expect(signed.tags).toEqual([['relay', capabilities.peer], ['challenge', 'challenge']])
    expect(signed.content).toBe('')
  })
  it('rejects an arbitrary target before requesting a signature', async () => {
    const count = vi.mocked(signer.signEvent).mock.calls.length
    await expect(signSyncChallenge(signer, { id: 'two', relay: 'wss://attacker.example', challenge: 'challenge' }, capabilities)).rejects.toThrow('Unexpected relay')
    expect(vi.mocked(signer.signEvent).mock.calls.length).toBe(count)
  })
})

describe('local content routing', () => {
  it('preserves defaults when operator override is disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCAL_RELAY_ONLY', 'false')
    expect(routeContentRelays(['wss://original.example'], [{ kinds: [1] }])).toEqual(['wss://original.example'])
  })
  it('routes search and private content locally while preserving wallet/signer transports', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCAL_RELAY_ONLY', 'true')
    const local = window.location.origin.replace(/^http/, 'ws') + '/relay'
    expect(routeContentRelays(['wss://original.example'], [{ kinds: [1059], '#p': ['reader'] }])).toEqual([local])
    expect(routeContentRelays(['wss://search.example'], [{ search: 'test' }])).toEqual([local])
    for (const kind of [24133, 23194, 23195]) expect(routeContentRelays(['wss://provider.example'], [{ kinds: [kind] }])).toEqual(['wss://provider.example'])
  })
})
