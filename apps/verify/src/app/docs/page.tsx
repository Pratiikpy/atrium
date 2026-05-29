import Link from 'next/link';
import { Card } from '@/components/ui';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Atrium · Docs',
  description: 'Spec, technical design, runbooks, ADRs. Single source of truth.',
};

const DOCS = [
  {
    title: 'ATRIUM_PRD.md',
    sub: 'Product spec · what + why · v0.15 honesty baseline + §28.9 build phase',
    href: 'https://github.com/Pratiikpy/atrium/blob/main/ATRIUM_PRD.md',
    pages: '2,297 lines',
  },
  {
    title: 'TECH_DESIGN.md',
    sub: 'Technical design · how it works · v1.1 + §24.6–§24.9 + ADRs 001–012',
    href: 'https://github.com/Pratiikpy/atrium/blob/main/TECH_DESIGN.md',
    pages: '2,333 lines',
  },
  {
    title: 'docs/plan-tracker.md',
    sub: '94+ patches landed across audit Waves F–N · source of truth for every fix',
    href: 'https://github.com/Pratiikpy/atrium/blob/main/docs/plan-tracker.md',
    pages: '254+ lines',
  },
  {
    title: 'docs/MASTER_PLAN.md',
    sub: '12-month build plan with ✅ status markers post-Wave-L',
    href: 'https://github.com/Pratiikpy/atrium/blob/main/docs/MASTER_PLAN.md',
    pages: 'Months 1–12',
  },
  {
    title: 'docs/LAUNCH_READINESS.md',
    sub: 'Pre-demo checklist · what is built · what is deferred',
    href: 'https://github.com/Pratiikpy/atrium/blob/main/docs/LAUNCH_READINESS.md',
    pages: 'Pre-demo audit',
  },
  {
    title: 'RESOURCES.md',
    sub: 'The 18 cloned reference repos in resources/ and what each is for',
    href: 'https://github.com/Pratiikpy/atrium/blob/main/RESOURCES.md',
    pages: '18 dependencies',
  },
  {
    title: 'SECURITY.md',
    sub: 'Threat model, key handling, disclosure policy, bug bounty',
    href: 'https://github.com/Pratiikpy/atrium/blob/main/SECURITY.md',
    pages: 'STRIDE + PGP',
  },
  {
    title: 'human_left.md',
    sub: 'The 12 tasks that genuinely require a human (Stylus WSL build, hardware-wallet sigs, …)',
    href: 'https://github.com/Pratiikpy/atrium/blob/main/human_left.md',
    pages: '12 entries',
  },
];

export default function DocsPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
      <section>
        <h1 className="font-display text-5xl text-ink">Documentation</h1>
        <p className="mt-4 max-w-prose text-ink-soft">
          Everything Atrium claims to do is documented in source-of-truth markdown
          files that ship in the repo. The links below open the canonical version
          on GitHub; the local clone is the working copy.
        </p>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        {DOCS.map((d) => (
          <a key={d.title} href={d.href} target="_blank" rel="noreferrer" className="block">
            <Card className="h-full transition-colors hover:border-accent/40">
              <p className="font-display text-xl text-ink">{d.title}</p>
              <p className="mt-2 text-sm text-ink-soft">{d.sub}</p>
              <p className="mt-3 text-xs text-muted">{d.pages}</p>
            </Card>
          </a>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Honest disclosures</h2>
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          Three venues are mocked or relayed on testnet because the real upstream is not on
          Sepolia (Aave V3, Pyth equity feeds, Hyperliquid). Plus a handful of interim states
          (deployer-EOA admin, monitoring-only keeper, empty cohort strip). Every one is named
          here with the mechanism + timeline to "real".
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Link href="/docs/honesty" className="block">
            <Card className="h-full transition-colors hover:border-accent/40">
              <p className="font-display text-xl text-ink">Honest disclosures</p>
              <p className="mt-2 text-sm text-ink-soft">
                Every mock, relay, interim state, and third-party blocker. What it does, why,
                when it becomes real. Sourced from the tripwires/ folder.
              </p>
              <p className="mt-3 text-xs text-muted">8 disclosures . sourced</p>
            </Card>
          </Link>
          <Link href="/docs/api" className="block">
            <Card className="h-full transition-colors hover:border-accent/40">
              <p className="font-display text-xl text-ink">Codex API reference</p>
              <p className="mt-2 text-sm text-ink-soft">
                x402-payable HTTP API. 8 endpoints, quickstart, auth, rate limits, TypeScript +
                Python SDK snippets.
              </p>
              <p className="mt-3 text-xs text-muted">8 endpoints . x402</p>
            </Card>
          </Link>
          <Link href="/docs/glossary" className="block">
            <Card className="h-full transition-colors hover:border-accent/40">
              <p className="font-display text-xl text-ink">Glossary</p>
              <p className="mt-2 text-sm text-ink-soft">
                Every subsystem name (Plinth, Sigil, Lantern...) in plain English: what it is and
                what it does for you. The key to the product&apos;s vocabulary.
              </p>
              <p className="mt-3 text-xs text-muted">18 subsystems . plain language</p>
            </Card>
          </Link>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Architecture decision records</h2>
        <p className="mt-3 text-sm text-ink-soft">
          ADR-001 through ADR-012 record every architectural decision taken during the build phase.
          New ADRs 009–012 cover: system-wide Stylus camelCase ABI convention; uniform pause(string)
          accepting multisig OR timelock; Codex x402 on-chain authoritative; agent-template byte-layout
          coupling. See TDD §24.7.
        </p>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="font-display text-xl text-ink">Adapter spec</p>
          <p className="mt-2 text-sm text-ink-soft">
            <code className="font-mono text-ink">IPorticoAdapter v1.0</code> + v1.1 with explicit
            originator. MIT-licensed. Curator grant $5K ARB per accepted adapter.
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
            14 shock scenarios (±1×, ±2×, ±3×) per instrument, with cross-correlation netting
            across instruments in the same correlation class.
          </p>
          <Link href="/learn#span" className="mt-3 inline-block text-xs text-ink underline-offset-2 hover:underline">
            Read
          </Link>
        </Card>
      </section>
      </div>
    </MarketingShell>
  );
}
