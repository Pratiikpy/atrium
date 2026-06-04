'use client';

import { useState } from 'react';
import { TaxJurisdictionBar } from './jurisdiction-bar';
import { TaxStatRow } from './stat-row';
import { TaxAllowanceProgress } from './allowance-progress';
import { TaxEventsTable } from './events-table';
import { TaxExportButtons } from './export-buttons';
import type { TaxJurisdiction, TaxYear } from './tax-types';
import { useScopedWallet } from '@/lib/use-scoped-wallet';

/**
 * Parent client view for /app/tax. Owns the (jurisdiction, year) filter
 * state so changing the bar actually re-queries every consumer below.
 *
 * Pre-audit-U-13: the jurisdiction bar held local state, no other
 * component read it. Stats / allowance / events / exports all hardcoded
 * `jurisdiction=uk&year=2026` in their URLs. Clicking UK/US/DE toggled
 * the visual selection but did nothing, classic dead-control bug.
 *
 * Owning both the header (with export CTAs) and the body lets a single
 * state source drive every downstream fetch + download URL.
 */
export function TaxView() {
  const wallet = useScopedWallet();
  const [jurisdiction, setJurisdiction] = useState<TaxJurisdiction>('uk');
  const [year, setYear] = useState<TaxYear>('2026');

  return (
    <>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Tax · Tablet</p>
          <h1 className="mt-1 font-display text-4xl italic tracking-tight text-ink">
            Realised gains, by jurisdiction
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Atrium computes your cost basis across every venue using the relevant jurisdiction&apos;s
            accounting method. Export signed by a Lantern Merkle root for auditor verification.
          </p>
        </div>
        <TaxExportButtons jurisdiction={jurisdiction} year={year} enabled={wallet != null} />
      </header>

      <section className="mt-6">
        <TaxJurisdictionBar
          jurisdiction={jurisdiction}
          setJurisdiction={setJurisdiction}
          year={year}
          setYear={setYear}
        />
      </section>

      <section className="mt-6">
        <TaxStatRow jurisdiction={jurisdiction} year={year} />
      </section>

      <section className="mt-6">
        <TaxAllowanceProgress jurisdiction={jurisdiction} year={year} />
      </section>

      <section className="mt-8">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl italic text-ink">Realised events</h2>
          <p className="text-[10px] uppercase tracking-wider text-muted">
            Sorted by date · newest first
          </p>
        </header>
        <TaxEventsTable jurisdiction={jurisdiction} year={year} />
      </section>
    </>
  );
}
