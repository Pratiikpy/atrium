import { NextRequest, NextResponse } from 'next/server';
import { tryGetPlinth } from '@/lib/portfolio-source';
import { requireWalletMatch } from '@/lib/auth-session';
import { formatUsd } from '@/lib/format-usd';
import { VENUES } from '@/lib/venues';

export const dynamic = 'force-dynamic';

const USDC_DECIMALS = 6;
const MAX_REASONABLE_SIZE_USD = 1_000_000_000; // $1B per-trade ceiling on testnet
const MAX_LEVERAGE = 20;

/**
 * Audit JJ-1 fix: parse + validate `size` strictly. Pre-fix path: `parseFloat`
 * accepted "NaN", "Infinity", negative, and absurdly-large values, which then
 * flowed into `BigInt(Math.floor(sizeUsd * 1e6))` and either THREW
 * (RangeError on NaN/Infinity) or produced negative / absurd margin values.
 */
function parseSizeUsdOrNull(s: string | null): number | null {
  if (s == null || s === '') return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  if (n > MAX_REASONABLE_SIZE_USD) return null;
  return n;
}

function parseLeverageOrDefault(s: string | null): number | null {
  if (s == null || s === '') return 1;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > MAX_LEVERAGE) return null;
  return n;
}

export async function GET(req: NextRequest) {
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = req.nextUrl.searchParams.get('wallet');
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : (process.env.DEMO_WALLET_ADDRESS ?? null);
  // P0-4 (IDOR fix): lock wallet-scoped margin data to the authenticated
  // session. Every sibling portfolio route enforces this; this one was
  // missed, letting any caller read any wallet's collateral/margin ratio
  // via ?wallet=. Mirrors api/portfolio/margin-health/route.ts.
  if (wallet) {
    const denied = await requireWalletMatch(req, wallet);
    if (denied) return denied;
  }
  const sizeUsd = parseSizeUsdOrNull(req.nextUrl.searchParams.get('size'));
  const leverage = parseLeverageOrDefault(
    req.nextUrl.searchParams.get('leverage'),
  );
  // Default to a real VENUES id (was 'hl-hip3', which is not a valid id).
  const venue = req.nextUrl.searchParams.get('venue') ?? 'hyperliquid';

  if (sizeUsd == null || leverage == null) {
    // Audit JJ-1 fix: malformed `size` no longer crashes the route. Honest 400.
    return NextResponse.json(
      {
        error: sizeUsd == null ? 'invalid_size' : 'invalid_leverage',
        detail:
          'size must be a non-negative number <= 1_000_000_000; leverage must be between 1 and 20',
      },
      { status: 400 },
    );
  }
  const notionalUsd = sizeUsd * leverage;
  if (notionalUsd > MAX_REASONABLE_SIZE_USD) {
    return NextResponse.json(
      {
        error: 'invalid_notional',
        detail: 'size multiplied by leverage must be <= 1_000_000_000',
      },
      { status: 400 },
    );
  }

  if (!wallet) {
    return NextResponse.json({
      buyingPowerAfterUsd: null,
      liquidationBufferBps: null,
      notionalUsd: formatUsd(
        BigInt(Math.floor(notionalUsd * 1e6)),
        USDC_DECIMALS,
      ),
      initialMarginUsd: null,
      maintenanceMarginUsd: null,
      notes: `Margin impact will compute live from Plinth.update_margin once contracts deploy. Venue: ${venue}. Preview notional: ${leverage}x size.`,
      source: 'pending',
    });
  }

  const plinth = await tryGetPlinth();

  if (!plinth) {
    return NextResponse.json({
      buyingPowerAfterUsd: null,
      liquidationBufferBps: null,
      notionalUsd: formatUsd(
        BigInt(Math.floor(notionalUsd * 1e6)),
        USDC_DECIMALS,
      ),
      initialMarginUsd: null,
      maintenanceMarginUsd: null,
      notes: `Margin impact will compute live from Plinth.update_margin once contracts deploy. Venue: ${venue}. Preview notional: ${leverage}x size.`,
      source: 'pending',
    });
  }
  try {
    const [collateral, required] = await plinth.read.getAccount([wallet]);
    // Audit fix (#19): the prior `venue.startsWith('hl') ? 1000 : venue === 'aave-v3' ? 100 : 500`
    // ternary keyed on ids that the UI never sends ('aave-v3' is never a venue
    // id; 'hyperliquid'/'aave-horizon'/'trade-xyz'/'polymarket' all fell through
    // to 500bps), so the margin shown disagreed with the haircut column rendered
    // beside it in venue-margin-compare (e.g. Polymarket showed "50% haircut"
    // next to a 5% margin). Read the canonical per-venue haircut so the table
    // agrees with itself. Falls back to 400bps only for an unknown id.
    const venueRow = VENUES.find((v) => v.id === venue);
    const initialBps = venueRow?.haircutBps ?? 400;
    const maintenanceBps = Math.floor(initialBps * 0.8);
    const sizeWei = BigInt(Math.floor(notionalUsd * 1e6));
    const initialMargin = (sizeWei * BigInt(initialBps)) / 10_000n;
    const maintenanceMargin = (sizeWei * BigInt(maintenanceBps)) / 10_000n;
    const requiredAfter = required + initialMargin;
    const buyingPowerAfter =
      collateral > requiredAfter ? collateral - requiredAfter : 0n;
    // Audit JJ-2 fix: prior code did `requiredAfter + 1n` in the denominator
    // as a divide-by-zero guard. But `requiredAfter === 0n` is already
    // special-cased above; the `+ 1n` only introduced an off-by-up-to-2×
    // precision error when requiredAfter was small. Now exact ratio when
    // non-zero, 10_000 (full buffer) when zero.
    const bufferBps =
      requiredAfter === 0n
        ? 10_000
        : Number((buyingPowerAfter * 10_000n) / requiredAfter);
    // Audit JJ-3 fix: use the audit-tested formatUsd helper instead of
    // `Number(big) / 1e6` which loses precision past Number.MAX_SAFE_INTEGER.
    return NextResponse.json({
      buyingPowerAfterUsd: formatUsd(buyingPowerAfter, USDC_DECIMALS),
      liquidationBufferBps: Math.min(10_000, bufferBps),
      notionalUsd: formatUsd(sizeWei, USDC_DECIMALS),
      initialMarginUsd: formatUsd(initialMargin, USDC_DECIMALS),
      maintenanceMarginUsd: formatUsd(maintenanceMargin, USDC_DECIMALS),
      notes: `Venue ${venue} initial-margin haircut ${(initialBps / 100).toFixed(0)}% on ${leverage}x notional (Plinth per-venue risk parameter). Cross-correlation netting handled by Plinth.`,
      source: 'plinth' as const,
    });
  } catch {
    return NextResponse.json({
      buyingPowerAfterUsd: null,
      liquidationBufferBps: null,
      notionalUsd: formatUsd(
        BigInt(Math.floor(notionalUsd * 1e6)),
        USDC_DECIMALS,
      ),
      initialMarginUsd: null,
      maintenanceMarginUsd: null,
      notes: 'Margin impact reverted on simulated call.',
      source: 'pending',
    });
  }
}
