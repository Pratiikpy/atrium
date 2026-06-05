import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { SystemMap, PositionFlow, DeploymentsTable } from '@/components/architecture/architecture-client';
import './architecture.css';

export const metadata: Metadata = {
  title: 'Architecture',
  description:
    'One margin account, many venues. Twenty-four contracts across Arbitrum Sepolia and Robinhood Chain - Stylus for the math, Solidity for the integrations. Real verified addresses, an interactive system map, and a position traced through the whole system.',
  alternates: { canonical: '/architecture' },
  openGraph: { title: 'Atrium · Architecture', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image' },
};

const STATS = [
  { v: '24', l: 'ON ARBITRUM' },
  { v: '7', l: 'VENUE SCOPE' },
  { v: '2', l: 'TESTNETS' },
  { v: '10‑100×', l: 'STYLUS HEADROOM' },
];

const SECURITY = [
  {
    t: 'Timelock + multisig',
    b: 'Every parameter setter is timelock-gated (48h). Emergency pause is multisig-only with no delay - it can pause but cannot upgrade.',
  },
  {
    t: 'Dual-oracle reads',
    b: 'Every Plinth price takes the median of Chainlink and Pyth, with 50 bps tolerance and a 60-second freshness window. Stale or off → revert.',
  },
  {
    t: 'Reentrancy guards',
    b: 'Every state-changing Stylus function carries an is_updating flag, entered before any external call.',
  },
  {
    t: 'Per-block notional cap',
    b: 'Coffer caps how much a single adapter can pull per block - a compromised adapter drains at most ~1% of TVL per block.',
  },
  {
    t: 'AA emergency lever',
    b: 'The Postern Kill Switch routes through Sigil.revoke_all_on_behalf_of, so the revoke counts against the user, not the kill-switch.',
  },
  {
    t: 'No silent fallbacks',
    b: 'Coffer and Plinth refuse to operate - revert loudly - when USDC state is unreadable, rather than assuming a safe default.',
  },
];

export default function ArchitecturePage() {
  return (
    <MarketingShell nakedContent>
      <div className="arch-root">
        {/* HERO */}
        <header className="arch-hero">
          <div className="arch-eyebrow">
            <span className="arch-eyebrow-rule" />
            ARCHITECTURE · LIVE ON TWO TESTNETS
          </div>
          <h1 className="arch-h1">
            One margin account,
            <br />
            <em>many venues.</em>
          </h1>
          <p className="arch-lede">
            Twenty-plus contracts across Arbitrum Sepolia and Robinhood Chain. Stylus for the math,
            Solidity for the integrations. Click any piece to inspect it, then watch a position flow
            through the whole system.
          </p>
          <div className="arch-stats">
            {STATS.map((s) => (
              <div className="arch-stat" key={s.l}>
                <div className="arch-stat-v">{s.v}</div>
                <div className="arch-stat-l">{s.l}</div>
              </div>
            ))}
          </div>
        </header>

        {/* 01 SYSTEM MAP */}
        <section className="arch-section" id="system-map">
          <div className="arch-section-num">01 · INTERACTIVE SYSTEM MAP</div>
          <h2 className="arch-h2">
            Every piece, and <em>what it does.</em>
          </h2>
          <p className="arch-section-lede">
            The router dispatches a signed transaction to the right place: collateral lives in
            Coffer, margin is priced by Plinth, each venue has its own adapter, and Vigil + Lantern
            keep the system honest. Hover or tap a node.
          </p>
          <SystemMap />
        </section>

        {/* 02 POSITION FLOW */}
        <section className="arch-section" id="position-flow">
          <div className="arch-section-num">02 · WATCH IT WORK</div>
          <h2 className="arch-h2">
            A hedged position, <em>step by step.</em>
          </h2>
          <p className="arch-section-lede">
            Press play. Follow a deposit become collateral, two offsetting positions net their risk,
            and the margin requirement fall live - the entire reason Atrium exists, animated through
            the real contract path.
          </p>
          <PositionFlow />
        </section>

        {/* 03 DEPLOYMENTS */}
        <section className="arch-section" id="deployments">
          <div className="arch-section-num">03 · LIVE DEPLOYMENTS</div>
          <h2 className="arch-h2">
            Real addresses, <em>verified on-chain.</em>
          </h2>
          <p className="arch-section-lede">
            Every contract below is a live, verified deployment - Solidity on Sourcify, Stylus via
            cargo stylus verify. Click any address to copy it.
          </p>
          <DeploymentsTable />
        </section>

        {/* 04 SECURITY */}
        <section className="arch-section" id="security">
          <div className="arch-section-num">04 · SECURITY MODEL</div>
          <h2 className="arch-h2">
            Built to fail <em>loudly,</em> not silently.
          </h2>
          <p className="arch-section-lede">
            Six defensive choices, each addressing a known DeFi blowup vector.
          </p>
          <div className="arch-sec-grid">
            {SECURITY.map((s, i) => (
              <div className="arch-sec-card" key={s.t}>
                <div className="arch-sec-num">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="arch-sec-title">{s.t}</h3>
                <p className="arch-sec-body">{s.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CLOSING */}
        <section className="arch-closing">
          <h2 className="arch-h2">
            See it <em>running.</em>
          </h2>
          <p className="arch-section-lede">
            The whole stack is live on testnet right now. Faucet test funds, post collateral, and
            watch your buying-power number move.
          </p>
          <div className="arch-closing-cta">
            <Link href="/app" className="arch-btn-primary">
              Open the testnet ↗
            </Link>
            <Link href="/getting-started" className="arch-btn-ghost">
              Read the walkthrough
            </Link>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
