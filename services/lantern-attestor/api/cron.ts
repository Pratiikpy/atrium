/**
 * Vercel cron endpoint for hourly Lantern publish.
 *
 * Triggered by the schedule in vercel.json. Re-uses publishOnce() from the
 * core attestor so the logic is identical to local dev (`pnpm dev`) and
 * any future non-Vercel host (Fly machine, $5 VPS) — only the wrapper
 * differs.
 *
 * Auth: Vercel cron requests carry the `Authorization: Bearer <CRON_SECRET>`
 * header set in project env. We refuse anything else so the endpoint can't
 * be hit publicly to force an early publish.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { publishOnce } from './_publish-once.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cron-only — anyone else gets 401. Vercel injects this header.
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    res.status(500).json({ error: 'CRON_SECRET not configured' });
    return;
  }
  const got = req.headers['authorization'];
  if (got !== `Bearer ${expected}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    await publishOnce();
    res.status(200).json({ ok: true, ts: Date.now() });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    res.status(500).json({ ok: false, error: message });
  }
}
