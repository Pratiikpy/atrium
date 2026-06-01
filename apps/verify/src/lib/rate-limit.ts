/**
 * Rate limiting, Phase 3 hardening, retuned 2026-06-01 after a QA sweep.
 *
 * Uses @upstash/ratelimit + @upstash/redis. Falls back to no-op when
 * Upstash env vars are not set (local dev).
 *
 * Why two buckets (read vs write):
 * A single previous bucket of 60 req/min/IP throttled legitimate use. The
 * authenticated dashboard fires many parallel GETs per page load and polls
 * on an interval, and React Query retries on 429, so a tight per-IP read
 * limit self-amplifies into a retry storm after ~3 page loads. Worse, a
 * buildathon demo puts several judges behind ONE venue-WiFi IP, so they
 * collectively share the budget and throttle each other. Reads are cheap,
 * public on-chain data and are cached, so they get a generous bucket; only
 * state-changing writes (rare per user: deposit, trade, mandate, feedback)
 * keep a tight bucket for spam protection.
 *
 * Both limits are env-tunable so the venue audience can be sized up for a
 * live demo without a redeploy.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

function posIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Reads: generous per-IP budget (default 600/min ≈ 10 rps sustained).
 *  Covers a power user clicking through the polling dashboard plus a small
 *  shared-IP demo audience, while a genuine flood (>10 rps) still trips. */
const READ_PER_MIN = posIntEnv('RATE_LIMIT_READ_PER_MIN', 600);

/** Writes: tight per-IP budget (default 60/min). Writes require signing/gas
 *  and are rare per user, so this blocks spam without affecting real use. */
const WRITE_PER_MIN = posIntEnv('RATE_LIMIT_WRITE_PER_MIN', 60);

export const ratelimitReadPerIp = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(READ_PER_MIN, '1 m'), prefix: 'rl:ip:read' })
  : null;

export const ratelimitWritePerIp = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(WRITE_PER_MIN, '1 m'), prefix: 'rl:ip:write' })
  : null;
