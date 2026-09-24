export const GROUPS_BRIDGE_PROTOCOL = 'nosu-groups-v1' as const

export type GroupsBridgeMethod =
  | 'getPublicKey'
  | 'signEvent'
  | 'nip44.encrypt'
  | 'nip44.decrypt'
  | 'nip04.decrypt'

export interface GroupsBridgeRequest {
  protocol: typeof GROUPS_BRIDGE_PROTOCOL
  type: 'request'
  id: string
  method: GroupsBridgeMethod
  params: unknown[]
}

export interface GroupsBridgeResponse {
  protocol: typeof GROUPS_BRIDGE_PROTOCOL
  type: 'response'
  id: string
  result?: unknown
  error?: string
}

export interface GroupsBridgeSession {
  protocol: typeof GROUPS_BRIDGE_PROTOCOL
  type: 'session'
  status: 'anonymous' | 'readonly' | 'signed'
  pubkey?: string
  signerKind?: 'privatekey' | 'nip07' | 'nip46'
}

export interface GroupsBridgeTheme {
  protocol: typeof GROUPS_BRIDGE_PROTOCOL
  type: 'theme'
  name: string
  mode: 'light' | 'dark'
  colors: {
    background: string
    text: string
    primary: string
  }
}

export interface GroupsBridgeHello {
  protocol: typeof GROUPS_BRIDGE_PROTOCOL
  type: 'hello'
}

export interface GroupsBridgeNavigation {
  protocol: typeof GROUPS_BRIDGE_PROTOCOL
  type: 'navigation'
  path: string
}

export interface GroupsBridgeNavigate {
  protocol: typeof GROUPS_BRIDGE_PROTOCOL
  type: 'navigate'
  path: string
}

/** A route inside Armada, never an origin-changing URL. */
export function isSafeGroupsPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    value.length <= 4096
  )
}

export function isGroupsBridgeNavigation(value: unknown): value is GroupsBridgeNavigation {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Partial<GroupsBridgeNavigation>
  return (
    message.protocol === GROUPS_BRIDGE_PROTOCOL &&
    message.type === 'navigation' &&
    isSafeGroupsPath(message.path)
  )
}

export function isGroupsBridgeRequest(value: unknown): value is GroupsBridgeRequest {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Partial<GroupsBridgeRequest>
  return (
    message.protocol === GROUPS_BRIDGE_PROTOCOL &&
    message.type === 'request' &&
    typeof message.id === 'string' &&
    (message.method === 'getPublicKey' ||
      message.method === 'signEvent' ||
      message.method === 'nip44.encrypt' ||
      message.method === 'nip44.decrypt' ||
      message.method === 'nip04.decrypt') &&
    Array.isArray(message.params)
  )
}
