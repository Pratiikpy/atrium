'use client';

import { useQuery } from '@tanstack/react-query';
import { VENUE_COUNT } from '@/lib/venues';

interface ProtocolMetrics {
  testnetTvlUsd: string | null;
  testnetTvlDelta30d: string | null;
  registeredAgents: number | null;
  agentsWithOpenPositions: number | null;
  codex24hQueries: number | null;
  // Iteration 35: was `venuesLive: { live, total }`. The count is derived
  // from the deployments registry, adapters with a non-zero contract
  // address, NOT from on-chain `get_venue_health()` reads. Renamed to
  // `venuesDeployed` so the field name matches what it actually counts.
  // Iteration 39: `count` is now `number | null`, null when the registry
  // is unreachable. UI renders "-" for null instead of fake-zero.
  venuesDeployed: { count: number | null; total: number };
  source: 'scribe' | 'pending';
}

async function fetchMetrics(): Promise<ProtocolMetrics> {
  try {
    const r = await fetch('/api/protocol/metrics');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return {
      testnetTvlUsd: null,
      testnetTvlDelta30d: null,
      registeredAgents: null,
      agentsWithOpenPositions: null,
      codex24hQueries: null,
      // Iteration 39: was `count: 0` in client catch, fake-zero pattern.
      venuesDeployed: { count: null, total: VENUE_COUNT },
      source: 'pending',
    };
  }
}

export function NumbersSection() {
  const { data, isLoading } = useQuery({ queryKey: ['protocol-metrics'], queryFn: fetchMetrics, refetchInterval: 60_000 });
  return (
    <section className="numbers border-t border-divider bg-parchment-light">
      <div className="mx-auto grid max-w-6xl gap-px bg-divider px-px md:grid-cols-4">
        <Cell
          label="Live testnet TVL"
          value={isLoading ? null : data?.testnetTvlUsd}
          sub={data?.testnetTvlDelta30d ? `${data.testnetTvlDelta30d} vs 30d ago` : 'tvl pending'}
        />
        <Cell
          label="Registered agents"
          value={isLoading ? null : data?.registeredAgents?.toString() ?? null}
          sub={data?.agentsWithOpenPositions != null ? `${data.agentsWithOpenPositions} with open positions` : 'erc-8004 registry pending'}
        />
        <Cell
          label="Codex queries · 24h"
          value={isLoading ? null : data?.codex24hQueries?.toLocaleString('en-US') ?? null}
          sub="x402 micropayments"
        />
        <Cell
          // Iteration 35 audit fix: was "Venue adapters live" which conflated
          // "deployed on-chain" with "operationally healthy." The metric
          // measures deployment-registry presence, not get_venue_health
          // status. Renamed so users aren't misled.
          label="Venue adapters deployed"
          // Iteration 39: render "- / 7" instead of "0 / 7" when count is
          // null (registry unreachable). Distinguishes measured-zero from
          // couldn't-measure at the visible-text level.
          value={
            data?.venuesDeployed?.count != null
              ? `${data.venuesDeployed.count} / ${data.venuesDeployed.total}`
              : `- / ${data?.venuesDeployed?.total ?? VENUE_COUNT}`
          }
          sub="contracts ship Month 1 W2"
        />
      </div>
    </section>
  );
}

function Cell({ label, value, sub }: { label: string; value: string | null | undefined; sub: string }) {
  return (
    <div className="bg-parchment-light p-8 md:p-10">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-3 font-display text-4xl italic text-ink md:text-5xl">
        {value ?? '-'}
      </p>
      <p className="mt-2 text-xs text-muted">{sub}</p>
    </div>
  );
}
