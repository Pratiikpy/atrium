import { AppShell } from '@/components/app-shell';
import { AgentsStatRow } from '@/components/agents/stat-row';
import { AgentsView } from '@/components/agents/agents-view';
import { NewMandateButton } from '@/components/agents/new-mandate-button';

export const metadata = {
  title: 'Atrium · Agents',
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
        { label: 'Sigil & Rostrum' },
      ]}
    >
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
            shared useDeploymentStatus hook. */}
        <NewMandateButton />
      </header>

      <section className="mt-8">
        <AgentsStatRow />
      </section>

      <section className="mt-6">
        <AgentsView />
      </section>
    </AppShell>
  );
}
