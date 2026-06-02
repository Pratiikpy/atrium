// SPAN-style portfolio margin, TypeScript port of contracts/plinth/src/span.rs.
//
// WHY this exists: the trade margin-impact preview computes a flat per-venue
// haircut (`size * haircutBps / 10000`) and shows ZERO cross-correlation
// netting, while its own copy claims "Cross-correlation netting handled by
// Plinth". Atrium's headline differentiator (margining a hedged book as a
// portfolio, not leg-by-leg) is therefore invisible at the exact moment a
// trader decides. This module makes that benefit honest and visible by
// reproducing the on-chain engine's math off-chain, for HYPOTHETICAL trade
// previews (no oracle marks, no open positions, no timelock dependency).
//
// PARITY CONTRACT: every function below mirrors a function in span.rs by the
// same name. The reference vectors in span-margin.test.ts are the SAME ones
// span.rs's `mod tests` pins (empty -> 0, single-long -> floor, hedged < solo,
// perfect-hedge frees 40-70%), so a drift between this port and the deployed
// engine fails the build. Integer math uses BigInt (arbitrary precision);
// truncating division matches Rust's I256/U256 integer division toward zero,
// and the reference vectors stay well inside the range where span.rs's
// saturating ops never saturate, so the two agree exactly.

/**
 * One position as the SPAN engine sees it. Mirrors span.rs `PositionView`.
 * Prices are Q64.64 fixed-point (the integer part lives in the high 64 bits),
 * matching how Plinth stores entry/current price on-chain.
 *
 * `haircutBps` is carried for struct parity with the Rust type but, exactly as
 * in span.rs, `requiredMargin` does not read it (margin is driven by the
 * scenario grid plus the min-initial / maintenance-buffer parameters).
 */
export interface PositionView {
  /** Signed notional: positive = long, negative = short. */
  notionalSigned: bigint;
  /** Entry price, Q64.64 fixed-point. */
  entryPriceQ64: bigint;
  /** Current (mark) price, Q64.64 fixed-point. */
  currentPriceQ64: bigint;
  /** Per-instrument haircut (carried for parity; unused by requiredMargin). */
  haircutBps: number;
  /** Correlation class; positions sharing a class net against each other. */
  correlationClass: number;
}

/**
 * Price-shock scenarios in bps: +/-10%, +/-5%, +/-2%, and the no-shock row.
 * Each row is `[direction, magnitudeBps]` applied to every position in a
 * correlation class. Identical to span.rs `SCENARIOS_BPS`.
 */
export const SCENARIOS_BPS: ReadonlyArray<readonly [direction: number, magBps: number]> = [
  [1, 1_000],
  [-1, 1_000],
  [1, 500],
  [-1, 500],
  [1, 200],
  [-1, 200],
  [0, 0],
];

/** Mirrors span.rs `MAX_CORRELATION_CLASSES`. */
export const MAX_CORRELATION_CLASSES = 16;

const BPS_DENOM = 10_000n;

/**
 * Apply a bps-scale price shock to a Q64.64 price. `direction` in {-1, 0, 1}.
 * Mirrors span.rs `apply_shock_q64`.
 */
export function applyShockQ64(priceQ64: bigint, direction: number, magBps: number): bigint {
  if (direction === 0 || magBps === 0) return priceQ64;
  const delta = (priceQ64 * BigInt(magBps)) / BPS_DENOM;
  return direction > 0 ? priceQ64 + delta : priceQ64 - delta;
}

/**
 * PnL for one position if the current price became `shockedPrice`.
 * Mirrors span.rs `position_pnl_under_price`:
 *   pnl = notionalSigned * (shocked - entry) / entry
 * Returns 0 when entry price is zero (unmeasured), matching the Rust guard.
 */
export function positionPnlUnderPrice(p: PositionView, shockedPrice: bigint): bigint {
  if (p.entryPriceQ64 === 0n) return 0n;
  const delta = shockedPrice - p.entryPriceQ64;
  // BigInt division truncates toward zero, matching Rust I256 division.
  return (p.notionalSigned * delta) / p.entryPriceQ64;
}

/**
 * Per-scenario net portfolio loss for a single correlation class. Positive =
 * a loss under that scenario; non-positive scenarios contribute nothing to the
 * worst case. Exposed so a stress surface can render the full grid (not just
 * the worst cell) for a hypothetical book.
 */
export function classScenarioLoss(
  positions: PositionView[],
  classIdx: number,
  direction: number,
  magBps: number,
): bigint {
  let netLoss = 0n;
  for (const p of positions) {
    if (p.correlationClass !== classIdx) continue;
    const shocked = applyShockQ64(p.currentPriceQ64, direction, magBps);
    const pnl = positionPnlUnderPrice(p, shocked);
    // net_loss accumulates -pnl: a negative pnl (a loss) raises net_loss.
    netLoss -= pnl;
  }
  return netLoss > 0n ? netLoss : 0n;
}

/**
 * Required margin across all positions using the SPAN scenario matrix.
 * Mirrors span.rs `required_margin` step-for-step:
 *   1. bucket positions by correlation class
 *   2. per class, worst-case loss across the scenario grid
 *   3. sum worst-case losses (no diversification credit in v1)
 *   4. add the maintenance buffer
 *   5. floor at min-initial-margin bps of total notional
 *   6. result = max(withBuffer, floor)
 */
export function requiredMargin(
  positions: PositionView[],
  minInitialMarginBps: number,
  maintMarginBufferBps: number,
): bigint {
  if (positions.length === 0) return 0n;

  let total = 0n;
  for (let classIdx = 0; classIdx < MAX_CORRELATION_CLASSES; classIdx++) {
    let worstLoss = 0n;
    for (const [direction, magBps] of SCENARIOS_BPS) {
      const loss = classScenarioLoss(positions, classIdx, direction, magBps);
      if (loss > worstLoss) worstLoss = loss;
    }
    total += worstLoss;
  }

  const buffer = (total * BigInt(maintMarginBufferBps)) / BPS_DENOM;
  const withBuffer = total + buffer;

  let totalNotional = 0n;
  for (const p of positions) {
    totalNotional += p.notionalSigned < 0n ? -p.notionalSigned : p.notionalSigned;
  }
  const floor = (totalNotional * BigInt(minInitialMarginBps)) / BPS_DENOM;

  return withBuffer > floor ? withBuffer : floor;
}

/**
 * The cross-venue netting benefit, made explicit for a trade preview.
 *
 * `isolated` = the sum of each leg margined on its own (leg-by-leg, the way a
 * single-venue account would post). `hedged` = the whole book margined as one
 * portfolio (the way Plinth posts it). `freedBps` = the fraction of isolated
 * margin that the portfolio netting frees, in bps.
 *
 * This is the honest, source-able number behind the "cross-margin frees ~X%"
 * claim: it reproduces span.rs's `hedge_frees_a_pinned_share_of_the_isolated_margin`
 * reference computation for arbitrary hypothetical legs. `freedBps` is 0 when a
 * book has no netting (single leg, or legs in distinct correlation classes), so
 * the preview never overstates the benefit.
 */
export function hedgeFreedBps(
  legs: PositionView[],
  minInitialMarginBps: number,
  maintMarginBufferBps: number,
): { isolatedMargin: bigint; hedgedMargin: bigint; freedBps: bigint } {
  let isolated = 0n;
  for (const leg of legs) {
    isolated += requiredMargin([leg], minInitialMarginBps, maintMarginBufferBps);
  }
  const hedged = requiredMargin(legs, minInitialMarginBps, maintMarginBufferBps);
  const freedBps =
    isolated === 0n || hedged >= isolated
      ? 0n
      : ((isolated - hedged) * BPS_DENOM) / isolated;
  return { isolatedMargin: isolated, hedgedMargin: hedged, freedBps };
}
