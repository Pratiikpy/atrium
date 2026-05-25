'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { VENUES } from '@/lib/venues';

/**
 * Close a position end-to-end via AtriumRouter.
 *
 * Phase theta audit follow-up (2026-05-25): pre-fix this hook called
 * `adapter.close_position` directly from the user's wallet, with the
 * same Unauthorized-revert class as the open path (the user's EOA is
 * not on the adapter's is_authorized_caller list — only the Router is).
 *
 * Now: routes through AtriumRouter.close_position_via_adapter. The
 * Router verifies ownership via plinth.getPosition, dispatches to the
 * adapter's v1.0 or v1.1 close entry per the version() probe, and
 * sweeps adapter-held USDC back to Coffer.
 *
 * Phase theta audit follow-up resolved (2026-05-25): /api/portfolio/
 * positions now joins the Plinth view with the RouterPositionEvent
 * indexer (already in subgraph/src/atrium_router.ts) so each row
 * carries both plinthPositionId AND venuePositionId. The hook signature
 * accepts both ids separately. When the venue side hasn't been indexed
 * yet (e.g. fresh open + cold subgraph), the route returns the Plinth
 * id for both fields — the same fallback the pre-fix shape had.
 */

const ROUTER_ABI = [
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

export type CloseStatus =
  | { kind: 'idle' }
  | { kind: 'resolving'; positionId: string }
  | { kind: 'submitting'; positionId: string }
  | { kind: 'success'; positionId: string; hash: `0x${string}` }
  | { kind: 'error'; positionId: string; reason: string };

export function useClosePosition() {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<CloseStatus>({ kind: 'idle' });
  const { writeContractAsync } = useWriteContract();

  async function close(params: {
    venueId: number;
    plinthPositionId: string;
    venuePositionId: string;
  }) {
    if (!account) {
      setStatus({
        kind: 'error',
        positionId: params.venuePositionId,
        reason: 'wallet_not_connected',
      });
      return;
    }

    // The VENUES list mirrors the Plinth/Portico venue id table.
    if (!VENUES.find((v) => v.venueId === params.venueId)) {
      setStatus({
        kind: 'error',
        positionId: params.venuePositionId,
        reason: 'unknown_venue_id',
      });
      return;
    }

    let parsedPlinthId: bigint;
    let parsedVenueId: bigint;
    try {
      parsedPlinthId = BigInt(params.plinthPositionId);
      parsedVenueId = BigInt(params.venuePositionId);
    } catch {
      setStatus({
        kind: 'error',
        positionId: params.venuePositionId,
        reason: 'invalid_position_id',
      });
      return;
    }

    setStatus({ kind: 'resolving', positionId: params.venuePositionId });
    let router: `0x${string}` | null;
    try {
      const r = await fetch('/api/deployments/address?slug=atrium-router');
      if (!r.ok) throw new Error(`address_${r.status}`);
      const j = await r.json();
      router = j.address ?? null;
    } catch (e) {
      setStatus({
        kind: 'error',
        positionId: params.venuePositionId,
        reason: e instanceof Error ? e.message : 'router_lookup_failed',
      });
      return;
    }
    if (!router) {
      setStatus({
        kind: 'error',
        positionId: params.venuePositionId,
        reason: 'router_not_deployed',
      });
      return;
    }

    setStatus({ kind: 'submitting', positionId: params.venuePositionId });
    try {
      const hash = await writeContractAsync({
        address: router,
        abi: ROUTER_ABI,
        functionName: 'close_position_via_adapter',
        args: [params.venueId, parsedPlinthId, parsedVenueId, '0x'],
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
