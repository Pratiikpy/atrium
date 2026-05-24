import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { parseTsOrNull } from '@/lib/format-time';
import { formatUsd } from '@/lib/format-usd';

export const dynamic = 'force-dynamic';

const USDC_DECIMALS = 6;

interface ScribeMarginUpdate {
  blockNumber: string;
  timestamp: string;
  collateralValueWei: string;
  requiredMarginWei: string;
}

export async function GET() {
  const wallet = process.env.DEMO_WALLET_ADDRESS ?? null;
  if (!wallet) {
    return NextResponse.json({ currentUsd: null, series: [], windowDays: 30, source: 'pending' });
  }
  try {
    const data = await gql<{ marginUpdates: ScribeMarginUpdate[] }>(
      `query BP($u: Bytes!) {
        marginUpdates(first: 200, where: { account: $u }, orderBy: blockNumber, orderDirection: desc) {
          blockNumber
          timestamp
          collateralValueWei
          requiredMarginWei
        }
      }`,
      { u: wallet.toLowerCase() }
    );
    // Audit KK-3 + KK-4 fix: drop rows with malformed timestamps (rather
    // than rendering NaN-keyed chart points) and use formatUsd to preserve
    // precision past Number.MAX_SAFE_INTEGER on aggregated free-margin.
    const series: Array<{ ts: number; valueUsd: string }> = [];
    for (const m of (data.marginUpdates ?? []).slice().reverse()) {
      const ts = parseTsOrNull(m.timestamp);
      if (ts == null) continue;
      const collateral = BigInt(m.collateralValueWei);
      const required = BigInt(m.requiredMarginWei);
      const free = collateral > required ? collateral - required : 0n;
      series.push({ ts, valueUsd: formatUsd(free, USDC_DECIMALS) });
    }
    const latest = series[series.length - 1];
    return NextResponse.json({
      currentUsd: latest?.valueUsd ?? null,
      series,
      windowDays: 30,
      source: 'plinth' as const,
    });
  } catch {
    return NextResponse.json({ currentUsd: null, series: [], windowDays: 30, source: 'pending' });
  }
}
