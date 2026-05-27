'use client';

import { useQuery } from '@tanstack/react-query';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';
import { VENUE_COUNT } from '@/lib/venues';

/**
 * Portfolio stat row — port of design/Atrium App.standalone.html#portfolio
 * top section. Four big stacked cards with Geist 500 bold-sans numbers
 * and concrete trader labels:
 *   - BUYING POWER       (PRIMARY) — at 3.0x portfolio margin
 *   - TOTAL COLLATERAL   — across N live venues
 *   - OPEN NOTIONAL      — % utilisation
 *   - P&L · 24H          — % on collateral (green/red)
 *
 * Pre-rewrite the labels were 'Total acct value / Total req margin / ...'
 * and the numbers rendered tiny on small cards. Design intent: this is
 * the trader's home page — every number must read at a glance.
 */
interface SummaryResponse {
  totalAccountValueUsd: string | null;
  totalRequiredMarginUsd: string | null;
  totalNotionalUsd: string | null;
  pnl24hUsd: string | null;
  pnl24hDirection: 'up' | 'down' | 'flat' | null;
  totalCollateralUsd?: string | null;
  buyingPowerUsd?: string | null;
  portfolioMarginMultiplier?: number | null;
  utilisationPct?: number | null;
  pnl24hPctOnCollateral?: number | null;
  source: 'plinth' | 'pending';
}

async function fetchSummary(wallet: string | null): Promise<SummaryResponse> {
  const r = await fetch(walletQuery('/api/portfolio/summary', wallet));
  if (!r.ok) throw new Error(`summary_${r.status}`);
  return r.json();
}

export function PortfolioStatRow() {
  const wallet = useScopedWallet();
  const { data, isLoading } = useQuery({
    queryKey: ['portfolio-summary', wallet],
    queryFn: () => fetchSummary(wallet),
    refetchInterval: 30_000,
  });

  // Derived sublines — fall back to honest pending state when live data
  // hasn't arrived. The card SHELLS render always so the layout shape
  // matches the design contract; only the numeric content swaps in.
  const sourceLive = data?.source === 'plinth';
  const marginX = data?.portfolioMarginMultiplier;
  const utilisation = data?.utilisationPct;
  const pnlPct = data?.pnl24hPctOnCollateral;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <BigStatCard
        label="Buying power"
        value={data?.buyingPowerUsd ?? data?.totalAccountValueUsd}
        sub={
          marginX != null
            ? `At ${marginX.toFixed(1)}× portfolio margin`
            : sourceLive
              ? 'Plinth · cross-product margin'
              : 'Plinth pending'
        }
        loading={isLoading}
        emphasis
      />
      <BigStatCard
        label="Total collateral"
        value={data?.totalCollateralUsd ?? null}
        sub={
          sourceLive
            ? `Across ${VENUE_COUNT} live venues`
            : 'Plinth pending'
        }
        loading={isLoading}
      />
      <BigStatCard
        label="Open notional"
        value={data?.totalNotionalUsd}
        sub={
          utilisation != null
            ? `${utilisation.toFixed(1)}% utilisation`
            : sourceLive
              ? 'No open positions yet'
              : 'Plinth pending'
        }
        loading={isLoading}
      />
      <BigStatCard
        label="P&L · 24h"
        value={data?.pnl24hUsd}
        sub={
          pnlPct != null
            ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% on collateral`
            : sourceLive
              ? 'No realised PnL yet'
              : 'Plinth pending'
        }
        loading={isLoading}
        direction={data?.pnl24hDirection}
      />
    </div>
  );
}

function BigStatCard({
  label,
  value,
  sub,
  loading,
  direction,
  emphasis = false,
}: {
  label: string;
  value: string | null | undefined;
  sub: string;
  loading: boolean;
  direction?: 'up' | 'down' | 'flat' | null;
  emphasis?: boolean;
}) {
  const display = loading ? null : value ?? '—';
  const valueColor =
    direction === 'up'
      ? 'oklch(0.58 0.13 145)'
      : direction === 'down'
        ? 'oklch(0.56 0.16 28)'
        : 'oklch(0.13 0.008 60)';

  return (
    <div
      className="rounded-lg border bg-parchment p-6"
      style={{
        borderColor: 'oklch(0.88 0.004 60)',
        boxShadow: emphasis
          ? '0 1px 2px oklch(0.13 0.008 60 / 0.04), 0 0 0 1px oklch(0.13 0.008 60 / 0.04)'
          : undefined,
      }}
    >
      <p
        className="font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: 'oklch(0.54 0.005 60)' }}
      >
        {label}
      </p>
      {loading ? (
        <div className="skeleton mt-3 h-10 w-44 rounded" />
      ) : (
        <p
          className="mt-3 font-medium leading-none"
          style={{
            fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
            fontSize: 'clamp(28px, 3.2vw, 42px)',
            letterSpacing: '-0.02em',
            color: valueColor,
            fontVariantNumeric: 'tabular-nums lining-nums',
          }}
        >
          {direction === 'up' && value ? '+ ' : ''}
          {display}
        </p>
      )}
      <p
        className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: 'oklch(0.54 0.005 60)' }}
      >
        {sub}
      </p>
    </div>
  );
}
