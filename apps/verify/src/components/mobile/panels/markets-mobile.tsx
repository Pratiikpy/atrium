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
  status: 'live' | 'pending' | 'paused' | 'region-locked';
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
      const r = await fetch(walletQuery('/api/protocol/subsystems', wallet));
      if (!r.ok) throw new Error(`venues_${r.status}`);
      const j = await r.json();
      // Audit fix (use-everything sweep 2026-06-02): this read `j.venues`, but
      // GET /api/protocol/subsystems returns `{ live: [...slugs] }` with no
      // `venues` key, so it ALWAYS fell through to the fallback and showed EVERY
      // venue as 'live' (wrong data presented as real). Derive each venue's
      // status from the real `live` slug set: live when its adapter is up, else
      // paused. TVL has no source in this route, so it stays an honest '-'.
      // Bug-hunt fix (2026-06-02): /api/protocol/subsystems returns registry keys
      // PREFIXED with 'adapter-' (e.g. 'adapter-hyperliquid'); matching the bare
      // adapterSlug never hit, so every venue fell to 'paused'. Check the prefixed
      // key first. TVL has no source in this route -> honest '-'.
      const liveSet = new Set<string>(Array.isArray(j.live) ? j.live : []);
      return VENUES.map((v) => {
        const deployed =
          liveSet.has(`adapter-${v.adapterSlug}`) || liveSet.has(v.adapterSlug) || liveSet.has(v.id);
        // Being in the live set only means the adapter CONTRACT is deployed.
        // Only Aave Horizon is openable today (operational); the rest are
        // deployed-but-scaffolded (open reverts), so they badge 'pending', not
        // 'live'. Otherwise every venue read as tradeable when 6 of 7 revert.
        const status: VenueStatus['status'] = !deployed ? 'paused' : v.operational ? 'live' : 'pending';
        return { id: v.id, status, tvl: '-' };
      });
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

      {/* No search matches: the filtered list otherwise rendered blank with no
          explanation when a search string matched zero venues (indistinguishable
          from a broken/empty page). */}
      {!isLoading && filtered.length === 0 && (
        <p className="rounded-xl border border-mob-line bg-mob-bg-card px-4 py-8 text-center text-[14px] text-mob-muted">
          No venues match “{search}”.
        </p>
      )}

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
            <StatusPill status={vs?.status ?? 'pending'} />
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
            {/* Show the operational status in the sheet too: the sheet covers the
                list's StatusPill, so a SOON (not-yet-openable) venue must read as
                SOON here before the user taps Trade and hits the gate on /app/trade. */}
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[18px] font-medium text-mob-ink">{selected.label}</h3>
              <StatusPill status={getStatus(selected.id)?.status ?? 'pending'} />
            </div>
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

function StatusPill({ status }: { status: 'live' | 'pending' | 'paused' | 'region-locked' }) {
  const styles = {
    live: 'border-live/30 text-live',
    pending: 'border-testnet/30 text-testnet',
    paused: 'border-testnet/30 text-testnet',
    'region-locked': 'border-neg/30 text-neg',
  };
  // 'pending' = adapter deployed but not yet openable (scaffold); show "SOON"
  // in the testnet/amber color so it never reads as a green tradeable "LIVE".
  const label = status === 'pending' ? 'soon' : status;
  return (
    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-wider ${styles[status]}`}>
      {label}
    </span>
  );
}
