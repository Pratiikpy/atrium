'use client';

import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '@/lib/wagmi';

/**
 * Wagmi boundary — only mounted on routes that actually use wallet hooks.
 * Loaded via `next/dynamic` so the landing page bundle never pays the
 * ~150KB cost of viem + the connector ecosystem.
 *
 * Use this around any subtree that uses `useAccount`, `useConnect`,
 * `useReadContract`, etc.
 */
export function WagmiProviders({ children }: { children: React.ReactNode }) {
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
