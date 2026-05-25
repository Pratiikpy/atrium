'use client';

import { useQuery } from '@tanstack/react-query';
import type { TaxJurisdiction, TaxYear } from './tax-types';

interface TaxSummary {
  totalProceedsUsd: string | null;
  costBasisUsd: string | null;
  realisedGainUsd: string | null;
  // Audit U-23: null when realisedGainUsd is null (consistency invariant).
  realisedGainDirection: 'up' | 'down' | 'flat' | null;
  taxOwedEstUsd: string | null;
  taxRate: string;
  source: 'scribe' | 'pending';
}

async function fetchSummary(jurisdiction: TaxJurisdiction, year: TaxYear): Promise<TaxSummary> {
  try {
    const r = await fetch(`/api/tax/summary?jurisdiction=${jurisdiction}&year=${year}`);
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return {
      totalProceedsUsd: null,
      costBasisUsd: null,
      realisedGainUsd: null,
      realisedGainDirection: null,
      taxOwedEstUsd: null,
      taxRate: '10%',
      source: 'pending',
    };
  }
}

export function TaxStatRow({
  jurisdiction,
  year,
}: {
  jurisdiction: TaxJurisdiction;
  year: TaxYear;
}) {
  // queryKey carries jurisdiction + year so changing the bar re-fetches
  // rather than showing stale data from a different jurisdiction.
  const { data } = useQuery({
    queryKey: ['tax-summary', jurisdiction, year],
    queryFn: () => fetchSummary(jurisdiction, year),
    refetchInterval: 5 * 60_000,
  });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="Total proceeds" value={data?.totalProceedsUsd ?? '—'} sub={`YTD ${year}`} />
      <Tile label="Cost basis" value={data?.costBasisUsd ?? '—'} sub={costBasisSub(jurisdiction)} />
      {/* Audit RRR-6 fix: prior code hardcoded `sub="below allowance"`
          regardless of the actual gain value. A user above the £3,000 UK CGT
          annual exempt amount still saw "below allowance" — misleading
          regulatory copy. Now: neutral "vs £3,000 allowance" reference; the
          actual position vs allowance comes from the AllowanceProgress
          component below, which has the live `pctUsed` from the API. */}
      <Tile
        label="Realised gain"
        value={data?.realisedGainUsd ?? '—'}
        sub={allowanceSub(jurisdiction)}
        accent={data?.realisedGainDirection === 'up' ? 'success' : data?.realisedGainDirection === 'down' ? 'danger' : 'ink'}
      />
      <Tile label="Tax owed · est" value={data?.taxOwedEstUsd ?? '—'} sub={`at ${data?.taxRate ?? '—'} basic rate`} />
    </div>
  );
}

// Jurisdiction-aware copy. The previous hardcoded "HMRC matching rule" /
// "vs £3,000 allowance" sub-text was UK-specific and rendered next to
// US/EU tiles too — misleading the user about which calculation method
// produced the number.
function costBasisSub(j: TaxJurisdiction): string {
  if (j === 'uk') return 'HMRC matching rule';
  if (j === 'us') return 'FIFO · IRS default';
  if (j === 'de') return 'FIFO · § 23 EStG';
  return 'jurisdiction default';
}
function allowanceSub(j: TaxJurisdiction): string {
  if (j === 'uk') return 'vs £3,000 allowance';
  if (j === 'us') return 'capital gains · LT / ST split applies';
  if (j === 'de') return '€1,000 Sparer-Freibetrag';
  return '—';
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: 'success' | 'danger' | 'ink' }) {
  const color = accent === 'success' ? 'text-live' : accent === 'danger' ? 'text-neg' : 'text-ink';
  return (
    <div className="rounded-md border border-divider bg-parchment p-4">
      <p className="text-[10px] uppercase tracking-wider text-label">{label}</p>
      <p className={'mt-2 font-mono text-2xl ' + color}>
        {accent === 'success' && value !== '—' ? '+ ' : ''}
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">{sub}</p>
    </div>
  );
}
