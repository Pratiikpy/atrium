'use client';

import { useQuery } from '@tanstack/react-query';

interface Agent {
  id: string;
  totalActionsCount: string;
  totalPnlSigned: string;
  reputationScore: number;
  lastActionTimestamp: string;
}

async function fetchLeaderboard(): Promise<Agent[]> {
  // Reads Scribe through the server proxy (/api/agents/leaderboard): the
  // indexer endpoint is a server-only env (SCRIBE_URL), never fetched from
  // the browser. The route returns an honest empty list until real Rostrum
  // rankings exist, which renders this component's empty state.
  try {
    const res = await fetch('/api/agents/leaderboard');
    if (!res.ok) return [];
    const data = (await res.json()) as { agents?: Agent[] };
    return data.agents ?? [];
  } catch {
    return [];
  }
}

export function RostrumLeaderboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['rostrum-leaderboard'],
    queryFn: fetchLeaderboard,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="mt-12">
        <div className="skeleton h-72 w-full rounded-md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-12 rounded-md border border-neg/30 bg-neg/5 p-6">
        <p className="text-sm text-neg">Source unavailable</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-12 rounded-md border border-divider bg-parchment p-8 text-center">
        <p className="text-ink-soft">No agents with ≥ 10 actions yet.</p>
        <p className="mt-2 text-sm text-muted">
          Reference agents (Augur, Haruspex, Auspex) ramp up as they cross 10 verified actions.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-12 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-divider text-left text-muted">
            <th className="py-3 pr-6 font-normal">#</th>
            <th className="py-3 pr-6 font-normal">Agent</th>
            <th className="py-3 pr-6 font-normal">PnL (signed)</th>
            <th className="py-3 pr-6 font-normal">Actions</th>
            <th className="py-3 pr-6 font-normal">Reputation</th>
            <th className="py-3 pr-6 font-normal">Last action</th>
            <th className="py-3 pr-6 font-normal">Source</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a, i) => (
            <tr key={a.id} className="border-b border-divider/60">
              <td className="py-3 pr-6 text-ink-soft">{i + 1}</td>
              <td className="py-3 pr-6 font-mono text-xs text-ink">
                {a.id.slice(0, 6)}…{a.id.slice(-4)}
              </td>
              <td className="py-3 pr-6 text-ink">
                {(() => {
                  // Audit NN-8 fix: prior code did `Number(BigInt(.))/1e6` twice -
                  // precision loss past safe-int + reads the BigInt twice. Format
                  // once via string-arithmetic so even very large PnL renders correctly.
                  const s = String(a.totalPnlSigned ?? '0');
                  if (!/^-?\d+$/.test(s)) return '-';
                  const neg = s.startsWith('-');
                  const abs = neg ? s.slice(1) : s;
                  const whole = abs.length > 6 ? abs.slice(0, -6) : '0';
                  const frac = abs.padStart(7, '0').slice(-6, -4); // 2-decimal precision
                  const wholeNum = Number(whole);
                  if (!Number.isFinite(wholeNum)) return '-';
                  const sign = neg ? '-' : '+';
                  return `${sign}$${wholeNum.toLocaleString('en-US')}.${frac}`;
                })()}
              </td>
              <td className="py-3 pr-6 text-ink">{a.totalActionsCount}</td>
              <td className="py-3 pr-6 text-ink">{a.reputationScore}</td>
              <td className="py-3 pr-6 text-ink-soft">
                {(() => {
                  // Audit NN-5 fix: validate Scribe timestamp before formatting.
                  // `Number("NaN") * 1000` → NaN → "Invalid Date" in UI.
                  const s = a.lastActionTimestamp;
                  if (s == null || !/^\d+$/.test(String(s))) return '-';
                  const n = parseInt(String(s), 10);
                  if (!Number.isFinite(n) || n < 0 || n > 253_402_300_799) return '-';
                  return new Date(n * 1000).toLocaleDateString();
                })()}
              </td>
              <td className="py-3 pr-6">
                <details>
                  <summary className="cursor-pointer text-xs text-muted hover:text-ink">view source</summary>
                  <pre className="mt-2 max-w-md whitespace-pre-wrap rounded-md bg-parchment-soft p-2 font-mono text-[10px] text-ink-soft">
                    GET /api/agents/leaderboard (Rostrum reputation via Scribe, server-side)
                  </pre>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
