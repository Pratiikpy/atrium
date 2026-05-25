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

// Phase theta audit follow-up (2026-05-25): selector audit — Vigil is a
// Stylus contract; Stylus 0.10 auto-converts snake_case Rust fn names
// to camelCase Solidity selectors. The ABI name MUST be the exported
// camelCase form or the selector hash mismatches and the tx reverts
// with empty data. Same class as the original Coffer.adapter_pull →
// adapterPull bug from audit task #333. Pre-fix this hook used the
// snake form and every emergency-close click reverted at the Vigil
// dispatch table.
const VIGIL_EMERGENCY_ABI = [
  {
    type: 'function',
    name: 'queueLiquidation',
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
        functionName: 'queueLiquidation',
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
