import { withSentryConfig } from '@sentry/nextjs';
import { securityHeaders } from './src/lib/security-headers.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
  },
  // Audit 2026-05-24 C-3 fix: `/` no longer rewrites to landing-v2.html.
  // The root is now the React landing at src/app/page.tsx, which reproduces
  // the same 11-section design but hydrates numbers from /api routes that
  // read Scribe + RPC. Mobile + design-preview rewrites stay; the static
  // bundle is deleted from /public.
  rewrites: async () => ({
    beforeFiles: [
      // Mobile landing: the OLED-dark mobile-native page from
      // `design/Mobile Landing.html`. Anyone can hit /mobile directly to
      // preview the mobile experience.
      { source: '/mobile', destination: '/mobile-landing.html' },
      // Mobile app shell: the React /app/* routes are now fully responsive
      // (every page ships a `md:hidden <X>Mobile` panel + MobileBottomNav +
      // KillSwitchFAB on real data), so /mobile/app serves the REAL app rather
      // than the old static mock, which shipped fabricated numbers
      // ($12,374,820 buying power etc.), a no-fake-data / no-misleading-info fix.
      { source: '/mobile/app', destination: '/app' },
    ],
    afterFiles: [],
    fallback: [],
  }),
  // PWA + mobile-first per docs/conventions/ui.md
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
};

// Sentry webpack plugin wrapper.
// Without SENTRY_AUTH_TOKEN this is a no-op at build time. The runtime SDK
// (initialized in sentry.*.config.ts via instrumentation.ts) still captures
// errors using the public NEXT_PUBLIC_SENTRY_DSN. Add SENTRY_AUTH_TOKEN
// to the build env when sourcemap upload / release tracking matters.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? 'amityonline',
  project: process.env.SENTRY_PROJECT ?? 'atrium-verify',
  silent: !process.env.CI,
  widenClientFileUpload: false,
  // Route browser -> /monitoring -> Sentry to bypass ad blockers that
  // block direct *.sentry.io calls.
  // PERF-08 / F15: The CSP connect-src directive in security-headers.mjs
  // must include 'self' (which covers /monitoring). If tunnelRoute changes,
  // update the CSP accordingly. The tunnel proxies to o<id>.ingest.sentry.io
  // so no external Sentry domain is needed in connect-src.
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
});
