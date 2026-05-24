import { NextRequest, NextResponse } from 'next/server';

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

  if (!TABLET_URL) return NextResponse.json({ events: [], source: 'pending' });
  try {
    const params = new URLSearchParams({ jurisdiction, year });
    const r = await fetch(`${TABLET_URL}/events?${params.toString()}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) throw new Error();
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ events: [], source: 'pending' });
  }
}
