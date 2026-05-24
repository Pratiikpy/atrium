'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';

/**
 * Single-step ERC-4626 redeem (no approval needed — the share holder is
 * the caller and Coffer reads `msg.sender` for owner). Mirror of
 * `useVaultDeposit` but with one fewer tx.
 */

const SHARES_DECIMALS = 6; // Coffer matches USDC decimals (audit S-1)

const ERC4626_REDEEM_ABI = [
  {
    type: 'function',
    name: 'redeem',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
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

  async function withdraw(sharesHuman: string) {
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
        return parseUnits(sharesHuman || '0', SHARES_DECIMALS);
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
        abi: ERC4626_REDEEM_ABI,
        functionName: 'redeem',
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
