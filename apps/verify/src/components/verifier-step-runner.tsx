'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { Check, ExternalLink, Info, Triangle } from 'lucide-react';
import { arbiscanTxUrl } from '@/lib/arbiscan';
import { getStepConfig } from '@/lib/verifier-step-config';
import { useContractAddress } from '@/lib/use-coffer-address';
import { useVaultDeposit } from '@/lib/use-vault-deposit';
import { useKillSwitch } from '@/lib/use-kill-switch';
import { useLanternVerify } from '@/lib/use-lantern-verify';
import { useChaosInject } from '@/lib/use-chaos-inject';
import { ConfirmModal } from '@/components/ui/confirm-modal';

interface RunState {
  status: 'idle' | 'connecting' | 'pending' | 'success' | 'error';
  txHash?: string;
  errorMessage?: string;
  // Use-everything audit fix (2026-06-03): some steps succeed WITHOUT a tx hash
  // (Chaos inject returns a recovery time; Lantern inclusion returns a proof
  // result). The success UI used to render ONLY an Arbiscan link, so those steps
  // showed nothing on success and looked like dead buttons. successNote carries
  // a human result so every success is visible, with the tx link when there is one.
  successNote?: string;
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
  // A11Y-13: Kill Switch confirmation via accessible modal instead of window.confirm
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  // Audit J-C2 fix: detect whether the step contract is deployed on Sepolia.
  const [deploymentReady, setDeploymentReady] = useState<boolean | null>(null);
  const [deploymentBlocker, setDeploymentBlocker] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/deployments/status?step=' + step)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status_${r.status}`))))
      .then((j: { ready?: boolean; blocker?: string | null }) => {
        if (!cancelled) {
          setDeploymentReady(Boolean(j.ready));
          setDeploymentBlocker(j.blocker ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setDeploymentReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

  const config = getStepConfig(step);

  // All hooks called unconditionally at the top (rules-of-hooks compliance)
  const { data: cofferAddress } = useContractAddress('coffer');
  const { data: killSwitchAddress } = useContractAddress('postern-kill-switch');
  const vaultDeposit = useVaultDeposit(cofferAddress ?? null);
  const killSwitch = useKillSwitch(killSwitchAddress ?? null);
  const lantern = useLanternVerify();
  const chaos = useChaosInject();

  // Bridge each hook's status into this component's RunState
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
  useEffect(() => {
    const s = lantern.status;
    if (s.kind === 'idle') return;
    if (s.kind === 'reading-attestation' || s.kind === 'verifying') {
      setRun({ status: 'pending' });
    } else if (s.kind === 'success') {
      if (s.result.ok) {
        setRun({
          status: 'success',
          successNote: 'Verified: your wallet is included in the latest Lantern attestation tree, and the published tree hashes to the on-chain attested root.',
        });
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
  useEffect(() => {
    const s = chaos.status;
    if (s.kind === 'idle') return;
    if (s.kind === 'submitting') {
      setRun({ status: 'pending' });
    } else if (s.kind === 'success') {
      setRun({
        status: 'success',
        successNote:
          s.recoveredInMs != null
            ? `Fault "${s.fault}" injected; the system detected it and recovered in ${s.recoveredInMs}ms via the graceful-degradation path.`
            : `Fault "${s.fault}" injected; the graceful-degradation path engaged.`,
      });
    } else if (s.kind === 'error') {
      setRun({ status: 'error', errorMessage: s.reason });
    }
  }, [chaos.status]);

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
          aria-disabled={!connector || connectStatus === 'pending'}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-3 text-sm min-h-[44px] font-medium text-parchment hover:bg-ink/90 disabled:opacity-60"
        >
          {connectStatus === 'pending' ? (
            <>
              <span className="inline-block size-4 animate-pulse rounded-full bg-parchment/60" aria-hidden /> Connecting…
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

  const handleRun = async () => {
    if (!deploymentReady) return; // button is disabled in this case; guard anyway
    if (!config) {
      setRun({ status: 'error', errorMessage: `Unknown step ${step}.` });
      return;
    }
    // Kill Switch (step 7) is irreversible. Per ui.md §Verifier Mode rules
    // and audit D-29: require explicit confirm before firing.
    if (step === 7) {
      setShowKillConfirm(true);
      return;
    }
    executeStep();
  };

  const executeStep = async () => {
    if (!config) return;
    setRun({ status: 'pending' });
    try {
      // Audit U-16: dispatch the real action per step config. Step 1
      // (Coffer deposit) shipped first because it shares its write path
      // with /app/vault. Other steps surface the named blocker, the
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
            <Info className="size-4" aria-hidden /> Step not ready
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {deploymentBlocker
              ? `Blocker: ${deploymentBlocker.replace(/-/g, ' ')}. `
              : ''}
            The contract for step {step} is not fully wired on this network.
            The button is disabled until the on-chain state is ready.
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
            <span className="inline-block size-4 animate-pulse rounded-full bg-parchment/60" aria-hidden /> Submitting…
          </>
        ) : (
          `Run step ${step}`
        )}
      </button>

      {/* Audit QQ-1 + SS-1 fix: shared arbiscanTxUrl helper regex-gates the
          hash + builds the URL (failed-regex returns null, no fake link).
          Use-everything fix (2026-06-03): always render a visible success
          confirmation (successNote, or a generic line) so steps that succeed
          WITHOUT a tx hash (Chaos, Lantern inclusion) are no longer silent;
          the Arbiscan link is shown additionally when a real tx hash exists. */}
      {run.status === 'success' && (() => {
        const url = arbiscanTxUrl(run.txHash);
        return (
          <div className="rounded-md border border-live/40 bg-live/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-live">
              <Check className="size-4" aria-hidden /> {run.successNote ?? 'Step completed.'}
            </p>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 text-sm text-live hover:underline"
              >
                View on Arbiscan
                <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </div>
        );
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

      {/* A11Y-13: Accessible kill-switch confirmation */}
      <ConfirmModal
        open={showKillConfirm}
        onConfirm={() => { setShowKillConfirm(false); executeStep(); }}
        onCancel={() => setShowKillConfirm(false)}
        title="Kill Switch"
        description="Revoke every Sigil mandate AND cancel every active session key for this wallet. This cannot be undone with the same keys. Continue?"
        confirmLabel="Activate Kill Switch"
        destructive
      />
    </div>
  );
}
