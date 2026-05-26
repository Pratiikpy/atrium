'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { Check, ExternalLink, Info, Loader2, Triangle } from 'lucide-react';
import { arbiscanTxUrl } from '@/lib/arbiscan';
import { getStepConfig } from '@/lib/verifier-step-config';
import { useContractAddress } from '@/lib/use-coffer-address';
import { useVaultDeposit } from '@/lib/use-vault-deposit';
import { useKillSwitch } from '@/lib/use-kill-switch';
import { useLanternVerify } from '@/lib/use-lantern-verify';
import { useChaosInject } from '@/lib/use-chaos-inject';

interface RunState {
  status: 'idle' | 'connecting' | 'pending' | 'success' | 'error';
  txHash?: string;
  errorMessage?: string;
}

/**
 * Client-side runner for a single Verifier step.
 *
 * Required states (per docs/conventions/ui.md):
 *   - empty (no wallet connected → Connect button)
 *   - loading (tx pending → spinner with message)
 *   - error (tx failed → clear cause + retry)
 *   - success (tx confirmed → Arbiscan link)
 *   - permission (wrong chain, wrong tier → guidance)
 *
 * Real wiring lands Month 2 when the contracts deploy to Sepolia. This
 * component is the scaffolding the wiring drops into; no fake tx hashes,
 * no fake success states.
 */
export function VerifierStepRunner({ step }: { step: number }) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, status: connectStatus } = useConnect();
  const [run, setRun] = useState<RunState>({ status: 'idle' });
  // Audit J-C2 fix: detect whether the step contract is deployed on Sepolia.
  // The prior code unconditionally threw "Step contract not yet deployed",
  // which presented a half-feature as a working button. Now we surface the
  // deployment status above the button and disable the action honestly.
  const [deploymentReady, setDeploymentReady] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/deployments/status?step=' + step)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status_${r.status}`))))
      .then((j: { ready?: boolean }) => {
        if (!cancelled) setDeploymentReady(Boolean(j.ready));
      })
      .catch(() => {
        if (!cancelled) setDeploymentReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

  // Empty state: no wallet
  if (!isConnected) {
    const connector = connectors[0];
    return (
      <div className="mt-8 rounded-md border border-divider bg-parchment-soft/40 p-6">
        <p className="text-sm text-ink-soft">
          Connect a wallet to run this step. Postern passkey works without a browser extension.
        </p>
        <button
          type="button"
          onClick={() => connector && connect({ connector })}
          disabled={!connector || connectStatus === 'pending'}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-3 text-sm min-h-[44px] font-medium text-parchment hover:bg-ink/90 disabled:opacity-60"
        >
          {connectStatus === 'pending' ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Connecting
            </>
          ) : (
            'Connect with Postern'
          )}
        </button>
      </div>
    );
  }

  // Permission state: wrong chain
  if (chain?.id !== 421614) {
    return (
      <div className="mt-8 rounded-md border border-testnet/30 bg-testnet/5 p-6">
        <p className="text-sm font-medium text-testnet">Switch to Arbitrum Sepolia</p>
        <p className="mt-2 text-sm text-ink-soft">
          Verifier Mode runs on testnet only. Your wallet is on {chain?.name ?? 'an unknown chain'}.
        </p>
      </div>
    );
  }

  const config = getStepConfig(step);
  // Step-specific wagmi wiring. Address-gated hooks return no-op state
  // machines until the contract is deployed; only the matching step
  // actually invokes its hook on click.
  const { data: cofferAddress } = useContractAddress('coffer');
  const { data: killSwitchAddress } = useContractAddress('postern-kill-switch');
  const vaultDeposit = useVaultDeposit(cofferAddress ?? null);
  const killSwitch = useKillSwitch(killSwitchAddress ?? null);
  const lantern = useLanternVerify();
  const chaos = useChaosInject();

  // Bridge each hook's status into this component's RunState so the
  // existing success/error/loading UI keeps working without per-step UI
  // rewrites.
  useEffect(() => {
    const s = vaultDeposit.status;
    if (s.kind === 'idle') return;
    if (s.kind === 'checking') setRun({ status: 'pending' });
    else if (s.kind === 'approving' || s.kind === 'depositing') setRun({ status: 'pending' });
    else if (s.kind === 'success') setRun({ status: 'success', txHash: s.depositHash });
    else if (s.kind === 'error') setRun({ status: 'error', errorMessage: s.reason });
  }, [vaultDeposit.status]);
  useEffect(() => {
    const s = killSwitch.status;
    if (s.kind === 'idle') return;
    if (s.kind === 'submitting') setRun({ status: 'pending' });
    else if (s.kind === 'success') setRun({ status: 'success', txHash: s.hash });
    else if (s.kind === 'error') setRun({ status: 'error', errorMessage: s.reason });
  }, [killSwitch.status]);
  // Audit U-26: bridge useLanternVerify's status into the runner's
  // RunState. Lantern verify is read-only (no tx hash) — the success
  // payload carries the inclusion-proof result, which surfaces via the
  // error message slot when the user is not in the tree (honest negative).
  useEffect(() => {
    const s = lantern.status;
    if (s.kind === 'idle') return;
    if (s.kind === 'reading-attestation' || s.kind === 'verifying') {
      setRun({ status: 'pending' });
    } else if (s.kind === 'success') {
      if (s.result.ok) {
        setRun({ status: 'success' });
      } else {
        setRun({
          status: 'error',
          errorMessage:
            s.result.reason ||
            'Wallet not found in the latest Lantern attestation tree.',
        });
      }
    } else if (s.kind === 'error') {
      setRun({ status: 'error', errorMessage: s.reason });
    }
  }, [lantern.status]);
  // Audit U-27: bridge useChaosInject's status. Off-chain action — no tx
  // hash. The success payload optionally carries a `recoveredInMs`
  // measurement we forward into the error-message slot (used as a generic
  // "details" line by the runner UI).
  useEffect(() => {
    const s = chaos.status;
    if (s.kind === 'idle') return;
    if (s.kind === 'submitting') {
      setRun({ status: 'pending' });
    } else if (s.kind === 'success') {
      setRun({ status: 'success' });
    } else if (s.kind === 'error') {
      setRun({ status: 'error', errorMessage: s.reason });
    }
  }, [chaos.status]);

  const handleRun = async () => {
    if (!deploymentReady) return; // button is disabled in this case; guard anyway
    if (!config) {
      setRun({ status: 'error', errorMessage: `Unknown step ${step}.` });
      return;
    }
    // Kill Switch (step 7) is irreversible. Per ui.md §Verifier Mode rules
    // and audit D-29: require explicit confirm before firing.
    if (step === 7) {
      const ok = window.confirm(
        'Kill Switch: revoke every Sigil mandate AND cancel every active session key for this wallet. This cannot be undone with the same keys. Continue?',
      );
      if (!ok) return;
    }
    setRun({ status: 'pending' });
    try {
      // Audit U-16: dispatch the real action per step config. Step 1
      // (Coffer deposit) shipped first because it shares its write path
      // with /app/vault. Other steps surface the named blocker — the
      // button is disabled when the contract isn't deployed, but if the
      // operator manually flips ready=true in the registry for a step
      // we haven't wired, this error message names exactly what's missing.
      switch (config.action.kind) {
        case 'coffer-deposit':
          await vaultDeposit.deposit(config.action.amountUsd);
          return; // status flows through the effect above
        case 'postern-kill-switch':
          await killSwitch.activate();
          return; // status flows through the effect above
        case 'lantern-verify':
          await lantern.verify();
          return; // status flows through the effect above
        case 'chaos-inject':
          await chaos.inject(chaos.defaultFault);
          return; // status flows through the effect above
        case 'plinth-open-position':
        case 'plinth-recompute-margin':
        case 'vigil-liquidate':
          throw new Error(config.pendingReason);
      }
    } catch (err) {
      setRun({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="mt-8 space-y-4">
      <p className="text-sm text-muted">
        Wallet:{' '}
        <code className="font-mono text-ink">
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </code>{' '}
        · Chain: Arbitrum Sepolia
      </p>

      {deploymentReady === false && (
        <div className="rounded-md border border-testnet/30 bg-testnet/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-testnet">
            <Info className="size-4" aria-hidden /> Step not wired yet
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            The contract for step {step} is not registered in this network&apos;s deployment
            file. The button is disabled until F1 lands the wiring (Month 2 W1 per docs/ROADMAP.md).
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleRun}
        disabled={run.status === 'pending' || deploymentReady !== true}
        className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm min-h-[44px] font-medium text-parchment hover:bg-ink/90 disabled:opacity-60"
      >
        {run.status === 'pending' ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Submitting
          </>
        ) : (
          `Run step ${step}`
        )}
      </button>

      {/* Audit QQ-1 + SS-1 fix: shared arbiscanTxUrl helper regex-gates the
          hash + builds the URL. Failed-regex returns null so we fall through
          to no link displayed — matches "no fake success states". */}
      {run.status === 'success' && (() => {
        const url = arbiscanTxUrl(run.txHash);
        return url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-live hover:underline"
          >
            <Check className="size-4" aria-hidden />
            View on Arbiscan
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null;
      })()}

      {run.status === 'error' && (
        <div className="rounded-md border border-neg/40 bg-neg/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-neg">
            <Triangle className="size-4" aria-hidden /> Did not complete
          </p>
          <p className="mt-1 text-sm text-ink-soft">{run.errorMessage}</p>
          <button
            type="button"
            onClick={() => setRun({ status: 'idle' })}
            className="mt-3 text-sm font-medium text-ink underline-offset-2 hover:underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
