import { Wordmark } from '@/components/wordmark';
import { LanternDashboard } from '@/components/lantern-dashboard';
import { WagmiProviders } from '@/components/wagmi-providers';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import Link from 'next/link';

export default function LanternPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-5xl text-ink">Proof of reserves</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Lantern publishes a Merkle root of every Coffer balance once per hour.
        The root is signed and committed on Arbitrum Sepolia. The full tree is
        pinned to IPFS so anyone can verify their own balance with an inclusion proof.
      </p>

      {/* Audit J-H6: wagmi only mounts on routes that use wallet hooks. */}
      <WagmiProviders>
        <LanternDashboard />
      </WagmiProviders>
      </div>
    </MarketingShell>
  );
}
