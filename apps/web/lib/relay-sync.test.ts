import { describe, expect, it, vi, afterEach } from 'vitest'
import type { Signer } from '@nostrich/nostr'
import { signSyncChallenge } from './relay-sync'
import { routeContentRelays } from './pool'
import { defaultRelayControls, localRelayUrl, saveRelayControls } from './relay-controls'
import { setActiveScope } from './scope'

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

describe('account content routing', () => {
  it('uses account defaults when no preference has been saved', () => {
    setActiveScope('routing-default')
    vi.stubEnv('NEXT_PUBLIC_LOCAL_RELAY_ONLY', 'false')
    expect(routeContentRelays(['wss://original.example'], [{ kinds: [1] }])).toEqual(defaultRelayControls().rows.filter(row => row.posts !== 'off').map(row => row.url))
  })
  it('seeds local Posts without overriding private destinations or wallet/signer transports', () => {
    setActiveScope('routing-local')
    vi.stubEnv('NEXT_PUBLIC_LOCAL_RELAY_ONLY', 'true')
    const local = localRelayUrl()
    expect(routeContentRelays(['wss://original.example'], [{ kinds: [1059], '#p': ['reader'] }])).toEqual(['wss://original.example'])
    expect(routeContentRelays(['wss://search.example'], [{ search: 'test' }])).toEqual([local])
    for (const kind of [24133, 23194, 23195]) expect(routeContentRelays(['wss://provider.example'], [{ kinds: [kind] }])).toEqual(['wss://provider.example'])
  })
  it('honors saved read/write choices even when the installer previously seeded local-only defaults', () => {
    setActiveScope('routing-saved')
    vi.stubEnv('NEXT_PUBLIC_LOCAL_RELAY_ONLY', 'true')
    saveRelayControls({ rows: [
      { url: 'wss://reader.example', posts: 'read', dms: false },
      { url: 'wss://writer.example', posts: 'write', dms: false },
      { url: 'wss://inbox.example', posts: 'off', dms: true },
    ] })
    expect(routeContentRelays(['wss://outbox.example'], [{ kinds: [1] }], 'read')).toEqual(['wss://reader.example'])
    expect(routeContentRelays(['wss://outbox.example'], [{ kinds: [1] }], 'write')).toEqual(['wss://writer.example'])
    expect(routeContentRelays(['wss://recipient.example'], [{ kinds: [1059] }], 'write')).toEqual(['wss://recipient.example'])
  })
})
