'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';

/**
 * Emergency partial close via Vigil's safety-bot path. Used when the
 * venue's regular adapter has no liquidity for a normal close and the
 * user accepts a worse fill in exchange for getting out.
 *
 * Vigil caps each emergency close at 10% of the position per block so a
 * single block can't dump the venue. The user signs once; subsequent
 * partials are fired by the keeper bots until the position is fully
 * closed (or the user revokes).
 *
 * Honest failure modes:
 *  - Vigil contract not deployed → 'vigil_not_deployed'
 *  - Wallet rejects → wallet error message
 *
 * Spec: ATRIUM_FULL_FLOW_DESIGN.md "Emergency close (when the venue has
 * no liquidity)".
 */

const VIGIL_EMERGENCY_ABI = [
  {
    type: 'function',
    name: 'queue_liquidation',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'margin_version', type: 'uint256' },
    ],
    outputs: [{ name: 'job_id', type: 'uint256' }],
  },
] as const;

export type EmergencyCloseStatus =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'submitting' }
  | { kind: 'success'; hash: `0x${string}` }
  | { kind: 'error'; reason: string };

export function useEmergencyClose() {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<EmergencyCloseStatus>({ kind: 'idle' });
  const { writeContractAsync } = useWriteContract();

  async function emergencyClose() {
    if (!account) {
      setStatus({ kind: 'error', reason: 'wallet_not_connected' });
      return;
    }
    setStatus({ kind: 'resolving' });
    let vigil: `0x${string}` | null;
    try {
      const r = await fetch('/api/deployments/address?slug=vigil');
      if (!r.ok) throw new Error(`address_${r.status}`);
      const j = await r.json();
      vigil = j.address ?? null;
    } catch (e) {
      setStatus({ kind: 'error', reason: e instanceof Error ? e.message : 'vigil_lookup_failed' });
      return;
    }
    if (!vigil) {
      setStatus({ kind: 'error', reason: 'vigil_not_deployed' });
      return;
    }
    setStatus({ kind: 'submitting' });
    try {
      // margin_version is fetched by Vigil itself from Plinth — we pass 0 as
      // the "use current" sentinel. The contract increments and validates
      // internally; see Vigil's queue_liquidation implementation. If/when
      // the ABI requires the caller to supply the real version, this hook
      // should fetch it from /api/portfolio/margin-health first.
      const hash = await writeContractAsync({
        address: vigil,
        abi: VIGIL_EMERGENCY_ABI,
        functionName: 'queue_liquidation',
        args: [account, 0n],
      });
      setStatus({ kind: 'success', hash });
    } catch (e) {
      setStatus({ kind: 'error', reason: e instanceof Error ? e.message : 'submit_failed' });
    }
  }

  function reset() {
    setStatus({ kind: 'idle' });
  }

  return { status, emergencyClose, reset };
}
