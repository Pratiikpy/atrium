import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Withdrawal SLA',
  description:
    'How fast you can withdraw from Atrium, and the five on-chain circuit-breakers that can pause redemptions.',
};

export default function SlaPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-5xl text-ink">Withdrawal SLA</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Atrium is non-custodial. Your USDC sits in Coffer (ERC-4626 vault) as shares. The contracts
        let you redeem at any time, subject to the five circuit-breakers below.
      </p>

      <section className="mt-12 space-y-4">
        <h2 className="font-display text-2xl text-ink">Normal operation</h2>
        <ul className="space-y-2 text-ink-soft">
          <li>• Funds withdrawable within 1 block (≈ 250 ms on Arbitrum Sepolia) when no breaker is active.</li>
          <li>• No KYC required to withdraw what you deposited.</li>
          <li>• Maximum 1 transaction; no multi-step claim.</li>
        </ul>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="font-display text-2xl text-ink">Five circuit-breakers</h2>
        <p className="text-ink-soft">
          Each is automatic. When tripped, withdrawals pause for the listed duration. Praetor governance (48h timelock; admin today is a single founder deployer key, with the 3-of-5 Safe queued) unpauses after the trigger is resolved.
        </p>
        <ol className="mt-4 space-y-4">
          <BreakerRow
            number={1}
            name="Oracle disagreement"
            trigger="Chainlink and Pyth disagree by more than 50 bps on any active instrument"
            duration="Until oracles align; typical 5-15 minutes"
          />
          <BreakerRow
            number={2}
            name="Keeper failure rate"
            trigger="More than 10% of liquidation jobs miss the window over 24 hours"
            duration="Manual: Praetor investigates and unpauses"
          />
          <BreakerRow
            number={3}
            name="Simultaneous active liquidations"
            trigger="More than 5% of total TVL is in active liquidation jobs"
            duration="Auto-resume when active liquidations drop below 2%"
          />
          <BreakerRow
            number={4}
            name="TVL drop in 1 hour"
            trigger="Coffer TVL drops more than 30% in 60 minutes"
            duration="Manual: Praetor investigates and unpauses"
          />
          <BreakerRow
            number={5}
            name="Governance pause"
            trigger="Praetor multisig manually invokes emergency pause"
            duration="Until Praetor explicitly resumes"
          />
        </ol>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="font-display text-2xl text-ink">Pending liquidation</h2>
        <p className="text-ink-soft">
          If your account is under-collateralized, Vigil queues a liquidation job. Withdrawals from your account are blocked until the liquidation completes (partial liquidations cap at 10% of position per block; full settlement typically inside 2 minutes on Sepolia).
        </p>
      </section>

      </article>
    </MarketingShell>
  );
}

function BreakerRow({
  number,
  name,
  trigger,
  duration,
}: {
  number: number;
  name: string;
  trigger: string;
  duration: string;
}) {
  return (
    <li className="rounded-md border border-divider bg-parchment p-5">
      <p className="text-xs uppercase tracking-wider text-muted">Breaker {number}</p>
      <p className="mt-1 font-medium text-ink">{name}</p>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-muted">Trigger</dt>
        <dd className="text-ink-soft">{trigger}</dd>
        <dt className="text-muted">Recovery</dt>
        <dd className="text-ink-soft">{duration}</dd>
      </dl>
    </li>
  );
}
