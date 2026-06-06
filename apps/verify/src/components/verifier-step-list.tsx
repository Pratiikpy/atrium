import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight } from 'lucide-react';

/**
 * The 7 scripted Verifier steps. Four (deposit, chaos, proof-of-reserves, kill
 * switch) fire a real testnet transaction you can run end to end today. Three
 * (open a position, the margin saving, the liquidation drill) are pending on
 * testnet and their step page shows the blocker reason rather than a fake run,
 * so they are tagged "pending" here too. Mirrors `pending: true` in
 * src/lib/verifier-step-config.ts.
 *
 * Steps per PRD §26.1 demo runbook.
 */
const STEPS = [
  { n: 1, title: 'Deposit USDC into Coffer', detail: 'Postern passkey → ERC-4626 deposit' },
  { n: 2, title: 'Open a position', detail: 'Single-leg open via AtriumRouter, hedged batch in a follow-up', pending: true },
  { n: 3, title: 'See the margin saving', detail: 'Plinth recomputes; SPAN nets the hedge', pending: true },
  { n: 4, title: 'Trigger Chaos Mode', detail: 'Random fault: oracle drift, keeper offline, partial fill' },
  { n: 5, title: 'Run liquidation drill', detail: 'Vigil keeper executes partial liquidation', pending: true },
  { n: 6, title: 'Verify proof of reserves', detail: 'Lantern Merkle root + inclusion proof' },
  { n: 7, title: 'Kill Switch revoke', detail: 'Every Sigil mandate + session key in one tx' },
] as const;

export function VerifierStepList() {
  return (
    <ol className="mt-8 grid gap-4 sm:grid-cols-2">
      {STEPS.map((step) => {
        const pending = 'pending' in step;
        return (
          <li key={step.n}>
            <Link
              href={`/verify/${step.n}` as Route}
              className="group block rounded-md border border-divider bg-parchment p-5 transition-colors hover:border-ink/30 hover:bg-parchment-soft/40"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-muted">step {step.n}</span>
                {pending ? (
                  <span className="text-[10px] uppercase tracking-wider text-testnet">pending on testnet</span>
                ) : (
                  <ArrowRight className="size-4 text-muted transition-colors group-hover:text-ink" aria-hidden />
                )}
              </div>
              <h3 className="mt-2 text-base font-medium text-ink">{step.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{step.detail}</p>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
