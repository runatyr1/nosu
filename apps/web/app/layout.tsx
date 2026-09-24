import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'

import { Providers } from '../components/Providers'
import { AppShell } from '../components/AppShell'
import { ServiceWorker } from '../components/ServiceWorker'
import { StaleBuildRescue } from '../components/StaleBuildRescue'
import { SCROLL_TOP_SCRIPT } from '../lib/scroll'
import { BADGE_BOOTSTRAP_SCRIPT } from '../lib/badge-color'
import { FONT_BOOTSTRAP_SCRIPT } from '../lib/font-size'
import { asset } from '../lib/assets'
import { BRAND } from '../config/brand'
import { DEFAULT_THEME, THEME_CLASSES, themeInitScript } from '@nostrich/ui'
import { CUSTOM_THEME_BOOTSTRAP_SCRIPT } from '../lib/theme-data'
import './globals.css'

const appUrl = BRAND.publicOrigin

/** The brand typeface, matched to the wordmark. */
const brand = Poppins({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

/** Said in four places. */
const SITE_DESCRIPTION = BRAND.description
const THEME_BOOTSTRAP_SCRIPT = themeInitScript()

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: BRAND.displayName,
    template: `%s · ${BRAND.displayName}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: BRAND.displayName,
  // The SVG is the primary icon.
  icons: {
    icon: [
      /** `favicon.svg`, not `logo.svg`: same mark, darker ground. */
      { url: asset('/favicon.svg'), type: 'image/svg+xml' },
      { url: asset('/favicon-96.png'), sizes: '96x96', type: 'image/png' },
      { url: asset('/favicon-32.png'), sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: asset('/apple-touch-icon.png'), sizes: '180x180' }],
  },
  openGraph: {
    title: BRAND.displayName,
    description: SITE_DESCRIPTION,
    url: appUrl,
    siteName: BRAND.displayName,
    type: 'website',
    images: [
      {
        // A LITERAL path, not asset().
        url: '/nostrich-og.png',
        width: 3200,
        height: 1800,
        alt: `${BRAND.displayName}, a modular Nostr client.`,
      },
    ],
  },
  /** Twitter reads its own tags before falling back to Open Graph. */
  twitter: {
    card: 'summary_large_image',
    title: BRAND.displayName,
    description: SITE_DESCRIPTION,
    images: ['/nostrich-og.png'],
  },
}

export const viewport: Viewport = {
  /** `viewport-fit=cover`. */
  viewportFit: 'cover',
  /** Repainted before content by THEME_BOOTSTRAP_SCRIPT. */
  themeColor: '#101215',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The bootstrap script below edits this element's class list before React hydrates.
    <html
      lang="en"
      suppressHydrationWarning
      className={[brand.variable, ...THEME_CLASSES[DEFAULT_THEME]].join(' ')}
    >
      <head>
        {/* Material Symbols, the icon set the ported X layout uses. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
      {/* STRUCTURED DATA. It was added to earn a thumbnail beside the search result. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': `${appUrl}#organization`,
                  name: BRAND.displayName,
                  url: appUrl,
                  logo: {
                    '@type': 'ImageObject',
                    url: `${appUrl}/icon-1024.png`,
                    width: 1024,
                    height: 1024,
                  },
                },
                {
                  '@type': 'WebSite',
                  '@id': `${appUrl}#website`,
                  name: BRAND.displayName,
                  url: appUrl,
                  publisher: { '@id': `${appUrl}#organization` },
                },
                {
                  '@type': 'SoftwareApplication',
                  name: BRAND.displayName,
                  url: appUrl,
                  applicationCategory: 'SocialNetworkingApplication',
                  operatingSystem: 'Web',
                  image: `${appUrl}/icon-1024.png`,
                  description: SITE_DESCRIPTION,
                  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-dvh bg-bg text-text">
        {/* First things in the body and deliberately blocking: they run before content paints. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: CUSTOM_THEME_BOOTSTRAP_SCRIPT }} />
        {/* Same reasoning as the theme script: applied before paint, or the reader watches. */}
        <script dangerouslySetInnerHTML={{ __html: FONT_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: BADGE_BOOTSTRAP_SCRIPT }} />
        {/* Same reason it is here and not in an effect. */}
        <script dangerouslySetInnerHTML={{ __html: SCROLL_TOP_SCRIPT }} />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-accent"
        >
          Skip to content
        </a>

        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        {/* Outside `Providers`: it needs no context and nothing renders. */}
        <ServiceWorker />
        {/* Beside it for the same reason: needs no context, renders nothing. */}
        <StaleBuildRescue />
      </body>
    </html>
  )
}
