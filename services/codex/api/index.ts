/**
 * Vercel Edge Function entry for Codex.
 *
 * The same Hono app from src/index.ts runs under Vercel's Edge runtime —
 * Hono ships a `handle()` adapter that wires the standard Request/Response
 * pair the Edge runtime delivers.
 *
 * D1 bindings (Cloudflare-only) get replaced by `inMemoryDB` from
 * src/lib/inmemory-db.ts. Same interface, per-instance state.
 *
 * Env vars are read from process.env (Vercel Edge exposes them).
 */
import app from '../src/index';
import { inMemoryDB } from '../src/lib/inmemory-db';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  // Hono's app.fetch signature: (request, env, executionContext).
  // We inject the DB shim + the rest of env vars Codex reads.
  const env = {
    DB: inMemoryDB,
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
