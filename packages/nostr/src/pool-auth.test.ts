import { describe, expect, it, vi } from 'vitest'
import { NostrichPool, type UnderlyingRelay, type UnderlyingSubscribeParams } from './pool'
import type { Signer, NostrEvent, EventTemplate } from './types'

function harness(target = 'wss://relay.example/') {
  const template = { kind: 22242, created_at: 1, content: '', tags: [['relay', target], ['challenge', 'abc']] }
  const signer = { signEvent: vi.fn(async (event: EventTemplate) => ({ ...event, id: 'id', sig: 'sig', pubkey: 'pk' }) as NostrEvent) } as unknown as Signer
  const relay: UnderlyingRelay = {
    url: 'wss://relay.example/', connected: true,
    subscribe: vi.fn((_filters, params: UnderlyingSubscribeParams) => { queueMicrotask(() => params.onclose?.('auth-required: sign in')); return { close() {} } }),
    publish: vi.fn().mockRejectedValueOnce(new Error('auth-required: sign in')).mockResolvedValue('accepted'),
    auth: vi.fn(async sign => { await sign(template) }), close() {},
  }
  const underlying = { ensureRelay: vi.fn(async () => relay), close: vi.fn() }
  const pool = new NostrichPool({ underlying, relays: [{ url: 'wss://relay.example/', policy: { read: true, write: true } }] })
  pool.setAuthSigner(signer)
  return { pool, relay, underlying, signer }
}

describe('pool NIP-42 authentication', () => {
  it('authenticates once and retries an auth-required publication', async () => {
    const h = harness()
    const result = await h.pool.publish({ kind: 1 } as NostrEvent)
    expect(result[0]?.ok).toBe(true)
    expect(h.relay.auth).toHaveBeenCalledTimes(1)
    expect(h.relay.publish).toHaveBeenCalledTimes(2)
    h.pool.close()
  })
  it('rejects a mismatched target without asking the signer', async () => {
    const h = harness('wss://attacker.example/')
    expect((await h.pool.publish({ kind: 1 } as NostrEvent))[0]?.ok).toBe(false)
    expect(h.signer.signEvent).not.toHaveBeenCalled()
    h.pool.close()
  })
  it('retries a subscription only once when auth does not grant access', async () => {
    const h = harness()
    h.pool.subscribe({ filters: [{ kinds: [4] }], onEvent() {} })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(h.relay.subscribe).toHaveBeenCalledTimes(2)
    expect(h.relay.auth).toHaveBeenCalledTimes(1)
    h.pool.close()
  })
  it('closes authenticated connections on logout', () => {
    const h = harness()
    h.underlying.close.mockClear()
    h.pool.setAuthSigner(undefined)
    expect(h.underlying.close).toHaveBeenCalledWith(['wss://relay.example'])
    h.pool.close()
  })
})
