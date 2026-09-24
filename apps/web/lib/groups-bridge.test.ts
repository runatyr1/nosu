import { describe, expect, it } from 'vitest'

import {
  GROUPS_BRIDGE_PROTOCOL,
  isGroupsBridgeNavigation,
  isGroupsBridgeRequest,
  isSafeGroupsPath,
} from './groups-bridge'

describe('groups signer bridge messages', () => {
  it('accepts only the explicit signer method allowlist', () => {
    expect(
      isGroupsBridgeRequest({
        protocol: GROUPS_BRIDGE_PROTOCOL,
        type: 'request',
        id: '1',
        method: 'nip44.decrypt',
        params: ['peer', 'ciphertext'],
      }),
    ).toBe(true)

    expect(
      isGroupsBridgeRequest({
        protocol: GROUPS_BRIDGE_PROTOCOL,
        type: 'request',
        id: '2',
        method: 'exportPrivateKey',
        params: [],
      }),
    ).toBe(false)
  })

  it('rejects messages from another protocol or without an id', () => {
    expect(
      isGroupsBridgeRequest({
        protocol: 'another-app',
        type: 'request',
        id: '1',
        method: 'getPublicKey',
        params: [],
      }),
    ).toBe(false)
    expect(
      isGroupsBridgeRequest({
        protocol: GROUPS_BRIDGE_PROTOCOL,
        type: 'request',
        method: 'getPublicKey',
        params: [],
      }),
    ).toBe(false)
  })

  it('accepts internal navigation but rejects origin-changing paths', () => {
    expect(isSafeGroupsPath('/c/community/channel?tab=members#invite')).toBe(true)
    expect(isSafeGroupsPath('//malicious.example/path')).toBe(false)
    expect(isSafeGroupsPath('https://malicious.example/path')).toBe(false)
    expect(
      isGroupsBridgeNavigation({
        protocol: GROUPS_BRIDGE_PROTOCOL,
        type: 'navigation',
        path: '/discover',
      }),
    ).toBe(true)
  })
})
