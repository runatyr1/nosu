import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRelayPrefs } from './relay-prefs'
import { getSavedRelayControls, localRelayUrl, saveRelayControls } from './relay-controls'
import { setActiveScope } from './scope'

const fakes = vi.hoisted(() => ({ publish: vi.fn(), signEvent: vi.fn(), session: {} as any }))
vi.mock('../components/SessionProvider', () => ({ useSession: () => ({ session: fakes.session, ready: true }), sessionPubkey: (session: any) => session.pubkey, sessionSigner: (session: any) => session.signer }))
vi.mock('./pool', () => ({ getPool: () => ({ query: vi.fn().mockResolvedValue([]), readRelays: () => ['ws://localhost:3000/relay'], publish: fakes.publish }) }))
let root: Root | undefined
let node: HTMLDivElement
let prefs: ReturnType<typeof useRelayPrefs>
function Reader() { prefs = useRelayPrefs(); return null }
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  setActiveScope('save-test')
  saveRelayControls({ rows: [{ url: localRelayUrl()!, posts: 'both', dms: true }] })
  fakes.signEvent.mockReset().mockImplementation(async template => ({ ...template, pubkey: 'a'.repeat(64), id: 'b'.repeat(64), sig: 'c'.repeat(128) }))
  fakes.publish.mockReset().mockResolvedValue([{ ok: true, relay: localRelayUrl() }])
  fakes.session = { status: 'signed', pubkey: 'a'.repeat(64), signer: { signEvent: fakes.signEvent } }
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  await act(async () => root!.render(createElement(Reader)))
})
afterEach(async () => { await act(async () => root?.unmount()); node.remove(); setActiveScope(undefined); vi.unstubAllGlobals() })
describe('Save relay controls', () => {
  it('keeps draft changes inactive until both standardized lists are accepted', async () => {
    await act(async () => { prefs.add('wss://relay.ditto.pub') })
    await act(async () => { prefs.change('wss://relay.ditto.pub', { dms: true }); prefs.change(localRelayUrl()!, { dms: false }) })
    expect(getSavedRelayControls()?.rows).toHaveLength(1)
    await act(async () => prefs.save())
    expect(fakes.publish.mock.calls.map(call => call[0].kind)).toEqual([10002, 10050])
    expect(fakes.publish.mock.calls[0]?.[0].tags).toEqual([['r', localRelayUrl()]])
    expect(fakes.publish.mock.calls[1]?.[0].tags).toEqual([['relay', 'wss://relay.ditto.pub']])
    expect(getSavedRelayControls()?.rows.filter(row => row.dms).map(row => row.url)).toEqual(['wss://relay.ditto.pub'])
  })
  it('does not activate a draft when a list is refused', async () => {
    await act(async () => prefs.change(localRelayUrl()!, { posts: 'both', dms: false }))
    fakes.publish.mockResolvedValueOnce([{ ok: true }]).mockResolvedValueOnce([{ ok: false }])
    await act(async () => prefs.save())
    expect(getSavedRelayControls()?.rows[0]?.dms).toBe(true)
    expect(prefs.note).toContain('not accepted')
  })
})
