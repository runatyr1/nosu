'use client'

import { useEffect } from 'react'

/** Registers the service worker, which is what makes the app installable in Chromium. */
export function ServiceWorker(): null {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    // A service worker is useful for the installed production app, but in
    // development it can keep an old Next.js client alive after the server has
    // restarted. That leaves the server and hydrated client on different
    // revisions (and can make the React Native theme fall back to light ink on
    // a dark page). Remove only this origin's app-owned PWA state while
    // developing so every reload uses the current bundle.
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )

      if ('caches' in window) {
        void window.caches.keys().then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith('nostrich-'))
              .map((key) => window.caches.delete(key)),
          ),
        )
      }

      return
    }

    const register = (): void => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* No install prompt. */
      })
    }

    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
