import { describe, it, expect } from 'vitest';
import { ROUTER_CLOSE_ABI, emergencyCloseReceiptStatus } from './use-emergency-close';

const HASH = ('0x' + 'ef'.repeat(32)) as `0x${string}`;

/**
 * 057-FE2 regression. Pre-fix the emergency-close hook called
 * Vigil.queueLiquidation from the user EOA (Plinth-gated -> always reverts
 * Unauthorized) and reported success on bare submit. It must route through
 * the real user-callable close path and only report success on a confirmed
 * receipt.
 */
describe('useEmergencyClose routing + receipt gating', () => {
  it('targets the Router close path, not the Plinth-only Vigil.queueLiquidation', () => {
    expect(ROUTER_CLOSE_ABI[0].name).toBe('close_position_via_adapter');
    expect(ROUTER_CLOSE_ABI[0].name).not.toBe('queueLiquidation');
  });

  it('stays non-success while the close is unmined', () => {
    expect(emergencyCloseReceiptStatus(HASH, { data: undefined, error: null })).toBeNull();
  });

  it('promotes to success only on a confirmed receipt', () => {
    expect(emergencyCloseReceiptStatus(HASH, { data: { status: 'success' } })).toEqual({
      kind: 'success',
      hash: HASH,
    });
  });

  it('maps a reverted close to error, not a fake "queued" success', () => {
    expect(emergencyCloseReceiptStatus(HASH, { data: { status: 'reverted' } })).toEqual({
      kind: 'error',
      reason: 'close_reverted',
    });
  });
});
