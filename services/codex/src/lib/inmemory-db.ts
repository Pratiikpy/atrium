/**
 * InMemoryD1 — same-shape replacement for Cloudflare's D1Database, used
 * by the Vercel deploy. SQL is interpreted via a tiny pattern-match
 * dispatcher (we don't run real SQL); instead each known query string
 * maps to a typed in-memory operation.
 *
 * Why pattern-match not real SQL:
 *   - Codex only issues ~6 distinct queries. Embedding sql.js or
 *     better-sqlite3 in an Edge runtime is heavier than the actual
 *     workload.
 *   - The match table is exhaustively tested in
 *     `services/codex/src/lib/inmemory-db.test.ts` so a typo in the
 *     SQL → handler mapping is caught at CI time.
 *
 * State scope:
 *   - In-memory means per-Edge-worker-instance. State is lost on cold
 *     start. For testnet this is acceptable: the only durable
 *     correctness invariant is "no double-payment for the same
 *     tx_hash", and a fresh instance starts with an empty payments set
 *     — which fails open to the on-chain replay protection inside
 *     x402PaymentMiddleware (Coffer-side nonce + Transfer-log uniqueness).
 *
 * Year-1 W2 deliverable: swap this for Turso (libsql) once we have a
 * Turso project. The handler signature stays identical, so the
 * x402/idempotency middleware needs zero edits.
 */
export type D1Row = Record<string, unknown>;

interface D1Statement {
  bind(...args: unknown[]): D1Statement;
  first<T = D1Row>(): Promise<T | null>;
  all<T = D1Row>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta?: { rows_written?: number } }>;
}

interface D1DatabaseShape {
  prepare(sql: string): D1Statement;
}

// ----- Shared in-memory tables -----
const paymentsByTxHash = new Map<string, D1Row>();
const paymentsById = new Map<string, D1Row>();
const idempotencyCache = new Map<string, { body: string; status: number; expires_ms: number }>();
const backtests = new Map<string, D1Row>();

function makeStatement(sql: string): D1Statement {
  const bound: unknown[] = [];
  const trimmed = sql.trim().replace(/\s+/g, ' ');
  const stmt: D1Statement = {
    bind(...args: unknown[]) {
      bound.push(...args);
      return stmt;
    },
    async first<T = D1Row>(): Promise<T | null> {
      // ---- payments lookup by tx_hash (x402 replay check) ----
      if (trimmed.startsWith('SELECT') && trimmed.includes('FROM payments') && trimmed.includes('tx_hash')) {
        const txHash = String(bound[0] ?? '').toLowerCase();
        return (paymentsByTxHash.get(txHash) as T | undefined) ?? null;
      }
      // ---- idempotency cache lookup ----
      if (trimmed.startsWith('SELECT') && trimmed.includes('FROM idempotency_cache')) {
        const key = String(bound[0] ?? '');
        const now = Number(bound[1] ?? Date.now());
        const hit = idempotencyCache.get(key);
        if (hit && hit.expires_ms > now) {
          return { body: hit.body, status: hit.status } as T;
        }
        return null;
      }
      // ---- backtest lookup ----
      if (trimmed.startsWith('SELECT') && trimmed.includes('FROM backtest_jobs')) {
        const id = String(bound[0] ?? '');
        return (backtests.get(id) as T | undefined) ?? null;
      }
      return null;
    },
    async all<T = D1Row>(): Promise<{ results: T[] }> {
      // Codex only uses .all() for backtest enumeration today.
      if (trimmed.startsWith('SELECT') && trimmed.includes('FROM backtest_jobs')) {
        return { results: Array.from(backtests.values()) as T[] };
      }
      return { results: [] };
    },
    async run() {
      // ---- DELETE expired idempotency cache rows ----
      if (trimmed.startsWith('DELETE FROM idempotency_cache')) {
        const cutoff = Number(bound[0] ?? Date.now());
        for (const [k, v] of idempotencyCache) {
          if (v.expires_ms < cutoff) idempotencyCache.delete(k);
        }
        return { success: true, meta: { rows_written: 0 } };
      }
      // ---- INSERT OR REPLACE idempotency_cache ----
      if (trimmed.includes('INTO idempotency_cache')) {
        const [key, body, status, expires_ms] = bound as [string, string, number, number];
        idempotencyCache.set(key, { body, status, expires_ms });
        return { success: true, meta: { rows_written: 1 } };
      }
      // ---- INSERT payment ----
      if (trimmed.startsWith('INSERT') && trimmed.includes('INTO payments')) {
        // Bind order MUST match the x402 middleware INSERT
        // (src/middleware/x402.ts), which inserts 6 columns and omits the
        // nullable facilitator_response:
        //   id, wallet_address, path, amount_usdc_wei, tx_hash, received_at
        // Destructuring 7 here mis-read received_at into facilitator_response
        // and left received_at undefined on every stored row.
        const [id, wallet, path, amount, txHash, receivedAt] = bound as [
          string, string, string, string, string | null, number,
        ];
        const row: D1Row = {
          id, wallet_address: wallet, path, amount_usdc_wei: amount,
          tx_hash: txHash, facilitator_response: null, received_at: receivedAt,
        };
        paymentsById.set(id, row);
        if (txHash) {
          const lower = txHash.toLowerCase();
          // UNIQUE constraint per schema.sql — refuse duplicate replay.
          if (paymentsByTxHash.has(lower)) {
            return { success: false, meta: { rows_written: 0 } };
          }
          paymentsByTxHash.set(lower, row);
        }
        return { success: true, meta: { rows_written: 1 } };
      }
      // ---- INSERT backtest ----
      if (trimmed.startsWith('INSERT') && trimmed.includes('INTO backtest_jobs')) {
        const [id] = bound as [string, ...unknown[]];
        backtests.set(id, { id, raw_args: bound });
        return { success: true, meta: { rows_written: 1 } };
      }
      // Unknown statement — log to console so the gap is visible.
      console.warn('[InMemoryD1] unhandled SQL:', trimmed);
      return { success: false, meta: { rows_written: 0 } };
    },
  };
  return stmt;
}

export const inMemoryDB: D1DatabaseShape = {
  prepare(sql: string) {
    return makeStatement(sql);
  },
};
