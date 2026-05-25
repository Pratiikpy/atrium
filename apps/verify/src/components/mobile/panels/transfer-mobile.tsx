'use client';

import { useState } from 'react';

/**
 * TransferMobile  the Move panel for /app/transfer at < md.
 * Source: desing/Mobile App.html:1135-1182. CCIP from/to chain stack
 * with swap button + estimated-time + fee + plinth-credit summary.
 *
 * Live data: balances + CCIP route fee are not yet exposed by an API,
 * so the balance and CCIP cost render as "pending". Amount is local
 * state; the actual send flow lives in the desktop transfer-form for
 * now and a follow-up wires this mobile panel through to the same
 * wagmi writeContract.
 */
export function TransferMobile() {
  const [amount, setAmount] = useState('50000');
  const [direction, setDirection] = useState<'arb-to-eth' | 'eth-to-arb'>('arb-to-eth');

  const fromChain = direction === 'arb-to-eth' ? 'Arbitrum Sepolia' : 'Ethereum Sepolia';
  const toChain   = direction === 'arb-to-eth' ? 'Ethereum Sepolia' : 'Arbitrum Sepolia';
  const fromShort = direction === 'arb-to-eth' ? 'arb-sepolia' : 'eth-sepolia';
  const toShort   = direction === 'arb-to-eth' ? 'eth-sepolia' : 'arb-sepolia';

  return (
    <div className="md:hidden flex flex-col gap-4">
      <SectionHead t="Aqueduct . Chainlink CCIP" more="~ 8.4s" />

      {/* Chain stack with swap button */}
      <div className="relative flex flex-col gap-2.5">
        <ChainCard label="From" chain={fromChain} amount={amount} balance="pending" />
        <ChainCard label="To"   chain={toChain}   amount={amount} balance="pending" />
        <button
          type="button"
          onClick={() => setDirection((d) => (d === 'arb-to-eth' ? 'eth-to-arb' : 'arb-to-eth'))}
          aria-label="Swap direction"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-full border border-mob-line bg-mob-bg-elev text-mob-ink-soft hover:border-mob-accent"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 4v8 M2 6l2-2 2 2 M12 12V4 M10 10l2 2 2-2" />
          </svg>
        </button>
      </div>

      {/* Amount entry */}
      <label className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-3.5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">Amount . USDC</div>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          className="mt-2 w-full bg-transparent font-mono text-[24px] text-mob-ink outline-none"
        />
      </label>

      {/* CCIP route + order summary */}
      <div className="rounded-2xl border border-mob-line bg-mob-bg-card">
        <div className="flex items-baseline justify-between border-b border-mob-hairline px-4 py-3">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-mob-muted">CCIP route</div>
            <div className="mt-1 font-mono text-[11px] text-mob-ink">{fromShort} → {toShort}</div>
          </div>
          <div className="font-mono text-[11px] text-mob-muted">testnet</div>
        </div>
        <Row l="Estimated time" v="8.4 s" />
        <Row l="CCIP fee" v="pending" />
        <Row l="Gas" v="sponsored" />
        <Row l="Plinth credit" v="on arrival" />
      </div>

      <button
        type="button"
        className="rounded-full bg-mob-ink py-3.5 text-center font-medium text-mob-bg"
      >
        Move ${Number(amount || '0').toLocaleString()} USDC
      </button>
      <p className="text-center text-[10.5px] text-mob-muted">No custody . routed by Chainlink CCIP</p>
    </div>
  );
}

function ChainCard({ label, chain, amount, balance }: { label: string; chain: string; amount: string; balance: string }) {
  return (
    <div className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">{label}</div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-[14px] text-mob-ink">{chain}</span>
        <span className="font-mono text-[11px] text-mob-muted">bal {balance}</span>
      </div>
      <div className="mt-1.5 font-mono text-[20px] text-mob-ink">
        {Number(amount || '0').toLocaleString()}<span className="ml-1.5 text-[12px] text-mob-muted">USDC</span>
      </div>
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

function SectionHead({ t, more }: { t: string; more: string }) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <span className="font-display text-[20px] italic text-mob-ink">{t}</span>
      <span className="font-mono text-[10.5px] uppercase tracking-wider text-mob-muted">{more}</span>
    </div>
  );
}
