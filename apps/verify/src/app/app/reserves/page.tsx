import { AppShell } from '@/components/app-shell';
import { ReservesStatRow } from '@/components/reserves/stat-row';
import { LatestAttestationCard } from '@/components/reserves/latest-attestation';
import { MerkleStructureCard } from '@/components/reserves/merkle-structure';
import { RecentAttestationsSection } from '@/components/reserves/recent-attestations-section';
import { VerifyMyBalanceButton } from '@/components/reserves/verify-balance-button';
import { ReservesMobile } from '@/components/mobile/panels/reserves-mobile';

export const metadata = {
  title: 'Atrium · Reserves',
  description: 'Proof-of-reserves attestation every ≤10 minutes. Verify your own balance locally.',
};

export default function ReservesPage() {
  return (
    <AppShell
      active="/app/reserves"
      breadcrumb={[
        { label: 'Lantern' },
        { label: 'proof-of-reserves' },
      ]}
    >
      {/* Mobile (< md): ReservesMobile panel */}
      <ReservesMobile />

      <div className="hidden md:block">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Reserves · Lantern</p>
          <h1 className="mt-1 font-display text-4xl italic tracking-tight text-ink">
            Prove your balance to anyone in seconds
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Atrium never custodies your funds. Every ≤10 minutes, Lantern publishes a signed Merkle
            attestation on-chain; press verify to generate a proof that your balance is in it - no
            trust required.
          </p>
        </div>
        {/* Audit P-11 fix: button now reads the latest Lantern attestation
            and computes the inclusion proof in the browser. Disabled with
            honest copy when the Lantern attestor hasn't published yet. */}
        <VerifyMyBalanceButton />
      </header>

      <section className="mt-8">
        <ReservesStatRow />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <LatestAttestationCard />
        <MerkleStructureCard />
      </section>

      <section className="mt-8">
        <RecentAttestationsSection />
      </section>
      </div>
    </AppShell>
  );
}
