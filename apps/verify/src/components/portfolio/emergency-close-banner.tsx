'use client';

import { useState } from 'react';
import { Modal, ModalCloseButton } from '@/components/ui/modal';
import { useEmergencyClose } from '@/lib/use-emergency-close';

/**
 * Emergency close banner — appears under a position row when a normal
 * close has reverted with a liquidity-related reason. Offers the user
 * the safety-bot partial-close path with a clear "you may eat slippage"
 * warning. Spec: ATRIUM_FULL_FLOW_DESIGN.md "Emergency close (when the
 * venue has no liquidity)".
 *
 * Caller is the positions table — it passes in the row's instrument
 * label and the reason string for context. Banner self-manages the
 * confirmation modal and the Vigil wallet call.
 */
export function EmergencyCloseBanner({
  instrument,
  reason,
  onClose,
}: {
  instrument: string;
  reason: string;
  onClose: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const { status, emergencyClose, reset } = useEmergencyClose();
  const busy = status.kind === 'resolving' || status.kind === 'submitting';

  return (
    <>
      <div className="mt-2 rounded-md border border-testnet/40 bg-testnet/5 px-4 py-3 text-xs">
        <p className="font-medium text-testnet">
          Normal close failed for {instrument}. Venue likely has no liquidity for the full size.
        </p>
        <p className="mt-1 text-ink-soft">
          You can use the emergency partial close: this closes you at whatever price the venue
          offers, taking whatever loss the thin market produces. Worse price, but you get out.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-md bg-testnet px-3 py-1.5 text-xs font-medium text-parchment hover:opacity-90"
          >
            Use emergency partial close
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-ink-soft underline"
          >
            Dismiss
          </button>
          <span className="ml-auto font-mono text-[9px] text-muted" title={reason}>
            reason: {reason.slice(0, 40)}{reason.length > 40 ? '…' : ''}
          </span>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} label="Emergency close">
        <header className="flex items-baseline justify-between">
          <p className="font-display text-2xl italic text-ink">Emergency close</p>
          <ModalCloseButton onClose={() => setModalOpen(false)} />
        </header>

        <p className="mt-3 text-sm text-ink-soft">
          The safety bot will close up to 10% of this position per block at the best available
          price on the most-liquid leg of the venue. <strong className="text-ink">You may lose
          more than market price</strong> because the venue is thin.
        </p>

        <ul className="mt-3 space-y-1 text-xs text-ink-soft">
          <li>• Each partial is capped at 10% per block — total close takes several blocks</li>
          <li>• You sign once; subsequent partials are fired automatically by the keepers</li>
          <li>• You can monitor progress on this row as it counts down</li>
          <li>• The realised P&L per partial is shown so you see the actual slippage</li>
        </ul>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="rounded-md border border-divider px-4 py-3 text-sm font-medium text-ink hover:border-ink/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (busy) return;
              emergencyClose();
            }}
            disabled={busy}
            className="rounded-md bg-testnet px-4 py-3 text-sm font-medium text-parchment disabled:opacity-50"
          >
            {emergencyButtonLabel(status)}
          </button>
        </div>

        {status.kind === 'success' && (
          <div className="mt-3 rounded-md border border-live/40 bg-live-soft p-3 text-xs text-live">
            Emergency close queued.{' '}
            <a
              href={`https://sepolia.arbiscan.io/tx/${status.hash}`}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono underline"
            >
              {status.hash.slice(0, 10)}…{status.hash.slice(-6)}
            </a>
          </div>
        )}

        {status.kind === 'error' && (
          <div className="mt-3 rounded-md border border-neg/40 bg-neg/5 p-3 text-xs text-neg">
            <p>{humanizeEmergencyReason(status.reason)}</p>
            <button type="button" onClick={reset} className="mt-1 underline">retry</button>
          </div>
        )}
      </Modal>
    </>
  );
}

function emergencyButtonLabel(status: ReturnType<typeof useEmergencyClose>['status']): string {
  if (status.kind === 'resolving') return 'Resolving Vigil…';
  if (status.kind === 'submitting') return 'Submitting…';
  if (status.kind === 'success') return 'Queued';
  return 'Confirm emergency close';
}

function humanizeEmergencyReason(reason: string): string {
  if (reason === 'wallet_not_connected') return 'connect wallet first';
  if (reason === 'vigil_not_deployed')
    return 'Vigil safety bot is not deployed on this network yet — ships Month 1 W2';
  return reason.slice(0, 200);
}

/**
 * Heuristic: classify a close-position revert reason as a liquidity issue.
 * Pre-fix, every close error went straight to a "retry" button with no
 * alternative path. The emergency close UX makes sense specifically when
 * the venue can't fill — not when (e.g.) the wallet rejected.
 *
 * The string match is intentionally permissive: different venues word
 * "no liquidity" differently, but they all tend to mention liquidity,
 * insufficient depth, or thin market. Errors we KNOW are not liquidity
 * (wallet rejection, adapter not deployed) get a deny-list short-circuit.
 */
export function isLiquidityError(reason: string): boolean {
  const r = reason.toLowerCase();
  if (r.includes('wallet') || r.includes('reject')) return false;
  if (r.includes('not_deployed') || r.includes('not deployed')) return false;
  if (r.includes('invalid_position')) return false;
  return (
    r.includes('liquid') ||
    r.includes('depth') ||
    r.includes('thin') ||
    r.includes('insufficient') ||
    r.includes('no_buyer') ||
    r.includes('reverted')
  );
}
