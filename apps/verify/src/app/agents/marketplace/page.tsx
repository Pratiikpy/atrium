import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';
import { Card, Tag, RecessedCard, PrimaryButton } from '@/components/ui';

export const metadata = {
  title: 'Atrium · Agents marketplace',
  description: 'Reference agents and Curator-grant submissions. Open-source, signed mandates.',
};

const REFERENCE = [
  {
    name: 'Augur',
    strat: 'Mean reversion',
    cadence: 'Hourly',
    instruments: 'HIP-3 perps · range bands',
    repo: 'agents/augur',
    tag: 'reference',
  },
  {
    name: 'Haruspex',
    strat: 'Momentum',
    cadence: 'Hourly',
    instruments: 'HIP-3 + equity perps · 10-period RSI',
    repo: 'agents/haruspex',
    tag: 'reference',
  },
  {
    name: 'Auspex',
    strat: 'Basis trade',
    cadence: 'Daily',
    instruments: 'Pendle YT vs Aave T-bill',
    repo: 'agents/auspex',
    tag: 'reference',
  },
];

export default function AgentsMarketplacePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <Wordmark size="md" />
        <nav className="flex gap-6 text-sm text-ink-soft">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/app/agents" className="hover:text-ink">Your mandates</Link>
          <Link href="/docs" className="hover:text-ink">Docs</Link>
        </nav>
      </header>

      <section className="mt-16">
        <h1 className="font-display text-5xl text-ink">Agents marketplace</h1>
        <p className="mt-4 max-w-prose text-ink-soft">
          Open-source agents that trade for you under bounded Sigil mandates. The three
          reference agents below ship in <code className="font-mono text-ink">agents/</code> in the
          Atrium repo. Curator grants of $5K ARB go to community-built agents that pass review.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Reference agents</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {REFERENCE.map((a) => (
            <Link
              key={a.name}
              href={`/agents/marketplace/${a.name.toLowerCase()}` as any}
              className="block transition hover:-translate-y-0.5"
            >
              <Card>
                <header className="flex items-baseline justify-between">
                  <p className="font-display text-2xl text-ink">{a.name}</p>
                  <Tag>{a.tag}</Tag>
                </header>
                <p className="mt-2 text-sm font-medium text-ink">{a.strat}</p>
                <p className="mt-2 text-xs text-muted">Cadence: {a.cadence}</p>
                <p className="mt-1 text-xs text-muted">{a.instruments}</p>
                <p className="mt-4 font-mono text-xs text-ink-soft">{a.repo}</p>
                <p className="mt-3 text-[10.5px] uppercase tracking-wider text-muted">
                  View profile →
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Community submissions</h2>
        <RecessedCard className="mt-6">
          <p className="text-sm text-ink-soft">
            No community agents submitted yet. The Curator grant program opens
            with the production release. See <code className="font-mono text-ink">agents/template/</code>
            for the scaffold layout.
          </p>
          <div className="mt-4">
            <PrimaryButton href="https://github.com/Pratiikpy/atrium" className="text-xs px-4 py-2">
              Submit on GitHub
            </PrimaryButton>
          </div>
        </RecessedCard>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">How a submission works</h2>
        <ol className="mt-4 space-y-3 text-sm text-ink-soft">
          <li>
            <strong className="text-ink">1.</strong> Fork{' '}
            <code className="font-mono text-ink">agents/template/</code>, implement your{' '}
            <code className="font-mono text-ink">Strategy::decide</code> method.
          </li>
          <li>
            <strong className="text-ink">2.</strong> Add a <code className="font-mono text-ink">README.md</code> describing the strategy and its risk profile.
          </li>
          <li>
            <strong className="text-ink">3.</strong> Open a PR. Curator (3 reviewers from 3 organizations) reviews
            for venue compatibility, mandate-cap sanity, and code quality.
          </li>
          <li>
            <strong className="text-ink">4.</strong> Merge ships the agent into the marketplace. Grant disburses
            via ResearchAttestation tx.
          </li>
        </ol>
      </section>
    </main>
  );
}
