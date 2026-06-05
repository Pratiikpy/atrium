'use client';

/**
 * Atrium investor-brief slide deck (judge-facing, /pitch).
 *
 * Rebuilt 2026-06-05 from the founder's standalone HTML deck (a compiled
 * bundler export with fabricated "7/8 venues", em-dashes, and no real proof).
 * This recreation keeps the deck's design + narrative but uses ONLY real,
 * verifiable data: the deployed + verified contract addresses, the on-chain
 * money-path tx hashes, the real 768-test count, and the honest 7-venue scope.
 * No em-dashes, no invented numbers.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import './pitch.css';

const ARB_ADDR = 'https://sepolia.arbiscan.io/address/';
const ARB_TX = 'https://sepolia.arbiscan.io/tx/';

const NAV: { n: string; label: string }[] = [
  { n: '·', label: 'Atrium' },
  { n: 'I', label: 'The problem' },
  { n: 'II', label: 'The insight' },
  { n: 'III', label: 'Worked example' },
  { n: 'IV', label: 'The moat' },
  { n: 'V', label: 'The architecture' },
  { n: 'VI', label: 'Why Stylus' },
  { n: 'VII', label: 'The proof' },
  { n: 'VIII', label: 'Who it is for' },
  { n: 'IX', label: 'The wedge' },
  { n: 'X', label: 'The founder' },
];

const TOTAL = NAV.length;

export function PitchDeck() {
  const [i, setI] = useState(0);
  const go = useCallback((n: number) => setI((p) => Math.max(0, Math.min(TOTAL - 1, n))), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(i - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(TOTAL - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, go]);

  return (
    <div className="deck deck-dark">
      <nav className="deck-rail" aria-label="Slides">
        {NAV.map((s, idx) => (
          <button
            key={s.label}
            type="button"
            className={`deck-rail-item ${idx === i ? 'is-active' : ''}`}
            onClick={() => go(idx)}
            aria-current={idx === i ? 'true' : undefined}
          >
            <span className="deck-rail-n">{s.n}</span>
            <span className="deck-rail-l">{s.label}</span>
          </button>
        ))}
      </nav>

      <main id="main-content" className="deck-stage">
        <header className="deck-top">
          <span className="deck-kicker">ATRIUM LABS · INVESTOR BRIEF</span>
          <span className="deck-livepill">
            <span className="deck-dot" /> TESTNET · LIVE
          </span>
        </header>

        <section className="deck-slide" aria-live="polite">
          <Slide index={i} />
        </section>

        <footer className="deck-foot">
          <span className="deck-foot-mark">Atrium</span>
          <span className="deck-foot-sec">
            {NAV[i].label.toUpperCase()} · {String(i).padStart(2, '0')}
          </span>
          <span className="deck-foot-controls">
            <button type="button" className="deck-arrow" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous">
              ‹
            </button>
            <span className="deck-count">
              {i + 1} / {TOTAL}
            </span>
            <button type="button" className="deck-arrow" onClick={() => go(i + 1)} disabled={i === TOTAL - 1} aria-label="Next">
              ›
            </button>
          </span>
        </footer>
      </main>
    </div>
  );
}

function Slide({ index }: { index: number }) {
  switch (index) {
    case 0:
      return <Title />;
    case 1:
      return <Problem />;
    case 2:
      return <Insight />;
    case 3:
      return <Worked />;
    case 4:
      return <Moat />;
    case 5:
      return <Architecture />;
    case 6:
      return <Stylus />;
    case 7:
      return <Proof />;
    case 8:
      return <Personas />;
    case 9:
      return <Wedge />;
    case 10:
      return <Founder />;
    default:
      return null;
  }
}

/* ── Slide 10 · The founder ──────────────────────────────────── */
function Founder() {
  return (
    <div className="dk-grid2 dk-founder">
      <div>
        <SectionMark roman="X" label="The founder" />
        <h2 className="dk-h2 serif-i">Pratik</h2>
        <p className="dk-body">Hosted offline Web3 events at two universities. Contributed to multiple Web3 products.</p>
        <p className="dk-body dk-muted">
          The wedge is durable because it is structural, not a feature. The proof is that it already runs, end to end, on
          testnet today.
        </p>
      </div>
      <figure className="dk-founder-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/assets/founder.jpg" alt="Pratik presenting Atrium" loading="eager" />
        <figcaption>Speaking on Web3 at a college event I hosted</figcaption>
      </figure>
    </div>
  );
}

/* ── Slide 0 · Title ─────────────────────────────────────────── */
function Title() {
  return (
    <div className="dk-title">
      <div className="dk-title-mark serif-i">Atrium</div>
      <div className="dk-rule" />
      <h1 className="dk-h1">Cross-venue portfolio margin for the EVM.</h1>
      <p className="dk-sub">
        One wallet posts collateral once and trades across multiple on-chain venues with a single margin number.
      </p>
      <div className="dk-title-meta">
        <span>
          <b>Arbitrum Sepolia</b> · chain 421614
        </span>
        <span>
          <b>Robinhood Chain</b> testnet · chain 46630
        </span>
        <span className="dk-title-meta-r">Deployed · verified · 2026</span>
      </div>
    </div>
  );
}

/* ── Slide 1 · The problem ───────────────────────────────────── */
function Problem() {
  return (
    <div className="dk-grid2">
      <div>
        <SectionMark roman="I" label="The problem" />
        <h2 className="dk-h2">Run positions on more than one venue, and your capital splits into silos.</h2>
        <p className="dk-body">
          A long perp on one venue and a hedge or yield position on another sit as two locked balances, even though the
          net risk is far smaller than the sum. Most of that capital does nothing.
        </p>
        <p className="dk-body dk-muted">
          There is no neutral place to net that risk. Every venue can only cross-margin positions held inside its own
          walls, because the venue on the other side is a competitor.
        </p>
      </div>
      <div className="dk-locks">
        <div className="dk-lock">
          <span className="dk-lock-k">VENUE A · PERP</span>
          <span className="dk-lock-v">$100,000</span>
          <span className="dk-lock-tag">LOCKED</span>
        </div>
        <div className="dk-lock">
          <span className="dk-lock-k">VENUE B · T-BILLS</span>
          <span className="dk-lock-v">$100,000</span>
          <span className="dk-lock-tag">LOCKED</span>
        </div>
        <div className="dk-lock dk-lock-net">
          <span className="dk-lock-k">NET RISK</span>
          <span className="dk-lock-v dk-pos">far below the sum</span>
        </div>
      </div>
    </div>
  );
}

/* ── Slide 2 · The insight ───────────────────────────────────── */
function Insight() {
  return (
    <div className="dk-grid2">
      <div>
        <SectionMark roman="II" label="The insight" />
        <h2 className="dk-h2">One neutral vault. One portfolio-margin number across every venue.</h2>
        <p className="dk-body">
          Put the collateral in one non-custodial vault and price net exposure with a single number. The same deposit
          then backs a perp on one venue, a tokenized T-bill on another, and a yield position on a third, at the same
          time. One balance, doing several jobs.
        </p>
        <p className="dk-body dk-muted">
          This is what a TradFi prime broker does for institutions, except Atrium does it on-chain, non-custodially, and
          with no minimums.
        </p>
      </div>
      <div className="dk-deposit">
        <div className="dk-deposit-head">
          <span className="dk-lock-k">ONE DEPOSIT</span>
          <span className="dk-deposit-v">$100,000</span>
        </div>
        {['ETH perp · Venue A', 'Tokenized T-bills · Venue B', 'Yield position · Venue C'].map((r) => (
          <div className="dk-deposit-row" key={r}>
            <span>{r}</span>
            <span className="dk-pos">BACKED</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Slide 3 · Worked example ────────────────────────────────── */
function Worked() {
  return (
    <div>
      <SectionMark roman="III" label="The worked example" />
      <h2 className="dk-h2">$100K, a long ETH perp, and T-bills for carry.</h2>
      <div className="dk-cmp2">
        <div className="dk-cmp-card">
          <span className="dk-cmp-tag">WITHOUT UNIFIED MARGIN · TWO SILOS</span>
          <p className="dk-body">
            The $100K of T-bills earns yield but does nothing for the perp. To open it, the trader posts its initial
            margin as a separate idle balance.
          </p>
          <div className="dk-cmp-stat">
            <span className="dk-cmp-stat-l">Capital working</span>
            <span className="dk-cmp-stat-v">~50%</span>
          </div>
        </div>
        <div className="dk-cmp-card dk-cmp-card-self">
          <span className="dk-cmp-tag">WITH ATRIUM · ONE VAULT</span>
          <p className="dk-body">
            The $100K goes into the Coffer vault once. It earns the T-bill yield and counts as collateral. Plinth charges
            only the perp's initial margin and leaves the rest as buying power.
          </p>
          <div className="dk-cmp-stat">
            <span className="dk-cmp-stat-l">Margin freed on a canonical hedge</span>
            <span className="dk-cmp-stat-v dk-pos">~51%</span>
          </div>
        </div>
      </div>
      <p className="dk-aside">
        Illustrative scale, not a measured reading. The live number is computed by Plinth on{' '}
        <Link href="/app/trade" className="dk-link">
          /app/trade
        </Link>
        ; the ~51% saving is locked by a passing unit test with a 40 to 70% guardrail band.
      </p>
    </div>
  );
}

/* ── Slide 4 · The moat ──────────────────────────────────────── */
function Moat() {
  const pillars = [
    { name: 'Coffer', body: 'holds the collateral, so no venue extends credit to another.' },
    { name: 'Plinth', body: 'computes one portfolio-wide SPAN number, owned by neither venue.' },
    { name: 'Portico', body: 'lets each venue pull collateral only within a per-block cap, never freely.' },
  ];
  return (
    <div className="dk-grid2">
      <div>
        <SectionMark roman="IV" label="The moat" />
        <h2 className="dk-h2">A venue cannot be neutral to itself.</h2>
        <p className="dk-body">
          To net your risk against a position on a competitor's venue, a venue would have to extend margin credit on a
          rival's book and trust the rival's liquidation engine in real time.
        </p>
        <p className="dk-body dk-muted">
          That is commercially adversarial and technically fragile. No venue will do it. The same reason prime brokerage
          exists as a separate entity in TradFi, not as a feature of one exchange.
        </p>
      </div>
      <div className="dk-pillars">
        {pillars.map((p) => (
          <div className="dk-pillar" key={p.name}>
            <span className="dk-pillar-n serif-i">{p.name}</span>
            <span className="dk-pillar-b">{p.body}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Slide 5 · The architecture ──────────────────────────────── */
const CORE = [
  { name: 'Coffer', lang: 'STYLUS', blurb: 'ERC-4626 vault. Holds collateral once; orchestrators pull up to a per-block cap.', addr: '0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3' },
  { name: 'Plinth', lang: 'STYLUS', blurb: 'SPAN margin engine. One buying-power number across venues, netting correlated risk.', addr: '0xd86f579ec880eaab27dfa698ae056d1893ec7553' },
  { name: 'Sigil', lang: 'STYLUS', blurb: 'EIP-712 agent mandates. Capped, time-boxed delegations with a one-tap kill switch.', addr: '0xdba97d39ff790e69c3526bb0c0b99a38f686d6d9' },
  { name: 'Vigil', lang: 'STYLUS', blurb: 'Liquidation engine. Soft-liquidates an account before it goes underwater.', addr: '0x5ccd3422f430f6d034ff46715b41509de9d0deed' },
  { name: 'AtriumRouter', lang: 'SOLIDITY', blurb: 'Opens a position across margin, vault, and adapter in a single transaction.', addr: '0xF593e012196BDe8A58Ccdbf685f7A74fD3bD35e0' },
  { name: 'Lantern', lang: 'SOLIDITY', blurb: 'Publishes a signed Merkle proof-of-reserves root every 10 minutes.', addr: '0xF0B90b94C0B8a52c545768bFf06a3932c67d5888' },
];
function Architecture() {
  return (
    <div>
      <SectionMark roman="V" label="The architecture" />
      <h2 className="dk-h2">A neutral core in Rust, with adapters in Solidity.</h2>
      <div className="dk-arch">
        {CORE.map((c) => (
          <a className="dk-arch-card" key={c.name} href={`${ARB_ADDR}${c.addr}`} target="_blank" rel="noreferrer noopener">
            <span className="dk-arch-head">
              <span className="dk-arch-name serif-i">{c.name}</span>
              <span className={`dk-arch-lang lang-${c.lang.toLowerCase()}`}>{c.lang}</span>
            </span>
            <span className="dk-arch-blurb">{c.blurb}</span>
            <span className="dk-arch-addr">{c.addr.slice(0, 10)}…{c.addr.slice(-6)} ↗</span>
          </a>
        ))}
      </div>
      <p className="dk-aside">
        Seven venue adapters are in the launch scope (Aave Horizon operational today); nine adapter contracts are
        deployed and verified on Arbitrum Sepolia. Every address above is live; click to read the source.
      </p>
    </div>
  );
}

/* ── Slide 6 · Why Stylus ────────────────────────────────────── */
function Stylus() {
  return (
    <div className="dk-grid2">
      <div>
        <SectionMark roman="VI" label="Why Stylus" />
        <h2 className="dk-h2">Arbitrum Stylus makes the margin engine feasible on-chain.</h2>
        <p className="dk-body">
          A full SPAN scenario matrix over a multi-venue portfolio is heavy compute. In Solidity it would be prohibitively
          expensive per call. Atrium writes the compute-heavy core (Plinth, Vigil, Coffer, Sigil) in Rust, compiled to
          WASM and run natively on Arbitrum Stylus.
        </p>
        <p className="dk-body dk-muted">
          Adapters and the cross-chain bridge stay in Solidity, where the integration surface lives. Right tool, right
          layer.
        </p>
      </div>
      <div className="dk-bignum">
        <span className="dk-bignum-v">10-100&times;</span>
        <span className="dk-bignum-l">
          cheaper for compute-heavy operations than the EVM, per Arbitrum&rsquo;s Stylus benchmarks. That headroom is
          what makes a live, on-chain portfolio-margin engine possible at all.
        </span>
      </div>
    </div>
  );
}

/* ── Slide 7 · The proof ─────────────────────────────────────── */
const STATS = [
  { v: '768', l: 'frontend + library tests passing' },
  { v: '9', l: 'Kani proofs authored (CI lane Month 3)' },
  { v: '2', l: 'testnets, full stack deployed + verified' },
  { v: '7', l: 'venue adapters in scope (1 operational)' },
];
const HASHES = [
  { k: 'Withdraw from vault', h: '0x976e098cad97978b4d34f5a0ddc85f48e03f023937d9a678485b530c3d4addbf' },
  { k: 'Deposit (mobile)', h: '0x8c8d1f0ddf292bac321f0da5fe33115238ecfbe848ab56b1dee74a277b820347' },
];
function Proof() {
  return (
    <div>
      <SectionMark roman="VII" label="The proof" />
      <h2 className="dk-h2">Not a mockup. Deployed, wired, and verified on two testnets.</h2>
      <div className="dk-proof-stats">
        {STATS.map((s) => (
          <div className="dk-proof-stat" key={s.l}>
            <span className="dk-proof-v">{s.v}</span>
            <span className="dk-proof-l">{s.l}</span>
          </div>
        ))}
      </div>
      <div className="dk-proof-hashes">
        <div className="dk-proof-hblock">
          <span className="dk-lock-k">VERIFIED ON ARBISCAN</span>
          {HASHES.map((x) => (
            <a className="dk-proof-hrow" key={x.k} href={`${ARB_TX}${x.h}`} target="_blank" rel="noreferrer noopener">
              <span className="dk-proof-hname">{x.k}</span>
              <span className="dk-proof-hhash">
                {x.h.slice(0, 10)}…{x.h.slice(-4)} ↗
              </span>
            </a>
          ))}
          <Link className="dk-proof-hrow" href="/lantern">
            <span className="dk-proof-hname">Proof-of-reserves root</span>
            <span className="dk-proof-hhash">0x4b9e…ef1f0 ↗</span>
          </Link>
        </div>
        <p className="dk-aside">
          Don&rsquo;t take it on faith. Read any contract on Arbiscan, replay any transaction, or verify your own balance
          against the on-chain Merkle root on{' '}
          <Link href="/lantern" className="dk-link">
            /lantern
          </Link>
          . The whole product is built so you never have to trust us.
        </p>
      </div>
    </div>
  );
}

/* ── Slide 8 · Who it is for ─────────────────────────────────── */
const PERSONAS = [
  { who: 'The hedged trader', what: 'Holds a perp on one venue and the hedge on another. Atrium nets the two into one margin number and frees the duplicated collateral.' },
  { who: 'The basis desk', what: 'Runs spot, futures, and carry across venues. One vault backs all three legs at once instead of three idle balances.' },
  { who: 'The AI agent', what: 'Trades under a capped, time-boxed Sigil mandate with a one-tap kill switch. First-class, non-custodial, and revocable.' },
];
function Personas() {
  return (
    <div>
      <SectionMark roman="VIII" label="Who it is for" />
      <h2 className="dk-h2">Three traders, one structural fix.</h2>
      <div className="dk-personas">
        {PERSONAS.map((p) => (
          <div className="dk-persona" key={p.who}>
            <span className="dk-persona-who serif-i">{p.who}</span>
            <span className="dk-persona-what">{p.what}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Slide 9 · The wedge (comparison) ────────────────────────── */
const CMP_COLS = ['CROSS-VENUE NETTING', 'NON-CUSTODIAL', 'ON-CHAIN POR', 'NO KYC GATE'] as const;
const CMP_ROWS: readonly [string, string, string, string, string][] = [
  ['Single-venue perp DEX', 'Within one venue', 'Yes', 'Partial', 'Yes'],
  ['CEX portfolio margin', 'One platform only', 'No', 'No', 'No'],
  ['TradFi prime broker', 'Yes, centralized', 'No', 'No', 'No, high minimums'],
];
function Wedge() {
  return (
    <div>
      <SectionMark roman="IX" label="The wedge" />
      <h2 className="dk-h2">Many products cross-margin inside their own walls. None net across them.</h2>
      <div className="dk-cmp-table" role="table">
        <div className="dk-cmp-head" role="row">
          <span role="columnheader" />
          {CMP_COLS.map((c) => (
            <span role="columnheader" key={c}>
              {c}
            </span>
          ))}
        </div>
        {CMP_ROWS.map((row) => (
          <div className="dk-cmp-row" role="row" key={row[0]}>
            <span className="dk-cmp-name" role="cell">
              {row[0]}
            </span>
            {CMP_COLS.map((label, idx) => (
              <span className="dk-cmp-cell" role="cell" data-label={label} key={label}>
                {row[idx + 1]}
              </span>
            ))}
          </div>
        ))}
        <div className="dk-cmp-row dk-cmp-row-self" role="row">
          <span className="dk-cmp-name dk-cmp-self-name" role="cell">
            Atrium
          </span>
          {['Across venues', 'Yes', 'Signed Merkle', 'No gate'].map((v, idx) => (
            <span className="dk-cmp-cell dk-pos" role="cell" data-label={CMP_COLS[idx]} key={CMP_COLS[idx]}>
              {v}
            </span>
          ))}
        </div>
      </div>
      <p className="dk-aside">
        The wedge is structural, not a feature race. The proof is that it already runs:{' '}
        <Link href="/architecture" className="dk-link">
          read the live system
        </Link>
        .
      </p>
    </div>
  );
}

/* ── shared ──────────────────────────────────────────────────── */
function SectionMark({ roman, label, tone }: { roman: string; label: string; tone?: 'light' }) {
  return (
    <div className={`dk-mark ${tone === 'light' ? 'dk-mark-light' : ''}`}>
      <span className="dk-mark-roman serif-i">{roman}</span>
      <span className="dk-mark-label">{label.toUpperCase()}</span>
    </div>
  );
}
