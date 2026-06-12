'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { useSiweLogin, fetchSessionWallet } from '@/lib/use-siwe-login';
import { SessionReadyContext } from '@/lib/session-ready';

/**
 * Drives the SIWE sign-in handshake so a connected wallet actually gets the
 * `atrium-session` cookie the 18 wallet-scoped API routes require, AND provides
 * the `SessionReadyContext` so useScopedWallet holds those queries until the
 * session exists (no first-connect 401 flash). Before this the login hook was
 * wired to nothing, so every connected user 401'd on their own data (the demo
 * fallback is off in prod).
 *
 * Flow: on connect, check /api/auth/me; if the session does not match the
 * connected address, run signIn() once automatically. On success, invalidate
 * the React Query cache so the reads refetch with the cookie. If the signature
 * is rejected, show a non-blocking "Sign in" chip to retry. `ready` is true when
 * disconnected (components self-gate on wallet) or when the session matches the
 * connected wallet; useScopedWallet returns null until then.
 */
type State = 'idle' | 'checking' | 'signing' | 'authed' | 'error';

export function SessionGate({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signIn } = useSiweLogin();
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>('idle');
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const attemptedFor = useRef<string | null>(null);

  const doSignIn = useCallback(async () => {
    setState('signing');
    try {
      const ok = await signIn();
      if (ok) {
        const w = await fetchSessionWallet();
        setSessionWallet(w);
        setState('authed');
        // The wallet-scoped reads were held (ready=false) until now; once the
        // cookie + ready flip, they fetch. Invalidate to be safe across remounts.
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
      setSessionWallet(null);
      attemptedFor.current = null;
      return;
    }
    const addr = address.toLowerCase();
    let cancelled = false;
    (async () => {
      setState('checking');
      const current = await fetchSessionWallet();
      if (cancelled) return;
      setSessionWallet(current);
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

  // ready: no address (nothing to scope) OR the session matches the connected
  // wallet. Gate on `address` (not `isConnected`): wagmi can briefly expose an
  // address while isConnected is still false during (re)connect, and the old
  // `!isConnected` clause let ready=true in that window, so a few reads slipped
  // through with no session. While address is set but unsigned, ready stays
  // false and useScopedWallet holds every wallet-scoped query (no transient 401).
  const ready = !address || sessionWallet === address.toLowerCase();

  const showChip = state === 'signing' || state === 'error';

  return (
    <SessionReadyContext.Provider value={ready}>
      {children}
      {showChip && (
        <div
          className="fixed left-4 z-40 mb-[68px] flex items-center gap-2 rounded-md border border-divider bg-parchment px-3 py-2 text-xs text-ink shadow-sm md:mb-0"
          style={{ bottom: 'calc(1rem + var(--consent-h, 0px) + env(safe-area-inset-bottom, 0px))' }}
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
      )}
    </SessionReadyContext.Provider>
  );
}
