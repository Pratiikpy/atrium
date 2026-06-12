'use client';

import { useEffect, useState } from 'react';
import { useChainId } from 'wagmi';
import { useDeploymentStatus, readinessMessage } from '@/lib/use-deployment-status';
import { VENUES } from '@/lib/venues';
import { Modal, ModalCloseButton } from '@/components/ui/modal';
import { useContractAddress } from '@/lib/use-coffer-address';
import { useChainGuard } from '@/lib/use-chain-guard';
import { useIssueMandate } from '@/lib/use-issue-mandate';
import { sanitizeAmount } from '@/lib/sanitize-amount';
import { humanizeWalletError } from '@/lib/humanize-wallet-error';

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
/** Recommended caps for a copied mandate (audit #50). */
export interface MandatePrefill {
  perActionUsd: number;
  dailyUsd: number;
  expiryDays: number;
}

export function NewMandateButton({
  prefill,
  prefillLabel,
  autoOpen = false,
}: {
  /** Audit #50: when set, the modal pre-fills these caps (copy-trade funnel). */
  prefill?: MandatePrefill;
  /** e.g. "Copying Augur, recommended caps prefilled". */
  prefillLabel?: string;
  /** Auto-open the modal on mount once deployment is ready (deep-link landing). */
  autoOpen?: boolean;
} = {}) {
  const [open, setOpen] = useState(false);
  const autoOpenedRef = useState({ done: false })[0];
  // Sigil is step 7 in the Verifier flow (Kill Switch path) but the
  // mandate-creation path itself depends on Plinth (step 2) and Sigil
  // (covered by step 7's required contracts).
  const { data: deployment } = useDeploymentStatus(7);
  const helper = readinessMessage(deployment, 'New mandate');
  const ready = deployment?.ready === true;

  // Audit #50: deep-link landing (?copy=<agent>) auto-opens the prefilled modal
  // once the contract path is ready, so the marketplace "Copy with recommended
  // caps" link actually funnels into a prefilled mandate instead of dead-ending.
  useEffect(() => {
    if (autoOpen && ready && !autoOpenedRef.done) {
      autoOpenedRef.done = true;
      setOpen(true);
    }
  }, [autoOpen, ready, autoOpenedRef]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => ready && setOpen(true)}
        disabled={!ready}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-ink-dark disabled:opacity-50"
      >
        <span aria-hidden>+</span> {prefillLabel ? 'Copy mandate' : 'New mandate'}
      </button>
      {prefillLabel && (
        <p className="text-right text-[10px] uppercase tracking-wider text-accent">{prefillLabel}</p>
      )}
      {helper && (
        <p className="text-right text-[10px] uppercase tracking-wider text-muted">{helper}</p>
      )}
      {/* Audit T-5 fix: single gate on `open`, MandateModal mounts once
          and Modal handles visibility. Avoids the divergent-gate footgun. */}
      <MandateModal open={open} onClose={() => setOpen(false)} prefill={prefill} prefillLabel={prefillLabel} />
    </div>
  );
}

// Audit V-M1 fix: default allowed-venue set computed once. Otherwise the
// reset effect would create a fresh Set identity on every close → open,
// forcing a needless re-render of MandateModal even when the contents
// match. Building outside the component caches forever.
const DEFAULT_ALLOWED_IDS = [VENUES[0]?.id, VENUES[1]?.id].filter(Boolean) as string[];

function MandateModal({
  open,
  onClose,
  prefill,
  prefillLabel,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: MandatePrefill;
  prefillLabel?: string;
}) {
  // Audit #50: caps seed from the copied agent's recommended caps when present,
  // else the generic defaults. actionsPerDay has no per-agent recommendation,
  // so it keeps the default.
  const defPerAction = prefill ? String(prefill.perActionUsd) : '50';
  const defTotalOpen = prefill ? String(prefill.dailyUsd) : '500';
  const defExpires = prefill ? String(prefill.expiryDays) : '14';
  const [agent, setAgent] = useState('');
  const [perActionCap, setPerActionCap] = useState(defPerAction);
  const [totalOpenCap, setTotalOpenCap] = useState(defTotalOpen);
  const [actionsPerDay, setActionsPerDay] = useState('24');
  const [expiresDays, setExpiresDays] = useState(defExpires);
  const [allowed, setAllowed] = useState<Set<string>>(() => new Set(DEFAULT_ALLOWED_IDS));
  const [validationError, setValidationError] = useState<string | null>(null);

  const chainId = useChainId();
  const { data: sigilAddress } = useContractAddress('sigil');
  // UI/UX audit (n=7): gate the mandate signature on the chain. On the wrong
  // network the EIP-712 IntentSigil domain would carry the wrong chainId, so
  // Sigil on Arbitrum Sepolia could never validate it - yet the UI would show a
  // green "Mandate signed" success. Mirror the order-form pattern: swap the
  // submit for a "Switch to Arbitrum Sepolia" button when off-chain.
  const { ok: chainOk, switchChain } = useChainGuard();
  const { status, issue, reset } = useIssueMandate(sigilAddress ?? null, chainId);
  const busy = status.kind === 'signing' || status.kind === 'storing';

  // Audit U-4 fix: reset form + result on close → open transition.
  // Audit #50: reset to the prefilled caps (when copying an agent) so reopening
  // the copy modal keeps the recommendation, else the generic defaults.
  useEffect(() => {
    if (!open) {
      setAgent('');
      setPerActionCap(defPerAction);
      setTotalOpenCap(defTotalOpen);
      setActionsPerDay('24');
      setExpiresDays(defExpires);
      setAllowed(new Set(DEFAULT_ALLOWED_IDS));
      setValidationError(null);
      reset();
    }
  }, [open, reset, defPerAction, defTotalOpen, defExpires]);

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
    // n=7 defense-in-depth: never build a signature on the wrong chain even if
    // the UI gate is bypassed. chainOk is true when disconnected, so this only
    // blocks a connected wallet on a non-Arbitrum-Sepolia network.
    if (!chainOk) {
      setValidationError('Switch to Arbitrum Sepolia to sign this mandate.');
      return;
    }
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

        {/* Audit #50: copy-trade prefill acknowledgement + honest note that the
            agent's on-chain address is still the user's to enter (the reference
            AGENTS map carries no deployed address yet). */}
        {prefillLabel && (
          <div className="mt-3 rounded-md border border-accent/40 bg-accent/5 p-3 text-xs text-ink-soft">
            <p className="font-medium text-ink">{prefillLabel}</p>
            <p className="mt-1">
              Caps below are the agent&apos;s recommended limits. Enter the agent&apos;s on-chain
              address to sign, reference agents do not have a registered address yet.
            </p>
          </div>
        )}

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

        {chainOk ? (
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-6 w-full rounded-md bg-ink px-4 py-3 text-sm font-medium text-parchment disabled:opacity-50"
          >
            {buttonLabel(status, busy)}
          </button>
        ) : (
          <button
            type="button"
            onClick={switchChain}
            className="mt-6 w-full rounded-md bg-testnet px-4 py-3 text-sm font-medium text-parchment transition-colors hover:bg-testnet/90"
          >
            Switch to Arbitrum Sepolia
          </button>
        )}
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
  // Pre-fix this one used sentence-case + trailing periods, the only
  // outlier. Founder-voice (writing.md): plain, conversational copy.
  // Launch-QA: every code the issue-mandate route AND this hook can emit is
  // mapped, so a human never sees a raw token (e.g. origin_not_allowed,
  // signature_wallet_mismatch). Surfaced by signing a mandate that actually
  // errored; pre-fix only 3 of 10+ codes were humanized and the rest fell
  // through to the raw slice. Keep founder-voice: lowercase, no trailing period.
  const map: Record<string, string> = {
    wallet_not_connected: 'connect wallet first',
    wrong_network: 'switch to Arbitrum Sepolia to sign this mandate',
    sigil_not_deployed:
      'Sigil is not deployed on this network, mandate signing lights up once Sigil is live on this network',
    signature_rejected: 'wallet rejected the signature',
    origin_not_allowed: 'request blocked for security, reload the page and try again',
    bad_request_body: 'the mandate request was malformed, refresh and try again',
    intent_hash_mismatch: 'the mandate details changed during signing, try again',
    signature_recovery_failed: 'could not verify your signature, try again',
    signature_wallet_mismatch: 'the signature did not match your wallet, reconnect and try again',
    unauthorized: 'not authorized to issue this mandate',
    server_rejected_signature: 'the server could not verify the mandate, try again',
    bad_response: 'the server could not verify the mandate, try again',
    envelope_build_failed: 'could not build the mandate envelope, try again',
    instrument_mapping_failed: 'could not map the selected venue, try again',
  };
  if (map[reason]) return map[reason];
  if (reason.startsWith('Unknown venue slug:')) return reason;
  // Fallback: the hook can surface a raw wallet-thrown message (4001, reverts,
  // insufficient gas) as the reason. Route it through the shared wallet
  // humanizer so it reads human, not raw, instead of a 200-char slice.
  return humanizeWalletError(reason).message;
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(sanitizeAmount(e.target.value))}
        className="mt-1 w-full rounded-md border border-divider bg-parchment-light px-3 py-2.5 font-mono text-sm text-ink focus:border-ink/40 focus:outline-none"
      />
    </label>
  );
}
