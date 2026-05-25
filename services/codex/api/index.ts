/**
 * Vercel Edge Function entry for Codex.
 *
 * The same Hono app from src/index.ts runs under Vercel's Edge runtime —
 * Hono ships a `handle()` adapter that wires the standard Request/Response
 * pair the Edge runtime delivers.
 *
 * Storage backing (Phase theta.2 fix, 2026-05-25):
 *   - Cloudflare Worker primary uses D1 (services/codex/src/db/schema.sql).
 *   - Vercel Edge here uses Upstash Redis REST (services/codex/src/lib/
 *     upstash-db.ts) when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *     are configured. Pre-fix the Vercel deploy fell back to inMemoryDB on
 *     every request — per-instance state lost on cold start, which silently
 *     disabled x402 replay-dedup and Idempotency-Key dedup. Upstash gives
 *     both deploys identical replay/idempotency semantics.
 *   - When Upstash is not configured, the entry still falls back to
 *     inMemoryDB but logs a startup warning so the gap is visible.
 *
 * Env vars are read from process.env (Vercel Edge exposes them).
 */
import app from '../src/index';
import { inMemoryDB } from '../src/lib/inmemory-db';
import { maybeUpstashDB } from '../src/lib/upstash-db';

export const config = {
  runtime: 'edge',
};

const upstashDB = maybeUpstashDB(process.env);
if (!upstashDB) {
  console.warn(
    '[codex/vercel] UPSTASH_REDIS_REST_URL or _TOKEN unset — falling back ' +
      'to per-instance inMemoryDB. x402 replay-dedup + idempotency are NOT ' +
      'durable. Configure both env vars in the Vercel project to enable ' +
      'Upstash-backed dedup. See human_left.md `codex-vercel-upstash`.',
  );
}

export default async function handler(req: Request): Promise<Response> {
  // Hono's app.fetch signature: (request, env, executionContext).
  // We inject the DB shim + the rest of env vars Codex reads.
  const env = {
    DB: upstashDB ?? inMemoryDB,
    ENV: process.env.ENV ?? 'production',
    SCRIBE_URL: process.env.SCRIBE_URL ?? '',
    ARBITRUM_SEPOLIA_RPC: process.env.ARBITRUM_SEPOLIA_RPC ?? '',
    CODEX_HMAC_KEY: process.env.CODEX_HMAC_KEY ?? '',
    CODEX_KEY_ID: process.env.CODEX_KEY_ID ?? 'v1',
    COINBASE_X402_API_KEY: process.env.COINBASE_X402_API_KEY ?? '',
    CODEX_USDC_ADDRESS: process.env.CODEX_USDC_ADDRESS
      ?? '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    CODEX_PAY_TO_ADDRESS: process.env.CODEX_PAY_TO_ADDRESS
      ?? '0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42',
    CODEX_MIN_PAYMENT_USDC_WEI: process.env.CODEX_MIN_PAYMENT_USDC_WEI ?? '1000000',
    STOA_ADDRESS: process.env.STOA_ADDRESS,
  };
  return app.fetch(req, env);
}
