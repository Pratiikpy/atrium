import nextDynamic from 'next/dynamic';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { AgentsStatRow } from '@/components/agents/stat-row';
import { EnforcementProofCard } from '@/components/agents/enforcement-proof-card';
import { AgentsView } from '@/components/agents/agents-view';
import { AgentsMobile } from '@/components/mobile/panels/agents-mobile';

/* PERF-04: NewMandateButton is heavy (EIP-712 signing logic), dynamic.
   Audit #50: CopyTradeMandate wraps it to read ?copy and prefill recommended
   caps from the marketplace/leaderboard deep-link. */
const CopyTradeMandate = nextDynamic(
  () => import('@/components/agents/copy-trade-mandate').then((m) => m.CopyTradeMandate),
  { loading: () => <span className="inline-block h-10 w-32 animate-pulse rounded-md bg-ink/10" /> },
);

export const metadata = {
  title: 'Agents',
  description: 'Delegate to agents with bounded mandates. Sigil + Rostrum.',
};

// Audit U-17: NewMandateButton's modal now calls wagmi's useSignTypedData
// inside the user's submit handler. The hook reads WagmiProvider context
// during render, which doesn't exist on Next's static prerender pass.
// Force-dynamic mirrors the /app/vault decision (audit U-15).
export const dynamic = 'force-dynamic';

export default function AgentsPage() {
  return (
    <AppShell
      active="/app/agents"
      breadcrumb={[
        { label: 'Agents' },
        { label: 'Mandates · Sigil & Rostrum' },
      ]}
      mobile={<AgentsMobile />}
      desktop={
      <div className="hidden md:block">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Agents · Sigil & Rostrum</p>
          <h1 className="mt-1 font-display text-4xl italic tracking-tight text-ink">
            Delegate to agents with bounded mandates
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Issue an Intent Sigil, Postern produces a session key, the agent transacts within scope.
          </p>
        </div>
        {/* Audit P-11 fix: button opens a mandate-creation modal with the
            full IntentSigil form. Gated by deployment readiness via the
            shared useDeploymentStatus hook. Audit #50: wrapped so a
            ?copy=<agent> deep-link prefills the recommended caps. Suspense
            boundary required for useSearchParams (Next 15). */}
        <Suspense fallback={<span className="inline-block h-10 w-32 animate-pulse rounded-md bg-ink/10" />}>
          <CopyTradeMandate />
        </Suspense>
      </header>

      <section className="mt-8">
        <AgentsStatRow />
      </section>

      {/* Enforcement proof (2026-06-10): four real on-chain txs showing the
          mandate is enforced by the risk engine. Recorded demonstration,
          clickable on Arbiscan. See enforcement-proof-card.tsx. */}
      <section className="mt-6">
        <EnforcementProofCard />
      </section>

      <section className="mt-6">
        <AgentsView />
      </section>
      </div>
      }
    />
  );
}
