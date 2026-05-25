// Atrium — Apple-like Web3 product page.
// Light dominant, occasional dark, the impluvium kept as the centerpiece.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* =====================================================================
 * Wordmark — Mercury/Stripe approach: no glyph, just the type.
 * "Atrium" in tuned italic Instrument Serif.
 * ===================================================================== */

const Wordmark = ({ size = 22 }) => (
  <span className="atrium-mark" style={{ fontSize: size, lineHeight: 1, letterSpacing: "-0.014em" }}>
    Atrium
  </span>
);

const Favicon = ({ size = 22 }) => (
  // Favicon-scale lockup — italic A in a hairline frame
  <span style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: size, height: size,
    fontFamily: "var(--serif)", fontStyle: "italic", fontSize: size * 0.66,
    lineHeight: 1, letterSpacing: "-0.04em",
    color: "var(--ink)"
  }}>
    A
  </span>
);

/* =====================================================================
 * Tweaks defaults
 * ===================================================================== */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "#7E2A20",
  "numStyle": "mono",
  "showFlow": true,
  "leverage": 3.0
}/*EDITMODE-END*/;

/* =====================================================================
 * Data
 * ===================================================================== */

const VENUES = [
  { id: "hl3", name: "Hyperliquid HIP-3", short: "HL-HIP3", type: "Tokenized-stock perps", collateral: 1247820, asset: "USDC · WETH",   chain: "Arbitrum Sepolia" },
  { id: "hl4", name: "Hyperliquid HIP-4", short: "HL-HIP4", type: "Permissioned perps",   collateral: 483160,  asset: "USDC",         chain: "Arbitrum Sepolia" },
  { id: "aav", name: "Aave Horizon",      short: "AAVE-V3", type: "RWA collateral",       collateral: 892440,  asset: "aUSDC · USTB", chain: "Arbitrum Sepolia" },
  { id: "pen", name: "Pendle V2",         short: "PENDLE",  type: "Fixed-yield · PT",     collateral: 320500,  asset: "PT-stETH",     chain: "Arbitrum Sepolia" },
  { id: "cur", name: "Curve",             short: "CURVE",   type: "Stableswap LP",        collateral: 186720,  asset: "3pool LP",     chain: "Ethereum Sepolia" },
  { id: "trd", name: "Trade.xyz",         short: "TRADE",   type: "RFQ · dark pool",      collateral: 401890,  asset: "WETH · WBTC",  chain: "Arbitrum Sepolia" },
  { id: "pmk", name: "Polymarket",        short: "PMK",     type: "Prediction · CTF",     collateral:  58200,  asset: "USDC",         chain: "via Aqueduct" },
  { id: "rhc", name: "RH-Chain",          short: "RH-NTV",  type: "Native spot · pending", collateral:     0,  asset: "—",            chain: "Robinhood testnet", pending: true }
];

const SUBSYSTEMS = [
  { num: "01", name: "Plinth",   sub: "Margin engine",        stack: "Stylus · Rust",       phase: "P1" },
  { num: "02", name: "Vigil",    sub: "Liquidation engine",   stack: "Stylus · Rust",       phase: "P1" },
  { num: "03", name: "Stoa",     sub: "Options pricing",      stack: "Stylus · Rust",       phase: "P2" },
  { num: "04", name: "Portico",  sub: "Venue framework",      stack: "Solidity · OZ",       phase: "P1" },
  { num: "05", name: "Aqueduct", sub: "Cross-chain bridge",   stack: "Solidity · CCIP",     phase: "P1" },
  { num: "06", name: "Sigil",    sub: "Agent credit",         stack: "Solidity · ERC-8004", phase: "P1" },
  { num: "07", name: "Rostrum",  sub: "Agent marketplace",    stack: "Solidity · Indexer",  phase: "P1" },
  { num: "08", name: "Codex",    sub: "Paid agent APIs",      stack: "Node · x402",         phase: "P1" },
  { num: "09", name: "Scribe",   sub: "Indexer",              stack: "The Graph",           phase: "P1" },
  { num: "10", name: "Archive",  sub: "Off-chain risk lab",   stack: "Python",              phase: "P1" },
  { num: "11", name: "Lantern",  sub: "Proof-of-reserves",    stack: "Vercel · Merkle",     phase: "P1" },
  { num: "12", name: "Coffer",   sub: "ERC-4626 vaults",      stack: "Stylus · OZ",         phase: "P1" },
  { num: "13", name: "Edict",    sub: "Jurisdiction tiers",   stack: "Solidity · Sumsub",   phase: "P1" },
  { num: "14", name: "Tablet",   sub: "Tax reporting",        stack: "Node",                phase: "P1" },
  { num: "15", name: "Praetor",  sub: "CLI · ops",            stack: "Rust · Foundry",      phase: "P1" },
  { num: "16", name: "Cohort",   sub: "Design partners",      stack: "BD · 5–8 firms",      phase: "P1" },
  { num: "17", name: "Curator",  sub: "Adapter grants",       stack: "ARB · $20–50K",       phase: "P1" },
  { num: "18", name: "Postern",  sub: "Wallet abstraction",   stack: "ERC-4337 · 7702",     phase: "P1" }
];

const PARTNERS = [
  "Pendle Labs", "Variational", "Horizen", "IOSG",
  "Robinhood Chain", "Hyperliquid", "Aave Labs", "Coinbase"
];

const fmtUSD = (n, { compact = false } = {}) => {
  if (compact) {
    if (Math.abs(n) >= 1e9) return "$" + (n/1e9).toFixed(2) + "B";
    if (Math.abs(n) >= 1e6) return "$" + (n/1e6).toFixed(2) + "M";
    if (Math.abs(n) >= 1e3) return "$" + (n/1e3).toFixed(1) + "K";
    return "$" + n.toFixed(0);
  }
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

/* =====================================================================
 * Nav
 * ===================================================================== */

const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [overDark, setOverDark] = useState(true);
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      const hero = document.getElementById("hero");
      if (hero) {
        const rect = hero.getBoundingClientRect();
        setOverDark(rect.bottom > 60);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={"nav" + (scrolled ? " scrolled" : "") + (overDark ? " over-dark" : "")}>
      <div className="nav-inner">
        <a href="#" className="nav-brand">
          <Wordmark size={22} />
        </a>
        <nav className="nav-links">
          <a href="#portfolio" className="nav-link">Product</a>
          <a href="#agents"    className="nav-link">Agents</a>
          <a href="#reserves"  className="nav-link">Reserves</a>
          <a href="#system"    className="nav-link">Subsystems</a>
          <a href="#docs"      className="nav-link">Docs</a>
        </nav>
        <div className="nav-right">
          <span className="pill"><span className="dot" /> testnet</span>
          <a href="Atrium App.html" className="btn">Open testnet <span className="arrow">↗</span></a>
        </div>
      </div>
    </header>
  );
};

/* =====================================================================
 * HERO — MONUMENTAL DARK IMPLUVIUM
 * The whole brand in a single screen: deep onyx, glowing pool,
 * architectural drawing chrome. The signature.
 * ===================================================================== */

const Hero = ({ leverage, setLeverage, showFlow }) => (
  <section id="hero" className="hero-monument">
    <BlueprintGrid />
    <Vignette />

    <div className="hero-monument-inner">
      <div className="hero-monument-top rise">
        <div className="hero-eyebrow-clean">
          <span className="hairline-rule" />
          <span className="pulse-amber" />
          <span className="eyebrow-text">Prime brokerage · Unified margin · Testnet</span>
          <span className="pulse-amber" />
          <span className="hairline-rule" />
        </div>
        <h1 className="hero-monument-h">
          One wallet. Every venue.<br/>
          <span className="hero-light">One buying-power number.</span>
        </h1>
      </div>

      <div className="hero-impluvium-wrap rise d2">
        <div className="impluvium-dark">
          <Impluvium leverage={leverage} setLeverage={setLeverage} showFlow={showFlow} />
        </div>
      </div>

      <div className="hero-monument-bot rise d3">
        <div className="hero-cta-dark">
          <a className="btn light" href="Atrium App.html">Open testnet <span className="arrow">↗</span></a>
          <a className="btn ghost-light" href="#portfolio">See the product →</a>
        </div>
        <div className="hero-trust-dark">
          <span><span className="td" /> Arbitrum Sepolia</span>
          <span><span className="td" /> Chainlink CCIP</span>
          <span><span className="td" /> ERC-8004</span>
          <span><span className="td" /> ERC-4337 · 7702</span>
        </div>
      </div>
    </div>
  </section>
);

const BlueprintGrid = () => (
  <svg className="hero-grid" aria-hidden="true" preserveAspectRatio="none">
    <defs>
      <pattern id="bp" patternUnits="userSpaceOnUse" width="48" height="48">
        <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.4" opacity="0.04" />
      </pattern>
      <pattern id="bpmajor" patternUnits="userSpaceOnUse" width="192" height="192">
        <path d="M 192 0 L 0 0 0 192" fill="none" stroke="white" strokeWidth="0.6" opacity="0.06" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bp)" />
    <rect width="100%" height="100%" fill="url(#bpmajor)" />
  </svg>
);

const Vignette = () => <div className="hero-vignette" aria-hidden="true" />;

/* =====================================================================
 * (impluvium previously had a dedicated section — now lives inside hero)
 * ===================================================================== */

const Impluvium = ({ leverage, setLeverage, showFlow }) => {
  const containerRef = useRef(null);
  const poolRef = useRef(null);
  const venueRefs = useRef({});
  const [paths, setPaths] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1600);
    return () => clearInterval(t);
  }, []);

  const liveVenues = useMemo(() => VENUES.map((v, i) => {
    const j = Math.sin((tick + i * 1.7) * 0.6) * (v.collateral * 0.004)
            + Math.cos(tick * 0.8 + i) * (v.collateral * 0.002);
    return { ...v, live: v.collateral + j };
  }), [tick]);

  const totalCollateral = liveVenues.reduce((s, v) => s + v.live, 0);
  const buyingPower = totalCollateral * leverage;
  const maxC = Math.max(...VENUES.map(v => v.collateral));

  const recompute = useCallback(() => {
    const c = containerRef.current, pool = poolRef.current;
    if (!c || !pool) return;
    const cBox = c.getBoundingClientRect();
    const pBox = pool.getBoundingClientRect();
    const px = pBox.left - cBox.left;
    const py = pBox.top - cBox.top;
    setPaths(VENUES.map(v => {
      const el = venueRefs.current[v.id];
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const isTop = b.top < pBox.top;
      const x1 = b.left + b.width/2 - cBox.left;
      const y1 = isTop ? b.bottom - cBox.top : b.top - cBox.top;
      const x2 = px + pBox.width/2;
      const y2 = isTop ? py : py + pBox.height;
      const midY = (y1 + y2) / 2;
      return { id: v.id, path: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`, isTop };
    }).filter(Boolean));
  }, []);

  useEffect(() => {
    recompute();
    const ro = new ResizeObserver(recompute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", recompute);
    return () => { ro.disconnect(); window.removeEventListener("resize", recompute); };
  }, [recompute]);

  const top = liveVenues.slice(0, 4), bot = liveVenues.slice(4);

  return (
    <div>
      <div className="draw-label">
        <div>
          <div className="mono cap">Fig. 01 · Capital convergence</div>
          <div className="mono cap muted" style={{ marginTop: 4 }}>
            Plan view · live testnet feed
          </div>
        </div>
        <div className="mono cap" style={{ textAlign: "right" }}>
          <div>Sheet 02 / 08</div>
          <div className="muted" style={{ marginTop: 4 }}>Atrium Labs · May 2026</div>
        </div>
      </div>

      <div ref={containerRef} className="impluvium">
        <div className="impluvium-row">
          {top.map(v => <VenueCard key={v.id} v={v} hovered={hovered}
            setHovered={setHovered} refSet={el => (venueRefs.current[v.id] = el)} maxC={maxC} />)}
        </div>

        <div className="impluvium-pool-row">
          <div ref={poolRef} className="pool">
            <PoolHatch />
            <div className="pool-corner top-left mono cap">Pool · Unified margin</div>
            <div className="pool-corner top-right mono cap">
              <span className="live-dot" /> Live
            </div>
            <div className="pool-center">
              <div className="num pool-figure">{fmtUSD(buyingPower)}</div>
              <div className="mono cap" style={{ marginTop: 12 }}>
                Buying power · {leverage.toFixed(1)}× portfolio margin
              </div>
            </div>
            <div className="pool-corner bot-left mono cap">
              Collateral <span className="num" style={{ marginLeft: 6, color: "var(--ink-soft)" }}>{fmtUSD(totalCollateral, { compact: true })}</span>
            </div>
            <div className="pool-corner bot-right mono cap">Plinth · margin ok</div>
          </div>
        </div>

        <div className="impluvium-row">
          {bot.map(v => <VenueCard key={v.id} v={v} hovered={hovered}
            setHovered={setHovered} refSet={el => (venueRefs.current[v.id] = el)} maxC={maxC} />)}
        </div>

        <svg className="impluvium-flow" width="100%" height="100%">
          {paths.map(p => {
            const isHover = hovered === p.id;
            return (
              <g key={p.id}>
                <path d={p.path} fill="none"
                      stroke={isHover ? "var(--accent)" : "var(--line)"}
                      strokeWidth={isHover ? 1.4 : 1}
                      style={{ transition: "stroke 160ms ease, stroke-width 160ms ease" }} />
                {showFlow && (
                  <path d={p.path} fill="none"
                        stroke={isHover ? "var(--accent)" : "var(--ink-soft)"}
                        strokeWidth={isHover ? 1.4 : 1}
                        strokeDasharray="2 8"
                        style={{
                          opacity: isHover ? 0.9 : 0.32,
                          animation: "flowDash 1.8s linear infinite",
                          animationDirection: p.isTop ? "normal" : "reverse"
                        }} />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="draw-footer">
        <div className="scale-rule mono cap">
          <div className="scale-line"><span /><span /><span /><span /><span /></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>0×</span><span>2×</span><span>4×</span><span>6×</span><span>8×</span><span>10×</span>
          </div>
        </div>
        <div className="leverage-control">
          <div className="mono cap muted">Portfolio margin</div>
          <input type="range" min="1" max="10" step="0.1"
                 value={leverage}
                 onChange={(e) => setLeverage(parseFloat(e.target.value))}
                 aria-label="Leverage" />
          <div className="num" style={{ minWidth: 60, textAlign: "right" }}>{leverage.toFixed(1)}×</div>
        </div>
      </div>
    </div>
  );
};

const VenueCard = ({ v, hovered, setHovered, refSet, maxC }) => {
  const isHover = hovered === v.id;
  const pct = (v.collateral / maxC) * 100;
  const share = (v.collateral / VENUES.reduce((s,x) => s + x.collateral, 0)) * 100;
  return (
    <div
      ref={refSet}
      onMouseEnter={() => setHovered(v.id)}
      onMouseLeave={() => setHovered(null)}
      className={"venue-card" + (isHover ? " hover" : "")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, letterSpacing: "-0.005em" }}>{v.name}</div>
        <div className="mono cap" style={{ fontSize: 9.5 }}>{v.short}</div>
      </div>
      <div className="mono cap" style={{ marginTop: 3, fontSize: 9.5 }}>{v.type}</div>
      <div className="num venue-num">{fmtUSD(v.live)}</div>
      <div className="venue-bar">
        <div style={{ width: pct + "%", background: isHover ? "var(--accent)" : "var(--ink)" }} />
      </div>
      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
        <span className="mono cap" style={{ fontSize: 9.5 }}>{v.asset}</span>
        <span className="mono cap" style={{ fontSize: 9.5 }}>{share.toFixed(1)}%</span>
      </div>
    </div>
  );
};

const PoolHatch = () => (
  <svg className="pool-hatch" width="100%" height="100%">
    <defs>
      <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#hatch)" />
  </svg>
);

/* =====================================================================
 * Reusable Feature section (Apple-style)
 * Centered title + sub + product mockup
 * ===================================================================== */

const Feature = ({ id, eyebrow, title, accent, sub, dark, children }) => (
  <section id={id} className={"feature" + (dark ? " dark" : "")}>
    <div className="container">
      <div className="section-head centered">
        <div className="eyebrow mono cap">{eyebrow}</div>
        <h2 className="h2">
          {title} {accent && <span className="accent-grad">{accent}</span>}
        </h2>
        {sub && <p className="section-sub">{sub}</p>}
      </div>
      <div className="feature-stage">
        {children}
      </div>
    </div>
  </section>
);

/* =====================================================================
 * Mock product UI: Portfolio dashboard card
 * ===================================================================== */

const PortfolioMock = () => (
  <div className="product-frame">
    <BrowserChrome url="atrium.fi/app/portfolio" />
    <div className="product-body">
      <div className="dash-head">
        <div>
          <div className="mono cap muted">Portfolio · 0x1a3b…7f29</div>
          <div className="num" style={{ fontSize: 42, marginTop: 8, letterSpacing: "-0.024em" }}>
            $12,378,422
          </div>
          <div className="mono cap" style={{ color: "var(--live)", marginTop: 4 }}>
            + $284,920 · 24h
          </div>
        </div>
        <div className="dash-actions">
          <a className="btn ghost small">Deposit</a>
          <a className="btn small">Trade</a>
        </div>
      </div>

      <div className="dash-stats">
        <Stat label="Total collateral" value="$4.13M" />
        <Stat label="Portfolio margin" value="3.12×" />
        <Stat label="Plinth utilization" value="38.4%" />
        <Stat label="Open positions" value="14" />
      </div>

      <div className="dash-positions">
        <div className="dash-head-row mono cap muted">
          <div>Venue</div><div>Position</div><div>Notional</div><div>P&amp;L · 24h</div><div style={{ textAlign: "right" }}>Margin</div>
        </div>
        {[
          ["Hyperliquid HIP-3", "rTSLA-PERP · 4× long",  "$1,820,400", "+ $42,180", "$1.25M", "+"],
          ["Aave Horizon",      "USTB collateral",       "$ 892,440",  "+ $1,084",  "—",      ""],
          ["Pendle V2",         "PT-stETH · Mar 2027",   "$ 320,500",  "+ $2,920",  "—",      "+"],
          ["Trade.xyz",         "WBTC-USDC · spot",      "$ 401,890",  "− $ 8,420", "$420K",  "−"]
        ].map((row, i) => (
          <div key={i} className="dash-row">
            <div className="dash-cell strong">{row[0]}</div>
            <div className="dash-cell mono small">{row[1]}</div>
            <div className="dash-cell num small">{row[2]}</div>
            <div className={"dash-cell num small " + (row[5] === "+" ? "pos" : row[5] === "−" ? "neg" : "")}>{row[3]}</div>
            <div className="dash-cell num small" style={{ textAlign: "right" }}>{row[4]}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Stat = ({ label, value }) => (
  <div className="stat-card">
    <div className="mono cap muted">{label}</div>
    <div className="num" style={{ fontSize: 20, marginTop: 6 }}>{value}</div>
  </div>
);

/* =====================================================================
 * Mock: cross-chain transfer (Aqueduct)
 * ===================================================================== */

const AqueductMock = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % 4), 1500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="product-frame">
      <BrowserChrome url="atrium.fi/app/transfer" />
      <div className="product-body" style={{ padding: 32 }}>
        <div className="mono cap muted">Cross-chain transfer · Aqueduct</div>
        <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "center" }}>
          <div className="transfer-card">
            <div className="mono cap muted">From</div>
            <div className="strong" style={{ marginTop: 6, fontSize: 15 }}>Ethereum Sepolia</div>
            <div className="num" style={{ fontSize: 28, marginTop: 14, letterSpacing: "-0.02em" }}>50,000 <span style={{ fontSize: 16, color: "var(--muted)" }}>USDC</span></div>
            <div className="mono cap muted" style={{ marginTop: 10 }}>Balance · 1,284,300</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <CCIPArrow active={step} />
            <div className="mono cap" style={{ color: step >= 2 ? "var(--live)" : "var(--muted)" }}>
              {step === 0 ? "Sign" : step === 1 ? "CCIP bridging" : step === 2 ? "Finalising" : "Settled"}
            </div>
          </div>
          <div className="transfer-card">
            <div className="mono cap muted">To</div>
            <div className="strong" style={{ marginTop: 6, fontSize: 15 }}>Robinhood Chain</div>
            <div className="num" style={{ fontSize: 28, marginTop: 14, letterSpacing: "-0.02em" }}>50,000 <span style={{ fontSize: 16, color: "var(--muted)" }}>USDC</span></div>
            <div className="mono cap muted" style={{ marginTop: 10 }}>Plinth credit posted</div>
          </div>
        </div>
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--hairline)", display: "flex", justifyContent: "space-between" }}>
          <div className="mono cap muted">Estimated time · 8.4s</div>
          <div className="mono cap muted">CCIP fee · $0.00 testnet</div>
          <div className="mono cap" style={{ color: "var(--live)" }}>● Chainlink CCIP testnet</div>
        </div>
      </div>
    </div>
  );
};

const CCIPArrow = ({ active }) => {
  return (
    <svg width="160" height="44" viewBox="0 0 160 44">
      <line x1="0" y1="22" x2="160" y2="22" stroke="var(--line)" strokeWidth="1" />
      <line x1="0" y1="22" x2={Math.min(160, (active + 1) * 40)} y2="22"
            stroke="var(--ink)" strokeWidth="1.5"
            style={{ transition: "all 600ms ease" }} />
      <polyline points="148,16 158,22 148,28"
                fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="miter" />
      <circle cx={Math.min(155, (active + 1) * 40)} cy="22" r="3" fill="var(--ink)"
              style={{ transition: "all 600ms ease" }} />
    </svg>
  );
};

/* =====================================================================
 * Mock: Sigil session-key (Agents)
 * ===================================================================== */

const SigilMock = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % 4), 1800);
    return () => clearInterval(t);
  }, []);
  const steps = [
    { label: "Sigma signs Intent Sigil",   mono: "intent.sigil · agent=delphi · max=$50k · ttl 7d" },
    { label: "Postern issues session key", mono: "0x9f3a…b71d · cap $50k · 7d" },
    { label: "Agent emits Action Sigil",   mono: "portico.hyperliquid.openLong(WETH, 4×)" },
    { label: "Vigil checks mandate · ok",  mono: "✓ within Plinth headroom · 0.32× util" }
  ];
  return (
    <div className="product-frame">
      <BrowserChrome url="atrium.fi/app/agents/delphi.eth" dark />
      <div className="product-body dark" style={{ padding: 0 }}>
        <div className="agent-head">
          <div>
            <div className="mono cap" style={{ color: "color-mix(in oklch, white 55%, transparent)" }}>Sigil · agent.delphi.eth</div>
            <div className="strong" style={{ fontSize: 17, marginTop: 6, color: "white" }}>Volatility arbitrage · running</div>
          </div>
          <div className="mono cap" style={{ color: "var(--live)" }}>● live</div>
        </div>
        <div style={{ padding: "8px 24px 24px" }}>
          {steps.map((s, i) => {
            const active = i <= step;
            return (
              <div key={i} className="agent-step" style={{ opacity: active ? 1 : 0.28 }}>
                <span style={{ color: i === step ? "var(--accent)" : (active ? "var(--live)" : "var(--muted)"), fontFamily: "var(--mono)", fontSize: 12 }}>
                  {i < step ? "✓" : i === step ? "▸" : "○"}
                </span>
                <div>
                  <div style={{ color: "white", fontSize: 14 }}>{s.label}</div>
                  <div style={{ color: "color-mix(in oklch, white 50%, transparent)", fontSize: 11.5, marginTop: 2, fontFamily: "var(--mono)" }}>{s.mono}</div>
                </div>
                <span className="mono cap" style={{ color: "color-mix(in oklch, white 40%, transparent)" }}>
                  {i === step ? "now" : (i < step ? `+${(step - i) * 1.8 | 0}s` : "—")}
                </span>
              </div>
            );
          })}
        </div>
        <div className="agent-foot">
          <span className="mono cap" style={{ color: "color-mix(in oklch, white 55%, transparent)" }}>Session · 0x9f3a…b71d</span>
          <span className="mono cap" style={{ color: "color-mix(in oklch, white 55%, transparent)" }}>Cap $50,000 · used $12,418</span>
          <button className="agent-revoke">Revoke ↗</button>
        </div>
      </div>
    </div>
  );
};

/* =====================================================================
 * Mock: Lantern PoR attestation
 * ===================================================================== */

const LanternMock = () => (
  <div className="product-frame">
    <BrowserChrome url="lantern.atrium.fi" />
    <div className="product-body">
      <div className="lantern-head">
        <div>
          <div className="mono cap muted">Proof-of-reserves · Atrium</div>
          <div className="strong" style={{ fontSize: 17, marginTop: 6 }}>Hourly Merkle attestation</div>
        </div>
        <div className="check-badge">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7.2 5.8 10 11 4.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Verified · 38 min ago
        </div>
      </div>
      <div className="lantern-grid">
        <Stat label="On-chain reserves" value="$4,128,370" />
        <Stat label="Reported liabilities" value="$4,128,370" />
        <Stat label="Delta" value="0.00 bps" />
        <Stat label="Merkle root" value="0xa72f…91c4" />
      </div>
      <div className="merkle-tree">
        <MerkleTreeSvg />
      </div>
      <div className="lantern-foot">
        <span className="mono cap muted">Block #8,142,317 · Arb-Sepolia</span>
        <a className="ulink mono small">Download verifier (single HTML, 14kb) ↗</a>
      </div>
    </div>
  </div>
);

const MerkleTreeSvg = () => (
  <svg viewBox="0 0 800 140" width="100%" height="140" preserveAspectRatio="none">
    {/* Top */}
    <circle cx="400" cy="14" r="3" fill="currentColor" />
    {/* Level 2 */}
    <line x1="400" y1="14" x2="200" y2="56" stroke="currentColor" strokeWidth="1" opacity="0.55" />
    <line x1="400" y1="14" x2="600" y2="56" stroke="currentColor" strokeWidth="1" opacity="0.55" />
    <circle cx="200" cy="56" r="2.5" fill="currentColor" />
    <circle cx="600" cy="56" r="2.5" fill="currentColor" />
    {/* Level 3 */}
    {[100, 300, 500, 700].map((x, i) => (
      <g key={i}>
        <line x1={i < 2 ? 200 : 600} y1="56" x2={x} y2="98" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <circle cx={x} cy="98" r="2" fill="currentColor" />
      </g>
    ))}
    {/* leaves */}
    {Array.from({ length: 16 }, (_, i) => {
      const x = 50 + i * 47;
      const parent = [100, 300, 500, 700][Math.floor(i / 4)];
      return (
        <g key={i}>
          <line x1={parent} y1="98" x2={x} y2="132" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
          <rect x={x - 2} y="128" width="4" height="8" fill="currentColor" opacity="0.6" />
        </g>
      );
    })}
  </svg>
);

/* =====================================================================
 * Browser chrome — for product mocks
 * ===================================================================== */

const BrowserChrome = ({ url, dark }) => (
  <div className={"browser-chrome" + (dark ? " dark" : "")}>
    <div style={{ display: "flex", gap: 6 }}>
      <span className="bc-dot" /><span className="bc-dot" /><span className="bc-dot" />
    </div>
    <div className="bc-url mono">
      <span style={{ opacity: 0.5, marginRight: 6 }}>https://</span>{url}
    </div>
    <div className="mono cap" style={{ opacity: 0.5, fontSize: 9.5 }}>testnet</div>
  </div>
);

/* =====================================================================
 * Numbers strip
 * ===================================================================== */

const Numbers = () => {
  const [tvl, setTvl] = useState(4.13);
  const [agents, setAgents] = useState(37);
  const [queries, setQueries] = useState(42109);
  useEffect(() => {
    const t = setInterval(() => {
      setTvl(v => v + (Math.random() - 0.4) * 0.005);
      setQueries(v => v + Math.floor(Math.random() * 4));
    }, 1200);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="numbers">
      <div className="container">
        <div className="numbers-grid">
          <NumberBig n={"$" + tvl.toFixed(2) + "M"} l="Live testnet TVL"
                     sub="+ 41.2% vs 30d ago" />
          <NumberBig n={agents.toString()}        l="Registered agents"
                     sub="8 with open positions" />
          <NumberBig n={queries.toLocaleString()} l="Codex queries · 24h"
                     sub="x402 micropayments" />
          <NumberBig n="7 / 8"                    l="Venue adapters live"
                     sub="6 native · 1 bridged · RH-Chain pending SDK" />
        </div>
      </div>
    </section>
  );
};

const NumberBig = ({ n, l, sub }) => (
  <div className="number-big">
    <div className="num" style={{ fontSize: "clamp(36px, 4vw, 56px)", letterSpacing: "-0.025em", lineHeight: 1 }}>
      {n}
    </div>
    <div className="mono cap muted" style={{ marginTop: 14 }}>{l}</div>
    <div className="mono cap muted" style={{ marginTop: 4, opacity: 0.7 }}>{sub}</div>
  </div>
);

/* =====================================================================
 * FLOOR PLAN — the 18 subsystems drawn as a Roman atrium
 * ===================================================================== */

const FloorPlanSection = () => (
  <section id="system" className="floorplan-section">
    <div className="container">
      <div className="section-head centered">
        <div className="eyebrow mono cap">The system</div>
        <h2 className="h2">
          Eighteen subsystems. <span className="serif-i">One building.</span>
        </h2>
        <p className="section-sub">
          The codebase is named after the parts of a Roman house. Plinth carries weight.
          Postern is the small gate. Aqueduct moves water. Each subsystem owns its room.
        </p>
      </div>
    </div>
    <div className="floorplan-frame">
      <FloorPlan />
    </div>
  </section>
);

const ROOMS = [
  // Front gate / venues
  { id: "portico",   name: "Portico",   role: "Venue framework",    x: 460, y: 60,  w: 320, h: 64, kind: "gate" },

  // Left wing (Alae) — agent layer
  { id: "sigil",     name: "Sigil",     role: "Agent mandates",     x: 110, y: 150, w: 220, h: 130 },
  { id: "rostrum",   name: "Rostrum",   role: "Agent marketplace",  x: 110, y: 290, w: 220, h: 130 },

  // Right wing (Alae) — data layer
  { id: "codex",     name: "Codex",     role: "x402 paid APIs",     x: 910, y: 150, w: 220, h: 130 },
  { id: "scribe",    name: "Scribe",    role: "Subgraph indexer",   x: 910, y: 290, w: 220, h: 130 },

  // Central atrium with impluvium
  { id: "impluvium", name: "Impluvium", role: "Unified margin",     x: 460, y: 200, w: 320, h: 220, kind: "pool" },

  // Tablinum row — records & oversight
  { id: "archive",   name: "Archive",   role: "Off-chain risk lab", x: 110, y: 440, w: 220, h: 110 },
  { id: "tablet",    name: "Tablet",    role: "Tax · UK · US · DE", x: 350, y: 440, w: 180, h: 110 },
  { id: "edict",     name: "Edict",     role: "Jurisdiction tiers", x: 550, y: 440, w: 160, h: 110 },
  { id: "praetor",   name: "Praetor",   role: "CLI · ops",          x: 730, y: 440, w: 180, h: 110 },
  { id: "coffer",    name: "Coffer",    role: "ERC-4626 vaults",    x: 930, y: 440, w: 200, h: 110 },

  // Peristyle (garden) — public / community / trust
  { id: "lantern",   name: "Lantern",   role: "Proof-of-reserves",  x: 110, y: 570, w: 300, h: 140 },
  { id: "cohort",    name: "Cohort",    role: "Design partners",    x: 430, y: 570, w: 360, h: 140, kind: "garden" },
  { id: "curator",   name: "Curator",   role: "Adapter grants",     x: 810, y: 570, w: 320, h: 140 },

  // Side gates
  { id: "postern",   name: "Postern",   role: "Wallet abstraction", x: 30,  y: 200, w: 60,  h: 220, kind: "side-gate", side: "L" },
  { id: "aqueduct",  name: "Aqueduct",  role: "Chainlink CCIP",     x: 1150, y: 200, w: 60, h: 220, kind: "channel",  side: "R" },

  // Foundation (cross-section, below)
  { id: "plinth",    name: "Plinth",    role: "Margin engine · Stylus",      x: 110, y: 780, w: 340, h: 70, kind: "foundation" },
  { id: "vigil",     name: "Vigil",     role: "Liquidation engine · Stylus", x: 470, y: 780, w: 340, h: 70, kind: "foundation" },
  { id: "stoa",      name: "Stoa",      role: "Options · Phase 2",           x: 830, y: 780, w: 340, h: 70, kind: "foundation", pending: true }
];

const FloorPlan = () => {
  const [hover, setHover] = useState(null);

  return (
    <div className="floor-wrap">
      {/* Drawing label */}
      <div className="draw-label floor-head">
        <div>
          <div className="mono cap">Fig. 02 · The Atrium of Atrium</div>
          <div className="mono cap muted" style={{ marginTop: 4 }}>
            Plan view · domus floor plan · all 18 subsystems
          </div>
        </div>
        <div className="mono cap" style={{ textAlign: "right" }}>
          <div>Sheet 03 / 08</div>
          <div className="muted" style={{ marginTop: 4 }}>Atrium Labs · May 2026</div>
        </div>
      </div>

      <svg viewBox="0 0 1240 870" className="floor-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="floor-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="0.6" />
          </pattern>
          <pattern id="garden-dots" patternUnits="userSpaceOnUse" width="14" height="14">
            <circle cx="7" cy="7" r="1" fill="currentColor" opacity="0.18" />
          </pattern>
        </defs>

        {/* Section divider — between plan view (top) and section view (bottom) */}
        <line x1="20" y1="760" x2="1220" y2="760" stroke="var(--floor-ink)" strokeWidth="0.6" strokeDasharray="6 6" opacity="0.4" />
        <text x="20" y="754" className="floor-mono" fontSize="10" fill="var(--floor-muted)">— — PLAN VIEW · upper levels — —</text>
        <text x="1220" y="754" className="floor-mono" textAnchor="end" fontSize="10" fill="var(--floor-muted)">— — SECTION · foundation — —</text>

        {/* Building outer wall */}
        <rect x="90" y="124" width="1060" height="600"
              fill="none" stroke="var(--floor-ink)" strokeWidth="1.6" />

        {/* Wall around peristyle (inner) */}
        <rect x="100" y="560" width="1040" height="160"
              fill="none" stroke="var(--floor-ink)" strokeWidth="0.8" opacity="0.6" />
        <text x="120" y="555" className="floor-mono" fontSize="9" fill="var(--floor-muted)" letterSpacing="2">PERISTYLE</text>

        {/* Wall around atrium */}
        <text x="120" y="145" className="floor-mono" fontSize="9" fill="var(--floor-muted)" letterSpacing="2">ATRIUM</text>

        {/* Tablinum label */}
        <text x="120" y="435" className="floor-mono" fontSize="9" fill="var(--floor-muted)" letterSpacing="2">TABLINUM</text>

        {/* Aqueduct channel — animated water flow into the impluvium */}
        <g className="aq-flow">
          <line x1="780" y1="310" x2="1150" y2="310" stroke="var(--floor-ink)" strokeWidth="0.5" opacity="0.35" />
          <line x1="780" y1="320" x2="1150" y2="320" stroke="var(--floor-ink)" strokeWidth="0.5" opacity="0.35" />
          <line x1="780" y1="315" x2="1150" y2="315"
                stroke="var(--accent)" strokeWidth="1"
                strokeDasharray="4 8" opacity="0.7"
                style={{ animation: "aqFlow 2s linear infinite" }} />
          {/* arrow */}
          <polyline points="800,300 780,315 800,330" fill="none" stroke="var(--floor-ink)" strokeWidth="0.8" opacity="0.6" />
        </g>

        {/* Postern entry path */}
        <g>
          <line x1="90" y1="315" x2="110" y2="315" stroke="var(--floor-ink)" strokeWidth="0.5" opacity="0.4" />
          <polyline points="118,305 100,315 118,325" fill="none" stroke="var(--floor-ink)" strokeWidth="0.8" opacity="0.6" />
        </g>

        {/* Compluvium — rain falls from the roof opening into the impluvium below.
            The opening itself isn't drawn (Portico sits there in plan view);
            the falling dashes imply it. */}
        <g opacity="0.5">
          {[510, 555, 600, 640, 680, 720].map(x => (
            <line key={x} x1={x} y1="155" x2={x} y2="205"
                  stroke="var(--accent)" strokeWidth="0.6"
                  opacity="0.35"
                  strokeDasharray="2 4"
                  style={{ animation: "rainFall 1.8s linear infinite" }} />
          ))}
          <text x="615" y="148" textAnchor="middle" className="floor-mono"
                fontSize="8" fill="var(--floor-muted)" letterSpacing="2">via compluvium →</text>
        </g>

        {/* Colonnade — peristyle is a colonnaded garden in a Roman house */}
        <g opacity="0.45">
          {/* top row of columns */}
          {Array.from({ length: 14 }, (_, i) => 130 + i * 76).map(cx => (
            <circle key={"ct" + cx} cx={cx} cy="567" r="3"
                    fill="var(--floor-ink)" />
          ))}
          {/* bottom row of columns */}
          {Array.from({ length: 14 }, (_, i) => 130 + i * 76).map(cx => (
            <circle key={"cb" + cx} cx={cx} cy="713" r="3"
                    fill="var(--floor-ink)" />
          ))}
        </g>

        {/* Foundation columns — vertical bearing lines from the building's
            lower edge down to the foundation blocks (Plinth/Vigil/Stoa) */}
        <g opacity="0.5">
          {[280, 640, 1000].map(x => (
            <g key={x}>
              <line x1={x} y1="724" x2={x} y2="780"
                    stroke="var(--floor-ink)" strokeWidth="0.5"
                    strokeDasharray="2 3" />
              <line x1={x - 20} y1="724" x2={x + 20} y2="724"
                    stroke="var(--floor-ink)" strokeWidth="0.6" />
            </g>
          ))}
        </g>

        {/* Rooms */}
        {ROOMS.map(r => (
          <Room key={r.id} r={r} hover={hover} setHover={setHover} />
        ))}

        {/* Foundation label (between section view and rooms) */}
        <text x="110" y="775" className="floor-mono" fontSize="10" fill="var(--floor-muted)" letterSpacing="2">FOUNDATION · STYLUS (RUST → WASM)</text>

        {/* North arrow */}
        <g transform="translate(1180, 50)">
          <circle cx="0" cy="0" r="18" fill="none" stroke="var(--floor-ink)" strokeWidth="0.8" />
          <polygon points="0,-14 5,8 0,4 -5,8" fill="var(--floor-ink)" />
          <text x="0" y="-22" className="floor-mono" textAnchor="middle" fontSize="10" fill="var(--floor-ink)">N</text>
        </g>

        {/* Scale rule */}
        <g transform="translate(40, 50)">
          <text x="0" y="-6" className="floor-mono" fontSize="9" fill="var(--floor-muted)" letterSpacing="1.5">SCALE 1:1 · TESTNET</text>
          <g>
            <rect x="0" y="0" width="20" height="6" fill="var(--floor-ink)" />
            <rect x="20" y="0" width="20" height="6" fill="none" stroke="var(--floor-ink)" strokeWidth="0.6" />
            <rect x="40" y="0" width="20" height="6" fill="var(--floor-ink)" />
            <rect x="60" y="0" width="20" height="6" fill="none" stroke="var(--floor-ink)" strokeWidth="0.6" />
          </g>
          <text x="0"  y="18" className="floor-mono" fontSize="8" fill="var(--floor-muted)">0</text>
          <text x="80" y="18" className="floor-mono" fontSize="8" fill="var(--floor-muted)">100m</text>
        </g>

        {/* Dimension lines on the outer building */}
        <DimLine x1={90} y1={744} x2={1150} y2={744} label="1,060" />
        <DimLineV x1={1224} y1={124} x2={1224} y2={724} label="600" />
      </svg>

      {/* Hover detail card */}
      <div className="floor-detail">
        {hover ? (
          <>
            <div className="serif" style={{ fontSize: 28, letterSpacing: "-0.012em" }}>
              {ROOMS.find(r => r.id === hover)?.name}
            </div>
            <div className="mono cap" style={{ marginTop: 6, color: "var(--muted)" }}>
              {ROOMS.find(r => r.id === hover)?.role}
            </div>
            <div className="small mt-3" style={{ color: "var(--ink-soft)", maxWidth: 320 }}>
              {ROOM_DESC[hover]}
            </div>
          </>
        ) : (
          <>
            <div className="mono cap" style={{ color: "var(--muted)" }}>Hover a room</div>
            <div className="small mt-2" style={{ color: "var(--ink-soft)", maxWidth: 320 }}>
              Eighteen subsystems arranged as a domus. The impluvium at the centre
              is the unified margin pool. Foundation engines carry the load. Side
              gates handle traffic in and out.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ROOM_DESC = {
  portico:   "Open standard adapter framework — IPorticoAdapter v1.0.0 — and the 7 live integrations (Hyperliquid HIP-3 / HIP-4, Aave Horizon, Pendle V2, Curve, Trade.xyz, Polymarket).",
  sigil:     "EIP-712 mandates over ERC-8004. Issues short-lived session keys bound to one agent, one strategy, one time window, one notional cap.",
  rostrum:   "Agent leaderboard + copy-trading. Public performance, on-chain history, slashing appeals.",
  codex:     "x402-payable agent APIs. 8 endpoints. Signed responses. Atrium's paid knowledge surface.",
  scribe:    "Subgraphs over The Graph hosted service. Single region, free tier, indexes every Atrium contract.",
  impluvium: "The central pool. SPAN-style cross-product margin computed by Plinth, fed by every venue's collateral. One buying-power number.",
  archive:   "Off-chain risk lab in Python. Backtests, correlation oracle, weekly research notes published to learn.atrium.fi.",
  tablet:    "Realised-gain export for UK CGT (SA108), US Form 8949, and German FIFO. Signed by a Lantern Merkle root.",
  edict:     "Jurisdiction-tier registry. Sumsub sandbox KYC. Gates venue access by tier — sandbox, retail, professional, institutional.",
  praetor:   "CLI and ops tooling. Deploy, migrate, monitor. Built on Foundry + cargo-stylus.",
  coffer:    "ERC-4626 collateral vaults written in Rust on the OpenZeppelin Rust ERC-4626 base.",
  lantern:   "Hourly Merkle attestations published on-chain. Independent verifier ships as a 14kb static HTML file you save and run offline.",
  cohort:    "Five to eight named design partners, sharing venue-specific knowledge in exchange for early access.",
  curator:   "Open-source grant programme — $20–50K ARB — funding community-built Portico adapters.",
  postern:   "ERC-4337 + EIP-7702 wallet abstraction. Passkey login, gas sponsorship, session keys, social recovery.",
  aqueduct:  "Chainlink CCIP messaging contracts. Move collateral between Ethereum Sepolia, Arbitrum Sepolia, and RH-Chain testnet.",
  plinth:    "SPAN-style portfolio margin engine in Rust, deployed as Stylus. Reads collateral across all venues, returns one buying-power number per block.",
  vigil:     "NMS-aware partial-liquidation engine in Rust. Vigil watches every position every block, partial-liquidates before stop-out.",
  stoa:      "Black-Scholes options engine in Rust. Phase 2 — ships if the Trailblazer AI grant lands."
};

const Room = ({ r, hover, setHover }) => {
  const isHover = hover === r.id;
  const isPool = r.kind === "pool";
  const isFound = r.kind === "foundation";
  const isGate = r.kind === "gate";
  const isSide = r.kind === "side-gate" || r.kind === "channel";
  const isGarden = r.kind === "garden";

  const tx = r.x + r.w / 2;
  const ty = r.y + r.h / 2;

  return (
    <g onMouseEnter={() => setHover(r.id)}
       onMouseLeave={() => setHover(null)}
       style={{ cursor: "pointer" }}
       className={"room" + (isHover ? " hover" : "")}>
      {/* Garden hatch background */}
      {isGarden && (
        <rect x={r.x} y={r.y} width={r.w} height={r.h}
              fill="url(#garden-dots)" color="currentColor" />
      )}
      {/* Pool hatch — very subtle, accent-tinted, never obscures text */}
      {isPool && (
        <>
          <rect x={r.x} y={r.y} width={r.w} height={r.h}
                fill="var(--accent)" opacity={isHover ? 0.10 : 0.06} />
          <rect x={r.x} y={r.y} width={r.w} height={r.h}
                fill="url(#floor-hatch)" color="var(--accent)" opacity={isHover ? 0.20 : 0.12} />
          {/* hairline accent rule under the name */}
          <line x1={r.x + r.w / 2 - 28} y1={r.y + r.h / 2 + 4}
                x2={r.x + r.w / 2 + 28} y2={r.y + r.h / 2 + 4}
                stroke="var(--accent)" strokeWidth="0.6" opacity="0.6" />
          {/* live dot near top-right */}
          <circle cx={r.x + r.w - 16} cy={r.y + 14} r="3" fill="var(--live)" />
          <text x={r.x + r.w - 24} y={r.y + 17} textAnchor="end" className="floor-mono"
                fontSize="8" fill="var(--floor-muted)" letterSpacing="1.5">LIVE</text>
          <text x={r.x + 14} y={r.y + 17} className="floor-mono"
                fontSize="8" fill="var(--floor-muted)" letterSpacing="1.5">POOL · UNIFIED MARGIN</text>
        </>
      )}
      {/* Lantern glow — it's literally the lighthouse of PoR */}
      {r.id === "lantern" && (
        <>
          <defs key="lr">
            <radialGradient id={"lglow-" + r.id} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x={r.x - 20} y={r.y - 20} width={r.w + 40} height={r.h + 40}
                fill={`url(#lglow-${r.id})`}
                style={{ animation: "lanternBreathe 4s ease-in-out infinite" }} />
          {/* central glyph */}
          <circle cx={r.x + r.w / 2} cy={r.y + 24} r="3" fill="var(--accent)" opacity={isHover ? 1 : 0.7} />
        </>
      )}
      {/* Foundation block */}
      {isFound && (
        <rect x={r.x} y={r.y} width={r.w} height={r.h}
              fill={isHover ? "var(--floor-ink)" : "var(--floor-bg)"}
              stroke="var(--floor-ink)" strokeWidth="1.2"
              strokeDasharray={r.pending ? "6 4" : "0"}
              opacity={r.pending && !isHover ? 0.65 : 1} />
      )}

      {/* Room boundary */}
      {!isFound && (
        <rect x={r.x} y={r.y} width={r.w} height={r.h}
              fill={isHover ? "color-mix(in oklch, var(--accent) 6%, transparent)" : "transparent"}
              stroke={isHover ? "var(--accent)" : "var(--floor-ink)"}
              strokeWidth={isHover ? 1.4 : (isPool ? 1.2 : (isSide ? 0.8 : 1))}
              style={{ transition: "all 200ms ease" }} />
      )}

      {/* Name */}
      {/* Pool — special multi-line treatment */}
      {isPool ? (
        <>
          <text x={tx} y={ty - 16}
                textAnchor="middle"
                className="floor-name"
                fontSize="44"
                fill="var(--accent)">
            {r.name}
          </text>
          <text x={tx} y={ty + 32}
                textAnchor="middle"
                className="floor-mono"
                fontSize="28"
                fill="var(--floor-ink)"
                letterSpacing="-0.5"
                fontWeight="500">
            $10.7M
          </text>
          <text x={tx} y={ty + 52}
                textAnchor="middle"
                className="floor-mono"
                fontSize="9"
                fill="var(--floor-muted)"
                letterSpacing="2">
            BUYING POWER · 3.0×
          </text>
        </>
      ) : (r.kind === "side-gate" || r.kind === "channel") ? (
        <>
          <text x={tx} y={ty - 6}
                textAnchor="middle"
                transform={`rotate(-90 ${tx} ${ty})`}
                className="floor-name"
                fontSize="20"
                fill={isHover ? "var(--accent)" : "var(--floor-ink)"}
                style={{ transition: "fill 200ms ease" }}>
            {r.name}
          </text>
          <text x={tx} y={ty + 14}
                textAnchor="middle"
                transform={`rotate(-90 ${tx} ${ty})`}
                className="floor-mono"
                fontSize="8"
                fill="var(--floor-muted)"
                letterSpacing="1.5">
            {r.role}
          </text>
        </>
      ) : (
        <>
          <text x={tx} y={ty - 4}
                textAnchor="middle"
                className="floor-name"
                fill={isFound && isHover ? "var(--floor-bg)" :
                      isHover ? "var(--accent)" :
                      isPool ? "var(--accent)" : "var(--floor-ink)"}
                style={{ transition: "fill 200ms ease" }}>
            {r.name}
          </text>
          <text x={tx} y={ty + 14}
                textAnchor="middle"
                className="floor-mono"
                fontSize={10}
                fill={isFound && isHover ? "color-mix(in oklch, var(--floor-bg) 70%, transparent)" : "var(--floor-muted)"}
                letterSpacing="1.5">
            {r.role}
          </text>
        </>
      )}
      {/* Pending tag */}
      {r.pending && (
        <text x={r.x + r.w - 8} y={r.y + 14} textAnchor="end" className="floor-mono"
              fontSize="8" fill="var(--floor-muted)" letterSpacing="1.5">P2</text>
      )}
    </g>
  );
};

const DimLine = ({ x1, y1, x2, y2, label }) => (
  <g opacity="0.5">
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--floor-ink)" strokeWidth="0.4" />
    <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} stroke="var(--floor-ink)" strokeWidth="0.4" />
    <line x1={x2} y1={y1 - 4} x2={x2} y2={y1 + 4} stroke="var(--floor-ink)" strokeWidth="0.4" />
    <text x={(x1 + x2) / 2} y={y1 + 14} textAnchor="middle" className="floor-mono" fontSize="9" fill="var(--floor-muted)" letterSpacing="1">{label}</text>
  </g>
);

const DimLineV = ({ x1, y1, x2, y2, label }) => (
  <g opacity="0.5">
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--floor-ink)" strokeWidth="0.4" />
    <line x1={x1 - 4} y1={y1} x2={x1 + 4} y2={y1} stroke="var(--floor-ink)" strokeWidth="0.4" />
    <line x1={x1 - 4} y1={y2} x2={x1 + 4} y2={y2} stroke="var(--floor-ink)" strokeWidth="0.4" />
    <text x={x1 + 14} y={(y1 + y2) / 2} textAnchor="start" className="floor-mono" fontSize="9" fill="var(--floor-muted)" transform={`rotate(-90 ${x1 + 14} ${(y1 + y2) / 2})`} letterSpacing="1">{label}</text>
  </g>
);

/* =====================================================================
 * Subsystems — 4 architectural blocks, not a flat list
 * ===================================================================== */

const SUBSYS_GROUPS = [
  {
    id: "risk",
    label: "Block 01",
    title: "Risk engine",
    sub: "Cross-product margin, liquidations, options pricing — Rust deployed as Stylus.",
    nums: ["01", "02", "03", "12"]
  },
  {
    id: "venues",
    label: "Block 02",
    title: "Venues + cross-chain",
    sub: "Portico framework, Chainlink CCIP bridge, wallet abstraction layer.",
    nums: ["04", "05", "18"]
  },
  {
    id: "agents",
    label: "Block 03",
    title: "Agents + APIs",
    sub: "ERC-8004 mandates, copy-trading marketplace, paid agent surface, indexing.",
    nums: ["06", "07", "08", "09", "10"]
  },
  {
    id: "trust",
    label: "Block 04",
    title: "Trust + ops",
    sub: "Proof-of-reserves, compliance, tax exports, CLI, partner programmes.",
    nums: ["11", "13", "14", "15", "16", "17"]
  }
];

const Subsystems = () => (
  <section id="system" className="subsystems">
    <div className="container">
      <div className="section-head centered">
        <div className="eyebrow mono cap">Subsystems</div>
        <h2 className="h2">Eighteen named pieces. <span className="accent-grad">Four architectural blocks.</span></h2>
        <p className="section-sub">
          Each subsystem owns one responsibility. Thirteen are live on testnet today;
          all eighteen ship at launch — with Stoa conditional on Phase-2 funding.
        </p>
      </div>

      <div className="subsys-stack">
        {SUBSYS_GROUPS.map(g => <SubsysGroup key={g.id} group={g} />)}
      </div>
    </div>
  </section>
);

const SubsysGroup = ({ group }) => {
  const items = group.nums.map(n => SUBSYSTEMS.find(s => s.num === n)).filter(Boolean);
  return (
    <div className="subsys-group">
      <div className="subsys-group-head">
        <div className="mono cap muted">{group.label}</div>
        <h3 className="subsys-group-title">{group.title}</h3>
        <p className="subsys-group-sub">{group.sub}</p>
        <div className="mono cap muted" style={{ marginTop: 18 }}>
          {items.length} subsystems
        </div>
      </div>
      <div className="subsys-cards">
        {items.map(s => <SubsysCard key={s.num} s={s} />)}
      </div>
    </div>
  );
};

const SubsysCard = ({ s }) => {
  const [hover, setHover] = useState(false);
  return (
    <div className={"subsys-card" + (hover ? " hover" : "")}
         onMouseEnter={() => setHover(true)}
         onMouseLeave={() => setHover(false)}>
      <div className="subsys-card-top">
        <span className="mono cap muted">{s.num}</span>
        <span className="mono cap" style={{ color: s.phase === "P1" ? "var(--ink-soft)" : "var(--muted)", letterSpacing: "0.1em" }}>
          {s.phase}
        </span>
      </div>
      <div className="subsys-card-name serif-i">{s.name}</div>
      <div className="subsys-card-sub">{s.sub}</div>
      <div className="subsys-card-stack mono cap muted">{s.stack}</div>
    </div>
  );
};

/* =====================================================================
 * Architecture
 * ===================================================================== */

const ARCH_LAYERS = [
  { name: "Postern",            role: "User entry · wallet abstraction", side: "PWA · Next.js",                 items: ["Passkey login", "Gas sponsorship", "Session keys", "Social recovery"] },
  { name: "Backend services",   role: "Off-chain orchestration",         side: "Single region · EU",            items: ["Tablet · tax", "Codex · x402", "Aqueduct coordinator", "Rostrum copy-trade"] },
  { name: "Stylus",             role: "Rust → WASM · hot math",          side: "Robinhood · Arbitrum Sepolia",  items: ["Plinth · margin", "Vigil · liquidations", "Stoa · options"] },
  { name: "Solidity",           role: "Venue + vault layer",             side: "OpenZeppelin",                  items: ["Portico v1.0.0", "8 P1 adapters", "Coffer · ERC-4626", "Sigil · ERC-8004"] },
  { name: "Oracles + data",     role: "Free testnet feeds",              side: "Chainlink · The Graph",         items: ["Data Streams", "Price Feeds", "CCIP testnet", "RedStone", "Scribe"] }
];

const Architecture = () => (
  <section id="architecture" className="architecture">
    <div className="container">
      <div className="section-head centered">
        <div className="eyebrow mono cap">Architecture</div>
        <h2 className="h2">Stylus for hot math. <span className="accent-grad">Solidity</span> for the venue layer.</h2>
        <p className="section-sub">
          Risk math lives in Rust, deployed as Stylus. The venue layer lives in Solidity, on
          OpenZeppelin patterns. Chainlink CCIP is the messaging bus between chains.
        </p>
      </div>

      <div className="arch-stack">
        {ARCH_LAYERS.map((layer, i) => (
          <div key={i} className="arch-row">
            <div className="arch-num mono cap">L0{i+1}</div>
            <div>
              <div className="strong" style={{ fontSize: 18, letterSpacing: "-0.005em" }}>{layer.name}</div>
              <div className="mono cap muted" style={{ marginTop: 4 }}>{layer.role}</div>
            </div>
            <div className="arch-items">
              {layer.items.map(it => <span key={it} className="arch-chip mono">{it}</span>)}
            </div>
            <div className="mono cap arch-side">{layer.side}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* =====================================================================
 * Cohort partners (NEW)
 * ===================================================================== */

const Cohort = () => (
  <section id="network" className="cohort">
    <div className="container">
      <div className="cohort-head">
        <div className="eyebrow mono cap centered">Built with</div>
        <h3 className="cohort-title">
          Eight venue and infrastructure partners across the EVM stack,
          shipping with us from day one.
        </h3>
      </div>
      <div className="cohort-logos">
        {PARTNERS.map(p => (
          <div key={p} className="cohort-logo">
            <span className="serif-i">{p}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* =====================================================================
 * Final CTA + Footer
 * ===================================================================== */

const Closing = () => (
  <section id="open" className="closing">
    <div className="container">
      <div className="eyebrow mono cap" style={{ color: "color-mix(in oklch, white 55%, transparent)" }}>
        Testnet · now open
      </div>
      <h2 className="closing-title">
        Step inside.<br/>
        <span style={{ color: "color-mix(in oklch, white 55%, transparent)" }}>The testnet is open.</span>
      </h2>
      <p className="closing-sub">
        Faucet drops $10,000 test USDC and $5,000 rAAPL on landing.
        Three minutes from passkey login to first cross-margin trade.
      </p>
      <div className="closing-cta">
        <a className="btn light" href="Atrium App.html">Open testnet <span className="arrow">↗</span></a>
        <a className="btn ghost-light" href="Brand Kit.html">Brand kit</a>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="footer">
    <div className="container">
      <div className="footer-grid">
        <div>
          <Wordmark size={22} />
          <p className="footer-lede">
            Unified margin prime brokerage for the EVM.<br/>
            <span className="muted">Live on Arbitrum Sepolia and Robinhood Chain testnet.</span>
          </p>
        </div>
        {[
          ["Product",   [{l:"Portfolio", h:"Atrium App.html#portfolio"}, {l:"Trade", h:"Atrium App.html#trade"}, {l:"Cross-chain", h:"Atrium App.html#transfer"}, {l:"Agents", h:"Atrium App.html#agents"}, {l:"Reserves", h:"Atrium App.html#reserves"}]],
          ["Subsystems",[{l:"Plinth · margin"}, {l:"Vigil · risk"}, {l:"Portico · venues"}, {l:"Sigil · agents"}, {l:"Postern · wallet"}]],
          ["Resources", [{l:"Documentation"}, {l:"Architecture"}, {l:"GitHub"}, {l:"Status"}, {l:"Brand kit", h:"Brand Kit.html"}]],
          ["Company",   [{l:"Cohort partners"}, {l:"Adapter grants"}, {l:"Press"}, {l:"Contact"}]]
        ].map(([title, items]) => (
          <div key={title}>
            <div className="mono cap muted">{title}</div>
            <div className="footer-col">
              {items.map(i => (
                <a key={i.l} href={i.h || "#"} className="ulink small ink-soft">{i.l}</a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="footer-baseline mono cap">
        <span>© 2026 Atrium Labs Ltd.</span>
        <span>arb-sepolia 0x4f29…81e0 · rh-chain 0x9a02…3c4d</span>
        <span><span className="dot" /> testnet · all systems normal</span>
      </div>
    </div>
  </footer>
);

/* =====================================================================
 * App
 * ===================================================================== */

const App = () => {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  useEffect(() => { document.documentElement.dataset.theme = tweaks.theme; }, [tweaks.theme]);
  useEffect(() => { document.documentElement.style.setProperty("--accent", tweaks.accent); }, [tweaks.accent]);
  useEffect(() => {
    document.documentElement.style.setProperty("--num-feature",
      tweaks.numStyle === "mono" ? '"tnum" 1, "lnum" 1' : '"pnum" 1, "lnum" 1');
  }, [tweaks.numStyle]);

  return (
    <>
      <Nav />
      <main>
        <Hero
          leverage={tweaks.leverage}
          setLeverage={(v) => setTweak("leverage", v)}
          showFlow={tweaks.showFlow}
        />

        <Feature
          id="portfolio"
          eyebrow="Plinth · margin engine"
          title="Capital efficiency, "
          accent="mathematically."
          sub="Plinth computes a SPAN-style cross-product margin number in Rust, deployed as Stylus. The same math costs 10–100× more gas in equivalent Solidity — which is why it has not shipped onchain elsewhere."
        >
          <PortfolioMock />
        </Feature>

        <Feature
          id="bridge"
          eyebrow="Aqueduct · Chainlink CCIP"
          title="Move collateral between chains in "
          accent="one transaction."
          sub="Aqueduct routes assets through Chainlink CCIP. Collateral posted on Robinhood Chain becomes Plinth credit on Arbitrum in under ten seconds."
        >
          <AqueductMock />
        </Feature>

        <Feature
          id="agents"
          dark
          eyebrow="Sigil · ERC-8004 mandates"
          title="Agents trade with "
          accent="bounded mandates."
          sub="You sign one Intent Sigil — an EIP-712 mandate authorising one agent, for one strategy, for a finite window. Postern issues a session key. Your master key never moves."
        >
          <SigilMock />
        </Feature>

        <Feature
          id="reserves"
          eyebrow="Lantern · proof-of-reserves"
          title="Every dollar, "
          accent="on the public record."
          sub="Lantern publishes a signed Merkle attestation every sixty minutes. Anyone can verify a balance against it locally — without trusting Atrium."
        >
          <LanternMock />
        </Feature>

        <Numbers />
        <FloorPlanSection />
        <Subsystems />
        <Architecture />
        <Cohort />
        <Closing />
      </main>
      <Footer />

      <window.TweaksPanel title="Tweaks">
        <window.TweakSection label="Appearance">
          <window.TweakRadio
            label="Theme" value={tweaks.theme}
            onChange={(v) => setTweak("theme", v)}
            options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          <window.TweakColor
            label="Accent" value={tweaks.accent}
            onChange={(v) => setTweak("accent", v)}
            options={["#7E2A20", "#1D3557", "#2E5E3A", "#3B3B3B"]} />
        </window.TweakSection>
        <window.TweakSection label="Numbers">
          <window.TweakRadio
            label="Style" value={tweaks.numStyle}
            onChange={(v) => setTweak("numStyle", v)}
            options={[{ value: "mono", label: "Mono" }, { value: "prop", label: "Prop" }]} />
        </window.TweakSection>
        <window.TweakSection label="Impluvium">
          <window.TweakToggle
            label="Animate flow" value={tweaks.showFlow}
            onChange={(v) => setTweak("showFlow", v)} />
          <window.TweakSlider
            label="Leverage" value={tweaks.leverage}
            onChange={(v) => setTweak("leverage", v)}
            min={1} max={10} step={0.1} unit="×" />
        </window.TweakSection>
      </window.TweaksPanel>
    </>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
