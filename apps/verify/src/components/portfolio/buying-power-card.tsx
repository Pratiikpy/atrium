'use client';

import { useQuery } from '@tanstack/react-query';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

interface BuyingPower {
  currentUsd: string | null;
  series: { ts: number; valueUsd: string }[];
  windowDays: number;
  source: 'plinth' | 'pending';
}

async function fetchBP(wallet: string | null): Promise<BuyingPower> {
  // Phase theta audit follow-up (2026-05-25): wire the connected wallet
  // through to the API. Pre-fix every render fetched the demo wallet's
  // buying power even when the user had their own wallet connected.
  const r = await fetch(walletQuery('/api/portfolio/buying-power?window=30d', wallet));
  if (!r.ok) throw new Error(`bp_${r.status}`);
  return r.json();
}

export function BuyingPowerCard() {
  const wallet = useScopedWallet();
  const { data, isLoading } = useQuery({
    queryKey: ['buying-power-30d', wallet],
    queryFn: () => fetchBP(wallet),
    refetchInterval: 60_000,
    // Don't fetch a wallet-scoped endpoint with no wallet: disconnected it 401s
    // (the demo fallback is off in prod) and logs a console error on every load.
    // No wallet -> render the guided empty state, never a 401.
    enabled: wallet != null,
  });

  return (
    <div className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="eyebrow">Buying power · 30 days</p>
          <p
            className="mt-1 font-sans font-medium text-ink"
            style={{
              fontSize: 28,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums lining-nums',
            }}
          >
            {isLoading ? <span className="skeleton inline-block h-8 w-40 rounded" /> : data?.currentUsd ?? '-'}
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          <PillTab label="1d" />
          <PillTab label="7d" />
          <PillTab label="30d" active />
        </div>
      </header>

      <div className="mt-6 h-32 overflow-hidden rounded-md bg-parchment-soft/40">
        <Sparkline series={data?.series} loading={isLoading} />
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-wider text-muted">
        {data?.source === 'plinth' ? 'from Plinth' : 'plinth pending'}
      </p>
    </div>
  );
}

function PillTab({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={
        'rounded-md px-2 py-1 transition-colors ' +
        (active ? 'bg-ink text-parchment' : 'text-muted hover:text-ink')
      }
    >
      {label}
    </span>
  );
}

// Audit VVV-1 fix: `series[].valueUsd` comes from `/api/portfolio/
// buying-power` which formats via the shared `formatUsd` helper (KK-3/4
// precision-preserving), producing strings like "$1,234.56" with the
// dollar sign AND thousands separators. Pre-fix `parseFloat("$1,234.56")`
// returned NaN because parseFloat stops at the leading `$`. Every min/max/
// y-coordinate became NaN → polyline points all rendered as "NaN,NaN" →
// **the sparkline never drew even when real data was present**.
// Strip non-numeric chars (keep `.` and `-`) before parseFloat.
function parseUsd(s: string): number {
  const cleaned = s.replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function Sparkline({ series, loading }: { series?: BuyingPower['series']; loading: boolean }) {
  if (loading) return <div className="size-full animate-pulse bg-divider-soft/30" />;
  if (!series || series.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-muted">
        Series populates once Plinth has at least one position
      </div>
    );
  }
  // Audit VVV-1: filter out any NaN values from malformed Scribe rows so
  // a single bad row doesn't poison max/min for the whole series.
  const values = series.map((p) => parseUsd(p.valueUsd)).filter((v) => Number.isFinite(v));
  if (values.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-muted">
        Series data malformed, refresh after the next Scribe tick
      </div>
    );
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const points = series
    .map((p, i) => {
      const v = parseUsd(p.valueUsd);
      if (!Number.isFinite(v)) return null;
      const x = (i / Math.max(1, series.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .filter((p): p is string => p !== null)
    .join(' ');
  // Audit P-10 fix: buying-power sparkline gets a descriptive label.
  const first = parseUsd(series[0].valueUsd);
  const last = parseUsd(series[series.length - 1].valueUsd);
  const delta = Number.isFinite(first) && Number.isFinite(last) ? last - first : 0;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const label = `30-day buying-power trend, ${values.length} data points, trend ${direction}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="size-full"
      role="img"
      aria-label={label}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="0.7" className="text-ink-soft" />
    </svg>
  );
}
