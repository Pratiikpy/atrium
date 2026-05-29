'use client';

import { useCallback, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { SiweMessage } from 'siwe';

export function useSiweLogin() {
  const { address, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const signIn = useCallback(async () => {
    if (!address || !chain) return;
    const nonceRes = await fetch('/api/auth/nonce');
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
    if (verifyRes.ok) setIsAuthenticated(true);
  }, [address, chain, signMessageAsync]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
  }, []);

  return { signIn, signOut, isAuthenticated };
}
