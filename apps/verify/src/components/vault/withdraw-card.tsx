'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { useDeploymentStatus, readinessMessage } from '@/lib/use-deployment-status';
import { useContractAddress } from '@/lib/use-coffer-address';
import { useVaultWithdraw } from '@/lib/use-vault-withdraw';
import { humanizeWalletError } from '@/lib/humanize-wallet-error';
import { USDC_DECIMALS } from '@/lib/testnet-tokens';
import { sanitizeAmount } from '@/lib/sanitize-amount';

// Read the connected wallet's redeemable USDC: Coffer.balanceOf(user) shares
// -> convertToAssets. Used to gate an over-balance withdraw client-side (the
// withdraw form previously had NO balance gate, so a user could submit more
// than they hold and eat a raw chain revert (caught by the launch audit).
const COFFER_READ_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'convertToAssets', stateMutability: 'view', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const;

/**
 * Vault · Withdraw. Audit U-15 follow-on to deposit-card.tsx: previously
 * the submit had no onClick. Now it runs a single-tx
 * `coffer.withdraw(assets, receiver, owner)` via wagmi and surfaces the
 * tx link on success. Errors render with the wallet's actual message.
 *
 * Phase theta audit follow-up (2026-05-25): the hook + UI used to ask
 * for share-count input and call `redeem`, Coffer doesn't export
 * `redeem`, only `withdraw`. UI now asks for USDC amount; the contract
 * computes the share burn via convert_to_shares_ceil (round-up so the
 * user surrenders at least as many shares as the assets they take).
 */
export function VaultWithdraw() {
  const [amount, setAmount] = useState('');
  const { address } = useAccount();
  const { data: deployment } = useDeploymentStatus(1);
  const { data: cofferAddress } = useContractAddress('coffer');
  const { status, withdraw, reset } = useVaultWithdraw(cofferAddress ?? null);

  // Redeemable USDC = convertToAssets(balanceOf(user)). Gates over-balance.
  const { data: shares } = useReadContract({
    address: cofferAddress ?? undefined,
    abi: COFFER_READ_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!cofferAddress && !!address },
  });
  const { data: redeemableRaw } = useReadContract({
    address: cofferAddress ?? undefined,
    abi: COFFER_READ_ABI,
    functionName: 'convertToAssets',
    args: shares != null ? [shares] : undefined,
    query: { enabled: !!cofferAddress && shares != null },
  });
  const redeemableUsd =
    redeemableRaw != null ? Number(formatUnits(redeemableRaw as bigint, USDC_DECIMALS)) : null;

  const helper = readinessMessage(deployment, 'Withdraw');
  // >= 1 micro-USDC floor (sub-precision floors to 0 on-chain) AND <= redeemable
  // balance (a connected user must not be able to submit more than they hold and
  // eat a raw chain revert (launch-audit defect).
  const overBalance = redeemableUsd != null && parseFloat(amount) > redeemableUsd + 1e-9;
  // Audit U-15 follow-up: the over-balance gate can only fire once redeemableUsd
  // is known. While a connected wallet's balanceOf -> convertToAssets reads are
  // still loading, redeemableUsd is null and `overBalance` short-circuits to
  // false, so the button would fall open for an over-balance amount and eat a
  // raw chain revert (the exact defect this gate prevents). Hold the button
  // (showing "Checking balance…") until the redeemable balance resolves.
  const balanceUnverified = !!address && redeemableUsd == null;
  const ready =
    deployment?.ready === true &&
    !!address &&
    parseFloat(amount) >= 0.000001 &&
    !overBalance &&
    !balanceUnverified;
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
          <span className="flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted">USDC to withdraw</span>
            {redeemableUsd != null && (
              <button
                type="button"
                disabled={busy || redeemableUsd <= 0}
                onClick={() => setAmount(String(redeemableUsd))}
                className="text-[10px] uppercase tracking-wider text-ink-soft underline disabled:opacity-40"
              >
                Max {redeemableUsd.toFixed(2)}
              </button>
            )}
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
            disabled={busy}
            className="mt-1 w-full rounded-md border border-divider bg-parchment-light px-4 py-3 font-mono text-lg text-ink min-h-[44px] focus:border-ink/40 focus:outline-none"
          />
          {overBalance && (
            <span className="mt-1 block text-[11px] text-neg">
              Exceeds your redeemable balance ({redeemableUsd?.toFixed(2)} USDC).
            </span>
          )}
        </label>
        <button
          type="submit"
          disabled={!ready || busy}
          className="w-full rounded-md border border-divider bg-parchment-light px-5 py-3 text-sm min-h-[44px] font-medium text-ink hover:border-ink/30 disabled:opacity-50"
        >
          {buttonLabel(status, amount, balanceUnverified)}
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
  balanceUnverified?: boolean,
): string {
  if (status.kind === 'submitting') return 'Submitting…';
  if (status.kind === 'success') return 'Withdraw again';
  if (balanceUnverified && parseFloat(amount) > 0) return 'Checking balance…';
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
