'use client';

import { useQuery } from '@tanstack/react-query';

interface Att {
  id: string;
  blockNumber: number;
  rootHash: string;
  leafCount: number;
  pinned: boolean;
  attestationTime: string;
  status: 'PASS' | 'PENDING';
}
interface Resp { attestations: Att[]; source: 'scribe' | 'pending'; }

async function fetchRecent(window: '24h' | '7d' | '30d'): Promise<Resp> {
  try {
    const r = await fetch(`/api/reserves/recent?window=${window}`);
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { attestations: [], source: 'pending' };
  }
}

export function RecentAttestationsTable({
  window = '24h',
}: {
  window?: '24h' | '7d' | '30d';
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['reserves-recent', window],
    queryFn: () => fetchRecent(window),
    refetchInterval: 60_000,
  });
  if (isLoading) {
    return <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="skeleton h-12 rounded-md" />)}</div>;
  }
  if (!data?.attestations.length) {
    return (
      <div className="rounded-md border border-divider bg-parchment-soft/40 p-12 text-center text-sm">
        <p className="text-ink-soft">No attestations yet.</p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
          {data?.source === 'pending' ? 'lantern attestor deploy month 6' : 'cron fires every hour'}
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-divider bg-parchment">
      <table className="w-full text-sm">
        <thead className="border-b border-divider">
          <tr className="text-left text-[10px] uppercase tracking-wider text-label">
            <th className="px-4 py-3 font-normal">Block</th>
            <th className="px-4 py-3 font-normal">Time</th>
            <th className="px-4 py-3 font-normal">Root</th>
            <th className="px-4 py-3 font-normal">Leaves</th>
            <th className="px-4 py-3 font-normal">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider-soft">
          {/* Key on blockNumber, not a.id: a.id is the Merkle root, which the
              Lantern attestor republishes unchanged every cron tick when reserves
              don't move, so two distinct attestations (different blocks/times)
              share a root and React warned "two children with the same key".
              Each attestation is its own block, so block+id is unique. */}
          {data.attestations.map((a) => (
            <tr key={`${a.blockNumber}-${a.id}`} className="hover:bg-parchment-soft/40">
              <td className="px-4 py-3 font-mono text-ink">{a.blockNumber}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted">{a.attestationTime}</td>
              <td className="px-4 py-3 font-mono text-xs text-ink-soft">{a.rootHash.slice(0,10)}…</td>
              <td className="px-4 py-3 font-mono text-ink-soft">{a.leafCount.toLocaleString('en-US')}</td>
              <td className="px-4 py-3">
                <span className={
                  'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ' +
                  (a.status === 'PASS' ? 'bg-live-soft text-live' : 'bg-testnet/10 text-testnet')
                }>
                  {a.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
