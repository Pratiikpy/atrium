import type { Metadata, Viewport } from 'next';
import { Geist, Instrument_Serif } from 'next/font/google';
import './globals.css';
import './mobile-landing-dark.css';
import { Providers } from '@/components/providers';
import { KaniBadge } from '@/components/kani-badge';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { RegisterSW } from '@/components/register-sw';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { NewRelicLoader } from '@/components/new-relic-loader';

/* PERF-03: Self-hosted via next/font/google, eliminates external Google Fonts
   request, removes SRI concern (websec F3), and enables font subsetting. */
const geist = Geist({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-geist',
  display: 'swap',
});
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  // Own variable name (NOT --font-serif): --font-serif collides with Tailwind
  // v4's serif theme key, which created a var cycle that collapsed the wordmark
  // to Geist/Georgia on some routes. --serif reads this; Tailwind's --font-serif
  // reads --serif. Linear, no cycle.
  variable: '--font-instrument',
  display: 'swap',
});

/* SEO-02: metadataBase enables relative canonical URLs across all pages.
   SEO-06: Twitter card + keywords for landing shares.
   SEO-10: canonical is per-page. The layout does NOT set a global canonical:
   a global '/' made every non-overriding subpage canonicalize to the
   homepage (Google then de-indexes them as duplicates). The landing sets its
   own canonical '/'; other pages self-canonicalize to their own URL. */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://useatrium.me'),
  title: { template: '%s · Atrium', default: 'Atrium · verify' },
  description:
    'Atrium Verifier Mode. Watch a position open, a margin calculation run, a chaos drill, and a kill-switch revoke in 90 seconds. Every claim verifiable on-chain.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Atrium' },
  openGraph: {
    // Templated like `title` so a subpage share gets a page-specific og:title
    // ("Team · Atrium", "Architecture Decision Records · Atrium") instead of
    // inheriting one generic string. A page's own openGraph.title still wins.
    title: { template: '%s · Atrium', default: 'Atrium · verify' },
    description: 'Cross-venue portfolio margin on Arbitrum. Verifiable in 90 seconds.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: { template: '%s · Atrium', default: 'Atrium · cross-venue portfolio margin' },
    description: 'One wallet posts collateral once. Trades across venues with one margin number.',
  },
  keywords: ['portfolio margin', 'cross-venue', 'Arbitrum', 'DeFi', 'EVM'],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#141210' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
      </head>
      <body className={`${geist.variable} ${serif.variable} font-sans`}>
        {/* A11Y-06: Skip-to-content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:bg-bg focus:p-2 focus:z-50 focus:rounded-md focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <Providers>
          <KaniBadge />
          {children}
          <CookieConsentBanner />
          <PwaInstallPrompt />
          <RegisterSW />
          <NewRelicLoader />
        </Providers>
        {/* Audit N: live breathing favicon from design/. window.setAtriumFavicon
            (status, breathe) lets demo surfaces flip it green on tx-success,
            red on chaos-trip. Defers until after hydration; doesn't block TTI. */}
        <script src="/atrium-favicon.js" defer />
      </body>
    </html>
  );
}
