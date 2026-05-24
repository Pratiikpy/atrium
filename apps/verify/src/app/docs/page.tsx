import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';
import { Card } from '@/components/ui';

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
    title: 'docs/AUDIT_FINDINGS.md',
    sub: '94+ patches landed across audit Waves F–N · source of truth for every fix',
    href: 'https://github.com/Pratiikpy/atrium/blob/main/docs/AUDIT_FINDINGS.md',
    pages: '254+ lines',
  },
  {
    title: 'docs/ROADMAP.md',
    sub: '12-month build plan with ✅ status markers post-Wave-L',
    href: 'https://github.com/Pratiikpy/atrium/blob/main/docs/ROADMAP.md',
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
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <Wordmark size="md" />
        <nav className="flex gap-6 text-sm text-ink-soft">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/changelog" className="hover:text-ink">Changelog</Link>
          <Link href="/app" className="hover:text-ink">App</Link>
        </nav>
      </header>

      <section className="mt-16">
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
            <Card className="h-full transition-colors hover:border-terracotta/40">
              <p className="font-display text-xl text-ink">{d.title}</p>
              <p className="mt-2 text-sm text-ink-soft">{d.sub}</p>
              <p className="mt-3 text-xs text-muted">{d.pages}</p>
            </Card>
          </a>
        ))}
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
            originator. MIT-licensed at buildathon end. Curator grant $5K ARB per accepted adapter.
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
    </main>
  );
}
