import { NextRequest, NextResponse } from 'next/server';
import { safeErrorDetail } from '@/lib/safe-error';

const TABLET_URL = process.env.TABLET_URL ?? null;
export const dynamic = 'force-dynamic';

// Audit LL-1 + LL-2 fix: both `format` and `jurisdiction`/`year` were
// interpolated directly into (a) the upstream URL — query-injection identical
// to the JJ-5 bug in tax/summary, and (b) the Content-Disposition filename,
// which is a header-injection sink. A caller passing `?format=csv%0d%0aX:%20evil`
// could inject extra HTTP headers into the response. Closed-enum gates plus
// a strict filename sanitizer close both surfaces.
const ALLOWED_FORMATS = new Set(['csv', 'json', 'pdf']);
const ALLOWED_JURISDICTIONS = new Set(['uk', 'us', 'de', 'other']);
const MIN_YEAR = 2020;
const MAX_YEAR = 2099;

export async function GET(req: NextRequest) {
  const formatRaw = req.nextUrl.searchParams.get('format') ?? 'csv';
  const jurisdictionRaw = req.nextUrl.searchParams.get('jurisdiction') ?? 'uk';
  const yearRaw = req.nextUrl.searchParams.get('year') ?? '2026';

  const format = ALLOWED_FORMATS.has(formatRaw) ? formatRaw : 'csv';
  const jurisdiction = ALLOWED_JURISDICTIONS.has(jurisdictionRaw) ? jurisdictionRaw : 'uk';
  const yearNum = /^\d{4}$/.test(yearRaw) ? parseInt(yearRaw, 10) : 2026;
  const year = String(yearNum >= MIN_YEAR && yearNum <= MAX_YEAR ? yearNum : 2026);

  if (!TABLET_URL) {
    return NextResponse.json(
      { error: 'tablet_pending', detail: 'Tablet service deploys Month 10. Set TABLET_URL in env.' },
      { status: 503 }
    );
  }
  try {
    // URLSearchParams re-encodes as defense-in-depth; the closed-enum gates
    // above are the primary defense.
    const params = new URLSearchParams({ format, jurisdiction, year });
    const r = await fetch(`${TABLET_URL}/export?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`tablet_${r.status}`);
    const body = await r.arrayBuffer();
    // Be paranoid about the upstream's content-type too — strip CRLF.
    const contentTypeRaw = r.headers.get('content-type') ?? 'application/octet-stream';
    const contentType = contentTypeRaw.replace(/[\r\n]/g, '');
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="atrium-tax-${jurisdiction}-${year}.${format}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'tablet_unreachable', detail: safeErrorDetail(err) }, { status: 503 });
  }
}
