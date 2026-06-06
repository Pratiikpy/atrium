import Link from 'next/link';
import { Card, RecessedCard, Tag } from '@/components/ui';
import { MarketingShell } from '@/components/atrium/MarketingShell';

/**
 * /changelog, public-facing release timeline.
 *
 * Each entry is a published milestone, not an internal development phase.
 * Tag references the git tag where the milestone was cut.
 */

interface Release {
  tag: string;
  date: string;
  title: string;
  summary: string;
}

const RELEASES: Release[] = [
  {
    tag: 'v0.3.0',
    date: '2026-05-28',
    title: 'Unified design system',
    summary:
      'Front end rebuilt on one design system: shared tokens, the Atrium component library, and every marketing and app route restyled to a single visual language. Landing, the /app dashboard, and 30-plus pages reconciled against the design reference. The contract and data layer is unchanged; this is the surface the app presents today.',
  },
  {
    tag: 'v0.2.1',
    date: '2026-05-25',
    title: 'Audit closure',
    summary:
      'Closed every code-doable item from the post-launch contract + integration audit. Coffer, Plinth, Sigil, and Vigil reentrancy guards consistent. Selector-mismatch class regression-tested against the deployed ABIs in two places. Faucet drain functions guard against zero-address recipients.',
  },
  {
    tag: 'v0.2.0',
    date: '2026-05-25',
    title: 'Launch complete',
    summary:
      'Subgraph completeness (Rostrum + eight event handlers). Vigil keeper goes live as a scheduled service. ResearchAttestation + Edict tier registry orchestrators ship. Off-chain notification channels (Telegram, Discord, email, webhook). Mobile-app reaches canon parity with the desktop verifier. Code4rena audit pack assembled.',
  },
  {
    tag: 'v0.1.0',
    date: '2026-05-23',
    title: 'Launch ready',
    summary:
      'LanternAttestor proof-of-reserves cron with on-chain publish. Validator-set bootstrap for Hyperliquid + Polymarket adapters. MockAavePool deployed to bridge Aave Horizon on testnet. Chaos Mode wired to real multisig pause/restore. Praetor CLI gains lantern publish-now + seed pre-flight. Loadtest baselines via k6.',
  },
  {
    tag: 'pre-v0.1',
    date: '2026-05-18',
    title: 'Verifier Mode foundation',
    summary:
      'Verifier-mode UI complete with deployment-readiness banners and a live Kani CI badge. Plinth SPAN compute and dual-oracle median path. Sigil EIP-712 with on-chain ecrecover via precompile 0x01. Aqueduct CCIP with reorg-safe replay protection and claim-back path. All adapters migrated to explicit-originator pattern (no `tx.origin`).',
  },
];

export const metadata = {
  title: 'Changelog',
  description: 'Published milestones and their dated git tags.',
};

export default function ChangelogPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl">
      <section>
        <h1 className="font-display text-5xl text-ink">Changelog</h1>
        <p className="mt-4 max-w-prose text-ink-soft">
          Public milestones, each tied to a dated git tag. Detailed
          per-release notes live in the dated git tags and{' '}
          <code className="font-mono text-ink">CHANGELOG.md</code>, with the public
          security review under <code className="font-mono text-ink">audits/</code>.
        </p>
      </section>

      <RecessedCard className="mt-10">
        <p className="text-sm text-ink-soft">
          Honesty principle: each release lists what shipped and what
          remained open. Anything that did not land moved to the next
          milestone rather than being silently deferred.
        </p>
      </RecessedCard>

      <ol className="mt-10 space-y-4">
        {RELEASES.map((r) => (
          <li key={r.tag}>
            <Card>
              <header className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-2xl text-ink">{r.title}</span>
                  <span className="text-xs uppercase tracking-wider text-muted">
                    {r.date}
                  </span>
                </div>
                <Tag>{r.tag}</Tag>
              </header>
              <p className="mt-3 text-sm text-ink-soft">{r.summary}</p>
            </Card>
          </li>
        ))}
      </ol>

      <footer className="mt-16 border-t border-divider pt-6 text-xs text-muted">
        See <Link href="/security" className="underline">/security</Link> for the
        disclosure policy and <Link href="/docs/honesty" className="underline">/docs/honesty</Link>{' '}
        for the live list of mocks, relays, and stubs on testnet.
      </footer>
      </div>
    </MarketingShell>
  );
}
