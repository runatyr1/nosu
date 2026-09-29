'use client'

import { useLayoutEffect } from 'react'
import { getPool } from './pool'
import { defaultRelayControls, postEntries, useSavedRelayControls } from './relay-controls'
import { useSession } from '../components/SessionProvider'

/** Apply account settings before content subscriptions attach, including account switches. */
export function useStoredRelays(): void {
  const { session } = useSession()
  const saved = useSavedRelayControls()
  const serialized = JSON.stringify(saved)
  const account = session.status === 'anonymous' ? undefined : session.pubkey
  useLayoutEffect(() => { getPool().setRelays(postEntries(saved ?? defaultRelayControls())) }, [serialized, account])
}
