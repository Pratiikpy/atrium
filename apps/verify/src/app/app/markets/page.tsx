import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { StrategyCombos } from '@/components/markets/strategy-combos';
import { MarketsMobile } from '@/components/mobile/panels/markets-mobile';
import { VENUE_COUNT } from '@/lib/venues';

export const metadata = {
  title: 'Markets',
  description: 'Every Portico-whitelisted instrument. Haircut, correlation class, oracle source.',
};

// Launch-QA (venue-count reconciliation): this list is the DEPLOYED-ADAPTER
// surface (9 adapters with registry entries in deployments/arbitrum_sepolia.json),
// NOT the canonical margin-scope venue set. The canonical venue list is
// lib/venues.ts `VENUES` (VENUE_COUNT = 7 margin-scope venues; the Hyperliquid
// adapter serves both HIP-3 and HIP-4). These are two intentional lenses, so
// this const is named ADAPTERS to avoid shadowing the canonical VENUES, and the
// heading below states "9 adapters / 7 in margin scope" the way /architecture does.
// Audit 2026-05-24 H-1 (Auditor B): prior list shipped 6 of 9 deployed adapters;
// gmx/morpho/synthetix were added (scaffold-only, open reverts ScaffoldNotImplemented).
const ADAPTERS = [
  {
    name: 'Hyperliquid HIP-3',
    slug: 'adapter-hyperliquid',
    desc: 'Perpetual futures via the HIP-3 bridge + validator attestation.',
    risk: 'Perp; haircut 10%; correlation class CRYPTO_PERP.',
    instruments: 'BTC-PERP, ETH-PERP, SOL-PERP, +12 more',
    // Audit fix (#37): venue address is a deployer-EOA placeholder; open reverts.
    pendingVenue: true,
  },
  {
    name: 'Aave Horizon',
    slug: 'adapter-aave-horizon',
    desc: 'Tokenized T-bills via Aave Horizon supply markets.',
    risk: 'Cash-equiv; haircut 1%; correlation class TBILL.',
    instruments: 'USDC, USDT, DAI, sUSDe',
  },
  {
    name: 'Pendle V2',
    slug: 'adapter-pendle',
    desc: 'Yield-bearing principal tokens (PT) and yield tokens (YT).',
    risk: 'Yield-bearing; haircut 5%; correlation class YIELD.',
    instruments: 'USDC-YT-MAR26, GLP-PT-JUN26, +n more',
    // Audit fix (#37): venue address is a deployer-EOA placeholder; open reverts.
    pendingVenue: true,
  },
  {
    name: 'Curve',
    slug: 'adapter-curve',
    desc: 'Stable LP positions, priced as a low-risk cash-equivalent while pool composition holds. Margin nets within the STABLE_LP class, not against other classes (v1 has no cross-class credit).',
    risk: 'LP; haircut 5%; correlation class STABLE_LP.',
    instruments: '3pool, FRAX-USDC, +5 more',
    // Audit fix (#37): venue address is a deployer-EOA placeholder; open reverts.
    pendingVenue: true,
  },
  {
    name: 'Trade.xyz',
    slug: 'adapter-trade-xyz',
    desc: 'Equity perps (NVDA, AAPL, TSLA, MSFT).',
    risk: 'Equity perp; haircut 15%; correlation class EQUITY_PERP.',
    instruments: 'NVDA-PERP, AAPL-PERP, TSLA-PERP, MSFT-PERP',
    // Audit fix (#37): venue address is a deployer-EOA placeholder; open reverts.
    pendingVenue: true,
  },
  {
    name: 'Polymarket (via CCIP)',
    slug: 'adapter-polymarket',
    desc: 'Prediction markets settled on Polygon Amoy. Cross-chain via Aqueduct CCIP.',
    risk: 'Binary event; haircut 50%; correlation class BINARY.',
    instruments: '2026 election cycle, +macro/sports',
    // Audit fix (#37): venue address is a deployer-EOA placeholder; open reverts.
    pendingVenue: true,
  },
  {
    name: 'GMX V2',
    slug: 'adapter-gmx',
    desc: 'Perp DEX with GLP-style multi-asset pool. Decentralized order book on Arbitrum.',
    risk: 'Perp; haircut 12%; correlation class CRYPTO_PERP.',
    instruments: 'BTC-USD, ETH-USD, ARB-USD, LINK-USD',
    // Audit fix (#37): GmxV2Adapter.open_position reverts ScaffoldNotImplemented
    // (no real GMX router wired), so it is open-blocked like Morpho/Synthetix.
    scaffold: true,
  },
  {
    name: 'Morpho Blue',
    slug: 'adapter-morpho',
    desc: 'Isolated lending markets with custom risk parameters per market.',
    risk: 'Lend; haircut 2%; correlation class LENDING.',
    instruments: 'wstETH/USDC, WBTC/USDC, plus permissionless markets',
    // Phase theta-followup (2026-05-25): scaffold open_position now reverts
    // ScaffoldNotImplemented to prevent funds-strand. Tile renders a
    // disabled state so the user is not invited to a flow that reverts.
    scaffold: true,
  },
  {
    name: 'Synthetix V3',
    slug: 'adapter-synthetix',
    desc: 'Multi-collateral synth perps with cross-margined account abstraction.',
    risk: 'Perp; haircut 14%; correlation class CRYPTO_PERP.',
    instruments: 'BTC-PERP, ETH-PERP, SOL-PERP, +20 synthetic perps',
    scaffold: true,
  },
] as const;

export default function MarketsPage() {
  return (
    <AppShell
      active="/app/markets"
      // Viewport slots: only the active layout mounts (mobile gets the
      // thumb-friendly venue browser, desktop the dense list), so neither
      // double-mounts the other's hooks.
      mobile={<div className="md:hidden"><MarketsMobile /></div>}
      desktop={
      <div className="hidden md:block">
      <section>
        <p className="text-xs uppercase tracking-wider text-muted">Markets</p>
        <h1 className="mt-2 font-display text-4xl text-ink">Venue adapters</h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          {ADAPTERS.length} Portico adapters are deployed and verified on Arbitrum Sepolia,
          each whitelisted by 3-reviewer Curator approval and a 48h Praetor timelock, bytecode
          pinned by hash at registration. Margin scope spans {VENUE_COUNT} venues today (the
          Hyperliquid adapter serves both HIP-3 and HIP-4); only Aave Horizon is openable, the
          rest are pending or scaffold-only as marked below.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        {/* Audit fix (#37): badges now reflect actual openability instead of a
            blanket "live source". scaffold = open reverts ScaffoldNotImplemented
            (GMX/Morpho/Synthetix). pending-venue = the immutable venue address is
            a testnet placeholder (deployer EOA), so an open reverts until a real
            or mock venue is wired (Curve/Pendle/Trade.xyz/Polymarket/Hyperliquid).
            Only Aave Horizon is mock-backed (MockAavePool) and demoable today. */}
        {ADAPTERS.map((v) => {
          const isScaffold = 'scaffold' in v && v.scaffold === true;
          const isPending = 'pendingVenue' in v && v.pendingVenue === true;
          const dim = isScaffold || isPending;
          return (
            <article
              key={v.name}
              className={'rounded-md border bg-parchment p-6 ' + (dim ? 'border-divider opacity-60' : 'border-divider')}
            >
              <header className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-display text-2xl text-ink">{v.name}</p>
                {isScaffold ? (
                  <span className="rounded-full border border-testnet/40 bg-testnet/10 px-3 py-1 text-xs text-testnet">
                    scaffold · open blocked
                  </span>
                ) : isPending ? (
                  <span className="rounded-full border border-testnet/40 bg-testnet/10 px-3 py-1 text-xs text-testnet">
                    pending · venue not wired
                  </span>
                ) : (
                  <span className="rounded-full border border-divider px-3 py-1 text-xs text-muted">
                    mock-backed · demoable
                  </span>
                )}
              </header>
              <p className="mt-2 text-sm text-ink-soft">{v.desc}</p>
              <p className="mt-3 text-xs text-muted">{v.risk}</p>
              <p className="mt-1 text-xs text-muted">Instruments: {v.instruments}</p>
              {isScaffold && (
                <p className="mt-3 text-xs text-testnet">
                  Open is disabled, adapter is a Year-1 scaffold without venue-side
                  deployment (open_position reverts ScaffoldNotImplemented so the
                  Router cannot strand pulled USDC). Real implementation lands Year-2.
                </p>
              )}
              {isPending && (
                <p className="mt-3 text-xs text-testnet">
                  Venue address is a testnet placeholder, so an open reverts until a
                  real (or mock) venue is wired. Aave Horizon is the one mock-backed
                  venue demoable on testnet today.
                </p>
              )}
            </article>
          );
        })}
      </section>

      <StrategyCombos />

      <section className="mt-12 rounded-md border border-divider bg-parchment-soft/40 p-6">
        <h2 className="font-display text-xl text-ink">Add a venue</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Adapters follow the <code className="font-mono text-ink">IPorticoAdapter v1.0</code> standard,
          MIT-licensed. Curator grants will pay $5K ARB per accepted adapter, after testnet launch.
        </p>
        <Link href="/learn#adapters" className="mt-3 inline-block text-sm text-ink underline-offset-2 hover:underline">
          Read the adapter spec
        </Link>
      </section>
      </div>
      }
    />
  );
}
