import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RelayUrl } from '@nostrich/nostr'
import { detectRelayCapabilities } from './relay-capabilities'
import { forgetRelayInfo } from './relay-info'

const relay = 'wss://example.test/' as RelayUrl
const pubkey = 'a'.repeat(64)
class Socket {
  static OPEN = 1
  static instances: Socket[] = []
  readyState = 1
  onopen?: () => void
  onmessage?: (event: { data: string }) => void
  onerror?: () => void
  onclose?: () => void
  send = vi.fn()
  close = vi.fn()
  constructor() { Socket.instances.push(this) }
  receive(message: unknown): void { this.onmessage?.({ data: JSON.stringify(message) }) }
}

beforeEach(() => {
  forgetRelayInfo()
  Socket.instances = []
  vi.stubGlobal('WebSocket', Socket)
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
const document = (body: unknown): void => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })))
}
async function pendingProbe(): Promise<{ result: ReturnType<typeof detectRelayCapabilities>; socket: Socket }> {
  const result = detectRelayCapabilities(relay, { pubkey })
  await vi.waitFor(() => expect(Socket.instances.length).toBe(1))
  const socket = Socket.instances[0]!
  socket.onopen?.()
  return { result, socket }
}

describe('detectRelayCapabilities', () => {
  it('preserves advertised capability evidence without claiming tested storage', async () => {
    document({ supported_nips: [1, 42, 59, 59, '17', -1] })
    const result = await detectRelayCapabilities(relay, { pubkey })
    expect(result.supportedNips).toEqual([1, 42, 59])
    expect(result.posts.evidence).toBe('advertised')
    expect(result.dms.evidence).toBe('advertised')
    expect(result.dms.detail).toContain('not been verified')
    expect(Socket.instances).toHaveLength(0)
  })

  it('uses bounded recipient reads and does not equate empty results with DM support', async () => {
    document({})
    const { result, socket } = await pendingProbe()
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify(['REQ', 'cap-dms', { kinds: [1059], '#p': [pubkey], limit: 1 }]))
    socket.receive(['EOSE', 'cap-posts'])
    socket.receive(['EOSE', 'cap-dms'])
    const capabilities = await result
    expect(capabilities.posts.status).toBe('supported')
    expect(capabilities.posts.evidence).toBe('observed')
    expect(capabilities.dms.status).toBe('unknown')
    expect(capabilities.dms.evidence).toBe('observed')
    expect(socket.close).toHaveBeenCalledTimes(1)
    expect(socket.send.mock.calls.every(([value]) => ['REQ', 'CLOSE'].includes(JSON.parse(value)[0]))).toBe(true)
  })

  it('does not mistake an optional auth challenge for failed public reads', async () => {
    document({})
    const { result, socket } = await pendingProbe()
    socket.receive(['AUTH', 'challenge'])
    socket.receive(['EOSE', 'cap-posts'])
    socket.receive(['CLOSED', 'cap-dms', 'auth-required: authenticate'])
    const capabilities = await result
    expect(capabilities.posts.status).toBe('supported')
    expect(capabilities.dms.status).toBe('unknown')
    expect(capabilities.dms.detail).toContain('authentication')
  })

  it('falls back to the websocket when NIP-11 is CORS-blocked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('CORS') }))
    const { result, socket } = await pendingProbe()
    socket.receive(['EOSE', 'cap-posts'])
    socket.receive(['EOSE', 'cap-dms'])
    expect((await result).posts.status).toBe('supported')
  })

  it('closes the probe on cancellation', async () => {
    document({})
    const signal = new AbortController()
    const result = detectRelayCapabilities(relay, { pubkey, signal: signal.signal })
    await vi.waitFor(() => expect(Socket.instances.length).toBe(1))
    signal.abort()
    await result
    expect(Socket.instances[0]!.close).toHaveBeenCalledTimes(1)
  })
})
