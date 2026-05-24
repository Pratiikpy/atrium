/**
 * Redact error details before returning them to a client.
 *
 * Mirrors `services/codex/src/lib/error-safe.ts`. Both surfaces have the same
 * threat model: raw `err.message` strings can leak gateway URLs, upstream
 * RPC endpoints, library stack traces, or env-var presence. In production
 * the client always gets a static placeholder; in dev the original message
 * is preserved for fast debugging.
 *
 * The full error is always logged server-side via `console.error` so it
 * remains accessible to ops without leaking to callers.
 *
 * Read paths:
 *   - apps/verify/src/app/api/lantern/latest/route.ts
 *   - apps/verify/src/app/api/lantern/verify-inclusion/route.ts
 *   - apps/verify/src/app/api/tax/export/route.ts
 *   - apps/verify/src/app/api/transfer/chain-balance/route.ts
 *   - apps/verify/src/app/api/chaos/inject/route.ts
 */
export function safeErrorDetail(err: unknown, fallback = 'upstream unavailable'): string {
  const e = err as Error;
  console.error('verify-app route error', e?.stack || e);
  if (process.env.NODE_ENV !== 'production') {
    return e?.message ?? fallback;
  }
  return fallback;
}
