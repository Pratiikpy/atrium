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
  ipfsPinned: boolean;
}

async function fetchLatest(): Promise<Attestation | null> {
  const r = await fetch('/api/lantern/latest');
  // Bug-hunt fix (2026-06-02): returning null on EVERY non-2xx made the
  // "Lantern source unavailable" outage card unreachable - a real Scribe outage
  // (5xx) looked identical to "no attestation yet" (404). 404 is the honest
  // empty state (null); any other failure throws so the outage card surfaces.
  if (!r.ok) {
    if (r.status === 404) return null;
    throw new Error(`lantern_${r.status}`);
  }
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
    if (!address || !data?.ipfsCid || !data?.root) return;
    setProofResult('idle');
    try {
      // 079-BE6 fix: route through the server verifier, which recomputes the
      // Merkle root from the published tree, compares it to the on-chain
      // attested root, and checks the wallet's inclusion proof. The previous
      // tree.leaves.some(user == address) was a bare membership scan with no
      // root comparison and no proof, a "Verified" backed by nothing.
      const r = await fetch('/api/lantern/verify-inclusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: data.root, ipfsCid: data.ipfsCid, wallet: address }),
      });
      const json = (await r.json()) as { ok?: boolean; reason?: string };
      if (json.ok) setProofResult('verified');
      else if (json.reason?.includes('not found')) setProofResult('absent');
      else setProofResult('error');
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

  // Error state, fetch threw or the API responded non-2xx
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

  // Permission state, wallet on the wrong chain
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

  // Empty state, request succeeded but Lantern has not yet published
  if (!data) {
    return (
      <div className="mt-12 rounded-md border border-divider bg-parchment-soft/40 p-6">
        <p className="text-sm font-medium text-ink">No attestation published yet</p>
        <p className="mt-2 text-sm text-ink-soft">
          Lantern publishes about every 45 minutes. The first attestation lands after Coffer has at least one deposit.
        </p>
      </div>
    );
  }

  // Freshness: the attestor runs an in-run self-loop publishing about every 45
  // minutes (GitHub throttles plain cron, so the */30 schedule only restarts the
  // loop). Show the real age and flag stale rather than implying liveness.
  // Threshold = 2x the 45-min cadence + 10-min grace = 100 min, identical to
  // /api/reserves/summary's STALE_THRESHOLD so the badge and the summary tile
  // never disagree. Pre-fix this was 30 min against the old 10-min cron, which
  // false-flagged a healthy 45-min cycle "stale" for ~15 min of every cycle.
  const STALE_AFTER_MIN = 100;
  const minsAgo = Math.max(0, Math.floor((Date.now() / 1000 - data.timestamp) / 60));
  const fresh = minsAgo <= STALE_AFTER_MIN;
  const publishedUtc =
    new Date(data.timestamp * 1000).toISOString().slice(0, 19).replace('T', ' ') + ' UTC';

  return (
    <section className="mt-12 grid gap-8">
      <div className="rounded-md border border-divider bg-parchment-soft/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wider text-muted">Latest attestation</p>
          <span
            className={
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider ' +
              (fresh ? 'bg-live-soft text-live' : 'bg-testnet/10 text-testnet')
            }
          >
            <span className={'size-1.5 rounded-full ' + (fresh ? 'bg-live' : 'bg-testnet')} />
            {fresh ? 'fresh' : 'stale'} · {minsAgo} min ago
          </span>
        </div>
        <p className="mt-2 font-mono text-sm text-ink break-all">{data.root}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">Block</dt>
            <dd className="text-ink">
              <a
                href={`https://sepolia.arbiscan.io/block/${data.blockNumber}`}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 hover:opacity-80"
              >
                {data.blockNumber.toLocaleString()}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Published</dt>
            <dd className="text-ink">{publishedUtc}</dd>
          </div>
          <div>
            <dt className="text-muted">Users in tree</dt>
            <dd className="text-ink">{data.leafCount}</dd>
          </div>
          <div>
            <dt className="text-muted">IPFS CID</dt>
            <dd className="text-ink truncate">{data.ipfsPinned ? data.ipfsCid : 'tree pin pending'}</dd>
          </div>
        </dl>
      </div>

      {!data.ipfsPinned ? (
        <div className="rounded-md border border-testnet/30 bg-testnet/5 p-6">
          <p className="text-sm font-medium text-testnet">Inclusion verification pending IPFS pin</p>
          <p className="mt-2 text-sm text-ink-soft">
            The signed Merkle root above is committed on-chain and indexed. Verifying your own
            balance against it needs the full tree pinned to IPFS, which lights up once the attestor
            runs with a web3.storage token.
          </p>
        </div>
      ) : address ? (
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
            <p className="mt-3 text-sm text-live">
              Verified, the published tree hashes to the on-chain attested root and your wallet&apos;s
              inclusion proof reproduces it.
            </p>
          )}
          {proofResult === 'absent' && (
            <p className="mt-3 text-sm text-testnet">No balance found for your wallet in this attestation.</p>
          )}
          {proofResult === 'error' && (
            <p className="mt-3 text-sm text-neg">Could not verify, the attestation tree is unavailable or did not match the attested root.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">Connect a wallet to verify your own inclusion.</p>
      )}
    </section>
  );
}
