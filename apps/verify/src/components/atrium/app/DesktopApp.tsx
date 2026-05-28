'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppIcon, type AppIconName } from "./AppIcon";
import {
  APP_VENUES, APP_POSITIONS, APP_AGENTS, APP_MANDATES, APP_ACTIVITY,
  APP_RESERVES, APP_TAX_LOTS, APP_ME, fmtUsd, fmtPct, shortAddr,
} from "@/lib/atrium/appMock";

/* ====================================================================
 * Route table — internal panel switching (mirrors hash router in refs)
 * ==================================================================== */
type RouteId =
  | "portfolio" | "trade" | "transfer" | "agents"
  | "reserves" | "tax" | "settings";

type RouteDef = { id: RouteId; label: string; group: string; icon: AppIconName; title: string; sub: string; pill?: string };

const ROUTES: RouteDef[] = [
  { id: "portfolio", label: "Portfolio", group: "trade",   icon: "portfolio", title: "Portfolio", sub: "Plinth · unified margin" },
  { id: "trade",     label: "Trade",     group: "trade",   icon: "trade",     title: "Trade",     sub: "Portico · venue execution" },
  { id: "transfer",  label: "Transfer",  group: "trade",   icon: "transfer",  title: "Transfer",  sub: "Aqueduct · Chainlink CCIP" },
  { id: "agents",    label: "Agents",    group: "agents",  icon: "agents",    title: "Agents",    sub: "Sigil · Rostrum", pill: "3" },
  { id: "reserves",  label: "Reserves",  group: "trust",   icon: "reserves",  title: "Reserves",  sub: "Lantern · proof-of-reserves", pill: "✓" },
  { id: "tax",       label: "Tax",       group: "trust",   icon: "tax",       title: "Tax",       sub: "Tablet · exports" },
  { id: "settings",  label: "Settings",  group: "account", icon: "settings",  title: "Settings",  sub: "Postern · wallet" },
];

const GROUPS = [
  { id: "trade",   label: "Trade" },
  { id: "agents",  label: "Agents" },
  { id: "trust",   label: "Trust" },
  { id: "account", label: "Account" },
];

/* ====================================================================
 * AppShell
 * ==================================================================== */
export function DesktopApp() {
  const [route, setRoute] = useState<RouteId>("portfolio");
  const r = ROUTES.find((x) => x.id === route)!;

  return (
    <div className="atrium-app">
      {/* Sidebar */}
      <aside className="side">
        <div className="side-brand">
          <Link href="/" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none" }} aria-label="Atrium home">
            <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20, color: "var(--ink)", letterSpacing: "-0.014em" }}>Atrium</span>
          </Link>
          <span className="pill testnet"><span className="dot" />testnet</span>
        </div>
        <div className="side-search">
          <AppIcon name="search" size={14} />
          <span>Search · positions, agents</span>
          <span className="kbd">⌘K</span>
        </div>
        {GROUPS.map((g) => (
          <div key={g.id} className="side-section">
            <div className="side-section-head">{g.label}</div>
            {ROUTES.filter((x) => x.group === g.id).map((x) => (
              <button
                key={x.id}
                className={"side-link" + (route === x.id ? " active" : "")}
                onClick={() => setRoute(x.id)}
              >
                <span className="si"><AppIcon name={x.icon} size={15} /></span>
                <span>{x.label}</span>
                {x.pill && <span className="pill-mini">{x.pill}</span>}
              </button>
            ))}
          </div>
        ))}
        <div className="side-foot">
          <div className="side-wallet">
            <div className="avatar" />
            <div>
              <div className="ad">{shortAddr(APP_ME.address)}</div>
              <div className="net">arb-sepolia · rh-chain</div>
            </div>
            <span style={{ color: "var(--muted)" }}><AppIcon name="chev" size={14} /></span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="app-main">
        <div className="topbar">
          <div className="crumb">
            <span className="crumb-main">{r.title}</span>
            <span className="crumb-sep">·</span>
            <span className="crumb-sub">{r.sub}</span>
          </div>
          <div className="topbar-right">
            <span className="pill"><span className="dot" /> live · arb-sepolia</span>
            <button className="icon-btn" title="Notifications"><AppIcon name="bell" size={14} /></button>
            <button className="icon-btn" title="Refresh"><AppIcon name="refresh" size={14} /></button>
            <button className="btn" onClick={() => setRoute("trade")}><AppIcon name="plus" size={12} /> New trade</button>
          </div>
        </div>

        {route === "portfolio" && <Portfolio onNav={setRoute} />}
        {route === "trade"     && <Trade />}
        {route === "transfer"  && <Transfer />}
        {route === "agents"    && <Agents />}
        {route === "reserves"  && <Reserves />}
        {route === "tax"       && <Tax />}
        {route === "settings"  && <Settings />}
      </main>
    </div>
  );
}

/* ====================================================================
 * Shared atoms
 * ==================================================================== */
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: "var(--live)" } : undefined}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function AddressChip({ address, label }: { address: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      onClick={copy}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 9px", borderRadius: 999,
        border: "1px solid var(--hairline)", background: "var(--bg-raised)",
        color: "var(--ink-soft)", cursor: "pointer", fontSize: 12,
      }}
    >
      {label && <span className="muted" style={{ marginRight: 6 }}>{label}</span>}
      <span className="mono" style={{ fontSize: 11.5 }}>{shortAddr(address)}</span>
      <AppIcon name={copied ? "check" : "copy"} size={12} />
    </button>
  );
}

/* ====================================================================
 * Portfolio
 * ==================================================================== */
function synthSpark(seed = 1, len = 30, trend = 0): number[] {
  const out: number[] = []; let v = 1;
  for (let i = 0; i < len; i++) {
    v += Math.sin(i * 0.3 + seed) * 0.05 + (trend * i / len) +
         (((seed * 9301 + i * 49297) % 233280) / 233280 - 0.5) * 0.06;
    out.push(v);
  }
  return out;
}

function Portfolio({ onNav }: { onNav: (r: RouteId) => void }) {
  const [leverage, setLeverage] = useState(3.0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1800);
    return () => clearInterval(t);
  }, []);

  const totalCollateral = useMemo(() =>
    APP_VENUES.reduce((s, v) => s + v.collateral, 0) + Math.sin(tick * 0.6) * 12000,
    [tick]);
  const buyingPower = totalCollateral * leverage;
  const pnl24h = APP_POSITIONS.reduce((s, p) => s + p.pnl24h, 0);
  const totalNotional = APP_POSITIONS.reduce((s, p) => s + p.notional, 0);
  const utilization = (totalNotional / buyingPower) * 100;
  const sparkData = useMemo(() => synthSpark(7, 30, 0.18), []);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Portfolio</div>
          <h1 className="view-title">Unified margin</h1>
          <div className="view-sub" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AddressChip address={APP_ME.address} label="Wallet" />
            <span className="muted">· {APP_ME.ens}</span>
          </div>
        </div>
        <div className="view-actions">
          <button className="btn ghost" onClick={() => onNav("transfer")}><AppIcon name="transfer" size={14} /> Transfer</button>
          <button className="btn ghost" onClick={() => onNav("agents")}><AppIcon name="agents" size={14} /> Delegate</button>
          <button className="btn large" onClick={() => onNav("trade")}><AppIcon name="trade" size={14} /> Trade</button>
        </div>
      </div>

      <div className="stat-grid mb-5">
        <StatCard label="Buying power"     value={fmtUsd(buyingPower)} sub={`at ${leverage.toFixed(1)}× portfolio margin`} />
        <StatCard label="Total collateral" value={fmtUsd(totalCollateral)} sub="across 7 live venues" />
        <StatCard label="Open notional"    value={fmtUsd(totalNotional)} sub={`${utilization.toFixed(1)}% utilisation`} />
        <StatCard label="P&L · 24h"        value={fmtUsd(pnl24h, { signed: true })} sub={fmtPct(pnl24h / totalCollateral * 100) + " on collateral"} accent={pnl24h > 0} />
      </div>

      <div className="grid-2 mb-5">
        <PlinthHealth leverage={leverage} setLeverage={setLeverage} utilization={utilization} buyingPower={buyingPower} />
        <BuyingPowerChart data={sparkData} value={buyingPower} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }} className="atrium-pf-grid">
        <PositionsCard />
        <ActivityCard />
      </div>
      <style>{`@media (max-width:1100px){.atrium-pf-grid{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );
}

function PlinthHealth({ leverage, setLeverage, utilization, buyingPower }: { leverage: number; setLeverage: (n: number) => void; utilization: number; buyingPower: number }) {
  const status = utilization < 60 ? "healthy" : utilization < 85 ? "warning" : "critical";
  const statusColor = status === "healthy" ? "var(--live)" : status === "warning" ? "oklch(60% 0.14 70)" : "var(--neg)";
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Plinth · margin health</div>
          <div className="muted small mt-2">SPAN-style portfolio margin · Rust → WASM</div>
        </div>
        <span className="tag green">
          <span style={{ width: 6, height: 6, borderRadius: 999, background: statusColor }} />
          {status}
        </span>
      </div>
      <div style={{ marginTop: 18 }}>
        <div className="between-bl mb-2">
          <span className="cap">Utilisation</span>
          <span className="num" style={{ fontSize: 13.5 }}>{utilization.toFixed(1)}%</span>
        </div>
        <div className="util-bar">
          <div className="util-fill" style={{ width: `${Math.min(100, utilization)}%`, background: statusColor }} />
          <div className="util-marker" style={{ left: "60%" }} />
          <div className="util-marker warning" style={{ left: "85%" }} />
        </div>
        <div className="between mt-2 cap muted">
          <span>0%</span><span>60% · soft</span><span>85% · hard</span><span>100%</span>
        </div>
      </div>
      <div className="card-divider" />
      <div className="field" style={{ gap: 10 }}>
        <div className="between-bl">
          <label>Portfolio margin · leverage</label>
          <span className="num strong" style={{ fontSize: 14 }}>{leverage.toFixed(1)}×</span>
        </div>
        <input type="range" min={1} max={10} step={0.1} value={leverage} onChange={(e) => setLeverage(parseFloat(e.target.value))} />
        <div className="between cap muted"><span>1×</span><span>10×</span></div>
      </div>
      <div className="card-divider" />
      <div className="grid-2" style={{ gap: 12 }}>
        <div>
          <div className="cap">Headroom</div>
          <div className="num mt-2" style={{ fontSize: 18 }}>{fmtUsd(buyingPower * (1 - utilization / 100))}</div>
        </div>
        <div>
          <div className="cap">Liquidation buffer</div>
          <div className="num mt-2" style={{ fontSize: 18 }}>
            {(100 - utilization).toFixed(1)}% <span className="muted" style={{ fontSize: 12 }}>headroom</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BuyingPowerChart({ data, value }: { data: number[]; value: number }) {
  const w = 540, h = 180;
  const padL = 0, padR = 6, padT = 8, padB = 22;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const xAt = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const yAt = (v: number) => padT + (1 - (v - min) / range) * innerH;
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`).join(" ");
  const last = data[data.length - 1];
  const lastY = yAt(last);
  const lastX = xAt(data.length - 1);
  // x-axis labels: 30d ago, 20d, 10d, today
  const xLabels = [
    { i: 0, t: "30d" },
    { i: 10, t: "20d" },
    { i: 20, t: "10d" },
    { i: data.length - 1, t: "today" },
  ];
  // gridlines: 4 horizontal
  const grid = [0.25, 0.5, 0.75];
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Buying power · 30 days</div>
          <div className="muted small mt-2">Plinth output, computed every block</div>
        </div>
        <div className="seg">
          <button>24h</button><button>7d</button><button className="on">30d</button><button>90d</button>
        </div>
      </div>
      <div className="num" style={{ fontSize: 32, letterSpacing: "-0.022em", marginTop: 6 }}>{fmtUsd(value)}</div>
      <div className="mt-2 cap" style={{ color: "var(--live)" }}>+ $284,920 · 24h</div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 180, marginTop: 14, display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="bpfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="var(--ink)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {grid.map((g) => (
          <line key={g} x1={padL} x2={padL + innerW} y1={padT + g * innerH} y2={padT + g * innerH}
                stroke="var(--hairline)" strokeWidth={1} strokeDasharray="2 4" />
        ))}
        <line x1={padL} x2={padL + innerW} y1={padT + innerH} y2={padT + innerH} stroke="var(--hairline)" strokeWidth={1} />
        {/* area + line */}
        <path d={`${path} L ${lastX} ${padT + innerH} L ${padL} ${padT + innerH} Z`} fill="url(#bpfill)" />
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {/* endpoint */}
        <circle cx={lastX} cy={lastY} r={5} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.5} />
        <circle cx={lastX} cy={lastY} r={2} fill="var(--ink)" />
        {/* x labels */}
        {xLabels.map((l) => (
          <text key={l.t} x={xAt(l.i)} y={h - 6} fontSize="10" fill="var(--muted)"
                textAnchor={l.i === 0 ? "start" : l.i === data.length - 1 ? "end" : "middle"}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {l.t}
          </text>
        ))}
      </svg>
    </div>
  );
}

function PositionsCard() {
  const [filter, setFilter] = useState<"all" | "arb-sepolia" | "rh-chain">("all");
  const venueOf = (id: string) => APP_VENUES.find((v) => v.id === id)!;
  const filtered = filter === "all" ? APP_POSITIONS : APP_POSITIONS.filter((p) => venueOf(p.venue).chainShort === filter);

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: "16px 20px 12px", marginBottom: 0 }}>
        <div>
          <div className="card-title">Open positions · {filtered.length}</div>
          <div className="muted small mt-2">Across {new Set(APP_POSITIONS.map((p) => p.venue)).size} venues</div>
        </div>
        <div className="seg">
          <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All</button>
          <button className={filter === "arb-sepolia" ? "on" : ""} onClick={() => setFilter("arb-sepolia")}>Arbitrum</button>
          <button className={filter === "rh-chain" ? "on" : ""} onClick={() => setFilter("rh-chain")}>RH-Chain</button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Instrument</th><th>Venue</th><th>Size</th>
            <th className="ar">Notional</th><th className="ar">Entry · Mark</th>
            <th className="ar">P&amp;L · 24h</th><th className="ar">Margin</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => {
            const v = venueOf(p.venue);
            const isSupply = p.side === "supply";
            return (
              <tr key={p.id}>
                <td className="strong">
                  <div className="mono">{p.instrument}</div>
                  <div className="muted cap mt-2" style={{ fontSize: 9.5 }}>
                    {isSupply ? "Supply" : `${p.side.toUpperCase()} · ${p.leverage}×`}
                  </div>
                </td>
                <td>
                  <div className="strong">{v.name}</div>
                  <div className="muted small">{v.chain}</div>
                </td>
                <td className="num">{p.size}</td>
                <td className="ar num strong">{fmtUsd(p.notional)}</td>
                <td className="ar num">
                  {p.entry < 100 ? p.entry.toFixed(4) : p.entry.toLocaleString()}
                  <span className="muted"> · {p.mark < 100 ? p.mark.toFixed(4) : p.mark.toLocaleString()}</span>
                </td>
                <td className={"ar num strong " + (p.pnl24h > 0 ? "pos" : "neg")}>
                  {fmtUsd(p.pnl24h, { signed: true })}
                  <div className={"small " + (p.pnl24h > 0 ? "pos" : "neg")} style={{ fontWeight: 400 }}>{fmtPct(p.pnlPct)}</div>
                </td>
                <td className="ar num">{p.margin ? fmtUsd(p.margin, { compact: true }) : <span className="muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActivityCard() {
  const iconOf = (k: string): AppIconName => ({
    agent: "agents", sigil: "shield", deposit: "transfer", vigil: "shield",
    lantern: "reserves", trade: "trade", transfer: "transfer",
  } as Record<string, AppIconName>)[k] || "info";

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: "16px 20px 12px", marginBottom: 0 }}>
        <div>
          <div className="card-title">Activity</div>
          <div className="muted small mt-2">Live feed from Scribe</div>
        </div>
        <span className="pill"><span className="dot" /> live</span>
      </div>
      <div style={{ padding: "4px 20px 20px" }}>
        {APP_ACTIVITY.map((a) => (
          <div key={a.id} className="activity-row">
            <span className="act-icon"><AppIcon name={iconOf(a.kind)} size={13} /></span>
            <div className="col" style={{ gap: 3, minWidth: 0 }}>
              <div className="strong small">{a.desc}</div>
              <div className="muted mono" style={{ fontSize: 10.5 }}>{a.ts} · {a.hash}</div>
            </div>
            <div className={"mono small " + (a.ok ? "" : "neg")} style={{ textAlign: "right", whiteSpace: "nowrap" }}>{a.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ====================================================================
 * Trade
 * ==================================================================== */
function Trade() {
  const [venueId, setVenueId] = useState("hl3");
  const [side, setSide] = useState<"long" | "short">("long");
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [size, setSize] = useState("1200");
  const [leverage, setLev] = useState(4);
  const [limitPx, setLimit] = useState("251.40");
  const venue = APP_VENUES.find((v) => v.id === venueId)!;
  const mark = 251.10;
  const notional = parseFloat(size || "0") * mark;
  const margin = notional / leverage;
  const fee = notional * 0.0006;

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Trade · Portico</div>
          <h1 className="view-title">Execute across eight venues</h1>
          <div className="view-sub">One signature opens, adjusts, or closes a position on any registered Portico adapter.</div>
        </div>
      </div>

      <div className="venue-strip">
        {APP_VENUES.map((v) => {
          const active = venueId === v.id;
          const pending = v.status === "pending";
          return (
            <button key={v.id} onClick={() => !pending && setVenueId(v.id)} disabled={pending}
              className={"venue-pick" + (active ? " active" : "") + (pending ? " pending" : "")}>
              <div className="between-bl">
                <span className="strong">{v.short}</span>
                {active && <AppIcon name="check" size={13} />}
                {pending && <span className="mono cap" style={{ fontSize: 9.5, color: "var(--muted)" }}>soon</span>}
              </div>
              <div className="muted small mt-2">{v.type}</div>
              <div className="num mt-2" style={{ fontSize: 14 }}>
                {pending ? <span className="muted">—</span> : fmtUsd(v.collateral, { compact: true })}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(0,1.15fr) minmax(0,0.95fr)", gap: 18, alignItems: "start" }}>
        {/* Order entry */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Order · {venue.short}</div>
            <span className="tag">{venue.chain}</span>
          </div>
          <div className="seg" style={{ width: "100%" }}>
            <button className={side === "long" ? "on" : ""} onClick={() => setSide("long")} style={{ flex: 1, ...(side === "long" ? { color: "var(--live)" } : {}) }}>Long</button>
            <button className={side === "short" ? "on" : ""} onClick={() => setSide("short")} style={{ flex: 1, ...(side === "short" ? { color: "var(--neg)" } : {}) }}>Short</button>
          </div>
          <div className="seg mt-4" style={{ width: "100%" }}>
            {(["market", "limit", "stop"] as const).map((t) => (
              <button key={t} className={orderType === t ? "on" : ""} onClick={() => setOrderType(t)} style={{ flex: 1, textTransform: "capitalize" }}>{t}</button>
            ))}
          </div>
          <div className="field mt-4">
            <label>Size · contracts</label>
            <input className="input num-input" value={size} onChange={(e) => setSize(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
          {orderType !== "market" && (
            <div className="field mt-3">
              <label>{orderType === "stop" ? "Stop trigger" : "Limit price"}</label>
              <input className="input" value={limitPx} onChange={(e) => setLimit(e.target.value)} />
            </div>
          )}
          <div className="field mt-4">
            <div className="between-bl mb-2">
              <label>Leverage</label>
              <span className="num strong" style={{ fontSize: 13 }}>{leverage}×</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={leverage} onChange={(e) => setLev(parseInt(e.target.value))} />
            <div className="between cap muted"><span>1×</span><span>10×</span></div>
          </div>
          <div className="card-divider" />
          <div className="kv">
            <div><span>Notional</span><span className="num">{fmtUsd(notional)}</span></div>
            <div><span>Initial margin</span><span className="num">{fmtUsd(margin)}</span></div>
            <div><span>Estimated fee</span><span className="num">{fmtUsd(fee, { decimals: 2 })}</span></div>
            <div><span>Slippage tolerance</span><span className="num">0.10%</span></div>
          </div>
          <button className="btn large mt-5" style={{ width: "100%", justifyContent: "center", background: side === "long" ? "var(--live)" : "var(--neg)", borderColor: side === "long" ? "var(--live)" : "var(--neg)" }}>
            {side === "long" ? "Open long" : "Open short"} · {orderType}
          </button>
          <div className="cap muted mt-3" style={{ textAlign: "center" }}>One signature · Plinth verifies cross-product margin onchain</div>
        </div>

        {/* Order book */}
        <OrderBook venue={venue} mark={mark} />

        {/* Impact */}
        <ImpactCard notional={notional} margin={margin} fee={fee} leverage={leverage} side={side} />
      </div>
    </div>
  );
}

function OrderBook({ venue, mark }: { venue: typeof APP_VENUES[number]; mark: number }) {
  const bids = [{px:251.08,sz:1820,total:1820},{px:251.04,sz:2420,total:4240},{px:251.00,sz:1140,total:5380},{px:250.96,sz:3120,total:8500},{px:250.92,sz:840,total:9340},{px:250.88,sz:2210,total:11550}];
  const asks = [{px:251.14,sz:1640,total:1640},{px:251.18,sz:2120,total:3760},{px:251.22,sz:1840,total:5600},{px:251.28,sz:2950,total:8550},{px:251.34,sz:920,total:9470},{px:251.40,sz:1740,total:11210}].reverse();
  const maxTotal = Math.max(...bids.concat(asks).map((o) => o.total));
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">rTSLA-PERP</div>
          <div className="muted small mt-2">{venue.name}</div>
        </div>
        <div className="ar">
          <div className="num strong" style={{ fontSize: 18 }}>{mark.toFixed(2)}</div>
          <div className="pos small mono">+ 1.13% · 24h</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontFamily: "var(--mono)", fontSize: 11.5 }}>
        <tbody>
          {asks.map((o, i) => (
            <tr key={"a"+i} style={{ color: "var(--neg)" }}>
              <td style={{ padding: "4px 8px", position: "relative" }} className="num">{o.px.toFixed(2)}</td>
              <td style={{ padding: "4px 8px" }} className="num ar">{o.sz.toLocaleString()}</td>
              <td style={{ padding: "4px 8px", color: "var(--muted)" }} className="num ar">{o.total.toLocaleString()}</td>
              <td style={{ padding: "4px 8px", width: "30%", position: "relative" }}>
                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", height: 14, width: `${(o.total/maxTotal)*100}%`, opacity: 0.12, borderRadius: 2, background: "var(--neg)" }} />
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ padding: 8, textAlign: "center", background: "var(--bg-sunk)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", fontSize: 13, color: "var(--ink)", fontWeight: 500 }} className="num">
              {mark.toFixed(2)} <span className="muted small">· spread 0.06</span>
            </td>
          </tr>
          {bids.map((o, i) => (
            <tr key={"b"+i} style={{ color: "var(--live)" }}>
              <td style={{ padding: "4px 8px", position: "relative" }} className="num">{o.px.toFixed(2)}</td>
              <td style={{ padding: "4px 8px" }} className="num ar">{o.sz.toLocaleString()}</td>
              <td style={{ padding: "4px 8px", color: "var(--muted)" }} className="num ar">{o.total.toLocaleString()}</td>
              <td style={{ padding: "4px 8px", width: "30%", position: "relative" }}>
                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", height: 14, width: `${(o.total/maxTotal)*100}%`, opacity: 0.12, borderRadius: 2, background: "var(--live)" }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImpactCard({ notional, margin, fee, leverage, side }: { notional: number; margin: number; fee: number; leverage: number; side: "long" | "short" }) {
  const beforeBP = 12378422;
  const afterBP = beforeBP - margin;
  const utilBefore = 38.4;
  const utilAfter = utilBefore + (notional / beforeBP * 100);
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Margin impact</div>
          <div className="muted small mt-2">Plinth · pre-execution</div>
        </div>
        <span className="tag green"><AppIcon name="check" size={11} /> Within mandate</span>
      </div>
      {[
        { label: "Buying power", b: fmtUsd(beforeBP, { compact: true }), a: fmtUsd(afterBP, { compact: true }) },
        { label: "Utilisation", b: utilBefore.toFixed(1) + "%", a: utilAfter.toFixed(1) + "%" },
        { label: "Liquidation price", b: "—", a: side === "long" ? "228.40" : "274.20" },
      ].map((r) => (
        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
          <div className="cap">{r.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end", color: "var(--muted)" }}>
            <div className="num" style={{ color: "var(--muted)" }}>{r.b}</div>
            <AppIcon name="arrow" size={12} />
            <div className="num strong">{r.a}</div>
          </div>
        </div>
      ))}
      <div className="card-divider" />
      <div className="kv">
        <div><span>Position</span><span className="num strong">{side.toUpperCase()} · {leverage}× · {fmtUsd(notional, { compact: true })}</span></div>
        <div><span>Initial margin</span><span className="num">{fmtUsd(margin)}</span></div>
        <div><span>Maintenance margin</span><span className="num">{fmtUsd(margin * 0.5)}</span></div>
        <div><span>Fees</span><span className="num">{fmtUsd(fee, { decimals: 2 })} · taker 6 bps</span></div>
        <div><span>Gas · arb-sepolia</span><span className="num">$0.00 · sponsored</span></div>
      </div>
      <div className="card-divider" />
      <div className="cap muted" style={{ lineHeight: 1.6 }}>
        Order is checked against your Plinth headroom and any active Sigil mandate before signing. Vigil monitors the position every block.
      </div>
    </div>
  );
}

/* ====================================================================
 * Transfer
 * ==================================================================== */
function Transfer() {
  const CHAINS = [
    { id: "arb-sepolia", name: "Arbitrum Sepolia" },
    { id: "eth-sepolia", name: "Ethereum Sepolia" },
    { id: "rh-chain",    name: "Robinhood Chain" },
    { id: "polygon",     name: "Polygon (Aqueduct)" },
  ];
  const TOKENS = ["USDC", "WETH", "WBTC", "rAAPL", "rTSLA", "PT-stETH", "USTB"];
  const [fromChain, setFromChain] = useState("arb-sepolia");
  const [toChain, setToChain]     = useState("rh-chain");
  const [token, setToken]         = useState("USDC");
  const [amount, setAmount]       = useState("50000");
  const [bridging, setBridging]   = useState(false);
  const [progress, setProgress]   = useState(0);

  const start = () => {
    setBridging(true); setProgress(0);
    let p = 0;
    const t = setInterval(() => {
      p++; setProgress(p);
      if (p >= 4) {
        clearInterval(t);
        setTimeout(() => { setBridging(false); setProgress(0); }, 3000);
      }
    }, 1400);
  };
  const swap = () => { setFromChain(toChain); setToChain(fromChain); };

  const STEPS = ["Signed on source", "CCIP message", "Attested by DON", "Posted on dest"];

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Transfer · Aqueduct</div>
          <h1 className="view-title">Move collateral between chains</h1>
          <div className="view-sub">Aqueduct routes through Chainlink CCIP. Posted collateral becomes Plinth credit on arrival.</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)", gap: 18, alignItems: "start" }}>
        <div className="card" style={{ padding: 0 }}>
          <div className="card-head" style={{ padding: "16px 22px 0", marginBottom: 0 }}>
            <div className="card-title">New transfer</div>
            <span className="pill"><span className="dot" /> CCIP testnet</span>
          </div>
          <div style={{ padding: 22 }}>
            <div className="field mb-3">
              <label>Token</label>
              <select className="select" value={token} onChange={(e) => setToken(e.target.value)}>
                {TOKENS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
              <ChainBox label="From" chains={CHAINS} value={fromChain} setValue={setFromChain} balance="1,284,300" token={token} />
              <button className="icon-btn" onClick={swap} title="Swap direction"><AppIcon name="transfer" size={14} /></button>
              <ChainBox label="To"   chains={CHAINS} value={toChain}   setValue={setToChain}   balance="318,940"   token={token} />
            </div>

            <div className="field mt-4">
              <label>Amount</label>
              <div style={{ position: "relative" }}>
                <input className="input num-input" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
                <div className="mono" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13 }}>{token}</div>
              </div>
              <div className="between mt-2 small muted">
                <span>≈ {fmtUsd(parseFloat(amount || "0"))} USD</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {["25000","50000","100000"].map((v, i) => (
                    <button key={v} className="btn ghost tiny" onClick={() => setAmount(v)}>{["25%","50%","Max"][i]}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="card-divider" />
            <div className="kv">
              <div><span>Estimated time</span><span className="num">8.4s</span></div>
              <div><span>CCIP fee</span><span className="num">$0.00 · testnet</span></div>
              <div><span>Gas · {fromChain}</span><span className="num">$0.00 · Postern sponsored</span></div>
              <div><span>Plinth credit posted</span><span className="num">On arrival</span></div>
            </div>
            <button className="btn large mt-5" style={{ width: "100%", justifyContent: "center" }} onClick={start} disabled={bridging}>
              {bridging ? "Bridging…" : `Transfer ${amount} ${token}`} {!bridging && <AppIcon name="arrow" size={14} />}
            </button>
            <div className="cap muted mt-3" style={{ textAlign: "center" }}>
              Cross-chain message goes through Chainlink CCIP. Atrium never custodies funds.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">{bridging ? "Bridging…" : "Progress"}</div>
            <span className={"tag " + (bridging ? "amber" : "green")}>{bridging ? "in-flight" : "idle"}</span>
          </div>
          <div className="col" style={{ gap: 14, marginTop: 10 }}>
            {STEPS.map((label, i) => {
              const done = progress > i || (!bridging && i < 0);
              const current = bridging && progress === i;
              return (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 12, alignItems: "center" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 999, border: "1px solid var(--line)", background: done ? "var(--live)" : current ? "var(--ink)" : "var(--bg)", color: done || current ? "var(--bg)" : "var(--muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11 }}>
                    {done ? <AppIcon name="check" size={11} /> : i + 1}
                  </span>
                  <span className={done ? "strong" : "muted"}>{label}</span>
                  <span className="mono small muted">{done ? "ok" : current ? "…" : ""}</span>
                </div>
              );
            })}
          </div>
          <div className="card-divider" />
          <div className="cap mb-3">Recent transfers</div>
          <div className="col" style={{ gap: 8 }}>
            {[
              { from: "arb-sepolia", to: "rh-chain",   amt: "$200,000 USDC", t: "8.2s", ok: true },
              { from: "eth-sepolia", to: "arb-sepolia",amt: "$50,000 USDC",  t: "9.6s", ok: true },
              { from: "arb-sepolia", to: "polygon",    amt: "$5,000 USDC",   t: "11.4s",ok: true },
            ].map((x, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, padding: "10px 12px", background: "var(--bg-sunk)", borderRadius: 8 }}>
                <div className="mono small">{x.from} → {x.to}</div>
                <div className="num small strong">{x.amt}</div>
                <div className="muted small mono">{x.t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChainBox({ label, chains, value, setValue, balance, token }: { label: string; chains: { id: string; name: string }[]; value: string; setValue: (s: string) => void; balance: string; token: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="cap">{label}</div>
      <select className="select mt-2" value={value} onChange={(e) => setValue(e.target.value)}>
        {chains.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="mt-3 between small">
        <span className="muted">Balance</span>
        <span className="num strong">{balance} {token}</span>
      </div>
    </div>
  );
}

/* ====================================================================
 * Agents
 * ==================================================================== */
function Agents() {
  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Agents · Sigil · Rostrum</div>
          <h1 className="view-title">Delegate to autonomous agents</h1>
          <div className="view-sub">Per-action caps, daily-loss limits, venue allowlists, expiry. Kill switch revokes every mandate in one signature.</div>
        </div>
        <div className="view-actions">
          <button className="btn ghost"><AppIcon name="shield" size={14} /> Kill switch</button>
          <button className="btn"><AppIcon name="plus" size={12} /> New mandate</button>
        </div>
      </div>

      <div className="stat-grid mb-5">
        <StatCard label="Active mandates" value="3" sub="2 expiring this week" />
        <StatCard label="Cap committed"   value={fmtUsd(150000)} sub={fmtUsd(62118) + " used"} />
        <StatCard label="7d agent P&L"    value={fmtUsd(2840, { signed: true })} sub="across 3 agents" accent />
        <StatCard label="Rostrum agents"  value={String(APP_AGENTS.length)} sub="public marketplace" />
      </div>

      <div className="card mb-5" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: "16px 20px 12px", marginBottom: 0 }}>
          <div className="card-title">My mandates</div>
          <span className="muted small">Live · ERC-8004</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Agent</th><th>Cap · used</th><th>Venues</th>
              <th>TTL</th><th>Tx</th><th className="ar">Status</th>
            </tr>
          </thead>
          <tbody>
            {APP_MANDATES.map((m) => (
              <tr key={m.id}>
                <td className="strong mono">{m.agent}</td>
                <td>
                  <div className="num strong">{fmtUsd(m.cap, { compact: true })}</div>
                  <div className="muted small">{fmtUsd(m.used, { compact: true })} used</div>
                </td>
                <td className="mono small">{m.venues.join(" · ")}</td>
                <td className="num">{m.ttlDays > 0 ? `${m.ttlDays}d` : "—"}</td>
                <td className="num">{m.txCount}</td>
                <td className="ar">
                  <span className={"tag " + (m.status === "active" ? "green" : m.status === "expired" ? "amber" : "red")}>
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: "16px 20px 12px", marginBottom: 0 }}>
          <div>
            <div className="card-title">Rostrum · top performers</div>
            <div className="muted small mt-2">7-day P&amp;L · sortable, public, onchain track record</div>
          </div>
          <div className="seg">
            <button className="on">7d</button><button>30d</button><button>90d</button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Agent</th><th>Strategy</th>
              <th className="ar">7d P&amp;L</th><th className="ar">Sharpe</th>
              <th className="ar">AUM</th><th className="ar">Copiers</th>
              <th className="ar">Fee</th><th className="ar"></th>
            </tr>
          </thead>
          <tbody>
            {APP_AGENTS.map((a) => (
              <tr key={a.id}>
                <td className="strong mono">{a.handle}</td>
                <td>{a.strategy}</td>
                <td className={"ar num strong " + (a.pnl7d > 0 ? "pos" : "neg")}>{fmtPct(a.pnl7d)}</td>
                <td className="ar num">{a.sharpe.toFixed(2)}</td>
                <td className="ar num">{fmtUsd(a.aum, { compact: true })}</td>
                <td className="ar num">{a.copiers}</td>
                <td className="ar num">{(a.fee * 100).toFixed(0)}%</td>
                <td className="ar"><button className="btn tiny">Mandate</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ====================================================================
 * Reserves
 * ==================================================================== */
function Reserves() {
  const total = APP_VENUES.reduce((s, v) => s + v.collateral, 0);
  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Reserves · Lantern</div>
          <h1 className="view-title">Hourly proof-of-reserves</h1>
          <div className="view-sub">Atrium never custodies funds. Every hour Lantern publishes a signed Merkle attestation on Arbitrum Sepolia.</div>
        </div>
        <div className="view-actions">
          <button className="btn ghost"><AppIcon name="download" size={14} /> Verifier (14kb)</button>
        </div>
      </div>

      <div className="stat-grid mb-5">
        <StatCard label="On-chain reserves"          value={fmtUsd(total, { compact: true })} sub="Across 7 live venues" />
        <StatCard label="Reported liabilities"       value={fmtUsd(total, { compact: true })} sub="0.00 bps delta" />
        <StatCard label="Last attestation"           value="38m ago" sub="Block #8,142,317" accent />
        <StatCard label="Independent verifications"  value="2,140" sub="Last 24h" />
      </div>

      <div className="grid-2 mb-5">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Latest attestation</div>
              <div className="muted small mt-2">Block #8,142,317 · 38 min ago · arb-sepolia</div>
            </div>
            <span className="tag green"><AppIcon name="check" size={11} /> verified</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 14 }}>
            <div>
              <div className="cap">Merkle root</div>
              <div className="mono mt-2" style={{ fontSize: 12, wordBreak: "break-all" }}>0xa72f4d8c1e2f9b3a5c4d6e8f9a1b2c3d4e5f6789abcdef0123456789abcdef91c4</div>
            </div>
            <div>
              <div className="cap">Attested at</div>
              <div className="mono mt-2" style={{ fontSize: 12 }}>2026-05-18 16:00:14 UTC</div>
              <div className="cap mt-4">Signed by</div>
              <div className="mono mt-2" style={{ fontSize: 12 }}>0x4f29…81e0 · 3 of 5</div>
            </div>
          </div>
          <div className="card-divider" />
          <div className="cap mb-3">Per-venue reserves</div>
          <div className="col" style={{ gap: 6 }}>
            {APP_VENUES.map((v) => {
              const pending = v.status === "pending";
              return (
                <div key={v.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr auto auto", gap: 12, alignItems: "center", padding: "8px 12px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 13, opacity: pending ? 0.5 : 1 }}>
                  <span className="mono small">{v.short}</span>
                  <span className="muted small">{v.chain}</span>
                  <span className="num strong">{pending ? <span className="muted">pending SDK</span> : fmtUsd(v.collateral, { compact: true })}</span>
                  <span className={"tag " + (pending ? "amber" : "green")} style={{ padding: "1px 6px", fontSize: 9.5 }}>{pending ? "soon" : "✓"}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Merkle structure</div>
              <div className="muted small mt-2">Verify any leaf against root locally</div>
            </div>
            <a className="mono small muted" href="#" style={{ textDecoration: "underline" }}>View on Etherscan ↗</a>
          </div>
          <svg viewBox="0 0 540 220" width="100%" height={220} style={{ marginTop: 8, color: "var(--ink)" }}>
            <g>
              <line x1="270" y1="30" x2="135" y2="80" stroke="currentColor" strokeWidth={1} opacity={0.5} />
              <line x1="270" y1="30" x2="405" y2="80" stroke="currentColor" strokeWidth={1} opacity={0.5} />
              <rect x="240" y="14" width="60" height="22" fill="var(--ink)" rx={4} />
              <text x="270" y="29" textAnchor="middle" fontFamily="var(--mono)" fontSize={10} fill="var(--bg)">ROOT</text>
            </g>
            {[135, 405].map((x, i) => (
              <g key={i}>
                <line x1={x} y1={100} x2={x - 65} y2={150} stroke="currentColor" strokeWidth={1} opacity={0.4} />
                <line x1={x} y1={100} x2={x + 65} y2={150} stroke="currentColor" strokeWidth={1} opacity={0.4} />
                <circle cx={x} cy={90} r={6} fill="var(--ink-soft)" />
              </g>
            ))}
            {[70, 200, 340, 470].map((x, i) => (
              <g key={i}>
                <line x1={x} y1={160} x2={x - 22} y2={195} stroke="currentColor" strokeWidth={0.8} opacity={0.3} />
                <line x1={x} y1={160} x2={x + 22} y2={195} stroke="currentColor" strokeWidth={0.8} opacity={0.3} />
                <circle cx={x} cy={150} r={4.5} fill="var(--ink-soft)" />
              </g>
            ))}
            {APP_VENUES.map((v, i) => {
              const x = 48 + i * 65;
              return (
                <g key={v.id}>
                  <rect x={x - 18} y={200} width={36} height={14} fill="var(--bg-sunk)" stroke="var(--line)" strokeWidth={0.5} rx={2} />
                  <text x={x} y={210} textAnchor="middle" fontFamily="var(--mono)" fontSize={7.5} fill="var(--ink-soft)">{v.short.slice(0, 6)}</text>
                </g>
              );
            })}
          </svg>
          <div className="cap muted mt-4" style={{ lineHeight: 1.6 }}>
            Eight per-venue leaves. The verifier ships as a 14kb static HTML file — save it and verify offline.
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: "16px 22px 12px", marginBottom: 0 }}>
          <div className="card-title">Recent attestations</div>
          <div className="seg"><button className="on">24h</button><button>7d</button><button>30d</button></div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Block</th><th>Time</th><th>Merkle root</th>
              <th>Δ reserves vs liabilities</th><th className="ar" style={{ width: 120 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {APP_RESERVES.map((r) => (
              <tr key={r.block}>
                <td className="strong mono">#{r.block.toLocaleString()}</td>
                <td className="mono small">{r.time}</td>
                <td className="mono small">{r.root}</td>
                <td className="mono small">{r.delta}</td>
                <td className="ar"><span className="tag green"><AppIcon name="check" size={11} /> verified</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ====================================================================
 * Tax
 * ==================================================================== */
function Tax() {
  const [jurisdiction, setJ] = useState<"UK" | "US" | "DE">("UK");
  const [year, setYear] = useState("2026");
  const totalGain = APP_TAX_LOTS.reduce((s, l) => s + l.gain, 0);
  const totalProceeds = APP_TAX_LOTS.reduce((s, l) => s + l.proceeds, 0);
  const form = { UK: "CGT · SA108", US: "Form 8949", DE: "FIFO § 23 EStG" }[jurisdiction];

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Tax · Tablet</div>
          <h1 className="view-title">Realised gains, by jurisdiction</h1>
          <div className="view-sub">Cost basis computed across every venue. Export signed by a Lantern Merkle root.</div>
        </div>
        <div className="view-actions">
          <button className="btn ghost"><AppIcon name="download" size={14} /> CSV</button>
          <button className="btn ghost"><AppIcon name="download" size={14} /> PDF</button>
          <button className="btn"><AppIcon name="download" size={14} /> Signed export</button>
        </div>
      </div>

      <div className="row gap-3 mb-5" style={{ flexWrap: "wrap" }}>
        <div className="seg">
          {(["UK","US","DE"] as const).map((j) => (
            <button key={j} className={jurisdiction === j ? "on" : ""} onClick={() => setJ(j)}>
              {j === "UK" ? "United Kingdom" : j === "US" ? "United States" : "Germany"}
            </button>
          ))}
        </div>
        <div className="seg">
          {["2024","2025","2026"].map((y) => (
            <button key={y} className={year === y ? "on" : ""} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="cap muted">Form</span>
          <span className="mono small strong">{form}</span>
        </div>
      </div>

      <div className="stat-grid mb-5">
        <StatCard label="Total proceeds"  value={fmtUsd(totalProceeds)} sub={`YTD ${year}`} />
        <StatCard label="Cost basis"      value={fmtUsd(totalProceeds - totalGain)} sub="HMRC matching rule" />
        <StatCard label="Realised gain"   value={fmtUsd(totalGain, { signed: true })} sub="Below allowance" accent />
        <StatCard label="Tax owed · est"  value={fmtUsd(totalGain * 0.10)} sub="At 10% basic rate" />
      </div>

      <div className="card mb-5">
        <div className="between-bl mb-3">
          <div>
            <div className="card-title">{year}/{(parseInt(year)+1).toString().slice(-2)} CGT allowance · UK</div>
            <div className="muted small mt-2">Annual allowance · £3,000 ($3,820 equiv.)</div>
          </div>
          <div className="num strong" style={{ fontSize: 18 }}>{fmtUsd(totalGain)} / $3,820</div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "var(--bg-sunk)", overflow: "hidden" }}>
          <div style={{ height: "100%", background: "var(--ink)", borderRadius: 4, width: `${Math.min(100, totalGain / 3820 * 100)}%`, transition: "width 600ms ease" }} />
        </div>
        <div className="between mt-2 cap muted">
          <span>$0</span><span>$3,820 · annual allowance</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: "16px 22px 12px", marginBottom: 0 }}>
          <div className="card-title">Realised events · {APP_TAX_LOTS.length}</div>
          <div className="muted small">Sorted by date · newest first</div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th><th>Asset</th><th>Event</th>
              <th className="ar">Proceeds</th><th className="ar">Cost basis</th>
              <th className="ar">Gain</th><th className="ar" style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {APP_TAX_LOTS.map((l) => (
              <tr key={l.id}>
                <td className="mono small">{l.date}</td>
                <td className="strong mono">{l.asset}</td>
                <td>{l.event}</td>
                <td className="ar num strong">{fmtUsd(l.proceeds)}</td>
                <td className="ar num">{fmtUsd(l.proceeds - l.gain)}</td>
                <td className={"ar num strong " + (l.gain > 0 ? "pos" : l.gain < 0 ? "neg" : "")}>{fmtUsd(l.gain, { signed: true })}</td>
                <td className="ar">
                  <button className="icon-btn" style={{ width: 26, height: 26 }} title="Inspect"><AppIcon name="info" size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cap muted mt-4" style={{ lineHeight: 1.6 }}>
        Atrium is not a tax advisor. Signed Merkle root proves the export was produced from the same dataset Lantern attested for the relevant block.
      </div>
    </div>
  );
}

/* ====================================================================
 * Settings
 * ==================================================================== */
function Settings() {
  const [section, setSection] = useState<"wallet" | "session" | "recovery" | "network" | "notify" | "account">("wallet");
  const SECTIONS = [
    { id: "wallet" as const,   label: "Wallet",        icon: "settings" as AppIconName },
    { id: "session" as const,  label: "Session keys",  icon: "shield"   as AppIconName },
    { id: "recovery" as const, label: "Recovery",      icon: "shield"   as AppIconName },
    { id: "network" as const,  label: "Network",       icon: "transfer" as AppIconName },
    { id: "notify" as const,   label: "Notifications", icon: "bell"     as AppIconName },
    { id: "account" as const,  label: "Account",       icon: "agents"   as AppIconName },
  ];

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Settings · Postern</div>
          <h1 className="view-title">Wallet & account</h1>
          <div className="view-sub">Postern is the ERC-4337 + EIP-7702 layer that holds your passkey, session keys, and gas sponsorship credit.</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 32, alignItems: "start" }}>
        <div className="col" style={{ gap: 2, position: "sticky", top: 80 }}>
          {SECTIONS.map((s) => (
            <button key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", border: "none",
                background: section === s.id ? "var(--ink)" : "transparent",
                color: section === s.id ? "var(--bg)" : "var(--ink-soft)",
                borderRadius: 8, cursor: "pointer", fontFamily: "var(--sans)",
                fontSize: 13.5, textAlign: "left", width: "100%",
              }}>
              <AppIcon name={s.icon} size={14} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
        <div className="col gap-5">
          {section === "wallet" && (
            <>
              <div className="card">
                <div className="card-head">
                  <div className="card-title">Wallet</div>
                  <span className="tag green"><AppIcon name="check" size={11} /> passkey active</span>
                </div>
                <div className="grid-2" style={{ gap: 18 }}>
                  <div>
                    <div className="cap">Address</div>
                    <div className="mono mt-2">{APP_ME.address}</div>
                  </div>
                  <div>
                    <div className="cap">ENS</div>
                    <div className="mono mt-2">{APP_ME.ens}</div>
                  </div>
                  <div>
                    <div className="cap">Authenticator</div>
                    <div className="mono mt-2">ATRIUM · Yubikey 5C · Touch ID</div>
                  </div>
                  <div>
                    <div className="cap">Recovery guardians</div>
                    <div className="mono mt-2">3 active</div>
                  </div>
                </div>
                <div className="card-divider" />
                <div className="row gap-3">
                  <button className="btn ghost"><AppIcon name="shield" size={14} /> Rotate passkey</button>
                  <button className="btn ghost"><AppIcon name="copy" size={14} /> Copy address</button>
                  <button className="btn" style={{ background: "var(--neg)", borderColor: "var(--neg)" }}><AppIcon name="x" size={12} /> Kill switch</button>
                </div>
              </div>
              <div className="card">
                <div className="card-title mb-3">Gas sponsorship</div>
                <div className="kv">
                  <div><span>Sponsored UserOps remaining</span><span className="num strong">132 / 200</span></div>
                  <div><span>Tier</span><span className="num">free · testnet</span></div>
                  <div><span>Resets</span><span className="num">in 14h 22m</span></div>
                </div>
              </div>
            </>
          )}
          {section === "session" && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-head" style={{ padding: "16px 20px 12px", marginBottom: 0 }}>
                <div className="card-title">Active session keys</div>
                <span className="muted small">3 active · ERC-4337</span>
              </div>
              <table className="table">
                <thead><tr><th>Agent</th><th>Fingerprint</th><th>Scope</th><th>TTL</th><th className="ar"></th></tr></thead>
                <tbody>
                  {[
                    { agent: "delphi.eth",  fp: "0x9f3a…b71d", scope: "HL-HIP3 · HL-HIP4 · ≤$50K", ttl: "5d" },
                    { agent: "pareto.eth",  fp: "0x2b4e…0a17", scope: "PENDLE · ≤$25K", ttl: "12d" },
                    { agent: "helios.eth",  fp: "0x7c91…d8f2", scope: "HL-HIP3 · AAVE-V3 · ≤$75K", ttl: "22d" },
                  ].map((k) => (
                    <tr key={k.fp}>
                      <td className="strong mono">{k.agent}</td>
                      <td className="mono small">{k.fp}</td>
                      <td>{k.scope}</td>
                      <td className="num">{k.ttl}</td>
                      <td className="ar"><button className="btn tiny" style={{ background: "var(--neg)", borderColor: "var(--neg)" }}>Revoke</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {section === "recovery" && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">Recovery guardians</div>
                <button className="btn tiny"><AppIcon name="plus" size={10} /> Add</button>
              </div>
              {[
                { label: "Hardware wallet · Ledger Nano X", fp: "0x4f29…81e0" },
                { label: "Co-founder · vitalik@atrium.fi",  fp: "0x9a02…3c4d" },
                { label: "Legal counsel · Cooley · safe",   fp: "0xc4f1…22a9" },
              ].map((g) => (
                <div key={g.fp} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--hairline)", alignItems: "center" }}>
                  <div>
                    <div className="strong small">{g.label}</div>
                    <div className="muted mono" style={{ fontSize: 10.5 }}>{g.fp}</div>
                  </div>
                  <span className="tag green">active</span>
                  <button className="icon-btn" style={{ width: 28, height: 28 }}><AppIcon name="x" size={12} /></button>
                </div>
              ))}
              <div className="cap muted mt-4" style={{ lineHeight: 1.6 }}>
                Any 2 of 3 guardians can recover access if you lose your authenticator. Atrium cannot recover your wallet alone.
              </div>
            </div>
          )}
          {section === "network" && (
            <div className="card">
              <div className="card-title mb-3">Connected networks</div>
              <div className="col" style={{ gap: 8 }}>
                {["arb-sepolia · 421614", "eth-sepolia · 11155111", "rh-chain · 90909090", "polygon · 80002"].map((n) => (
                  <div key={n} style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "var(--bg-sunk)", borderRadius: 8 }}>
                    <span className="mono small">{n}</span>
                    <span className="tag green"><AppIcon name="check" size={11} /> connected</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {section === "notify" && (
            <div className="card">
              <div className="card-title mb-3">Notifications</div>
              {[
                "Position approaching liquidation",
                "Agent mandate emitted",
                "Mandate expired",
                "Lantern attestation published",
                "Recovery flow initiated",
              ].map((n) => (
                <label key={n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--hairline)" }}>
                  <span className="small">{n}</span>
                  <input type="checkbox" defaultChecked />
                </label>
              ))}
            </div>
          )}
          {section === "account" && (
            <div className="card">
              <div className="card-title mb-3">Account</div>
              <div className="kv">
                <div><span>Email</span><span className="mono small">vitalik@atrium.fi</span></div>
                <div><span>Joined</span><span className="mono small">2026-03-14</span></div>
                <div><span>Plan</span><span className="mono small">testnet · free</span></div>
                <div><span>API keys</span><span className="mono small">2 active</span></div>
              </div>
              <div className="card-divider" />
              <button className="btn" style={{ background: "var(--neg)", borderColor: "var(--neg)" }}>Delete account</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
