'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { NewMandateButton } from '@/components/agents/new-mandate-button';

/**
 * AgentsMobile  the Agents panel for /app/agents at < md.
 * Source: design/Mobile App.html:1185-1259. Active mandate banner +
 * Rostrum top-7d list (5 rows). Reads /api/agents/my-mandates and
 * /api/agents/leaderboard. Renders honest pending when those
 * endpoints return empty.
 */

interface Mandate {
  id: string;
  agent: string;
  spentUsd: string | null;
  totalUsd: string | null;
  daysLeft: number | null;
}

interface LeaderboardRow {
  id: string;
  agent: string;
  strategy: string;
  copiers: number | null;
  pnl7dPct: number | null;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}_${r.status}`);
  return r.json();
}

export function AgentsMobile() {
  const { isConnected } = useAccount();
  const mandates = useQuery({
    queryKey: ['mobile-mandates'],
    queryFn: () => fetchJSON<{ mandates: Mandate[]; source: string }>('/api/agents/my-mandates'),
    refetchInterval: 60_000,
    enabled: isConnected, // my-mandates is wallet-scoped; disconnected -> no 401
  });
  const board = useQuery({
    queryKey: ['mobile-rostrum'],
    queryFn: () => fetchJSON<{ agents: LeaderboardRow[]; source: string }>('/api/agents/leaderboard'),
    refetchInterval: 60_000,
  });

  const active = mandates.data?.mandates?.[0];
  // Audit fix (use-everything sweep 2026-06-02): /api/agents/leaderboard returns
  // the key `agents`, not `rows`; reading `rows` left this list permanently empty
  // even once real Rostrum rows ship. Align to the route contract.
  const rows = board.data?.agents ?? [];

  return (
    <div className="md:hidden flex flex-col gap-4">
      {/* Audit fix (#18): the mandate CTAs ("New ↗", "Issue your first Sigil")
          all linked back to /app/agents, which on mobile re-renders this same
          panel - an infinite loop, and the real mandate modal was desktop-only.
          Now the self-contained NewMandateButton (full IntentSigil form +
          deployment gate) is rendered here, so mobile users can actually issue
          a mandate. */}
      <div className="flex items-center justify-between px-1">
        <span className="font-display text-[18px] italic text-mob-ink">
          Your mandates . {mandates.data?.mandates?.length ?? 0} active
        </span>
        <NewMandateButton />
      </div>

      {/* Active mandate banner */}
      {active ? (
        <ActiveMandate m={active} />
      ) : (
        <div className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-5 text-center">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-mob-muted">No active mandate</div>
          {/* Single CTA: the "+ New mandate" button in the header above. Pre-fix
              this card rendered a SECOND NewMandateButton, stacking two identical
              "+ New mandate" affordances. */}
          <p className="mt-1.5 text-[12.5px] text-mob-muted/70">
            Use &ldquo;+ New mandate&rdquo; above to delegate to an agent.
          </p>
        </div>
      )}

      <SectionHead t="Rostrum . top 7d" moreHref="/rostrum" moreLabel="All ↗" />

      {/* Rostrum list */}
      <ul className="flex flex-col gap-2.5">
        {board.isLoading && (
          <li className="rounded-2xl border border-mob-line bg-mob-bg-card p-5 text-center text-mob-muted">
            <span className="inline-block h-4 w-28 animate-pulse rounded bg-mob-bg-elev" />
          </li>
        )}
        {!board.isLoading && rows.length === 0 && (
          <li className="rounded-2xl border border-mob-line bg-mob-bg-card p-5 text-center text-[12.5px] text-mob-muted">
            Rostrum indexer pending . cohort opens Month 2
          </li>
        )}
        {rows.slice(0, 5).map((r) => (
          <AgentRow key={r.id} r={r} />
        ))}
      </ul>
    </div>
  );
}

function ActiveMandate({ m }: { m: Mandate }) {
  const spent = m.spentUsd ?? 'pending';
  const total = m.totalUsd ?? 'pending';
  const days = m.daysLeft != null ? `${m.daysLeft}d left` : 'window pending';
  return (
    <div className="flex items-center justify-between rounded-2xl border border-mob-accent/30 bg-gradient-to-br from-mob-accent/10 to-transparent px-4 py-4">
      <div className="min-w-0">
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-mob-accent">Active . Sigil mandate</div>
        <div className="mt-1 font-display text-[20px] italic text-mob-ink truncate">{m.agent}</div>
        <div className="mt-0.5 font-mono text-[11px] text-mob-muted truncate">{spent} / {total} . {days}</div>
      </div>
      {/* Audit fix (#18): was href="/app/agents", which on mobile re-renders
          THIS same panel (a self-loop). Point at the real management surface -
          the Postern session-keys registry, where the agent's access is
          revoked/managed - instead of looping. */}
      <Link
        href="/app/settings/session-keys"
        className="shrink-0 rounded-full border border-mob-line bg-mob-bg px-3 py-1.5 text-[11px] font-medium text-mob-ink hover:border-mob-accent"
      >
        Manage
      </Link>
    </div>
  );
}

function AgentRow({ r }: { r: LeaderboardRow }) {
  const pnlPos = r.pnl7dPct != null && r.pnl7dPct >= 0;
  const pnlNeg = r.pnl7dPct != null && r.pnl7dPct < 0;
  const pnlLabel = r.pnl7dPct != null ? `${pnlPos ? '+' : ''}${r.pnl7dPct.toFixed(2)}%` : 'pending';
  const seed = (r.agent || r.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = seed % 360;
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-mob-line bg-mob-bg-card px-3.5 py-3">
      <span
        className="size-9 shrink-0 rounded-full border border-mob-hairline"
        style={{ background: `linear-gradient(135deg, oklch(0.45 0.12 ${hue}), oklch(0.18 0.06 ${hue}))` }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] text-mob-ink truncate">{r.agent}</div>
        <div className="text-[11px] text-mob-muted truncate">
          {r.strategy} . {r.copiers != null ? `${r.copiers} copiers` : 'copiers pending'}
        </div>
      </div>
      <div className="text-right">
        <div className={`font-mono text-[13px] ${pnlPos ? 'text-mob-live' : pnlNeg ? 'text-mob-neg' : 'text-mob-muted'}`}>
          {pnlLabel}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-mob-muted">7d</div>
      </div>
    </li>
  );
}

function SectionHead({ t, moreHref, moreLabel }: { t: string; moreHref?: string; moreLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <span className="font-display text-[18px] italic text-mob-ink">{t}</span>
      {moreHref && moreLabel && (
        <Link href={moreHref as any} className="font-mono text-[10.5px] uppercase tracking-wider text-mob-muted hover:text-mob-ink">
          {moreLabel}
        </Link>
      )}
    </div>
  );
}
