'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { keccak256, parseUnits, toBytes } from 'viem';
import { VENUES } from '@/lib/venues';

/**
 * Open a position on a Portico-whitelisted venue adapter.
 *
 * Flow:
 *   1. Resolve the adapter address by venue slug from /api/deployments/address
 *   2. Build (instrument_id, notional_signed, venue_payload) per IPorticoAdapter v1.0
 *   3. Send adapter.open_position(...) via wagmi
 *
 * For Year-1 testnet, `venue_payload` is empty bytes — the venue-specific
 * blob shape is pending the Portico v1.1 ABI freeze (see
 * contracts/portico-registry/src/IPorticoAdapterV11.sol).
 *
 * Honest failure modes:
 *   - Adapter not in registry → 'adapter_not_deployed' (until Month 1 W2)
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

const ADAPTER_ABI = [
  {
    type: 'function',
    name: 'open_position',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'instrument_id', type: 'bytes32' },
      { name: 'notional_signed', type: 'int256' },
      { name: 'venue_payload', type: 'bytes' },
    ],
    outputs: [{ name: 'venue_position_id', type: 'uint256' }],
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

    setStatus({ kind: 'resolving' });
    // Audit U-28: lookup uses `adapter-${adapterSlug}`, NOT
    // `adapter-${venue.id}`. Hyperliquid HIP-3 and HIP-4 share one
    // adapter contract (both have `adapterSlug: 'hyperliquid'`), so
    // routing by venue id would 404 on HIP-4. The deploy script writes
    // each adapter contract under its slug.
    const adapterSlug = VENUES.find((v) => v.id === params.venue)?.adapterSlug;
    if (!adapterSlug) {
      setStatus({ kind: 'error', reason: 'unknown_venue_id' });
      return;
    }
    let adapter: `0x${string}` | null;
    try {
      const r = await fetch(`/api/deployments/address?slug=adapter-${adapterSlug}`);
      if (!r.ok) throw new Error(`address_${r.status}`);
      const j = await r.json();
      adapter = j.address ?? null;
    } catch (e) {
      setStatus({
        kind: 'error',
        reason: e instanceof Error ? e.message : 'adapter_lookup_failed',
      });
      return;
    }
    if (!adapter) {
      setStatus({ kind: 'error', reason: 'adapter_not_deployed' });
      return;
    }

    const symbol = SYMBOL_BY_VENUE[params.venue] ?? 'HSLA-PERP';
    const instrumentId = keccak256(toBytes(symbol));
    const notional = params.side === 'long' ? parsed : -parsed;

    setStatus({ kind: 'submitting' });
    try {
      const hash = await writeContractAsync({
        address: adapter,
        abi: ADAPTER_ABI,
        functionName: 'open_position',
        args: [instrumentId, notional, '0x'],
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
