'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { TaxJurisdiction, TaxYear } from './tax-types';

// Reads the SAME /api/tax/summary query as TaxStatRow (shared queryKey, so the
// two cards share one request). Tablet computes the annual-allowance usage from
// the exact FIFO disposals behind the stat row, so used / total / remaining are
// real and in the jurisdiction's native currency.
//
// Pre-fix this card hit a separate /api/tax/allowance route that was hardcoded
// to `source: 'pending'` + a USD constant - so a UK user with live data still
// saw "SCRIBE PENDING" and a "$3,810" allowance next to a populated £ stat row.
interface AllowanceData {
  currency: string | null;
  allowanceTotal: string | null;
  allowanceUsed: string | null;
  allowanceRemaining: string | null;
  allowancePctUsed: number | null;
  source: 'tablet' | 'pending';
}

async function fetchSummary(jurisdiction: TaxJurisdiction, year: TaxYear): Promise<AllowanceData> {
  try {
    const r = await fetch(`/api/tax/summary?jurisdiction=${jurisdiction}&year=${year}`);
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return {
      currency: null,
      allowanceTotal: null,
      allowanceUsed: null,
      allowanceRemaining: null,
      allowancePctUsed: null,
      source: 'pending',
    };
  }
}

// Jurisdiction-aware annual-exemption copy. US has no general CGT exemption, so
// it shows an explanatory line instead of a 0-wide progress bar.
function exemption(j: TaxJurisdiction): { label: string; has: boolean } {
  if (j === 'uk') return { label: '£3,000 annual exempt amount · 2026/27 (HMRC HS283)', has: true };
  if (j === 'de') return { label: '€1,000 Sparer-Pauschbetrag', has: true };
  if (j === 'us') return { label: 'No annual exemption · capital gains taxed from the first dollar', has: false };
  return { label: 'Jurisdiction default', has: false };
}

export function TaxAllowanceProgress({
  jurisdiction,
  year,
}: {
  jurisdiction: TaxJurisdiction;
  year: TaxYear;
}) {
  const { isConnected } = useAccount();
  const { data } = useQuery({
    queryKey: ['tax-summary', jurisdiction, year],
    queryFn: () => fetchSummary(jurisdiction, year),
    refetchInterval: 5 * 60_000,
    enabled: isConnected,
  });
  const { label, has } = exemption(jurisdiction);
  const isPending = !data || data.source === 'pending';
  const pct = Math.max(0, Math.min(100, data?.allowancePctUsed ?? 0));

  return (
    <div className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-base text-ink">
          {year} CGT allowance · {jurisdiction.toUpperCase()}
        </p>
        {has && (
          <p className="font-mono text-sm text-ink">
            <span className="text-muted">{data?.allowanceUsed ?? '-'}</span>
            <span className="mx-1 text-muted">/</span>
            {data?.allowanceTotal ?? '-'}
          </p>
        )}
      </header>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">{label}</p>

      {has && (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-pill bg-divider-soft">
            <div className="h-full bg-ink transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
            <span>{data?.allowanceUsed ?? '-'} used</span>
            <span>{data?.allowanceRemaining ?? '-'} remaining</span>
          </div>
        </>
      )}

      {!isConnected ? (
        <p className="mt-3 text-[10px] uppercase tracking-wider text-muted">
          connect a wallet to see your allowance usage
        </p>
      ) : isPending ? (
        <p className="mt-3 text-[10px] uppercase tracking-wider text-muted">
          Tablet tax service syncing
        </p>
      ) : null}
    </div>
  );
}
