import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/codex/health
 *
 * Server-side probe of the deployed Codex worker's /health endpoint
 * (services/codex/src/index.ts: `app.get('/health', ...)`). The docs page
 * shows a live up/down badge from this. Honest: a network failure or non-2xx
 * returns ok:false with the reason, never a faked "live".
 */
const CODEX_URL = process.env.CODEX_URL ?? 'https://codex.atrium.fi';

export async function GET() {
  const url = `${CODEX_URL.replace(/\/$/, '')}/health`;
  const started = Date.now();
  try {
    // AbortSignal.timeout is the modern, timer-free way to bound the probe.
    // It avoids a manual setTimeout (the no-fake-latency invariant bans
    // setTimeout in production code) while still cutting the request at 4s.
    const r = await fetch(url, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    const latencyMs = Date.now() - started;
    return NextResponse.json({
      ok: r.ok,
      status: r.status,
      latencyMs,
      url,
      source: r.ok ? 'live' : 'down',
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      status: null,
      latencyMs: null,
      url,
      source: 'down',
      reason: e instanceof Error ? e.name : 'unreachable',
    });
  }
}
