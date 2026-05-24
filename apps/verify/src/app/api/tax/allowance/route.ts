import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// UK CGT annual exemption £3,000 (2026/27 tax year per HMRC HS283).
const UK_ALLOWANCE_GBP = 3000;
const UK_GBP_TO_USD = 1.27;

export async function GET(req: NextRequest) {
  // Audit LL-3 fix: prior code did `parseInt(year, 10)` without validation.
  // `parseInt('NaN', 10)` returns NaN → label rendered as "NaN/N CGT
  // allowance" (broken UI). Strict-numeric + range gate.
  const jurisdictionRaw = req.nextUrl.searchParams.get('jurisdiction') ?? 'uk';
  const yearRaw = req.nextUrl.searchParams.get('year') ?? '2026';
  const jurisdiction = ['uk', 'us', 'de', 'other'].includes(jurisdictionRaw) ? jurisdictionRaw : 'uk';
  const yearNum = /^\d{4}$/.test(yearRaw) ? parseInt(yearRaw, 10) : 2026;
  const year = yearNum >= 2020 && yearNum <= 2099 ? yearNum : 2026;
  const yearLabel = String(year);

  // Audit LL-5: honest pending state. usedUsd was hardcoded to "$0" but
  // marked source:pending — the literal "$0" would render if a downstream
  // reader ignored source. Switch to null per real-data discipline.
  if (jurisdiction !== 'uk') {
    return NextResponse.json({
      jurisdictionLabel: jurisdiction === 'us' ? 'US · no equivalent exemption' : 'DE FIFO · no exemption',
      yearLabel,
      usedUsd: null,
      remainingUsd: null,
      totalUsd: null,
      pctUsed: null,
      source: 'pending',
    });
  }
  const totalUsd = UK_ALLOWANCE_GBP * UK_GBP_TO_USD;
  const nextYearTwoDigit = ((year + 1) % 100).toString().padStart(2, '0');
  return NextResponse.json({
    jurisdictionLabel: `${year}/${nextYearTwoDigit} CGT allowance · UK`,
    yearLabel,
    usedUsd: null,
    remainingUsd: `$${totalUsd.toLocaleString('en-US')}`,
    totalUsd: `$${totalUsd.toLocaleString('en-US')}`,
    pctUsed: null,
    source: 'pending',
  });
}
