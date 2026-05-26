import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Wordmark } from '@/components/wordmark';
import { VerifierStepRunner } from '@/components/verifier-step-runner';
import { WagmiProviders } from '@/components/wagmi-providers';

/**
 * Per-step page for the 7-step Verifier flow.
 *
 * Each step has a description, a primary action button, and a transaction
 * result panel. Tx links open Arbiscan.
 *
 * If JS fails or the user has no wallet, the page still renders with a
 * clear empty state — per docs/conventions/ui.md (empty + error + loading + permission states required).
 */

const STEP_CONFIG = {
  '1': {
    title: 'Deposit USDC into Coffer',
    body: 'Postern issues a passkey-bound smart wallet. Coffer locks 1,000 USDC and mints ERC-4626 shares. Plinth opens a fresh margin account.',
    contract: 'Coffer.deposit',
    nextStep: 2,
  },
  '2': {
    // Phase theta (2026-05-25 audit follow-up): pre-fix this body
    // described "two parallel transactions" but the Verifier UI only
    // exposes a single-leg open today. Hedged-flow ships in a follow-up
    // (paired with the AtriumRouter batch-open helper). Until then the
    // copy describes the single-leg path the user actually runs.
    title: 'Open a position',
    body: 'Open a position through AtriumRouter — Plinth records the margin row, Coffer routes USDC to the selected venue adapter, the adapter opens the venue side. Hedged batch flow lands in a follow-up release.',
    contract: 'AtriumRouter.open_position_via_adapter',
    nextStep: 3,
  },
  '3': {
    title: 'See the margin saving',
    body: 'Plinth runs the SPAN scenario matrix. With both positions in the same correlation class, net exposure cancels under every scenario. Required margin drops sharply vs unhedged isolated margin.',
    contract: 'Plinth.update_margin',
    nextStep: 4,
  },
  '4': {
    title: 'Trigger Chaos Mode',
    body: 'Random fault injection: oracle drift, keeper offline, partial-fill failure, gas spike, indexer stall. Each fault has a graceful degradation path. The UI announces what is happening.',
    contract: 'ChaosAgent (off-chain)',
    nextStep: 5,
  },
  '5': {
    title: 'Run liquidation drill',
    body: 'Vigil queues a liquidation job. The first available keeper executes a partial close (10% of position). Margin recovers. Position survives.',
    contract: 'Vigil.execute_liquidation',
    nextStep: 6,
  },
  '6': {
    title: 'Verify proof of reserves',
    // Phase theta-followup (2026-05-25): cadence updated. Pre-fix said
    // "hourly Merkle roots" but Phase θ.3 moved Lantern from Vercel
    // daily cron to a GHA cron running every 10 minutes — 6× the
    // resolution.
    body: 'Lantern publishes a fresh Merkle root every 10 minutes via GHA cron. The page shows your balance as a Merkle leaf with a verifiable inclusion proof against the latest root.',
    contract: 'Lantern.AttestationPublished',
    nextStep: 7,
  },
  '7': {
    title: 'Kill Switch revoke',
    body: 'One tap. Every Sigil mandate revoked. Every Postern session key cancelled. Your wallet returns to pure base-EOA control in a single batched transaction.',
    contract: 'PosternKillSwitch.activate',
    nextStep: null,
  },
} as const;

export default async function VerifyStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  const cfg = STEP_CONFIG[step as keyof typeof STEP_CONFIG];
  if (!cfg) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <header className="mb-12 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to overview
        </Link>
        <Wordmark size="sm" />
      </header>

      <p className="text-xs uppercase tracking-wider text-muted">step {step} of 7</p>
      <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">{cfg.title}</h1>
      <p className="mt-6 max-w-prose text-balance text-lg text-ink-soft">{cfg.body}</p>
      <p className="mt-2 text-sm text-muted">
        Contract: <code className="font-mono text-ink">{cfg.contract}</code>
      </p>

      {/* Audit J-H6: wagmi only mounts on routes that use wallet hooks. */}
      <WagmiProviders>
        <VerifierStepRunner step={parseInt(step, 10)} />
      </WagmiProviders>

      {cfg.nextStep && (
        // Direct string interpolation: typed-routes was serialising the
        // pathname-object form literally as `/verify/[step]?step=2` in the
        // production build, breaking step navigation. Cast to Route keeps
        // Next.js's typedRoutes feature happy without the leaky placeholder.
        <Link
          href={`/verify/${cfg.nextStep}` as Route}
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-parchment hover:bg-ink/90"
        >
          Next step
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </main>
  );
}

export function generateStaticParams() {
  return Object.keys(STEP_CONFIG).map((step) => ({ step }));
}
