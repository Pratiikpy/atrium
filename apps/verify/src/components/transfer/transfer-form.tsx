'use client';

import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDeploymentStatus, readinessMessage } from '@/lib/use-deployment-status';
import { useScopedWallet } from '@/lib/use-scoped-wallet';
import { useTransfer, isDestChainSupported } from '@/lib/use-transfer';
import { humanizeWalletError } from '@/lib/humanize-wallet-error';

/**
 * Transfer form. Audit P-2 fix: prior version had hardcoded balances
 * (1,264,300 / 318,940), fake 8.4s estimated time, fake $0.00 fees, and a
 * permanently disabled CTA with no copy. Now:
 *   - balances read live from /api/transfer/chain-balance per chain
 *   - estimated time + fees read live from /api/transfer/quote
 *   - CTA enabled only when /api/deployments/status?step=1 (Coffer) and the
 *     Aqueduct deployment both report ready
 *   - helper copy under disabled CTA explains why
 */

const CHAINS = [
  { id: 'arb-sepolia', label: 'Arbitrum Sepolia', short: 'ARB' },
  { id: 'rh-chain', label: 'Robinhood Chain', short: 'RHC' },
];
const TOKENS = ['USDC', 'USDT', 'LINK'];

interface ChainBalance { tokenSymbol: string; balanceFormatted: string | null; source: 'rpc' | 'pending'; }
interface TransferQuote {
  estimatedSeconds: number | null;
  ccipFeeUsd: string | null;
  gasFeeUsd: string | null;
  postedAt: string;
  // 'estimate' = computed testnet estimate (not a live CCIP router read);
  // 'pending' = Aqueduct not deployed. There is no 'aqueduct' live-quote
  // source yet, see /api/transfer/quote and human_left.md aqueduct-live-quote.
  source: 'estimate' | 'pending';
  isLiveQuote?: boolean;
  note?: string;
}

async function fetchBalance(chain: string, token: string, wallet: string | null): Promise<ChainBalance> {
  try {
    // Audit OO-5 fix: even though chain/token come from closed-enum dropdowns,
    // any state-injected value (DevTools, future codemod) would corrupt the
    // URL. URLSearchParams is the defense-in-depth.
    const params = new URLSearchParams({ chain, token });
    if (wallet) params.set('wallet', wallet);
    const r = await fetch(`/api/transfer/chain-balance?${params.toString()}`);
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { tokenSymbol: token, balanceFormatted: null, source: 'pending' };
  }
}
async function fetchQuote(amount: string, from: string, to: string, token: string): Promise<TransferQuote> {
  try {
    // Audit OO-5 fix: amount is user-controlled. Prior code interpolated it
    // unencoded into the query string, allowing characters like `&` or `=`
    // to inject extra query params client-side. URLSearchParams safely encodes.
    const params = new URLSearchParams({ amount, from, to, token });
    const r = await fetch(`/api/transfer/quote?${params.toString()}`);
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { estimatedSeconds: null, ccipFeeUsd: null, gasFeeUsd: null, postedAt: 'on arrival', source: 'pending' };
  }
}

export function TransferForm() {
  const [token, setToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState('arb-sepolia');
  const [to, setTo] = useState('rh-chain');

  const wallet = useScopedWallet();
  const { submit: transferSubmit, status: txStatus, preflight, reset: resetTx } = useTransfer();
  const deferredAmount = useDeferredValue(amount);
  const fromBalance = useQuery({
    queryKey: ['balance', from, token, wallet],
    queryFn: () => fetchBalance(from, token, wallet),
    refetchInterval: 30_000,
  });
  const toBalance = useQuery({
    queryKey: ['balance', to, token, wallet],
    queryFn: () => fetchBalance(to, token, wallet),
    refetchInterval: 30_000,
  });
  const quote = useQuery({
    queryKey: ['transfer-quote', deferredAmount, from, to, token],
    queryFn: () => fetchQuote(deferredAmount, from, to, token),
    enabled: deferredAmount.length > 0,
    refetchInterval: 15_000,
  });
  const { data: deployment } = useDeploymentStatus(1);
  // Robinhood Chain has no live CCIP lane on testnet (selector 0): the hook
  // refuses a 0-selector send, so the CTA must disable + say why honestly,
  // never submit a dead tx (persona-sweep cross-chain fix).
  const destSupported = isDestChainSupported(to);
  const helper = !destSupported
    ? `Cross-chain transfer to ${CHAINS.find((c) => c.id === to)?.label ?? to} is pending its CCIP lane on testnet; pick a supported destination.`
    : readinessMessage(deployment, 'Transfer');
  const ready =
    destSupported && deployment?.ready === true && amount.length > 0 && parseFloat(amount) > 0 && !preflight;
  const busy = txStatus.kind === 'submitting' || txStatus.kind === 'pending';

  return (
    <section className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-xl italic text-ink">New transfer</p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-live/30 bg-live/5 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-live">
          <span className="size-1.5 rounded-full bg-live" /> CCIP testnet
        </span>
      </header>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted">Token</span>
          <select
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1 w-full rounded-md border border-divider bg-parchment-light px-4 py-3 text-sm text-ink focus:border-ink/40 focus:outline-none"
          >
            {TOKENS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <ChainPicker
            label="From"
            value={from}
            onChange={setFrom}
            balance={fromBalance.data}
          />
          <button
            type="button"
            onClick={() => { setFrom(to); setTo(from); }}
            aria-label="Swap chains"
            className="hidden self-end pb-3 text-muted hover:text-ink sm:inline"
          >
            ⇌
          </button>
          <ChainPicker
            label="To"
            value={to}
            onChange={setTo}
            balance={toBalance.data}
          />
        </div>

        <label className="block">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted">Amount</span>
            <div className="flex gap-1 text-[10px]">
              <PercentChip onClick={(p) => setAmount(percentOf(fromBalance.data?.balanceFormatted, p))} pct={25} />
              <PercentChip onClick={(p) => setAmount(percentOf(fromBalance.data?.balanceFormatted, p))} pct={50} />
              <PercentChip onClick={() => setAmount(stripFmt(fromBalance.data?.balanceFormatted) ?? '')} pct={100} label="Max" />
            </div>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-md border border-divider bg-parchment-light px-4 py-3 font-mono text-2xl text-ink focus:border-ink/40 focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-muted">
            {/* Audit OO-4 fix: prior code did `parseFloat(amount).toLocaleString(...)`
                without finite check. If user typed "NaN", "abc", or "Infinity"
                the line rendered `≈ $NaN USD` to the screen. */}
            ≈ ${(() => {
              if (!amount) return '0.00';
              const v = parseFloat(amount);
              return Number.isFinite(v) && v >= 0
                ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '-';
            })()} USD
          </p>
        </label>

        <dl className="space-y-1.5 border-t border-divider-soft pt-4 text-xs">
          <Row
            label="Estimated time"
            value={quote.data?.estimatedSeconds != null ? `${quote.data.estimatedSeconds.toFixed(1)}s` : '-'}
          />
          <Row label="CCIP fee" value={quote.data?.ccipFeeUsd ?? '-'} />
          <Row label="Gas · arb-sepolia" value={quote.data?.gasFeeUsd ?? '-'} />
          <Row label="Plinth credit posted" value={quote.data?.postedAt ?? 'on arrival'} />
        </dl>
        <p className="text-[9px] uppercase tracking-wider text-muted">
          {quote.data?.source === 'estimate'
            ? 'testnet estimate · not a live CCIP router quote'
            : 'aqueduct pending · estimate populates after deploy'}
        </p>

        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => transferSubmit({ amount, destChain: to })}
          className="w-full rounded-md bg-ink px-4 py-3 text-sm font-medium text-parchment hover:bg-ink-dark disabled:opacity-50"
        >
          {busy ? 'Submitting…' : `Transfer ${amount || '0'} ${token} →`}
        </button>
        {txStatus.kind === 'pending' && txStatus.hash && (
          <p className="text-xs text-ink-soft">
            Submitted ·{' '}
            <a href={`https://sepolia.arbiscan.io/tx/${txStatus.hash}`} target="_blank" rel="noreferrer" className="font-mono underline">
              {txStatus.hash.slice(0, 8)}…{txStatus.hash.slice(-4)}
            </a>
          </p>
        )}
        {txStatus.kind === 'success' && txStatus.hash && (
          <p className="text-xs text-live">
            Confirmed ·{' '}
            <a href={`https://sepolia.arbiscan.io/tx/${txStatus.hash}`} target="_blank" rel="noreferrer" className="font-mono underline">
              {txStatus.hash.slice(0, 8)}…{txStatus.hash.slice(-4)}
            </a>
            {' · '}
            <button type="button" onClick={resetTx} className="underline">new transfer</button>
          </p>
        )}
        {txStatus.kind === 'error' && (
          <p className="text-xs text-neg">
            {humanizeWalletError(txStatus.reason).message}
            {' · '}
            <button type="button" onClick={resetTx} className="underline">retry</button>
          </p>
        )}
        {preflight && (
          <p className="text-[10px] uppercase tracking-wider text-muted">{preflight}</p>
        )}
        {helper && (
          <p className="text-[10px] uppercase tracking-wider text-muted">{helper}</p>
        )}
        <p className="text-center text-[9px] uppercase tracking-wider text-muted">
          Cross-chain message goes through Chainlink CCIP. Atrium never custodies funds.
        </p>
      </div>
    </section>
  );
}

function ChainPicker({
  label, value, onChange, balance,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  balance?: ChainBalance;
}) {
  return (
    <label className="block rounded-md border border-divider bg-parchment-light px-4 py-3">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full appearance-none bg-transparent text-sm font-medium text-ink focus:outline-none"
      >
        {CHAINS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <span className="mt-0.5 block font-mono text-[11px] text-muted">
        Balance {balance?.balanceFormatted ?? '-'}
      </span>
    </label>
  );
}

function PercentChip({ pct, onClick, label }: { pct: number; onClick: (p: number) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onClick(pct)}
      className="rounded px-1.5 py-0.5 text-muted hover:bg-parchment-soft hover:text-ink"
    >
      {label ?? `${pct}%`}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono text-ink">{value}</dd>
    </div>
  );
}

function stripFmt(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/,/g, '').replace(/[^\d.]/g, '');
}
function percentOf(s: string | null | undefined, p: number): string {
  const v = parseFloat(stripFmt(s) ?? '0');
  if (!isFinite(v) || v <= 0) return '';
  return ((v * p) / 100).toString();
}
