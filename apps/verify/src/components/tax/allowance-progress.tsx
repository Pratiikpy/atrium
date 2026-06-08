'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { TaxJurisdiction, TaxYear } from './tax-types';

interface Allowance {
  jurisdictionLabel: string;
  yearLabel: string;
  usedUsd: string | null;
  remainingUsd: string | null;
  totalUsd: string | null;
  pctUsed: number | null;
  source: 'scribe' | 'pending';
}

// Audit RRR-5 fix: the catch block previously hardcoded `usedUsd: '$0'`,
// `remainingUsd: '$3,820'`, `totalUsd: '$3,820'`, `pctUsed: 0`. UI then
// rendered "$0 used / $3,820 total · 0% used" *as if real*, even though
// the user may have already used part of their allowance. Protocol safety rule:
// line: "never display a placeholder number that looks real". Now: API
// failure returns user-specific values as null + source='pending'; the
// component renders honest "-" sentinels + a pending notice.
async function fetchAllowance(jurisdiction: TaxJurisdiction, year: TaxYear): Promise<Allowance> {
  try {
    const r = await fetch(`/api/tax/allowance?jurisdiction=${jurisdiction}&year=${year}`);
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return {
      jurisdictionLabel: `${year} allowance · ${jurisdiction.toUpperCase()}`,
      yearLabel: year,
      usedUsd: null,
      remainingUsd: null,
      totalUsd: null,
      pctUsed: null,
      source: 'pending',
    };
  }
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
    queryKey: ['tax-allowance', jurisdiction, year],
    queryFn: () => fetchAllowance(jurisdiction, year),
    refetchInterval: 5 * 60_000,
    // Gate on connection like TaxStatRow: a disconnected page must not show a
    // user-specific "$0 used" next to the stat row's "-" realised gain (usage
    // is unknowable without the gain). The published allowance constant below
    // still renders; only the per-user usage waits for a wallet.
    enabled: isConnected,
  });
  const isPending = data?.source === 'pending' || data?.usedUsd == null;
  return (
    <div className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-base text-ink">{data?.jurisdictionLabel ?? 'CGT allowance'}</p>
        <p className="font-mono text-sm text-ink">
          <span className="text-muted">{data?.usedUsd ?? '-'}</span>
          <span className="mx-1 text-muted">/</span>
          {data?.totalUsd ?? '-'}
        </p>
      </header>
      {/* £3,000 is a public legal constant (UK Treasury 2026/27 CGT annual
          exempt amount). Showing the user's USED/REMAINING numbers when the
          API is unreachable would be the misleading part, fixed above. */}
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">
        Annual allowance · £3,000 {data?.totalUsd ? `(${data.totalUsd} equiv)` : '(equiv pending FX)'}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-pill bg-divider-soft">
        <div
          className="h-full bg-ink transition-all"
          style={{ width: `${Math.max(0, Math.min(100, data?.pctUsed ?? 0))}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
        <span>$0</span>
        <span>{data?.remainingUsd ?? '-'} · annual allowance</span>
      </div>
      {!isConnected ? (
        <p className="mt-3 text-[10px] uppercase tracking-wider text-muted">
          connect a wallet to see your allowance usage
        </p>
      ) : isPending ? (
        <p className="mt-3 text-[10px] uppercase tracking-wider text-muted">
          scribe pending · Tablet tax service syncing
        </p>
      ) : null}
    </div>
  );
}
