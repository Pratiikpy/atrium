import { Wordmark } from '@/components/wordmark';
import { LanternDashboard } from '@/components/lantern-dashboard';
import { WagmiProviders } from '@/components/wagmi-providers';
import Link from 'next/link';

export default function LanternPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="flex items-center justify-between">
        <Wordmark size="md" />
        <nav className="flex gap-6 text-sm text-ink-soft">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/lantern/sla" className="hover:text-ink">Withdrawal SLA</Link>
        </nav>
      </header>

      <h1 className="mt-16 font-display text-5xl text-ink">Proof of reserves</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Lantern publishes a Merkle root of every Coffer balance once per hour.
        The root is signed and committed on Arbitrum Sepolia. The full tree is
        pinned to IPFS so anyone can verify their own balance with an inclusion proof.
      </p>

      {/* Audit J-H6: wagmi only mounts on routes that use wallet hooks. */}
      <WagmiProviders>
        <LanternDashboard />
      </WagmiProviders>
    </main>
  );
}
