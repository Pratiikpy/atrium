'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
// Audit U-39: shared testnet-token constants. Pre-fix this file
// hardcoded the same USDC address as /api/transfer/chain-balance/route.ts
//, two literals → drift risk on address rotation.
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

/**
 * Pure receipt → status decision for the deposit tx (058-FE3 regression
 * surface). A deposit is `success` ONLY when the mined receipt reports
 * status === 'success'. While the tx is unmined (no data, no error) this
 * returns null so the hook stays in `depositing` and never jumps to success
 * on submit. A reverted receipt or a watcher error maps to `error`.
 */
export function depositReceiptStatus(
  depositingHash: `0x${string}` | undefined,
  receipt: { data?: { status: 'success' | 'reverted' } | undefined; error?: Error | null },
): DepositStatus | null {
  if (!depositingHash) return null;
  if (receipt.data) {
    return receipt.data.status === 'success'
      ? { kind: 'success', depositHash: depositingHash }
      : { kind: 'error', reason: 'deposit_reverted' };
  }
  if (receipt.error) return { kind: 'error', reason: receipt.error.message };
  return null;
}

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

  // wagmi's receipt hook is reactive, pass the tx hash that's currently
  // pending and the hook tells us when it's mined.
  const pendingHash =
    status.kind === 'approving' || status.kind === 'depositing' ? status.hash : undefined;
  const receipt = useWaitForTransactionReceipt({
    hash: pendingHash,
    query: { enabled: Boolean(pendingHash) },
  });

  // 058-FE3 fix: writeContractAsync resolves the instant the wallet SUBMITS,
  // not when the tx mines. Pre-fix the hook set `success` immediately after
  // submit, so a reverted deposit (per-user cap, global cap, paused USDC)
  // still painted a green "Deposited." with a tx link. Promote depositing →
  // success/error ONLY when the on-chain receipt confirms, so the UI never
  // claims a success the chain did not actually produce.
  const depositingHash = status.kind === 'depositing' ? status.hash : undefined;
  useEffect(() => {
    const next = depositReceiptStatus(depositingHash, {
      data: receipt.data,
      error: receipt.error,
    });
    if (next) setStatus(next);
  }, [depositingHash, receipt.data, receipt.error]);

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
        // click on Deposit triggers the actual mint, this prevents the
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
      // Do NOT mark success here: writeContractAsync resolved on submit, not
      // on mining. The receipt effect above promotes depositing → success
      // once the tx confirms, or → error if it reverted.
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
