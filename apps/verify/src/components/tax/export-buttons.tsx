'use client';

import type { TaxJurisdiction, TaxYear } from './tax-types';

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
