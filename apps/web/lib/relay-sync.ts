'use client'

import { useEffect, useState } from 'react'
import { createHttpAuth, httpAuthHeader, type Signer, type NostrEvent } from '@nostrich/nostr'
import { SERVICE_CONFIG } from '../../../packages/nostr/service-config'
import { getPool, setLocalPublicationForwarder } from './pool'

export interface RelaySyncCapabilities { enabled: boolean; peer: string; localRelay: string }
export interface RelayAuthChallenge { id: string; relay: string; challenge: string }
export type RelaySyncStatus = { state: 'disabled' | 'connecting' | 'authorized' | 'error'; message?: string }
class SignerPermissionError extends Error {}

/** Never sign challenges for a target supplied by an untrusted relay response. */
export async function signSyncChallenge(signer: Signer, request: RelayAuthChallenge, capabilities: RelaySyncCapabilities): Promise<NostrEvent> {
  if (request.relay !== capabilities.peer && request.relay !== capabilities.localRelay) throw new Error('Unexpected relay authentication target')
  const target = new URL(request.relay)
  if (!['ws:', 'wss:'].includes(target.protocol) || !request.id || !request.challenge || request.challenge.length > 4096) throw new Error('Invalid relay authentication challenge')
  return signer.signEvent({
    kind: 22242, created_at: Math.floor(Date.now() / 1000), content: '',
    tags: [['relay', request.relay], ['challenge', request.challenge]],
  })
}

/** Session bearer tokens remain in this effect's memory and die with the active signer. */
export function useRelaySync(signer?: Signer): { status: RelaySyncStatus; retry: () => void } {
  const [status, setStatus] = useState<RelaySyncStatus>({ state: 'disabled' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const pool = getPool()
    pool.setAuthSigner?.(signer)
    if (!signer) { setStatus({ state: 'disabled' }); return }
    let disposed = false
    let token: string | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let renewal: ReturnType<typeof setTimeout> | undefined
    const publications: NostrEvent[] = []
    const controller = new AbortController()
    const base = new URL(SERVICE_CONFIG.deployment.relaySyncPath + '/', window.location.origin).href
    const release = (bearer: string): void => {
      void fetch(base + 'session', { method: 'DELETE', headers: { Authorization: `Bearer ${bearer}` }, keepalive: true }).catch(() => {})
    }
    const request = async (path: string, init?: RequestInit): Promise<Response> => {
      const response = await fetch(base + path, { ...init, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(40000)]) })
      if (!response.ok) throw new Error(`Relay synchronization request failed (${response.status})`)
      return response
    }
    const update = (next: RelaySyncStatus): void => { if (!disposed) setStatus(next) }
    setLocalPublicationForwarder(event => {
      if (![4, 78, 1059, 30078].includes(event.kind) && !event.tags.some(tag => tag[0] === '-')) return
      if (publications.some(queued => queued.id === event.id)) return
      if (publications.length >= 128) { update({ state: 'error', message: 'Private forwarding queue is full. Messages remain stored on the local relay.' }); return }
      publications.push(event)
    })
    const start = async (): Promise<void> => {
      // Installations without the optional synchronization service remain quiet.
      const response = await fetch(base + 'capabilities', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      if (response.status === 404) { update({ state: 'disabled' }); return }
      if (!response.ok) throw new Error(`Relay synchronization unavailable (${response.status})`)
      const capabilities = await response.json() as RelaySyncCapabilities
      if (!capabilities.enabled) { update({ state: 'disabled' }); return }
      // The local endpoint must belong to this deployment, never a container host.
      const local = new URL(capabilities.localRelay)
      const expected = new URL(SERVICE_CONFIG.deployment.relayPath, window.location.origin)
      expected.protocol = expected.protocol === 'https:' ? 'wss:' : 'ws:'
      if (local.href !== expected.href || new URL(capabilities.peer).protocol !== 'wss:') throw new Error('Invalid relay synchronization configuration')
      update({ state: 'connecting' })
      const url = base + 'session'
      let signed: NostrEvent
      try { signed = await createHttpAuth(signer, { url, method: 'POST', content: '' }) }
      catch { throw new SignerPermissionError('Signer permission required') }
      if (disposed) return
      const session = await (await request('session', { method: 'POST', headers: { Authorization: httpAuthHeader(signed) } })).json() as { token: string; pubkey: string; expiresAt: number }
      if (!session.token || session.pubkey !== await signer.getPublicKey()) throw new Error('Invalid relay synchronization session')
      token = session.token
      if (disposed) { release(token); return }
      if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) throw new Error('Invalid relay session expiry')
      renewal = setTimeout(() => { if (!disposed) setAttempt(value => value + 1) }, Math.max(1000, session.expiresAt - Date.now() - 60000))
      const handled = new Set<string>()
      let failures = 0
      const poll = async (): Promise<void> => {
        if (disposed || !token) return
        try {
          const data = await (await request('session/challenges', { headers: { Authorization: `Bearer ${token}` } })).json() as { challenges: RelayAuthChallenge[]; status?: { authenticated?: boolean; syncing?: boolean; completed?: boolean; error?: string; queued?: number } }
          if (!Array.isArray(data.challenges) || data.challenges.length > 16) throw new Error('Invalid relay authentication response')
          for (const challenge of data.challenges) {
            if (handled.has(challenge.id)) continue
            let event: NostrEvent
            try { event = await signSyncChallenge(signer, challenge, capabilities) } catch {
              if (token) release(token)
              token = undefined
              update({ state: 'error', message: 'Private relay sync needs signer permission. Your signing service may require approval.' })
              return // Avoid recurring approval prompts after denial.
            }
            if (disposed) return
            await request('session/auth', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: challenge.id, event }) })
            handled.add(challenge.id)
            if (handled.size > 128) handled.delete(handled.values().next().value!)
          }
          while (publications.length && token && !disposed) {
            await request('session/publish', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ event: publications[0] }) })
            publications.shift()
          }
          failures = 0
          update(data.status?.error
            ? { state: 'error', message: 'Private relay sync reported a relay failure. See relay diagnostics.' }
            : { state: data.status?.authenticated ? 'authorized' : 'connecting', message: data.status?.completed ? 'Private relay history processed; relay policy exclusions are shown in diagnostics' : data.status?.syncing ? 'Private relay history syncing…' : data.status?.authenticated ? 'Private relay sync authorized' : 'Authorizing private relay sync…' })
        } catch {
          if (disposed) return
          failures++
          if (failures >= 3) {
            if (token) release(token)
            token = undefined
            if (!disposed) renewal = setTimeout(() => setAttempt(value => value + 1), 30000)
            update({ state: 'error', message: 'Private relay connection lost. Reconnecting automatically.' })
            return
          }
          update({ state: 'error', message: 'Private relay sync is temporarily unavailable. Retrying automatically.' })
        }
        if (!disposed) timer = setTimeout(() => void poll(), Math.min(30000, 2000 * 2 ** Math.min(failures, 4)))
      }
      await poll()
    }
    void start().catch(error => {
      if (token) { release(token); token = undefined }
      if (disposed) return
      if (error instanceof SignerPermissionError) {
        update({ state: 'error', message: 'Private relay sync needs signer permission. Your signing service may require approval.' })
      } else {
        renewal = setTimeout(() => setAttempt(value => value + 1), 30000)
        update({ state: 'error', message: 'Private relay sync is waiting for the relay. Reconnecting automatically.' })
      }
    })
    return () => {
      disposed = true
      controller.abort()
      if (timer) clearTimeout(timer)
      if (renewal) clearTimeout(renewal)
      if (token) release(token)
      setLocalPublicationForwarder(undefined)
      pool.setAuthSigner?.(undefined)
    }
  }, [signer, attempt])
  return { status, retry: () => setAttempt(value => value + 1) }
}
