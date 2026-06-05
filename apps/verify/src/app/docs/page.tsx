import Link from 'next/link';
import { Card } from '@/components/ui';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { DISCLOSURES } from '@/app/docs/honesty/page';

export const metadata = {
  title: 'Docs',
  description: 'Spec, technical design, runbooks, ADRs. Single source of truth.',
};

// Audit honesty fix (#12/#40/#41): cards used to link every doc to a GitHub
// URL, but only the files actually committed to the public repo resolve - the
// rest 404 (PRD/TDD/plan-tracker/MASTER_PLAN/LAUNCH_READINESS/RESOURCES are in
// the repo locally but not yet published; human_left.md is intentionally
// git-ignored internal notes and was dropped entirely). `repoOnly: true` marks
// a doc that exists in the working tree but is not on GitHub yet; those render
// as a non-link card with an honest "in repo · publishing pending" tag instead
// of a dead link.
const DOCS = [
  {
    title: 'ATRIUM_PRD.md',
    sub: 'Product spec · what + why · honesty baseline + build phase',
    pages: 'product spec',
    repoOnly: true,
  },
  {
    title: 'TECH_DESIGN.md',
    sub: 'Technical design · how it works · ADRs 001–012',
    pages: 'technical design',
    repoOnly: true,
  },
  {
    title: 'docs/plan-tracker.md',
    sub: 'Source of truth for every landed fix across the audit waves',
    pages: 'patch register',
    repoOnly: true,
  },
  {
    title: 'docs/MASTER_PLAN.md',
    sub: '12-month build plan with status markers',
    pages: 'Months 1–12',
    repoOnly: true,
  },
  {
    title: 'docs/LAUNCH_READINESS.md',
    sub: 'Pre-demo checklist · what is built · what is deferred',
    pages: 'Pre-demo audit',
    repoOnly: true,
  },
  {
    // Link-integrity fix (use-everything 2026-06-03): the GitHub repo is not
    // public yet, so the blob link 404'd. /benchmarks is the live in-app
    // competitive comparison, so point there instead of a dead external link.
    title: 'COMPETITIVE_POSITIONING.md',
    sub: 'The wedge: cross-venue portfolio margin from a neutral layer, why no single venue can copy it',
    href: '/benchmarks',
    pages: 'one-page positioning',
  },
  {
    title: 'RESOURCES.md',
    sub: 'The 18 cloned reference repos in resources/ and what each is for',
    pages: '18 dependencies',
    repoOnly: true,
  },
  {
    // Link-integrity fix (use-everything 2026-06-03): repo not public yet, blob
    // link 404'd. /security is the live in-app threat-model + disclosure page.
    title: 'SECURITY.md',
    sub: 'Threat model, key handling, disclosure policy, bug bounty',
    href: '/security',
    pages: 'STRIDE + PGP',
  },
] as const;

export default function DocsPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
      <section>
        <h1 className="font-display text-5xl text-ink">Documentation</h1>
        <p className="mt-4 max-w-prose text-ink-soft">
          Everything Atrium claims to do is documented in source-of-truth markdown
          files in the repo. Docs already published to GitHub link out; the rest
          live in the working tree and publish as they are finalized (marked below).
        </p>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        {DOCS.map((d) => {
          const repoOnly = 'repoOnly' in d && d.repoOnly === true;
          const inner = (
            <Card className="h-full transition-colors hover:border-accent/40">
              <p className="font-display text-xl text-ink">{d.title}</p>
              <p className="mt-2 text-sm text-ink-soft">{d.sub}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">{d.pages}</span>
                {repoOnly && (
                  <span className="rounded-sm bg-parchment-soft/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                    in repo · publishing pending
                  </span>
                )}
              </div>
            </Card>
          );
          return repoOnly ? (
            <div key={d.title}>{inner}</div>
          ) : (
            <a key={d.title} href={(d as { href: string }).href} target="_blank" rel="noreferrer" className="block">
              {inner}
            </a>
          );
        })}
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
              {/* Audit fix (#39): count is derived from the DISCLOSURES array so
                  it can never drift from the honesty page again. */}
              <p className="mt-3 text-xs text-muted">{DISCLOSURES.length} disclosures . sourced</p>
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
          <Link href="/docs/deployment" className="block">
            <Card className="h-full transition-colors hover:border-accent/40">
              <p className="font-display text-xl text-ink">Deployment</p>
              <p className="mt-2 text-sm text-ink-soft">
                Every contract on Arbitrum Sepolia with its address + Arbiscan link, and who controls
                it. Read the bytecode and state yourself.
              </p>
              <p className="mt-3 text-xs text-muted">live registry . on-chain</p>
            </Card>
          </Link>
          <Link href="/docs/runbooks" className="block">
            <Card className="h-full transition-colors hover:border-accent/40">
              <p className="font-display text-xl text-ink">Runbooks</p>
              <p className="mt-2 text-sm text-ink-soft">
                The operational playbooks Atrium runs on: incident response, deploy, key rotation,
                monitoring, on-call. Rendered from the runbooks/ markdown in the repo.
              </p>
              <p className="mt-3 text-xs text-muted">34 runbooks . ops-ready</p>
            </Card>
          </Link>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Architecture decision records</h2>
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          ADR-001 through ADR-012 record every consequential decision taken during the build phase,
          with context and the alternatives rejected: Stylus over Solidity, Kani over Halmos, the
          dual-oracle median, UUPS upgradeability, the open IPorticoAdapter, and more.
        </p>
        <Link
          href="/docs/adr"
          className="mt-4 inline-block text-sm text-ink underline-offset-2 hover:underline"
        >
          Read all 12 decisions →
        </Link>
      </section>

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
      </div>
    </MarketingShell>
  );
}
