import { Suspense } from 'react'

import { ChatRedirect } from '../../components/ChatRedirect'

export const metadata = { title: 'Messages' }

export default function ChatPage(): React.ReactNode {
  // Preserve existing Chat links while Armada owns the visible inbox.
  return (
    <Suspense fallback={null}>
      <ChatRedirect />
    </Suspense>
  )
}
