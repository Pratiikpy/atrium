'use client';

import { VENUES } from '@/lib/venues';

/**
 * Venue chip selector for the Trade view. Audit P-4 fix: list reads from
 * the canonical `VENUES` const in `@/lib/venues`. Adding a new venue is a
 * single-line change there, and every surface that counts venues
 * (landing copy, impluvium diagram, numbers section) stays in sync.
 *
 * Audit U-14: now a controlled component, parent TradeView owns the
 * active venue so OrderForm / OrderBook / MarginImpactPanel re-fetch
 * when the chip changes. Pre-fix the selection lived in local state and
 * had no effect on any sibling component.
 */
export function VenueChipBar({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Trading venue" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {VENUES.map((v) => {
        const isActive = active === v.id;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(v.id)}
            className={
              'rounded-md border p-3 text-left transition-colors ' +
              (isActive
                ? 'border-ink bg-ink text-parchment'
                : 'border-divider bg-parchment text-ink hover:border-ink/30')
            }
          >
            <p className="font-mono text-xs">{v.shortLabel}</p>
            <p className={'mt-1 text-[10px] ' + (isActive ? 'text-dark-white-55' : 'text-muted')}>
              {v.label}
            </p>
            <p className={'mt-2 text-[10px] uppercase tracking-wider ' + (isActive ? 'text-dark-white-55' : 'text-muted')}>
              haircut · {(v.haircutBps / 100).toFixed(1)}%
            </p>
          </button>
        );
      })}
    </div>
  );
}
