'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { VENUES } from '@/lib/venues';

/**
 * Close a position via the venue's Portico adapter.
 *
 * Counterpart to `useOpenPosition`. Resolves the adapter by `adapter-<slug>`
 * (the same lookup pattern open uses) and calls
 * `adapter.close_position(uint256 venue_position_id, bytes venue_payload)`
 * per IPorticoAdapter v1.0.
 *
 * `venuePositionId` is the on-chain Plinth position id surfaced by
 * `/api/portfolio/positions`. It comes in as a string (Scribe encodes
 * U256 as decimal text); we parse it as BigInt at the boundary.
 *
 * Honest failure modes:
 *   - Adapter not in registry → 'adapter_not_deployed'
 *   - Position id unparseable → 'invalid_position_id'
 *   - Wallet rejects → wallet's error message
 */

const ADAPTER_ABI = [
  {
    type: 'function',
    name: 'close_position',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'venue_position_id', type: 'uint256' },
      { name: 'venue_payload', type: 'bytes' },
    ],
    outputs: [{ name: 'realized_pnl_signed', type: 'int256' }],
  },
] as const;

export type CloseStatus =
  | { kind: 'idle' }
  | { kind: 'resolving'; positionId: string }
  | { kind: 'submitting'; positionId: string }
  | { kind: 'success'; positionId: string; hash: `0x${string}` }
  | { kind: 'error'; positionId: string; reason: string };

/**
 * Resolve a Plinth venueId integer to its adapter slug. The
 * `/api/portfolio/positions` response carries `venueId: number`; the
 * deployments-address lookup keys on the adapter-contract slug (which
 * differs from the venue id for venues that share an adapter — Hyperliquid
 * HIP-3 and HIP-4 both route through `adapter-hyperliquid`). Audit U-28.
 */
function adapterSlugForVenueId(venueId: number): string | null {
  return VENUES.find((v) => v.venueId === venueId)?.adapterSlug ?? null;
}

export function useClosePosition() {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<CloseStatus>({ kind: 'idle' });
  const { writeContractAsync } = useWriteContract();

  async function close(params: { venueId: number; venuePositionId: string }) {
    if (!account) {
      setStatus({
        kind: 'error',
        positionId: params.venuePositionId,
        reason: 'wallet_not_connected',
      });
      return;
    }

    const slug = adapterSlugForVenueId(params.venueId);
    if (!slug) {
      setStatus({
        kind: 'error',
        positionId: params.venuePositionId,
        reason: 'unknown_venue_id',
      });
      return;
    }

    let parsedId: bigint;
    try {
      parsedId = BigInt(params.venuePositionId);
    } catch {
      setStatus({
        kind: 'error',
        positionId: params.venuePositionId,
        reason: 'invalid_position_id',
      });
      return;
    }

    setStatus({ kind: 'resolving', positionId: params.venuePositionId });
    let adapter: `0x${string}` | null;
    try {
      const r = await fetch(`/api/deployments/address?slug=adapter-${slug}`);
      if (!r.ok) throw new Error(`address_${r.status}`);
      const j = await r.json();
      adapter = j.address ?? null;
    } catch (e) {
      setStatus({
        kind: 'error',
        positionId: params.venuePositionId,
        reason: e instanceof Error ? e.message : 'adapter_lookup_failed',
      });
      return;
    }
    if (!adapter) {
      setStatus({
        kind: 'error',
        positionId: params.venuePositionId,
        reason: 'adapter_not_deployed',
      });
      return;
    }

    setStatus({ kind: 'submitting', positionId: params.venuePositionId });
    try {
      const hash = await writeContractAsync({
        address: adapter,
        abi: ADAPTER_ABI,
        functionName: 'close_position',
        args: [parsedId, '0x'],
      });
      setStatus({ kind: 'success', positionId: params.venuePositionId, hash });
    } catch (e) {
      setStatus({
        kind: 'error',
        positionId: params.venuePositionId,
        reason: e instanceof Error ? e.message : 'unknown_error',
      });
    }
  }

  function reset() {
    setStatus({ kind: 'idle' });
  }

  return { status, close, reset };
}
