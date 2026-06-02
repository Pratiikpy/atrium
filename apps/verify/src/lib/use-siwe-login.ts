'use client';

import { useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { SiweMessage } from 'siwe';

/**
 * SIWE sign-in. `signIn()` runs the full handshake (fetch nonce -> build +
 * sign a SIWE message -> POST /api/auth/verify) and returns true on success.
 * The server sets the httpOnly `atrium-session` cookie that the 18
 * wallet-scoped API routes require; without it a connected wallet 401s on
 * every read. Auto-driven by <SessionSync/>; works for both EOAs and the
 * Postern passkey smart wallet (the verify route does EIP-1271).
 */
export function useSiweLogin() {
  const { address, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const signIn = useCallback(async (): Promise<boolean> => {
    if (!address || !chain) return false;
    const nonceRes = await fetch('/api/auth/nonce');
    if (!nonceRes.ok) return false;
    const { nonce } = await nonceRes.json();

    const message = new SiweMessage({
      domain: window.location.host,
      address,
      statement: 'Sign in to Atrium Verifier Mode',
      uri: window.location.origin,
      version: '1',
      chainId: chain.id,
      nonce,
    });
    const prepared = message.prepareMessage();
    const signature = await signMessageAsync({ message: prepared });

    const verifyRes = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prepared, signature }),
    });
    return verifyRes.ok;
  }, [address, chain, signMessageAsync]);

  const signOut = useCallback(async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' });
  }, []);

  return { signIn, signOut };
}

/** Returns the wallet bound to the current session cookie, or null. */
export async function fetchSessionWallet(): Promise<string | null> {
  try {
    const r = await fetch('/api/auth/me');
    if (!r.ok) return null;
    const { walletAddress } = await r.json();
    return typeof walletAddress === 'string' ? walletAddress.toLowerCase() : null;
  } catch {
    return null;
  }
}
