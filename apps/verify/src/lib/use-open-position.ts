'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { keccak256, parseUnits, toBytes } from 'viem';
import { VENUES } from '@/lib/venues';

/**
 * Open a position end-to-end via AtriumRouter.
 *
 * Phase theta audit follow-up (2026-05-25): pre-fix this hook called
 * `adapter.open_position` DIRECTLY from the user's wallet. That bypassed:
 *   1. Plinth margin validation (Plinth.openPosition records the margin row)
 *   2. Coffer.adapterPull (which moves USDC from Coffer to the adapter so
 *      the adapter has funds to deploy into the venue)
 *   3. The Router's IPorticoAdapterV11 dispatch logic (v1.1 adapters like
 *      AaveHorizonAdapterV11 revert V10NotSupported on direct v1.0 calls)
 *   4. The adapter's `is_authorized_caller` check (the user's EOA is NOT on
 *      the adapter's authorized-caller mapping — only the Router is)
 *
 * Every direct adapter.open_position call from a user wallet would have
 * reverted Unauthorized. The Trade page's "Open position" button was dead.
 *
 * Now: route through AtriumRouter.open_position_via_adapter. The Router
 * orchestrates Plinth → Coffer → adapter in one tx so the user signs once.
 *
 * Honest failure modes:
 *   - Router not in registry → 'router_not_deployed'
 *   - Wallet rejects → wallet's actual error string
 *   - User unconnected → 'wallet_not_connected'
 */

// Map venue slug → instrument-id seed. Real adapters key off
// keccak256(symbol). For now we use a stable per-venue symbol so the
// instrument_id is deterministic from the form.
const SYMBOL_BY_VENUE: Record<string, string> = {
  hyperliquid: 'HSLA-PERP',
  'aave-horizon': 'USDC-LEND',
  'pendle-v2': 'PT-USDC-DEC25',
  curve: '3CRV',
  'trade-xyz': 'rTSLA-PERP',
  polymarket: 'ELECTION-2026',
  'hl-hip4': 'HSLA2-PERP',
};

// AtriumRouter.open_position_via_adapter signature per
// contracts/atrium-router/src/AtriumRouter.sol:149. The action_sigil +
// intent_sigil bytes are empty until the Sigil mandate path lights up
// the user-direct-open case (today Plinth accepts empty bytes from the
// user's own EOA — owner == caller short-circuits the mandate check).
const ROUTER_ABI = [
  {
    type: 'function',
    name: 'open_position_via_adapter',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'venue_id', type: 'uint8' },
      { name: 'instrument_id', type: 'bytes32' },
      { name: 'notional_signed', type: 'int256' },
      { name: 'action_sigil', type: 'bytes' },
      { name: 'intent_sigil', type: 'bytes' },
      { name: 'venue_payload', type: 'bytes' },
    ],
    outputs: [
      { name: 'plinth_position_id', type: 'uint256' },
      { name: 'venue_position_id', type: 'uint256' },
    ],
  },
] as const;

const USDC_DECIMALS = 6;

export type OpenStatus =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'submitting' }
  | { kind: 'success'; hash: `0x${string}`; side: 'long' | 'short'; sizeUsd: string }
  | { kind: 'error'; reason: string };

export function useOpenPosition() {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<OpenStatus>({ kind: 'idle' });
  const { writeContractAsync } = useWriteContract();

  async function open(params: { venue: string; side: 'long' | 'short'; sizeUsd: string }) {
    if (!account) {
      setStatus({ kind: 'error', reason: 'wallet_not_connected' });
      return;
    }
    const parsed = (() => {
      try {
        return parseUnits(params.sizeUsd || '0', USDC_DECIMALS);
      } catch {
        return null;
      }
    })();
    if (parsed == null || parsed <= 0n) {
      setStatus({ kind: 'error', reason: 'invalid_size' });
      return;
    }

    // Resolve the venue's numeric id from the canonical VENUES list.
    // The Router takes `venue_id` and consults the PorticoRegistry to
    // resolve the adapter address itself; the front-end no longer
    // needs to thread the adapter address through.
    const venue = VENUES.find((v) => v.id === params.venue);
    if (!venue) {
      setStatus({ kind: 'error', reason: 'unknown_venue_id' });
      return;
    }

    setStatus({ kind: 'resolving' });
    let router: `0x${string}` | null;
    try {
      const r = await fetch('/api/deployments/address?slug=atrium-router');
      if (!r.ok) throw new Error(`address_${r.status}`);
      const j = await r.json();
      router = j.address ?? null;
    } catch (e) {
      setStatus({
        kind: 'error',
        reason: e instanceof Error ? e.message : 'router_lookup_failed',
      });
      return;
    }
    if (!router) {
      setStatus({ kind: 'error', reason: 'router_not_deployed' });
      return;
    }

    const symbol = SYMBOL_BY_VENUE[params.venue] ?? 'HSLA-PERP';
    const instrumentId = keccak256(toBytes(symbol));
    const notional = params.side === 'long' ? parsed : -parsed;

    setStatus({ kind: 'submitting' });
    try {
      const hash = await writeContractAsync({
        address: router,
        abi: ROUTER_ABI,
        functionName: 'open_position_via_adapter',
        args: [
          venue.venueId,
          instrumentId,
          notional,
          '0x', // action_sigil: empty for owner-direct open
          '0x', // intent_sigil: empty for owner-direct open
          '0x', // venue_payload: per-venue specifics land Year-2
        ],
      });
      setStatus({ kind: 'success', hash, side: params.side, sizeUsd: params.sizeUsd });
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

  return { status, open, reset };
}
