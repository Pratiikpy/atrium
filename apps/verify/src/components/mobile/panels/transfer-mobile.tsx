'use client';

import { useState } from 'react';
import { useTransfer } from '@/lib/use-transfer';
import { arbiscanTxUrl } from '@/lib/arbiscan';

/**
 * TransferMobile - the Move panel for /app/transfer at < md.
 *
 * Audit fix (#14/#17/#43): the panel previously had a DEAD "Move $X USDC"
 * button (no onClick), a fabricated default amount (50000), a fabricated
 * "8.4 s" estimated time, and the wrong chain model (Arbitrum<->Ethereum,
 * a design-mock placeholder). The real Aqueduct route is Arbitrum Sepolia
 * <-> Robinhood Chain (per lib/use-transfer CHAIN_SELECTORS + the desktop
 * transfer-form). Now it mirrors the desktop: the button calls the real
 * useTransfer().submit (Aqueduct.send via wagmi), is disabled with the honest
 * preflight reason when it can't run, shows tx status, starts empty, and the
 * estimated time is an honest range.
 */
const CHAIN_LABELS: Record<string, string> = {
  'arb-sepolia': 'Arbitrum Sepolia',
  'rh-chain': 'Robinhood Chain',
};

export function TransferMobile() {
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState('arb-sepolia');
  const [to, setTo] = useState('rh-chain');
  const { submit, status, txHash, preflight } = useTransfer();

  const busy = status.kind === 'submitting' || status.kind === 'pending';
  const amountValid = amount.length > 0 && parseFloat(amount) > 0;
  const canMove = amountValid && !preflight && !busy;

  return (
    <div className="md:hidden flex flex-col gap-4">
      <SectionHead t="Aqueduct . Chainlink CCIP" more="~7–12s" />

      {/* Chain stack with swap button */}
      <div className="relative flex flex-col gap-2.5">
        <ChainCard label="From" chain={CHAIN_LABELS[from] ?? from} amount={amount} />
        <ChainCard label="To"   chain={CHAIN_LABELS[to] ?? to}   amount={amount} />
        <button
          type="button"
          onClick={() => { setFrom(to); setTo(from); }}
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
          placeholder="0"
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          className="mt-2 w-full bg-transparent font-mono text-[24px] text-mob-ink outline-none placeholder:text-mob-muted"
        />
      </label>

      {/* CCIP route + order summary */}
      <div className="rounded-2xl border border-mob-line bg-mob-bg-card">
        <div className="flex items-baseline justify-between border-b border-mob-hairline px-4 py-3">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-mob-muted">CCIP route</div>
            <div className="mt-1 font-mono text-[11px] text-mob-ink">{from} → {to}</div>
          </div>
          <div className="font-mono text-[11px] text-mob-muted">testnet</div>
        </div>
        <Row l="Estimated time" v="~7–12s" />
        <Row l="CCIP fee" v="pending" />
        <Row l="Gas" v="sponsored" />
        <Row l="Plinth credit" v="on arrival" />
      </div>

      <button
        type="button"
        onClick={() => submit({ amount, destChain: to })}
        disabled={!canMove}
        className="rounded-full bg-mob-ink py-3.5 text-center font-medium text-mob-bg disabled:opacity-50"
      >
        {busy ? 'Moving…' : `Move ${amountValid ? '$' + Number(amount).toLocaleString() + ' ' : ''}USDC`}
      </button>

      {/* Honest status / preflight reason (no dead button). */}
      {preflight && (
        <p className="text-center text-[10.5px] uppercase tracking-wider text-mob-muted">{preflight}</p>
      )}
      {status.kind === 'error' && (
        <p className="text-center text-[11px] text-neg">{status.reason}</p>
      )}
      {txHash && (() => {
        const url = arbiscanTxUrl(txHash);
        return url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-center font-mono text-[11px] text-mob-accent">
            {txHash.slice(0, 10)}…{txHash.slice(-6)} ↗
          </a>
        ) : null;
      })()}
      <p className="text-center text-[10.5px] text-mob-muted">No custody . routed by Chainlink CCIP</p>
    </div>
  );
}

function ChainCard({ label, chain, amount }: { label: string; chain: string; amount: string }) {
  return (
    <div className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">{label}</div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-[14px] text-mob-ink">{chain}</span>
        <span className="font-mono text-[11px] text-mob-muted">bal pending</span>
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
