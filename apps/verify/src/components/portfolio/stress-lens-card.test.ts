import { describe, it, expect } from 'vitest';
import { STORMS, stormMargin, WORKED_LEGS } from './stress-lens-card';
import { hedgeFreedBps, type PositionView } from '@/lib/span-margin';

/**
 * Cross-card consistency lock for the Stress Lens and the Margin Lens, which sit
 * on the same /app/portfolio page and describe the SAME worked hedged pair.
 *
 * The bug this guards: the Stress Lens used to render a "Calm" row (magBps 0)
 * whose leg-by-leg figure was the bare 5% notional floor ($5,000/leg = $10,000
 * for the pair), while the Margin Lens prices the identical isolated leg through
 * the full +/-10% scenario grid ($10,200/leg = $20,400 for the pair). Two
 * different "leg-by-leg" numbers for the same book, one card apart. The fix
 * removed the Calm row so the Margin Lens is the single source of the calm
 * isolated baseline and the Stress Lens only shows adverse-shock rows.
 */

// Same worked-example params the Margin Lens discloses (5% floor, 2% buffer).
const WORKED_MIN_INITIAL_BPS = 500;
const WORKED_MAINT_BUFFER_BPS = 200;

describe('Stress Lens storm scenarios', () => {
  it('emits no no-shock (magBps 0) row, so it never prints a competing calm baseline', () => {
    expect(STORMS.some((s) => s.magBps === 0)).toBe(false);
    expect(STORMS.length).toBeGreaterThan(0);
  });

  it('escalates: each storm is at least as severe as the previous', () => {
    for (let i = 1; i < STORMS.length; i++) {
      expect(STORMS[i].magBps).toBeGreaterThan(STORMS[i - 1].magBps);
    }
  });

  it('worked-example leg-by-leg margin is monotonically non-decreasing across storms', () => {
    // The isolated (leg-by-leg) total the Stress Lens renders, per storm.
    const isolatedByStorm = STORMS.map((s) =>
      WORKED_LEGS.reduce((acc: bigint, leg: PositionView) => acc + stormMargin([leg], s.magBps), 0n),
    );
    for (let i = 1; i < isolatedByStorm.length; i++) {
      expect(isolatedByStorm[i] >= isolatedByStorm[i - 1]).toBe(true);
    }
  });

  it('leaves the calm isolated baseline ($20,400) to the Margin Lens alone', () => {
    // The Margin Lens isolated baseline for the same worked pair, via the full
    // scenario grid. This is the single source of the calm number on the page.
    const worked = hedgeFreedBps(WORKED_LEGS, WORKED_MIN_INITIAL_BPS, WORKED_MAINT_BUFFER_BPS);
    expect(worked.isolatedMargin).toBe(20_400n);

    // The Stress Lens must never emit that same magBps-0 leg-by-leg figure
    // (which would be the bare floor, $10,000), because there is no magBps-0 row.
    const stressCalmFigures = STORMS.filter((s) => s.magBps === 0).map((s) =>
      WORKED_LEGS.reduce((acc: bigint, leg: PositionView) => acc + stormMargin([leg], s.magBps), 0n),
    );
    expect(stressCalmFigures).toHaveLength(0);
  });
});
