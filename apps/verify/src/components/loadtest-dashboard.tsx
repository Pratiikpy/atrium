'use client';

import { useQuery } from '@tanstack/react-query';

interface Metric {
  name: string;
  unit: string;
  p50: number;
  p95: number;
  p99: number;
  budget: number;
  source: string;
}

async function fetchMetrics(): Promise<Metric[]> {
  // Phase zeta.7 default: same-origin /api/loadtest/metrics serves the
  // nightly k6 + gas report from public/loadtest/latest.json. Operators
  // can still point NEXT_PUBLIC_LOADTEST_METRICS_URL at an external
  // dashboard endpoint to override.
  const url = process.env.NEXT_PUBLIC_LOADTEST_METRICS_URL ?? '/api/loadtest/metrics';
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    return (await r.json()) as Metric[];
  } catch {
    return [];
  }
}

export function LoadtestDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['loadtest-metrics'],
    queryFn: fetchMetrics,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="mt-12">
        <div className="skeleton h-72 rounded-md" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-12 rounded-md border border-divider bg-parchment p-8 text-center">
        <p className="text-ink-soft">No load-test runs yet.</p>
        <p className="mt-2 text-sm text-muted">
          The continuous loadtest runner starts Month 9 per <code>docs/ROADMAP.md</code>. Metrics
          will appear here as soon as the first run completes.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-12 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-divider text-left text-muted">
            <th className="py-3 pr-6 font-normal">Metric</th>
            <th className="py-3 pr-6 font-normal">Unit</th>
            <th className="py-3 pr-6 font-normal">P50</th>
            <th className="py-3 pr-6 font-normal">P95</th>
            <th className="py-3 pr-6 font-normal">P99</th>
            <th className="py-3 pr-6 font-normal">Budget</th>
            <th className="py-3 pr-6 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => {
            const over = m.p95 > m.budget;
            return (
              <tr key={m.name} className="border-b border-divider/60">
                <td className="py-3 pr-6 font-mono text-xs text-ink">{m.name}</td>
                <td className="py-3 pr-6 text-ink-soft">{m.unit}</td>
                <td className="py-3 pr-6 text-ink">{m.p50}</td>
                <td className="py-3 pr-6 text-ink">{m.p95}</td>
                <td className="py-3 pr-6 text-ink">{m.p99}</td>
                <td className="py-3 pr-6 text-ink-soft">{m.budget}</td>
                <td className={`py-3 pr-6 ${over ? 'text-danger' : 'text-success'}`}>
                  {over ? 'over' : 'within'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
