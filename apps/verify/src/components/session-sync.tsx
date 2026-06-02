'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { useSiweLogin, fetchSessionWallet } from '@/lib/use-siwe-login';

/**
 * Drives the SIWE sign-in handshake so a connected wallet actually gets the
 * `atrium-session` cookie the 18 wallet-scoped API routes require. Before this
 * existed the login hook was wired to nothing, so every connected user 401'd
 * on their own portfolio/positions/activity (the demo fallback is off in prod).
 *
 * Flow: on connect, check /api/auth/me; if the session does not match the
 * connected address, run signIn() once automatically. On success, invalidate
 * the React Query cache so the reads that 401'd refetch with the cookie. If the
 * signature is rejected or fails, show a non-blocking "Sign in" chip to retry.
 */
type State = 'idle' | 'checking' | 'signing' | 'authed' | 'error';

export function SessionSync() {
  const { address, isConnected } = useAccount();
  const { signIn } = useSiweLogin();
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>('idle');
  const attemptedFor = useRef<string | null>(null);

  const doSignIn = useCallback(async () => {
    setState('signing');
    try {
      const ok = await signIn();
      if (ok) {
        setState('authed');
        // The wallet-scoped reads 401'd before the cookie existed; refetch.
        await queryClient.invalidateQueries();
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }, [signIn, queryClient]);

  useEffect(() => {
    if (!isConnected || !address) {
      setState('idle');
      attemptedFor.current = null;
      return;
    }
    const addr = address.toLowerCase();
    let cancelled = false;
    (async () => {
      setState('checking');
      const current = await fetchSessionWallet();
      if (cancelled) return;
      if (current === addr) {
        setState('authed');
        return;
      }
      // Auto-attempt the handshake once per address so a rejected signature
      // doesn't loop. The manual chip below can re-trigger it.
      if (attemptedFor.current === addr) {
        setState('error');
        return;
      }
      attemptedFor.current = addr;
      await doSignIn();
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, doSignIn]);

  if (state === 'idle' || state === 'authed' || state === 'checking') return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-md border border-divider bg-parchment px-3 py-2 text-xs text-ink shadow-sm"
      role="status"
    >
      {state === 'signing' ? (
        <>
          <span className="inline-block size-2 animate-pulse rounded-full bg-amber-500" aria-hidden />
          <span className="text-muted">Signing you in…</span>
        </>
      ) : (
        <>
          <span className="text-muted">Sign in to load your portfolio</span>
          <button
            type="button"
            onClick={doSignIn}
            className="rounded-sm bg-ink px-2 py-1 text-[11px] font-medium text-parchment hover:opacity-90"
          >
            Sign in
          </button>
        </>
      )}
    </div>
  );
}
