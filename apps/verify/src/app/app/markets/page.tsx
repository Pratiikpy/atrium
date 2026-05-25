import Link from 'next/link';
import { AppShell } from '@/components/app-shell';

export const metadata = {
  title: 'Atrium · Markets',
  description: 'Every Portico-whitelisted instrument. Haircut, correlation class, oracle source.',
};

// Audit 2026-05-24 H-1 (Auditor B) fix: prior list shipped 6 of 9 deployed
// adapters. The missing three (gmx, morpho, synthetix) all have registry
// entries at deployments/arbitrum_sepolia.json and are referenced from the
// /api/deployments/address allowlist. Each adapter slug maps to its
// Portico-whitelisted venue and gets a dedicated card here so the user
// can see the full venue surface.
const VENUES = [
  {
    name: 'Hyperliquid HIP-3',
    slug: 'adapter-hyperliquid',
    desc: 'Perpetual futures via the HIP-3 bridge + validator attestation.',
    risk: 'Perp; haircut 10%; correlation class CRYPTO_PERP.',
    instruments: 'BTC-PERP, ETH-PERP, SOL-PERP, +12 more',
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
  },
  {
    name: 'Curve',
    slug: 'adapter-curve',
    desc: 'Stable LP positions. Treated as netting cash equivalent if pool composition stable.',
    risk: 'LP; haircut 5%; correlation class STABLE_LP.',
    instruments: '3pool, FRAX-USDC, +5 more',
  },
  {
    name: 'Trade.xyz',
    slug: 'adapter-trade-xyz',
    desc: 'Equity perps (NVDA, AAPL, TSLA, MSFT).',
    risk: 'Equity perp; haircut 15%; correlation class EQUITY_PERP.',
    instruments: 'NVDA-PERP, AAPL-PERP, TSLA-PERP, MSFT-PERP',
  },
  {
    name: 'Polymarket (via CCIP)',
    slug: 'adapter-polymarket',
    desc: 'Prediction markets settled on Polygon Amoy. Cross-chain via Aqueduct CCIP.',
    risk: 'Binary event; haircut 50%; correlation class BINARY.',
    instruments: '2026 election cycle, +macro/sports',
  },
  {
    name: 'GMX V2',
    slug: 'adapter-gmx',
    desc: 'Perp DEX with GLP-style multi-asset pool. Decentralized order book on Arbitrum.',
    risk: 'Perp; haircut 12%; correlation class CRYPTO_PERP.',
    instruments: 'BTC-USD, ETH-USD, ARB-USD, LINK-USD',
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
    <AppShell active="/app/markets">
      <section>
        <p className="text-xs uppercase tracking-wider text-muted">Markets</p>
        <h1 className="mt-2 font-display text-4xl text-ink">Whitelisted venues</h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          Every venue ships with a Portico adapter whitelisted by 3-reviewer Curator
          approval and a 48h Praetor timelock. Bytecode pinned by hash at registration
          time. New adapters need community veto window before going live.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        {VENUES.map((v) => {
          const isScaffold = 'scaffold' in v && v.scaffold === true;
          return (
            <article
              key={v.name}
              className={
                'rounded-md border bg-parchment p-6 ' +
                (isScaffold ? 'border-divider opacity-60' : 'border-divider')
              }
            >
              <header className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-display text-2xl text-ink">{v.name}</p>
                {isScaffold ? (
                  <span className="rounded-full border border-testnet/40 bg-testnet/10 px-3 py-1 text-xs text-testnet">
                    scaffold · open blocked
                  </span>
                ) : (
                  <span className="rounded-full border border-divider px-3 py-1 text-xs text-muted">
                    live source
                  </span>
                )}
              </header>
              <p className="mt-2 text-sm text-ink-soft">{v.desc}</p>
              <p className="mt-3 text-xs text-muted">{v.risk}</p>
              <p className="mt-1 text-xs text-muted">Instruments: {v.instruments}</p>
              {isScaffold && (
                <p className="mt-3 text-xs text-testnet">
                  {/* Phase theta-followup: scaffold adapters revert
                      ScaffoldNotImplemented on open_position to prevent
                      Coffer.adapterPull from stranding USDC in the adapter.
                      Real Synthetix V3 + Morpho Blue impls land Year-2. */}
                  Open is disabled — adapter is a Year-1 scaffold without venue-side
                  deployment. Listed here for visibility; real implementation lands
                  Year-2.
                </p>
              )}
            </article>
          );
        })}
      </section>

      <section className="mt-12 rounded-md border border-divider bg-parchment-soft/40 p-6">
        <h2 className="font-display text-xl text-ink">Add a venue</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Adapters follow the <code className="font-mono text-ink">IPorticoAdapter v1.0</code> standard,
          MIT-licensed at buildathon end. Curator grant of $5K ARB per accepted adapter.
        </p>
        <Link href="/learn#adapters" className="mt-3 inline-block text-sm text-ink underline-offset-2 hover:underline">
          Read the adapter spec
        </Link>
      </section>
    </AppShell>
  );
}
