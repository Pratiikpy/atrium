import { describe, it, expect } from 'vitest';
import { toFunctionSelector } from 'viem';
import { AQUEDUCT_SEND_ABI } from './use-transfer';

/**
 * 053-SEC10 regression. The Transfer button calls the deployed Aqueduct,
 * which only exposes `send_collateral(uint64,address,uint256,uint256)`.
 * Pre-fix the hook used `send(uint256,uint64,address)`, a different 4-byte
 * selector, wrong arg order, and no `expires_at`, so every transfer
 * reverted on-chain while the UI presented the button as functional.
 *
 * This locks the hook's ABI to the real contract signature so the wrong
 * selector can never silently return.
 */
describe('useTransfer, Aqueduct send_collateral selector', () => {
  const item = AQUEDUCT_SEND_ABI[0];

  it('targets send_collateral with the deployed arg order and types', () => {
    expect(item.name).toBe('send_collateral');
    expect(item.stateMutability).toBe('nonpayable');
    expect(item.inputs.map((i) => i.type)).toEqual([
      'uint64',
      'address',
      'uint256',
      'uint256',
    ]);
  });

  it('computes the deployed send_collateral selector, not the old send selector', () => {
    const deployed = toFunctionSelector(
      'send_collateral(uint64,address,uint256,uint256)',
    );
    const oldBuggy = toFunctionSelector('send(uint256,uint64,address)');
    expect(toFunctionSelector(item)).toBe(deployed);
    expect(toFunctionSelector(item)).not.toBe(oldBuggy);
  });
});
