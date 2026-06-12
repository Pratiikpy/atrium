'use client';

import { useQuery } from '@tanstack/react-query';

interface Summary {
  tvlUsd: string | null;
  /** Coffer.totalAssets() - the underlying USDC redeemable right now. */
  redeemableUsd: string | null;
  lastAttestedTvlUsd: string | null;
  lastAttestedAgo: string;
  leafCount: number | null;
  /** Server-computed: attestation is older than 2× hourly cadence + grace. */
  isStale: boolean;
  /** Human-readable reason when isStale=true. null when fresh. */
  staleReason: string | null;
  staleThresholdMin: number;
  source: 'scribe' | 'pending';
}

async function fetchSummary(): Promise<Summary> {
  try {
    const r = await fetch('/api/reserves/summary');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    // Honesty contract (iteration 34): unknown freshness → render as stale.
    // The alternative, defaulting to isStale=false on fetch failure, would
    // show green on the dashboard during an outage of the verify-app itself,
    // exactly when an operator most needs the truth.
    return {
      tvlUsd: null,
      redeemableUsd: null,
      lastAttestedTvlUsd: null,
      lastAttestedAgo: 'pending',
      leafCount: null,
      isStale: true,
      staleReason: 'verify-app could not reach its own /api/reserves/summary',
      staleThresholdMin: 130,
      source: 'pending',
    };
  }
}

export function ReservesStatRow() {
  const { data } = useQuery({ queryKey: ['reserves-summary'], queryFn: fetchSummary, refetchInterval: 60_000 });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="Redeemable now" value={data?.redeemableUsd ?? '-'} sub="live on-chain balance" />
      <Tile label="Last attested" value={data?.lastAttestedTvlUsd ?? '-'} sub="last on-chain attestation" />
      <Tile
        label="Last attestation"
        value={data?.lastAttestedAgo ?? '-'}
        sub={
          data?.isStale
            ? `STALE · ${data.staleReason ?? 'past freshness threshold'}`
            : 'every ~45 min'
        }
        // Iteration 34: visual flag when stale. The cadence sub-label flips to
        // STALE + reason when isStale, so freshness is explicit rather than
        // implicit. Cadence ~45 min mirrors lantern-cron.yml `sleep 2700`.
        warn={data?.isStale === true}
      />
      <Tile label="Leaves in tree" value={data?.leafCount?.toLocaleString('en-US') ?? '-'} sub="one per Coffer balance" />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  warn?: boolean;
}) {
  return (
    <div
      className={
        warn
          ? 'rounded-md border border-testnet/40 bg-testnet/5 p-4'
          : 'rounded-md border border-divider bg-parchment p-4'
      }
    >
      <p className="text-[10px] uppercase tracking-wider text-label">{label}</p>
      <p className={'mt-2 font-mono text-2xl ' + (warn ? 'text-testnet' : 'text-ink')}>{value}</p>
      <p
        className={
          'mt-1 text-[10px] uppercase tracking-wider ' + (warn ? 'text-testnet' : 'text-muted')
        }
      >
        {sub}
      </p>
    </div>
  );
}
