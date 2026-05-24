import Link from 'next/link';
import { HeroBalanceCard } from './hero-balance-card';

/**
 * Hero — "One wallet. Every venue. One number."
 *
 * 1:1 with desing/Atrium.html#hero. Large display serif with negative
 * letter-spacing per extracted tokens. Right side: live balance card.
 */
export function HeroSection() {
  return (
    <section className="hero mx-auto max-w-6xl px-6 pb-24 pt-16 md:pb-32 md:pt-24">
      <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="eyebrow">Unified margin · EVM-native · testnet</p>
          <h1 className="font-display-hero mt-5 text-[40px] text-ink sm:text-[56px] md:text-[76px]">
            One wallet.
            <br />
            Every venue.
            <br />
            One number.
          </h1>
          <p className="mt-6 max-w-prose text-lg text-ink-soft">
            {/* Audit SSS-11 fix: was "seven live onchain venues" — but
                `human_left.md` #11/#13/#15 confirm zero adapters deployed
                yet. The numbers section below the hero shows "0 / 7 ·
                contracts ship Month 1 W2", contradicting the hero copy.
                "Supported" stays accurate pre- AND post-deploy; the live
                count comes from the numbers section's RPC read. */}
            Atrium is a unified margin prime brokerage for the EVM. Post collateral once on
            Arbitrum. Trade across the seven onchain venues Atrium supports with one
            buying-power figure, recomputed in real time by a Stylus margin engine.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-5 py-3 text-sm font-medium text-parchment hover:bg-ink-dark"
            >
              Open testnet <span aria-hidden>↗</span>
            </Link>
            <Link
              href="/verify/1"
              className="inline-flex items-center gap-1.5 rounded-md border border-divider bg-parchment-light px-5 py-3 text-sm text-ink hover:border-ink/30"
            >
              Run the 90-second proof
            </Link>
          </div>
        </div>
        <HeroBalanceCard />
      </div>
    </section>
  );
}
