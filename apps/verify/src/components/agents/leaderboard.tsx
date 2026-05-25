'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

interface Agent {
  rank: number;
  ens: string;
  status: 'running' | 'paused' | 'revoked';
  strategy: string;
  pnl7dBps: number;
  pnl7dDirection: 'up' | 'down' | 'flat';
  sharpe: number;
  aumUsd: string;
  copiers: number;
  sparkline7d: number[];
}
interface Resp { agents: Agent[]; source: 'rostrum' | 'pending'; }

type SortKey = 'pnl' | 'sharpe' | 'aum';

async function fetchAgents(): Promise<Resp> {
  try {
    const r = await fetch('/api/agents/leaderboard');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { agents: [], source: 'pending' };
  }
}

export function AgentLeaderboard() {
  const [sortKey, setSortKey] = useState<SortKey>('pnl');
  const { data, isLoading } = useQuery({ queryKey: ['agent-leaderboard'], queryFn: fetchAgents, refetchInterval: 60_000 });

  if (isLoading) {
    return <div className="space-y-2 pt-4">{[0,1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-md" />)}</div>;
  }
  if (!data?.agents.length) {
    return (
      <div className="mt-6 rounded-md border border-divider bg-parchment-soft/40 p-12 text-center text-sm">
        <p className="text-ink-soft">No agents indexed yet.</p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
          {data?.source === 'pending' ? 'rostrum deploy month 6' : 'leaderboard updates every 60s'}
        </p>
      </div>
    );
  }

  // Audit U-12: real sort against returned rows. Prototype had three
  // "P&L / Sharpe / AUM" tabs as styled <span>s with no handler. Now
  // they're real buttons, controlled by `sortKey`. aumUsd is a string
  // like "$1.2M" so we parse it numerically; rows we can't parse fall
  // to the end rather than crashing the sort.
  const sortedAgents = [...data.agents].sort((a, b) => {
    if (sortKey === 'pnl') return b.pnl7dBps - a.pnl7dBps;
    if (sortKey === 'sharpe') return b.sharpe - a.sharpe;
    return parseAumUsd(b.aumUsd) - parseAumUsd(a.aumUsd);
  });

  return (
    <>
      <header className="flex flex-wrap items-baseline justify-between gap-3 pt-4">
        <div>
          <p className="font-medium text-ink">Rostrum · top agents · 7d</p>
          <p className="text-[10px] uppercase tracking-wider text-muted">
            {data.agents.length} agents · sorted by 7-day P&L
          </p>
        </div>
        <div role="tablist" aria-label="Sort leaderboard" className="flex gap-1 text-xs">
          <SortTab label="P&L" sortKey="pnl" active={sortKey} onSelect={setSortKey} />
          <SortTab label="Sharpe" sortKey="sharpe" active={sortKey} onSelect={setSortKey} />
          <SortTab label="AUM" sortKey="aum" active={sortKey} onSelect={setSortKey} />
        </div>
      </header>

      <div className="mt-4 overflow-x-auto rounded-md border border-divider bg-parchment">
        <table className="w-full text-sm">
          <thead className="border-b border-divider">
            <tr className="text-left text-[10px] uppercase tracking-wider text-label">
              <th className="px-4 py-3 font-normal">#</th>
              <th className="px-4 py-3 font-normal">Agent</th>
              <th className="px-4 py-3 font-normal">Strategy</th>
              <th className="px-4 py-3 font-normal">30d</th>
              <th className="px-4 py-3 font-normal">7d P&L</th>
              <th className="px-4 py-3 font-normal">Sharpe</th>
              <th className="px-4 py-3 font-normal">AUM</th>
              <th className="px-4 py-3 font-normal">Copiers</th>
              <th className="px-4 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider-soft">
            {sortedAgents.map((a) => (
              <tr key={a.ens} className="hover:bg-parchment-soft/40">
                <td className="px-4 py-3 font-mono text-xs text-muted">{a.rank.toString().padStart(2, '0')}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-ink">{a.ens}</span>
                    <span
                      className={
                        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider ' +
                        (a.status === 'running'
                          ? 'text-live'
                          : a.status === 'paused'
                          ? 'text-testnet'
                          : 'text-muted')
                      }
                    >
                      <span className={'size-1.5 rounded-full ' + (a.status === 'running' ? 'bg-live' : a.status === 'paused' ? 'bg-testnet' : 'bg-muted')} />
                      {a.status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">{a.strategy}</td>
                <td className="px-4 py-3">
                  <Sparkline series={a.sparkline7d} direction={a.pnl7dDirection} />
                </td>
                <td className={
                  'px-4 py-3 font-mono ' +
                  (a.pnl7dDirection === 'up' ? 'text-live' : a.pnl7dDirection === 'down' ? 'text-neg' : 'text-ink')
                }>
                  {a.pnl7dDirection === 'up' && '+'}
                  {(a.pnl7dBps / 100).toFixed(2)}%
                </td>
                <td className="px-4 py-3 font-mono text-ink-soft">{a.sharpe.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-ink">{a.aumUsd}</td>
                <td className="px-4 py-3 font-mono text-ink-soft">{a.copiers}</td>
                <td className="px-4 py-3 text-right">
                  {/* Phase theta.4 (2026-05-25): pre-fix this was a dead
                      `#issue-mandate` in-page anchor with no target. Now
                      links to /app/agents with ?copy=<ens> so the
                      NewMandateButton can pre-fill the agent address.
                      Query-param consumer ships in the paired component
                      refactor (human_left.md `rostrum-leaderboard-wiring`);
                      pre-fill is a no-op until then but the link is real. */}
                  <Link
                    href={`/app/agents?copy=${encodeURIComponent(a.ens)}`}
                    className="inline-flex rounded-md border border-divider px-3 py-1.5 text-xs text-ink hover:border-ink/40"
                    aria-label={`Issue a mandate pre-filled with ${a.ens}`}
                  >
                    Delegate
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SortTab({
  label,
  sortKey,
  active,
  onSelect,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  onSelect: (k: SortKey) => void;
}) {
  const isActive = active === sortKey;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onSelect(sortKey)}
      className={
        'rounded-md px-2 py-1 transition-colors ' +
        (isActive ? 'bg-ink text-parchment' : 'text-muted hover:text-ink')
      }
    >
      {label}
    </button>
  );
}

/** Parse compact-USD strings ("$1.2M", "$840K") for the sort-by-AUM order.
 * Exported so the unit test can pin the parser without rendering the
 * client component (no DOM testing library available in the verify-app
 * vitest env). */
export function parseAumUsd(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[$,]/g, '').trim();
  const match = /^(-?\d+(?:\.\d+)?)\s*([KMB]?)$/i.exec(cleaned);
  if (!match) return 0;
  const n = parseFloat(match[1]);
  const mult: Record<string, number> = { '': 1, K: 1e3, M: 1e6, B: 1e9 };
  return n * (mult[match[2].toUpperCase()] ?? 1);
}

function Sparkline({ series, direction }: { series: number[]; direction: 'up' | 'down' | 'flat' }) {
  if (!series.length) return <span className="text-muted">—</span>;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const w = 60, h = 16;
  const points = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  // Audit P-10 fix: information-bearing SVG needs `role="img"` and an
  // aria-label that conveys both magnitude and direction.
  const arrow = direction === 'up' ? '↗' : direction === 'down' ? '↘' : '→';
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="60"
      height="16"
      role="img"
      aria-label={`7-day P&L sparkline trending ${direction} ${arrow}`}
    >
      <polyline
        points={points}
        fill="none"
        strokeWidth="0.8"
        stroke="currentColor"
        className={
          direction === 'up' ? 'text-live' : direction === 'down' ? 'text-neg' : 'text-muted'
        }
      />
    </svg>
  );
}
