'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';
import { useContractAddress } from '@/lib/use-coffer-address';
import { arbiscanAddressUrl, arbiscanTxUrl } from '@/lib/arbiscan';
import { humanizeWalletError } from '@/lib/humanize-wallet-error';

/**
 * Postern session-keys view (BUILD_PLAN Phase 2, /app/settings/session-keys).
 *
 * Lists a wallet's active ERC-7715 session keys from the deployed
 * PosternKeyRegistry (GET /api/settings/session-keys, on-chain read). What
 * the registry actually supports today bounds what this page offers, honestly:
 *
 *   - LIST + expiry + active/expired status  -> real, on-chain
 *   - CLEAN EXPIRED (cleanExpired)            -> real, anyone-can-call write
 *   - BULK REVOKE (every key at once)         -> real, via the Emergency Stop
 *                                                kill switch on /app/portfolio
 *   - PER-KEY revoke / extend                 -> Year-2: the registry has no
 *                                                user-callable per-key revoke
 *                                                or extend; that needs the
 *                                                Postern smart wallet (deferred
 *                                                per human_left.md). Shown
 *                                                disabled with the real reason,
 *                                                not faked.
 */

interface SessionKey {
  address: string;
  expiresAtUnix: number;
  expired: boolean;
}
interface KeysResponse {
  keys: SessionKey[];
  count: number;
  source: 'registry' | 'pending';
}

const CLEAN_EXPIRED_ABI = [
  {
    type: 'function',
    name: 'cleanExpired',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
  },
] as const;

function fmtExpiry(unix: number): string {
  if (!unix) return 'unknown';
  const d = new Date(unix * 1000);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SessionKeysView() {
  const wallet = useScopedWallet();
  const { address: account } = useAccount();
  const { data: registryAddress } = useContractAddress('postern-key-registry');
  const { writeContractAsync } = useWriteContract();
  const [clean, setClean] = useState<
    | { kind: 'idle' }
    | { kind: 'submitting' }
    | { kind: 'success'; hash: `0x${string}` }
    | { kind: 'error'; reason: string }
  >({ kind: 'idle' });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['session-keys', wallet],
    queryFn: async (): Promise<KeysResponse> => {
      const r = await fetch(walletQuery('/api/settings/session-keys', wallet));
      if (!r.ok) throw new Error(`session-keys_${r.status}`);
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const keys = data?.keys ?? [];
  const live = data?.source === 'registry';
  const expiredCount = keys.filter((k) => k.expired).length;
  const deployed = Boolean(registryAddress);

  // Reactively refresh the list when the prune tx actually confirms on-chain,
  // instead of guessing a delay with setTimeout (the no-fake-latency invariant
  // bans timers; waiting on the receipt is both correct and timer-free).
  const cleanHash = clean.kind === 'success' ? clean.hash : undefined;
  const { isSuccess: pruneConfirmed } = useWaitForTransactionReceipt({ hash: cleanHash });
  useEffect(() => {
    if (pruneConfirmed) refetch();
  }, [pruneConfirmed, refetch]);

  async function cleanExpired() {
    if (!account || !registryAddress) {
      setClean({ kind: 'error', reason: 'wallet_not_connected' });
      return;
    }
    setClean({ kind: 'submitting' });
    try {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: CLEAN_EXPIRED_ABI,
        functionName: 'cleanExpired',
        args: [account],
      });
      setClean({ kind: 'success', hash });
    } catch (e) {
      setClean({ kind: 'error', reason: e instanceof Error ? e.message : 'unknown_error' });
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Active keys */}
      <section className="rounded-md border border-divider bg-parchment p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow">Active session keys</p>
            <p className="mt-1 font-sans text-lg font-medium text-ink">
              {isLoading ? '-' : keys.length}
              <span className="ml-2 text-sm font-normal text-muted">
                of 50 max{expiredCount > 0 ? ` · ${expiredCount} expired` : ''}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={cleanExpired}
            disabled={!deployed || !account || expiredCount === 0 || clean.kind === 'submitting'}
            className="inline-flex min-h-[40px] items-center rounded-md border border-divider bg-parchment-light px-4 py-2 text-sm font-medium text-ink hover:border-ink/30 disabled:opacity-40"
            title={
              !deployed
                ? 'Registry pending deployment'
                : !account
                  ? 'Connect a wallet'
                  : expiredCount === 0
                    ? 'No expired keys to prune'
                    : undefined
            }
          >
            {clean.kind === 'submitting' ? 'Pruning…' : 'Clean expired keys'}
          </button>
        </div>

        {clean.kind === 'error' && (
          <p className="mt-3 text-[12px] text-neg">{humanizeWalletError(clean.reason).message}</p>
        )}
        {clean.kind === 'success' &&
          (() => {
            const url = arbiscanTxUrl(clean.hash);
            return url ? (
              <a href={url} target="_blank" rel="noreferrer" className="mt-3 block font-mono text-[12px] text-accent">
                pruned · {clean.hash.slice(0, 10)}…{clean.hash.slice(-6)} ↗
              </a>
            ) : null;
          })()}

        <div className="mt-5">
          {isLoading ? (
            <div className="space-y-2">
              <div className="skeleton h-12 w-full rounded" />
              <div className="skeleton h-12 w-full rounded" />
            </div>
          ) : keys.length === 0 ? (
            <div className="rounded-md border border-divider/60 bg-parchment-soft/40 px-4 py-6 text-center">
              <p className="text-sm text-ink">
                {live ? 'No active session keys.' : 'Session-key registry pending.'}
              </p>
              <p className="mt-1 text-[12px] text-muted">
                {live
                  ? 'A session key is issued when you delegate to an agent. Issue one from the Agents page.'
                  : 'The PosternKeyRegistry is not deployed to this environment yet. Live keys appear here once it is.'}
              </p>
              {live && (
                <Link
                  href="/app/agents"
                  className="mt-3 inline-block text-sm text-ink underline-offset-2 hover:underline"
                >
                  Delegate to an agent →
                </Link>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-divider">
              {keys.map((k) => {
                const url = arbiscanAddressUrl(k.address);
                return (
                  <li key={k.address} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="font-mono text-sm text-accent hover:underline">
                          {k.address.slice(0, 10)}…{k.address.slice(-8)}
                        </a>
                      ) : (
                        <span className="font-mono text-sm text-ink">{k.address}</span>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted">Expires {fmtExpiry(k.expiresAtUnix)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          'rounded-full border px-2.5 py-0.5 text-[11px] ' +
                          (k.expired
                            ? 'border-testnet/40 bg-testnet/10 text-testnet'
                            : 'border-live/30 bg-live-soft text-live')
                        }
                      >
                        {k.expired ? 'expired' : 'active'}
                      </span>
                      {/* Per-key revoke/extend is a Year-2 capability: the
                          registry has no user-callable per-key revoke or
                          extend (only the kill switch bulk-revokes). Shown
                          disabled with the honest reason, not faked. */}
                      <button
                        type="button"
                        disabled
                        title="Year-2: per-key revoke needs the Postern smart wallet. Use Emergency Stop to revoke all keys now."
                        className="cursor-not-allowed rounded-md border border-divider px-2.5 py-1 text-[11px] text-muted opacity-50"
                      >
                        revoke
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Bulk revoke -> Emergency Stop */}
      <section className="rounded-md border bg-parchment p-6" style={{ borderColor: 'oklch(0.5 0.12 30 / 0.4)' }}>
        <h2 className="font-sans text-base font-medium text-ink">Revoke everything at once</h2>
        <p className="mt-1 text-[13px] leading-snug text-muted">
          The Emergency Stop kill switch revokes every agent mandate and session key in one
          transaction. Use it if a key is compromised or an agent misbehaves.
        </p>
        <Link
          href="/app/portfolio"
          className="mt-3 inline-flex min-h-[40px] items-center rounded-md bg-neg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Go to Emergency Stop
        </Link>
      </section>

      {/* Honest scope note */}
      <p className="text-[11px] leading-snug text-muted">
        Session keys are ERC-7715 grants scoped to one agent and strategy, recorded on-chain in the
        PosternKeyRegistry so the kill switch can enumerate and revoke them. Per-key revoke and
        extend are a Year-2 capability that needs the Postern smart wallet; today you can list,
        prune expired keys, and revoke all at once.
      </p>
    </div>
  );
}
