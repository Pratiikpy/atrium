'use client';

import dynamic from 'next/dynamic';
import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import {
  useDeploymentStatus,
  readinessMessage,
} from '@/lib/use-deployment-status';
import { useOpenPosition } from '@/lib/use-open-position';
import { humanizeWalletError } from '@/lib/humanize-wallet-error';
import { VENUES } from '@/lib/venues';
import { sanitizeAmount } from '@/lib/sanitize-amount';
import { walletQuery } from '@/lib/use-scoped-wallet';
import { SlippageSelect } from '@/components/trade/slippage-select';
import { HelpTip } from '@/components/ui/help-tip';

/* PERF-04: Dynamic import, RiskPreviewModal only renders on first trade */
const RiskPreviewModal = dynamic(
  () =>
    import('@/components/trade/risk-preview-modal').then(
      (m) => m.RiskPreviewModal,
    ),
  { ssr: false },
);

const RISK_ACK_KEY = 'atrium.risk-preview.ack.v1';

/**
 * Order form for the Trade view. Audit P-3 fix: prior version had a default
 * size of "1200" and hardcoded $19,238 / $19,338 margins. Now:
 *   - default size is empty
 *   - initial/maintenance margin reads live from /api/trade/margin-impact
 *     with the current size + venue (same route the margin-impact panel uses)
 *   - the CTA enables only when /api/deployments/status?step=2 reports ready
 *   - when disabled, a clear helper line explains why
 */

interface ImpactPreview {
  initialMarginUsd: string | null;
  maintenanceMarginUsd: string | null;
  source: 'plinth' | 'pending';
}

async function fetchImpact(
  sizeUsd: string,
  venue: string,
  leverage: number,
  wallet?: string,
): Promise<ImpactPreview> {
  if (!sizeUsd || parseFloat(sizeUsd) <= 0 || !wallet) {
    return {
      initialMarginUsd: '-',
      maintenanceMarginUsd: '-',
      source: 'pending',
    };
  }
  try {
    // The margin-impact route is IDOR-locked (requireWalletMatch): it MUST
    // receive the connected wallet. Without it the route falls back to
    // DEMO_WALLET and 403s the real session ("Wallet mismatch"), which the
    // catch below swallows into source:'pending' - so the live preview never
    // populated for a real connected user. Pass the wallet through.
    // #8 fix (2026-06-09, option A): the preview is pinned to leverage=1 so it
    // shows EXACTLY what the on-chain open submits. use-open-position sends
    // notional = sizeUsd (no leverage; leveraged venues are Year-2 / #430), so a
    // leveraged preview here would overstate the margin vs the real result. The
    // slider still captures the user's intended leverage (shown in the UI +
    // labelled "1x on-chain today"), and the API keeps full leverage support for
    // when leveraged venues ship. `leverage` is retained in the query key so the
    // hook re-runs cleanly if that policy changes.
    void leverage;
    const r = await fetch(
      walletQuery(
        `/api/trade/margin-impact?size=${encodeURIComponent(sizeUsd)}&venue=${encodeURIComponent(venue)}&leverage=1`,
        wallet,
      ),
    );
    if (!r.ok) throw new Error();
    const j = await r.json();
    return {
      initialMarginUsd: j.initialMarginUsd ?? null,
      maintenanceMarginUsd: j.maintenanceMarginUsd ?? null,
      source: j.source ?? 'pending',
    };
  } catch {
    return {
      initialMarginUsd: null,
      maintenanceMarginUsd: null,
      source: 'pending',
    };
  }
}

// Audit U-14 (closes QQ-9 + QQ-11 + QQ-12 lift-state-up note):
// `venue` now comes from the parent TradeView via props, so the
// VenueChipBar selection actually drives this form's margin preview
// + Plinth API call. `leverage` is lifted to TradeView so the slider
// drives both the risk modal and the shared margin-impact preview.

export function OrderForm({
  venue,
  size,
  setSize,
  leverage,
  setLeverage,
}: {
  venue: string;
  size: string;
  setSize: (s: string) => void;
  leverage: number;
  setLeverage: (n: number) => void;
}) {
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [slippage, setSlippage] = useState(0.1);
  const { address } = useAccount();

  // Debounce size for margin-impact queries
  const deferredSize = useDeferredValue(size);

  const { data: impact } = useQuery({
    queryKey: ['order-form-impact', deferredSize, venue, leverage, address],
    queryFn: () => fetchImpact(deferredSize, venue, leverage, address),
    enabled: deferredSize.length > 0 && !!address,
    refetchInterval: 10_000,
  });
  const { data: deployment } = useDeploymentStatus(2);
  // Only Aave Horizon is openable today; the other venues are deployed-but-
  // scaffolded (open_position reverts on-chain). Gate the Open button on this
  // so a user never signs a transaction that is guaranteed to revert.
  const venueOperational =
    VENUES.find((v) => v.id === venue)?.operational ?? false;
  const helper = !venueOperational
    ? `${venueShortLabel(venue)} is deployed but not openable on testnet yet. Open positions are live on Aave Horizon today.`
    : readinessMessage(
        deployment,
        side === 'long' ? 'Open long' : 'Open short',
      );
  const {
    status: openStatus,
    open: openPosition,
    reset: resetOpen,
  } = useOpenPosition();
  const busy =
    openStatus.kind === 'resolving' || openStatus.kind === 'submitting';
  // Validate the size as a positive number, not merely non-empty: a bare
  // `size.length > 0` left the Open button enabled for "0", "-5", and "abc"
  // (interactive form-edge sweep 2026-06-02). parseFloat rejects all three
  // (NaN/<=0). The deposit form already gates this way; match it here.
  const sizeNum = parseFloat(size);
  const sizeValid = Number.isFinite(sizeNum) && sizeNum > 0;
  const ready =
    deployment?.ready === true && sizeValid && !busy && venueOperational;

  // First-trade risk preview gate. The flow doc treats this as required
  // before the very first open-position click. Persistence is per-device
  // (localStorage), re-openable from Settings once that tab ships.
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState(false);
  const [showRiskPreview, setShowRiskPreview] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setHasAcknowledgedRisk(window.localStorage.getItem(RISK_ACK_KEY) === '1');
    } catch {
      // ignore storage failures (private mode, etc.), the worst case is
      // the modal re-fires on next visit, which is the safe direction.
    }
  }, []);

  function handleOpenClick() {
    if (!ready) return;
    if (!hasAcknowledgedRisk) {
      setShowRiskPreview(true);
      return;
    }
    openPosition({ venue, side, sizeUsd: size });
  }

  function handleRiskContinue() {
    try {
      window.localStorage.setItem(RISK_ACK_KEY, '1');
    } catch {
      // continue regardless, see above
    }
    setHasAcknowledgedRisk(true);
    setShowRiskPreview(false);
    openPosition({ venue, side, sizeUsd: size });
  }

  return (
    <aside className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <p className="eyebrow">Order · {venueShortLabel(venue)}</p>
        <span className="font-mono text-[10px] text-muted">testnet</span>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide('long')}
          className={
            'rounded-md border p-3 text-sm font-medium transition-colors ' +
            (side === 'long'
              ? 'border-live bg-live-soft text-live'
              : 'border-divider bg-parchment text-ink-soft hover:border-live/40')
          }
        >
          Long
        </button>
        <button
          type="button"
          onClick={() => setSide('short')}
          className={
            'rounded-md border p-3 text-sm font-medium transition-colors ' +
            (side === 'short'
              ? 'border-neg bg-neg/5 text-neg'
              : 'border-divider bg-parchment text-ink-soft hover:border-neg/40')
          }
        >
          Short
        </button>
      </div>

      <div className="mt-4">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted">
            Size · USDC
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={size}
            placeholder="0.00"
            onChange={(e) => setSize(sanitizeAmount(e.target.value))}
            className="mt-1 w-full rounded-md border border-divider bg-parchment px-3 py-2.5 font-mono text-lg text-ink focus:border-ink/40 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted flex items-center gap-1">
            Leverage <HelpTip term="leverage" />
          </span>
          <span className="font-mono text-xs text-ink">{leverage}×</span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          value={leverage}
          onChange={(e) => {
            const next = parseInt(e.target.value, 10);
            setLeverage(
              Number.isFinite(next) ? Math.min(20, Math.max(1, next)) : 1,
            );
          }}
          className="mt-2 w-full accent-ink"
          aria-label={`Leverage: ${leverage}×`}
        />
        <div className="mt-1 flex justify-between text-[9px] text-muted">
          <span>1×</span>
          <span>20×</span>
        </div>
        {/* #8 (2026-06-09): honest note - leverage is captured but on-chain
            notional is 1x on testnet; the margin below reflects that 1x reality,
            not size x leverage. Prevents the preview overstating vs the submit. */}
        <p className="mt-1.5 text-[9px] leading-snug text-muted">
          Margin shown for{' '}
          <span className="text-ink-soft">1× notional (on-chain today)</span>.
          Leverage applies when leveraged venues ship at GA.
        </p>
      </div>

      <dl className="mt-5 space-y-1.5 border-t border-divider-soft pt-4 font-mono text-xs">
        <Row
          label="Maintenance margin"
          value={impact?.maintenanceMarginUsd ?? '-'}
        />
        <Row label="Initial margin" value={impact?.initialMarginUsd ?? '-'} />
        <div className="flex items-center justify-between">
          <dt className="text-muted flex items-center gap-1">
            Slippage tolerance <HelpTip term="slippage" />
          </dt>
          <dd>
            <SlippageSelect
              value={slippage}
              onChange={setSlippage}
              walletAddress={address}
            />
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[9px] uppercase tracking-wider text-muted">
        {impact?.source === 'plinth'
          ? 'from Plinth.update_margin · simulated'
          : 'margin pending · figures populate once Plinth prices your order'}
      </p>

      <button
        type="button"
        onClick={handleOpenClick}
        disabled={!ready}
        className="mt-5 w-full rounded-md bg-ink px-4 py-3 text-sm font-medium text-parchment transition-colors hover:bg-ink-dark disabled:opacity-50"
      >
        {openButtonLabel(openStatus, side)}
      </button>
      {helper && (
        <p className="mt-2 text-[10px] uppercase tracking-wider text-muted">
          {helper}
        </p>
      )}
      <OpenStatusLine status={openStatus} onReset={resetOpen} />
      <p className="mt-3 text-center text-[9px] uppercase tracking-wider text-muted">
        Your trade routes through a Portico-registered venue adapter.{' '}
        <a href="/docs/api" className="underline">
          See adapter docs
        </a>
        .
      </p>
      <RiskPreviewModal
        open={showRiskPreview}
        onContinue={handleRiskContinue}
        onCancel={() => setShowRiskPreview(false)}
        sizeUsdc={size}
        leverage={leverage}
        venue={venue}
        side={side}
      />
    </aside>
  );
}

function openButtonLabel(
  status: ReturnType<typeof useOpenPosition>['status'],
  side: 'long' | 'short',
): string {
  if (status.kind === 'resolving') return 'Resolving adapter…';
  if (status.kind === 'submitting') return 'Submitting…';
  if (status.kind === 'success') return 'Open another';
  return `Open ${side} · market`;
}

function OpenStatusLine({
  status,
  onReset,
}: {
  status: ReturnType<typeof useOpenPosition>['status'];
  onReset: () => void;
}) {
  if (
    status.kind === 'idle' ||
    status.kind === 'resolving' ||
    status.kind === 'submitting'
  ) {
    return null;
  }
  if (status.kind === 'success') {
    return (
      <p className="mt-2 text-xs text-live">
        Position opened ·{' '}
        <a
          href={`https://sepolia.arbiscan.io/tx/${status.hash}`}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono underline"
        >
          {status.hash.slice(0, 8)}…{status.hash.slice(-4)}
        </a>{' '}
        ·{' '}
        <button type="button" onClick={onReset} className="underline">
          new order
        </button>
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-neg">
      Failed: {humanizeOpenReason(status.reason)} ·{' '}
      <button type="button" onClick={onReset} className="underline">
        retry
      </button>
    </p>
  );
}

function humanizeOpenReason(reason: string): string {
  return humanizeWalletError(reason).message;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

// Map venue id → short label without crossing client/server module boundaries.
// We can't `import { VENUES }` and call `.find()` in every render without
// a tiny perf hit, but for ~7 venues this is fine; the array lookup is O(n)
// over a small constant. Keeps the eyebrow label honest when the user
// switches chips (pre-fix: always "HL-HIP3" regardless of selection).
function venueShortLabel(id: string): string {
  const map: Record<string, string> = {
    hyperliquid: 'HL-HIP3',
    'aave-horizon': 'AAVE-V3',
    'pendle-v2': 'PENDLE',
    curve: 'CURVE',
    'trade-xyz': 'TRADE',
    polymarket: 'PMK',
    'hl-hip4': 'HL-HIP4',
  };
  return map[id] ?? id.toUpperCase();
}
