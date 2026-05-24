import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';

export const metadata = {
  title: 'Atrium · Team',
  description: 'Three founders. Year-1 testnet on $0 founder capital.',
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
          Three founders. Open GitHub histories. Year-1 testnet on $0 founder capital.
          Year 2 raises with the buildathon track record as the credential.
        </p>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-3">
        <Card
          codename="F1"
          role="Contracts + protocol"
          surface="Plinth · Vigil · Sigil · Coffer · Praetor CLI · Kani proofs"
          githubHint="Open-source history visible on GitHub"
        />
        <Card
          codename="F2"
          role="Frontend + product"
          surface="apps/verify · Verifier Mode · Lantern dashboard · brand kit"
          githubHint="Open-source history visible on GitHub"
        />
        <Card
          codename="F3"
          role="Ops + GTM"
          surface="Cohort outreach · runbooks · ResearchAttestation · audit gating"
          githubHint="Open-source history visible on GitHub"
        />
      </section>

      <section className="mt-16 rounded-md border border-divider bg-parchment-soft/40 p-8">
        <h2 className="font-display text-2xl text-ink">How we work</h2>
        <ul className="mt-4 space-y-3 text-sm text-ink-soft">
          <li><strong className="text-ink">Honesty over hype.</strong> Every claim sourced from a doc, a tx hash, or a live dashboard.</li>
          <li><strong className="text-ink">Best product option, no compromise.</strong> Money is the only blocker; effort is not.</li>
          <li><strong className="text-ink">Live dashboards never inflate.</strong> 2 of 3 keepers shows 2 of 3.</li>
          <li><strong className="text-ink">Tripwires beat silent slips.</strong> Scope cuts announced same day.</li>
          <li><strong className="text-ink">No fake immutability.</strong> Year-1 contracts are upgradeable; we say so out loud.</li>
        </ul>
        <Link href="/manifesto" className="mt-4 inline-block text-sm text-ink underline-offset-2 hover:underline">
          Read the manifesto
        </Link>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Contact</h2>
        <p className="mt-3 text-sm text-ink-soft">
          Security disclosure: <code className="font-mono text-ink">security@atrium.fi</code> (PGP in <Link href="/security" className="underline">SECURITY.md</Link>).
          Partnership: emails routed through warm intros, not cold inbound.
        </p>
      </section>
    </main>
  );
}

function Card({
  codename,
  role,
  surface,
  githubHint,
}: {
  codename: string;
  role: string;
  surface: string;
  githubHint: string;
}) {
  return (
    <article className="rounded-md border border-divider bg-parchment p-6">
      <p className="font-display text-3xl text-ink">{codename}</p>
      <p className="mt-2 text-sm font-medium text-ink">{role}</p>
      <p className="mt-3 text-sm text-ink-soft">{surface}</p>
      <p className="mt-4 text-xs text-muted">{githubHint}</p>
    </article>
  );
}
