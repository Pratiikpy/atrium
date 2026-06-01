'use client';

/**
 * EmergencyStopCard - desktop kill switch, surfaced on /app/portfolio.
 *
 * The kill switch (revoke every agent mandate + session key in one tx) is the
 * strongest safety feature, but it was only reachable via the mobile FAB +
 * settings. A panic control belongs on the live-position view. This reuses the
 * exact same path as KillSwitchMobile (useKillSwitch + postern-kill-switch
 * address + the mandate/session counts) so there is one revoke implementation,
 * not two. Honest states: disabled with a reason when the contract is not
 * deployed or no wallet is connected.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useKillSwitch } from '@/lib/use-kill-switch';
import { useContractAddress } from '@/lib/use-coffer-address';
import { humanizeWalletError } from '@/lib/humanize-wallet-error';
import { arbiscanTxUrl } from '@/lib/arbiscan';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

export function EmergencyStopCard() {
  const { data: killSwitchAddress } = useContractAddress('postern-kill-switch');
  const { status, activate } = useKillSwitch(killSwitchAddress ?? null);
  const wallet = useScopedWallet();
  const [confirmed, setConfirmed] = useState(false);

  const mandates = useQuery({
    queryKey: ['estop-mandates', wallet],
    queryFn: async () => {
      const r = await fetch(walletQuery('/api/agents/my-mandates', wallet));
      if (!r.ok) return { count: 0 };
      const j = await r.json();
      return { count: (j.mandates ?? []).length };
    },
    enabled: !!wallet,
    refetchInterval: 30_000,
  });

  const sessions = useQuery({
    queryKey: ['estop-sessions', wallet],
    queryFn: async () => {
      const r = await fetch(walletQuery('/api/settings/session-keys', wallet));
      if (!r.ok) return { count: 0 };
      const j = await r.json();
      return { count: (j.keys ?? []).length };
    },
    enabled: !!wallet,
    refetchInterval: 30_000,
  });

  const successHash = status.kind === 'success' ? status.hash : null;
  const busy = status.kind === 'submitting';
  const deployed = Boolean(killSwitchAddress);

  function handle() {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    activate();
  }

  const label = !deployed
    ? 'Pending deployment'
    : !wallet
      ? 'Connect a wallet'
      : !confirmed
        ? 'Activate kill switch'
        : busy
          ? 'Revoking…'
          : status.kind === 'success'
            ? 'Revoked ✓'
            : 'Confirm, this is irreversible';

  return (
    <div className="rounded-md border bg-parchment p-5" style={{ borderColor: 'oklch(0.5 0.12 30 / 0.4)' }}>
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: 'oklch(0.5 0.12 30 / 0.12)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.5 0.14 30)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 2l8 4v5c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4z" />
            <path d="M8 12l3 3 5-5" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="font-sans font-medium tracking-[-0.01em] text-ink" style={{ fontSize: 16 }}>
            Emergency stop
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            One tap revokes every agent mandate and session key. Use it if a mandate misbehaves or you
            suspect unauthorized access.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-6">
        <div>
          <p className="font-mono text-[18px] text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {wallet ? (mandates.data?.count ?? '-') : '-'}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted">Active mandates</p>
        </div>
        <div>
          <p className="font-mono text-[18px] text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {wallet ? (sessions.data?.count ?? '-') : '-'}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted">Session keys</p>
        </div>
      </div>

      {status.kind === 'error' && (
        <p className="mt-3 text-[12px] text-neg">{humanizeWalletError(status.reason).message}</p>
      )}
      {successHash &&
        (() => {
          const url = arbiscanTxUrl(successHash);
          return url ? (
            <a href={url} target="_blank" rel="noreferrer" className="mt-3 block font-mono text-[12px] text-accent">
              {successHash.slice(0, 10)}…{successHash.slice(-6)} ↗
            </a>
          ) : null;
        })()}

      <button
        onClick={handle}
        disabled={!deployed || !wallet || busy || status.kind === 'success'}
        className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-neg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        title={!deployed ? 'Kill switch contract pending deployment' : !wallet ? 'Connect a wallet first' : undefined}
      >
        {label}
      </button>
    </div>
  );
}
