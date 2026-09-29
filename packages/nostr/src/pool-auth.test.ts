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
  it('revives an auth-refused live inbox when a signer becomes available', async () => {
    const h = harness()
    h.pool.setAuthSigner(undefined)
    let authenticated = false
    const received = vi.fn()
    h.relay.auth = vi.fn(async sign => {
      await sign({ kind: 22242, created_at: 1, content: '', tags: [['relay', h.relay.url], ['challenge', 'abc']] })
      authenticated = true
    })
    h.relay.subscribe = vi.fn((_filters, params) => {
      queueMicrotask(() => authenticated
        ? params.onevent?.({ id: 'inbox-event' } as NostrEvent)
        : params.onclose?.('auth-required: sign in'))
      return { close() {} }
    })
    h.pool.subscribe({ live: true, filters: [{ kinds: [1059], '#p': ['pk'] }], onEvent: received })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(received).not.toHaveBeenCalled()
    h.pool.setAuthSigner(h.signer)
    await vi.waitFor(() => expect(received).toHaveBeenCalledTimes(1))
    expect(h.relay.auth).toHaveBeenCalledTimes(1)
    h.pool.close()
  })
  it('reconnects immediately on account change and ignores old socket callbacks', async () => {
    const h = harness()
    const attachments: UnderlyingSubscribeParams[] = []
    const received = vi.fn()
    h.relay.subscribe = vi.fn((_filters, params) => {
      attachments.push(params)
      return { close() {} }
    })
    h.pool.subscribe({ live: true, filters: [{ kinds: [1059] }], onEvent: received })
    await vi.waitFor(() => expect(attachments).toHaveLength(1))
    h.underlying.close.mockImplementation(() => attachments[0]?.onclose?.('auth-required: old connection'))
    h.pool.setAuthSigner({ ...h.signer } as Signer)
    await vi.waitFor(() => expect(attachments).toHaveLength(2), { timeout: 500 })
    attachments[0]?.onevent?.({ id: 'old-account' } as NostrEvent)
    attachments[0]?.onclose?.('auth-required: late old connection')
    attachments[1]?.onevent?.({ id: 'new-account' } as NostrEvent)
    expect(received).toHaveBeenCalledTimes(1)
    expect(received.mock.calls[0]?.[0].id).toBe('new-account')
    h.pool.close()
  })
  it('does not revive blocked subscriptions when the signer changes', async () => {
    const h = harness()
    h.relay.subscribe = vi.fn((_filters, params) => {
      queueMicrotask(() => params.onclose?.('blocked: operator policy'))
      return { close() {} }
    })
    h.pool.subscribe({ live: true, filters: [{ kinds: [1059] }], onEvent() {} })
    await new Promise(resolve => setTimeout(resolve, 10))
    h.pool.setAuthSigner({ ...h.signer } as Signer)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(h.relay.subscribe).toHaveBeenCalledTimes(1)
    h.pool.close()
  })
})
