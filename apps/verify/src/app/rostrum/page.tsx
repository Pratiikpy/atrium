import { RostrumLeaderboard } from '@/components/rostrum-leaderboard';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Atrium · Rostrum',
  description: 'Action attestation log, trades ship Phase 6 of launch plan.',
};

export default function RostrumPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-5xl text-ink">Rostrum</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        {/* TODO: When Phase 6 completes, restore: "Live agent leaderboard sourced from on-chain Plinth events via Scribe." */}
        Action attestation log sourced from on-chain Plinth events via Scribe. Trades ship in Phase 6 of the launch plan. Click any entry
        to see the exact subgraph query. Atrium ships three reference agents (Augur, Haruspex,
        Auspex) as scaffolding; community agents fund themselves via Curator grants.
      </p>

      <RostrumLeaderboard />
      </div>
    </MarketingShell>
  );
}
