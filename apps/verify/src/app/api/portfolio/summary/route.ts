import { NextResponse } from 'next/server';
import { tryGetPlinth } from '@/lib/portfolio-source';
import { formatUsd } from '@/lib/format-usd';
import { requireWalletMatch } from '@/lib/auth-session';
import { noCacheHeaders } from '@/lib/no-cache-headers';

export const dynamic = 'force-dynamic';

const USDC_DECIMALS = 6;

export async function GET(req?: Request) {
  // Phase theta audit follow-up: accept ?wallet= for multi-tenant support.
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  // Phase 2c: lock to authenticated session
  if (req && wallet) {
    const denied = await requireWalletMatch(req, wallet);
    if (denied) return denied;
  }
  const plinth = await tryGetPlinth();
  if (!plinth || !wallet) {
    return NextResponse.json({
      totalAccountValueUsd: null,
      totalRequiredMarginUsd: null,
      totalNotionalUsd: null,
      pnl24hUsd: null,
      pnl24hDirection: null,
      source: 'pending',
    });
  }
  try {
    const [collateral, required, notional, paused] = await plinth.read.getAccount([wallet]);
    // Free margin = collateral above what open positions require, clamped at 0.
    // Mirrors the buying-power route's definition so the two surfaces agree.
    const free = collateral > required ? collateral - required : 0n;
    // Audit LL-9 fix: hand-rolled `fmtUsdc` truncated the fractional part
    // (`$1.99` for $1.999999) instead of locale-rounding. Use the
    // CI-tested formatUsd helper for consistent rounding + thousands
    // separator across every route.
    return NextResponse.json({
      totalAccountValueUsd: formatUsd(collateral, USDC_DECIMALS),
      // The PortfolioStatRow reads totalCollateralUsd + buyingPowerUsd, which
      // this route never populated, so the "Total collateral" card rendered a
      // permanent "-" (value ?? '-') even with real Plinth collateral, and
      // "Buying power" fell back to raw collateral. Populate both: collateral
      // is the posted margin; buying power is the free (unencumbered) margin.
      totalCollateralUsd: formatUsd(collateral, USDC_DECIMALS),
      buyingPowerUsd: formatUsd(free, USDC_DECIMALS),
      totalRequiredMarginUsd: formatUsd(required, USDC_DECIMALS),
      totalNotionalUsd: formatUsd(notional, USDC_DECIMALS),
      // Audit U-23: pre-fix the success path returned `pnl24hUsd: null` with
      // `pnl24hDirection: 'flat'`, direction implies "we measured a flat
      // PnL" but the value is null because we never measured. The pending
      // path correctly returned `pnl24hDirection: null`; success now
      // matches so consumers can rely on `direction != null` ↔ value != null.
      pnl24hUsd: null,
      pnl24hDirection: null,
      paused,
      source: 'plinth' as const,
    }, { headers: noCacheHeaders });
  } catch {
    return NextResponse.json({
      totalAccountValueUsd: null,
      totalRequiredMarginUsd: null,
      totalNotionalUsd: null,
      pnl24hUsd: null,
      pnl24hDirection: null,
      source: 'pending',
    });
  }
}

