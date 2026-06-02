'use client';

import dynamic from 'next/dynamic';
import { SessionGate } from '@/components/session-sync';

// Wagmi provider is loaded via next/dynamic with ssr: false so the
// landing page (which doesn't need wagmi) doesn't pull the ~150KB
// viem + connector bundle. Inside /app/* every page either uses
// wallet hooks directly or hosts components that do, so it's safe
// to mount the provider for the whole subtree here.
const WagmiProviders = dynamic(
  () => import('@/components/wagmi-providers').then((m) => m.WagmiProviders),
  { ssr: false },
);

const KillSwitchFAB = dynamic(
  () => import('@/components/mobile/panels/kill-switch-mobile').then((m) => m.KillSwitchFAB),
  { ssr: false },
);

// <SessionGate> (imported above) drives the SIWE sign-in so a connected wallet
// gets a session, AND provides SessionReadyContext so useScopedWallet holds
// wallet-scoped reads until the session exists (no first-connect 401 flash). It
// wraps children so the context reaches every /app page; it only renders inside
// the ssr:false WagmiProviders, so its useAccount/useQueryClient run client-side.
export default function AppSegmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProviders>
      <SessionGate>
        <main id="main-content">
          {children}
        </main>
      </SessionGate>
      <KillSwitchFAB />
    </WagmiProviders>
  );
}
