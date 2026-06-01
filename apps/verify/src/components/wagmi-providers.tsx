'use client';

import { useEffect, useRef } from 'react';
import { WagmiProvider } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { watchAccount } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wagmi';

/**
 * Wagmi boundary, only mounted on routes that actually use wallet hooks.
 * Loaded via `next/dynamic` so the landing page bundle never pays the
 * ~150KB cost of viem + the connector ecosystem.
 *
 * Account-switch cache invalidation (W-3): on address change or disconnect,
 * invalidates all queries and clears wallet-scoped localStorage.
 */
export function WagmiProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <AccountWatcher />
      {children}
    </WagmiProvider>
  );
}

function AccountWatcher() {
  const queryClient = useQueryClient();
  const prevAddr = useRef<string | undefined>(undefined);

  useEffect(() => {
    const unwatch = watchAccount(wagmiConfig, {
      onChange(account) {
        const newAddr = account.address;
        if (prevAddr.current && prevAddr.current !== newAddr) {
          // Clear localStorage scoped to previous wallet
          try {
            const prefix = `atrium:${prevAddr.current}:`;
            const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
            keys.forEach((k) => localStorage.removeItem(k));
          } catch { /* ignore */ }
          // Invalidate all queries
          queryClient.invalidateQueries();
        }
        prevAddr.current = newAddr;
      },
    });
    return unwatch;
  }, [queryClient]);

  return null;
}
