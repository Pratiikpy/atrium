'use client';

import type { TaxJurisdiction, TaxYear } from './tax-types';
import { useTaxExportReady } from '@/lib/use-tax-export-ready';

/**
 * Three export-format CTAs (CSV / PDF / Signed), matches the prototype's
 * view-actions slot. Props are jurisdiction + year so the download URL
 * reflects the user's selection from the jurisdiction bar.
 *
 * `signed` and `pdf` are accepted formats per /api/tax/export's enum gate
 * (csv / json / pdf, `signed` was the prototype's name for a JSON+Merkle
 * proof; the route exposes it under the `json` format with a signature
 * header). Keeping the prototype's three button labels for UI parity but
 * routing `signed` to `format=json` since that's the real enum value.
 */
export function TaxExportButtons({
  jurisdiction,
  year,
}: {
  jurisdiction: TaxJurisdiction;
  year: TaxYear;
}) {
  const base = `/api/tax/export?jurisdiction=${jurisdiction}&year=${year}`;
  const ready = useTaxExportReady();

  // Gate the export links until the endpoint can actually produce a file. While
  // the Tablet service is undeployed the route 503s, so a live <a download> would
  // hand the user an error blob. Render disabled chips + an honest reason instead.
  if (ready !== true) {
    const labels = ['CSV', 'PDF', 'Signed export'];
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {labels.map((l) => (
            <span
              key={l}
              aria-disabled="true"
              title="Exports become available once the Tablet service is live"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-divider bg-parchment-light px-3 py-2 text-sm text-muted opacity-50"
            >
              ⇣ {l}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted">
          {ready === null ? 'Checking export availability…' : 'Exports become available once the Tablet service is live (no realised events to export yet).'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`${base}&format=csv`}
        className="inline-flex items-center gap-1.5 rounded-md border border-divider bg-parchment-light px-3 py-2 text-sm text-ink hover:border-ink/30"
        download
      >
        ⇣ CSV
      </a>
      <a
        href={`${base}&format=pdf`}
        className="inline-flex items-center gap-1.5 rounded-md border border-divider bg-parchment-light px-3 py-2 text-sm text-ink hover:border-ink/30"
        download
      >
        ⇣ PDF
      </a>
      <a
        href={`${base}&format=json`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-sm font-medium text-parchment hover:bg-ink-dark"
        download
      >
        ⇣ Signed export
      </a>
    </div>
  );
}
