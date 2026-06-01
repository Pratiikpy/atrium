import { describe, it, expect } from 'vitest';
import { depositReceiptStatus } from './use-vault-deposit';

const HASH = ('0x' + 'ab'.repeat(32)) as `0x${string}`;

/**
 * 058-FE3 regression. writeContractAsync resolves on SUBMIT, not on mining.
 * Pre-fix the deposit hook painted a green "Deposited." immediately after
 * submit, so a reverted deposit (per-user cap, global cap, paused USDC) still
 * showed success to the user/judge. The status must be `success` ONLY when a
 * mined receipt reports status === 'success'.
 */
describe('depositReceiptStatus()', () => {
  it('stays non-success while the tx is unmined (no receipt yet)', () => {
    // The key bug: an in-flight deposit must NOT be success.
    expect(depositReceiptStatus(HASH, { data: undefined, error: null })).toBeNull();
  });

  it('promotes to success only on a confirmed receipt', () => {
    expect(depositReceiptStatus(HASH, { data: { status: 'success' } })).toEqual({
      kind: 'success',
      depositHash: HASH,
    });
  });

  it('maps a reverted receipt to error, not success', () => {
    expect(depositReceiptStatus(HASH, { data: { status: 'reverted' } })).toEqual({
      kind: 'error',
      reason: 'deposit_reverted',
    });
  });

  it('maps a receipt-watcher error to error', () => {
    const res = depositReceiptStatus(HASH, { error: new Error('rpc down') });
    expect(res).toEqual({ kind: 'error', reason: 'rpc down' });
  });

  it('returns null when no deposit is in flight', () => {
    expect(depositReceiptStatus(undefined, { data: { status: 'success' } })).toBeNull();
  });
});
