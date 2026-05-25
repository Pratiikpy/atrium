'use client';

import { useQuery } from '@tanstack/react-query';

interface SummaryResponse {
  totalAccountValueUsd: string | null;
  totalRequiredMarginUsd: string | null;
  totalNotionalUsd: string | null;
  pnl24hUsd: string | null;
  pnl24hDirection: 'up' | 'down' | 'flat' | null;
  source: 'plinth' | 'pending';
}

async function fetchSummary(): Promise<SummaryResponse> {
  const r = await fetch('/api/portfolio/summary');
  if (!r.ok) throw new Error(`summary_${r.status}`);
  return r.json();
}

export function PortfolioStatRow() {
  const { data, isLoading } = useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: fetchSummary,
    refetchInterval: 30_000,
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Total acct value"
        value={data?.totalAccountValueUsd}
        loading={isLoading}
        source={data?.source}
      />
      <StatTile
        label="Total req margin"
        value={data?.totalRequiredMarginUsd}
        loading={isLoading}
        source={data?.source}
      />
      <StatTile
        label="Total notional"
        value={data?.totalNotionalUsd}
        loading={isLoading}
        source={data?.source}
      />
      <StatTile
        label="24h PnL"
        value={data?.pnl24hUsd}
        loading={isLoading}
        source={data?.source}
        direction={data?.pnl24hDirection}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  loading,
  source,
  direction,
}: {
  label: string;
  value: string | null | undefined;
  loading: boolean;
  source?: 'plinth' | 'pending';
  direction?: 'up' | 'down' | 'flat' | null;
}) {
  const colorClass =
    direction === 'up' ? 'text-live' : direction === 'down' ? 'text-neg' : 'text-ink';
  const display = loading ? null : value ?? '—';
  return (
    <div className="rounded-md border border-divider bg-parchment p-4">
      <p className="text-[10px] uppercase tracking-wider text-label">{label}</p>
      {loading ? (
        <div className="skeleton mt-3 h-8 w-32 rounded" />
      ) : (
        <p className={`mt-2 font-mono text-2xl ${colorClass}`}>
          {direction === 'up' && value ? '+' : ''}
          {display}
        </p>
      )}
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">
        {source === 'plinth' ? 'from Plinth' : 'plinth pending'}
      </p>
    </div>
  );
}
