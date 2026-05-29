import { Hono } from 'hono';

export const backtestRouter = new Hono<{ Bindings: { DB: D1Database } }>();

// Bounded input domains. strategy_id is a slug — alnum + dash + underscore,
// 1-64 chars. Larger or special-char ids land in logs, D1 table, response
// poll URLs; bounding them caps blast radius.
const STRATEGY_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
// Backtest params are kwargs (strategy parameters, date range). 32 KB is
// 10x the largest known live strategy JSON; anything bigger is a misuse.
const JSON_BODY_MAX_BYTES = 32 * 1024;
// job_id is always a v4 UUID emitted by this route — pin the shape so a
// caller fishing for arbitrary rows hits a 400 instead of a DB query.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /v1/backtest/{strategy_id}
 *
 * Records a backtest request. Audit fix (#22, honest path): there is NO
 * completion worker wired on any current deploy - no Cloudflare scheduled()
 * consumer, no archive-weekly poller reads backtest_jobs - so a job would sit
 * 'pending' forever. The route previously returned a 202 + poll_url implying
 * the job would complete (and the docstring claimed "1 USDC per run / Archive
 * workers pick up nightly"), which is a no-fake-pending violation for a paid
 * endpoint. Until a real consumer ships, this records the request honestly and
 * returns status 'queued_unprocessed' with a caveat naming the missing
 * dependency, and does NOT hand out a poll_url that never resolves to a result.
 * The GET /jobs/:id reader stays so a future worker + existing rows still work.
 */
backtestRouter.post('/:strategy_id', async (c) => {
  const strategyId = c.req.param('strategy_id');
  if (!STRATEGY_ID_REGEX.test(strategyId)) {
    return c.json(
      { error: 'invalid_strategy_id', detail: 'must match [A-Za-z0-9_-]{1,64}' },
      400,
    );
  }
  const raw = await c.req.text().catch(() => '');
  if (raw.length > JSON_BODY_MAX_BYTES) {
    return c.json(
      { error: 'body_too_large', detail: `body exceeds ${JSON_BODY_MAX_BYTES} bytes` },
      413,
    );
  }
  let body: Record<string, unknown>;
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return c.json({ error: 'bad_json' }, 400);
  }

  const job_id = crypto.randomUUID();
  // Audit fix (#22): record honestly as 'queued_unprocessed' (no completion
  // worker exists) and surface a DB failure as a 500 instead of blindly
  // returning success. D1 .run() rejects on a write error, so a try/catch is
  // the real guard.
  try {
    await c.env.DB.prepare(
      'INSERT INTO backtest_jobs (id, strategy_id, params_json, status, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(job_id, strategyId, JSON.stringify(body), 'queued_unprocessed', Date.now())
      .run();
  } catch {
    return c.json({ error: 'enqueue_failed', detail: 'could not record the backtest request' }, 500);
  }

  // Audit fix (#22): no poll_url that never resolves to a result; an honest
  // caveat instead. 200 (recorded) not 202 (accepted-for-processing), because
  // nothing processes it yet.
  return c.json(
    {
      job_id,
      status: 'queued_unprocessed',
      note: 'Request recorded, but no backtest worker is wired on this deploy yet, so it will not complete. The compute layer (Archive span_backtest worker) lands before this endpoint is billed. Do not poll for a result yet.',
    },
    200,
  );
});

backtestRouter.get('/jobs/:job_id', async (c) => {
  const job_id = c.req.param('job_id');
  // Reject obviously-malformed ids without hitting the DB. Closes the
  // "let me probe arbitrary rows" reconnaissance pattern.
  if (!UUID_REGEX.test(job_id)) {
    return c.json({ error: 'invalid_job_id', detail: 'must be a v4 UUID' }, 400);
  }
  const row = await c.env.DB.prepare(
    'SELECT id, strategy_id, status, result_json, completed_at FROM backtest_jobs WHERE id = ?',
  )
    .bind(job_id)
    .first();
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json(row);
});
