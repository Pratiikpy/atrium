import { LanternDashboard } from '@/components/lantern-dashboard';
import { WagmiProviders } from '@/components/wagmi-providers';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export default function LanternPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-5xl text-ink">Proof of reserves</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Lantern publishes a fresh Merkle root of every Coffer balance about every 45 minutes. GitHub&rsquo;s free scheduler throttles plain cron (it can fire hours apart), so the attestor runs an in-run self-loop instead of relying on the schedule; the live age is shown below.
        Each root is signed and committed on Arbitrum Sepolia. Pinning the full tree to IPFS,
        so anyone can verify their own balance with an inclusion proof, lights up once the
        attestor runs with a web3.storage token; the live pin status is shown below.
      </p>

      {/* Audit J-H6: wagmi only mounts on routes that use wallet hooks. */}
      <WagmiProviders>
        <LanternDashboard />
      </WagmiProviders>
      </div>
    </MarketingShell>
  );
}
