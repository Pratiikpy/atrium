'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useDeploymentStatus, readinessMessage } from '@/lib/use-deployment-status';
import { useContractAddress } from '@/lib/use-coffer-address';
import { useVaultDeposit } from '@/lib/use-vault-deposit';
import { useBalanceAware } from '@/lib/use-balance-aware';
import { humanizeWalletError } from '@/lib/humanize-wallet-error';
import { ARB_SEPOLIA_USDC, USDC_DECIMALS } from '@/lib/testnet-tokens';

/**
 * Vault · Deposit. Audit U-15: previously the submit button had
 * `type="button"` but no `onClick` handler, fully dead. Now the click
 * runs an honest approve→deposit flow via wagmi:
 *
 *   - If the user's USDC allowance is below the deposit amount, send
 *     `USDC.approve(coffer, amount)` first and surface the approve tx
 *     link. A second click then sends the deposit.
 *   - If allowance is sufficient, skip approve and send
 *     `coffer.deposit(amount, receiver)` directly.
 *   - Every failure surfaces the real reason ("invalid_amount",
 *     "coffer_not_deployed", or the wallet error message) instead of
 *     silently doing nothing.
 *
 * Disabled state still gates on `useDeploymentStatus(1)` so the button
 * isn't even clickable until Coffer is in the registry.
 */
export function VaultDeposit() {
  const [amount, setAmount] = useState('');
  const { data: deployment } = useDeploymentStatus(1);
  const { data: cofferAddress } = useContractAddress('coffer');
  const { status, deposit, reset } = useVaultDeposit(cofferAddress ?? null);
  const { max, disabledReason } = useBalanceAware({
    token: ARB_SEPOLIA_USDC,
    decimals: USDC_DECIMALS,
    inputAmount: amount,
  });

  const helper = readinessMessage(deployment, 'Deposit');
  // >= 1 micro-USDC (USDC has 6 decimals): a sub-precision amount like 0.0000001
  // is > 0 but parseUnits-floors to 0, so the deposit would revert. Floor at
  // 0.000001 so the button never enables an amount that can only round to zero.
  const ready = deployment?.ready === true && parseFloat(amount) >= 0.000001 && !disabledReason;
  const busy =
    status.kind === 'checking' || status.kind === 'approving' || status.kind === 'depositing';

  return (
    <section className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-xl italic text-ink">Deposit</p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">USDC</span>
      </header>

      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) deposit(amount);
        }}
      >
        <label className="block">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted">Amount</span>
            {max && (
              <button type="button" onClick={() => setAmount(max)} className="text-[10px] text-muted hover:text-ink">
                Max
              </button>
            )}
          </div>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-md border border-divider bg-parchment-light px-4 py-3 font-mono text-lg text-ink min-h-[44px] focus:border-ink/40 focus:outline-none"
          />
          {disabledReason && (
            <p className="mt-1 text-[10px] text-neg">{disabledReason}</p>
          )}
        </label>
        <button
          type="submit"
          disabled={!ready || busy}
          className="w-full rounded-md bg-ink px-5 py-3 text-sm min-h-[44px] font-medium text-parchment hover:bg-ink-dark disabled:opacity-50"
        >
          {buttonLabel(status, amount)}
        </button>
        {helper && (
          <p className="text-[10px] uppercase tracking-wider text-muted">{helper}</p>
        )}
        <DepositStatusLine status={status} onReset={reset} />
        <p className="text-xs text-muted">
          Mints ERC-4626 shares. Per-user cap and global cap apply. See{' '}
          <Link href="/learn" className="underline">Vault explainer</Link>.
        </p>
      </form>
    </section>
  );
}

function buttonLabel(
  status: ReturnType<typeof useVaultDeposit>['status'],
  amount: string,
): string {
  if (status.kind === 'checking') return 'Checking allowance…';
  if (status.kind === 'approving') return 'Approve sent · click again';
  if (status.kind === 'depositing') return 'Depositing…';
  if (status.kind === 'success') return 'Deposit again';
  return `Deposit ${amount || '0'} USDC`;
}

function DepositStatusLine({
  status,
  onReset,
}: {
  status: ReturnType<typeof useVaultDeposit>['status'];
  onReset: () => void;
}) {
  if (status.kind === 'idle' || status.kind === 'checking') return null;
  if (status.kind === 'approving') {
    return (
      <p className="text-xs text-ink-soft">
        Approve tx submitted · <ArbiscanLink hash={status.hash} />
        <br />
        Click <span className="font-medium text-ink">Deposit</span> again once the wallet
        confirms.
      </p>
    );
  }
  if (status.kind === 'depositing') {
    return (
      <p className="text-xs text-ink-soft">
        Deposit tx submitted · <ArbiscanLink hash={status.hash} />
      </p>
    );
  }
  if (status.kind === 'success') {
    return (
      <p className="text-xs text-live">
        Deposited. <ArbiscanLink hash={status.depositHash} /> ·{' '}
        <button type="button" onClick={onReset} className="underline">
          deposit more
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
