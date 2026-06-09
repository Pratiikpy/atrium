/**
 * Browser security headers, Phase 3 hardening.
 *
 * Applied to every response via next.config.mjs `headers()`.
 */

function buildCsp() {
  const isProduction = process.env.NODE_ENV === 'production';
  const devScriptEval = isProduction ? '' : " 'unsafe-eval'";
  const directives = [
    "default-src 'self'",
    // Audit fix (build-deploy #33): the New Relic browser agent (NewRelicLoader,
    // consent-gated) loads js-agent.newrelic.com and beacons to *.nr-data.net,
    // but the CSP blocked both - so even when NEXT_PUBLIC_NEW_RELIC_* is set the
    // agent silently failed. Allow its script + telemetry origins.
    `script-src 'self' 'unsafe-inline'${devScriptEval} https://vercel.live https://js-agent.newrelic.com`,
    // Audit fix (real-Rabby sweep 2026-06-02): the Coinbase Wallet SDK (the
    // `coinbaseWallet` smartWalletOnly connector in lib/wagmi.ts) spawns a
    // `blob:` Worker on init. Without an explicit worker-src it falls back to
    // script-src (no blob:), so EVERY page logged "Creating a worker from
    // 'blob:' violates ... script-src". Allow blob: for workers only - this
    // keeps script-src tight (no blob: scripts) while clearing the violation.
    // 'self' also covers the PWA service worker registered from /sw.js.
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https://sepolia.arbiscan.io https://*.simpleanalyticscdn.com",
    "connect-src 'self' https://*.sentry.io https://*.nr-data.net https://api.studio.thegraph.com https://arbitrum-sepolia.publicnode.com https://arb-sepolia.g.alchemy.com https://ethereum-sepolia.publicnode.com https://polygon-amoy.publicnode.com wss://relay.walletconnect.com https://rpc.walletconnect.com https://explorer-api.walletconnect.com https://verify.walletconnect.com https://pulse.walletconnect.org https://*.coinbase.com wss://*.coinbase.com https://api.simpleanalytics.com https://queue.simpleanalyticscdn.com https://api.web3.storage https://*.ipfs.w3s.link",
    "frame-src 'self' https://verify.walletconnect.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (isProduction) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=(), autoplay=(), encrypted-media=(), fullscreen=(), picture-in-picture=(), xr-spatial-tracking=()',
  },
  { key: 'Content-Security-Policy', value: buildCsp() },
];
