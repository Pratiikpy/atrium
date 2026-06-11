import Link from 'next/link';
import { Card } from '@/components/ui';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { DISCLOSURES } from '@/app/docs/honesty/page';

export const metadata = {
  title: 'Docs',
  description: 'Product, architecture, API, operations, security. Everything Atrium does, documented on the site.',
  openGraph: {
    title: 'Docs · Atrium',
    description: 'Product, architecture, API, operations, security. Everything Atrium does, documented on the site.',
    images: ['/opengraph-image'],
  },
};

// Honesty + product fix (2026-06-11): this page used to surface source-of-truth
// repo markdown (PRD/TDD/RESOURCES) as cards with "in repo · publishing pending"
// badges that pushed visitors out to raw GitHub. It now leads with the docs that
// actually render ON the site, grouped by topic. The fact that the full spec is
// open source is kept, but as one calm closing line with a single repo link, not
// per-file redirect cards. Every entry below is a real route in this app.
const SECTIONS = [
  {
    heading: 'Product & architecture',
    blurb:
      'What Atrium is, how the system fits together, and the decisions behind it. One margin account across venues, with the contracts and the math laid out.',
    docs: [
      {
        title: 'Architecture',
        href: '/architecture',
        sub: 'One margin account, many venues. Twenty-four contracts on Arbitrum Sepolia with an interactive system map and a position traced end to end.',
        tag: 'system map · verified addresses',
      },
      {
        title: 'Architecture decision records',
        href: '/docs/adr',
        sub: 'ADR-001 through ADR-012: Stylus over Solidity, Kani over Halmos, the dual-oracle median, UUPS upgradeability, the open IPorticoAdapter, and more, with the alternatives rejected.',
        tag: '12 decisions',
      },
      {
        title: 'Glossary',
        href: '/docs/glossary',
        sub: 'Every subsystem name (Plinth, Sigil, Lantern…) in plain English: what it is and what it does for you.',
        tag: '18 subsystems · plain language',
      },
    ],
  },
  {
    heading: 'API',
    blurb: 'The Codex HTTP API: pay-per-call margin and risk reads, with quickstart and SDK snippets.',
    docs: [
      {
        title: 'Codex API reference',
        href: '/docs/api',
        sub: 'x402-payable HTTP API. Eight endpoints, quickstart, auth, rate limits, TypeScript and Python SDK snippets.',
        tag: '8 endpoints · x402',
      },
    ],
  },
  {
    heading: 'Operations',
    blurb:
      'How Atrium runs day to day, and exactly what is deployed on-chain. Read the playbooks and the live registry yourself.',
    docs: [
      {
        title: 'Runbooks',
        href: '/docs/runbooks',
        sub: 'The operational playbooks Atrium runs on: incident response, deploy, key rotation, monitoring, on-call.',
        tag: 'operational runbooks',
      },
      {
        title: 'Deployment',
        href: '/docs/deployment',
        sub: 'Every contract on Arbitrum Sepolia with its address, Arbiscan link, and who controls it. Read the bytecode and state yourself.',
        tag: 'live registry · on-chain',
      },
    ],
  },
  {
    heading: 'Honesty & what is real',
    blurb:
      'Where the testnet falls short of production, named line by line. No mock shown as real, no number without a source.',
    docs: [
      {
        title: 'Honest disclosures',
        href: '/docs/honesty',
        sub: 'Every mock, relay, interim state, and third-party blocker. What it does, why, and when it becomes real. Sourced from the tripwires/ folder.',
        tag: `${DISCLOSURES.length} disclosures · sourced`,
      },
    ],
  },
  {
    heading: 'Security',
    blurb: 'Threat model, key handling, and how to report a vulnerability.',
    docs: [
      {
        title: 'Security',
        href: '/security',
        sub: 'Atrium security posture and responsible disclosure policy: threat model, key handling, disclosure, and bug bounty.',
        tag: 'STRIDE + PGP',
      },
    ],
  },
  {
    heading: 'Getting started',
    blurb: 'For a first read: walk the product, then verify it yourself against the chain.',
    docs: [
      {
        title: 'Getting started',
        href: '/getting-started',
        sub: 'From zero to your first cross-margin trade. Eight short steps in plain language on a free testnet. No prior crypto experience needed.',
        tag: '8 steps · testnet',
      },
      {
        title: 'Verify',
        href: '/verify',
        sub: 'Seven steps, each backed by a real contract call on Arbitrum Sepolia: deposit, open, margin, chaos, liquidation, proof-of-reserves, kill switch.',
        tag: '7 steps · on-chain',
      },
    ],
  },
] as const;

export default function DocsPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
        <section>
          <h1 className="font-display text-5xl text-ink">Documentation</h1>
          <p className="mt-4 max-w-prose text-ink-soft">
            Everything Atrium does is documented on this site: the architecture, the API, the
            operational runbooks, the security posture, and an honest account of what is real on
            testnet versus what is still relayed or mocked. Start anywhere below.
          </p>
        </section>

        {SECTIONS.map((section) => (
          <section key={section.heading} className="mt-14">
            <h2 className="font-display text-2xl text-ink">{section.heading}</h2>
            <p className="mt-3 max-w-prose text-sm text-ink-soft">{section.blurb}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {section.docs.map((d) => (
                <Link key={d.href} href={d.href} className="block">
                  <Card className="h-full transition-colors hover:border-accent/40">
                    <p className="font-display text-xl text-ink">{d.title}</p>
                    <p className="mt-2 text-sm text-ink-soft">{d.sub}</p>
                    <p className="mt-3 text-xs text-muted">{d.tag}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          <Card>
            <p className="font-display text-xl text-ink">Adapter spec</p>
            <p className="mt-2 text-sm text-ink-soft">
              <code className="font-mono text-ink">IPorticoAdapter v1.0</code> + v1.1 with explicit
              originator. MIT-licensed. Curator grants will pay $5K ARB per accepted adapter, after testnet launch.
            </p>
            <Link href="/learn#adapters" className="mt-3 inline-block text-xs text-ink underline-offset-2 hover:underline">
              Read
            </Link>
          </Card>
          <Card>
            <p className="font-display text-xl text-ink">Sigil schema</p>
            <p className="mt-2 text-sm text-ink-soft">
              EIP-712 IntentSigil + ActionSigil envelopes. 256-byte fixed body, count-prefixed
              venues/instruments (max 8 each), 65-byte trailing sig.
            </p>
            <Link href="/learn#sigil" className="mt-3 inline-block text-xs text-ink underline-offset-2 hover:underline">
              Read
            </Link>
          </Card>
          <Card>
            <p className="font-display text-xl text-ink">SPAN scenarios</p>
            <p className="mt-2 text-sm text-ink-soft">
              7 shock scenarios (±10%, ±5%, ±2%, 0) per instrument, sourced to
              <code className="ml-1 font-mono text-ink">span.rs SCENARIOS_BPS</code>, with
              cross-correlation netting across instruments in the same correlation class.
            </p>
            <Link href="/learn#span" className="mt-3 inline-block text-xs text-ink underline-offset-2 hover:underline">
              Read
            </Link>
          </Card>
        </section>

        <section className="mt-16 border-t border-line pt-8">
          <p className="max-w-prose text-sm text-ink-soft">
            The full product spec, technical design, and reference docs are open source in the
            repository.{' '}
            <a
              href="https://github.com/Pratiikpy/atrium"
              target="_blank"
              rel="noreferrer"
              className="text-ink underline underline-offset-2 hover:text-accent"
            >
              github.com/Pratiikpy/atrium
            </a>
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
