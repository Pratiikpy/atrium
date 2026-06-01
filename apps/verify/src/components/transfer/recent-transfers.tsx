'use client';

import { useQuery } from '@tanstack/react-query';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

interface Transfer {
  id: string;
  amount: string;
  asset: string;
  fromChain: string;
  toChain: string;
  /** null until per-row durations are wired (audit U-24). */
  duration: string | null;
  status: 'SETTLED' | 'IN_TRANSIT' | 'CLAIMED_BACK';
  timestamp: string;
}
interface ListResponse { transfers: Transfer[]; source: 'scribe' | 'pending'; }

async function fetchTransfers(wallet: string | null): Promise<ListResponse> {
  try {
    const r = await fetch(walletQuery('/api/transfer/recent', wallet));
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { transfers: [], source: 'pending' };
  }
}

export function RecentTransfers() {
  const wallet = useScopedWallet();
  const { data, isLoading } = useQuery({
    queryKey: ['transfers', wallet],
    queryFn: () => fetchTransfers(wallet),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="skeleton h-12 rounded-md" />)}</div>;
  }
  if (!data?.transfers.length) {
    return (
      <div className="rounded-md border border-divider bg-parchment-soft/40 p-12 text-center text-sm text-ink-soft">
        No transfers yet.
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
          {data?.source === 'pending' ? 'aqueduct deploy month 1 w2' : 'send your first one above'}
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {data.transfers.map((t) => (
        <li key={t.id} className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-3 rounded-md border border-divider bg-parchment px-4 py-3 hover:bg-parchment-soft/40">
          <div>
            <p className="font-mono text-sm text-ink">{t.amount} {t.asset}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">{t.fromChain} → {t.toChain}</p>
          </div>
          <span className="font-mono text-xs text-muted">{t.duration ?? '-'}</span>
          <span className="font-mono text-xs text-muted">{t.timestamp}</span>
          <span className="rounded-full border border-divider px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
            {t.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
