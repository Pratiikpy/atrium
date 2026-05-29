/**
 * /team — founder slots with placeholder identities.
 *
 * TODO: Replace with real founder identities when sign-off lands.
 * Keep the 'work is the credential' philosophy but surface named contributors.
 */
import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Atrium · Team',
  description: 'The founding team behind Atrium and how they work.',
};

interface Founder {
  name: string;
  role: string;
  github: string;
  background: string;
}

const FOUNDERS: Founder[] = [
  {
    name: 'Founder — Contracts',
    role: 'Plinth margin engine · Vigil liquidations · Sigil mandates · Coffer vault · Kani proofs',
    github: 'https://github.com/placeholder-f1',
    background: 'Stylus/Rust smart contract engineer. Formal verification.',
  },
  {
    name: 'Founder — Product',
    role: 'apps/verify · Verifier Mode · Lantern dashboard · brand and design system',
    github: 'https://github.com/placeholder-f2',
    background: 'Full-stack engineer. DeFi frontend and data pipelines.',
  },
  {
    name: 'Founder — Operations',
    role: 'Cohort programme · runbooks · ResearchAttestation · audit cadence · partnerships',
    github: 'https://github.com/placeholder-f3',
    background: 'DevOps and protocol operations. Security and compliance.',
  },
];

export default function TeamPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl">
        <section>
          <h1 className="font-display text-5xl text-ink">Team</h1>
          <p className="mt-4 max-w-prose text-ink-soft">
            Atrium is built by a small team of founders shipping in public on Arbitrum
            Sepolia. Code, commits, audits, and incident post-mortems all live in the
            open GitHub repository — the work is the credential.
          </p>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          {FOUNDERS.map((f) => (
            <article key={f.name} className="rounded-md border border-divider bg-parchment p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/5 text-lg text-ink">
                {f.name.charAt(0)}
              </div>
              <p className="mt-4 font-display text-xl text-ink">{f.name}</p>
              <p className="mt-1 text-xs text-muted">{f.background}</p>
              <p className="mt-4 text-sm text-ink-soft">{f.role}</p>
              <a
                href={f.github}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs text-ink underline-offset-2 hover:underline"
              >
                GitHub →
              </a>
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
      </div>
    </MarketingShell>
  );
}
