'use client';

/**
 * ActivityMobile, Mobile activity timeline.
 * Re-uses /api/portfolio/activity. Filter chips + vertical timeline.
 * 44px touch targets, 64px rows, pull-to-refresh via button.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { arbiscanTxUrl } from '@/lib/arbiscan';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

type Filter = 'all' | 'tx' | 'attestation' | 'mandate' | 'liquidation';

interface Activity {
  id: string;
  kind: 'tx' | 'attestation' | 'mandate' | 'liquidation';
  title: string;
  meta: string;
  timestamp: string;
  txHash?: string;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tx', label: 'Margin' },
  { key: 'attestation', label: 'Positions' },
  { key: 'mandate', label: 'Mandates' },
  { key: 'liquidation', label: 'Liquidations' },
];

export function ActivityMobile() {
  const wallet = useScopedWallet();
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['activity-mobile', wallet],
    queryFn: async () => {
      const r = await fetch(walletQuery('/api/portfolio/activity?limit=200', wallet));
      if (!r.ok) throw new Error(`activity_${r.status}`);
      return r.json() as Promise<{ activities: Activity[]; source: string }>;
    },
    refetchInterval: 30_000,
    enabled: wallet != null, // disconnected -> no authed fetch (no 401)
  });

  const filtered = (data?.activities ?? []).filter(a => filter === 'all' || a.kind === filter);

  // Error state (distinct from empty, E2E-48)
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

  return (
    <div className="flex flex-col gap-3" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-[44px] shrink-0 rounded-full border px-4 text-[14px] ${
              filter === f.key
                ? 'border-mob-accent bg-mob-accent/10 text-mob-accent'
                : 'border-mob-line text-mob-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Pull to refresh */}
      <button onClick={() => refetch()} className="min-h-[44px] self-center text-[12px] text-mob-accent">
        ↻ Refresh
      </button>

      {/* Loading */}
      {isLoading && <div className="space-y-2">{[0,1,2,3,4].map(i => <div key={i} className="skeleton h-[64px] rounded-xl" />)}</div>}

      {/* Empty state */}
      {!isLoading && !filtered.length && !error && (
        <div className="rounded-xl border border-mob-line bg-mob-bg-card px-4 py-12 text-center">
          <p className="text-[16px] text-mob-muted">No activity yet</p>
        </div>
      )}

      {/* Timeline */}
      {!isLoading && filtered.map(a => {
        const url = arbiscanTxUrl(a.txHash);
        return (
          <div key={a.id} className="flex h-[64px] items-center gap-3 rounded-xl border border-mob-line bg-mob-bg-card px-4">
            <KindIcon kind={a.kind} />
            <div className="flex-1 min-w-0">
              <p className="truncate text-[16px] text-mob-ink">{a.title}</p>
              <p className="truncate text-[12px] text-mob-muted">{a.timestamp}</p>
            </div>
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="min-h-[44px] min-w-[44px] grid place-items-center text-[12px] text-mob-accent">
                ↗
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function KindIcon({ kind }: { kind: Activity['kind'] }) {
  const colors = { tx: 'text-mob-ink', attestation: 'text-live', mandate: 'text-testnet', liquidation: 'text-neg' };
  return (
    <span className={`grid size-8 shrink-0 place-items-center rounded-full bg-mob-bg-elev text-[12px] ${colors[kind]}`}>
      {kind === 'tx' ? '↔' : kind === 'attestation' ? '◎' : kind === 'mandate' ? '⚿' : '⚡'}
    </span>
  );
}
