/**
 * Strict origin allowlist: Phase 3 hardening.
 *
 * Replaces the loose `*.vercel.app` wildcard that previously allowed any
 * Vercel preview deployment to call sensitive routes (chaos, etc.).
 */

const STATIC_ORIGINS = [
  'https://verify.atrium.fi',
  'https://atrium.fi',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const PREVIEW_REGEX = new RegExp(
  process.env.ATRIUM_ALLOWED_PREVIEW_REGEX ??
    '^https:\\/\\/atrium-verify-[a-z0-9-]+-(atrium)\\.vercel\\.app$',
);

export function isAllowedOrigin(origin: string | null): boolean {
  // No Origin header = server-to-server or curl; gate via secret instead
  if (!origin) return true;
  if (STATIC_ORIGINS.includes(origin)) return true;
  return PREVIEW_REGEX.test(origin);
}

/**
 * Audit fix (#77): strict variant for routes that sign on-chain writes (the
 * chaos inject/restore pause levers). For a signing route, a missing Origin
 * header must NOT auto-pass - a curl/server-to-server POST with no Origin would
 * otherwise clear the allowlist and reach the on-chain pause path. The browser
 * Chaos UI always sends an Origin, so it is unaffected. The lenient
 * `isAllowedOrigin` stays correct for read routes that legitimately serve
 * server-to-server callers with no Origin.
 */
export function isAllowedOriginStrict(origin: string | null): boolean {
  if (!origin) return false;
  return isAllowedOrigin(origin);
}
