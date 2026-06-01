'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

/**
 * Emergency close — force-close a position at market through the real deployed
 * close path: AtriumRouter.close_position_via_adapter.
 *
 * 057-FE2 fix (2026-05-30): pre-fix this called Vigil.queueLiquidation from the
 * user's EOA. That function is gated to plinth_address (contracts/vigil/src/
 * lib.rs:253), so every click reverted Unauthorized — and the hook reported
 * success on bare submit, painting a green "queued" for a guaranteed-revert tx.
 * Vigil's liquidation queue is NOT user-callable (only Plinth queues, only a
 * staked keeper executes). The only close path a user wallet can drive is the
 * Router, so this hook routes there and reports success ONLY once the on-chain
 * receipt confirms.
 */

// Mirrors AtriumRouter.close_position_via_adapter (same as use-close-position).
export const ROUTER_CLOSE_ABI = [
  {
    type: 'function',
    name: 'close_position_via_adapter',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'venue_id', type: 'uint8' },
      { name: 'plinth_position_id', type: 'uint256' },
      { name: 'venue_position_id', type: 'uint256' },
      { name: 'venue_payload', type: 'bytes' },
    ],
    outputs: [{ name: 'realized_pnl_signed', type: 'int256' }],
  },
] as const;

export interface EmergencyClosePosition {
  venueId: number;
  plinthPositionId: string;
  venuePositionId: string;
}

export type EmergencyCloseStatus =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'submitting' }
  | { kind: 'closing'; hash: `0x${string}` }
  | { kind: 'success'; hash: `0x${string}` }
  | { kind: 'error'; reason: string };

/**
 * Pure receipt → status decision. Success requires a mined receipt with
 * status === 'success'; an unmined tx stays `closing` (never a fake success).
 */
export function emergencyCloseReceiptStatus(
  closingHash: `0x${string}` | undefined,
  receipt: { data?: { status: 'success' | 'reverted' } | undefined; error?: Error | null },
): EmergencyCloseStatus | null {
  if (!closingHash) return null;
  if (receipt.data) {
    return receipt.data.status === 'success'
      ? { kind: 'success', hash: closingHash }
      : { kind: 'error', reason: 'close_reverted' };
  }
  if (receipt.error) return { kind: 'error', reason: receipt.error.message };
  return null;
}

export function useEmergencyClose() {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<EmergencyCloseStatus>({ kind: 'idle' });
  const { writeContractAsync } = useWriteContract();

  const closingHash = status.kind === 'closing' ? status.hash : undefined;
  const receipt = useWaitForTransactionReceipt({
    hash: closingHash,
    query: { enabled: Boolean(closingHash) },
  });
  useEffect(() => {
    const next = emergencyCloseReceiptStatus(closingHash, {
      data: receipt.data,
      error: receipt.error,
    });
    if (next) setStatus(next);
  }, [closingHash, receipt.data, receipt.error]);

  async function emergencyClose(position: EmergencyClosePosition) {
    if (!account) {
      setStatus({ kind: 'error', reason: 'wallet_not_connected' });
      return;
    }
    let plinthId: bigint;
    let venuePosId: bigint;
    try {
      plinthId = BigInt(position.plinthPositionId);
      venuePosId = BigInt(position.venuePositionId);
    } catch {
      setStatus({ kind: 'error', reason: 'invalid_position_id' });
      return;
    }
    setStatus({ kind: 'resolving' });
    let router: `0x${string}` | null;
    try {
      const r = await fetch('/api/deployments/address?slug=atrium-router');
      if (!r.ok) throw new Error(`address_${r.status}`);
      router = (await r.json()).address ?? null;
    } catch (e) {
      setStatus({ kind: 'error', reason: e instanceof Error ? e.message : 'router_lookup_failed' });
      return;
    }
    if (!router) {
      setStatus({ kind: 'error', reason: 'router_not_deployed' });
      return;
    }
    setStatus({ kind: 'submitting' });
    try {
      const hash = await writeContractAsync({
        address: router,
        abi: ROUTER_CLOSE_ABI,
        functionName: 'close_position_via_adapter',
        args: [position.venueId, plinthId, venuePosId, '0x'],
      });
      setStatus({ kind: 'closing', hash });
    } catch (e) {
      setStatus({ kind: 'error', reason: e instanceof Error ? e.message : 'submit_failed' });
    }
  }

  function reset() {
    setStatus({ kind: 'idle' });
  }

  return { status, emergencyClose, reset };
}
