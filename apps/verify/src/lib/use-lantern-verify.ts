'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';

/**
 * Lantern proof-of-reserves inclusion verifier.
 *
 * Read-only flow, no contract write. Steps:
 *   1. GET /api/lantern/latest → root + ipfsCid + blockNumber
 *   2. POST /api/lantern/verify-inclusion with {root, ipfsCid, wallet}
 *      → server fetches tree.json from the configured IPFS gateway, finds
 *        the leaf, and returns { ok, reason, leaf? }
 *   3. Surface the result
 *
 * Honest failure modes:
 *   - No wallet → `wallet_not_connected`
 *   - No attestation yet → `no_attestation_yet`
 *   - Wallet not in tree → `wallet_not_found` (legitimate negative, user
 *     never deposited or attestation pre-dates their deposit)
 *   - IPFS gateway down → `gateway_unreachable`
 *
 * Powers `/verify/6` (Lantern verify step) and the existing
 * `LanternDashboard.verifyMyInclusion()` button on /lantern.
 */

interface LatestResponse {
  root: `0x${string}`;
  blockNumber: number;
  timestamp: number;
  leafCount: number;
  ipfsCid: string;
}

interface VerifyResponse {
  ok: boolean;
  reason: string;
  leaf?: string;
}

export type LanternVerifyStatus =
  | { kind: 'idle' }
  | { kind: 'reading-attestation' }
  | { kind: 'verifying' }
  | {
      kind: 'success';
      attestation: LatestResponse;
      result: VerifyResponse;
    }
  | { kind: 'error'; reason: string };

export function useLanternVerify() {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<LanternVerifyStatus>({ kind: 'idle' });

  async function verify() {
    if (!account) {
      setStatus({ kind: 'error', reason: 'wallet_not_connected' });
      return;
    }

    setStatus({ kind: 'reading-attestation' });
    let latest: LatestResponse;
    try {
      const r = await fetch('/api/lantern/latest');
      if (r.status === 404) {
        setStatus({ kind: 'error', reason: 'no_attestation_yet' });
        return;
      }
      if (!r.ok) {
        setStatus({ kind: 'error', reason: `lantern_latest_${r.status}` });
        return;
      }
      latest = await r.json();
    } catch (e) {
      setStatus({
        kind: 'error',
        reason: e instanceof Error ? e.message : 'lantern_fetch_failed',
      });
      return;
    }

    setStatus({ kind: 'verifying' });
    try {
      const r = await fetch('/api/lantern/verify-inclusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root: latest.root,
          ipfsCid: latest.ipfsCid,
          wallet: account,
        }),
      });
      if (!r.ok) {
        setStatus({
          kind: 'error',
          reason: `verify_inclusion_${r.status}`,
        });
        return;
      }
      const result = (await r.json()) as VerifyResponse;
      setStatus({ kind: 'success', attestation: latest, result });
    } catch (e) {
      setStatus({
        kind: 'error',
        reason: e instanceof Error ? e.message : 'verify_inclusion_failed',
      });
    }
  }

  function reset() {
    setStatus({ kind: 'idle' });
  }

  return { status, verify, reset };
}
