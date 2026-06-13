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

const CURRENCY_SYMBOL: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };

function fmtMoney(n: unknown, currency: string): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
  const sym = CURRENCY_SYMBOL[currency] ?? '';
  return `${sym}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Tablet emits the asset as either a bare instrument hash (UK) or a
// "venue:N 0x..." description (US/DE). Render a compact, readable label.
function shortAsset(a: unknown): string {
  if (typeof a !== 'string' || !a) return '-';
  const venue = a.match(/venue[:\s]*(\d+)/i);
  const hash = a.match(/0x[0-9a-fA-F]{6,}/);
  const parts: string[] = [];
  if (venue) parts.push(`Venue ${venue[1]}`);
  if (hash) parts.push(`${hash[0].slice(0, 6)}…${hash[0].slice(-4)}`);
  return parts.length ? parts.join(' · ') : a;
}

function fmtDate(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface TabletEvent {
  date?: string;
  asset?: string;
  event?: string;
  proceeds?: number;
  cost_basis?: number;
  gain?: number;
  currency?: string;
}

/** Map Tablet's realised-disposal rows to the camelCase shape the events
 *  table renders (date / asset / event / proceeds / cost basis / gain). */
function mapEvents(raw: unknown) {
  const events = (raw as { events?: unknown })?.events;
  const list: TabletEvent[] = Array.isArray(events) ? (events as TabletEvent[]) : [];
  return list.map((e, i) => {
    const currency = typeof e.currency === 'string' ? e.currency : 'GBP';
    const gain = typeof e.gain === 'number' ? e.gain : 0;
    return {
      id: `${e.date ?? 'd'}-${i}`,
      date: fmtDate(e.date),
      asset: shortAsset(e.asset),
      eventLabel: typeof e.event === 'string' ? e.event : 'Disposal',
      proceedsUsd: fmtMoney(e.proceeds, currency),
      costBasisUsd: fmtMoney(e.cost_basis, currency),
      gainUsd: fmtMoney(e.gain, currency),
      gainDirection: gain > 0 ? 'up' : gain < 0 ? 'down' : 'flat',
    };
  });
}

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
    const events = mapEvents(await r.json());
    return NextResponse.json({ events, source: 'scribe' }, { headers: noCacheHeaders });
  } catch {
    return NextResponse.json({ events: [], source: 'pending' });
  }
}
