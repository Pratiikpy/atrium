'use client';

import { useEffect, useState, type ReactNode } from "react";

/* =====================================================================
 * Feature shell (Lovable port) — eyebrow + centered title + product mock
 * Used by ProductMock, AqueductMock, SigilMock, LanternMock.
 * ===================================================================== */

export function Feature({
  id,
  eyebrow,
  title,
  accent,
  sub,
  dark = false,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  accent?: ReactNode;
  sub?: string;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className={"feature" + (dark ? " dark" : "")}>
      <div className="container">
        <div className="section-head-centered">
          <div className="eyebrow mono cap">{eyebrow}</div>
          <h2 className="h2">
            {title} {accent && <span className="accent-grad">{accent}</span>}
          </h2>
          {sub && <p className="section-sub">{sub}</p>}
        </div>
        <div className="feature-stage">{children}</div>
      </div>
    </section>
  );
}

function BrowserChrome({ url, dark }: { url: string; dark?: boolean }) {
  return (
    <div className={"browser-chrome" + (dark ? " dark" : "")}>
      <div style={{ display: "flex", gap: 6 }}>
        <span className="bc-dot" />
        <span className="bc-dot" />
        <span className="bc-dot" />
      </div>
      <div className="bc-url mono">
        <span style={{ opacity: 0.5, marginRight: 6 }}>https://</span>
        {url}
      </div>
      <div className="mono cap" style={{ opacity: 0.5, fontSize: 9.5 }}>testnet</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="mono cap muted">{label}</div>
      <div className="mono" style={{ fontSize: 20, marginTop: 6 }}>{value}</div>
    </div>
  );
}

/* =====================================================================
 * Portfolio dashboard mock
 * ===================================================================== */

export function PortfolioMock() {
  const rows: [string, string, string, string, string, "+" | "−" | ""][] = [
    ["Hyperliquid HIP-3", "rTSLA-PERP · 4× long", "$1,820,400", "+ $42,180", "$1.25M", "+"],
    ["Aave Horizon",      "USTB collateral",      "$ 892,440",  "+ $1,084",  "—",      ""],
    ["Pendle V2",         "PT-stETH · Mar 2027",  "$ 320,500",  "+ $2,920",  "—",      "+"],
    ["Trade.xyz",         "WBTC-USDC · spot",     "$ 401,890",  "− $ 8,420", "$420K",  "−"],
  ];
  return (
    <div className="product-frame">
      <BrowserChrome url="atrium.fi/app/portfolio" />
      <div className="product-body">
        <div className="dash-head">
          <div>
            <div className="mono cap muted">Portfolio · 0x1a3b…7f29</div>
            <div className="mono" style={{ fontSize: 42, marginTop: 8, letterSpacing: "-0.024em" }}>
              $12,378,422
            </div>
            <div className="mono cap" style={{ color: "var(--live)", marginTop: 4 }}>
              + $284,920 · 24h
            </div>
          </div>
          <div className="dash-actions">
            <a className="btn ghost sm">Deposit</a>
            <a className="btn sm">Trade</a>
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
            <div>Venue</div>
            <div>Position</div>
            <div>Notional</div>
            <div>P&amp;L · 24h</div>
            <div style={{ textAlign: "right" }}>Margin</div>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="dash-row">
              <div className="dash-cell strong">{row[0]}</div>
              <div className="dash-cell mono small">{row[1]}</div>
              <div className="dash-cell mono small">{row[2]}</div>
              <div className={"dash-cell mono small " + (row[5] === "+" ? "pos" : row[5] === "−" ? "neg" : "")}>{row[3]}</div>
              <div className="dash-cell mono small" style={{ textAlign: "right" }}>{row[4]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * Aqueduct cross-chain transfer mock
 * ===================================================================== */

function CCIPArrow({ active }: { active: number }) {
  return (
    <svg width="160" height="44" viewBox="0 0 160 44">
      <line x1="0" y1="22" x2="160" y2="22" stroke="var(--line)" strokeWidth="1" />
      <line
        x1="0"
        y1="22"
        x2={Math.min(160, (active + 1) * 40)}
        y2="22"
        stroke="var(--ink)"
        strokeWidth="1.5"
        style={{ transition: "all 600ms ease" }}
      />
      <polyline points="148,16 158,22 148,28" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      <circle
        cx={Math.min(155, (active + 1) * 40)}
        cy="22"
        r="3"
        fill="var(--ink)"
        style={{ transition: "all 600ms ease" }}
      />
    </svg>
  );
}

export function AqueductMock() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 4), 1500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="product-frame">
      <BrowserChrome url="atrium.fi/app/transfer" />
      <div className="product-body" style={{ padding: 32 }}>
        <div className="mono cap muted">Cross-chain transfer · Aqueduct</div>
        <div
          style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: 20,
            alignItems: "center",
          }}
        >
          <div className="transfer-card">
            <div className="mono cap muted">From</div>
            <div className="strong" style={{ marginTop: 6, fontSize: 15 }}>Ethereum Sepolia</div>
            <div className="mono" style={{ fontSize: 28, marginTop: 14, letterSpacing: "-0.02em" }}>
              50,000 <span style={{ fontSize: 16, color: "var(--muted)" }}>USDC</span>
            </div>
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
            <div className="mono" style={{ fontSize: 28, marginTop: 14, letterSpacing: "-0.02em" }}>
              50,000 <span style={{ fontSize: 16, color: "var(--muted)" }}>USDC</span>
            </div>
            <div className="mono cap muted" style={{ marginTop: 10 }}>Plinth credit posted</div>
          </div>
        </div>
        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid var(--hairline)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div className="mono cap muted">Estimated time · 8.4s</div>
          <div className="mono cap muted">CCIP fee · $0.00 testnet</div>
          <div className="mono cap" style={{ color: "var(--live)" }}>● Chainlink CCIP testnet</div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * Sigil agent session mock — dark
 * ===================================================================== */

export function SigilMock() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 4), 1800);
    return () => clearInterval(t);
  }, []);
  const steps = [
    { label: "Sigma signs Intent Sigil",   mono: "intent.sigil · agent=delphi · max=$50k · ttl 7d" },
    { label: "Postern issues session key", mono: "0x9f3a…b71d · cap $50k · 7d" },
    { label: "Agent emits Action Sigil",   mono: "portico.hyperliquid.openLong(WETH, 4×)" },
    { label: "Vigil checks mandate · ok",  mono: "✓ within Plinth headroom · 0.32× util" },
  ];
  return (
    <div className="product-frame">
      <BrowserChrome url="atrium.fi/app/agents/delphi.eth" dark />
      <div className="product-body dark" style={{ padding: 0 }}>
        <div className="agent-head">
          <div>
            <div className="mono cap" style={{ color: "color-mix(in oklch, white 55%, transparent)" }}>
              Sigil · agent.delphi.eth
            </div>
            <div className="strong" style={{ fontSize: 17, marginTop: 6, color: "white" }}>
              Volatility arbitrage · running
            </div>
          </div>
          <div className="mono cap" style={{ color: "var(--live)" }}>● live</div>
        </div>
        <div style={{ padding: "8px 24px 24px" }}>
          {steps.map((s, i) => {
            const active = i <= step;
            return (
              <div key={i} className="agent-step" style={{ opacity: active ? 1 : 0.28 }}>
                <span
                  style={{
                    color: i === step ? "var(--accent)" : active ? "var(--live)" : "var(--muted)",
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                  }}
                >
                  {i < step ? "✓" : i === step ? "▸" : "○"}
                </span>
                <div>
                  <div style={{ color: "white", fontSize: 14 }}>{s.label}</div>
                  <div
                    style={{
                      color: "color-mix(in oklch, white 50%, transparent)",
                      fontSize: 11.5,
                      marginTop: 2,
                      fontFamily: "var(--mono)",
                    }}
                  >
                    {s.mono}
                  </div>
                </div>
                <span
                  className="mono cap"
                  style={{ color: "color-mix(in oklch, white 40%, transparent)" }}
                >
                  {i === step ? "now" : i < step ? `+${((step - i) * 1.8) | 0}s` : "—"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="agent-foot">
          <span className="mono cap" style={{ color: "color-mix(in oklch, white 55%, transparent)" }}>
            Session · 0x9f3a…b71d
          </span>
          <span className="mono cap" style={{ color: "color-mix(in oklch, white 55%, transparent)" }}>
            Cap $50,000 · used $12,418
          </span>
          <button className="agent-revoke">Revoke ↗</button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * Lantern proof-of-reserves mock
 * ===================================================================== */

function MerkleTreeSvg() {
  return (
    <svg viewBox="0 0 800 140" width="100%" height="140" preserveAspectRatio="none">
      <circle cx="400" cy="14" r="3" fill="currentColor" />
      <line x1="400" y1="14" x2="200" y2="56" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <line x1="400" y1="14" x2="600" y2="56" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <circle cx="200" cy="56" r="2.5" fill="currentColor" />
      <circle cx="600" cy="56" r="2.5" fill="currentColor" />
      {[100, 300, 500, 700].map((x, i) => (
        <g key={i}>
          <line
            x1={i < 2 ? 200 : 600}
            y1="56"
            x2={x}
            y2="98"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.4"
          />
          <circle cx={x} cy="98" r="2" fill="currentColor" />
        </g>
      ))}
      {Array.from({ length: 16 }, (_, i) => {
        const x = 50 + i * 47;
        const parent = [100, 300, 500, 700][Math.floor(i / 4)];
        return (
          <g key={i}>
            <line
              x1={parent}
              y1="98"
              x2={x}
              y2="132"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.3"
            />
            <rect x={x - 2} y="128" width="4" height="8" fill="currentColor" opacity="0.6" />
          </g>
        );
      })}
    </svg>
  );
}

export function LanternMock() {
  return (
    <div className="product-frame">
      <BrowserChrome url="lantern.atrium.fi" />
      <div className="product-body">
        <div className="lantern-head">
          <div>
            <div className="mono cap muted">Proof-of-reserves · Atrium</div>
            <div className="strong" style={{ fontSize: 17, marginTop: 6 }}>
              Hourly Merkle attestation
            </div>
          </div>
          <div className="check-badge">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path
                d="M3 7.2 5.8 10 11 4.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
}
