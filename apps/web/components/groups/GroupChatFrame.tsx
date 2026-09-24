'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { EventTemplate } from '@nostrich/nostr'

import {
  GROUPS_BRIDGE_PROTOCOL,
  isGroupsBridgeNavigation,
  isGroupsBridgeRequest,
  type GroupsBridgeNavigate,
  type GroupsBridgeResponse,
  type GroupsBridgeSession,
  type GroupsBridgeTheme,
} from '../../lib/groups-bridge'
import { currentTheme, subscribeTheme } from '../../lib/theme'
import { sessionPubkey, useSession } from '../SessionProvider'

function defaultGroupsUrl(): string {
  if (process.env.NEXT_PUBLIC_GROUPS_APP_URL) return process.env.NEXT_PUBLIC_GROUPS_APP_URL
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8080/'
  }
  return new URL('/groups-app/', window.location.origin).toString()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The signing request failed.'
}

function bridgeLog(event: string, detail: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV !== 'development') return
  console.debug(`[nostrix groups host] ${event} ${JSON.stringify(detail)}`)
}

/**
 * Hosts the source-preserved Armada application and exposes only the active
 * Nostrix signer's public NIP-07 surface. Private key material never crosses
 * this boundary.
 */
export function GroupChatFrame(): React.ReactNode {
  const frame = useRef<HTMLIFrameElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { session, ready } = useSession()
  const [baseUrl, setBaseUrl] = useState<string>()
  const pubkey = sessionPubkey(session)
  const nestedPath = pathname === '/groups'
    ? ''
    : pathname.startsWith('/groups/')
      ? pathname.slice('/groups/'.length)
      : ''
  const query = searchParams.toString()
  const hash = typeof window === 'undefined' ? '' : window.location.hash
  const requestedChildPath = `/${nestedPath}${query ? `?${query}` : ''}${hash}`
  // The src is only the iframe's boot address. Later outer-route changes are
  // bridged with postMessage so this persistent frame never reloads.
  const initialPath = useRef({ nestedPath, query, hash })

  useEffect(() => {
    bridgeLog('frame:mount', { path: window.location.pathname })
    setBaseUrl(defaultGroupsUrl())
    return () => bridgeLog('frame:unmount')
  }, [])

  useEffect(() => {
    bridgeLog('host-session:state', {
      ready,
      status: session.status,
      signerKind: session.status === 'signed' ? session.signer.kind : undefined,
    })
  }, [ready, session])

  const src = useMemo(() => {
    if (!baseUrl) return undefined
    const url = new URL(baseUrl, window.location.href)
    if (initialPath.current.nestedPath) {
      url.pathname = `${url.pathname.replace(/\/$/, '')}/${initialPath.current.nestedPath}`
    }
    url.search = initialPath.current.query
    url.hash = initialPath.current.hash
    return url.toString()
  }, [baseUrl])

  const postSession = useCallback(() => {
    if (!src || !frame.current?.contentWindow) return
    const message: GroupsBridgeSession = {
      protocol: GROUPS_BRIDGE_PROTOCOL,
      type: 'session',
      status: session.status,
      ...(pubkey ? { pubkey } : {}),
      ...(session.status === 'signed' ? { signerKind: session.signer.kind } : {}),
    }
    bridgeLog('session:send', {
      status: message.status,
      signerKind: message.signerKind,
    })
    frame.current.contentWindow.postMessage(message, new URL(src).origin)
  }, [pubkey, session, src])

  const postTheme = useCallback(() => {
    if (!src || !frame.current?.contentWindow) return
    const root = document.documentElement
    const styles = getComputedStyle(root)
    const customBackground = styles.getPropertyValue('--nostrix-custom-theme-bg').trim()
    const message: GroupsBridgeTheme = {
      protocol: GROUPS_BRIDGE_PROTOCOL,
      type: 'theme',
      name: currentTheme(),
      mode: root.classList.contains('dark') ? 'dark' : 'light',
      colors: {
        background: customBackground || styles.getPropertyValue('--role-bg').trim(),
        text: styles.getPropertyValue('--role-text').trim(),
        primary: styles.getPropertyValue('--role-accent').trim(),
      },
    }
    bridgeLog('theme:send', { name: message.name, mode: message.mode })
    frame.current.contentWindow.postMessage(message, new URL(src).origin)
  }, [src])

  useEffect(() => {
    if (!src) return
    const expectedOrigin = new URL(src).origin

    const onMessage = (event: MessageEvent): void => {
      if (event.source !== frame.current?.contentWindow || event.origin !== expectedOrigin) return
      const message = event.data as { protocol?: unknown; type?: unknown }
      if (message?.protocol !== GROUPS_BRIDGE_PROTOCOL) return
      if (message.type === 'diagnostic') {
        const diagnostic = event.data as { payload?: { event?: unknown; [key: string]: unknown } }
        const childEvent = typeof diagnostic.payload?.event === 'string' ? diagnostic.payload.event : 'unknown'
        bridgeLog(`child:${childEvent}`, diagnostic.payload ?? {})
        return
      }
      if (message.type === 'hello') {
        bridgeLog('hello:receive')
        postSession()
        postTheme()
        return
      }
      if (isGroupsBridgeNavigation(event.data)) {
        const target = event.data.path === '/' ? '/groups' : `/groups${event.data.path}`
        bridgeLog('navigation:receive', { path: event.data.path, target })
        router.replace(target, { scroll: false })
        return
      }
      if (!isGroupsBridgeRequest(event.data)) return

      const requestId = event.data.id.slice(0, 8)
      const startedAt = performance.now()
      bridgeLog('request:receive', {
        id: requestId,
        method: event.data.method,
        signerKind: session.status === 'signed' ? session.signer.kind : undefined,
      })

      const respond = (response: Omit<GroupsBridgeResponse, 'protocol' | 'type' | 'id'>): void => {
        const payload: GroupsBridgeResponse = {
          protocol: GROUPS_BRIDGE_PROTOCOL,
          type: 'response',
          id: event.data.id,
          ...response,
        }
        bridgeLog(response.error ? 'request:error' : 'request:complete', {
          id: requestId,
          method: event.data.method,
          elapsedMs: Math.round(performance.now() - startedAt),
          ...(response.error ? { error: response.error } : {}),
        })
        frame.current?.contentWindow?.postMessage(payload, expectedOrigin)
      }

      if (session.status !== 'signed') {
        respond({ error: 'Sign in to Nostrix with a signing-capable account first.' })
        return
      }

      const { signer } = session
      const run = async (): Promise<unknown> => {
        switch (event.data.method) {
          case 'getPublicKey':
            return signer.getPublicKey()
          case 'signEvent':
            return signer.signEvent(event.data.params[0] as EventTemplate)
          case 'nip44.encrypt':
            return signer.nip44Encrypt(String(event.data.params[0]), String(event.data.params[1]))
          case 'nip44.decrypt':
            return signer.nip44Decrypt(String(event.data.params[0]), String(event.data.params[1]))
          case 'nip04.decrypt':
            if (!signer.nip04Decrypt) throw new Error('This signer does not support NIP-04 decryption.')
            return signer.nip04Decrypt(String(event.data.params[0]), String(event.data.params[1]))
        }
      }

      void run().then(result => respond({ result })).catch(error => respond({ error: errorMessage(error) }))
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [postSession, postTheme, router, session, src])

  useEffect(postSession, [postSession])

  useEffect(() => {
    postTheme()
    return subscribeTheme(() => postTheme())
  }, [postTheme])

  useEffect(() => {
    if (!src || !frame.current?.contentWindow) return
    const message: GroupsBridgeNavigate = {
      protocol: GROUPS_BRIDGE_PROTOCOL,
      type: 'navigate',
      path: requestedChildPath,
    }
    bridgeLog('navigation:send', { path: message.path })
    frame.current.contentWindow.postMessage(message, new URL(src).origin)
  }, [requestedChildPath, src])

  if (!ready) return <div className="p-6 text-sm text-text-muted">Loading account…</div>
  if (session.status !== 'signed') {
    return (
      <section className="mx-auto flex min-h-[60dvh] max-w-lg flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-bold text-text">Group Chat requires a signer</h1>
        <p className="text-text-muted">
          Sign in with a local key, browser signer, or remote signer that supports NIP-44 encryption.
        </p>
      </section>
    )
  }
  if (!src) return <div className="p-6 text-sm text-text-muted">Loading Group Chat…</div>

  return (
    <iframe
      ref={frame}
      src={src}
      title="Nostrix Group Chat"
      onLoad={() => {
        bridgeLog('frame:load', { src })
        postSession()
        postTheme()
      }}
      onError={() => bridgeLog('frame:error', { src })}
      className="block h-[calc(100dvh-1px)] w-full border-0 bg-[#111214]"
      allow="camera; microphone; clipboard-read; clipboard-write; display-capture; fullscreen"
    />
  )
}
