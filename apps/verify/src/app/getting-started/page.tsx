import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { StepWalkthrough } from '@/components/getting-started/getting-started-client';
import './getting-started.css';

export const metadata: Metadata = {
  title: 'Getting Started',
  description:
    'From zero to your first cross-margin trade. Eight short steps, in plain language, on a free testnet. No prior crypto experience needed. Connect, faucet test funds, deposit, see your unified margin, preview a trade, delegate to an agent, verify the reserves, and run the full proof.',
  alternates: { canonical: '/getting-started' },
  openGraph: { title: 'Atrium · Getting Started', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image' },
};

const HONEST_NOTES = [
  {
    t: 'Testnet only',
    tag: 'TESTNET',
    b: 'No economic value anywhere. All funds come from the faucet. Nothing you do here touches real money.',
  },
  {
    t: 'Cross-chain transfer',
    tag: 'TESTNET',
    b: "Built, but the CCIP lane to the destination chain isn't deployed on testnet yet. The button is disabled with an honest reason and shows your real balances.",
  },
  {
    t: 'Tax export',
    tag: 'TESTNET',
    b: 'Gated on the Tablet service, which deploys later. The export buttons are disabled with a clear note rather than returning an error.',
  },
  {
    t: 'Full honesty list',
    tag: 'TESTNET',
    b: 'Everything mocked, relayed, or pending on testnet is published live in the app. No number presents a mock as a real upstream.',
  },
];

export default function GettingStartedPage() {
  return (
    <MarketingShell nakedContent>
      <div className="gs-root">
        {/* HERO */}
        <header className="gs-hero">
          <div className="gs-eyebrow">
            <span className="gs-eyebrow-rule" />
            NO PRIOR CRYPTO EXPERIENCE NEEDED
          </div>
          <h1 className="gs-h1">
            From zero to your
            <br />
            first <em>cross-margin</em> trade.
          </h1>
          <p className="gs-lede">
            Eight short steps, in plain language, on a free testnet. Nothing here uses real money,
            you&apos;ll faucet your own test funds in step two. Tap each step to expand it.
          </p>
          <div className="gs-hero-cta">
            <a href="#walkthrough" className="gs-btn-primary">
              Start the walkthrough ↓
            </a>
            <Link href="/app" className="gs-btn-ghost">
              Skip to the app ↗
            </Link>
          </div>
        </header>

        {/* WALKTHROUGH */}
        <section className="gs-section" id="walkthrough">
          <StepWalkthrough />
        </section>

        {/* HONEST NOTES */}
        <section className="gs-section gs-honest" id="honest-notes">
          <div className="gs-section-num">HONEST NOTES</div>
          <h2 className="gs-h2">
            What&apos;s real, and what&apos;s <em>coming.</em>
          </h2>
          <div className="gs-honest-grid">
            {HONEST_NOTES.map((n) => (
              <div className="gs-honest-card" key={n.t}>
                <div className="gs-honest-head">
                  <h3 className="gs-honest-title">{n.t}</h3>
                  <span className="gs-honest-tag">{n.tag}</span>
                </div>
                <p className="gs-honest-body">{n.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CLOSING */}
        <section className="gs-closing">
          <div className="gs-section-num">TESTNET · NOW OPEN</div>
          <h2 className="gs-h2">
            Ready <em>when you are.</em>
          </h2>
          <p className="gs-section-lede">
            The whole flow runs against live contracts on Arbitrum Sepolia. No real funds, no risk,
            just the product, working.
          </p>
          <div className="gs-closing-cta">
            <Link href="/app" className="gs-btn-primary">
              Open testnet ↗
            </Link>
            <Link href="/architecture" className="gs-btn-ghost">
              See the architecture
            </Link>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
