import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Connected dapp sessions. Audit P-11 fix: was GET-only with empty array;
 * now supports DELETE (per-host and all) so the Disconnect / Revoke all
 * buttons in the UI actually do something.
 *
 * Note: a production implementation routes the DELETE through
 * PosternKeyRegistry.revokeSession() and waits for the Lantern
 * attestation event. The interim memory map below is intentional — it
 * lets the UI surface (disconnect button → optimistic update) be
 * end-to-end testable before the contract ships.
 *
 * Audit LL-6 fix: the in-memory `sessions` map is process-shared across all
 * callers. Pre-fix: anyone could POST a fake host (spoof a "connected dapp"
 * in the UI for every user), DELETE ?all=1 could wipe everyone's sessions,
 * and the Map had no upper bound (memory DoS). The mitigations:
 *   1. Cap the Map at MAX_SESSIONS so a flood can't exhaust memory
 *   2. Validate host strings against a hostname regex (rejects URLs, CRLF, scripts)
 *   3. The cross-tenant scoping problem is documented in human_left.md #22
 *      and the production route under PosternKeyRegistry replaces this surface
 */
const MAX_SESSIONS = 100;
const HOST_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const sessions = new Map<string, { host: string; lastUsedAt: number }>();

function isValidHost(s: unknown): s is string {
  return typeof s === 'string' && s.length <= 253 && HOST_REGEX.test(s);
}

function ago(unixMs: number): string {
  const diff = Math.floor((Date.now() - unixMs) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hour ago`;
  return `${Math.floor(diff / 86400)} day ago`;
}

export async function GET() {
  if (sessions.size === 0) return NextResponse.json({ sites: [], source: 'pending' as const });
  const sites = [...sessions.values()].map((s) => ({
    id: s.host,
    host: s.host,
    lastUsedAgo: ago(s.lastUsedAt),
  }));
  return NextResponse.json({ sites, source: 'postern' as const });
}

export async function DELETE(req: NextRequest) {
  const all = req.nextUrl.searchParams.get('all') === '1';
  if (all) {
    sessions.clear();
    return NextResponse.json({ ok: true, revoked: 'all' });
  }
  try {
    const body = (await req.json()) as { host?: string };
    // Audit LL-6 fix: validate the host before deletion so a CRLF-injection
    // attempt can't reach the Map key space.
    if (!isValidHost(body.host)) {
      return NextResponse.json({ ok: false, error: 'invalid_host' }, { status: 400 });
    }
    sessions.delete(body.host);
    return NextResponse.json({ ok: true, revoked: body.host });
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
}

/** POST registers a new session. Used by Postern when a dapp connects. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { host?: string };
    if (!isValidHost(body.host)) {
      return NextResponse.json({ ok: false, error: 'invalid_host' }, { status: 400 });
    }
    // Audit LL-6 fix: cap the Map size so a flood can't exhaust memory.
    // Drop the oldest entry when the cap is hit. Real production routes
    // under PosternKeyRegistry don't use this in-memory map.
    if (sessions.size >= MAX_SESSIONS && !sessions.has(body.host)) {
      const oldestKey = sessions.keys().next().value;
      if (oldestKey) sessions.delete(oldestKey);
    }
    sessions.set(body.host, { host: body.host, lastUsedAt: Date.now() });
    return NextResponse.json({ ok: true, host: body.host });
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
}
