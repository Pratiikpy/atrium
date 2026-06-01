'use client';

import { useState } from 'react';
import { Modal, ModalCloseButton } from '@/components/ui/modal';
import { useEmergencyClose, type EmergencyClosePosition } from '@/lib/use-emergency-close';

/**
 * Emergency close banner — appears under a position row when a normal
 * close has reverted with a liquidity-related reason. Offers a force-close
 * at market through the real Router close path (the same contract path as
 * the Close button), with a clear "you may eat slippage" warning.
 *
 * 057-FE2 fix: the underlying hook now routes through
 * AtriumRouter.close_position_via_adapter (receipt-gated), NOT the
 * Plinth-only Vigil.queueLiquidation that always reverted Unauthorized.
 *
 * Caller is the positions table — it passes the row's instrument label,
 * the close-error reason, and the position ids needed to drive the close.
 */
export function EmergencyCloseBanner({
  instrument,
  reason,
  position,
  onClose,
}: {
  instrument: string;
  reason: string;
  position: EmergencyClosePosition;
  onClose: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const { status, emergencyClose, reset } = useEmergencyClose();
  const busy =
    status.kind === 'resolving' ||
    status.kind === 'submitting' ||
    status.kind === 'closing';

  return (
    <>
      <div className="mt-2 rounded-md border border-testnet/40 bg-testnet/5 px-4 py-3 text-xs">
        <p className="font-medium text-testnet">
          Normal close failed for {instrument}. Venue likely has no liquidity for the full size.
        </p>
        <p className="mt-1 text-ink-soft">
          You can force-close at market: this closes you at whatever price the venue offers right
          now, taking whatever loss the thin market produces. Worse price, but you get out.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-md bg-testnet px-3 py-1.5 text-xs font-medium text-parchment hover:opacity-90"
          >
            Force close at market
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
          This closes the full position at market through the Atrium Router — the same close path
          as the Close button — accepting whatever price the venue offers right now.{' '}
          <strong className="text-ink">You may lose more than mid-market price</strong> if the
          venue is thin.
        </p>

        <ul className="mt-3 space-y-1 text-xs text-ink-soft">
          <li>• Routes through AtriumRouter.close_position_via_adapter (Plinth + adapter settle in one tx)</li>
          <li>• You sign once; the button reports success only after the close confirms on-chain</li>
          <li>• If the venue still cannot fill, the close reverts and the real reason is shown — no silent success</li>
          <li>• The realised P&amp;L is recorded on-chain and indexed to your activity feed</li>
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
              emergencyClose(position);
            }}
            disabled={busy}
            className="rounded-md bg-testnet px-4 py-3 text-sm font-medium text-parchment disabled:opacity-50"
          >
            {emergencyButtonLabel(status)}
          </button>
        </div>

        {status.kind === 'closing' && (
          <div className="mt-3 rounded-md border border-divider bg-parchment-soft/40 p-3 text-xs text-ink-soft">
            Close submitted, waiting for on-chain confirmation.{' '}
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

        {status.kind === 'success' && (
          <div className="mt-3 rounded-md border border-live/40 bg-live-soft p-3 text-xs text-live">
            Position closed.{' '}
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
  if (status.kind === 'resolving') return 'Resolving router…';
  if (status.kind === 'submitting') return 'Submitting…';
  if (status.kind === 'closing') return 'Closing…';
  if (status.kind === 'success') return 'Closed';
  return 'Confirm force close';
}

function humanizeEmergencyReason(reason: string): string {
  if (reason === 'wallet_not_connected') return 'connect wallet first';
  if (reason === 'router_not_deployed')
    return 'Atrium Router is not deployed on this network yet';
  if (reason === 'close_reverted')
    return 'the venue could not fill the close — it reverted on-chain';
  if (reason === 'invalid_position_id') return 'this position id is malformed';
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
