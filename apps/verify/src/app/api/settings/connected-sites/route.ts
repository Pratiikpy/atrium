import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { noCacheHeaders } from '@/lib/no-cache-headers';

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
const MAX_SESSIONS = 100; // per wallet
const MAX_WALLETS = 5000; // global bucket cap (memory-DoS guard)
const HOST_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

// Audit fix (backend-api #4, HIGH): the store was a single flat process-global
// Map with NO per-wallet partition, so any authenticated user saw + could
// revoke every other user's connected dapps (cross-tenant IDOR), and
// DELETE ?all=1 wiped the whole map for everyone. Now partitioned by caller
// wallet: each handler resolves its own bucket via session.walletAddress.
const byWallet = new Map<string, Map<string, { host: string; lastUsedAt: number }>>();

function bucketFor(wallet: string): Map<string, { host: string; lastUsedAt: number }> {
  const key = wallet.toLowerCase();
  let b = byWallet.get(key);
  if (!b) {
    // Global wallet-count cap so a flood of distinct sessions can't exhaust memory.
    if (byWallet.size >= MAX_WALLETS) {
      const oldest = byWallet.keys().next().value;
      if (oldest) byWallet.delete(oldest);
    }
    b = new Map();
    byWallet.set(key, b);
  }
  return b;
}

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

export async function GET(req: NextRequest) {
  // Phase 2c: require session
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const bucket = bucketFor(session.walletAddress);
  if (bucket.size === 0) return NextResponse.json({ sites: [], source: 'pending' as const });
  const sites = [...bucket.values()].map((s) => ({
    id: s.host,
    host: s.host,
    lastUsedAgo: ago(s.lastUsedAt),
  }));
  return NextResponse.json({ sites, source: 'postern' as const }, { headers: noCacheHeaders });
}

export async function DELETE(req: NextRequest) {
  // Phase 2c: require session
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const bucket = bucketFor(session.walletAddress);
  const all = req.nextUrl.searchParams.get('all') === '1';
  if (all) {
    // Scoped: clears ONLY the caller's bucket, never the whole store.
    bucket.clear();
    return NextResponse.json({ ok: true, revoked: 'all' });
  }
  try {
    const body = (await req.json()) as { host?: string };
    // Audit LL-6 fix: validate the host before deletion so a CRLF-injection
    // attempt can't reach the Map key space.
    if (!isValidHost(body.host)) {
      return NextResponse.json({ ok: false, error: 'invalid_host' }, { status: 400 });
    }
    bucket.delete(body.host);
    return NextResponse.json({ ok: true, revoked: body.host });
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
}

/** POST registers a new session. Used by Postern when a dapp connects. */
export async function POST(req: NextRequest) {
  // Phase 2c: require session
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = (await req.json()) as { host?: string };
    if (!isValidHost(body.host)) {
      return NextResponse.json({ ok: false, error: 'invalid_host' }, { status: 400 });
    }
    const bucket = bucketFor(session.walletAddress);
    // Audit LL-6 fix: per-wallet cap so a flood can't exhaust memory.
    // Drop the oldest entry when the cap is hit. Real production routes
    // under PosternKeyRegistry don't use this in-memory map.
    if (bucket.size >= MAX_SESSIONS && !bucket.has(body.host)) {
      const oldestKey = bucket.keys().next().value;
      if (oldestKey) bucket.delete(oldestKey);
    }
    bucket.set(body.host, { host: body.host, lastUsedAt: Date.now() });
    return NextResponse.json({ ok: true, host: body.host });
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
}
