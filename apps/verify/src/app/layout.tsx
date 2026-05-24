import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { KaniBadge } from '@/components/kani-badge';

export const metadata: Metadata = {
  // Audit N: title separator is a middot (·) per desing/Atrium App.standalone.html
  // template ("Atrium · App"), not an em-dash. Em-dash was a Wave-J carryover.
  title: 'Atrium · verify',
  description:
    'Atrium Verifier Mode. Watch a hedged position open, a margin calculation run, a chaos drill, and a kill-switch revoke in 90 seconds. Every claim verifiable on-chain.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Atrium' },
  openGraph: {
    title: 'Atrium · verify',
    description: 'Cross-venue portfolio margin on Arbitrum. Verifiable in 90 seconds.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#FBFAF7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Audit N: Geist 300 + Instrument Serif both ship in desing/Atrium.html.
            Geist is the body sans; Instrument Serif italic is the wordmark/display. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap"
        />
      </head>
      <body>
        <Providers>
          <KaniBadge />
          {children}
        </Providers>
        {/* Audit N: live breathing favicon from desing/. window.setAtriumFavicon
            (status, breathe) lets demo surfaces flip it green on tx-success,
            red on chaos-trip. Defers until after hydration; doesn't block TTI. */}
        <script src="/atrium-favicon.js" defer />
      </body>
    </html>
  );
}
