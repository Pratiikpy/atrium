import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';

export const metadata = {
  title: 'Atrium · Team',
  description: 'How Atrium builds and the principles the team works to.',
};

export default function TeamPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="flex items-center justify-between">
        <Wordmark size="md" />
        <nav className="flex gap-6 text-sm text-ink-soft">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/app" className="hover:text-ink">App</Link>
          <Link href="/manifesto" className="hover:text-ink">Manifesto</Link>
        </nav>
      </header>

      <section className="mt-16">
        <h1 className="font-display text-5xl text-ink">Team</h1>
        <p className="mt-4 max-w-prose text-ink-soft">
          Atrium is built by a small team of founders shipping in public on Arbitrum Sepolia. Code, commits, audits, and incident post-mortems all live in the open GitHub repository — the work is the credential.
        </p>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-3">
        <RoleCard
          area="Contracts &amp; protocol"
          surface="Plinth margin engine · Vigil liquidations · Sigil mandates · Coffer vault · Praetor CLI · Kani proofs"
        />
        <RoleCard
          area="Frontend &amp; product"
          surface="apps/verify · Verifier Mode · Lantern dashboard · brand and design system"
        />
        <RoleCard
          area="Operations &amp; partnerships"
          surface="Cohort programme · runbooks · ResearchAttestation · audit cadence"
        />
      </section>

      <section className="mt-16 rounded-md border border-divider bg-parchment-soft/40 p-8">
        <h2 className="font-display text-2xl text-ink">How we work</h2>
        <ul className="mt-4 space-y-3 text-sm text-ink-soft">
          <li><strong className="text-ink">Honesty over hype.</strong> Every claim is sourced from a document, a transaction hash, or a live dashboard.</li>
          <li><strong className="text-ink">Best product option, no compromise.</strong> When two paths fork, take the one that makes the product more correct, trustworthy, and defensible.</li>
          <li><strong className="text-ink">Live dashboards never inflate.</strong> If two of three keepers are up, the page shows two of three.</li>
          <li><strong className="text-ink">Tripwires beat silent slips.</strong> Scope cuts get announced the same day they happen.</li>
          <li><strong className="text-ink">No fake immutability.</strong> Contracts are upgradeable today behind a multisig and a 48-hour timelock — we say so out loud.</li>
        </ul>
        <Link href="/manifesto" className="mt-6 inline-block text-sm text-ink underline-offset-2 hover:underline">
          Read the manifesto →
        </Link>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Contact</h2>
        <p className="mt-3 text-sm text-ink-soft">
          Security disclosure: <code className="font-mono text-ink">security@atrium.fi</code> (PGP key linked from <Link href="/security" className="underline">/security</Link>).
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Partnerships and integrations are scoped through the Cohort programme — see <Link href="/cohort" className="underline">/cohort</Link>.
        </p>
      </section>
    </main>
  );
}

function RoleCard({ area, surface }: { area: string; surface: string }) {
  return (
    <article className="rounded-md border border-divider bg-parchment p-6">
      <p className="text-[11px] uppercase tracking-wider text-muted">Focus area</p>
      <p className="mt-2 font-display text-xl text-ink">{area}</p>
      <p className="mt-4 text-sm text-ink-soft">{surface}</p>
    </article>
  );
}
