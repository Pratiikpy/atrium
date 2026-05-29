/**
 * Rate limiting — Phase 3 hardening.
 *
 * Uses @upstash/ratelimit + @upstash/redis. Falls back to no-op when
 * Upstash env vars are not set (local dev).
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

/** 60 requests per minute per IP (sliding window). */
export const ratelimitPerIp = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'rl:ip' })
  : null;

/** 120 requests per minute per wallet (sliding window). */
export const ratelimitPerWallet = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 m'), prefix: 'rl:wallet' })
  : null;
