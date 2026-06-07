import { NextResponse } from 'next/server';
import { tryGetPlinth, tryGetCofferCollateralAssets } from '@/lib/portfolio-source';
import { formatUsd } from '@/lib/format-usd';
import { gql } from '@/lib/scribe-helpers';
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
    // get_account returns (collateral, requiredMargin, marginVersion, isPaused).
    // The 3rd value is the margin VERSION counter, NOT notional - reading it as
    // notional made OPEN NOTIONAL render ~$0.00 even with a live open position.
    const [, required, , paused] = await plinth.read.getAccount([wallet]);
    // Collateral is read LIVE from the Coffer (convertToAssets), NOT Plinth's
    // cached collateral_value_wei. Plinth caches the raw ERC-4626 share balance,
    // which is stale until a recompute and ~1e6x inflated on a small vault, so
    // it rendered a $1.45 deposit as $1,450,000. The Coffer is the same source
    // the /app/vault page reads. (The deeper contract fix - Plinth storing
    // convertToAssets so the on-chain margin check is correct too - is tracked
    // separately; this makes every displayed figure honest now.)
    const collateral = await tryGetCofferCollateralAssets(wallet);
    if (collateral === null) {
      return NextResponse.json({
        totalAccountValueUsd: null,
        totalRequiredMarginUsd: null,
        totalNotionalUsd: null,
        pnl24hUsd: null,
        pnl24hDirection: null,
        source: 'pending',
      });
    }
    // Free margin = collateral above what open positions require, clamped at 0.
    // Mirrors the buying-power route's definition so the two surfaces agree.
    const free = collateral > required ? collateral - required : 0n;
    // OPEN NOTIONAL = sum of |notional| of the user's OPEN positions, read from
    // Scribe (the same source the positions table uses). Best-effort: a Scribe
    // hiccup leaves notional at 0 rather than failing the whole summary.
    let totalNotionalRaw = 0n;
    try {
      const posData = await gql<{ positions: Array<{ notionalSigned: string }> }>(
        `query Notional($u: Bytes!) {
          positions(where: { owner: $u, closedAtBlock: null }, first: 200) { notionalSigned }
        }`,
        { u: wallet.toLowerCase() },
      );
      for (const p of posData.positions ?? []) {
        const n = BigInt(p.notionalSigned);
        totalNotionalRaw += n < 0n ? -n : n;
      }
    } catch {
      // Scribe unavailable: show $0 notional rather than 500 the whole summary.
    }
    // Utilisation = posted margin as a share of collateral, only meaningful when
    // there is an open position (else OPEN NOTIONAL sub reads "No open positions yet").
    const utilisationPct =
      totalNotionalRaw > 0n && collateral > 0n
        ? Number((required * 10000n) / collateral) / 100
        : null;
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
      totalNotionalUsd: formatUsd(totalNotionalRaw, USDC_DECIMALS),
      utilisationPct,
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

