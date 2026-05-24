import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight } from 'lucide-react';

/**
 * The 7 scripted Verifier steps. Each links to a step page that, when
 * clicked, fires a real testnet transaction and shows the resulting
 * Arbiscan link.
 *
 * Steps per PRD §26.1 demo runbook.
 */
const STEPS = [
  { n: 1, title: 'Deposit USDC into Coffer', detail: 'Postern passkey → ERC-4626 deposit' },
  { n: 2, title: 'Open hedged position', detail: 'HIP-3 perp + Aave Horizon T-bill, atomic' },
  { n: 3, title: 'See the margin saving', detail: 'Plinth recomputes; SPAN nets the hedge' },
  { n: 4, title: 'Trigger Chaos Mode', detail: 'Random fault: oracle drift, keeper offline, partial fill' },
  { n: 5, title: 'Run liquidation drill', detail: 'Vigil keeper executes partial liquidation' },
  { n: 6, title: 'Verify proof of reserves', detail: 'Lantern Merkle root + inclusion proof' },
  { n: 7, title: 'Kill Switch revoke', detail: 'Every Sigil mandate + session key in one tx' },
] as const;

export function VerifierStepList() {
  return (
    <ol className="mt-8 grid gap-4 sm:grid-cols-2">
      {STEPS.map((step) => (
        <li key={step.n}>
          <Link
            href={`/verify/${step.n}` as Route}
            className="group block rounded-md border border-divider bg-parchment p-5 transition-colors hover:border-ink/30 hover:bg-parchment-soft/40"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted">step {step.n}</span>
              <ArrowRight className="size-4 text-muted transition-colors group-hover:text-ink" aria-hidden />
            </div>
            <h3 className="mt-2 text-base font-medium text-ink">{step.title}</h3>
            <p className="mt-1 text-sm text-ink-soft">{step.detail}</p>
          </Link>
        </li>
      ))}
    </ol>
  );
}
