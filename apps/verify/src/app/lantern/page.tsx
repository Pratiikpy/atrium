import { LanternDashboard } from '@/components/lantern-dashboard';
import { WagmiProviders } from '@/components/wagmi-providers';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export default function LanternPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-5xl text-ink">Proof of reserves</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Lantern targets a fresh Merkle root of every Coffer balance about every 10 minutes; the live age is shown below, and the free-tier cron can lag.
        Each root is signed and committed on Arbitrum Sepolia. The full tree is
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
