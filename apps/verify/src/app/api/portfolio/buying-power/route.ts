import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { parseTsOrNull } from '@/lib/format-time';
import { formatUsd } from '@/lib/format-usd';
import { requireWalletMatch } from '@/lib/auth-session';
import { noCacheHeaders } from '@/lib/no-cache-headers';
import { tryGetCofferCollateralAssets } from '@/lib/portfolio-source';

export const dynamic = 'force-dynamic';

const USDC_DECIMALS = 6;

interface ScribeMarginUpdate {
  blockNumber: string;
  timestamp: string;
  collateralValueWei: string;
  requiredMarginWei: string;
}

export async function GET(req?: Request) {
  // Phase theta audit follow-up (2026-05-25): accept ?wallet= query
  // param so users who connect their own wallet see THEIR portfolio,
  // not the demo wallet's. Pre-fix every request read DEMO_WALLET_ADDRESS
  // unconditionally, Year-1 single-tenant artifact that hid the real
  // user's data behind the demo wallet's. `req?` keeps the existing
  // vitest GET() calls compatible (they get the env-fallback path).
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  // Note: the stale `url`/`walletParam` block below is fully replaced
  // by the single-line walletParam above; tsc sees no dangling refs.
  // Phase 2c: lock to authenticated session
  if (req && wallet) {
    const denied = await requireWalletMatch(req, wallet);
    if (denied) return denied;
  }
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
    // currentUsd: the LIVE buying power from the Coffer (convertToAssets), NOT
    // the Scribe marginUpdate's collateralValueWei, which carries Plinth's raw
    // share balance (~1e6x inflated on a small vault -> rendered $1.45M). This
    // matches the summary route + the /app/vault page so every surface agrees.
    // The 30d SERIES stays Scribe-sourced (share-based) but is empty until a
    // position exists, so it is latent until the contract emits convertToAssets.
    const cofferAssets = await tryGetCofferCollateralAssets(wallet);
    const currentUsd = cofferAssets !== null ? formatUsd(cofferAssets, USDC_DECIMALS) : (latest?.valueUsd ?? null);
    return NextResponse.json({
      currentUsd,
      series,
      windowDays: 30,
      source: 'plinth' as const,
    }, { headers: noCacheHeaders });
  } catch {
    return NextResponse.json({ currentUsd: null, series: [], windowDays: 30, source: 'pending' });
  }
}
