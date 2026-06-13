import { NextRequest, NextResponse } from 'next/server';
import { noCacheHeaders } from '@/lib/no-cache-headers';
import { getSession } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

// Tablet service URL is proxied here so the client never needs to know it.
const TABLET_URL = process.env.TABLET_URL ?? null;

// Audit JJ-5 fix: closed enum gates. Prior code interpolated `jurisdiction`
// and `year` directly into the upstream URL, a caller could pass values
// containing `&` (URL-encoded) to inject extra query params at the Tablet
// service, or stash attacker-controlled content into upstream HTTP logs.
const ALLOWED_JURISDICTIONS = new Set(['uk', 'us', 'de', 'other']);
const MIN_YEAR = 2020;
const MAX_YEAR = 2099;

function taxRateFor(j: string): string {
  if (j === 'uk') return '10%';
  if (j === 'us') return '15%';
  return '25%';
}

const CURRENCY_SYMBOL: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };

/** Format a Tablet numeric figure into the native-currency string the tax
 *  stat-row renders (typed string | null). Null stays null (honest "-"). */
function fmtMoney(n: unknown, currency: string): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const sym = CURRENCY_SYMBOL[currency] ?? '';
  return `${sym}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Map Tablet's snake_case numeric summary to the camelCase string shape the
 *  tax stat-row consumes. Tablet ships native-currency numbers + a currency
 *  code + the real rate it used; we format and pass the rate through. */
function mapTabletSummary(t: Record<string, unknown>, jurisdiction: string) {
  const currency = typeof t.currency === 'string' ? t.currency : 'GBP';
  const realised = typeof t.realized_gain === 'number' ? t.realized_gain : null;
  return {
    totalProceedsUsd: fmtMoney(t.proceeds, currency),
    costBasisUsd: fmtMoney(t.cost_basis, currency),
    realisedGainUsd: fmtMoney(realised, currency),
    realisedGainDirection: realised == null ? null : realised > 0 ? 'up' : realised < 0 ? 'down' : 'flat',
    taxOwedEstUsd: fmtMoney(t.tax_owed, currency),
    taxRate: typeof t.tax_rate_pct === 'number' ? `${t.tax_rate_pct}%` : taxRateFor(jurisdiction),
    source: 'tablet' as const,
  };
}

function pendingPayload(jurisdiction: string) {
  return {
    totalProceedsUsd: null,
    costBasisUsd: null,
    realisedGainUsd: null,
    // Audit U-23: pre-fix `'flat'` direction next to null value implied a
    // measured-zero PnL. Match the value's null state so consumers can
    // rely on `direction != null` ↔ value != null.
    realisedGainDirection: null,
    taxOwedEstUsd: null,
    taxRate: taxRateFor(jurisdiction),
    source: 'pending' as const,
  };
}

export async function GET(req: NextRequest) {
  const jurisdictionRaw = req.nextUrl.searchParams.get('jurisdiction') ?? 'uk';
  const yearRaw = req.nextUrl.searchParams.get('year') ?? '2026';
  const jurisdiction = ALLOWED_JURISDICTIONS.has(jurisdictionRaw) ? jurisdictionRaw : 'uk';
  // Strict-numeric year + range check. Anything else falls back to default.
  const yearNum = /^\d{4}$/.test(yearRaw) ? parseInt(yearRaw, 10) : 2026;
  const year = String(yearNum >= MIN_YEAR && yearNum <= MAX_YEAR ? yearNum : 2026);

  // Authorization (IDOR fix): the wallet whose tax summary we fetch is derived
  // from the authenticated session, never from a query string. A caller must
  // not be able to read another wallet's realised-gains data by passing an
  // ?address= param.
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!TABLET_URL) {
    return NextResponse.json(pendingPayload(jurisdiction));
  }
  try {
    // jurisdiction + year are closed-enum/range-validated; address comes from
    // the session. URLSearchParams re-encodes as defence-in-depth.
    const params = new URLSearchParams({ jurisdiction, year, address: session.walletAddress });
    const r = await fetch(`${TABLET_URL}/summary?${params.toString()}`, {
      signal: AbortSignal.timeout(3000),
      headers: { Authorization: `Bearer ${process.env.ATRIUM_INTERNAL_KEY ?? ''}` },
    });
    if (!r.ok) throw new Error();
    const tablet = (await r.json()) as Record<string, unknown>;
    return NextResponse.json(mapTabletSummary(tablet, jurisdiction), { headers: noCacheHeaders });
  } catch {
    return NextResponse.json(pendingPayload(jurisdiction));
  }
}
