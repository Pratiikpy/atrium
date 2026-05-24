-- Codex D1 schema. Per-user data isolated via row-level constraints.

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    path TEXT NOT NULL,
    amount_usdc_wei TEXT NOT NULL,
    -- Audit I-3 fix: tx_hash UNIQUE so the on-chain replay dedup survives
    -- Worker isolate restarts (in-memory Set was lost on every recycle).
    tx_hash TEXT UNIQUE,
    facilitator_response TEXT,
    received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_wallet ON payments (wallet_address);
CREATE INDEX IF NOT EXISTS idx_payments_tx_hash ON payments (tx_hash);

-- Audit HHHH-1: `rate_limit_counters` was declared but the live rate-limit
-- middleware (src/middleware/rate-limit.ts) uses an in-memory Map per
-- isolate (documented as acceptable for Workers free tier — see
-- human_left.md #18). Table retained for Year-2 migration to durable
-- backing store (CF Durable Object or Upstash Redis); IF NOT EXISTS keeps
-- it cheap to migrate and forward-compatible.
CREATE TABLE IF NOT EXISTS rate_limit_counters (
    bucket_id TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    window_start_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_cache (
    key TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    status INTEGER NOT NULL,
    expires_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_cache (expires_ms);

CREATE TABLE IF NOT EXISTS backtest_jobs (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL,
    params_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | complete | failed
    result_json TEXT,
    error TEXT,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER
);

-- Audit HHHH-1: `request_logs` is reserved for future per-request audit
-- trail (per-wallet 30d request history, debugging support, x402
-- payment-attribution reconciliation). No middleware currently writes to
-- it; CF Workers structured logs cover real-time ops. Year-2 wiring will
-- add a `requestLogMiddleware` that batches inserts.
CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    wallet_address TEXT,
    ip_address TEXT,
    status INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_received ON request_logs (received_at);
