'use client';

import type { TaxJurisdiction, TaxYear } from './tax-types';

const JURISDICTIONS: { id: TaxJurisdiction; label: string; form: string }[] = [
  { id: 'uk', label: 'United Kingdom', form: 'CGT · SA108' },
  { id: 'us', label: 'United States', form: 'Form 8949' },
  // Audit U-30 (corrects U-13): the upstream Tablet service exporter is
  // specifically German FIFO § 23 EStG, NOT EU-wide. Pre-U-30 the
  // verify-app sent `eu` to Tablet which rejected with 422 (Tablet's
  // jurisdiction enum is `uk/us/de`). Restored to `de` so the contract
  // round-trips end-to-end.
  { id: 'de', label: 'Germany', form: 'FIFO · § 23 EStG' },
];

const YEARS: TaxYear[] = ['2024', '2025', '2026'];

/**
 * Controlled jurisdiction + year selector for /app/tax.
 *
 * Pre-audit-U-13: this component held local state, so clicking a different
 * jurisdiction toggled the visual selection but did nothing to the stat
 * row, allowance bar, events table, or export buttons (which all
 * hardcoded `jurisdiction=uk&year=2026` in their fetch URLs).
 *
 * Now: state is owned by `<TaxView>` and passed down — every consumer
 * re-fetches when these change.
 */
export function TaxJurisdictionBar({
  jurisdiction,
  setJurisdiction,
  year,
  setYear,
}: {
  jurisdiction: TaxJurisdiction;
  setJurisdiction: (j: TaxJurisdiction) => void;
  year: TaxYear;
  setYear: (y: TaxYear) => void;
}) {
  const formLabel = JURISDICTIONS.find((j) => j.id === jurisdiction)?.form ?? '—';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-divider bg-parchment p-2">
      <div role="tablist" aria-label="Jurisdiction" className="flex gap-1">
        {JURISDICTIONS.map((j) => (
          <button
            key={j.id}
            type="button"
            role="tab"
            aria-selected={jurisdiction === j.id}
            onClick={() => setJurisdiction(j.id)}
            className={
              'rounded-md px-3 py-1.5 text-sm transition-colors ' +
              (jurisdiction === j.id ? 'bg-ink text-parchment' : 'text-ink-soft hover:bg-parchment-soft/60')
            }
          >
            {j.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div role="tablist" aria-label="Tax year" className="flex gap-1 rounded-md bg-parchment-soft/40 p-1">
          {YEARS.map((y) => (
            <button
              key={y}
              type="button"
              role="tab"
              aria-selected={year === y}
              onClick={() => setYear(y)}
              className={
                'rounded px-2.5 py-1 text-sm font-mono transition-colors ' +
                (year === y ? 'bg-ink text-parchment' : 'text-ink-soft hover:text-ink')
              }
            >
              {y}
            </button>
          ))}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          form · {formLabel}
        </span>
      </div>
    </div>
  );
}
