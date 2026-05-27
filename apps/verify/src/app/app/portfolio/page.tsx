import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { PortfolioStatRow } from '@/components/portfolio/stat-row';
import { MarginEngineCard } from '@/components/portfolio/margin-engine-card';
import { BuyingPowerCard } from '@/components/portfolio/buying-power-card';
import { PositionsFilter } from '@/components/portfolio/positions-filter';
import { ActivityFeed } from '@/components/portfolio/activity-feed';
import { TopUpBanner } from '@/components/portfolio/top-up-banner';
import { PortfolioMobile } from '@/components/mobile/panels/portfolio-mobile';

/**
 * /app/portfolio — Atrium "Unified margin" view.
 *
 * Layout matches `design/Atrium App.standalone.html#portfolio` exactly:
 *  - 4-stat row across the top (TVL · req margin · notional · 24h PnL)
 *  - 2-col below: margin engine bar chart (left) + buying-power sparkline (right)
 *  - Liquidation buffer indicator
 *  - Open positions table (full width)
 *  - Activity feed (right rail)
 *
 * Each card is its own component that reads live data via /api/portfolio/*.
 * Until contracts deploy on Sepolia (Month 1 W2), every numeric value renders
 * "—" with a per-card source caption ("from Plinth", "from Scribe", etc).
 */

export const metadata = {
  title: 'Atrium · Portfolio',
  description: 'Unified margin. One number across every venue you hold positions in.',
};

// Audit U-21: open-positions table now has per-row Close buttons that call
// wagmi's useWriteContract via useClosePosition. Same WagmiProvider-required
// concern as vault/agents/trade — force-dynamic prevents prerender from
// throwing WagmiProviderNotFoundError. Portfolio state is wallet-specific
// anyway.
export const dynamic = 'force-dynamic';

export default function PortfolioPage() {
  return (
    <AppShell
      active="/app/portfolio"
      breadcrumb={[
        { label: 'Portfolio' },
        { label: 'Plinth · unified margin' },
      ]}
    >
      {/* Mobile (< md): canonical Mobile App Home panel (hero buying-power
          card + 4-action grid + positions + activity), all reading the same
          /api/portfolio/* endpoints as the desktop layout below. */}
      <PortfolioMobile />

      {/* Desktop (md+): existing dense layout. */}
      <div className="hidden md:block">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em]"
            style={{ color: 'oklch(0.54 0.005 60)' }}
          >
            Portfolio
          </p>
          <h1
            className="mt-2 font-medium leading-[1.04] tracking-[-0.03em]"
            style={{
              fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(36px, 4.5vw, 56px)',
              color: 'oklch(0.13 0.008 60)',
            }}
          >
            Unified margin
          </h1>
          <p
            className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em]"
            style={{ color: 'oklch(0.54 0.005 60)' }}
          >
            Plinth · margin engine
            <span className="mx-2">·</span>
            arb-sepolia
          </p>
        </div>
        {/* Header CTAs match the prototype's view-actions ("Open position",
            "Deposit"). Routing to the existing real pages — no fake handlers. */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/trade"
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-2.5 text-sm min-h-[44px] font-medium text-parchment hover:bg-ink/90"
          >
            Open position
          </Link>
          <Link
            href="/app/transfer"
            className="inline-flex items-center gap-1.5 rounded-md border border-divider bg-parchment px-4 py-2.5 text-sm min-h-[44px] font-medium text-ink hover:border-ink/30"
          >
            Deposit
          </Link>
        </div>
      </header>

      {/* Audit-pinned: Top-up banner only renders when bufferBps is below the
          warning threshold AND source is live (not "pending"). Hidden no-op
          otherwise — does not push the stat row down for healthy accounts. */}
      <section className="mt-6">
        <TopUpBanner />
      </section>

      <section className="mt-8">
        <PortfolioStatRow />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <MarginEngineCard />
        <BuyingPowerCard />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Audit P-11 fix: PositionsFilter encapsulates the pill bar + the
            filterable table. HL / Aave / Pendle / PMK pills now actually
            filter the table client-side (data still comes from the API). */}
        <PositionsFilter />
        <aside>
          <header className="mb-3 flex items-baseline justify-between">
            <h2
            className="font-medium tracking-[-0.02em]"
            style={{
              fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
              fontSize: '20px',
              color: 'oklch(0.13 0.008 60)',
            }}
          >
            Activity
          </h2>
            <Link href="/app/portfolio/activity" className="text-xs text-muted hover:text-ink">
              View all
            </Link>
          </header>
          <ActivityFeed />
        </aside>
      </section>
      </div>
    </AppShell>
  );
}
