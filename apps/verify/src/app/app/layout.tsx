'use client';

import dynamic from 'next/dynamic';

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

// Drives the SIWE sign-in so a connected wallet actually gets a session and its
// wallet-scoped reads stop 401-ing. Inside WagmiProviders so it sees useAccount.
const SessionSync = dynamic(
  () => import('@/components/session-sync').then((m) => m.SessionSync),
  { ssr: false },
);

export default function AppSegmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProviders>
      <SessionSync />
      <main id="main-content">
        {children}
      </main>
      <KillSwitchFAB />
    </WagmiProviders>
  );
}
