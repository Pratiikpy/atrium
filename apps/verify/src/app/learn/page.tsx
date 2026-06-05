import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Learn',
  description: 'How Atrium nets cross-venue collateral with one margin number.',
  alternates: { canonical: '/learn' },
};

export default function LearnPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-5xl text-ink">How Atrium works</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        A trader hedged across two venues today posts margin twice. Atrium nets the hedge with one
        unified margin number. One wallet, one collateral pool, many venues. The piece that makes
        it work is a Stylus risk engine that runs SPAN-style scenarios fast enough to be cheap.
      </p>

      <section className="mt-12 space-y-6">
        <Step
          n={1}
          title="Deposit once into Coffer"
          body="Coffer is an ERC-4626 vault holding USDC. You deposit, you get shares, you can withdraw any time subject to the withdrawal SLA."
        />
        <Step
          n={2}
          id="adapters"
          title="Open positions across venues via Portico adapters"
          body="Portico adapters speak IPorticoAdapter v1.0. Atrium ships adapters for Hyperliquid HIP-3, Aave Horizon, Pendle V2, Trade.xyz, Curve, and Polymarket (via Aqueduct CCIP)."
        />
        <Step
          n={3}
          id="span"
          title="Plinth nets the risk"
          body="Stylus-native SPAN scenario matrix runs on every margin recompute. Correlated positions cancel under each scenario. Net required margin lands far below isolated margin."
        />
        <Step
          n={4}
          title="Vigil watches the line"
          body="Three independent keepers race to liquidate any account that falls under-collateralised. Liquidations are partial (≤10% per block) and NMS-aware (most-liquid venue first)."
        />
        <Step
          n={5}
          id="sigil"
          title="Sigil + Postern make agents safe"
          body="AI agents act on your behalf via EIP-712 mandates with hard caps and an expiry. Postern issues passkey-bound session keys. One tap of the Kill Switch revokes every mandate and every session key in a single tx."
        />
        <Step
          n={6}
          title="Lantern proves reserves"
          body="Every 10 minutes Lantern publishes a Merkle root of every Coffer balance on chain. The tree is pinned to IPFS. You can verify your own balance with a one-click inclusion proof."
        />
      </section>

      <div className="hairline mt-20" />
      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Open standards</h2>
        <p className="mt-3 text-ink-soft">
          IPorticoAdapter v1.0 is MIT-licensed from Day 30. Sigil's EIP-712 schema is published.
          Curator grants will pay $5K ARB per accepted adapter and reference agent, after testnet launch.
        </p>
      </section>

      <Link
        href="/"
        className="mt-16 inline-block text-sm text-ink underline-offset-2 hover:underline"
      >
        Back to Atrium
      </Link>
      </div>
    </MarketingShell>
  );
}

function Step({
  n,
  title,
  body,
  id,
}: {
  n: number;
  title: string;
  body: string;
  /**
   * Optional fragment anchor, used by cross-page links like
   * `/learn#adapters` so the browser scrolls the relevant Step into view.
   * Pre-fix those links existed but had no matching id, so the browser
   * landed at the top of the page silently (audit U-19).
   */
  id?: string;
}) {
  return (
    <div id={id} className="rounded-md border border-divider bg-parchment p-6 scroll-mt-24">
      <p className="text-xs uppercase tracking-wider text-muted">step {n}</p>
      <h3 className="mt-2 text-lg font-medium text-ink">{title}</h3>
      <p className="mt-2 text-ink-soft">{body}</p>
    </div>
  );
}
