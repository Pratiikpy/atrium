'use client';

import { useState, type CSSProperties } from "react";
import Link from "next/link";


type Tab = "home" | "trade" | "move" | "agents" | "more";

/**
 * Mobile app — 1:1 port of .lovable/refs/mobile-app.html
 * Five-tab gesture-first app. All styling in src/styles/atrium-mobile.css
 * under `.atrium-m-root`.
 */
export function MobileApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [side, setSide] = useState<"long" | "short">("long");
  const [tf, setTf] = useState("1D");
  const [lev, setLev] = useState(4);
  const levPct = ((lev - 1) / 9) * 100;

  return (
    <div className="atrium-m-root">
      <div className="app">


        {tab === "home" && (
          <div className="app-head">
            <Link href="/" className="mark" style={{ textDecoration: "none", color: "inherit" }} aria-label="Atrium home">Atrium</Link>
            <span className="pill"><span className="dot" /> testnet</span>
          </div>
        )}

        <div className="view">
          {tab === "home"   && <PanelHome onGo={setTab} />}
          {tab === "trade"  && (
            <PanelTrade
              side={side} setSide={setSide}
              tf={tf} setTf={setTf}
              lev={lev} setLev={setLev} levPct={levPct}
            />
          )}
          {tab === "move"   && <PanelMove />}
          {tab === "agents" && <PanelAgents />}
          {tab === "more"   && <PanelMore />}
        </div>

        <nav className="tabbar">
          <TabBtn id="home"   active={tab === "home"}   onClick={setTab} label="Home"   icon={IconHome} />
          <TabBtn id="trade"  active={tab === "trade"}  onClick={setTab} label="Trade"  icon={IconTrade} />
          <TabBtn id="move"   active={tab === "move"}   onClick={setTab} label="Move"   icon={IconMove} />
          <TabBtn id="agents" active={tab === "agents"} onClick={setTab} label="Agents" icon={IconAgents} />
          <TabBtn id="more"   active={tab === "more"}   onClick={setTab} label="More"   icon={IconMore} />
        </nav>
      </div>
    </div>
  );
}

/* ============================== TABS ============================== */

function TabBtn({ id, active, onClick, label, icon: Icon }: {
  id: Tab; active: boolean; onClick: (t: Tab) => void; label: string; icon: () => React.ReactElement;
}) {
  return (
    <button className={`tab${active ? " active" : ""}`} onClick={() => onClick(id)}>
      <span className="ic"><Icon /></span>
      <span className="l">{label}</span>
    </button>
  );
}

/* ============================== HOME ============================== */

function PanelHome({ onGo }: { onGo: (t: Tab) => void }) {
  return (
    <div className="panel active">
      <div className="hero-card">
        <div className="hero-label">Buying power · 3.0× margin</div>
        <div className="hero-big">$12,374,820</div>
        <div className="hero-delta">
          <span className="arrow">↑</span>
          <span className="v">+ $284,920</span>
          <span className="sub">· 24h · 2.36%</span>
        </div>

        <svg className="hero-spark" viewBox="0 0 320 50" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cc8e2d" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#cc8e2d" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 0 38 L 20 32 L 40 36 L 60 28 L 80 30 L 100 22 L 120 26 L 140 18 L 160 24 L 180 14 L 200 18 L 220 12 L 240 16 L 260 8 L 280 14 L 300 6 L 320 10 L 320 50 L 0 50 Z" fill="url(#sp)" />
          <path d="M 0 38 L 20 32 L 40 36 L 60 28 L 80 30 L 100 22 L 120 26 L 140 18 L 160 24 L 180 14 L 200 18 L 220 12 L 240 16 L 260 8 L 280 14 L 300 6 L 320 10" fill="none" stroke="#cc8e2d" strokeWidth="1.6" />
          <circle cx="320" cy="10" r="3" fill="#cc8e2d" />
        </svg>

        <div className="hero-meta">
          <div className="m"><div className="l">Collateral</div><div className="v">$4.13M</div></div>
          <div className="m"><div className="l">Open</div><div className="v">$2.65M</div></div>
          <div className="m"><div className="l">Utilisation</div><div className="v">38.4%</div></div>
        </div>
      </div>

      <div className="actions">
        <ActionBtn onClick={() => onGo("trade")} label="Trade">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 11.5l3-3 2.5 2.5 5.5-5.5"/><path d="M9.5 5.5h4v4"/></svg>
        </ActionBtn>
        <ActionBtn onClick={() => onGo("move")} label="Move">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5h11l-2.4-2.4 M14 11H3l2.4 2.4"/></svg>
        </ActionBtn>
        <ActionBtn onClick={() => onGo("agents")} label="Agents">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6" r="2.4"/><path d="M3 13c0-2.4 2.2-4 5-4s5 1.6 5 4"/></svg>
        </ActionBtn>
        <ActionBtn onClick={() => onGo("more")} label="Reserves">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6l5-3 5 3v3c0 2.4-2.2 4-5 4s-5-1.6-5-4V6z"/><path d="M6.4 8.2l1.2 1.2 2.6-2.6"/></svg>
        </ActionBtn>
      </div>

      <div className="section-head">
        <span className="t">Open positions · 4</span>
        <a href="#" className="more">All ↗</a>
      </div>
      <div className="position-list">
        <PositionRow badge="P" name="rTSLA-PERP"      sub="HL-HIP3 · LONG 4×" val="$1.82M" delta="+ $42,180" pos />
        <PositionRow badge="A" name="USTB collateral" sub="AAVE · SUPPLY"     val="$892K"  delta="+ $1,084"  pos />
        <PositionRow badge="P" name="PT-stETH Mar27"  sub="PENDLE · LONG"     val="$320K"  delta="+ $2,920"  pos />
        <PositionRow badge="T" name="WBTC / USDC"     sub="TRADE · SHORT 2×"  val="$401K"  delta="− $8,420"  pos={false} />
      </div>

      <div className="section-head">
        <span className="t">Activity · live</span>
        <a href="#" className="more">All ↗</a>
      </div>
      <div className="activity">
        <div className="activity-row">
          <div className="ic"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6" r="2.4"/><path d="M3 13c0-2.4 2.2-4 5-4s5 1.6 5 4"/></svg></div>
          <div>
            <div className="desc">delphi.eth opened rTSLA-PERP long</div>
            <div className="ts">16:14 · 0x4f29…e10a</div>
          </div>
          <div className="v">$182K</div>
        </div>
        <div className="activity-row">
          <div className="ic"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5h11l-2.4-2.4 M14 11H3l2.4 2.4"/></svg></div>
          <div>
            <div className="desc">Aqueduct · USDC inbound</div>
            <div className="ts">16:11 · 0xa1f0…b288</div>
          </div>
          <div className="v">+ $50K</div>
        </div>
        <div className="activity-row">
          <div className="ic"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4l5-2 5 2v4c0 2.7-2.3 5-5 6-2.7-1-5-3.3-5-6V4z"/></svg></div>
          <div>
            <div className="desc">Lantern attestation #8,142,316</div>
            <div className="ts">15:58 · Δ 0.00 bps</div>
          </div>
          <div className="v">verified</div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button className="action" onClick={onClick}>
      <div className="ic">{children}</div>
      <div className="l">{label}</div>
    </button>
  );
}

function PositionRow({ badge, name, sub, val, delta, pos }: {
  badge: string; name: string; sub: string; val: string; delta: string; pos: boolean;
}) {
  return (
    <div className="position-row">
      <div className="badge">{badge}</div>
      <div className="meta">
        <div className="n">{name}</div>
        <div className="s">{sub}</div>
      </div>
      <div className="val">
        <div className="v">{val}</div>
        <div className={`d ${pos ? "pos" : "neg"}`}>{delta}</div>
      </div>
    </div>
  );
}

/* ============================== TRADE ============================== */

function PanelTrade({ side, setSide, tf, setTf, lev, setLev, levPct }: {
  side: "long" | "short"; setSide: (s: "long" | "short") => void;
  tf: string; setTf: (t: string) => void;
  lev: number; setLev: (n: number) => void; levPct: number;
}) {
  const submitClass = side === "long" ? "primary-btn long" : "primary-btn short";
  const submitLabel = side === "long" ? "Open long · rTSLA-PERP" : "Open short · rTSLA-PERP";
  return (
    <div className="panel active">
      <div className="trade-head">
        <div className="pair">
          <div>
            <div className="sym">rTSLA-PERP</div>
            <div className="venue">Hyperliquid HIP-3</div>
          </div>
        </div>
        <div className="px">
          <div className="v">251.10</div>
          <div className="d">+ 1.13% · 24h</div>
        </div>
      </div>

      <div className="chart-card">
        <svg viewBox="0 0 320 120" preserveAspectRatio="none" style={{ width: "100%", height: 120 }}>
          <defs>
            <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cc8e2d" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#cc8e2d" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 0 90 L 16 88 L 32 84 L 48 78 L 64 82 L 80 72 L 96 76 L 112 68 L 128 72 L 144 60 L 160 66 L 176 54 L 192 58 L 208 50 L 224 52 L 240 42 L 256 46 L 272 36 L 288 38 L 304 28 L 320 32 L 320 120 L 0 120 Z" fill="url(#cf)" />
          <path d="M 0 90 L 16 88 L 32 84 L 48 78 L 64 82 L 80 72 L 96 76 L 112 68 L 128 72 L 144 60 L 160 66 L 176 54 L 192 58 L 208 50 L 224 52 L 240 42 L 256 46 L 272 36 L 288 38 L 304 28 L 320 32" fill="none" stroke="#cc8e2d" strokeWidth="1.6" />
        </svg>
        <div className="timeframe">
          {["1H", "4H", "1D", "1W", "1M"].map((t) => (
            <button key={t} className={tf === t ? "on" : ""} onClick={() => setTf(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="side-toggle">
        <button className={`side-btn long${side === "long" ? " on" : ""}`}   onClick={() => setSide("long")}>Long</button>
        <button className={`side-btn short${side === "short" ? " on" : ""}`} onClick={() => setSide("short")}>Short</button>
      </div>

      <div className="amount-card">
        <div className="label">Size · USD</div>
        <div className="amount">$1,820<span className="unit">.00</span></div>
        <div className="conv">≈ 7.245 contracts · slippage 0.1%</div>
      </div>

      <div className="lev-card">
        <div className="row">
          <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--muted)" }}>Leverage</div>
          <div className="v">{lev}×</div>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={lev}
          onChange={(e) => setLev(parseInt(e.target.value, 10))}
          style={{ ["--p" as never]: `${levPct}%` } as CSSProperties}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)" }}>
          <span>1×</span><span>10×</span>
        </div>
      </div>

      <div className="order-card">
        <OrderRow l="Notional"        v="$7,280" />
        <OrderRow l="Initial margin"  v="$1,820" />
        <OrderRow l="Liquidation"     v="228.40" />
        <OrderRow l="Fee · taker"     v="$4.37" />
        <OrderRow l="Gas"             v="$0 · sponsored" />
      </div>

      <button className={submitClass}>{submitLabel}</button>
      <div className="order-note">Plinth verifies cross-margin onchain · ≤ 8s</div>
    </div>
  );
}

function OrderRow({ l, v }: { l: string; v: string }) {
  return <div className="order-row"><span className="l">{l}</span><span className="v">{v}</span></div>;
}

/* ============================== MOVE ============================== */

function PanelMove() {
  return (
    <div className="panel active">
      <div className="section-head" style={{ marginTop: 0 }}>
        <span className="t">Aqueduct · Chainlink CCIP</span>
        <span className="more">~ 8.4s</span>
      </div>

      <div className="move-stack">
        <div className="chain-card">
          <div className="l">From</div>
          <div className="net">
            <span className="n">Arbitrum Sepolia</span>
            <span className="b">bal 1,284,300</span>
          </div>
          <div className="amt">50,000<span className="u">USDC</span></div>
        </div>
        <div className="chain-card">
          <div className="l">To</div>
          <div className="net">
            <span className="n">Ethereum Sepolia</span>
            <span className="b">bal 318,940</span>
          </div>
          <div className="amt">50,000<span className="u">USDC</span></div>
        </div>
        <button className="swap-btn" aria-label="Swap direction">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v8 M2 6l2-2 2 2 M12 12V4 M10 10l2 2 2-2"/></svg>
        </button>
      </div>

      <div className="ccip-track">
        <div>
          <div className="lbl">CCIP route</div>
          <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink)" }}>
            arb-sepolia → eth-sepolia
          </div>
        </div>
        <div className="v">$0.00 · testnet</div>
      </div>

      <div className="order-card">
        <OrderRow l="Estimated time" v="8.4 s" />
        <OrderRow l="CCIP fee"       v="$0.00" />
        <OrderRow l="Gas"            v="$0 · sponsored" />
        <OrderRow l="Plinth credit"  v="on arrival" />
      </div>

      <button className="primary-btn">Move $50,000 USDC</button>
      <div className="order-note">No custody · routed by Chainlink CCIP</div>
    </div>
  );
}

/* ============================== AGENTS ============================== */

function PanelAgents() {
  return (
    <div className="panel active">
      <div className="section-head" style={{ marginTop: 0 }}>
        <span className="t">Your mandates · 1 active</span>
        <a href="#" className="more">New ↗</a>
      </div>
      <div className="mandate-banner">
        <div>
          <div className="top">Active · Sigil mandate</div>
          <div className="name">delphi.eth</div>
          <div className="meta">$12,418 / $50,000 · 5d left</div>
        </div>
        <button className="cta">Manage</button>
      </div>

      <div className="section-head">
        <span className="t">Rostrum · top 7d</span>
        <a href="#" className="more">All ↗</a>
      </div>

      <AgentCard name="delphi.eth"  strat="Volatility arb · 41 copiers" pnl="+ 14.82%" pos />
      <AgentCard name="pareto.eth"  strat="PT / YT spread · 27 copiers" pnl="+ 9.31%"  pos gradient="linear-gradient(135deg, #2a6f9c, #1a3b5c)" />
      <AgentCard name="helios.eth"  strat="Funding carry · 63 copiers"  pnl="+ 6.04%"  pos gradient="linear-gradient(135deg, #4a8a5e, #1f3d2a)" />
      <AgentCard name="kepler.eth"  strat="Mean reversion · 18 copiers" pnl="+ 3.18%"  pos gradient="linear-gradient(135deg, #8a6a4a, #3d2e1f)" />
      <AgentCard name="aurora.eth"  strat="Liq keeper · 11 copiers"     pnl="− 0.94%"  pos={false} gradient="linear-gradient(135deg, #6e3a3a, #2b1a1a)" />
    </div>
  );
}

function AgentCard({ name, strat, pnl, pos, gradient }: {
  name: string; strat: string; pnl: string; pos: boolean; gradient?: string;
}) {
  return (
    <div className="agent-card">
      <div className="agent-avatar" style={gradient ? { background: gradient } : undefined} />
      <div>
        <div className="n">{name}</div>
        <div className="strat">{strat}</div>
      </div>
      <div className="pnl">
        <div className={`v ${pos ? "pos" : "neg"}`}>{pnl}</div>
        <div className="l">7d</div>
      </div>
    </div>
  );
}

/* ============================== MORE ============================== */

function PanelMore() {
  return (
    <div className="panel active">
      <div className="wallet-card">
        <div className="l">Smart wallet · Postern</div>
        <div className="addr">0x1a3b…7f29</div>
        <div className="ens">atrium.eth</div>
        <div className="net">
          <span className="chip">arb-sepolia</span>
          <span className="chip">eth-sepolia</span>
          <span className="chip">passkey · touch ID</span>
        </div>
      </div>

      <div className="more-section">
        <div className="heading">Trust</div>
        <div className="more-list">
          <MoreRow label="Proof of reserves" value="38m" icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6l5-3 5 3v3c0 2.4-2.2 4-5 4s-5-1.6-5-4V6z"/><path d="M6.4 8.2l1.2 1.2 2.6-2.6"/></svg>} />
          <MoreRow label="Tax · UK CGT"      value="2026" icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="2.5" width="10" height="11" rx="1"/><path d="M5.5 5.5h5 M5.5 8h5 M5.5 10.5h3"/></svg>} />
          <MoreRow label="Session keys"      value="3"    icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 1.5"/></svg>} />
        </div>
      </div>

      <div className="more-section">
        <div className="heading">Account</div>
        <div className="more-list">
          <MoreRow label="Settings"            chev icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v2 M8 12.5v2 M1.5 8h2 M12.5 8h2"/></svg>} />
          <MoreRow label="Recovery guardians" value="3"  icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6" r="2.4"/><path d="M3 14c0-2.6 2.2-4 5-4s5 1.4 5 4"/></svg>} />
          <MoreRow label="Notifications"      value="on" icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11V7.5a4 4 0 1 1 8 0V11l1 1.5H3L4 11z"/></svg>} />
        </div>
      </div>
    </div>
  );
}

function MoreRow({ icon, label, value, chev }: { icon: React.ReactNode; label: string; value?: string; chev?: boolean }) {
  return (
    <div className="more-row">
      <div className="ic">{icon}</div>
      <div className="l">{label}</div>
      {chev ? <div className="chev">›</div> : <div className="v">{value}</div>}
    </div>
  );
}

/* ============================== ICONS ============================== */

function IconHome()   { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>; }
function IconTrade()  { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 15.5l4-4 3.5 3.5 7-7"/><path d="M13 8h5v5"/></svg>; }
function IconMove()   { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h15l-3-3 M19 15H4l3 3"/></svg>; }
function IconAgents() { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="8" r="3"/><path d="M4 18c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5"/></svg>; }
function IconMore()   { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="6" r="1.5"/><circle cx="11" cy="11" r="1.5"/><circle cx="11" cy="16" r="1.5"/></svg>; }
