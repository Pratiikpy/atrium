/**
 * Long-running wrapper for local development. The Vercel cron + GHA cron
 * call tick.ts directly as a one-shot; this index.ts is only used when
 * running the keeper on a $5 VPS or Fly machine.
 */

import { tickOnce } from './tick.js';

const INTERVAL_MS = parseInt(process.env.KEEPER_INTERVAL_MS ?? '300000', 10); // 5 min default

console.log(`vigil-keeper starting (interval=${INTERVAL_MS}ms)`);

async function loop(): Promise<void> {
  for (;;) {
    try {
      await tickOnce();
    } catch (err) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        event: 'tick_error',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

void loop();
