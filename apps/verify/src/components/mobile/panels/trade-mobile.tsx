'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOpenPosition } from '@/lib/use-open-position';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';
import { useDeploymentStatus, readinessMessage } from '@/lib/use-deployment-status';
import { humanizeWalletError } from '@/lib/humanize-wallet-error';
import { VENUES } from '@/lib/venues';
import { sanitizeAmount } from '@/lib/sanitize-amount';

/**
 * TradeMobile  the Trade panel for /app/trade at < md.
 * Source: design/Mobile App.html:1064-1132. Pair head + sparkline chart +
 * timeframe pills + Long/Short toggle + amount input + leverage slider +
 * order summary + primary CTA. Wires through the same useOpenPosition
 * wagmi hook the desktop trade page uses (Phase eta.6 2026-05-25), so
 * the mobile CTA is a real trade not a mockup.
 *
 * Real-time price + chart data require the Plinth oracle path which is
 * pending; chart renders a static SVG line as a layout placeholder with
 * an honest 'pending' label.
 *
 * Venue parity fix (2026-06-08 pixel audit): the panel was hardcoded to
 * Hyperliquid (HSLA-PERP), a scaffold whose open reverts and whose CTA is
 * gated off  so a mobile user could never reach the one openable venue
 * (Aave Horizon), the exact "dropped a judge onto a venue they cannot trade"
 * trap the desktop TradeView already fixed. Mirror desktop here: default to
 * the operational venue, add a venue selector, and make the display + CTA +
 * open-call venue-aware. Form structure stays identical across venues, same
 * as the desktop OrderForm (leverage + side are UI-only in v1).
 */

// Display instrument symbol per venue (matches the /app/markets instrument
// lists + lib/instruments.ts). Headline shows the instrument, subtitle shows
// the venue. Local constant to avoid a server/client boundary import, same
// pattern as order-form.tsx's venueShortLabel map.
const INSTRUMENT_BY_VENUE: Record<string, string> = {
  'hyperliquid': 'HSLA-PERP',
  'aave-horizon': 'USDC-LEND',
  'pendle-v2': 'PT-USDC',
  'curve': '3POOL-LP',
  'trade-xyz': 'NVDA-PERP',
  'polymarket': 'ELECTION',
  'hl-hip4': 'HSLA2-PERP',
};

export function TradeMobile() {
  // Default to the venue that is actually openable today (Aave Horizon),
  // matching the desktop TradeView default. Pre-fix this panel hardcoded
  // Hyperliquid, which is operational:false, so the CTA was always disabled
  // and a mobile judge never saw a tradeable venue.
  const [venueId, setVenueId] = useState<string>(
    VENUES.find((v) => v.operational)?.id ?? VENUES[0]?.id ?? 'aave-horizon',
  );
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(4);
  const { status, open, reset } = useOpenPosition();

  // Audit fix (#15): the mobile panel bypassed the desktop's deployment-
  // readiness gate, so it would let a user fire an open before Plinth is
  // executable. Mirror the desktop OrderForm: gate the CTA on
  // useDeploymentStatus(2) + a clear readiness helper when not ready.
  const { data: deployment } = useDeploymentStatus(2);
  const isSubmitting = status.kind === 'submitting' || status.kind === 'resolving';
  const amountValid = amount.length > 0 && parseFloat(amount) > 0;
  // Gate the CTA on the SELECTED venue's operational flag (desktop parity).
  // Only Aave Horizon is openable today; selecting a scaffold venue disables
  // the CTA + shows the honest helper rather than signing a guaranteed-revert
  // tx (the scaffold adapters revert on-chain).
  const selectedVenue = VENUES.find((v) => v.id === venueId);
  const venueOperational = selectedVenue?.operational ?? false;
  const venueLabel = selectedVenue?.shortLabel ?? 'HL-HIP3';
  const instrument = INSTRUMENT_BY_VENUE[venueId] ?? 'HSLA-PERP';
  const ready = deployment?.ready === true && amountValid && !isSubmitting && venueOperational;
  const helper = readinessMessage(deployment, side === 'long' ? 'Open long' : 'Open short');

  // Bug-hunt fix (2026-06-02): mobile computed notional = amount * leverage and
  // submitted THAT as sizeUsd, while desktop submits the raw typed amount
  // (leverage is UI-only by design). That meant the SAME user intent sent a
  // different notional_signed on-chain on mobile vs desktop (e.g. 1000 @ 4x ->
  // 4000 on mobile, 1000 on desktop). Match desktop: the typed amount IS the
  // notional; leverage stays a UI-only slider. Submit + display now agree.
  const notional = Number(amount || '0').toFixed(2);

  // Margin preview: wire the SAME /api/trade/margin-impact path the desktop
  // MarginImpactPanel reads (initial/maintenance margin + liquidation buffer
  // from Plinth's per-venue haircut), so a mobile trader is not blind to their
  // margin. Pre-fix the order summary hardcoded 'pending' for these rows with a
  // "until the margin-impact fetch is wired into mobile" TODO; this wires it.
  // Found via real-wallet mobile QA (28-mobile-trade.png: desktop showed real
  // margin, mobile showed pending). walletQuery() keeps the authed-fetch shape so
  // the IDOR gate does not 403 the preview (same fix the desktop order form took).
  const wallet = useScopedWallet();
  const { data: impact } = useQuery({
    queryKey: ['mobile-margin-impact', venueId, notional, wallet],
    queryFn: async () => {
      try {
        const r = await fetch(
          walletQuery(
            `/api/trade/margin-impact?size=${encodeURIComponent(notional)}&venue=${encodeURIComponent(venueId)}`,
            wallet,
          ),
        );
        if (!r.ok) throw new Error();
        return (await r.json()) as {
          initialMarginUsd: string | null;
          maintenanceMarginUsd: string | null;
          liquidationBufferBps: number | null;
        };
      } catch {
        return null;
      }
    },
    refetchInterval: 10_000,
    enabled: amountValid,
  });

  const submit = () => {
    if (!ready) return;
    // Submit to the selected venue (was hardcoded 'hyperliquid'). The CTA is
    // gated on venueOperational, so this only fires for an openable venue.
    void open({ venue: venueId, side, sizeUsd: notional });
  };

  return (
    <div className="md:hidden flex flex-col gap-4">
      {/* Venue selector  mirrors the desktop VenueChipBar. A live dot marks
          the operational venue(s); a muted dot marks scaffold/pending ones, so
          the user sees at a glance which venue is openable and can switch to it
          (pre-fix the panel was locked to the one venue they could not trade). */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {VENUES.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVenueId(v.id)}
            aria-pressed={v.id === venueId}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition ${
              v.id === venueId
                ? 'border-mob-ink bg-mob-bg-card text-mob-ink'
                : 'border-mob-line bg-mob-bg-card text-mob-muted'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${v.operational ? 'bg-mob-live' : 'bg-mob-muted'}`} />
            {v.shortLabel}
          </button>
        ))}
      </div>

      {/* Pair head */}
      <section className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-display text-[22px] italic text-mob-ink">{instrument}</div>
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-mob-muted">
              {venueLabel} . tokenized{!venueOperational && <span className="text-mob-accent"> . soon</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[18px] text-mob-ink">pending</div>
            <div className="font-mono text-[10.5px] text-mob-muted">price wire pending</div>
          </div>
        </div>
        <div className="mt-3 h-14">
          <ChartPlaceholder />
        </div>
        {/* Bug-hunt fix (2026-06-02): the 1H/4H/1D/1W/1M pills were dead - plain
            <span>s with no handler and a hardcoded 1D highlight - while the chart
            itself is a pending placeholder (no timeframe data source). Removed the
            fake timeframe selector rather than imply interactivity that does
            nothing; it returns when a real price/timeframe feed lands. */}
      </section>

      {/* Side toggle */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setSide('long')}
          className={`rounded-full py-3 font-medium transition ${
            side === 'long'
              ? 'bg-mob-live text-mob-bg'
              : 'border border-mob-line bg-mob-bg-card text-mob-ink-soft'
          }`}
        >
          Long
        </button>
        <button
          type="button"
          onClick={() => setSide('short')}
          className={`rounded-full py-3 font-medium transition ${
            side === 'short'
              ? 'bg-mob-neg text-mob-bg'
              : 'border border-mob-line bg-mob-bg-card text-mob-ink-soft'
          }`}
        >
          Short
        </button>
      </div>

      {/* Amount */}
      <label className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-3.5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">Amount . USDC</div>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
          className="mt-2 w-full bg-transparent font-mono text-[24px] text-mob-ink outline-none"
        />
      </label>

      {/* Leverage slider */}
      <div className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">Leverage</span>
          <span className="font-mono text-[14px] text-mob-ink">{leverage}x</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="mt-3 w-full accent-mob-accent"
          aria-label="Leverage"
        />
        <div className="mt-1 flex justify-between font-mono text-[9.5px] uppercase tracking-wider text-mob-muted">
          <span>1x</span><span>2x</span><span>4x</span><span>6x</span><span>10x</span>
        </div>
      </div>

      {/* Order summary */}
      <div className="rounded-2xl border border-mob-line bg-mob-bg-card">
        <Row l="Notional" v={`$${Number(notional).toLocaleString()}`} />
        {/* Wired to /api/trade/margin-impact (2026-06-08): initial + maintenance
            margin come from Plinth's per-venue initial-margin haircut, liquidation
            buffer from the resulting account health - the same fields the desktop
            MarginImpactPanel shows. Falls back to 'pending' only when the fetch
            has not resolved or returns the pending source (no wallet, or a venue
            Plinth has no instrument config for), never a wrong computed number.
            The dropped "Fee" row had no data source and the desktop omits it. */}
        <Row l="Initial margin" v={impact?.initialMarginUsd ?? 'pending'} />
        <Row l="Maintenance margin" v={impact?.maintenanceMarginUsd ?? 'pending'} />
        <Row
          l="Liquidation buffer"
          v={impact?.liquidationBufferBps != null ? `${(impact.liquidationBufferBps / 100).toFixed(1)}%` : 'pending'}
        />
        <Row l="Gas" v="sponsored" />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!ready}
        className={`rounded-full py-3.5 text-center font-medium transition disabled:opacity-50 ${side === 'long' ? 'bg-mob-live text-mob-bg' : 'bg-mob-neg text-mob-bg'}`}
      >
        {isSubmitting ? 'Submitting...' : `${side === 'long' ? 'Open long' : 'Open short'} . ${instrument}`}
      </button>
      {/* Honest readiness gate (mirrors desktop OrderForm helper): for a non-
          operational venue, explain it is deployed-but-not-openable and name the
          live venue; otherwise surface the deployment-readiness helper. */}
      {!venueOperational ? (
        <p className="text-center text-[10.5px] uppercase tracking-wider text-mob-muted">
          {venueLabel} is deployed but not openable on testnet yet. Aave Horizon is the live venue today.
        </p>
      ) : !deployment?.ready ? (
        <p className="text-center text-[10.5px] uppercase tracking-wider text-mob-muted">{helper}</p>
      ) : null}
      {status.kind === 'error' && (
        <p className="text-center font-mono text-[11px] text-mob-neg">
          {/* Bug-hunt fix (2026-06-02): showed the raw machine code (e.g.
              wallet_not_connected) to the user; humanize it like desktop. */}
          {humanizeWalletError(status.reason).message}
          <button type="button" onClick={reset} className="ml-2 underline">retry</button>
        </p>
      )}
      {status.kind === 'success' && (
        <p className="text-center font-mono text-[11px] text-mob-live">
          tx{' '}
          <a
            href={`https://sepolia.arbiscan.io/tx/${status.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {status.hash.slice(0, 10)}...
          </a>
        </p>
      )}
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-mob-hairline px-4 py-2.5 last:border-b-0">
      <span className="text-[12px] text-mob-muted">{l}</span>
      <span className="font-mono text-[12px] text-mob-ink">{v}</span>
    </div>
  );
}

function ChartPlaceholder() {
  // Static sparkline shape until Plinth oracle data lands. Honest pending
  // state would be a blank skeleton; the canon mockup uses a visual chart
  // shape to give the panel its rhythm. Compromise: render the shape but
  // label it 'price wire pending' above so users know it is not live.
  return (
    <svg viewBox="0 0 320 56" preserveAspectRatio="none" className="h-full w-full text-mob-accent/40">
      <defs>
        <linearGradient id="mob-trade-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points="0,40 30,32 60,38 90,22 120,28 150,18 180,24 210,12 240,18 270,8 300,16 320,10"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        className="text-mob-accent"
      />
      <polygon
        points="0,56 0,40 30,32 60,38 90,22 120,28 150,18 180,24 210,12 240,18 270,8 300,16 320,10 320,56"
        fill="url(#mob-trade-fill)"
      />
    </svg>
  );
}
