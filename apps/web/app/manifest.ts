import type { MetadataRoute } from 'next'

import { asset } from '../lib/assets'
import { BRAND } from '../config/brand'

/** The web app manifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.displayName,
    short_name: BRAND.shortName,
    description: BRAND.description,
    /* `id` pins the app's identity independently of `start_url`. */
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    /* White, matching the light `themeColor` in `layout.tsx`. */
    background_color: '#ffffff',
    theme_color: '#ffffff',
    orientation: 'any',
    categories: ['social'],
    icons: [
      /* TWO PURPOSES, and both are needed. */
      { src: asset('/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: asset('/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: asset('/icon-maskable-192.png'), sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: asset('/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
