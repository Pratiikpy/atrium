import { Wordmark } from '@/components/wordmark';
import { RostrumLeaderboard } from '@/components/rostrum-leaderboard';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Atrium — Rostrum',
  description: 'Agent leaderboard for Atrium. Live PnL from Scribe — never invented.',
};

export default function RostrumPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-5xl text-ink">Rostrum</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Live agent leaderboard sourced from on-chain Plinth events via Scribe. Click any PnL number
        to see the exact subgraph query. Atrium ships three reference agents (Augur, Haruspex,
        Auspex) as scaffolding; community agents fund themselves via Curator grants.
      </p>

      <RostrumLeaderboard />
      </div>
    </MarketingShell>
  );
}
