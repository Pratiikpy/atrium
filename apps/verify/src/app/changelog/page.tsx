import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';
import { Card, Tag, RecessedCard } from '@/components/ui';

/**
 * /changelog — a human-readable view of `docs/AUDIT_FINDINGS.md`.
 *
 * Every patch wave has a row. The list is authored manually here so the
 * wording matches the audit register one-for-one; the source-of-truth
 * remains `docs/AUDIT_FINDINGS.md` which a CI step could one-day generate
 * this page from.
 */
export const metadata = {
  title: 'Atrium · Changelog',
  description: 'Every patch wave landed in the build. 94+ patches across audit Waves F–N.',
};

interface Wave {
  id: string;
  date: string;
  scope: string;
  highlight: string;
  count: number;
}

const WAVES: Wave[] = [
  {
    id: 'N',
    date: '2026-05-18',
    scope: 'UI · desing/ fidelity',
    highlight: 'Live breathing favicon, Geist body font, middot title separator, brand-kit page, full app shell (Trade / Portfolio / Vault / Agents / Markets / Settings), Team page, Manifesto page',
    count: 14,
  },
  {
    id: 'M',
    date: '2026-05-18',
    scope: 'Docs · PRD + TDD canon',
    highlight: 'PRD §28.9 + TDD §24.6–§24.9 with Wave F–L summary; ADRs 009–012 (camelCase ABI, uniform pause, x402 on-chain authoritative, agent encoders); LAUNCH_READINESS resolved-list',
    count: 12,
  },
  {
    id: 'L',
    date: '2026-05-18',
    scope: 'Docs · judge-facing',
    highlight: 'JUDGE_ONE_PAGER concrete backtest numbers, per-URL deploy month, README Windows precondition + make demo-frontend, em-dash + banned-word scrub',
    count: 11,
  },
  {
    id: 'K',
    date: '2026-05-18',
    scope: 'Integration glue',
    highlight: 'Subgraph CrossChainCredit signature fix, ABI extractor, 4 Aqueduct lifecycle handlers, 6 pause-state handlers, IntentValidated handler, CI publishes kani-status.json, Playwright e2e workflow',
    count: 10,
  },
  {
    id: 'J',
    date: '2026-05-18',
    scope: 'Frontend',
    highlight: 'Kani badge fetches real CI, Verifier deployment-readiness banner, Chaos page error branch, banned-word scrub, WagmiProvider route-scoped, Lantern six UI states',
    count: 8,
  },
  {
    id: 'I',
    date: '2026-05-18',
    scope: 'Off-chain services',
    highlight: 'Codex x402 USDC Transfer-log verification + 12 confirms + D1 replay dedup, Praetor CLI keystore-preferred, UK CGT two-pass HMRC, US IRC §1091 wash-sale, Lantern scrypt-N enforcement',
    count: 8,
  },
  {
    id: 'H',
    date: '2026-05-18',
    scope: 'Contracts · interface tail',
    highlight: 'Aqueduct + Rostrum camelCase, Sigil dynamic-array decoder, Plinth reentrancy guard at entry, strict ecrecover v accept-list',
    count: 4,
  },
  {
    id: 'G',
    date: '2026-05-18',
    scope: 'Contracts · core',
    highlight: 'Stylus camelCase ABI rewrite system-wide, Sigil real ecrecover via precompile 0x01, uniform pause(string) ABI, instrument_key keccak fix, EIP-712 attestation domain binding, Polymarket quorum, tx.origin→originator across adapters',
    count: 11,
  },
  {
    id: 'F',
    date: '2026-05-18',
    scope: 'Contracts · first pass',
    highlight: 'Sigil decoder + storage type, Hyperliquid ReentrancyGuard + tx.origin removal, Praetor CLI real implementations, Aqueduct emergency-pause, zero-address admin guards',
    count: 7,
  },
  {
    id: '0',
    date: '2026-05-18',
    scope: 'Original audit register',
    highlight: 'First 6-agent parallel audit, 35 findings opened, 35 patched into source before Wave F',
    count: 35,
  },
];

const TOTAL = WAVES.reduce((s, w) => s + w.count, 0);

export default function ChangelogPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="flex items-center justify-between">
        <Wordmark size="md" />
        <nav className="flex gap-6 text-sm text-ink-soft">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/security" className="hover:text-ink">Security</Link>
          <Link href="/app" className="hover:text-ink">App</Link>
        </nav>
      </header>

      <section className="mt-16">
        <h1 className="font-display text-5xl text-ink">Changelog</h1>
        <p className="mt-4 max-w-prose text-ink-soft">
          Every patch wave landed in the build, with the audit-ID register at
          <code className="font-mono text-ink"> docs/AUDIT_FINDINGS.md</code> as the source of truth.
          Total: {TOTAL} patches across {WAVES.length} waves.
        </p>
      </section>

      <RecessedCard className="mt-10">
        <p className="text-sm text-ink-soft">
          Each wave is a parallel-audit pass that found problems, plus the patches that closed them.
          Every wave was triggered by the cron loop running every minute saying "find what is still broken."
          Honesty principle: no wave is "complete," every wave caught what the previous one missed.
        </p>
      </RecessedCard>

      <ol className="mt-10 space-y-4">
        {WAVES.map((w) => (
          <li key={w.id}>
            <Card>
              <header className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-3xl text-ink">Wave {w.id}</span>
                  <span className="text-xs uppercase tracking-wider text-muted">{w.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Tag>{w.scope}</Tag>
                  <Tag>{w.count} patches</Tag>
                </div>
              </header>
              <p className="mt-3 text-sm text-ink-soft">{w.highlight}</p>
            </Card>
          </li>
        ))}
      </ol>

      <footer className="mt-16 border-t border-divider pt-6 text-xs text-muted">
        Source: <code className="font-mono text-ink">docs/AUDIT_FINDINGS.md</code>. Anyone can re-run the audit cron by
        spawning the parallel-audit sub-agent on a fresh contract state.
      </footer>
    </main>
  );
}
