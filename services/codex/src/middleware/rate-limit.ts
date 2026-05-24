import type { MiddlewareHandler } from 'hono';

/**
 * Per-IP / per-wallet / per-agent rate limit. Most restrictive applies.
 *
 * Year-1: Cloudflare Workers in-memory cache (per-isolate, ephemeral). Acceptable
 * for testnet since the Codex free tier caps at 100K req/day total — DOS surface
 * is limited by the CF account budget.
 *
 * Year-2: Cloudflare Durable Object backing store, or Redis (Upstash free tier).
 *
 * Audit FFF-4 fix: pre-fix, the `buckets` Map was unbounded. A long-lived
 * isolate (CF reuses up to ~30 min) handling rotating IPs/wallets would grow
 * memory monotonically until eviction. Now: periodic expired-key prune every
 * PRUNE_EVERY_N requests, plus a hard ceiling that evicts the oldest bucket
 * when the map exceeds MAX_BUCKETS.
 *
 * Audit FFF-5 fix: pre-fix, `X-Wallet-Address` was accepted as-is — an
 * attacker could either rotate random hex per request to reset their bucket,
 * or claim another wallet's address to grief that wallet's bucket. We now
 * format-validate to 0x-prefixed 40-hex. Spoofing is still possible without
 * a signed payload (see security.md — known testnet limit), but at least
 * the cardinality surface is bounded.
 */
type Bucket = { count: number; window_start_ms: number };
const buckets = new Map<string, Bucket>();
const WALLET_REGEX = /^0x[0-9a-fA-F]{40}$/;
const MAX_BUCKETS = 10_000;
const PRUNE_EVERY_N = 256;
let req_counter = 0;

// IMPORTANT: order matters. matchPath() uses `startsWith`, so more specific
// paths MUST appear before their less-specific prefixes
// (e.g. /v1/agents/leaderboard before /v1/agents). Insertion order of plain
// objects is preserved by ES2015+ for string keys.
const LIMITS: Record<string, { rpm: number }> = {
  '/v1/margin/account': { rpm: 60 },
  '/v1/positions': { rpm: 30 },
  '/v1/risk/snapshot': { rpm: 10 },
  '/v1/venues/health': { rpm: 120 },
  '/v1/agents/leaderboard': { rpm: 60 },
  '/v1/agents': { rpm: 30 },
  '/v1/backtest': { rpm: 5 },
  '/v1/attestation/latest': { rpm: 120 },
  // Stoa options endpoints — read-only contract calls. Cheap on the RPC
  // side, but still rate-limited to discourage probing while Stoa is in
  // Phase-2 scaffold mode (every call returns the same sentinel).
  '/v1/options': { rpm: 60 },
};

export const rateLimit: MiddlewareHandler = async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
  const walletRaw = c.req.header('X-Wallet-Address');
  // FFF-5: validate shape; reject malformed claims to a single 'unverified' bucket.
  const wallet = walletRaw && WALLET_REGEX.test(walletRaw) ? walletRaw.toLowerCase() : 'unverified';
  const path = matchPath(c.req.path);
  const limit = LIMITS[path]?.rpm ?? 30;

  const now = Date.now();
  const windowMs = 60_000;

  // FFF-4: amortized prune. Every PRUNE_EVERY_N requests, walk the map once
  // and drop expired entries. O(N) per prune but only once per 256 requests
  // and N is hard-capped at MAX_BUCKETS, so worst-case work per request is
  // ~40 entry inspections.
  req_counter = (req_counter + 1) & 0x7fff_ffff;
  if (req_counter % PRUNE_EVERY_N === 0) {
    for (const [k, v] of buckets) {
      if (now - v.window_start_ms > windowMs) buckets.delete(k);
    }
  }

  for (const id of [`ip:${ip}:${path}`, `wallet:${wallet}:${path}`]) {
    const b = buckets.get(id);
    if (!b || now - b.window_start_ms > windowMs) {
      // FFF-4: cap total size — if at ceiling, drop oldest before inserting.
      if (buckets.size >= MAX_BUCKETS) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey) buckets.delete(oldestKey);
      }
      buckets.set(id, { count: 1, window_start_ms: now });
      continue;
    }
    b.count += 1;
    if (b.count > limit) {
      return c.json(
        { error: 'rate_limited', detail: `Limit ${limit}/min on ${path}` },
        429,
        { 'Retry-After': '60' }
      );
    }
  }
  await next();
};

function matchPath(path: string): string {
  for (const p of Object.keys(LIMITS)) {
    if (path.startsWith(p)) return p;
  }
  return '/v1/_unknown';
}
