'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui';

/**
 * Live performance + drawdown + deboost panel for /agents/marketplace/[id].
 * Reads /api/agents/[id]/profile which queries Scribe for the underlying
 * Rostrum and Sigil event streams. Every section degrades to honest
 * pending when the index has no rows for this agent yet (no fake zeros).
 */

interface AgentProfile {
  id: string;
  totalActions: number | null;
  successfulActions: number | null;
  revertedActions: number | null;
  reputationTier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'deboosted' | null;
  deboostEvents: Array<{ at: number; reason: string }>;
  pnl: {
    d7Pct: number | null;
    d30Pct: number | null;
    d90Pct: number | null;
    maxDrawdownPct: number | null;
  };
  source: 'scribe' | 'pending';
}

async function fetchProfile(id: string): Promise<AgentProfile> {
  const r = await fetch(`/api/agents/${encodeURIComponent(id)}/profile`);
  if (!r.ok) {
    return {
      id,
      totalActions: null,
      successfulActions: null,
      revertedActions: null,
      reputationTier: null,
      deboostEvents: [],
      pnl: { d7Pct: null, d30Pct: null, d90Pct: null, maxDrawdownPct: null },
      source: 'pending',
    };
  }
  return r.json();
}

export function AgentProfileLive({ id, venues }: { id: string; venues: string[] }) {
  const { data } = useQuery({
    queryKey: ['agent-profile', id],
    queryFn: () => fetchProfile(id),
    refetchInterval: 60_000,
  });

  const profile = data ?? null;
  const failureRate =
    profile?.totalActions && profile?.revertedActions != null && profile.totalActions > 0
      ? (profile.revertedActions / profile.totalActions) * 100
      : null;

  return (
    <>
      {/* 3. Performance + failure rate */}
      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Performance . trailing</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Metric label="7-day P&L" value={fmtPct(profile?.pnl.d7Pct)} />
          <Metric label="30-day P&L" value={fmtPct(profile?.pnl.d30Pct)} />
          <Metric label="90-day P&L" value={fmtPct(profile?.pnl.d90Pct)} />
          <Metric
            label="Max drawdown (90d)"
            value={fmtPct(profile?.pnl.maxDrawdownPct)}
            negative
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Total actions"
            value={profile?.totalActions != null ? String(profile.totalActions) : 'pending'}
          />
          <Metric
            label="Successful"
            value={profile?.successfulActions != null ? String(profile.successfulActions) : 'pending'}
          />
          <Metric
            label="Failure rate"
            value={failureRate != null ? `${failureRate.toFixed(2)}%` : 'pending'}
            negative={failureRate != null && failureRate > 5}
          />
        </div>
        {profile?.source === 'pending' && (
          <p className="mt-3 text-[11px] text-muted">
            Live performance reads from Rostrum (subgraph). This agent has no recorded actions
            yet. Numbers populate after first mandate fires.
          </p>
        )}
      </section>

      {/* 4. Deboost status */}
      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Reputation . deboost status</h2>
        <Card className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted">Current tier</p>
              <p className="mt-1 font-display text-3xl italic text-ink">
                {profile?.reputationTier ?? 'pending'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted">Deboost events</p>
              <p className="mt-1 font-mono text-[20px] text-ink">
                {/* Phase theta.4 (2026-05-25): render an em-dash when source is
                    'pending' so a "0" deboost count is not interpreted as a
                    measured clean record. A real zero only appears once the
                    Scribe-backed source returns. */}
                {profile?.source === 'scribe'
                  ? profile.deboostEvents.length
                  : '—'}
              </p>
            </div>
          </div>
          {profile && profile.deboostEvents.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-divider pt-4 text-[12.5px]">
              {profile.deboostEvents.slice(0, 5).map((e) => (
                <li key={e.at} className="flex items-baseline justify-between">
                  <span className="text-ink">{e.reason}</span>
                  <span className="font-mono text-muted">
                    {new Date(e.at * 1000).toISOString().split('T')[0]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {profile && profile.deboostEvents.length === 0 && (
            <p className="mt-4 text-[12.5px] text-muted">
              No deboost events on record. Allowed venues: {venues.join(' . ')}.
            </p>
          )}
        </Card>
      </section>
    </>
  );
}

function Metric({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  const isPending = value === 'pending' || value === '-';
  return (
    <div className="rounded-md border border-line bg-paper px-4 py-3">
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={`mt-1.5 font-mono text-[20px] ${
          isPending ? 'text-muted' : negative ? 'text-neg' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return 'pending';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}
