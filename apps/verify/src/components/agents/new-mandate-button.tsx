'use client';

import { useEffect, useState } from 'react';
import { useChainId } from 'wagmi';
import { useDeploymentStatus, readinessMessage } from '@/lib/use-deployment-status';
import { VENUES } from '@/lib/venues';
import { Modal, ModalCloseButton } from '@/components/ui/modal';
import { useContractAddress } from '@/lib/use-coffer-address';
import { useIssueMandate } from '@/lib/use-issue-mandate';

const SIGIL_MAX_VENUES = 8;
const ZERO_ADDR = '0x' + '0'.repeat(40);

/**
 * Mandate-creation entry point. Audit P-11 fix: previously a dead button.
 * Now opens a real modal with the IntentSigil form (agent address, caps,
 * venue allowlist, expiry). When Sigil isn't deployed, the button is
 * disabled with an honest helper line.
 *
 * The form's `Sign mandate` action sends the EIP-712 envelope to the
 * connected Postern wallet for signature. Posts to
 * `/api/agents/issue-mandate` which forwards to Sigil.issueIntent once
 * the contract address lands in the deployments registry.
 */
export function NewMandateButton() {
  const [open, setOpen] = useState(false);
  // Sigil is step 7 in the Verifier flow (Kill Switch path) but the
  // mandate-creation path itself depends on Plinth (step 2) and Sigil
  // (covered by step 7's required contracts).
  const { data: deployment } = useDeploymentStatus(7);
  const helper = readinessMessage(deployment, 'New mandate');
  const ready = deployment?.ready === true;
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => ready && setOpen(true)}
        disabled={!ready}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-ink-dark disabled:opacity-50"
      >
        <span aria-hidden>+</span> New mandate
      </button>
      {helper && (
        <p className="text-right text-[10px] uppercase tracking-wider text-muted">{helper}</p>
      )}
      {/* Audit T-5 fix: single gate on `open` — MandateModal mounts once
          and Modal handles visibility. Avoids the divergent-gate footgun. */}
      <MandateModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

// Audit V-M1 fix: default allowed-venue set computed once. Otherwise the
// reset effect would create a fresh Set identity on every close → open,
// forcing a needless re-render of MandateModal even when the contents
// match. Building outside the component caches forever.
const DEFAULT_ALLOWED_IDS = [VENUES[0]?.id, VENUES[1]?.id].filter(Boolean) as string[];

function MandateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [agent, setAgent] = useState('');
  const [perActionCap, setPerActionCap] = useState('50');
  const [totalOpenCap, setTotalOpenCap] = useState('500');
  const [actionsPerDay, setActionsPerDay] = useState('24');
  const [expiresDays, setExpiresDays] = useState('14');
  const [allowed, setAllowed] = useState<Set<string>>(() => new Set(DEFAULT_ALLOWED_IDS));
  const [validationError, setValidationError] = useState<string | null>(null);

  const chainId = useChainId();
  const { data: sigilAddress } = useContractAddress('sigil');
  const { status, issue, reset } = useIssueMandate(sigilAddress ?? null, chainId);
  const busy = status.kind === 'signing' || status.kind === 'storing';

  // Audit U-4 fix: reset form + result on close → open transition.
  useEffect(() => {
    if (!open) {
      setAgent('');
      setPerActionCap('50');
      setTotalOpenCap('500');
      setActionsPerDay('24');
      setExpiresDays('14');
      setAllowed(new Set(DEFAULT_ALLOWED_IDS));
      setValidationError(null);
      reset();
    }
  }, [open, reset]);

  function toggleVenue(id: string) {
    setAllowed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    const a = agent.trim();
    setValidationError(null);
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) {
      setValidationError('Agent address must be 0x-prefixed 40-hex.');
      return;
    }
    // Audit R-2 fix: reject zero-address agent + over-cap venue allowlist
    // client-side too, so users see the error immediately.
    if (a.toLowerCase() === ZERO_ADDR) {
      setValidationError('Agent cannot be the zero address.');
      return;
    }
    if (allowed.size === 0) {
      setValidationError('Pick at least one allowed venue.');
      return;
    }
    if (allowed.size > SIGIL_MAX_VENUES) {
      setValidationError(`Sigil decoder caps allowlist at ${SIGIL_MAX_VENUES} venues.`);
      return;
    }
    // Audit U-17: previously this POSTed to /api/agents/issue-mandate and
    // displayed the server's "pending" message as the entire result. Now
    // it triggers a real EIP-712 wallet signature via wagmi
    // `useSignTypedData`. The signed envelope + intentHash flow through
    // useIssueMandate → /api/agents/issue-mandate so the server can store
    // it once Codex is wired. Failure modes surface the wallet's actual
    // error string (rejected, wrong chain, etc.) instead of a generic
    // "could not issue mandate."
    await issue({
      agent: a as `0x${string}`,
      perActionCapUsdc: parseFloat(perActionCap || '0'),
      totalOpenCapUsdc: parseFloat(totalOpenCap || '0'),
      actionsPerDay: parseInt(actionsPerDay || '0', 10),
      expiresDays: parseInt(expiresDays || '0', 10),
      venueAllowlist: [...allowed],
    });
  }

  return (
    <Modal open={open} onClose={onClose} label="New mandate">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-2xl italic text-ink">New mandate</p>
        <ModalCloseButton onClose={onClose} />
      </header>
        <p className="mt-2 text-sm text-ink-soft">
          Issue an Intent Sigil. The agent transacts within scope; your master key never moves.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted">Agent address</span>
            <input
              type="text"
              placeholder="0x…"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              className="mt-1 w-full rounded-md border border-divider bg-parchment-light px-3 py-2.5 font-mono text-sm text-ink focus:border-ink/40 focus:outline-none"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Per-action cap · USDC" value={perActionCap} onChange={setPerActionCap} />
            <NumberField label="Total open cap · USDC" value={totalOpenCap} onChange={setTotalOpenCap} />
            <NumberField label="Actions / day" value={actionsPerDay} onChange={setActionsPerDay} />
            <NumberField label="Expires in · days" value={expiresDays} onChange={setExpiresDays} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Venues allowed</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {VENUES.map((v) => {
                const isOn = allowed.has(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleVenue(v.id)}
                    className={
                      'rounded-md border px-2 py-1.5 text-xs font-mono transition-colors ' +
                      (isOn
                        ? 'border-ink bg-ink text-parchment'
                        : 'border-divider bg-parchment text-ink-soft hover:border-ink/30')
                    }
                  >
                    {v.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-6 w-full rounded-md bg-ink px-4 py-3 text-sm font-medium text-parchment disabled:opacity-50"
        >
          {buttonLabel(status, busy)}
        </button>
        {validationError && (
          <div className="mt-3 rounded-md border border-neg/40 bg-neg/5 p-3 text-xs text-neg">
            {validationError}
          </div>
        )}
        {status.kind === 'success' && (
          <div className="mt-3 rounded-md border border-live/40 bg-live-soft p-3 text-xs text-live">
            <p>
              Mandate signed. Intent hash:{' '}
              <span className="font-mono">
                {status.intentHash.slice(0, 10)}…{status.intentHash.slice(-6)}
              </span>
            </p>
            <p className="mt-1 text-ink-soft">
              Share the hash with the agent. They reference it on every action they take
              under your scope.
            </p>
          </div>
        )}
        {status.kind === 'error' && (
          <div className="mt-3 rounded-md border border-neg/40 bg-neg/5 p-3 text-xs text-neg">
            <p>{humanizeIssueError(status.reason)}</p>
          </div>
        )}
      <p className="mt-3 text-[9px] uppercase tracking-wider text-muted">
        Mandate is an EIP-712 IntentSigil envelope; Sigil.validate_action enforces the caps on
        every agent-driven open_position call.
      </p>
    </Modal>
  );
}

function buttonLabel(
  status: ReturnType<typeof useIssueMandate>['status'],
  busy: boolean,
): string {
  if (status.kind === 'signing') return 'Waiting for wallet…';
  if (status.kind === 'storing') return 'Storing envelope…';
  if (status.kind === 'success') return 'Issue another mandate';
  if (busy) return 'Sending to Postern…';
  return 'Sign mandate';
}

function humanizeIssueError(reason: string): string {
  // Audit U-44: normalized to lowercase no-period to match the
  // convention used by humanizeReason in vault/deposit-card,
  // vault/withdraw-card, and humanizeOpenReason in trade/order-form.
  // Pre-fix this one used sentence-case + trailing periods — the only
  // outlier. Founder-voice (writing.md): plain, conversational copy.
  if (reason === 'wallet_not_connected') return 'connect wallet first';
  if (reason === 'sigil_not_deployed')
    return 'Sigil is not deployed on this network — mandate signing lights up Month 1 W2';
  if (reason === 'signature_rejected') return 'wallet rejected the signature';
  if (reason.startsWith('Unknown venue slug:')) return reason;
  return reason.slice(0, 200);
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-divider bg-parchment-light px-3 py-2.5 font-mono text-sm text-ink focus:border-ink/40 focus:outline-none"
      />
    </label>
  );
}
