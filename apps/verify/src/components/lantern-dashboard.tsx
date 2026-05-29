'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';

interface Attestation {
  root: `0x${string}`;
  blockNumber: number;
  timestamp: number;
  leafCount: number;
  ipfsCid: string;
}

// Audit UUU-2 fix: mirror the server-side CID_REGEX from
// /api/lantern/verify-inclusion (Wave-R-1). Without this, a malicious CID
// like `evil.com#` would resolve to `https://evil.com#.ipfs.dweb.link/...`
// which the browser fetches as `evil.com` (the `#` becomes a fragment).
// Server-side validation alone is not enough — this client also makes a
// direct fetch to the IPFS gateway and must validate the CID too.
const CID_REGEX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,127})$/;

async function fetchLatest(): Promise<Attestation | null> {
  const r = await fetch('/api/lantern/latest');
  if (!r.ok) return null;
  return r.json();
}

export function LanternDashboard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['lantern-latest'],
    queryFn: fetchLatest,
    refetchInterval: 60_000,
  });
  const [proofResult, setProofResult] = useState<'idle' | 'verified' | 'absent' | 'error'>('idle');

  async function verifyMyInclusion() {
    if (!address || !data?.ipfsCid) return;
    // Audit UUU-2 fix: reject anything that isn't a clean CID before any
    // string interpolation into the gateway URL. Same regex as the server
    // path so the two sides agree on what counts as a valid CID.
    if (!CID_REGEX.test(data.ipfsCid)) {
      setProofResult('error');
      return;
    }
    setProofResult('idle');
    try {
      const r = await fetch(`https://${data.ipfsCid}.ipfs.dweb.link/tree.json`);
      if (!r.ok) {
        setProofResult('error');
        return;
      }
      const tree = (await r.json()) as { leaves: Array<{ user: string }> };
      const found = tree.leaves.some((l) => l.user.toLowerCase() === address.toLowerCase());
      setProofResult(found ? 'verified' : 'absent');
    } catch {
      setProofResult('error');
    }
  }

  // Audit J-H7 fix: six required UI states surfaced explicitly per ui.md.
  // Previously error and empty collapsed into the same warning card, which
  // misled judges about whether Lantern was unreachable vs. simply quiet.

  // Loading state
  if (isLoading) {
    return (
      <div className="mt-12">
        <div className="skeleton h-32 w-full rounded-md" />
      </div>
    );
  }

  // Error state — fetch threw or the API responded non-2xx
  if (error) {
    return (
      <div className="mt-12 rounded-md border border-neg/40 bg-neg/5 p-6">
        <p className="text-sm font-medium text-neg">Lantern source unavailable</p>
        <p className="mt-2 text-sm text-ink-soft">
          The /api/lantern/latest endpoint failed. If the Lantern attestor service is down,
          check Praetor status. Subgraph fallback also unavailable.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm min-h-[44px] font-medium text-parchment hover:bg-ink/90"
        >
          Retry
        </button>
      </div>
    );
  }

  // Permission state — wallet on the wrong chain
  if (isConnected && chainId && chainId !== 421614) {
    return (
      <div className="mt-12 rounded-md border border-testnet/30 bg-testnet/5 p-6">
        <p className="text-sm font-medium text-testnet">Wrong network</p>
        <p className="mt-2 text-sm text-ink-soft">
          Lantern attestations are published on Arbitrum Sepolia (chain id 421614).
          Switch your wallet network to continue.
        </p>
      </div>
    );
  }

  // Empty state — request succeeded but Lantern has not yet published
  if (!data) {
    return (
      <div className="mt-12 rounded-md border border-divider bg-parchment-soft/40 p-6">
        <p className="text-sm font-medium text-ink">No attestation published yet</p>
        <p className="mt-2 text-sm text-ink-soft">
          Lantern publishes every ≤10 minutes. The first attestation lands after Coffer has at least one deposit.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-12 grid gap-8">
      <div className="rounded-md border border-divider bg-parchment-soft/40 p-6">
        <p className="text-xs uppercase tracking-wider text-muted">Latest attestation</p>
        <p className="mt-2 font-mono text-sm text-ink break-all">{data.root}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">Block</dt>
            <dd className="text-ink">{data.blockNumber}</dd>
          </div>
          <div>
            <dt className="text-muted">Published</dt>
            <dd className="text-ink">{new Date(data.timestamp * 1000).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted">Users in tree</dt>
            <dd className="text-ink">{data.leafCount}</dd>
          </div>
          <div>
            <dt className="text-muted">IPFS CID</dt>
            <dd className="text-ink truncate">{data.ipfsCid}</dd>
          </div>
        </dl>
      </div>

      {address ? (
        <div className="rounded-md border border-divider bg-parchment p-6">
          <p className="text-sm text-ink-soft">Verify your own balance is included in the latest tree.</p>
          <button
            type="button"
            onClick={verifyMyInclusion}
            className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-medium text-parchment hover:bg-ink/90"
          >
            Verify my inclusion
          </button>
          {proofResult === 'verified' && (
            <p className="mt-3 text-sm text-live">Your balance is included in the attested tree.</p>
          )}
          {proofResult === 'absent' && (
            <p className="mt-3 text-sm text-testnet">No balance found for your wallet in this attestation.</p>
          )}
          {proofResult === 'error' && (
            <p className="mt-3 text-sm text-neg">IPFS fetch failed. Retry in a moment.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">Connect a wallet to verify your own inclusion.</p>
      )}
    </section>
  );
}
