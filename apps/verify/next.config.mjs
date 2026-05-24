import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
  },
  // Serve the new visual landing (apps/verify/public/landing-v2.html) at `/`.
  // `beforeFiles` runs before the App Router so the request never hits
  // src/app/page.tsx — the previous landing is preserved under /legacy
  // for fast revert. The URL bar stays `/` (rewrite, not redirect).
  rewrites: async () => ({
    beforeFiles: [
      // Desktop landing — served at `/` unless middleware rewrites to the
      // mobile variant for a small-viewport User-Agent. The middleware
      // adds a `?m=1` marker query so this rewrite can still match the
      // root path for desktop without breaking the mobile rewrite.
      { source: '/', destination: '/landing-v2.html' },
      // Mobile landing per the new design (desing/Mobile Landing.html).
      // Anyone can hit /mobile directly to preview the mobile experience.
      { source: '/mobile', destination: '/mobile-landing.html' },
      // Mobile app shell (5-tab Home/Trade/Move/Agents/More) — the
      // mobile-native counterpart to the React /app/* routes.
      { source: '/mobile/app', destination: '/mobile-app.html' },
      // The bundled landing HTML hardcodes two links from when it was
      // authored as a static file pair. Map them to the real Next.js
      // routes so judges clicking "Open testnet" or "Brand kit" land
      // somewhere alive instead of a 404.
      { source: '/Atrium App.html', destination: '/app/portfolio' },
      { source: '/Atrium%20App.html', destination: '/app/portfolio' },
      { source: '/Brand Kit.html', destination: '/brand' },
      { source: '/Brand%20Kit.html', destination: '/brand' },
    ],
    afterFiles: [],
    fallback: [],
  }),
  // PWA + mobile-first per .claude/rules/ui.md
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
