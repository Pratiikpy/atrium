'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

/**
 * Faucet claim hook (114-PM3.3 fix).
 *
 * Pre-fix the onboarding "Claim faucet" button's handler was `onNext`, which
 * only advanced the step and wrote localStorage, no tx was ever sent, so the
 * drop that funds the entire downstream deposit/trade journey never arrived
 * while the UI implied a claim happened. This hook dispatches the real
 * `Faucet.claim()` and (per the 058-FE3 lesson) only reports success once the
 * on-chain receipt confirms.
 */

// contracts/faucet/src/Faucet.sol, `function claim() external` (no args).
const FAUCET_CLAIM_ABI = [
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

export type FaucetClaimStatus =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'submitting' }
  | { kind: 'claiming'; hash: `0x${string}` }
  | { kind: 'success'; hash: `0x${string}` }
  | { kind: 'error'; reason: string };

/**
 * Pure receipt → status decision (testable surface). Success requires a mined
 * receipt with status === 'success'; an unmined tx stays `claiming`.
 */
export function faucetClaimReceiptStatus(
  claimingHash: `0x${string}` | undefined,
  receipt: { data?: { status: 'success' | 'reverted' } | undefined; error?: Error | null },
): FaucetClaimStatus | null {
  if (!claimingHash) return null;
  if (receipt.data) {
    return receipt.data.status === 'success'
      ? { kind: 'success', hash: claimingHash }
      : { kind: 'error', reason: 'faucet_claim_reverted' };
  }
  if (receipt.error) return { kind: 'error', reason: receipt.error.message };
  return null;
}

export function useFaucetClaim() {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<FaucetClaimStatus>({ kind: 'idle' });
  const { writeContractAsync } = useWriteContract();

  const claimingHash = status.kind === 'claiming' ? status.hash : undefined;
  const receipt = useWaitForTransactionReceipt({
    hash: claimingHash,
    query: { enabled: Boolean(claimingHash) },
  });
  useEffect(() => {
    const next = faucetClaimReceiptStatus(claimingHash, {
      data: receipt.data,
      error: receipt.error,
    });
    if (next) setStatus(next);
  }, [claimingHash, receipt.data, receipt.error]);

  async function claim() {
    if (!account) {
      setStatus({ kind: 'error', reason: 'wallet_not_connected' });
      return;
    }
    setStatus({ kind: 'resolving' });
    let faucet: `0x${string}` | null;
    try {
      const r = await fetch('/api/deployments/address?slug=faucet');
      if (!r.ok) throw new Error(`address_${r.status}`);
      faucet = (await r.json()).address ?? null;
    } catch (e) {
      setStatus({ kind: 'error', reason: e instanceof Error ? e.message : 'faucet_lookup_failed' });
      return;
    }
    if (!faucet) {
      setStatus({ kind: 'error', reason: 'faucet_not_deployed' });
      return;
    }
    setStatus({ kind: 'submitting' });
    try {
      const hash = await writeContractAsync({
        address: faucet,
        abi: FAUCET_CLAIM_ABI,
        functionName: 'claim',
        args: [],
      });
      setStatus({ kind: 'claiming', hash });
    } catch (e) {
      setStatus({ kind: 'error', reason: e instanceof Error ? e.message : 'unknown_error' });
    }
  }

  function reset() {
    setStatus({ kind: 'idle' });
  }

  return { status, claim, reset };
}
