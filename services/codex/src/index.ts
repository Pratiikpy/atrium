/**
 * Codex, Atrium's x402-payable API gateway.
 *
 * Pipeline (per TDD §8.2):
 *   x402 paymentMiddleware → Idempotency-Key check → rate limit → handler →
 *     HMAC-sign response → cache + log → return.
 *
 * Deployed on Cloudflare Workers free tier. Self-hosted fallback for the
 * x402 facilitator: if Coinbase facilitator is down, Codex verifies payments
 * on-chain directly via wagmi/viem.
 */
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

import { x402PaymentMiddleware } from './middleware/x402';
import { signResponse } from './middleware/sign-response';
import { rateLimit } from './middleware/rate-limit';
import { idempotency } from './middleware/idempotency';

import { marginRouter } from './routes/margin';
import { positionsRouter } from './routes/positions';
import { riskRouter } from './routes/risk';
import { venuesRouter } from './routes/venues';
import { agentsRouter } from './routes/agents';
import { backtestRouter } from './routes/backtest';
import { attestationRouter } from './routes/attestation';
import { optionsRouter } from './routes/options';

type Env = {
  DB: D1Database;
  ENV: string;
  SCRIBE_URL: string;
  ARBITRUM_SEPOLIA_RPC: string;
  CODEX_HMAC_KEY: string;
  CODEX_KEY_ID: string;
  COINBASE_X402_API_KEY: string;
  STOA_ADDRESS?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', secureHeaders());

// Health
app.get('/', (c) =>
  c.json({
    service: 'atrium-codex',
    version: '0.1.0',
    env: c.env.ENV,
    note: 'x402-payable. See /v1/* endpoints and useatrium.me/docs/codex.',
  })
);

// Public endpoints, no payment, no rate limit beyond standard CF protection
app.get('/health', (c) => c.json({ ok: true }));

// Paid endpoints, wrapped with the full pipeline
app.use('/v1/*', x402PaymentMiddleware);
app.use('/v1/*', idempotency);
app.use('/v1/*', rateLimit);
app.use('/v1/*', signResponse);

app.route('/v1/margin', marginRouter);
app.route('/v1/positions', positionsRouter);
app.route('/v1/risk', riskRouter);
app.route('/v1/venues', venuesRouter);
app.route('/v1/agents', agentsRouter);
app.route('/v1/backtest', backtestRouter);
app.route('/v1/attestation', attestationRouter);
app.route('/v1/options', optionsRouter);

app.notFound((c) =>
  c.json({ error: 'not_found', detail: 'See /v1/* endpoint catalog.' }, 404)
);

app.onError((err, c) => {
  // Audit FIRE78-CODEX1 fix (sub-agent HIGH): `err.message` can include
  // stack traces, D1 query strings with bound params, RPC URLs, or Scribe
  // URLs, all of which are env secrets. Log full error server-side only;
  // return a static client-facing string in production. Dev still surfaces
  // detail for local debugging.
  console.error('Codex error', err);
  const isDev = c.env?.ENV !== 'production';
  return c.json(
    {
      error: 'internal',
      detail: isDev ? err.message : 'see server logs',
    },
    500
  );
});

export default app;
