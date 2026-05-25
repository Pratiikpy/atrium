'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, ModalCloseButton } from '@/components/ui/modal';
import { useContractAddress } from '@/lib/use-coffer-address';
import { useVaultDeposit } from '@/lib/use-vault-deposit';

/**
 * Top-up banner — appears on the Portfolio when the liquidation buffer
 * drops below the warning threshold (default 20%). Clicking "Top up"
 * opens a deposit modal pre-filled with a suggested amount that aims to
 * restore a healthy buffer. From ATRIUM_FULL_FLOW_DESIGN.md
 * "Topping up when you are close to liquidation".
 *
 * Honest behavior:
 *  - Hides entirely when margin-health source is "pending" (Plinth not
 *    deployed yet) — would be a misleading banner otherwise.
 *  - Hides when bufferBps is null or above the threshold.
 *  - The suggested amount is a coarse heuristic until Plinth exposes a
 *    "what would restore buffer to X%" view. User can override.
 */

interface MarginHealth {
  marginHealthBps: number | null;
  liquidationBufferBps: number | null;
  source: 'plinth' | 'pending';
}

const WARNING_THRESHOLD_BPS = 2_000; // 20%
const SUGGESTED_TOP_UP_USDC = 100;

async function fetchMarginHealth(): Promise<MarginHealth> {
  const r = await fetch('/api/portfolio/margin-health');
  if (!r.ok) throw new Error('failed to fetch margin health');
  return r.json();
}

export function TopUpBanner() {
  const { data: health } = useQuery({
    queryKey: ['margin-health-banner'],
    queryFn: fetchMarginHealth,
    refetchInterval: 15_000,
  });
  const [open, setOpen] = useState(false);

  // Hide when no live data or buffer is healthy. We do NOT fire on a null
  // bufferBps even though that "could" mean liquidation — the source is
  // explicitly pending, so we don't have any signal to warn on.
  if (!health || health.source !== 'plinth') return null;
  if (health.liquidationBufferBps === null) return null;
  if (health.liquidationBufferBps >= WARNING_THRESHOLD_BPS) return null;

  const bufferPct = (health.liquidationBufferBps / 100).toFixed(0);

  return (
    <>
      <div className="rounded-md border border-testnet/40 bg-testnet/5 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-testnet">
              Buffer at {bufferPct}%. Top up to avoid liquidation.
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              Markets can move at any speed. A small top-up now restores headroom against price
              shocks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-md bg-testnet px-4 py-2 text-sm font-medium text-parchment hover:opacity-90"
          >
            Top up
          </button>
        </div>
      </div>
      <TopUpModal
        open={open}
        onClose={() => setOpen(false)}
        suggestedUsdc={String(SUGGESTED_TOP_UP_USDC)}
        currentBufferPct={bufferPct}
      />
    </>
  );
}

function TopUpModal({
  open,
  onClose,
  suggestedUsdc,
  currentBufferPct,
}: {
  open: boolean;
  onClose: () => void;
  suggestedUsdc: string;
  currentBufferPct: string;
}) {
  const [amount, setAmount] = useState(suggestedUsdc);
  const { data: cofferAddress } = useContractAddress('coffer');
  const { status, deposit, reset } = useVaultDeposit(cofferAddress ?? null);
  const ready = amount.length > 0 && parseFloat(amount) > 0 && cofferAddress !== null;
  const busy =
    status.kind === 'checking' || status.kind === 'approving' || status.kind === 'depositing';

  return (
    <Modal open={open} onClose={onClose} label="Top up collateral">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-2xl italic text-ink">Top up collateral</p>
        <ModalCloseButton onClose={onClose} />
      </header>

      <p className="mt-2 text-sm text-ink-soft">
        Buffer is currently {currentBufferPct}%. Depositing ${suggestedUsdc} restores a comfortable
        headroom. You can override the amount below.
      </p>

      <label className="mt-5 block">
        <span className="text-[10px] uppercase tracking-wider text-muted">Amount · USDC</span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-md border border-divider bg-parchment-light px-3 py-2.5 font-mono text-lg text-ink focus:border-ink/40 focus:outline-none"
        />
      </label>

      <p className="mt-2 text-[10px] uppercase tracking-wider text-muted">
        Two wallet prompts: approve, then deposit. Same flow as the vault page.
      </p>

      <button
        type="button"
        onClick={() => {
          if (!ready || busy) return;
          deposit(amount);
        }}
        disabled={!ready || busy}
        className="mt-6 w-full rounded-md bg-ink px-4 py-3 text-sm font-medium text-parchment disabled:opacity-50"
      >
        {topUpButtonLabel(status)}
      </button>

      {cofferAddress === null && (
        <p className="mt-3 text-xs text-muted">
          Coffer is not deployed on this network — top-up lights up once the vault contract is in
          the registry.
        </p>
      )}

      {status.kind === 'success' && (
        <div className="mt-3 rounded-md border border-live/40 bg-live-soft p-3 text-xs text-live">
          <p>
            Deposited.{' '}
            <a
              href={`https://sepolia.arbiscan.io/tx/${status.depositHash}`}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono underline"
            >
              {status.depositHash.slice(0, 10)}…{status.depositHash.slice(-6)}
            </a>
          </p>
          <button type="button" onClick={() => { reset(); onClose(); }} className="mt-2 underline">
            close
          </button>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="mt-3 rounded-md border border-neg/40 bg-neg/5 p-3 text-xs text-neg">
          <p>{humanizeTopUpReason(status.reason)}</p>
          <button type="button" onClick={reset} className="mt-1 underline">
            retry
          </button>
        </div>
      )}
    </Modal>
  );
}

function topUpButtonLabel(status: ReturnType<typeof useVaultDeposit>['status']): string {
  if (status.kind === 'checking') return 'Checking allowance…';
  if (status.kind === 'approving') return 'Approving USDC…';
  if (status.kind === 'depositing') return 'Depositing…';
  if (status.kind === 'success') return 'Topped up';
  return 'Top up';
}

function humanizeTopUpReason(reason: string): string {
  if (reason === 'wallet_not_connected') return 'connect wallet first';
  if (reason === 'invalid_amount') return 'enter a positive amount';
  if (reason === 'coffer_not_deployed') return 'Coffer is not deployed on this network yet';
  return reason.slice(0, 160);
}
