'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useStoredRelays } from '../lib/relay-apply'
import { useEffect, useState, type ReactNode } from 'react'

import { ThemeProvider } from '@nostrich/app'
import { DEFAULT_THEME } from '@nostrich/ui'

import { ClockProvider } from './Clock'
import { SessionProvider } from './SessionProvider'
import { currentTheme, subscribeTheme, type Theme } from '../lib/theme'

/** The relay list, applied. */
function StoredRelays(): null {
  useStoredRelays()
  return null
}

export function Providers({ children }: { children: ReactNode }): ReactNode {
  // Held in state, not module scope: a module-level client is shared across requests.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Every query here ends at a relay or a stranger's web server, and retrying.
            retry: false,
          },
        },
      }),
  )
  // Match the server-rendered root palette on the first render. Starting this
  // provider in light mode put light React Native text on the default dark
  // Slate canvas until the effect ran, and also caused a hydration mismatch.
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)

  useEffect(() => {
    setTheme(currentTheme())
    return subscribeTheme(setTheme)
  }, [])

  return (
    <QueryClientProvider client={client}>
      <SessionProvider>
        {/* Required by every component from @nostrich/app. */}
        <ThemeProvider theme={theme}>
          {/* Hands the reader's stored relay list to the pool before anything subscribes. */}
          <StoredRelays />
          <ClockProvider>{children}</ClockProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
