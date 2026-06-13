import { NextRequest, NextResponse } from 'next/server';
import { noCacheHeaders } from '@/lib/no-cache-headers';
import { getSession } from '@/lib/auth-session';

const TABLET_URL = process.env.TABLET_URL ?? null;
export const dynamic = 'force-dynamic';

// Audit NN-1 fix: third occurrence of the query-param injection pattern
// (JJ-5 in tax/summary + LL-1 in tax/export). All three tax routes share
// the same closed-enum + numeric-range gates now.
const ALLOWED_JURISDICTIONS = new Set(['uk', 'us', 'de', 'other']);
const MIN_YEAR = 2020;
const MAX_YEAR = 2099;

export async function GET(req: NextRequest) {
  const jurisdictionRaw = req.nextUrl.searchParams.get('jurisdiction') ?? 'uk';
  const yearRaw = req.nextUrl.searchParams.get('year') ?? '2026';
  const jurisdiction = ALLOWED_JURISDICTIONS.has(jurisdictionRaw) ? jurisdictionRaw : 'uk';
  const yearNum = /^\d{4}$/.test(yearRaw) ? parseInt(yearRaw, 10) : 2026;
  const year = String(yearNum >= MIN_YEAR && yearNum <= MAX_YEAR ? yearNum : 2026);

  // Authorization (IDOR fix): the wallet whose tax events we fetch is derived
  // from the authenticated session, never from a query string. Pre-fix this
  // route forwarded ?address= straight to Tablet, so any caller could read
  // any wallet's realised-gain history by changing the param.
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!TABLET_URL) return NextResponse.json({ events: [], source: 'pending' });
  try {
    const params = new URLSearchParams({ jurisdiction, year, address: session.walletAddress });
    const r = await fetch(`${TABLET_URL}/events?${params.toString()}`, {
      // 8s for the same reason as /summary: survive a Tablet cold start +
      // compute instead of mislabelling real events as "pending".
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${process.env.ATRIUM_INTERNAL_KEY ?? ''}` },
    });
    if (!r.ok) throw new Error();
    return NextResponse.json(await r.json(), { headers: noCacheHeaders });
  } catch {
    return NextResponse.json({ events: [], source: 'pending' });
  }
}
