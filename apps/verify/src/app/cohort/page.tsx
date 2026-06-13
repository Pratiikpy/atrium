import { CohortGrid } from '@/components/cohort-grid';
import { CohortWaitlist } from '@/components/cohort-waitlist';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { buildMetadata } from '@/lib/build-metadata';

export const metadata = buildMetadata({
  title: 'Cohort',
  description: 'Named design partners using Atrium on Arbitrum Sepolia. Numbers from on-chain Scribe queries.',
  canonical: '/cohort',
});

export default function CohortPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-5xl text-ink">Cohort</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        The named design partners using Atrium on Arbitrum Sepolia today. Numbers
        come from on-chain Scribe queries. We never inflate this page. If a partner has not
        committed in writing, they do not appear.
      </p>

      <CohortGrid />

      <section className="mt-16 rounded-md border border-divider bg-parchment-soft/40 p-8">
        <h2 className="font-display text-2xl text-ink">Become a Cohort partner</h2>
        <p className="mt-3 max-w-prose text-ink-soft">
          The waitlist is open now; we onboard partners from Month 2. Partners get a direct line to
          F1/F2/F3, advance review of new adapters and governance proposals, and Atrium credits toward
          future mainnet activity.
        </p>
        <div className="mt-5">
          <CohortWaitlist />
        </div>
      </section>
      </div>
    </MarketingShell>
  );
}
