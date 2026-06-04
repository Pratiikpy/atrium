import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { PitchRail } from '@/components/pitch/pitch-client';
import './pitch.css';

export const metadata: Metadata = {
  title: 'Investor brief',
  description:
    'Atrium is cross-venue portfolio margin for the EVM. One wallet posts collateral once and trades across multiple on-chain venues with a single margin number. Deployed and verified on two testnets, with the proof you can check yourself.',
  alternates: { canonical: '/pitch' },
  openGraph: { title: 'Atrium · Investor brief', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

/* The fourteen sections, in deck order. The eyebrow numeral + label
 * doubles as the side-rail label so the rail and the headings stay in
 * lockstep. */
const RAIL = [
  { id: 'title', n: '00', label: 'Title' },
  { id: 'problem', n: 'I', label: 'The problem' },
  { id: 'insight', n: 'II', label: 'The insight' },
  { id: 'worked-example', n: 'III', label: 'Worked example' },
  { id: 'moat', n: 'IV', label: 'The moat' },
  { id: 'architecture', n: 'V', label: 'Architecture' },
  { id: 'why-now', n: 'VI', label: 'Why now' },
  { id: 'proof', n: 'VII', label: "Proof it's real" },
  { id: 'who', n: 'VIII', label: 'Who we win for' },
  { id: 'category', n: 'IX', label: 'The category' },
  { id: 'limits', n: 'X', label: 'Honest limits' },
  { id: 'next', n: 'XI', label: "What's next" },
  { id: 'founder', n: 'XII', label: 'The founder' },
  { id: 'closing', n: '·', label: 'Close' },
];

export default function PitchPage() {
  return (
    <MarketingShell nakedContent>
      <PitchRail items={RAIL} />
      <div className="pitch-root">
        {/* ===== 00 · TITLE ===================================== */}
        <section className="pitch-slide pitch-title" id="title">
          <div className="pitch-title-top">
            <span className="pitch-eyebrow">ATRIUM LABS · INVESTOR BRIEF</span>
            <span className="pitch-pill">
              <span className="pitch-pill-dot" />
              TESTNET · LIVE
            </span>
          </div>
          <div className="pitch-title-body">
            <div className="pitch-wordmark">Atrium</div>
            <span className="pitch-wordmark-rule" />
            <h1 className="pitch-title-h1">
              Cross-venue portfolio
              <br />
              margin for the EVM.
            </h1>
            <p className="pitch-title-lede">
              One wallet posts collateral once and trades across multiple on-chain venues with a
              single margin number.
            </p>
          </div>
          <div className="pitch-title-foot">
            <span className="pitch-title-chain">
              <strong>Arbitrum Sepolia</strong> · chain 421614
            </span>
            <span className="pitch-title-chain">
              <strong>Robinhood Chain</strong> testnet · chain 46630
            </span>
            <span className="pitch-title-chain pitch-faint">Deployed · verified · 2026</span>
          </div>
        </section>

        {/* ===== I · THE PROBLEM =============================== */}
        <section className="pitch-slide" id="problem">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">I</span>
            <span className="pitch-section-label">THE PROBLEM</span>
          </div>
          <h2 className="pitch-h2">
            Run positions on more than one venue, and your capital splits into silos.
          </h2>
          <div className="pitch-two-col">
            <div className="pitch-col-prose">
              <p className="pitch-body">
                A long perp on one venue and a hedge or yield position on another sit as two locked
                balances, even though the net risk is far smaller than the sum.{' '}
                <strong>Most of that capital does nothing.</strong>
              </p>
              <p className="pitch-body pitch-muted">
                There is no neutral place to net that risk. Every venue can only cross-margin
                positions held inside its own walls, because the venue on the other side is a
                competitor.
              </p>
            </div>
            <div className="pitch-col-data">
              <div className="pitch-locked-card">
                <span className="pitch-locked-label">VENUE A · PERP</span>
                <span className="pitch-locked-value">$100,000</span>
                <span className="pitch-tag pitch-tag-neg">LOCKED</span>
              </div>
              <div className="pitch-locked-card">
                <span className="pitch-locked-label">VENUE B · T-BILLS</span>
                <span className="pitch-locked-value">$100,000</span>
                <span className="pitch-tag pitch-tag-neg">LOCKED</span>
              </div>
              <div className="pitch-locked-foot">
                <span className="pitch-section-label">NET RISK</span>
                <span className="pitch-locked-foot-note">far below the sum</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== II · THE INSIGHT ============================== */}
        <section className="pitch-slide" id="insight">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">II</span>
            <span className="pitch-section-label">THE INSIGHT</span>
          </div>
          <h2 className="pitch-h2">
            One neutral vault. One <em>portfolio-margin number</em> across every venue.
          </h2>
          <p className="pitch-body pitch-lede-wide">
            Put the collateral in one non-custodial vault and price net exposure with a single
            number. The same deposit then backs a perp on one venue, a tokenized T-bill on another,
            and a yield position on a third, at the same time. One balance, doing several jobs.
          </p>
          <div className="pitch-insight-flow">
            <div className="pitch-deposit-card">
              <span className="pitch-locked-label">ONE DEPOSIT</span>
              <span className="pitch-locked-value">$100,000</span>
            </div>
            <span className="pitch-insight-arrow" aria-hidden="true">
              →
            </span>
            <div className="pitch-backed-grid">
              <div className="pitch-backed-card">
                <span className="pitch-backed-name">ETH perp · Venue A</span>
                <span className="pitch-tag pitch-tag-pos">BACKED</span>
              </div>
              <div className="pitch-backed-card">
                <span className="pitch-backed-name">Tokenized T-bills · Venue B</span>
                <span className="pitch-tag pitch-tag-pos">BACKED</span>
              </div>
              <div className="pitch-backed-card">
                <span className="pitch-backed-name">Yield position · Venue C</span>
                <span className="pitch-tag pitch-tag-pos">BACKED</span>
              </div>
            </div>
          </div>
          <p className="pitch-body pitch-muted pitch-aside">
            This is what a TradFi prime broker does for institutions, except Atrium does it on-chain,
            non-custodially, and with no minimums.
          </p>
        </section>

        {/* ===== III · THE WORKED EXAMPLE ====================== */}
        <section className="pitch-slide" id="worked-example">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">III</span>
            <span className="pitch-section-label">THE WORKED EXAMPLE</span>
          </div>
          <h2 className="pitch-h2">
            $100K, a long ETH perp, and <em>T-bills for carry.</em>
          </h2>
          <div className="pitch-compare">
            <div className="pitch-compare-card">
              <div className="pitch-compare-head">
                <span className="pitch-section-label">WITHOUT UNIFIED MARGIN</span>
                <span className="pitch-tag pitch-tag-neg">TWO SILOS</span>
              </div>
              <p className="pitch-body">
                The $100K of T-bills earns yield but does nothing for the perp. To open it, the
                trader posts its initial margin as a <strong>separate idle balance.</strong>
              </p>
              <div className="pitch-compare-foot">
                <span className="pitch-section-label">Capital working</span>
                <span className="pitch-compare-stat pitch-neg">~50%</span>
              </div>
            </div>
            <div className="pitch-compare-card pitch-compare-card-pos">
              <div className="pitch-compare-head">
                <span className="pitch-section-label">WITH ATRIUM</span>
                <span className="pitch-tag pitch-tag-pos">ONE VAULT</span>
              </div>
              <p className="pitch-body">
                The $100K goes into the Coffer vault once. It earns the T-bill yield <em>and</em>{' '}
                counts as collateral. Plinth charges only the perp&apos;s initial margin and leaves
                the rest as <strong>buying power.</strong>
              </p>
              <div className="pitch-compare-foot">
                <span className="pitch-section-label">Margin freed on a canonical hedge</span>
                <span className="pitch-compare-stat pitch-pos">~51%</span>
              </div>
            </div>
          </div>
          <p className="pitch-caveat">
            Illustrative scale, not a measured reading. The live number is computed by Plinth on{' '}
            <Link href="/app" className="pitch-inline-link">
              /app/trade
            </Link>
            ; the ~51% saving is locked by a passing unit test with a 40-70% guardrail band.
          </p>
        </section>

        {/* ===== IV · THE MOAT ================================ */}
        <section className="pitch-slide" id="moat">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">IV</span>
            <span className="pitch-section-label">THE MOAT</span>
          </div>
          <h2 className="pitch-h2">A venue cannot be neutral to itself.</h2>
          <div className="pitch-two-col">
            <div className="pitch-col-prose">
              <p className="pitch-body">
                To net your risk against a position on a competitor&apos;s venue, a venue would have
                to extend margin credit on a rival&apos;s book and trust the rival&apos;s
                liquidation engine in real time. That is commercially adversarial and technically
                fragile. <strong>No venue will do it.</strong>
              </p>
              <p className="pitch-body pitch-muted">
                The same reason prime brokerage exists as a separate entity in TradFi, not as a
                feature of one exchange.
              </p>
            </div>
            <div className="pitch-col-data">
              <ul className="pitch-moat-list">
                <li className="pitch-moat-item">
                  <span className="pitch-moat-name">Coffer</span>
                  <span className="pitch-moat-blurb">
                    holds the collateral, so no venue extends credit to another.
                  </span>
                </li>
                <li className="pitch-moat-item">
                  <span className="pitch-moat-name">Plinth</span>
                  <span className="pitch-moat-blurb">
                    computes one portfolio-wide SPAN number, owned by neither venue.
                  </span>
                </li>
                <li className="pitch-moat-item">
                  <span className="pitch-moat-name">Portico</span>
                  <span className="pitch-moat-blurb">
                    lets each venue pull collateral only within a per-block cap, never freely.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ===== V · THE ARCHITECTURE ========================== */}
        <section className="pitch-slide" id="architecture">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">V</span>
            <span className="pitch-section-label">THE ARCHITECTURE</span>
          </div>
          <h2 className="pitch-h2">
            A neutral core in Rust, with <em>adapters in Solidity.</em>
          </h2>
          <div className="pitch-arch-grid">
            {[
              { name: 'Coffer', lang: 'STYLUS', blurb: 'ERC-4626 vault. Holds collateral once; orchestrators pull up to a per-block cap.' },
              { name: 'Plinth', lang: 'STYLUS', blurb: 'SPAN margin engine. One buying-power number across venues, netting correlated risk.' },
              { name: 'Sigil', lang: 'STYLUS', blurb: 'EIP-712 mandates. Bounded agent delegation an agent physically cannot exceed.' },
              { name: 'Vigil', lang: 'STYLUS', blurb: 'Liquidation queue and execute engine, gated on keeper stake.' },
              { name: 'AtriumRouter', lang: 'SOLIDITY', blurb: 'Margin to vault to adapter in one transaction.' },
              { name: 'Postern', lang: 'SOLIDITY', blurb: 'Kill switch. Revoke every mandate in one tx.' },
              { name: 'Lantern', lang: 'SOLIDITY', blurb: 'Signed Merkle proof-of-reserves root.' },
              { name: 'Aqueduct', lang: 'SOLIDITY', blurb: 'Chainlink CCIP collateral bridge.' },
            ].map((c) => (
              <div className="pitch-arch-card" key={c.name}>
                <div className="pitch-arch-card-head">
                  <span className="pitch-arch-name">{c.name}</span>
                  <span className={`pitch-tag ${c.lang === 'STYLUS' ? 'pitch-tag-stylus' : 'pitch-tag-solidity'}`}>
                    {c.lang}
                  </span>
                </div>
                <p className="pitch-arch-blurb">{c.blurb}</p>
              </div>
            ))}
          </div>
          <p className="pitch-body pitch-muted pitch-aside">
            The compute-heavy core is Arbitrum Stylus; adapters and the cross-chain layer are
            Solidity, because every venue documents in Solidity.
          </p>
          <Link href="/architecture" className="pitch-inline-link pitch-aside-link">
            See the full system map ↗
          </Link>
        </section>

        {/* ===== VI · WHY NOW ================================= */}
        <section className="pitch-slide" id="why-now">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">VI</span>
            <span className="pitch-section-label">WHY NOW</span>
          </div>
          <h2 className="pitch-h2">
            Arbitrum Stylus makes the margin engine <em>feasible on-chain.</em>
          </h2>
          <div className="pitch-two-col">
            <div className="pitch-col-prose">
              <p className="pitch-body">
                SPAN portfolio margin is a scenario grid: shock every instrument up and down, net the
                correlated classes, take the worst case. In hand-written Solidity, that math is too
                expensive to run per block. Atrium&apos;s engine is Rust, deployed as Stylus.
              </p>
              <p className="pitch-body pitch-muted">
                The wedge itself, neutrality, is chain-agnostic. What Stylus changes is the
                feasibility of running the engine at all. A faster L1 does not close this gap,
                because the gap is cross-venue netting, not latency.
              </p>
            </div>
            <div className="pitch-col-data">
              <div className="pitch-headline-stat">
                <span className="pitch-headline-stat-v">10-100×</span>
                <span className="pitch-headline-stat-l">lower gas than the Solidity equivalent</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== VII · PROOF IT'S REAL ======================== */}
        <section className="pitch-slide" id="proof">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">VII</span>
            <span className="pitch-section-label">PROOF IT&apos;S REAL</span>
          </div>
          <h2 className="pitch-h2">
            Not a mockup. <em>Deployed, wired,</em> and verified on two testnets.
          </h2>
          <div className="pitch-proof-stats">
            <div className="pitch-proof-stat">
              <span className="pitch-proof-stat-v">2</span>
              <span className="pitch-proof-stat-l">
                testnets, fully deployed, Arb Sepolia + Robinhood Chain.
              </span>
            </div>
            <div className="pitch-proof-stat">
              <span className="pitch-proof-stat-v">15</span>
              <span className="pitch-proof-stat-l">contract core replicated across both chains.</span>
            </div>
            <div className="pitch-proof-stat">
              <span className="pitch-proof-stat-v pitch-pos">770</span>
              <span className="pitch-proof-stat-l">frontend + library tests passing, suite green.</span>
            </div>
            <div className="pitch-proof-stat">
              <span className="pitch-proof-stat-v">~51%</span>
              <span className="pitch-proof-stat-l">
                isolated margin freed, a passing test, not a slide.
              </span>
            </div>
          </div>
          <div className="pitch-proof-hashes">
            <div className="pitch-hash-block">
              <span className="pitch-section-label">MONEY PATH · VERIFIED ON ARBISCAN</span>
              <div className="pitch-hash-row">
                <span className="pitch-hash-name">Withdraw</span>
                <code className="pitch-hash">0x976e…ddbf</code>
              </div>
              <div className="pitch-hash-row">
                <span className="pitch-hash-name">Mobile deposit</span>
                <code className="pitch-hash">0x8c8d…0347</code>
              </div>
            </div>
            <div className="pitch-hash-block">
              <span className="pitch-section-label">PROOF OF RESERVES · LIVE ON /LANTERN</span>
              <div className="pitch-hash-row">
                <span className="pitch-hash-name">Attested root</span>
                <code className="pitch-hash">0x4b9e…ef1f0</code>
              </div>
              <div className="pitch-hash-row">
                <span className="pitch-hash-name">Block</span>
                <code className="pitch-hash">272,828,085</code>
              </div>
            </div>
          </div>
          <p className="pitch-body pitch-muted pitch-aside">
            Verifier Mode (
            <Link href="/verify" className="pitch-inline-link">
              /verify
            </Link>
            ) walks seven steps against the live contracts: deposit, open, see the saving, trigger a
            chaos fault, run a liquidation drill, verify reserves, revoke with the kill switch.{' '}
            <strong>You can check every claim yourself.</strong>
          </p>
        </section>

        {/* ===== VIII · WHO WE WIN FOR ======================== */}
        <section className="pitch-slide" id="who">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">VIII</span>
            <span className="pitch-section-label">WHO WE WIN FOR</span>
          </div>
          <h2 className="pitch-h2">Three traders, one structural fix.</h2>
          <div className="pitch-persona-grid">
            {[
              {
                who: 'CROSS-VENUE TRADER',
                pain: 'Posts full margin at each venue; capital sits idle in silos.',
                change:
                  'One vault, one netted number; the same collateral does several jobs.',
              },
              {
                who: 'DELEGATING TRADER',
                pain: 'Handing an agent a key hands over everything.',
                change:
                  'A signed, bounded mandate the agent cannot exceed; one-tap kill switch.',
              },
              {
                who: 'CAREFUL ALLOCATOR',
                pain: 'Won’t custody with a venue they cannot audit.',
                change:
                  'Non-custodial ERC-4626 vault plus signed proof-of-reserves they verify in seconds.',
              },
            ].map((p) => (
              <div className="pitch-persona-card" key={p.who}>
                <span className="pitch-persona-who">{p.who}</span>
                <div className="pitch-persona-block">
                  <span className="pitch-persona-sub">PAIN TODAY</span>
                  <p className="pitch-persona-text">{p.pain}</p>
                </div>
                <div className="pitch-persona-block">
                  <span className="pitch-persona-sub">WHAT ATRIUM CHANGES</span>
                  <p className="pitch-persona-text">{p.change}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== IX · THE CATEGORY ============================ */}
        <section className="pitch-slide" id="category">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">IX</span>
            <span className="pitch-section-label">THE CATEGORY</span>
          </div>
          <h2 className="pitch-h2">
            Many products cross-margin inside their own walls. <em>None net across them.</em>
          </h2>
          <div className="pitch-cat-table" role="table">
            <div className="pitch-cat-head" role="row">
              <span role="columnheader" />
              <span role="columnheader">CROSS-VENUE NETTING</span>
              <span role="columnheader">NON-CUSTODIAL</span>
              <span role="columnheader">ON-CHAIN POR</span>
              <span role="columnheader">KYC-GATED</span>
            </div>
            {[
              ['Single-venue perp DEX', 'Within one venue', 'Yes', 'Partial', 'No'],
              ['CEX portfolio margin', 'One platform only', 'No', 'No', 'Yes'],
              ['TradFi prime broker', 'Yes, centralized', 'No', 'No', 'High minimums'],
            ].map((row) => (
              <div className="pitch-cat-row" role="row" key={row[0]}>
                <span className="pitch-cat-name" role="cell">
                  {row[0]}
                </span>
                <span className="pitch-cat-cell" role="cell">
                  {row[1]}
                </span>
                <span className="pitch-cat-cell" role="cell">
                  {row[2]}
                </span>
                <span className="pitch-cat-cell" role="cell">
                  {row[3]}
                </span>
                <span className="pitch-cat-cell" role="cell">
                  {row[4]}
                </span>
              </div>
            ))}
            <div className="pitch-cat-row pitch-cat-row-self" role="row">
              <span className="pitch-cat-name pitch-cat-self-name" role="cell">
                Atrium
              </span>
              <span className="pitch-cat-cell pitch-pos" role="cell">
                Across venues
              </span>
              <span className="pitch-cat-cell pitch-pos" role="cell">
                Yes
              </span>
              <span className="pitch-cat-cell pitch-pos" role="cell">
                Signed Merkle
              </span>
              <span className="pitch-cat-cell pitch-pos" role="cell">
                No
              </span>
            </div>
          </div>
          <p className="pitch-body pitch-muted pitch-aside">
            The first column is the point. None net your position on venue A against venue B, because
            A and B are competitors.
          </p>
        </section>

        {/* ===== X · HONEST LIMITS ============================ */}
        <section className="pitch-slide" id="limits">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">X</span>
            <span className="pitch-section-label">HONEST LIMITS</span>
          </div>
          <h2 className="pitch-h2">
            Stating what is not done, <em>in the same breath</em> as the claim.
          </h2>
          <div className="pitch-limits-grid">
            {[
              {
                n: '01',
                t: 'Testnet, Year 1.',
                b: 'Arbitrum Sepolia and Robinhood Chain. Nothing here has economic value yet.',
              },
              {
                n: '02',
                t: 'Upgradeable contracts.',
                b: 'UUPS behind a 48-hour timelock, today a founder key, production is a 3-of-5 multisig.',
              },
              {
                n: '03',
                t: 'Some venues are mocked or relayed.',
                b: 'Where the real upstream isn’t on testnet. Each is named with its mechanism on /docs/honesty.',
              },
              {
                n: '04',
                t: 'Trade-fill on a new venue is timelock-gated.',
                b: 'Enabling a live fill needs a scheduled 48-hour batch. The gate is by design.',
              },
            ].map((l) => (
              <div className="pitch-limit-card" key={l.n}>
                <span className="pitch-limit-num">{l.n}</span>
                <h3 className="pitch-limit-title">{l.t}</h3>
                <p className="pitch-limit-body">{l.b}</p>
              </div>
            ))}
          </div>
          <p className="pitch-body pitch-muted pitch-aside">
            None of these change the wedge. They are the honest state of a Year-1 testnet build, and
            disclosing them is part of the trust argument, not a footnote to it.
          </p>
        </section>

        {/* ===== XI · WHAT'S NEXT ============================= */}
        <section className="pitch-slide" id="next">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">XI</span>
            <span className="pitch-section-label">WHAT&apos;S NEXT</span>
          </div>
          <h2 className="pitch-h2">
            The wedge is structural. The proof is that it <em>already runs.</em>
          </h2>
          <div className="pitch-next-grid">
            <div className="pitch-next-card">
              <span className="pitch-next-num">01</span>
              <p className="pitch-next-body">
                Flip the deployer-key timelock owner to the <strong>3-of-5 multisig.</strong>
              </p>
            </div>
            <div className="pitch-next-card">
              <span className="pitch-next-num">02</span>
              <p className="pitch-next-body">
                Open the <strong>public app</strong> at a hosted URL, it already reads the live
                contracts.
              </p>
            </div>
            <div className="pitch-next-card pitch-next-card-dark">
              <span className="pitch-next-num pitch-next-num-accent">03</span>
              <p className="pitch-next-body">
                Year-2 <strong>mainnet</strong>, with the most critical contracts locked.
              </p>
            </div>
          </div>
        </section>

        {/* ===== XII · THE FOUNDER ============================ */}
        <section className="pitch-slide" id="founder">
          <div className="pitch-eyebrow-line">
            <span className="pitch-numeral">XII</span>
            <span className="pitch-section-label">THE FOUNDER</span>
          </div>
          <h2 className="pitch-h2 pitch-founder-name">Pratik</h2>
          <p className="pitch-founder-meta">
            Master&apos;s in blockchain · India · Author of <em>The Blockchain Path</em>
          </p>
          <ul className="pitch-founder-list">
            <li className="pitch-founder-item">Hosted offline Web3 events at two universities.</li>
            <li className="pitch-founder-item">Contributed to multiple Web3 products.</li>
            <li className="pitch-founder-item">
              Product, marketing, and community experience.
            </li>
          </ul>
        </section>

        {/* ===== CLOSING ===================================== */}
        <section className="pitch-slide pitch-closing" id="closing">
          <div className="pitch-title-top">
            <span className="pitch-eyebrow">ATRIUM LABS LTD. · 2026</span>
            <span className="pitch-pill">
              <span className="pitch-pill-dot" />
              TESTNET · LIVE
            </span>
          </div>
          <div className="pitch-title-body">
            <div className="pitch-wordmark">Atrium</div>
            <span className="pitch-wordmark-rule" />
            <h2 className="pitch-closing-h2">
              The wedge is durable because it is structural. The proof is that it already runs.
            </h2>
            <div className="pitch-closing-cta">
              <Link href="/app" className="pitch-btn-primary">
                Open the testnet ↗
              </Link>
              <Link href="/verify" className="pitch-btn-ghost">
                Verify every claim
              </Link>
            </div>
          </div>
          <div className="pitch-title-foot">
            <span className="pitch-title-chain">One vault.</span>
            <span className="pitch-title-chain">One margin number.</span>
            <span className="pitch-title-chain">Every venue.</span>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
