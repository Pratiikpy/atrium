import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { VaultDeposit } from '@/components/vault/deposit-card';
import { VaultWithdraw } from '@/components/vault/withdraw-card';
import { VaultStats } from '@/components/vault/stats';
import { VaultMobile } from '@/components/mobile/panels/vault-mobile';
import { TestnetPill } from '@/components/ui/testnet-pill';

export const metadata = {
  title: 'Atrium · Vault',
  description: 'Coffer ERC-4626 vault. Deposit USDC. Withdraw with circuit-breaker.',
};

// Audit U-15: deposit + withdraw cards now use wagmi's useAccount /
// useReadContract / useWriteContract. Those hooks require WagmiProvider
// in context, which doesn't exist during static prerender. Forcing
// dynamic rendering avoids the WagmiProviderNotFoundError and is the
// right semantic anyway — vault state is wallet-specific.
export const dynamic = 'force-dynamic';

export default function VaultPage() {
  return (
    <AppShell
      active="/app/vault"
      breadcrumb={[
        { label: 'Vault' },
        { label: 'Vault · Coffer' },
      ]}
      // Viewport slots: only the active layout mounts, so the deposit form +
      // stats hooks fire once. (The md:hidden wrapper below is now redundant
      // belt-and-braces — the slot already prevents the desktop double-mount
      // the comment warns about — but kept for defence in depth.)
      mobile={
        <div className="md:hidden">
          <VaultMobile />
        </div>
      }
      desktop={
      <div className="hidden md:block">
      <header>
        <p className="eyebrow">Vault · Coffer</p>
        <h1 className="mt-1 font-display text-4xl italic tracking-tight text-ink">
          USDC vault
        </h1>
        <div className="mt-2 flex items-center justify-between">
        <p className="max-w-2xl text-sm text-muted">
          The vault holds your USDC. Plinth reads your share balance as collateral. Adapters
          pull from Coffer via a per-adapter per-block notional cap so a malicious adapter
          cannot drain more than 1% of TVL in any block.
        </p>
        <TestnetPill />
        </div>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <VaultDeposit />
        <VaultWithdraw />
      </section>

      <section className="mt-8">
        <VaultStats />
      </section>

      <section className="mt-8 rounded-md border border-divider bg-parchment-soft/40 p-6">
        <h2 className="font-display text-xl italic text-ink">Safety</h2>
        <ul className="mt-4 space-y-2 text-sm text-ink-soft">
          <li>• Virtual-shares offset prevents the ERC-4626 inflation attack (audit B-7).</li>
          <li>• TVL drop {'>'} 30% in one block trips the circuit breaker and pauses deposits.</li>
          <li>• Withdrawal SLA: settle within 1 block (≈250 ms on Arbitrum Sepolia) when no breaker is active; on-chain attestation every ≤10 minutes via Lantern.</li>
          <li>• USDC contract paused-check before every deposit (audit C-23).</li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          Full SLA matrix at <Link href="/sla" className="underline">/sla</Link>.
        </p>
      </section>
      </div>
      }
    />
  );
}
