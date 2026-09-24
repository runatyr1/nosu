/** Public presentation settings. Protocol and storage identifiers stay upstream-compatible. */
export const BRAND = {
  displayName: 'Nosu',
  shortName: 'Nosu',
  description:
    'A modular Nostr client for social feeds, encrypted communities, and more.',
  publicOrigin: process.env.NEXT_PUBLIC_APP_URL ?? 'https://nosu.social',
} as const
