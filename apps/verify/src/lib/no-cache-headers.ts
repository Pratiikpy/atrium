/**
 * Cache-Control headers for user-specific routes — Phase 3 hardening.
 *
 * Applied to every route that uses requireWalletMatch to prevent CDN
 * caching of per-user data.
 */
export const noCacheHeaders: Record<string, string> = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};
