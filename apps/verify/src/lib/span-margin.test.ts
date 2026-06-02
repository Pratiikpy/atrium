import { describe, it, expect } from 'vitest';
import {
  requiredMargin,
  hedgeFreedBps,
  applyShockQ64,
  positionPnlUnderPrice,
  SCENARIOS_BPS,
  type PositionView,
} from './span-margin';

/**
 * Parity lock: this suite mirrors the reference vectors pinned by
 * contracts/plinth/src/span.rs `mod tests`. The TS margin preview must
 * reproduce the deployed Rust engine's numbers exactly; if this port drifts
 * from span.rs, the build fails here and the UI never silently disagrees with
 * the chain.
 *
 * Vectors use entry == current price and small integers, exactly as span.rs
 * does (the margin ratio is scale-invariant, so a plain integer price stands
 * in for the Q64.64 representation in these vectors).
 */

function pos(
  notionalSigned: bigint,
  price: bigint,
  correlationClass: number,
): PositionView {
  return {
    notionalSigned,
    entryPriceQ64: price,
    currentPriceQ64: price,
    haircutBps: 100,
    correlationClass,
  };
}

const MIN_INITIAL_BPS = 500;
const MAINT_BUFFER_BPS = 200;

describe('span-margin requiredMargin, span.rs parity vectors', () => {
  it('empty_positions_zero_margin', () => {
    expect(requiredMargin([], MIN_INITIAL_BPS, MAINT_BUFFER_BPS)).toBe(0n);
  });

  it('single_long_position_has_floor_margin (>= 5% of notional)', () => {
    const p = pos(10_000n, 1_000n, 0);
    const req = requiredMargin([p], MIN_INITIAL_BPS, MAINT_BUFFER_BPS);
    // span.rs asserts req >= 500 (5% of 10_000). The engine actually returns
    // the worst-case scenario loss (1000) + 2% buffer (20) = 1020, since that
    // exceeds the 5% notional floor. Lock the exact value, not just the bound.
    expect(req).toBe(1_020n);
    expect(req >= 500n).toBe(true);
  });

  it('hedged_position_has_lower_margin_than_unhedged', () => {
    // Long 10k + short 10k in the SAME correlation class net under scenarios.
    const long = pos(10_000n, 1_000n, 1);
    const short = pos(-10_000n, 1_000n, 1);
    const reqSolo = requiredMargin([long], MIN_INITIAL_BPS, MAINT_BUFFER_BPS);
    const reqHedged = requiredMargin([long, short], MIN_INITIAL_BPS, MAINT_BUFFER_BPS);
    expect(reqHedged <= reqSolo).toBe(true);
    // Hedged book nets to zero scenario loss, so it floors at 5% of the 20k
    // gross notional = 1000; solo is 1020. Exact values locked.
    expect(reqSolo).toBe(1_020n);
    expect(reqHedged).toBe(1_000n);
  });
});

describe('span-margin hedgeFreedBps, the cross-venue netting differentiator', () => {
  it('perfect equal hedge frees 40-70% of isolated margin (span.rs band)', () => {
    // span.rs `hedge_frees_a_pinned_share_of_the_isolated_margin` asserts the
    // freed fraction sits in [4000, 7000] bps. Reproduce it here so the public
    // "cross-margin frees ~X%" copy is source-able to the real engine output.
    const long = pos(10_000n, 1_000n, 1);
    const short = pos(-10_000n, 1_000n, 1);
    const { isolatedMargin, hedgedMargin, freedBps } = hedgeFreedBps(
      [long, short],
      MIN_INITIAL_BPS,
      MAINT_BUFFER_BPS,
    );
    expect(isolatedMargin).toBe(2_040n); // 1020 + 1020
    expect(hedgedMargin).toBe(1_000n);
    // (2040 - 1000) / 2040 = 5098 bps = 50.98%
    expect(freedBps).toBe(5_098n);
    expect(freedBps >= 4_000n && freedBps <= 7_000n).toBe(true);
  });

  it('never overstates: legs in DISTINCT correlation classes free nothing', () => {
    // A "hedge" across uncorrelated instruments is not a hedge. The preview
    // must show 0% freed, not invent a netting benefit.
    const long = pos(10_000n, 1_000n, 1);
    const short = pos(-10_000n, 1_000n, 2); // different class => no netting
    const { freedBps } = hedgeFreedBps([long, short], MIN_INITIAL_BPS, MAINT_BUFFER_BPS);
    expect(freedBps).toBe(0n);
  });

  it('single leg frees nothing (no book to net)', () => {
    const { freedBps } = hedgeFreedBps([pos(10_000n, 1_000n, 1)], MIN_INITIAL_BPS, MAINT_BUFFER_BPS);
    expect(freedBps).toBe(0n);
  });

  it('a small opposing leg (scenario regime) frees less than a perfect hedge', () => {
    // The engine has two regimes. When the residual scenario loss after netting
    // still exceeds the 5%-of-gross-notional floor (a SMALL opposing leg), a
    // partial hedge frees strictly less than a perfect one. Long 10k vs short
    // 1k stays scenario-dominated: freed 1818 bps vs the perfect 5098 bps.
    const perfect = hedgeFreedBps(
      [pos(10_000n, 1_000n, 1), pos(-10_000n, 1_000n, 1)],
      MIN_INITIAL_BPS,
      MAINT_BUFFER_BPS,
    ).freedBps;
    const partial = hedgeFreedBps(
      [pos(10_000n, 1_000n, 1), pos(-1_000n, 1_000n, 1)],
      MIN_INITIAL_BPS,
      MAINT_BUFFER_BPS,
    ).freedBps;
    expect(partial).toBe(1_818n);
    expect(partial < perfect).toBe(true);
    expect(partial > 0n).toBe(true);
  });

  it('floor regime: a large opposing leg frees the same fraction as perfect', () => {
    // When netting drops the scenario loss below the notional floor, BOTH the
    // isolated sum and the hedged book floor at 5% of their gross notional, so
    // the freed FRACTION coincides with a perfect hedge. Documenting this so a
    // preview never claims "a bigger hedge always frees a bigger %": long 10k
    // vs short 4k floors out at 5098 bps, equal to the perfect hedge.
    const perfect = hedgeFreedBps(
      [pos(10_000n, 1_000n, 1), pos(-10_000n, 1_000n, 1)],
      MIN_INITIAL_BPS,
      MAINT_BUFFER_BPS,
    ).freedBps;
    const floored = hedgeFreedBps(
      [pos(10_000n, 1_000n, 1), pos(-4_000n, 1_000n, 1)],
      MIN_INITIAL_BPS,
      MAINT_BUFFER_BPS,
    ).freedBps;
    expect(floored).toBe(perfect);
    expect(floored).toBe(5_098n);
  });

  it('regime-independent guard: hedged margin never exceeds isolated (freed >= 0)', () => {
    // Netting must never make a book MORE expensive than margining its legs
    // separately. Probe a spread of opposing sizes; freed stays in [0, 10000].
    for (const shortSize of [-500n, -1_000n, -4_000n, -10_000n, -15_000n]) {
      const { freedBps } = hedgeFreedBps(
        [pos(10_000n, 1_000n, 1), pos(shortSize, 1_000n, 1)],
        MIN_INITIAL_BPS,
        MAINT_BUFFER_BPS,
      );
      expect(freedBps >= 0n && freedBps <= 10_000n).toBe(true);
    }
  });
});

describe('span-margin primitives', () => {
  it('applyShockQ64 moves price by the bps magnitude in the given direction', () => {
    expect(applyShockQ64(1_000n, 1, 1_000)).toBe(1_100n); // +10%
    expect(applyShockQ64(1_000n, -1, 1_000)).toBe(900n); // -10%
    expect(applyShockQ64(1_000n, 0, 0)).toBe(1_000n); // no shock
    expect(applyShockQ64(1_000n, 1, 0)).toBe(1_000n); // zero magnitude
  });

  it('positionPnlUnderPrice returns 0 for an unmeasured (zero) entry', () => {
    const p = pos(10_000n, 0n, 0);
    expect(positionPnlUnderPrice(p, 1_100n)).toBe(0n);
  });

  it('positionPnlUnderPrice: long gains when price rises, short loses', () => {
    const long = pos(10_000n, 1_000n, 0);
    const short = pos(-10_000n, 1_000n, 0);
    expect(positionPnlUnderPrice(long, 1_100n)).toBe(1_000n); // +10% on 10k long
    expect(positionPnlUnderPrice(short, 1_100n)).toBe(-1_000n); // short loses
  });

  it('SCENARIOS_BPS matches the span.rs grid (7 rows incl. no-shock)', () => {
    expect(SCENARIOS_BPS).toHaveLength(7);
    expect(SCENARIOS_BPS).toContainEqual([0, 0]);
    expect(SCENARIOS_BPS).toContainEqual([1, 1_000]);
    expect(SCENARIOS_BPS).toContainEqual([-1, 1_000]);
  });
});
