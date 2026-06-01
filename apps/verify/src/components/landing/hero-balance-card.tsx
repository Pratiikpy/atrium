'use client';

import { useQuery } from '@tanstack/react-query';
import { VENUE_COUNT } from '@/lib/venues';

interface HeroSummary {
  totalAccountValueUsd: string | null;
  totalRequiredMarginUsd: string | null;
  source: 'plinth' | 'pending';
}

interface ProtocolMetrics {
  // Iteration 35: was `venuesLive: { live, total }`. The count measures
  // deployment-registry presence, not on-chain `get_venue_health` status -
  // a deployed-but-broken adapter shouldn't show as "live." Renamed.
  // Iteration 39: `count` is now nullable, null when registry unreachable.
  venuesDeployed: { count: number | null; total: number };
  source: 'scribe' | 'pending';
}

async function fetchHero(): Promise<HeroSummary> {
  const r = await fetch('/api/portfolio/summary');
  if (!r.ok) return { totalAccountValueUsd: null, totalRequiredMarginUsd: null, source: 'pending' };
  const json = await r.json();
  return {
    totalAccountValueUsd: json.totalAccountValueUsd ?? null,
    totalRequiredMarginUsd: json.totalRequiredMarginUsd ?? null,
    source: json.source ?? 'pending',
  };
}

async function fetchMetrics(): Promise<ProtocolMetrics> {
  const r = await fetch('/api/protocol/metrics');
  // Iteration 39: was `count: 0`, fake-zero on fetch failure. Null = unknown.
  if (!r.ok) return { venuesDeployed: { count: null, total: VENUE_COUNT }, source: 'pending' };
  const json = await r.json();
  return {
    venuesDeployed: json.venuesDeployed ?? { count: null, total: VENUE_COUNT },
    source: json.source ?? 'pending',
  };
}

/**
 * Hero balance card, visual centerpiece of the landing hero. Matches the
 * `$12.3M` wallet preview in design/Atrium.html but renders live data from
 * Plinth via /api/portfolio/summary. When no data is available, shows
 * "pending Month 1 W2" honestly, never a placeholder number.
 *
 * Audit OO-1 + OO-2 + OO-3 fix:
 *   1. Account value fallback was `$0.00`. That looks identical to a real
 *      zero balance and violates the real-data discipline. Switched to '-'
 *      with a "pending" pill so the UI distinguishes "zero balance" from
 *      "we don't know yet".
 *   2. "Venues active" was hardcoded "0/6" with both branches of the
 *      ternary returning the same string. AND the total was 6, not the
 *      canonical 7 (VENUE_COUNT from `lib/venues.ts`). Now reads from
 *      `/api/protocol/metrics.venuesDeployed` (renamed iter 35 from
 *      `venuesLive` because the count measures deployment-registry
 *      presence, not on-chain `get_venue_health` operational status).
 *   3. The big number was labeled "Buying power" but actually displayed
 *      `totalAccountValueUsd`. Renamed to "Account value" so the label
 *      matches the underlying field. Real buying power is a derived value
 *      (collateral − required) not implemented yet, flagged honestly.
 */
export function HeroBalanceCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['hero-summary'],
    queryFn: fetchHero,
    refetchInterval: 60_000,
  });
  const { data: metrics } = useQuery({
    queryKey: ['hero-metrics'],
    queryFn: fetchMetrics,
    refetchInterval: 60_000,
  });
  // Iteration 39: was `count: 0`, fake-zero. Null = unknown when registry
  // unreachable; the render below switches to "- / N" instead of "0 / N".
  const venuesDeployed = metrics?.venuesDeployed ?? { count: null as number | null, total: VENUE_COUNT };

  return (
    <div className="rounded-xl border border-divider bg-parchment p-6 shadow-md md:p-8">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted">Wallet · live</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className="size-1.5 rounded-full bg-live" />
          arb-sepolia
        </span>
      </div>

      <p className="mt-4 text-[11px] uppercase tracking-wider text-muted">Account value</p>
      <p className="mt-1 font-mono text-4xl text-ink md:text-5xl">
        {isLoading
          ? <span className="skeleton inline-block h-12 w-48 rounded" />
          : data?.totalAccountValueUsd ?? '-'}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted">Required margin</dt>
          <dd className="mt-1 font-mono text-ink">
            {isLoading
              ? <span className="skeleton inline-block h-5 w-24 rounded" />
              : data?.totalRequiredMarginUsd ?? '-'}
          </dd>
        </div>
        <div>
          {/* Iteration 35: relabeled from "Venues active", the underlying
              count measures deployed adapters, not operationally healthy
              ones. "Active" implied liveness this metric doesn't verify. */}
          <dt className="text-[10px] uppercase tracking-wider text-muted">Venues deployed</dt>
          <dd className="mt-1 font-mono text-ink">
            {/* Iteration 39: render "-/7" not "0/7" when count is null.
                Pre-fix the registry-unreachable state silently displayed
                "0/7 deployed", a user during a registry-fetch outage
                would read it as a confirmed zero deployments. */}
            {venuesDeployed.count != null ? venuesDeployed.count : '-'}/{venuesDeployed.total}
          </dd>
        </div>
      </dl>

      <p className="mt-6 text-[10px] uppercase tracking-wider text-muted">
        {data?.source === 'plinth' ? 'Source: Plinth · live RPC' : 'Plinth pending · contracts deploy Month 1 W2'}
      </p>
    </div>
  );
}
