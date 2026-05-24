import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Tablet service URL is proxied here so the client never needs to know it.
const TABLET_URL = process.env.TABLET_URL ?? null;

// Audit JJ-5 fix: closed enum gates. Prior code interpolated `jurisdiction`
// and `year` directly into the upstream URL — a caller could pass values
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

export async function GET(req: NextRequest) {
  const jurisdictionRaw = req.nextUrl.searchParams.get('jurisdiction') ?? 'uk';
  const yearRaw = req.nextUrl.searchParams.get('year') ?? '2026';
  const jurisdiction = ALLOWED_JURISDICTIONS.has(jurisdictionRaw) ? jurisdictionRaw : 'uk';
  // Strict-numeric year + range check. Anything else falls back to default.
  const yearNum = /^\d{4}$/.test(yearRaw) ? parseInt(yearRaw, 10) : 2026;
  const year = String(yearNum >= MIN_YEAR && yearNum <= MAX_YEAR ? yearNum : 2026);

  if (!TABLET_URL) {
    return NextResponse.json({
      totalProceedsUsd: null,
      costBasisUsd: null,
      realisedGainUsd: null,
      // Audit U-23: pre-fix `'flat'` direction next to null value implied a
      // measured-zero PnL. Match the value's null state so consumers can
      // rely on `direction != null` ↔ value != null.
      realisedGainDirection: null,
      taxOwedEstUsd: null,
      taxRate: taxRateFor(jurisdiction),
      source: 'pending',
    });
  }
  try {
    // Both `jurisdiction` and `year` are now closed-enum/range-validated values,
    // so direct interpolation is safe. URLSearchParams as a defense-in-depth
    // re-encoding step.
    const params = new URLSearchParams({ jurisdiction, year });
    const r = await fetch(`${TABLET_URL}/summary?${params.toString()}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) throw new Error();
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({
      totalProceedsUsd: null,
      costBasisUsd: null,
      realisedGainUsd: null,
      // Audit U-23: pre-fix `'flat'` direction next to null value implied a
      // measured-zero PnL. Match the value's null state so consumers can
      // rely on `direction != null` ↔ value != null.
      realisedGainDirection: null,
      taxOwedEstUsd: null,
      taxRate: taxRateFor(jurisdiction),
      source: 'pending',
    });
  }
}
