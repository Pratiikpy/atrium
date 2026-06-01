import type { MiddlewareHandler } from 'hono';

/**
 * Idempotency-Key: returns the cached response for 24h if the same key
 * arrives twice. Per TDD §8.2.
 *
 * Audit C-18 fix: persists into D1 so the cache survives Workers isolate
 * restarts and works across isolates. In-memory only would silently let
 * replays through.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Audit FIRE78-CODEX3 fix (sub-agent HIGH): cap the idempotency key length.
 * Pre-fix, a caller could submit a multi-MB key and INSERT OR REPLACE
 * resets its TTL on every call, repeated over many keys, D1 storage
 * grows unboundedly. 128 chars is well above the standard 36-char UUID
 * idempotency keys but small enough to make the storage attack
 * uneconomic.
 */
const MAX_KEY_LENGTH = 128;

interface IdempotencyEnv {
  DB: D1Database;
}

export const idempotency: MiddlewareHandler<{ Bindings: IdempotencyEnv }> = async (c, next) => {
  const key = c.req.header('Idempotency-Key');
  if (!key) return next();

  // Audit FIRE78-CODEX3 fix: reject keys above the cap before touching D1.
  if (key.length > MAX_KEY_LENGTH) {
    return c.json(
      {
        error: 'invalid_idempotency_key',
        detail: `Idempotency-Key must be <= ${MAX_KEY_LENGTH} characters`,
      },
      400
    );
  }

  const now = Date.now();

  // Cheap prune of expired rows. Best-effort; failure does not block the request.
  c.env.DB.prepare('DELETE FROM idempotency_cache WHERE expires_ms < ?').bind(now).run().catch(() => undefined);

  const cached = await c.env.DB
    .prepare('SELECT body, status FROM idempotency_cache WHERE key = ? AND expires_ms > ?')
    .bind(key, now)
    .first<{ body: string; status: number } | null>();

  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { 'X-Codex-Idempotent-Replay': 'true', 'Content-Type': 'application/json' },
    });
  }

  await next();
  const body = await c.res.clone().text();
  // Best-effort write; failure does not block the request response.
  c.env.DB
    .prepare('INSERT OR REPLACE INTO idempotency_cache (key, body, status, expires_ms) VALUES (?, ?, ?, ?)')
    .bind(key, body, c.res.status, now + TTL_MS)
    .run()
    .catch(() => undefined);
};
