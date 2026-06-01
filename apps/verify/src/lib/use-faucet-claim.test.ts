import { describe, it, expect } from 'vitest';
import { faucetClaimReceiptStatus } from './use-faucet-claim';

const HASH = ('0x' + 'cd'.repeat(32)) as `0x${string}`;

/**
 * 114-PM3.3 regression. The onboarding "Claim faucet" button used `onNext`,
 * which never sent a tx — the funding drop was never dispatched while the UI
 * implied a claim. The new hook dispatches Faucet.claim() and must only report
 * success once the on-chain receipt confirms (no fake success on submit).
 */
describe('faucetClaimReceiptStatus()', () => {
  it('stays non-success while the claim is unmined', () => {
    expect(faucetClaimReceiptStatus(HASH, { data: undefined, error: null })).toBeNull();
  });

  it('promotes to success only on a confirmed receipt', () => {
    expect(faucetClaimReceiptStatus(HASH, { data: { status: 'success' } })).toEqual({
      kind: 'success',
      hash: HASH,
    });
  });

  it('maps a reverted claim (e.g. cooldown) to error, not success', () => {
    expect(faucetClaimReceiptStatus(HASH, { data: { status: 'reverted' } })).toEqual({
      kind: 'error',
      reason: 'faucet_claim_reverted',
    });
  });

  it('returns null when no claim is in flight', () => {
    expect(faucetClaimReceiptStatus(undefined, { data: { status: 'success' } })).toBeNull();
  });
});
