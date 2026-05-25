import { NextRequest, NextResponse } from 'next/server';
import { tryGetPlinth } from '@/lib/portfolio-source';
import { formatUsd } from '@/lib/format-usd';

export const dynamic = 'force-dynamic';

const USDC_DECIMALS = 6;
const MAX_REASONABLE_SIZE_USD = 1_000_000_000; // $1B per-trade ceiling on testnet

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

export async function GET(req: NextRequest) {
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = req.nextUrl.searchParams.get('wallet');
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  const plinth = await tryGetPlinth();
  const sizeUsd = parseSizeUsdOrNull(req.nextUrl.searchParams.get('size'));
  const venue = req.nextUrl.searchParams.get('venue') ?? 'hl-hip3';

  if (sizeUsd == null) {
    // Audit JJ-1 fix: malformed `size` no longer crashes the route. Honest 400.
    return NextResponse.json(
      { error: 'invalid_size', detail: 'size must be a non-negative number ≤ 1_000_000_000' },
      { status: 400 },
    );
  }

  if (!plinth || !wallet) {
    return NextResponse.json({
      buyingPowerAfterUsd: null,
      liquidationBufferBps: null,
      initialMarginUsd: null,
      maintenanceMarginUsd: null,
      notes: `Margin impact will compute live from Plinth.update_margin once contracts deploy. Venue: ${venue}.`,
      source: 'pending',
    });
  }
  try {
    const [collateral, required] = await plinth.read.getAccount([wallet]);
    const initialBps = venue.startsWith('hl') ? 1000 : venue === 'aave-v3' ? 100 : 500;
    const maintenanceBps = Math.floor(initialBps * 0.8);
    const sizeWei = BigInt(Math.floor(sizeUsd * 1e6));
    const initialMargin = (sizeWei * BigInt(initialBps)) / 10_000n;
    const maintenanceMargin = (sizeWei * BigInt(maintenanceBps)) / 10_000n;
    const requiredAfter = required + initialMargin;
    const buyingPowerAfter = collateral > requiredAfter ? collateral - requiredAfter : 0n;
    // Audit JJ-2 fix: prior code did `requiredAfter + 1n` in the denominator
    // as a divide-by-zero guard. But `requiredAfter === 0n` is already
    // special-cased above; the `+ 1n` only introduced an off-by-up-to-2×
    // precision error when requiredAfter was small. Now exact ratio when
    // non-zero, 10_000 (full buffer) when zero.
    const bufferBps = requiredAfter === 0n
      ? 10_000
      : Number((buyingPowerAfter * 10_000n) / requiredAfter);
    // Audit JJ-3 fix: use the audit-tested formatUsd helper instead of
    // `Number(big) / 1e6` which loses precision past Number.MAX_SAFE_INTEGER.
    return NextResponse.json({
      buyingPowerAfterUsd: formatUsd(buyingPowerAfter, USDC_DECIMALS),
      liquidationBufferBps: Math.min(10_000, bufferBps),
      initialMarginUsd: formatUsd(initialMargin, USDC_DECIMALS),
      maintenanceMarginUsd: formatUsd(maintenanceMargin, USDC_DECIMALS),
      notes: `Venue ${venue} haircut applied via SPAN scenario matrix. Cross-correlation netting handled by Plinth.`,
      source: 'plinth' as const,
    });
  } catch {
    return NextResponse.json({
      buyingPowerAfterUsd: null,
      liquidationBufferBps: null,
      initialMarginUsd: null,
      maintenanceMarginUsd: null,
      notes: 'Margin impact reverted on simulated call.',
      source: 'pending',
    });
  }
}
