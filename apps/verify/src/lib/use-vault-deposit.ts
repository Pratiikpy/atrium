'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
// Audit U-39: shared testnet-token constants. Pre-fix this file
// hardcoded the same USDC address as /api/transfer/chain-balance/route.ts
// — two literals → drift risk on address rotation.
import { ARB_SEPOLIA_USDC, USDC_DECIMALS } from '@/lib/testnet-tokens';

/**
 * Two-step ERC-4626 deposit (approve → deposit). Wraps wagmi's
 * `useWriteContract` + `useWaitForTransactionReceipt` into a single
 * controlled state machine so the deposit-card component only has to
 * call `deposit(amount)` and render the resulting status.
 *
 * State transitions:
 *   idle → checking → approving → depositing → success
 *                                     ↓
 *                                   error
 *
 * USDC has 6 decimals on Arbitrum Sepolia; the canonical testnet token
 * is Circle's 0x75faf...AA4d. We default to that unless the env override
 * (`NEXT_PUBLIC_USDC_ADDRESS`) is set so a deployer can wire a different
 * mock token.
 *
 * Honest failure mode: if Coffer isn't deployed (`cofferAddress === null`),
 * the hook refuses to attempt either tx and returns `error: 'coffer_not_deployed'`.
 * The card UI hides the action and shows the same readiness message as
 * the existing deployment-status helper.
 */

// Minimal ERC-4626 ABI for `deposit(assets, receiver)`.
const ERC4626_DEPOSIT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export type DepositStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'approving'; hash: `0x${string}` }
  | { kind: 'depositing'; hash: `0x${string}` }
  | { kind: 'success'; depositHash: `0x${string}` }
  | { kind: 'error'; reason: string };

export function useVaultDeposit(cofferAddress: `0x${string}` | null) {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<DepositStatus>({ kind: 'idle' });
  const { writeContractAsync } = useWriteContract();

  // Read current USDC allowance so we can skip the approve tx when the
  // user has already authorised the vault for an equal-or-greater amount.
  const allowance = useReadContract({
    address: ARB_SEPOLIA_USDC,
    abi: erc20Abi,
    functionName: 'allowance',
    args: account && cofferAddress ? [account, cofferAddress] : undefined,
    query: { enabled: Boolean(account && cofferAddress) },
  });

  // wagmi's receipt hook is reactive — pass the tx hash that's currently
  // pending and the hook tells us when it's mined.
  const pendingHash =
    status.kind === 'approving' || status.kind === 'depositing' ? status.hash : undefined;
  useWaitForTransactionReceipt({
    hash: pendingHash,
    query: { enabled: Boolean(pendingHash) },
  });

  async function deposit(amountUsdc: string) {
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
        return parseUnits(amountUsdc || '0', USDC_DECIMALS);
      } catch {
        return null;
      }
    })();
    if (parsed == null || parsed <= 0n) {
      setStatus({ kind: 'error', reason: 'invalid_amount' });
      return;
    }

    setStatus({ kind: 'checking' });
    try {
      const current = (allowance.data ?? 0n) as bigint;
      if (current < parsed) {
        const approveHash = await writeContractAsync({
          address: ARB_SEPOLIA_USDC,
          abi: erc20Abi,
          functionName: 'approve',
          args: [cofferAddress, parsed],
        });
        setStatus({ kind: 'approving', hash: approveHash });
        // Defer the deposit until the user can read approve confirmation.
        // The component renders the approve tx link first, then a second
        // click on Deposit triggers the actual mint — this prevents the
        // wallet from popping a second signature prompt before the user
        // realises the first one fired.
        return;
      }
      const depositHash = await writeContractAsync({
        address: cofferAddress,
        abi: ERC4626_DEPOSIT_ABI,
        functionName: 'deposit',
        args: [parsed, account],
      });
      setStatus({ kind: 'depositing', hash: depositHash });
      // Receipt watching handles the success transition (component re-reads).
      setStatus({ kind: 'success', depositHash });
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

  return { status, deposit, reset };
}
