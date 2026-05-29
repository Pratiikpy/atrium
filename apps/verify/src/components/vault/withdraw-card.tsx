'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useDeploymentStatus, readinessMessage } from '@/lib/use-deployment-status';
import { useContractAddress } from '@/lib/use-coffer-address';
import { useVaultWithdraw } from '@/lib/use-vault-withdraw';
import { humanizeWalletError } from '@/lib/humanize-wallet-error';

/**
 * Vault · Withdraw. Audit U-15 follow-on to deposit-card.tsx: previously
 * the submit had no onClick. Now it runs a single-tx
 * `coffer.withdraw(assets, receiver, owner)` via wagmi and surfaces the
 * tx link on success. Errors render with the wallet's actual message.
 *
 * Phase theta audit follow-up (2026-05-25): the hook + UI used to ask
 * for share-count input and call `redeem` — Coffer doesn't export
 * `redeem`, only `withdraw`. UI now asks for USDC amount; the contract
 * computes the share burn via convert_to_shares_ceil (round-up so the
 * user surrenders at least as many shares as the assets they take).
 */
export function VaultWithdraw() {
  const [amount, setAmount] = useState('');
  const { data: deployment } = useDeploymentStatus(1);
  const { data: cofferAddress } = useContractAddress('coffer');
  const { status, withdraw, reset } = useVaultWithdraw(cofferAddress ?? null);

  const helper = readinessMessage(deployment, 'Withdraw');
  const ready = deployment?.ready === true && amount.length > 0 && parseFloat(amount) > 0;
  const busy = status.kind === 'submitting';

  return (
    <section className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-xl italic text-ink">Withdraw</p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          USDC
        </span>
      </header>

      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) withdraw(amount);
        }}
      >
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted">USDC to withdraw</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-md border border-divider bg-parchment-light px-4 py-3 font-mono text-lg text-ink min-h-[44px] focus:border-ink/40 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={!ready || busy}
          className="w-full rounded-md border border-divider bg-parchment-light px-5 py-3 text-sm min-h-[44px] font-medium text-ink hover:border-ink/30 disabled:opacity-50"
        >
          {buttonLabel(status, amount)}
        </button>
        {helper && (
          <p className="text-[10px] uppercase tracking-wider text-muted">{helper}</p>
        )}
        <WithdrawStatusLine status={status} onReset={reset} />
        <p className="text-xs text-muted">
          Subject to TVL-drop circuit breaker. See{' '}
          <Link href="/sla" className="underline">withdrawal SLA</Link>.
        </p>
      </form>
    </section>
  );
}

function buttonLabel(
  status: ReturnType<typeof useVaultWithdraw>['status'],
  amount: string,
): string {
  if (status.kind === 'submitting') return 'Submitting…';
  if (status.kind === 'success') return 'Withdraw again';
  return `Withdraw ${amount || '0'} USDC`;
}

function WithdrawStatusLine({
  status,
  onReset,
}: {
  status: ReturnType<typeof useVaultWithdraw>['status'];
  onReset: () => void;
}) {
  if (status.kind === 'idle' || status.kind === 'submitting') return null;
  if (status.kind === 'pending' || status.kind === 'success') {
    return (
      <p className={'text-xs ' + (status.kind === 'success' ? 'text-live' : 'text-ink-soft')}>
        {status.kind === 'success' ? 'Withdrew. ' : 'Withdraw tx submitted · '}
        <ArbiscanLink hash={status.hash} />
        {' '}·{' '}
        <button type="button" onClick={onReset} className="underline">
          new withdrawal
        </button>
      </p>
    );
  }
  if (status.kind === 'error') {
    return (
      <p className="text-xs text-neg">
        Failed: {humanizeReason(status.reason)} ·{' '}
        <button type="button" onClick={onReset} className="underline">
          retry
        </button>
      </p>
    );
  }
  return null;
}

function ArbiscanLink({ hash }: { hash: `0x${string}` }) {
  return (
    <a
      href={`https://sepolia.arbiscan.io/tx/${hash}`}
      target="_blank"
      rel="noreferrer noopener"
      className="font-mono underline"
    >
      {hash.slice(0, 8)}…{hash.slice(-4)}
    </a>
  );
}

function humanizeReason(reason: string): string {
  return humanizeWalletError(reason).message;
}
