'use client';

/**
 * KillSwitchMobile, Full-screen kill switch interface.
 * Mobile flow: Kill Switch (one of the 5 required mobile flows).
 * Re-uses useKillSwitch from Phase 5a.
 * 44px touch targets, 16px body text, safe-area padding.
 * Includes persistent FAB (KillSwitchFAB) for every authenticated mobile page.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useKillSwitch } from '@/lib/use-kill-switch';
import { useContractAddress } from '@/lib/use-coffer-address';
import { humanizeWalletError } from '@/lib/humanize-wallet-error';
import { arbiscanTxUrl } from '@/lib/arbiscan';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

export function KillSwitchMobile({ onClose }: { onClose?: () => void }) {
  const { data: killSwitchAddress } = useContractAddress('postern-kill-switch');
  const { status, activate } = useKillSwitch(killSwitchAddress ?? null);
  const wallet = useScopedWallet();
  const [confirmed, setConfirmed] = useState(false);

  const mandates = useQuery({
    queryKey: ['kill-switch-mandates', wallet],
    queryFn: async () => {
      const r = await fetch(walletQuery('/api/agents/my-mandates', wallet));
      if (!r.ok) return { count: 0 };
      const j = await r.json();
      return { count: (j.mandates ?? []).length };
    },
    refetchInterval: 30_000,
  });

  const sessions = useQuery({
    queryKey: ['kill-switch-sessions', wallet],
    queryFn: async () => {
      const r = await fetch(walletQuery('/api/settings/session-keys', wallet));
      if (!r.ok) return { count: 0 };
      const j = await r.json();
      return { count: (j.keys ?? []).length };
    },
    refetchInterval: 30_000,
  });

  function handleActivate() {
    if (!confirmed) { setConfirmed(true); return; }
    activate();
  }

  const successHash = status.kind === 'success' ? status.hash : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-mob-bg px-4 pt-4 pb-8"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)',
      }}
    >
      {/* Close */}
      {onClose && (
        <button onClick={onClose} className="min-h-[44px] min-w-[44px] self-end text-[16px] text-mob-muted">
          ✕
        </button>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {/* Shield icon */}
        <div className="grid size-20 place-items-center rounded-full bg-neg/10">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l8 4v5c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4z" />
            <path d="M8 12l3 3 5-5" />
          </svg>
        </div>

        <h1 className="text-center text-[24px] font-medium text-mob-ink">
          Revoke every mandate and session key
        </h1>

        {/* Bullets */}
        <ul className="space-y-2 text-[16px] text-mob-ink-soft">
          <li>• Revokes all Sigil agent mandates</li>
          <li>• Cancels all Postern session keys</li>
          <li>• Stops all automated trading immediately</li>
          <li>• Cannot be undone, re-issue mandates manually</li>
        </ul>

        {/* Counts */}
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-[24px] font-medium text-mob-ink">{mandates.data?.count ?? '-'}</p>
            <p className="text-[14px] text-mob-muted">Active mandates</p>
          </div>
          <div>
            <p className="text-[24px] font-medium text-mob-ink">{sessions.data?.count ?? '-'}</p>
            <p className="text-[14px] text-mob-muted">Session keys</p>
          </div>
        </div>
      </div>

      {/* Status */}
      {status.kind === 'submitting' && <div className="skeleton mb-4 h-5 w-3/4 self-center rounded" />}
      {successHash && (() => {
        const url = arbiscanTxUrl(successHash);
        return url ? (
          <a href={url} target="_blank" rel="noreferrer" className="mb-4 self-center font-mono text-[14px] text-mob-accent">
            {successHash.slice(0, 10)}…{successHash.slice(-6)} ↗
          </a>
        ) : null;
      })()}
      {status.kind === 'error' && (
        <p className="mb-4 self-center text-[14px] text-neg">{humanizeWalletError(status.reason).message}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleActivate}
        disabled={status.kind === 'submitting' || status.kind === 'success'}
        className="h-[64px] w-full rounded-xl bg-neg text-[18px] font-medium text-white disabled:opacity-40"
      >
        {!confirmed ? 'Activate Kill Switch' : status.kind === 'submitting' ? 'Revoking…' : status.kind === 'success' ? 'Revoked ✓' : 'Confirm, this is irreversible'}
      </button>
    </div>
  );
}

/**
 * Persistent FAB, renders a red shield button fixed bottom-right on every
 * authenticated mobile page. Tapping opens KillSwitchMobile as an overlay.
 */
export function KillSwitchFAB() {
  const [open, setOpen] = useState(false);
  const wallet = useScopedWallet();
  if (!wallet) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-30 grid size-14 place-items-center rounded-full bg-neg shadow-lg md:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Kill Switch"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l8 4v5c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4z" />
        </svg>
      </button>
      {open && <KillSwitchMobile onClose={() => setOpen(false)} />}
    </>
  );
}
