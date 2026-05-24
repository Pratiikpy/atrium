import { describe, it, expect } from 'vitest';
import { isLiquidityError } from './emergency-close-banner';

/**
 * Pins the wallet-vs-venue error classifier so we don't accidentally
 * offer the emergency-close path when the actual blocker is a wallet
 * rejection or a missing deployment. False positives here would push
 * the user toward a fancier code path when a simple retry would work.
 */
describe('isLiquidityError', () => {
  it('detects clear liquidity errors', () => {
    expect(isLiquidityError('no liquidity at venue')).toBe(true);
    expect(isLiquidityError('InsufficientLiquidity')).toBe(true);
    expect(isLiquidityError('execution reverted: depth too low')).toBe(true);
    expect(isLiquidityError('thin market — no_buyer for 1000')).toBe(true);
    expect(isLiquidityError('venue reverted on close')).toBe(true);
  });

  it('rejects wallet-level errors', () => {
    expect(isLiquidityError('User rejected the request.')).toBe(false);
    expect(isLiquidityError('wallet rejected the signature')).toBe(false);
    expect(isLiquidityError('connect wallet first')).toBe(false);
  });

  it('rejects honest-pending blockers (no point offering an alt path when nothing is deployed)', () => {
    expect(isLiquidityError('adapter_not_deployed')).toBe(false);
    expect(isLiquidityError('vigil_not_deployed')).toBe(false);
    expect(isLiquidityError('adapter not deployed yet')).toBe(false);
  });

  it('rejects input-validation errors', () => {
    expect(isLiquidityError('invalid_position_id')).toBe(false);
  });
});
