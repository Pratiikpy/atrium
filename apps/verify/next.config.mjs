import { withSentryConfig } from '@sentry/nextjs';

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
      // Mobile app shell (5-tab Home/Trade/Move/Agents/More): design
      // preview until the React /app/* routes are made responsive
      // (Phase delta.2 of the 2026-05-24 fix plan).
      { source: '/mobile/app', destination: '/mobile-app.html' },
    ],
    afterFiles: [],
    fallback: [],
  }),
  // PWA + mobile-first per docs/conventions/ui.md
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // Permissions-Policy disabled here for the landing bundle; the
        // page uses fonts.googleapis.com + blob: URLs from its inline
        // bundler. The full policy still lives on the rest of the site.
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
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
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
});
