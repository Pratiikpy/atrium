'use client';

/**
 * TaxMobile, Mobile tax dashboard.
 * Jurisdiction selector, tax year, stats, events list, export buttons.
 * 44px touch targets, 16px body text.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TaxJurisdiction, TaxYear } from '@/components/tax/tax-types';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

interface TaxStats {
  realizedGains: string;
  unrealizedGains: string;
  allowanceUsed: string;
}

interface TaxEvent {
  id: string;
  date: string;
  asset: string;
  eventLabel: string;
  gainUsd: string;
  gainDirection: 'up' | 'down' | 'flat';
}

const JURISDICTIONS: { key: TaxJurisdiction; label: string }[] = [
  { key: 'uk', label: 'UK' },
  { key: 'de', label: 'DE' },
  { key: 'us', label: 'US' },
];

const YEARS: TaxYear[] = ['2026', '2025', '2024'];

export function TaxMobile() {
  const wallet = useScopedWallet();
  const [jurisdiction, setJurisdiction] = useState<TaxJurisdiction>('uk');
  const [year, setYear] = useState<TaxYear>('2026');
  const [limit, setLimit] = useState(50);

  const stats = useQuery({
    queryKey: ['tax-stats-mobile', jurisdiction, year, wallet],
    queryFn: async (): Promise<TaxStats> => {
      const r = await fetch(walletQuery(`/api/tax/stats?jurisdiction=${jurisdiction}&year=${year}`, wallet));
      if (!r.ok) throw new Error(`tax_stats_${r.status}`);
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const events = useQuery({
    queryKey: ['tax-events-mobile', jurisdiction, year, wallet],
    queryFn: async (): Promise<{ events: TaxEvent[] }> => {
      const r = await fetch(walletQuery(`/api/tax/events?jurisdiction=${jurisdiction}&year=${year}`, wallet));
      if (!r.ok) throw new Error(`tax_events_${r.status}`);
      return r.json();
    },
    refetchInterval: 60_000,
  });

  // Error state (distinct from empty, E2E-50)
  if (stats.error || events.error) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-12">
        <p className="text-[16px] text-neg">Could not load, retry</p>
        <button onClick={() => { stats.refetch(); events.refetch(); }} className="min-h-[44px] min-w-[44px] rounded-xl bg-mob-bg-card border border-mob-line px-6 text-[16px] text-mob-ink">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Jurisdiction selector */}
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-mob-line bg-mob-bg-card p-1">
        {JURISDICTIONS.map(j => (
          <button
            key={j.key}
            onClick={() => setJurisdiction(j.key)}
            className={`min-h-[44px] rounded-lg text-[16px] font-medium ${
              jurisdiction === j.key ? 'bg-mob-accent text-mob-bg' : 'text-mob-muted'
            }`}
          >
            {j.label}
          </button>
        ))}
      </div>

      {/* Year selector */}
      <div className="flex gap-2">
        {YEARS.map(y => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`min-h-[44px] rounded-full border px-4 text-[14px] ${
              year === y ? 'border-mob-accent text-mob-accent' : 'border-mob-line text-mob-muted'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Stats */}
      {stats.isLoading ? (
        <div className="skeleton h-20 rounded-xl" />
      ) : stats.data && (
        <section className="grid grid-cols-3 gap-2 rounded-xl border border-mob-line bg-mob-bg-card px-3 py-3">
          <div className="text-center">
            <p className="text-[10px] uppercase text-mob-muted">Realized</p>
            <p className="text-[16px] text-mob-ink">{stats.data.realizedGains}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-mob-muted">Unrealized</p>
            <p className="text-[16px] text-mob-ink">{stats.data.unrealizedGains}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-mob-muted">Allowance</p>
            <p className="text-[16px] text-mob-ink">{stats.data.allowanceUsed}</p>
          </div>
        </section>
      )}

      {/* Events list */}
      {events.isLoading ? (
        <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : (
        <>
          {(events.data?.events ?? []).slice(0, limit).map(e => (
            <div key={e.id} className="flex items-center gap-3 rounded-xl border border-mob-line bg-mob-bg-card px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="truncate text-[16px] text-mob-ink">{e.eventLabel} · {e.asset}</p>
                <p className="text-[12px] text-mob-muted">{e.date}</p>
              </div>
              <span className={`text-[16px] ${e.gainDirection === 'up' ? 'text-live' : e.gainDirection === 'down' ? 'text-neg' : 'text-mob-muted'}`}>
                {e.gainUsd}
              </span>
            </div>
          ))}
          {(events.data?.events ?? []).length > limit && (
            <button onClick={() => setLimit(l => l + 50)} className="min-h-[44px] text-[14px] text-mob-accent">
              Load more
            </button>
          )}
        </>
      )}

      {/* Export buttons */}
      <div className="flex flex-col gap-2">
        <a
          href={`/api/tax/export?format=csv&jurisdiction=${jurisdiction}&year=${year}`}
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-mob-line text-[16px] text-mob-ink"
        >
          Export CSV
        </a>
        <a
          href={`/api/tax/export?format=pdf&jurisdiction=${jurisdiction}&year=${year}`}
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-mob-line text-[16px] text-mob-ink"
        >
          Export PDF
        </a>
      </div>
    </div>
  );
}
