'use client';

/**
 * ReservesMobile, Mobile Lantern attestation viewer.
 * Mobile flow: View Lantern attestation (one of the 5 required mobile flows).
 * Re-uses /api/lantern/latest + verify-inclusion flow.
 * 44px touch targets, 16px body text, safe-area padding.
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

interface Attestation {
  root: `0x${string}`;
  blockNumber: number;
  timestamp: number;
  leafCount: number;
  ipfsCid: string;
}

async function fetchLatest(): Promise<Attestation | null> {
  const r = await fetch('/api/lantern/latest');
  // Bug-hunt fix (2026-06-02): /api/lantern/latest returns 404 + {exists:false}
  // to mean "no attestation published yet" (the normal pre-launch state). The
  // prior code threw on ANY non-2xx, so the 404 surfaced a hard "Could not load,
  // retry" error instead of the honest empty state the desktop dashboard shows.
  // Treat 404 as null (empty); only real failures (5xx/network) throw.
  if (!r.ok) {
    if (r.status === 404) return null;
    throw new Error(`lantern_${r.status}`);
  }
  return r.json();
}

type RecentRow = { root: string; time: string };
async function fetchRecent(): Promise<RecentRow[]> {
  const r = await fetch('/api/reserves/recent?window=24h');
  if (!r.ok) return [];
  const j = await r.json();
  // /api/reserves/recent returns { rootHash, attestationTime } (a preformatted
  // string), not the latest endpoint's { root, timestamp }. Map to the row shape
  // the list renders so `a.root.slice()` never reads undefined.
  return (j.attestations ?? []).map(
    (a: { rootHash?: string; root?: string; attestationTime?: string }) => ({
      root: a.rootHash ?? a.root ?? '0x',
      time: a.attestationTime ?? '',
    }),
  );
}

// Redeemable = Coffer.totalAssets() (what backs every share right now), read by
// the summary route independently of Scribe. The desktop reserves page shows
// this as its headline stat; the mobile panel was omitting it. Honest null when
// the vault is undeployed or the read reverts.
async function fetchSummary(): Promise<{ redeemableUsd: string | null }> {
  const r = await fetch('/api/reserves/summary');
  if (!r.ok) return { redeemableUsd: null };
  return r.json();
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function ReservesMobile() {
  const { address } = useAccount();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['lantern-latest-mobile'],
    queryFn: fetchLatest,
    refetchInterval: 60_000,
  });
  const recent = useQuery({
    queryKey: ['lantern-recent-mobile'],
    queryFn: fetchRecent,
    refetchInterval: 60_000,
  });
  const summary = useQuery({
    queryKey: ['reserves-summary-mobile'],
    queryFn: fetchSummary,
    refetchInterval: 60_000,
  });

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [proofResult, setProofResult] = useState<'idle' | 'verifying' | 'verified' | 'absent' | 'error' | 'not_pinned'>('idle');
  const [copied, setCopied] = useState(false);

  const copyRoot = useCallback(async () => {
    if (!data?.root) return;
    // clipboard.writeText rejects on denied permission / insecure context /
    // some mobile browsers; an unhandled rejection was surfacing as a page
    // error (interactive-sweep 2026-06-02). Guard + fall back to a hidden
    // textarea + execCommand so the copy still works and never throws.
    try {
      await navigator.clipboard.writeText(data.root);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = data.root;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        return; // copy genuinely unavailable; don't flash a false "copied"
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [data?.root]);

  async function verifyMyBalance() {
    if (!address) return;
    // Honest not-pinned state instead of opening a blank sheet: the on-chain
    // root can exist while the leaf tree is unpinned (attestor without
    // WEB3_STORAGE), and inclusion needs the tree. Mirrors the desktop fix.
    if (!data?.ipfsCid) { setProofResult('not_pinned'); return; }
    setProofResult('verifying');
    try {
      const r = await fetch('/api/lantern/verify-inclusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: data.root, ipfsCid: data.ipfsCid, wallet: address }),
      });
      if (!r.ok) { setProofResult('error'); return; }
      const j = await r.json();
      setProofResult(j.ok ? 'verified' : 'absent');
    } catch {
      setProofResult('error');
    }
  }

  // Error state (distinct from empty, E2E-46)
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-12">
        <p className="text-[16px] text-neg">Could not load, retry</p>
        <button onClick={() => refetch()} className="min-h-[44px] min-w-[44px] rounded-xl bg-mob-bg-card border border-mob-line px-6 text-[16px] text-mob-ink">
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <MobileReservesHeader />
        <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <MobileReservesHeader />

      {/* Redeemable now (Coffer.totalAssets) - the headline PoR number. The
          desktop shows it prominently; the mobile panel was omitting it, so a
          phone user saw the proof structure but not what it backs. Honest "—"
          when the read reverts / vault undeployed, matching the summary route. */}
      <section className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">Redeemable now</p>
        <p className="mt-1 text-[26px] font-semibold text-mob-ink">
          {summary.data?.redeemableUsd ?? '—'}
        </p>
        <p className="mt-0.5 text-[11px] text-mob-muted">
          {summary.data?.redeemableUsd != null ? 'Coffer.totalAssets() · live read' : 'pending'}
        </p>
      </section>

      {/* Latest attestation card */}
      {data && (
        <section className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">Latest Merkle Root</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="font-mono text-[16px] text-mob-ink break-all">
              {data.root.slice(0, 6)}…{data.root.slice(-4)}
            </p>
            <button
              onClick={copyRoot}
              aria-label={copied ? 'Merkle root copied' : 'Copy Merkle root'}
              className="min-h-[44px] min-w-[44px] grid place-items-center text-mob-muted"
            >
              {copied ? '✓' : '⎘'}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[14px]">
            <div><span className="text-mob-muted">Block</span><br/><span className="text-mob-ink">{data.blockNumber}</span></div>
            <div><span className="text-mob-muted">Age</span><br/><span className="text-mob-ink">{timeAgo(data.timestamp)}</span></div>
            <div><span className="text-mob-muted">Leaves</span><br/><span className="text-mob-ink">{data.leafCount}</span></div>
            <div>
              <span className="text-mob-muted">IPFS</span><br/>
              {data.ipfsCid ? (
                <a href={`https://${data.ipfsCid}.ipfs.dweb.link/`} target="_blank" rel="noreferrer" className="text-mob-accent text-[14px]">
                  {data.ipfsCid.slice(0, 8)}… ↗
                </a>
              ) : (
                <span className="text-mob-muted text-[14px]">not pinned yet</span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Verify my balance button */}
      <button
        onClick={() => { setVerifyOpen(true); verifyMyBalance(); }}
        disabled={!address || !data}
        className="min-h-[44px] w-full rounded-xl bg-mob-accent text-[16px] font-medium text-mob-bg disabled:opacity-40"
      >
        {address ? 'Verify my balance' : 'Connect wallet to verify'}
      </button>

      {/* Verify sheet */}
      {verifyOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setVerifyOpen(false)}>
          <div className="w-full rounded-t-2xl bg-mob-bg px-4 pb-8 pt-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }} onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-mob-muted/40" />
            <h3 className="text-[18px] font-medium text-mob-ink">Balance Verification</h3>
            <div className="mt-4 text-[16px]">
              {proofResult === 'verifying' && <p className="text-mob-muted">Checking inclusion…</p>}
              {proofResult === 'verified' && <p className="text-live">✓ Your wallet is included in the latest Merkle tree</p>}
              {proofResult === 'absent' && <p className="text-testnet">Your wallet is not in this attestation tree</p>}
              {proofResult === 'not_pinned' && <p className="text-testnet">The attested leaf tree is not pinned to IPFS yet, so per-wallet inclusion can&apos;t be checked. The root above is on chain and verifiable now.</p>}
              {proofResult === 'error' && <p className="text-neg">Verification failed, IPFS gateway may be unreachable</p>}
            </div>
            <button onClick={() => setVerifyOpen(false)} className="mt-6 min-h-[44px] w-full rounded-xl border border-mob-line text-[16px] text-mob-ink">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Source pill */}
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-mob-hairline bg-mob-bg-elev px-2.5 py-1 font-mono text-[10px] text-mob-ink-soft">
          {recent.data?.length ? 'scribe' : 'pending'}
        </span>
      </div>

      {/* Recent attestations (24h) */}
      <section>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">Last 24h</p>
          <button onClick={() => recent.refetch()} className="min-h-[44px] min-w-[44px] text-[12px] text-mob-accent">
            Refresh
          </button>
        </div>
        {recent.error ? (
          <div className="mt-2 rounded-xl border border-neg/40 bg-neg/5 px-4 py-3">
            <p className="text-[16px] text-neg">Could not load, retry</p>
            <button onClick={() => recent.refetch()} className="mt-2 min-h-[44px] text-[14px] text-mob-accent">Retry</button>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {(recent.data ?? []).map((a, i) => (
              <li key={i} className="rounded-xl border border-mob-line bg-mob-bg-card px-4 py-3 text-[14px]">
                <span className="font-mono text-mob-ink">{a.root.slice(0, 10)}…{a.root.slice(-4)}</span>
                <span className="ml-2 text-mob-muted">{a.time}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MobileReservesHeader() {
  return (
    <header>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">Proof of reserves</p>
      <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-mob-ink">Lantern reserves</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-mob-muted">
        Latest attestation, Merkle root, and per-wallet proof status.
      </p>
    </header>
  );
}
