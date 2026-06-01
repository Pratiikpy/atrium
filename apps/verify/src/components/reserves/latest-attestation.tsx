'use client';

import { useQuery } from '@tanstack/react-query';

interface VenueLine { venue: string; balance: string; }
interface Latest {
  root: string | null;
  ipfsCid: string | null;
  blockNumber: number | null;
  timestampIso: string | null;
  venueBreakdown: VenueLine[];
  source: 'scribe' | 'pending';
}

async function fetchLatest(): Promise<Latest> {
  try {
    const r = await fetch('/api/lantern/latest');
    if (!r.ok) throw new Error();
    const j = await r.json();
    if ('exists' in j && j.exists === false) {
      return { root: null, ipfsCid: null, blockNumber: null, timestampIso: null, venueBreakdown: [], source: 'pending' };
    }
    return {
      root: j.root,
      ipfsCid: j.ipfsCid,
      blockNumber: j.blockNumber,
      timestampIso: j.timestamp ? new Date(j.timestamp * 1000).toISOString() : null,
      venueBreakdown: [],
      source: 'scribe',
    };
  } catch {
    return { root: null, ipfsCid: null, blockNumber: null, timestampIso: null, venueBreakdown: [], source: 'pending' };
  }
}

export function LatestAttestationCard() {
  const { data } = useQuery({ queryKey: ['lantern-latest-detail'], queryFn: fetchLatest, refetchInterval: 60_000 });
  return (
    <section className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-xl italic text-ink">Latest attestation</p>
        <span className="font-mono text-[10px] text-muted">
          {data?.blockNumber ? `block ${data.blockNumber}` : 'pending'}
        </span>
      </header>

      <div className="mt-3 rounded-md bg-parchment-soft/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-muted">Merkle root</p>
        <p className="mt-1 break-all font-mono text-xs text-ink">
          {data?.root ?? '0x… (pending Lantern attestor cron)'}
        </p>
      </div>

      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
        <div className="rounded-md border border-divider px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-muted">IPFS CID</p>
          <p className="mt-1 break-all font-mono text-ink">
            {data?.ipfsCid ? data.ipfsCid : '-'}
          </p>
        </div>
        <div className="rounded-md border border-divider px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-muted">Signed</p>
          <p className="mt-1 font-mono text-ink">
            {data?.timestampIso ? new Date(data.timestampIso).toLocaleString() : '-'}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[10px] uppercase tracking-wider text-muted">Venue breakdown</p>
      {data?.venueBreakdown.length ? (
        <ul className="mt-2 space-y-1.5 font-mono text-xs">
          {data.venueBreakdown.map((v) => (
            <li key={v.venue} className="flex justify-between">
              <span className="text-muted">{v.venue}</span>
              <span className="text-ink">{v.balance}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted">Per-venue breakdown lands once Lantern indexes Coffer + adapter balances.</p>
      )}
    </section>
  );
}
