import { afterEach, describe, expect, it } from 'vitest'
import { getSavedRelayControls, localRelayUrl, parseRelayControls, postEntries, saveRelayControls } from './relay-controls'
import { setActiveScope } from './scope'

afterEach(() => { setActiveScope(undefined) })
describe('account relay controls', () => {
  it('keeps Posts and DM selections separate across accounts', () => {
    const local = localRelayUrl()!
    setActiveScope('main-test')
    saveRelayControls({ rows: [{ url: local, posts: 'both', dms: false }, { url: 'wss://relay.ditto.pub/', posts: 'off', dms: true }] })
    setActiveScope('tester-test')
    expect(getSavedRelayControls()).toBeNull()
    saveRelayControls({ rows: [{ url: local, posts: 'both', dms: true }] })
    setActiveScope('main-test')
    const main = getSavedRelayControls()!
    expect(postEntries(main).map(row => row.url)).toEqual([local])
    expect(main.rows.filter(row => row.dms).map(row => row.url)).toEqual(['wss://relay.ditto.pub'])
    setActiveScope('tester-test')
    expect(getSavedRelayControls()?.rows).toEqual([{ url: local, posts: 'both', dms: true }])
  })
  it('rejects malformed or oversized persisted settings without enabling relays', () => {
    expect(parseRelayControls('{"rows":[{"url":"ftp://example.com","posts":"both","dms":true}]}')).toBeNull()
    expect(parseRelayControls(JSON.stringify({ rows: Array.from({ length: 31 }, () => ({ url: 'wss://example.com', posts: 'both', dms: true })) }))).toBeNull()
  })
})
