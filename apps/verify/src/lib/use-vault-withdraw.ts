'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { USDC_DECIMALS } from '@/lib/testnet-tokens';

/**
 * Single-tx ERC-4626 withdraw (no approval needed — the share holder is
 * the caller and Coffer reads `msg.sender` for owner). Mirror of
 * `useVaultDeposit` but with one fewer tx.
 *
 * Phase theta audit follow-up (2026-05-25): this hook used to call
 * `redeem(shares, receiver, owner)` but Coffer Stylus exports only
 * `withdraw(assets, receiver, owner)` — every vault withdrawal in the
 * UI reverted at the EVM dispatch table with 'no matching function'.
 * Same class as Sumsub ABI mismatch + Stylus snake/camel selector bugs:
 * the hook's ABI declaration didn't match the deployed bytecode.
 *
 * Semantic: user now enters a USDC amount to receive; Coffer computes
 * the shares to burn via `convert_to_shares_ceil` (round-up so the user
 * surrenders at least as many shares as the assets they take — audit
 * FIRE78-COF1). Cleaner UX than asking the user to compute share
 * amounts manually anyway.
 */

const ERC4626_WITHDRAW_ABI = [
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export type WithdrawStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'pending'; hash: `0x${string}` }
  | { kind: 'success'; hash: `0x${string}` }
  | { kind: 'error'; reason: string };

export function useVaultWithdraw(cofferAddress: `0x${string}` | null) {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<WithdrawStatus>({ kind: 'idle' });
  const { writeContractAsync } = useWriteContract();

  async function withdraw(assetsHuman: string) {
    if (!account) {
      setStatus({ kind: 'error', reason: 'wallet_not_connected' });
      return;
    }
    if (!cofferAddress) {
      setStatus({ kind: 'error', reason: 'coffer_not_deployed' });
      return;
    }
    const parsed = (() => {
      try {
        return parseUnits(assetsHuman || '0', USDC_DECIMALS);
      } catch {
        return null;
      }
    })();
    if (parsed == null || parsed <= 0n) {
      setStatus({ kind: 'error', reason: 'invalid_amount' });
      return;
    }

    setStatus({ kind: 'submitting' });
    try {
      const hash = await writeContractAsync({
        address: cofferAddress,
        abi: ERC4626_WITHDRAW_ABI,
        functionName: 'withdraw',
        args: [parsed, account, account],
      });
      setStatus({ kind: 'success', hash });
    } catch (e) {
      setStatus({
        kind: 'error',
        reason: e instanceof Error ? e.message : 'unknown_error',
      });
    }
  }

  function reset() {
    setStatus({ kind: 'idle' });
  }

  return { status, withdraw, reset };
}
