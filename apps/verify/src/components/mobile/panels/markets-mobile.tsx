'use client';

/**
 * MarketsMobile, Mobile venue browser.
 * Reads canonical VENUES list. 44px touch targets, 88px cards, sheet modal on tap.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VENUES, type Venue } from '@/lib/venues';
import { useQuery } from '@tanstack/react-query';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

interface VenueStatus {
  id: string;
  status: 'live' | 'paused' | 'region-locked';
  tvl: string;
}

export function MarketsMobile() {
  const wallet = useScopedWallet();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Venue | null>(null);

  const { data: statuses, isLoading, error, refetch } = useQuery({
    queryKey: ['venue-statuses', wallet],
    queryFn: async (): Promise<VenueStatus[]> => {
      const r = await fetch(walletQuery('/api/protocol/venues', wallet));
      if (!r.ok) throw new Error(`venues_${r.status}`);
      const j = await r.json();
      return j.venues ?? VENUES.map(v => ({ id: v.id, status: 'live' as const, tvl: '-' }));
    },
    refetchInterval: 60_000,
  });

  // Error state (distinct from empty, E2E-47)
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

  const filtered = VENUES.filter(v =>
    v.label.toLowerCase().includes(search.toLowerCase()) ||
    v.shortLabel.toLowerCase().includes(search.toLowerCase())
  );

  function getStatus(id: string): VenueStatus | undefined {
    return statuses?.find(s => s.id === id);
  }

  return (
    <div className="flex flex-col gap-3" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search venues…"
        className="h-[44px] w-full rounded-xl border border-mob-line bg-mob-bg-card px-4 text-[16px] text-mob-ink placeholder:text-mob-muted focus:border-mob-accent focus:outline-none"
      />

      {/* Loading */}
      {isLoading && <div className="space-y-2">{[0,1,2,3].map(i => <div key={i} className="skeleton h-[88px] rounded-xl" />)}</div>}

      {/* Cards */}
      {!isLoading && filtered.map(venue => {
        const vs = getStatus(venue.id);
        return (
          <button
            key={venue.id}
            onClick={() => setSelected(venue)}
            className="flex h-[88px] w-full items-center gap-3 rounded-xl border border-mob-line bg-mob-bg-card px-4 text-left"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-mob-bg-elev text-[12px] font-medium text-mob-ink">
              {venue.shortLabel.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[16px] text-mob-ink">{venue.label}</p>
              <p className="text-[14px] text-mob-muted">TVL: {vs?.tvl ?? '-'}</p>
            </div>
            <StatusPill status={vs?.status ?? 'live'} />
            <span className="text-mob-muted text-[18px]">›</span>
          </button>
        );
      })}

      {/* Sheet modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setSelected(null)}>
          <div
            className="w-full rounded-t-2xl bg-mob-bg px-4 pb-8 pt-4"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-mob-muted/40" />
            <h3 className="text-[18px] font-medium text-mob-ink">{selected.label}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[14px]">
              <div><span className="text-mob-muted">Kind</span><br/><span className="text-mob-ink capitalize">{selected.kind}</span></div>
              <div><span className="text-mob-muted">Haircut</span><br/><span className="text-mob-ink">{(selected.haircutBps / 100).toFixed(1)}%</span></div>
              <div><span className="text-mob-muted">Venue ID</span><br/><span className="text-mob-ink">{selected.venueId}</span></div>
              <div><span className="text-mob-muted">Adapter</span><br/><span className="text-mob-ink">{selected.adapterSlug}</span></div>
            </div>
            {/* Audit fix (#70): these were dead buttons (no onClick). Now they
                navigate to the real trade / vault flows and close the sheet.
                The venue id is passed so the destination can preselect it. */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { const id = selected.id; setSelected(null); router.push(`/app/trade?venue=${id}` as never); }}
                className="min-h-[44px] flex-1 rounded-xl bg-mob-accent text-[16px] font-medium text-mob-bg"
              >
                Trade
              </button>
              <button
                onClick={() => { setSelected(null); router.push('/app/vault' as never); }}
                className="min-h-[44px] flex-1 rounded-xl border border-mob-line text-[16px] text-mob-ink"
              >
                Deposit
              </button>
            </div>
            <button onClick={() => setSelected(null)} className="mt-3 min-h-[44px] w-full text-[14px] text-mob-muted">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: 'live' | 'paused' | 'region-locked' }) {
  const styles = {
    live: 'border-live/30 text-live',
    paused: 'border-testnet/30 text-testnet',
    'region-locked': 'border-neg/30 text-neg',
  };
  return (
    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}
