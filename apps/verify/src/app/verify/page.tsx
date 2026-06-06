import Link from 'next/link';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { STEP_CONFIG } from './[step]/page';

/**
 * Verifier overview, the entry point + map for the 7-step "verify every
 * claim" flow. Each step page links back here ("Back to overview"), and the
 * landing CTA points here so a judge lands on the full sequence before
 * stepping in. Step titles/contracts come from the single STEP_CONFIG source
 * of truth in ./[step]/page.tsx so the overview can never drift from the steps.
 */

export const metadata: Metadata = {
  title: 'Verifier, every claim, on-chain',
  description:
    'Seven steps, each backed by a real contract call on Arbitrum Sepolia: deposit, open, margin, chaos, liquidation, proof-of-reserves, kill switch.',
  alternates: { canonical: '/verify' },
};

const STEPS = Object.entries(STEP_CONFIG).map(([step, cfg]) => ({ step, ...cfg }));

export default function VerifierOverviewPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow text-xs uppercase tracking-wider text-muted">Verifier</p>
        <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">Verify every claim</h1>
        <p className="mt-6 max-w-prose text-balance text-lg text-ink-soft">
          Atrium makes seven claims. Each is a real contract on Arbitrum Sepolia you can read and
          check on Arbiscan, no trust required. The four live steps you can run end to end yourself;
          three are pending on testnet and show their blocker. Start at step one, or jump to any step.
        </p>

        <ol className="mt-10 space-y-3">
          {STEPS.map(({ step, title, contract }) => (
            <li key={step}>
              <Link
                href={`/verify/${step}` as Route}
                className="group flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4 transition-colors hover:border-ink/30"
              >
                <span className="flex items-baseline gap-4">
                  <span className="font-mono text-sm text-muted">{step.padStart(2, '0')}</span>
                  <span>
                    <span className="block text-base text-ink">{title}</span>
                    <span className="mt-0.5 block font-mono text-xs text-muted">{contract}</span>
                  </span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ol>

        <Link
          href={'/verify/1' as Route}
          className="mt-10 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-parchment hover:bg-ink/90"
        >
          Start at step 1
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </MarketingShell>
  );
}
