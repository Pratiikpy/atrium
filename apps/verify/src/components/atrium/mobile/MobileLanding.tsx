'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Mobile landing (Lovable port) — 1:1 from Mobile_Landing.html.
 * All styling lives in apps/verify/src/styles/atrium-mobile.css under
 * the `.atrium-m-root` scope.
 */
export function MobileLanding() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 8);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="atrium-m-root">
      <div className="page">
        <nav className={`topnav${scrolled ? " scrolled" : ""}`}>
          <Link href="/" className="mark">Atrium</Link>
          <Link href="/app" className="cta">Open testnet ↗</Link>
        </nav>

        <div className="scroll" ref={scrollRef}>
          {/* HERO */}
          <section className="hero">
            <div className="hero-grid" />
            <div className="hero-glow" />

            <div className="hero-eyebrow">
              <span className="rule" />
              <span>Unified margin · EVM · testnet</span>
            </div>

            <h1>
              One wallet. Every venue.<br />
              One <em>buying-power</em><br />
              number.
            </h1>

            <p className="sub">
              Atrium is unified margin prime brokerage for the EVM.
              Post collateral once. Trade across seven onchain venues
              against one figure, computed onchain by Plinth.
            </p>

            <div className="hero-cta">
              <Link href="/app" className="primary" style={{ textAlign: "center", textDecoration: "none" }}>
                Open testnet ↗
              </Link>
              <a href="#product" className="ghost">See how it works</a>
            </div>

            <div className="hero-trust">
              <span><span className="td" /> Arbitrum Sepolia</span>
              <span><span className="td" /> Chainlink CCIP</span>
              <span><span className="td" /> ERC-8004</span>
            </div>
          </section>

          {/* IMPLUVIUM */}
          <div className="impluvium">
            <div className="label-row">
              <div className="left">
                <div><strong>Fig. 01</strong> · Capital convergence</div>
                <div style={{ marginTop: 3 }}>Plan view · live testnet</div>
              </div>
              <div className="right">
                <div><strong>Sheet 02 / 08</strong></div>
                <div style={{ marginTop: 3 }}>Atrium Labs · 2026</div>
              </div>
            </div>

            <div className="pool">
              <div className="l">Pool · unified margin</div>
              <div className="v">$12.37M</div>
              <div className="s">Buying power · 3.0× · LIVE</div>
            </div>

            <div className="venues">
              <Venue name="HL-HIP3"  sub="Tokenized perps" amt="$1.25M" pct={100} accent />
              <Venue name="AAVE-V3"  sub="RWA · USTB"      amt="$892K"  pct={71} />
              <Venue name="TRADE"    sub="RFQ · dark pool" amt="$401K"  pct={32} />
              <Venue name="PENDLE"   sub="PT · stETH"      amt="$320K"  pct={26} />
              <Venue name="HL-HIP4"  sub="Permissioned"    amt="$483K"  pct={39} />
              <Venue name="CURVE"    sub="3pool LP"        amt="$186K"  pct={15} />
            </div>

            <div className="scale">
              <span>0×</span><span>2×</span><span>4×</span><span>6×</span><span>10×</span>
            </div>
          </div>

          {/* Plinth */}
          <section className="section" id="product">
            <div className="section-num"><span className="accent">01</span> · The product</div>
            <h2>Capital efficiency, <em>mathematically.</em></h2>
            <p className="lede">
              Plinth, the Stylus margin engine, reads collateral across every venue
              you hold positions in and returns one cross-product number per block.
            </p>

            <div className="feat">
              <div className="feat-eyebrow">Plinth · Stylus</div>
              <div className="t">SPAN-style portfolio margin, <em>onchain.</em></div>
              <div className="d">
                The same SPAN routine costs 10–100× more gas in equivalent Solidity.
                That is why no other onchain product has shipped cross-product margin.
              </div>

              <div className="mock">
                <div className="mock-head">
                  <span className="l">Buying power</span>
                  <span className="pill">live</span>
                </div>
                <div className="big">$12,374,820</div>
                <div className="mock-row"><span className="l">Collateral</span><span className="v">$4.13M</span></div>
                <div className="mock-row"><span className="l">Margin · ratio</span><span className="v">3.0×</span></div>
                <div className="mock-row"><span className="l">Utilisation</span><span className="v">38.4%</span></div>
              </div>

              <div className="feat-meta">
                <div className="m"><div className="l">Update freq</div><div className="v">Every block</div></div>
                <div className="m"><div className="l">Method</div><div className="v">SPAN · cross-product</div></div>
              </div>
            </div>
          </section>

          {/* Aqueduct */}
          <section className="section">
            <div className="section-num"><span className="accent">02</span> · Cross-chain</div>
            <h2>Move collateral in <em>one transaction.</em></h2>
            <p className="lede">
              Aqueduct routes through Chainlink CCIP. Collateral posted on one chain
              becomes Plinth credit on another in under ten seconds.
            </p>

            <div className="feat">
              <div className="feat-eyebrow">Aqueduct · CCIP</div>
              <div className="t">No bridges. <em>One signature.</em></div>
              <div className="d">
                Atrium never custodies funds. The CCIP message is the bridge —
                your collateral posts on arrival, credit appears in Plinth.
              </div>

              <div className="move-mock">
                <div className="ends">
                  <div className="end">
                    <div className="l">From</div>
                    <div className="n">arb-sepolia</div>
                  </div>
                  <div className="arrow">→</div>
                  <div className="end" style={{ textAlign: "right" }}>
                    <div className="l">To</div>
                    <div className="n">eth-sepolia</div>
                  </div>
                </div>
                <div className="amt">50,000<span className="u">USDC</span></div>
                <div className="meta">≈ 8.4s · $0 fee · testnet</div>
              </div>
            </div>
          </section>

          {/* Sigil */}
          <section className="section">
            <div className="section-num"><span className="accent">03</span> · Agents</div>
            <h2>Agents trade with <em>bounded mandates.</em></h2>
            <p className="lede">
              You sign one Intent Sigil — an EIP-712 mandate authorising one agent,
              one strategy, one window, one cap. Master key stays cold.
            </p>

            <div className="feat">
              <div className="feat-eyebrow">Sigil · ERC-8004</div>
              <div className="t">Session keys, <em>never master keys.</em></div>

              <div className="sigil-mock">
                <div className="step">
                  <span className="m">✓</span>
                  <div className="desc">Sigma signs Intent Sigil
                    <span className="v">intent.sigil · delphi · $50k · 7d</span>
                  </div>
                </div>
                <div className="step">
                  <span className="m">✓</span>
                  <div className="desc">Postern issues session key
                    <span className="v">0x9f3a…b71d · cap $50k · 7d</span>
                  </div>
                </div>
                <div className="step">
                  <span className="x">▸</span>
                  <div className="desc">Agent emits Action Sigil
                    <span className="v">portico.hl.openLong(WETH, 4×)</span>
                  </div>
                </div>
                <div className="step">
                  <span style={{ color: "var(--muted)" }}>○</span>
                  <div className="desc" style={{ color: "var(--muted)" }}>Vigil checks mandate</div>
                </div>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section className="stats-band">
            <div className="head">Testnet · live</div>
            <div className="stats-grid">
              <Stat l="Live TVL"            v="$4.13M" s="+ 41.2% · 30d" />
              <Stat l="Registered agents"   v="37"     s="8 with open positions" />
              <Stat l="Codex queries · 24h" v="42K"    s="x402 · onchain" />
              <Stat l="Venues live"         v="7 / 8"  s="RH-Chain · pending" />
            </div>
          </section>

          {/* Subsystems */}
          <section className="section">
            <div className="section-num"><span className="accent">04</span> · The system</div>
            <h2>Eighteen named pieces. <em>One building.</em></h2>
            <p className="lede">
              Plinth carries weight. Postern is the side gate. Aqueduct moves water.
              Each subsystem owns its room. Thirteen ship at launch.
            </p>

            <div className="ss-grid">
              {SS.map((s) => (
                <div className="ss" key={s.num}>
                  <div className="num">{s.num}</div>
                  <div className="name">{s.name}</div>
                  <div className="role">{s.role}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Trust */}
          <section className="trust-strip">
            <div className="head">Built with</div>
            <div className="trust-grid">
              {["Pendle", "Variational", "Horizen", "IOSG", "Hyperliquid", "Aave Labs"].map((t) => (
                <div className="trust-logo" key={t}>{t}</div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="cta-band">
            <div className="cap" style={{ color: "var(--accent)" }}>Testnet · now open</div>
            <h3>Step inside the <em>atrium.</em></h3>
            <p>
              Faucet drops $10K test USDC + $5K rAAPL. Three minutes from
              passkey login to first cross-margin trade.
            </p>
            <div className="actions">
              <Link href="/app" className="primary" style={{ textAlign: "center", textDecoration: "none" }}>
                Open testnet ↗
              </Link>
              <Link href="/docs" className="ghost">Documentation</Link>
            </div>
          </section>

          {/* Footer */}
          <footer>
            <div className="foot-mark">Atrium</div>
            <div className="foot-sub">Unified margin prime brokerage<br />for the EVM.</div>

            <div className="foot-cols">
              <div className="foot-col">
                <div className="head">Product</div>
                <Link href="/app">Portfolio</Link>
                <Link href="/app">Trade</Link>
                <Link href="/app">Cross-chain</Link>
                <Link href="/app">Agents</Link>
                <Link href="/lantern">Reserves</Link>
              </div>
              <div className="foot-col">
                <div className="head">Company</div>
                <Link href="/docs">Documentation</Link>
                <Link href="/brand">Brand kit</Link>
                <Link href="/verify">Verifier</Link>
                <Link href="/lantern">Lantern</Link>
                <a href="#">Contact</a>
              </div>
            </div>

            <div className="foot-base">
              <span>© 2026 Atrium Labs Ltd.</span>
              <span><span className="dot" /> testnet · all systems normal</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Venue({ name, sub, amt, pct, accent }: { name: string; sub: string; amt: string; pct: number; accent?: boolean }) {
  return (
    <div className="venue">
      <div className="name">{name}</div>
      <div className="sub">{sub}</div>
      <div className="amt">{amt}</div>
      <div className="bar">
        <span style={{ width: `${pct}%`, background: accent ? "var(--accent)" : undefined }} />
      </div>
    </div>
  );
}

function Stat({ l, v, s }: { l: string; v: string; s: string }) {
  return (
    <div className="stat">
      <div className="l">{l}</div>
      <div className="v">{v}</div>
      <div className="s">{s}</div>
    </div>
  );
}

const SS = [
  { num: "01", name: "Plinth",   role: "Margin engine" },
  { num: "02", name: "Vigil",    role: "Liquidations" },
  { num: "04", name: "Portico",  role: "Venue framework" },
  { num: "05", name: "Aqueduct", role: "Cross-chain" },
  { num: "06", name: "Sigil",    role: "Agent credit" },
  { num: "07", name: "Rostrum",  role: "Marketplace" },
  { num: "11", name: "Lantern",  role: "Proof-of-reserves" },
  { num: "18", name: "Postern",  role: "Wallet" },
];
