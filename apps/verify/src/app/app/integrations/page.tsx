import { AppShell } from '@/components/app-shell';
import { IntegrationsView } from '@/components/integrations/integrations-view';

export const metadata = {
  title: 'Integrations',
  description: 'The programmable surfaces of Atrium: the Codex data API, agent delegation, proof of reserves, venue adapters.',
};

export default function IntegrationsPage() {
  const content = (
    <>
      <header>
        <p className="eyebrow">Integrations</p>
        <h1 className="mt-1 font-display text-4xl italic tracking-tight text-ink">
          Build on Atrium
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          The programmable surfaces in one place: read data over the Codex API, delegate trading to
          an agent with a signed mandate, verify reserves on-chain, or add a venue with an adapter.
        </p>
      </header>

      <IntegrationsView />
    </>
  );
  return (
    <AppShell
      active="/app/integrations"
      breadcrumb={[{ label: 'Integrations' }]}
      desktop={content}
      mobile={
        <div className="dark-mobile-sheet rounded-2xl border border-mob-line bg-mob-bg-card p-4 text-mob-ink">
          {content}
        </div>
      }
    />
  );
}
