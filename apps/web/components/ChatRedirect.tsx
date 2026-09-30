'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { sessionPubkey, useSession } from './SessionProvider'

/** Preserve old conversation links when moving to Armada DMs. */
export function ChatRedirect(): React.ReactNode {
  const router = useRouter()
  const params = useSearchParams()
  const { session, ready } = useSession()
  const viewer = sessionPubkey(session)
  const conversation = params.get('c')

  useEffect(() => {
    if (!ready) return
    if (!viewer) {
      router.replace('/login')
      return
    }
    const peers = conversation?.split(':') ?? []
    const valid = peers.length >= 1 && peers.length <= 11 && peers.includes(viewer)
      && peers.every(peer => /^[0-9a-f]{64}$/i.test(peer))
    const others = peers.filter(peer => peer !== viewer)
    if (valid && others.length === 0) others.push(viewer)
    router.replace(valid && others.length > 0
      ? `/groups/dm/${others.join(',')}`
      : '/groups/dm')
  }, [conversation, ready, router, viewer])

  return <p className="p-6 text-sm text-text-muted">Opening Messages…</p>
}
