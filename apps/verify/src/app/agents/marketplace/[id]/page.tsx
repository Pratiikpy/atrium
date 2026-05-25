import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';
import { Card, RecessedCard, Tag } from '@/components/ui';
import { AgentProfileLive } from '@/components/agents/agent-profile-live';

/**
 * /agents/marketplace/[id]  per-agent profile per PRD FULL_FLOW_DESIGN
 * §424-430. Five trust-signal sections that a mandate-issuer reads before
 * delegating capital:
 *
 *   1. Header (name + strat + status badge)
 *   2. Data source badges (Scribe . Rostrum . on-chain provenance)
 *   3. Max drawdown chart (90d) + revert/failure rate counters
 *   4. Deboost status (Rostrum-tracked reputation tier + history)
 *   5. Cap envelope example (sample EIP-712 Sigil mandate JSON)
 *   6. Copy-trade CTA (pre-fills a new mandate scoped to this agent)
 *
 * Reference agents have static metadata baked in below. Live performance
 * numbers come from /api/agents/[id]/profile via the AgentProfileLive
 * client component (honest pending when Rostrum returns empty).
 */

interface ReferenceAgent {
  id: string;
  name: string;
  strat: string;
  intro: string;
  cadence: string;
  instruments: string;
  venues: string[];
  repo: string;
  recommendedCaps: {
    perActionUsd: number;
    dailyUsd: number;
    expiryDays: number;
  };
}

const AGENTS: Record<string, ReferenceAgent> = {
  augur: {
    id: 'augur',
    name: 'Augur',
    strat: 'Mean reversion . hourly',
    intro:
      'Trades 1-hour deviations on tokenized perps. Closes the position when price returns to the range mid. Open-source Python; backtested 2024-2026 on real Hyperliquid HIP-3 prints.',
    cadence: 'Hourly . 24x daily',
    instruments: 'HIP-3 perps . Bollinger 20/2',
    venues: ['HL-HIP3', 'HL-HIP4'],
    repo: 'agents/augur',
    recommendedCaps: { perActionUsd: 250, dailyUsd: 2_500, expiryDays: 14 },
  },
  haruspex: {
    id: 'haruspex',
    name: 'Haruspex',
    strat: 'Momentum . equity + perp',
    intro:
      'Cross-asset momentum on tokenized equities (Trade.xyz) hedged with perps (HL-HIP4). 10-period RSI filter; risk parity between long-equity + short-perp legs.',
    cadence: 'Hourly . equity-market hours only',
    instruments: 'Equity perps . RSI(10) . hedged',
    venues: ['TRADE', 'HL-HIP4'],
    repo: 'agents/haruspex',
    recommendedCaps: { perActionUsd: 500, dailyUsd: 5_000, expiryDays: 7 },
  },
  auspex: {
    id: 'auspex',
    name: 'Auspex',
    strat: 'Basis . PT/YT carry',
    intro:
      'Daily Pendle PT vs Aave T-bill basis trade. Goes long the cheaper yield leg, short the richer leg via Aqueduct cross-chain credit. Slow strategy: 1-3 actions per week.',
    cadence: 'Daily . weekday close',
    instruments: 'PT . stETH . T-bill carry',
    venues: ['PENDLE', 'AAVE-V3'],
    repo: 'agents/auspex',
    recommendedCaps: { perActionUsd: 1_000, dailyUsd: 5_000, expiryDays: 30 },
  },
};

export function generateStaticParams() {
  return Object.keys(AGENTS).map((id) => ({ id }));
}

export const dynamic = 'force-dynamic';

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = AGENTS[id];
  if (!agent) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <Wordmark size="md" />
        <nav className="flex gap-6 text-sm text-ink-soft">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/agents/marketplace" className="hover:text-ink">Marketplace</Link>
          <Link href="/app/agents" className="hover:text-ink">Your mandates</Link>
        </nav>
      </header>

      {/* 1. Header */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow">Agent . {agent.id}</p>
            <h1 className="mt-2 font-display text-5xl italic text-ink">{agent.name}</h1>
            <p className="mt-2 text-sm text-muted">{agent.strat}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tag>reference</Tag>
            <Tag>open-source</Tag>
          </div>
        </div>
        <p className="mt-6 max-w-prose text-base text-ink-soft">{agent.intro}</p>
      </section>

      {/* 2. Data source badges */}
      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Data sources</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Every number on this page is sourced. Pending means the index is reachable but the
          measurement has not landed yet (honest empty state, not fake zero).
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <DataSource label="Scribe (subgraph)" status="live" detail="reads mandate + action history" />
          <DataSource label="Rostrum (on-chain)" status="live" detail="reads reputation + deboost" />
          <DataSource label="Codex (x402 API)" status="live" detail="reads venue health + price" />
        </div>
      </section>

      {/* 3-5: Live performance + drawdown + deboost  client component reads /api/agents/[id]/profile */}
      <AgentProfileLive id={agent.id} venues={agent.venues} />

      {/* 6. Cap envelope example */}
      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Cap envelope . example mandate</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          A Sigil mandate is an EIP-712 signed envelope that bounds the agent. Per-action and
          daily caps, expiry, allowed venues. The agent cannot exceed these even if compromised.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-md border border-line bg-mob-bg-card p-5 font-mono text-[12px] leading-[1.65] text-parchment">
{`{
  "agent":         "${agent.id}.eth",
  "strategy":      "${agent.strat}",
  "perActionCap":  "${agent.recommendedCaps.perActionUsd} USDC",
  "dailyCap":      "${agent.recommendedCaps.dailyUsd} USDC",
  "allowedVenues": ${JSON.stringify(agent.venues)},
  "expiresAt":     "+${agent.recommendedCaps.expiryDays}d",
  "killSwitch":    "owner can revoke anytime, single tx"
}`}
        </pre>
      </section>

      {/* 7. Copy-trade CTA */}
      <section className="mt-12">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl italic text-ink">Copy {agent.name}</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Issues a Sigil mandate scoped to this agent with the recommended caps. You can
                revoke any time from /app/agents.
              </p>
            </div>
            <Link
              href={`/app/agents?copy=${agent.id}` as any}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 h-[44px] text-sm font-medium text-parchment hover:bg-ink/90"
            >
              Issue mandate <span aria-hidden>↗</span>
            </Link>
          </div>
        </Card>
      </section>

      {/* Repo + docs */}
      <section className="mt-12">
        <RecessedCard>
          <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
            <p className="text-ink-soft">Repository</p>
            <p className="font-mono text-ink">{agent.repo}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3 text-sm">
            <p className="text-ink-soft">Cadence</p>
            <p className="text-ink">{agent.cadence}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3 text-sm">
            <p className="text-ink-soft">Instruments</p>
            <p className="text-ink">{agent.instruments}</p>
          </div>
        </RecessedCard>
      </section>
    </main>
  );
}

function DataSource({ label, status, detail }: { label: string; status: 'live' | 'pending'; detail: string }) {
  const isLive = status === 'live';
  return (
    <div className="rounded-md border border-line bg-paper p-4">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${isLive ? 'bg-live' : 'bg-divider'}`} aria-hidden />
        <span className="text-[13px] font-medium text-ink">{label}</span>
      </div>
      <p className="mt-2 text-[12px] text-muted">{detail}</p>
    </div>
  );
}
