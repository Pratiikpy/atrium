'use client';

import { useState } from 'react';
import { useOpenPosition } from '@/lib/use-open-position';
import { useDeploymentStatus, readinessMessage } from '@/lib/use-deployment-status';

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
 */
export function TradeMobile() {
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
  const ready = deployment?.ready === true && amountValid && !isSubmitting;
  const helper = readinessMessage(deployment, side === 'long' ? 'Open long' : 'Open short');

  const notional = (Number(amount || '0') * leverage).toFixed(2);

  const submit = () => {
    if (!ready) return;
    void open({ venue: 'trade-xyz', side, sizeUsd: notional });
  };

  return (
    <div className="md:hidden flex flex-col gap-4">
      {/* Pair head */}
      <section className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-display text-[22px] italic text-mob-ink">rTSLA-PERP</div>
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-mob-muted">HL-HIP3 . tokenized</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[18px] text-mob-ink">pending</div>
            <div className="font-mono text-[10.5px] text-mob-muted">price wire pending</div>
          </div>
        </div>
        <div className="mt-3 h-14">
          <ChartPlaceholder />
        </div>
        <div className="mt-3 flex gap-1.5">
          {['1H', '4H', '1D', '1W', '1M'].map((tf) => (
            <span
              key={tf}
              className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                tf === '1D' ? 'bg-mob-bg-elev text-mob-ink' : 'text-mob-muted'
              }`}
            >
              {tf}
            </span>
          ))}
        </div>
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
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
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
        <Row l="Initial margin" v={`$${Number(amount || '0').toLocaleString()}`} />
        <Row l="Liquidation" v="pending" />
        <Row l="Fee" v="pending" />
        <Row l="Gas" v="sponsored" />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!ready}
        className={`rounded-full py-3.5 text-center font-medium transition disabled:opacity-50 ${side === 'long' ? 'bg-mob-live text-mob-bg' : 'bg-mob-neg text-mob-bg'}`}
      >
        {isSubmitting ? 'Submitting...' : `${side === 'long' ? 'Open long' : 'Open short'} . rTSLA-PERP`}
      </button>
      {/* Honest readiness gate (mirrors desktop): explains why the CTA is off. */}
      {!deployment?.ready && (
        <p className="text-center text-[10.5px] uppercase tracking-wider text-mob-muted">{helper}</p>
      )}
      {status.kind === 'error' && (
        <p className="text-center font-mono text-[11px] text-mob-neg">
          {status.reason}
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
