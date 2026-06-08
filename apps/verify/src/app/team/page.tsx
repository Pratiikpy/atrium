/**
 * /team, workstreams, not invented people. We do not ship placeholder founder
 * identities or dead GitHub links (CLAUDE.md red line: never invent a person or
 * relationship). The founding team is named in person at the Founder House; until
 * then the open repository is the credential.
 */
import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Team',
  description: 'How the team behind Atrium works, and the workstreams shipping in public.',
  openGraph: {
    title: 'Team · Atrium',
    description: 'How the team behind Atrium works, and the workstreams shipping in public.',
    images: ['/opengraph-image'],
  },
};

interface Workstream {
  title: string;
  scope: string;
  background: string;
}

const WORKSTREAMS: Workstream[] = [
  {
    title: 'Contracts',
    scope: 'Plinth margin engine · Vigil liquidations · Sigil mandates · Coffer vault · Kani proofs',
    background: 'Stylus/Rust smart contracts and formal verification.',
  },
  {
    title: 'Product',
    scope: 'apps/verify · Verifier Mode · Lantern dashboard · brand and design system',
    background: 'Full-stack engineering, DeFi frontend, and data pipelines.',
  },
  {
    title: 'Operations',
    scope: 'Cohort programme · runbooks · ResearchAttestation · audit cadence · partnerships',
    background: 'DevOps, protocol operations, security and compliance.',
  },
];

export default function TeamPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl">
        <section>
          <h1 className="font-display text-5xl text-ink">Team</h1>
          <p className="mt-4 max-w-prose text-ink-soft">
            Atrium is built by a small team shipping in public on Arbitrum Sepolia.
            Code, commits, audits, and incident post-mortems all live in the open
            repository; the work is the credential. The founders are named in person
            at the Arbitrum Founder House.
          </p>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          {WORKSTREAMS.map((w) => (
            <article key={w.title} className="rounded-md border border-divider bg-parchment p-6">
              <p className="font-display text-xl text-ink">{w.title}</p>
              <p className="mt-1 text-xs text-muted">{w.background}</p>
              <p className="mt-4 text-sm text-ink-soft">{w.scope}</p>
            </article>
          ))}
        </section>

        <section className="mt-16 rounded-md border border-divider bg-parchment-soft/40 p-8">
          <h2 className="font-display text-2xl text-ink">How we work</h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-soft">
            <li><strong className="text-ink">Honesty over hype.</strong> Every claim is sourced from a document, a transaction hash, or a live dashboard.</li>
            <li><strong className="text-ink">Best product option, no compromise.</strong> When two paths fork, take the one that makes the product more correct, trustworthy, and defensible.</li>
            <li><strong className="text-ink">Live dashboards never inflate.</strong> If two of three keepers are up, the page shows two of three.</li>
            <li><strong className="text-ink">Tripwires beat silent slips.</strong> Scope cuts get announced the same day they happen.</li>
            <li><strong className="text-ink">No fake immutability.</strong> Contracts are upgradeable; on testnet today admin is a single deployer key, with a 3-of-5 multisig + 48-hour timelock as the mainnet target. We say so out loud.</li>
          </ul>
          <Link href="/manifesto" className="mt-6 inline-block text-sm text-ink underline-offset-2 hover:underline">
            Read the manifesto →
          </Link>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl text-ink">Contact</h2>
          <p className="mt-3 text-sm text-ink-soft">
            Security disclosure: <code className="font-mono text-ink">security@useatrium.me</code> (PGP key linked from <Link href="/security" className="underline">/security</Link>).
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Partnerships and integrations are scoped through the Cohort programme, see <Link href="/cohort" className="underline">/cohort</Link>.
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
