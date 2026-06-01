import { AppShell } from '@/components/app-shell';
import { TransferForm } from '@/components/transfer/transfer-form';
import { TransferTimeline } from '@/components/transfer/transfer-timeline';
import { RecentTransfers } from '@/components/transfer/recent-transfers';
import { TransferMobile } from '@/components/mobile/panels/transfer-mobile';
import { TestnetPill } from '@/components/ui/testnet-pill';

export const metadata = {
  title: 'Atrium · Transfer',
  description: 'Aqueduct routes through Chainlink CCIP. Cross-chain collateral with one tx.',
};

export default function TransferPage() {
  return (
    <AppShell
      active="/app/transfer"
      breadcrumb={[
        { label: 'Transfer' },
        { label: 'Cross-chain · Aqueduct' },
      ]}
      mobile={<TransferMobile />}
      desktop={
      <div className="hidden md:block">
      <header>
        <div className="flex items-start justify-between">
        <div>
        <p className="eyebrow">Transfer · Aqueduct</p>
        <h1 className="mt-1 font-display text-4xl italic tracking-tight text-ink">
          Move collateral between chains
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Aqueduct routes through Chainlink CCIP. Posted collateral becomes Plinth credit on arrival.
        </p>
        </div>
        <TestnetPill />
        </div>
      </header>

      <section className="mt-8 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <TransferForm />
        <TransferTimeline />
      </section>

      <section className="mt-8">
        {/* "View all" button removed — there's no separate /app/transfer/history
            page, and RecentTransfers already shows the full short list. A
            click-to-nowhere button is worse than no button at all. */}
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl italic text-ink">Recent transfers</h2>
        </header>
        <RecentTransfers />
      </section>
      </div>
      }
    />
  );
}
