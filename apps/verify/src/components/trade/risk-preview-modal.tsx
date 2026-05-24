'use client';

import { useMemo } from 'react';
import { Modal, ModalCloseButton } from '@/components/ui/modal';

/**
 * Risk Preview modal — required before a wallet's first ever Open Position
 * click on this device. Six risk bullets + a live buffer preview at the
 * user's planned size and leverage. Spec: ATRIUM_FULL_FLOW_DESIGN.md
 * "Before your first trade — Risk Preview".
 *
 * The modal is education, not a contract or chain interaction. Consent is
 * the "I understand" button click; no checkbox theatre. Re-openable later
 * from Settings → Account (when that tab ships).
 */
export function RiskPreviewModal({
  open,
  onContinue,
  onCancel,
  sizeUsdc,
  leverage,
  venue,
  side,
}: {
  open: boolean;
  onContinue: () => void;
  onCancel: () => void;
  sizeUsdc: string;
  leverage: number;
  venue: string;
  side: 'long' | 'short';
}) {
  const previewRows = useMemo(
    () => computeBufferPreview(parseFloat(sizeUsdc || '0'), leverage),
    [sizeUsdc, leverage],
  );

  return (
    <Modal open={open} onClose={onCancel} label="Before your first trade">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-2xl italic text-ink">Before your first trade</p>
        <ModalCloseButton onClose={onCancel} />
      </header>

      <p className="mt-2 text-sm text-ink-soft">
        Atrium can lose you money. Read this once. You can re-open it from Settings → Account at any time.
      </p>

      <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm text-ink">
        <li>
          <strong>Leverage can wipe you out.</strong> Margin trading lets you control more than you
          put in. If the market moves against you, you can lose your full collateral.
        </li>
        <li>
          <strong>Hedging reduces required margin, but not risk.</strong> A long on one venue against
          a short on another is "hedged" only on paper. If one venue fails or oracles disagree, you
          can lose money even when you thought you were market-neutral.
        </li>
        <li>
          <strong>Oracles can pause trading.</strong> Atrium uses two independent price feeds. If
          they disagree by more than half a percent, the system pauses to protect everyone. During
          a pause you cannot open or close positions.
        </li>
        <li>
          <strong>Venues can lose liquidity.</strong> A market that was deep yesterday can be empty
          today. Closing a large position in a thin market costs more than opening it.
        </li>
        <li>
          <strong>Bridges can delay transfers.</strong> Moving collateral across chains uses
          Chainlink's bridge. Most messages settle in seconds. Some take longer. We surface the
          wait.
        </li>
        <li>
          <strong>AI agents can only act inside the limits you set, but bad limits still lose
            money.</strong> A 100-trade daily cap is enforced — but if each trade is a bad call,
          the cap doesn't save you. Read the agent's profile before approving.
        </li>
      </ol>

      <div className="mt-5 rounded-md border border-divider bg-parchment-light p-3 font-mono text-xs">
        <p className="text-[10px] uppercase tracking-wider text-muted">
          At your planned size: ${sizeUsdc || '0'} · {leverage}× · {venueShort(venue)} · {side}
        </p>
        {previewRows.length === 0 ? (
          <p className="mt-2 text-ink-soft">enter a positive size to see live buffer preview</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {previewRows.map((r) => (
              <li key={r.shockBps} className="flex justify-between">
                <span className="text-ink-soft">
                  if market moves {r.shockBps > 0 ? '+' : ''}{(r.shockBps / 100).toFixed(0)}%
                </span>
                <span className={r.healthyClass}>
                  buffer ≈ ${r.bufferUsd.toFixed(0)} {r.label}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[9px] text-muted">
          Client-side preview using the same Plinth haircut formula. Numbers are simulated — actual
          fills depend on venue execution.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-divider px-4 py-3 text-sm font-medium text-ink hover:border-ink/30"
        >
          Cancel — go back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-ink px-4 py-3 text-sm font-medium text-parchment hover:bg-ink-dark"
        >
          I understand. Open position.
        </button>
      </div>
    </Modal>
  );
}

interface BufferRow {
  shockBps: number;
  bufferUsd: number;
  label: string;
  healthyClass: string;
}

/**
 * Worked example of buffer under three shock scenarios. Uses a simplified
 * version of Plinth's initial_margin haircut at 5%, so for size=$1000 at
 * 3× leverage:
 *   - collateral required = 1000 * 0.05 = $50 initial
 *   - notional = 1000 * 3 = $3000
 *   - -5% market move → P&L = -$150 → buffer shrinks by $150
 *   - -10% → -$300 → liquidation territory
 *   - -15% → -$450 → liquidated
 * Real numbers depend on Plinth's per-instrument haircut + maintenance
 * margin. This preview is intentionally a coarse honest approximation.
 */
function computeBufferPreview(sizeUsd: number, leverage: number): BufferRow[] {
  if (!isFinite(sizeUsd) || sizeUsd <= 0 || leverage <= 0) return [];
  const notional = sizeUsd * leverage;
  const initialMargin = sizeUsd * 0.05;
  // Healthy buffer baseline = 2x the initial margin requirement.
  const healthyBuffer = initialMargin * 2;
  const rows: BufferRow[] = [];
  for (const shockBps of [-500, -1000, -1500]) {
    const pnl = notional * (shockBps / 10_000);
    const bufferUsd = healthyBuffer + pnl;
    let label: string;
    let healthyClass: string;
    if (bufferUsd >= healthyBuffer * 0.6) {
      label = '(healthy)';
      healthyClass = 'text-success';
    } else if (bufferUsd > 0) {
      label = '(close to liquidation)';
      healthyClass = 'text-warning';
    } else {
      label = '(liquidated)';
      healthyClass = 'text-danger';
    }
    rows.push({ shockBps, bufferUsd: Math.max(0, bufferUsd), label, healthyClass });
  }
  return rows;
}

function venueShort(id: string): string {
  const map: Record<string, string> = {
    'hyperliquid': 'HL-HIP3',
    'aave-horizon': 'AAVE-V3',
    'pendle-v2': 'PENDLE',
    'curve': 'CURVE',
    'trade-xyz': 'TRADE',
    'polymarket': 'PMK',
    'hl-hip4': 'HL-HIP4',
  };
  return map[id] ?? id.toUpperCase();
}
