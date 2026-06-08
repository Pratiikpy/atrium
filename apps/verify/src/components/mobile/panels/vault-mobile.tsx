'use client';

/**
 * VaultMobile, Mobile-optimized deposit/withdraw panel.
 * Mobile flow: Deposit USDC (one of the 5 required mobile flows).
 * Re-uses useVaultDeposit, useVaultWithdraw, useBalanceAware from Phase 5a.
 * 44px touch targets, 16px body text, safe-area padding.
 */

import { useState } from 'react';
import { sanitizeAmount } from '@/lib/sanitize-amount';
import { useVaultDeposit } from '@/lib/use-vault-deposit';
import { useVaultWithdraw } from '@/lib/use-vault-withdraw';
import { useBalanceAware } from '@/lib/use-balance-aware';
import { useContractAddress } from '@/lib/use-coffer-address';
import { useChainGuard } from '@/lib/use-chain-guard';
import { useContractPaused } from '@/lib/use-contract-paused';
import { useGasPreview } from '@/lib/use-gas-preview';
import { humanizeWalletError } from '@/lib/humanize-wallet-error';
import { arbiscanTxUrl } from '@/lib/arbiscan';
import { ARB_SEPOLIA_USDC, USDC_DECIMALS } from '@/lib/testnet-tokens';

type Mode = 'deposit' | 'withdraw';

export function VaultMobile() {
  const { data: cofferAddress } = useContractAddress('coffer');
  const chainGuard = useChainGuard();
  const { paused } = useContractPaused('coffer');
  const [mode, setMode] = useState<Mode>('deposit');
  const [amount, setAmount] = useState('');

  const { balanceFormatted, max, disabledReason } = useBalanceAware({
    token: ARB_SEPOLIA_USDC,
    decimals: USDC_DECIMALS,
    inputAmount: amount,
  });

  const deposit = useVaultDeposit(cofferAddress ?? null);
  const withdraw = useVaultWithdraw(cofferAddress ?? null);
  const activeStatus = mode === 'deposit' ? deposit.status : withdraw.status;

  const { gasEstUsd } = useGasPreview({
    to: cofferAddress ?? undefined,
    enabled: Boolean(cofferAddress && amount && parseFloat(amount) > 0),
  });

  const [errorExpanded, setErrorExpanded] = useState(false);

  function handleSubmit() {
    if (mode === 'deposit') deposit.deposit(amount);
    else withdraw.withdraw(amount);
  }

  function handleMax() {
    if (max) setAmount(max);
  }

  const successHash =
    activeStatus.kind === 'success'
      ? ('depositHash' in activeStatus ? activeStatus.depositHash : activeStatus.hash)
      : null;

  const isPending = activeStatus.kind === 'checking' || activeStatus.kind === 'approving' ||
    activeStatus.kind === 'depositing' || activeStatus.kind === 'submitting' ||
    ('kind' in activeStatus && activeStatus.kind === 'pending');

  const gasLabel = gasEstUsd ? `, ~${gasEstUsd} gas` : '';
  const submitLabel = mode === 'deposit' ? `Deposit${gasLabel}` : `Withdraw${gasLabel}`;

  return (
    <div className="flex flex-col gap-4" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Wrong chain banner */}
      {!chainGuard.ok && (
        <button
          onClick={chainGuard.switchChain}
          className="min-h-[44px] w-full rounded-xl bg-testnet/10 border border-testnet/40 px-4 py-3 text-[16px] text-testnet"
        >
          Wrong network, tap to switch to {chainGuard.target.name}
        </button>
      )}

      {/* Contract paused banner */}
      {paused && (
        <div className="min-h-[44px] rounded-xl bg-neg/10 border border-neg/40 px-4 py-3 text-[16px] text-neg">
          Coffer is paused, deposits and withdrawals disabled
        </div>
      )}

      {/* Balance card */}
      <section className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">USDC Balance</p>
        <p className="mt-1 text-[24px] font-medium text-mob-ink">
          ${balanceFormatted ?? '-'}
        </p>
      </section>

      {/* Segmented control */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-mob-line bg-mob-bg-card p-1">
        {(['deposit', 'withdraw'] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); deposit.reset(); withdraw.reset(); setAmount(''); }}
            className={`min-h-[44px] rounded-lg text-[16px] font-medium capitalize transition-colors ${
              mode === m ? 'bg-mob-accent text-mob-bg' : 'text-mob-muted'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-mob-muted">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
          placeholder="0.00"
          className="h-[56px] w-full rounded-xl border border-mob-line bg-mob-bg-card pl-8 pr-20 text-[18px] text-mob-ink placeholder:text-mob-muted focus:border-mob-accent focus:outline-none"
        />
        <button
          onClick={handleMax}
          className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-lg bg-mob-bg-elev px-3 text-[14px] font-medium text-mob-accent"
        >
          Max
        </button>
      </div>

      {/* Disabled reason */}
      {disabledReason && (
        <p className="text-[14px] text-neg">{disabledReason}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isPending || !chainGuard.ok || paused || Boolean(disabledReason) || !amount}
        className="h-[56px] w-full rounded-xl bg-mob-accent text-[16px] font-medium text-mob-bg disabled:opacity-40"
      >
        {isPending ? 'Processing…' : submitLabel}
      </button>

      {/* Status line */}
      {isPending && <div className="skeleton h-5 w-3/4 rounded" />}
      {successHash && (() => {
        const url = arbiscanTxUrl(successHash);
        return url ? (
          <a href={url} target="_blank" rel="noreferrer" className="font-mono text-[14px] text-mob-accent">
            {successHash.slice(0, 10)}…{successHash.slice(-6)} ↗
          </a>
        ) : null;
      })()}

      {/* Error */}
      {activeStatus.kind === 'error' && (
        <div className="rounded-xl border border-neg/40 bg-neg/5 px-4 py-3">
          <button
            onClick={() => setErrorExpanded(!errorExpanded)}
            className="min-h-[44px] w-full text-left text-[16px] text-neg"
          >
            {humanizeWalletError(activeStatus.reason).message}
          </button>
          {errorExpanded && humanizeWalletError(activeStatus.reason).raw && (
            <p className="mt-2 break-all font-mono text-[12px] text-mob-muted">
              {humanizeWalletError(activeStatus.reason).raw}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
