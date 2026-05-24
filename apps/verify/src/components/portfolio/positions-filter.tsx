'use client';

import { useState } from 'react';
import { OpenPositionsTable } from './open-positions-table';
import { VENUES } from '@/lib/venues';

/**
 * Open-positions filter pills + the table. Audit P-11 fix: prior version
 * had HL / Aave / PMK pills that did nothing. Now selecting a pill filters
 * the table client-side (the table itself remains driven by the API; we
 * just hide rows that don't match). Pills are derived from VENUES so the
 * list stays in sync with the canonical venue config.
 */
const SHORTLIST = ['hyperliquid', 'aave-horizon', 'pendle-v2', 'polymarket'] as const;

export function PositionsFilter() {
  const [active, setActive] = useState<'all' | string>('all');
  const visibleVenues = VENUES.filter((v) => (SHORTLIST as readonly string[]).includes(v.id));
  return (
    <div>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl italic text-ink">Open positions</h2>
        <div className="flex flex-wrap gap-1 text-xs">
          <PillButton label="All" active={active === 'all'} onClick={() => setActive('all')} />
          {visibleVenues.map((v) => (
            <PillButton
              key={v.id}
              label={v.shortLabel}
              active={active === v.id}
              onClick={() => setActive(v.id)}
            />
          ))}
        </div>
      </header>
      <OpenPositionsTable filterVenueId={active === 'all' ? null : findVenueId(active)} />
    </div>
  );
}

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-md px-2 py-1 transition-colors ' +
        (active ? 'bg-ink text-parchment' : 'text-muted hover:bg-parchment-soft/60 hover:text-ink')
      }
    >
      {label}
    </button>
  );
}

function findVenueId(slug: string): number | null {
  return VENUES.find((v) => v.id === slug)?.venueId ?? null;
}
