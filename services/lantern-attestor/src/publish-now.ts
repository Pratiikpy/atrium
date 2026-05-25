#!/usr/bin/env tsx
/**
 * Phase theta.3 fix (2026-05-25). GHA entry point for `pnpm
 * --filter @atrium/lantern-attestor publish-now`. The same publishOnce()
 * primitive backs the Vercel cron endpoint at api/cron.ts; this script
 * is the runnable equivalent without the Vercel request-handler wrapper.
 *
 * Invoked by .github/workflows/lantern-cron.yml every 10 minutes.
 * Exits non-zero on any failure so the workflow's `if: failure()` step
 * fires the Discord ops webhook.
 */
import { publishOnce } from './publish-once.js';

(async () => {
  try {
    const result = await publishOnce();
    console.log(JSON.stringify({ ok: true, ts: Date.now(), result }));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    console.error(JSON.stringify({ ok: false, error: message }));
    process.exit(1);
  }
})();
