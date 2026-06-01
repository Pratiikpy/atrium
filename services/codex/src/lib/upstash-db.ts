/**
 * Upstash REST-backed D1Database shim.
 *
 * Phase theta.2 fix (2026-05-25). Pre-fix the Vercel deploy of Codex used
 * `inMemoryDB` — per-instance state that is lost on every cold start. This
 * silently disabled x402 replay-dedup, HMAC dedup, and idempotency caching
 * on the Vercel surface: a paying customer who hit a cold Vercel instance
 * could replay any x402 payment proof and re-trigger the paid endpoint,
 * and Idempotency-Key requests that landed on different instances were
 * not deduplicated.
 *
 * Per the "proper not fastest" rule, the Vercel deploy stays
 * online (it is a redundant region for the Cloudflare Worker primary).
 * Both deploys now share identical replay/idempotency semantics:
 *
 *   - Cloudflare Worker: Cloudflare D1 (services/codex/src/db/schema.sql)
 *   - Vercel Edge:        Upstash Redis REST (this file)
 *
 * Why bare fetch + Upstash REST instead of @upstash/redis SDK:
 *   - Smaller bundle (Edge functions get faster cold starts)
 *   - No new dependency in services/codex/package.json
 *   - The same fetch pattern is used in apps/verify/src/app/api/settings/
 *     notifications/route.ts:69 for Vercel KV — single discipline across
 *     all KV-shaped backends
 *
 * Failure mode: when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are
 * unset, this module exports a `null` sentinel and the entry point falls
 * back to `inMemoryDB`. That decision is loud (logged at boot) so a
 * misconfigured deploy is visible in the Vercel logs rather than silently
 * degrading.
 */
import type { D1Row } from './inmemory-db';

interface D1Statement {
  bind(...args: unknown[]): D1Statement;
  first<T = D1Row>(): Promise<T | null>;
  all<T = D1Row>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta?: { rows_written?: number } }>;
}

interface D1DatabaseShape {
  prepare(sql: string): D1Statement;
}

export interface UpstashConfig {
  url: string;
  token: string;
}

interface UpstashResult<T = unknown> {
  result?: T;
  error?: string;
}

/**
 * Single helper for Upstash REST calls. Sends commands as JSON arrays per
 * the documented protocol (https://docs.upstash.com/redis/features/restapi).
 */
async function upstash<T = unknown>(
  cfg: UpstashConfig,
  command: (string | number)[],
): Promise<T | null> {
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!r.ok) {
    throw new Error(`upstash_${r.status}_${command[0]}`);
  }
  const json = (await r.json()) as UpstashResult<T>;
  if (json.error) {
    throw new Error(`upstash_${command[0]}_${json.error}`);
  }
  return (json.result as T | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Key schema
// ---------------------------------------------------------------------------
// payments:tx:<lower_tx_hash>  -> JSON row, SETNX-protected (unique)
// payments:id:<id>             -> JSON row
// idem:<key>                   -> JSON {body, status}, EX (TTL seconds)
// bt:<id>                      -> JSON row (backtest)
// bt-index                     -> Redis SET of backtest ids (for enumeration)

function paymentsTxKey(txHash: string): string {
  return `payments:tx:${txHash.toLowerCase()}`;
}

function paymentsIdKey(id: string): string {
  return `payments:id:${id}`;
}

function idemKey(key: string): string {
  return `idem:${key}`;
}

function backtestKey(id: string): string {
  return `bt:${id}`;
}

const BACKTEST_INDEX_KEY = 'bt-index';

// ---------------------------------------------------------------------------
// Statement dispatcher
// ---------------------------------------------------------------------------

function makeStatement(cfg: UpstashConfig, sql: string): D1Statement {
  const bound: unknown[] = [];
  const trimmed = sql.trim().replace(/\s+/g, ' ');

  const stmt: D1Statement = {
    bind(...args: unknown[]) {
      bound.push(...args);
      return stmt;
    },

    async first<T = D1Row>(): Promise<T | null> {
      // payments lookup by tx_hash (x402 replay check)
      if (
        trimmed.startsWith('SELECT') &&
        trimmed.includes('FROM payments') &&
        trimmed.includes('tx_hash')
      ) {
        const txHash = String(bound[0] ?? '').toLowerCase();
        const raw = await upstash<string>(cfg, ['GET', paymentsTxKey(txHash)]);
        return raw ? ((JSON.parse(raw) as unknown) as T) : null;
      }

      // idempotency cache lookup with TTL semantics.
      // The legacy D1 query passes (key, now_ms) and returns the row only
      // when expires_ms > now. Upstash handles TTL via the SET EX option,
      // so a GET that returns null already means the entry has expired.
      if (
        trimmed.startsWith('SELECT') &&
        trimmed.includes('FROM idempotency_cache')
      ) {
        const key = String(bound[0] ?? '');
        const raw = await upstash<string>(cfg, ['GET', idemKey(key)]);
        return raw ? ((JSON.parse(raw) as unknown) as T) : null;
      }

      // backtest lookup
      if (trimmed.startsWith('SELECT') && trimmed.includes('FROM backtest_jobs')) {
        const id = String(bound[0] ?? '');
        const raw = await upstash<string>(cfg, ['GET', backtestKey(id)]);
        return raw ? ((JSON.parse(raw) as unknown) as T) : null;
      }
      return null;
    },

    async all<T = D1Row>(): Promise<{ results: T[] }> {
      if (
        trimmed.startsWith('SELECT') &&
        trimmed.includes('FROM backtest_jobs')
      ) {
        // SMEMBERS bt-index → list of backtest ids; MGET to materialise.
        const ids = (await upstash<string[]>(cfg, ['SMEMBERS', BACKTEST_INDEX_KEY])) ?? [];
        if (ids.length === 0) return { results: [] };
        const rawList =
          (await upstash<(string | null)[]>(cfg, ['MGET', ...ids.map(backtestKey)])) ?? [];
        const results: T[] = [];
        for (const raw of rawList) {
          if (!raw) continue;
          results.push(JSON.parse(raw) as T);
        }
        return { results };
      }
      return { results: [] };
    },

    async run() {
      // DELETE expired idempotency rows is a no-op under Upstash —
      // TTL is enforced by Redis itself. Return success so the caller
      // does not branch on a misleading failure.
      if (trimmed.startsWith('DELETE FROM idempotency_cache')) {
        return { success: true, meta: { rows_written: 0 } };
      }

      // INSERT OR REPLACE idempotency_cache (key, body, status, expires_ms)
      if (trimmed.includes('INTO idempotency_cache')) {
        const [key, body, status, expires_ms] = bound as [
          string,
          string,
          number,
          number,
        ];
        const now = Date.now();
        const ttlSec = Math.max(1, Math.ceil((expires_ms - now) / 1000));
        const payload = JSON.stringify({ body, status });
        await upstash(cfg, ['SET', idemKey(key), payload, 'EX', ttlSec]);
        return { success: true, meta: { rows_written: 1 } };
      }

      // INSERT payment — bind order MUST match the x402 middleware INSERT
      // (src/middleware/x402.ts): 6 columns, omitting the nullable
      // facilitator_response: (id, wallet_address, path, amount_usdc_wei,
      // tx_hash, received_at). Destructuring 7 mis-read received_at into
      // facilitator_response and left received_at undefined.
      // UNIQUE constraint on tx_hash enforced via SETNX. Duplicate returns
      // false so the caller can surface the replay attempt.
      if (trimmed.startsWith('INSERT') && trimmed.includes('INTO payments')) {
        const [
          id,
          wallet,
          path,
          amount,
          txHash,
          receivedAt,
        ] = bound as [
          string,
          string,
          string,
          string,
          string | null,
          number,
        ];
        const row: D1Row = {
          id,
          wallet_address: wallet,
          path,
          amount_usdc_wei: amount,
          tx_hash: txHash,
          facilitator_response: null,
          received_at: receivedAt,
        };
        const rowJson = JSON.stringify(row);
        if (txHash) {
          // SETNX returns 1 on success, 0 if the key already existed —
          // this is the canonical replay-dedup primitive.
          const acquired = await upstash<number>(cfg, [
            'SETNX',
            paymentsTxKey(txHash),
            rowJson,
          ]);
          if (acquired !== 1) {
            return { success: false, meta: { rows_written: 0 } };
          }
        }
        await upstash(cfg, ['SET', paymentsIdKey(id), rowJson]);
        return { success: true, meta: { rows_written: 1 } };
      }

      // INSERT backtest
      if (trimmed.startsWith('INSERT') && trimmed.includes('INTO backtest_jobs')) {
        const [id] = bound as [string, ...unknown[]];
        const row: D1Row = { id, raw_args: bound };
        await upstash(cfg, ['SET', backtestKey(id), JSON.stringify(row)]);
        await upstash(cfg, ['SADD', BACKTEST_INDEX_KEY, id]);
        return { success: true, meta: { rows_written: 1 } };
      }

      console.warn('[UpstashD1] unhandled SQL:', trimmed);
      return { success: false, meta: { rows_written: 0 } };
    },
  };
  return stmt;
}

/**
 * Returns an Upstash-backed D1DatabaseShape when UPSTASH_REDIS_REST_URL
 * and UPSTASH_REDIS_REST_TOKEN are both set in process.env. Returns null
 * otherwise so the caller can fall back to inMemoryDB with a loud warning.
 */
/// Structural env type — does not depend on @types/node, so the codex
/// package can stay on the Workers/Edge type surface while still typing
/// `process.env` correctly under the Vercel deploy.
export type EnvLike = Record<string, string | undefined>;

export function maybeUpstashDB(env: EnvLike): D1DatabaseShape | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const cfg: UpstashConfig = { url, token };
  return {
    prepare(sql: string) {
      return makeStatement(cfg, sql);
    },
  };
}
