'use client';

import { useState } from "react";

type Room = {
  id: string;
  name: string;
  role: string;
  x: number; y: number; w: number; h: number;
  kind?: "gate" | "pool" | "foundation" | "side-gate" | "channel" | "garden";
  pending?: boolean;
};

const ROOMS: Room[] = [
  { id: "portico",   name: "Portico",   role: "Venue framework",     x: 460, y: 60,  w: 320, h: 64,  kind: "gate" },
  { id: "sigil",     name: "Sigil",     role: "Agent mandates",      x: 110, y: 150, w: 220, h: 130 },
  { id: "rostrum",   name: "Rostrum",   role: "Agent marketplace",   x: 110, y: 290, w: 220, h: 130 },
  { id: "codex",     name: "Codex",     role: "x402 paid APIs",      x: 910, y: 150, w: 220, h: 130 },
  { id: "scribe",    name: "Scribe",    role: "Subgraph indexer",    x: 910, y: 290, w: 220, h: 130 },
  { id: "impluvium", name: "Impluvium", role: "Unified margin",      x: 460, y: 200, w: 320, h: 220, kind: "pool" },
  { id: "archive",   name: "Archive",   role: "Off-chain risk lab",  x: 110, y: 440, w: 220, h: 110 },
  { id: "tablet",    name: "Tablet",    role: "Tax · UK · US · DE",  x: 350, y: 440, w: 180, h: 110 },
  { id: "edict",     name: "Edict",     role: "Jurisdiction tiers",  x: 550, y: 440, w: 160, h: 110 },
  { id: "praetor",   name: "Praetor",   role: "CLI · ops",           x: 730, y: 440, w: 180, h: 110 },
  { id: "coffer",    name: "Coffer",    role: "ERC-4626 vaults",     x: 930, y: 440, w: 200, h: 110 },
  { id: "lantern",   name: "Lantern",   role: "Proof-of-reserves",   x: 110, y: 570, w: 300, h: 140 },
  { id: "cohort",    name: "Cohort",    role: "Design partners",     x: 430, y: 570, w: 360, h: 140, kind: "garden" },
  { id: "curator",   name: "Curator",   role: "Adapter grants",      x: 810, y: 570, w: 320, h: 140 },
  { id: "postern",   name: "Postern",   role: "Wallet abstraction",  x: 30,   y: 200, w: 60,  h: 220, kind: "side-gate" },
  { id: "aqueduct",  name: "Aqueduct",  role: "Chainlink CCIP",      x: 1150, y: 200, w: 60,  h: 220, kind: "channel" },
  { id: "plinth",    name: "Plinth",    role: "Margin engine · Stylus",      x: 110, y: 780, w: 340, h: 70, kind: "foundation" },
  { id: "vigil",     name: "Vigil",     role: "Liquidation engine · Stylus", x: 470, y: 780, w: 340, h: 70, kind: "foundation" },
  { id: "stoa",      name: "Stoa",      role: "Options · Phase 2",            x: 830, y: 780, w: 340, h: 70, kind: "foundation", pending: true },
];

const ROOM_DESC: Record<string, string> = {
  portico:   "Open standard adapter framework, IPorticoAdapter v1.0.0, and the 7 live integrations.",
  sigil:     "EIP-712 mandates over ERC-8004. Issues short-lived session keys bound to one agent.",
  rostrum:   "Agent leaderboard + copy-trading. Public performance, on-chain history, slashing appeals.",
  codex:     "x402-payable agent APIs. 8 endpoints. Signed responses.",
  scribe:    "Subgraphs over The Graph hosted service. Indexes every Atrium contract.",
  impluvium: "The central pool. SPAN-style cross-product margin computed by Plinth, fed by every venue's collateral.",
  archive:   "Off-chain risk lab in Python. Backtests, correlation oracle, weekly research notes.",
  tablet:    "Realised-gain export for UK CGT, US Form 8949, German FIFO. Signed by Lantern.",
  edict:     "Jurisdiction-tier registry. Sumsub sandbox KYC. Gates venue access by tier.",
  praetor:   "CLI and ops tooling. Built on Foundry + cargo-stylus.",
  coffer:    "ERC-4626 collateral vaults in Rust on the OpenZeppelin Rust ERC-4626 base.",
  lantern:   "Merkle attestations published every ≤10 minutes on-chain. Independent 14kb verifier.",
  cohort:    "Five to eight named design partners, sharing venue-specific knowledge.",
  curator:   "Open-source grant programme, $20–50K ARB, for community-built Portico adapters.",
  postern:   "ERC-4337 + EIP-7702 wallet abstraction. Passkey login, session keys, social recovery.",
  aqueduct:  "Chainlink CCIP messaging contracts. Move collateral between testnets.",
  plinth:    "SPAN-style portfolio margin engine in Rust, deployed as Stylus.",
  vigil:     "NMS-aware partial-liquidation engine in Rust. Watches every position every block.",
  stoa:      "Black-Scholes options engine in Rust. Phase 2, ships if Trailblazer lands.",
};

function DimLine({ x1, y1, x2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  return (
    <g opacity={0.5}>
      <line x1={x1} y1={y1} x2={x2} y2={y1} stroke="var(--floor-ink)" strokeWidth={0.4} />
      <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} stroke="var(--floor-ink)" strokeWidth={0.4} />
      <line x1={x2} y1={y1 - 4} x2={x2} y2={y1 + 4} stroke="var(--floor-ink)" strokeWidth={0.4} />
      <text x={(x1 + x2) / 2} y={y1 + 14} textAnchor="middle" className="floor-mono" fontSize="9" fill="var(--floor-muted)" letterSpacing="1">{label}</text>
    </g>
  );
}

function DimLineV({ x1, y1, y2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  const my = (y1 + y2) / 2;
  return (
    <g opacity={0.5}>
      <line x1={x1} y1={y1} x2={x1} y2={y2} stroke="var(--floor-ink)" strokeWidth={0.4} />
      <line x1={x1 - 4} y1={y1} x2={x1 + 4} y2={y1} stroke="var(--floor-ink)" strokeWidth={0.4} />
      <line x1={x1 - 4} y1={y2} x2={x1 + 4} y2={y2} stroke="var(--floor-ink)" strokeWidth={0.4} />
      <text x={x1 + 14} y={my} textAnchor="start" className="floor-mono" fontSize="9" fill="var(--floor-muted)" transform={`rotate(-90 ${x1 + 14} ${my})`} letterSpacing="1">{label}</text>
    </g>
  );
}

function RoomG({ r, hover, setHover }: { r: Room; hover: string | null; setHover: (id: string | null) => void }) {
  const isHover = hover === r.id;
  const isPool = r.kind === "pool";
  const isFound = r.kind === "foundation";
  const isSide = r.kind === "side-gate" || r.kind === "channel";
  const isGarden = r.kind === "garden";
  const tx = r.x + r.w / 2;
  const ty = r.y + r.h / 2;

  return (
    <g
      onMouseEnter={() => setHover(r.id)}
      onMouseLeave={() => setHover(null)}
      style={{ cursor: "pointer" }}
      className={"room" + (isHover ? " hover" : "")}
    >
      {isGarden && (
        <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#garden-dots)" color="currentColor" />
      )}
      {isPool && (
        <>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="var(--accent)" opacity={isHover ? 0.1 : 0.06} />
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#floor-hatch)" color="var(--accent)" opacity={isHover ? 0.2 : 0.12} />
          <line x1={r.x + r.w / 2 - 28} y1={r.y + r.h / 2 + 4} x2={r.x + r.w / 2 + 28} y2={r.y + r.h / 2 + 4}
                stroke="var(--accent)" strokeWidth={0.6} opacity={0.6} />
          <circle cx={r.x + r.w - 16} cy={r.y + 14} r={3} fill="var(--live)" />
          <text x={r.x + r.w - 24} y={r.y + 17} textAnchor="end" className="floor-mono" fontSize="8" fill="var(--floor-muted)" letterSpacing="1.5">LIVE</text>
          <text x={r.x + 14} y={r.y + 17} className="floor-mono" fontSize="8" fill="var(--floor-muted)" letterSpacing="1.5">POOL · UNIFIED MARGIN</text>
        </>
      )}
      {r.id === "lantern" && (
        <rect
          x={r.x - 20}
          y={r.y - 20}
          width={r.w + 40}
          height={r.h + 40}
          fill={`url(#lglow-${r.id})`}
          style={{ animation: "atrium-lanternBreathe 4s ease-in-out infinite" }}
        />
      )}
      {isFound && (
        <rect
          x={r.x} y={r.y} width={r.w} height={r.h}
          fill={isHover ? "var(--floor-ink)" : "var(--floor-bg)"}
          stroke="var(--floor-ink)" strokeWidth={1.2}
          strokeDasharray={r.pending ? "6 4" : "0"}
          opacity={r.pending && !isHover ? 0.65 : 1}
        />
      )}
      {!isFound && (
        <rect
          x={r.x} y={r.y} width={r.w} height={r.h}
          fill={isHover ? "color-mix(in oklch, var(--accent) 6%, transparent)" : "transparent"}
          stroke={isHover ? "var(--accent)" : "var(--floor-ink)"}
          strokeWidth={isHover ? 1.4 : isPool ? 1.2 : isSide ? 0.8 : 1}
          style={{ transition: "all 200ms ease" }}
        />
      )}
      {isSide ? (
        <>
          <text
            x={tx}
            y={ty - 6}
            textAnchor="middle"
            transform={`rotate(-90 ${tx} ${ty})`}
            className="floor-name"
            fontSize={20}
            fill={isHover ? "var(--accent)" : "var(--floor-ink)"}
            style={{ transition: "fill 200ms ease" }}
          >
            {r.name}
          </text>
          <text
            x={tx}
            y={ty + 14}
            textAnchor="middle"
            transform={`rotate(-90 ${tx} ${ty})`}
            className="floor-mono"
            fontSize={8}
            fill="var(--floor-muted)"
            letterSpacing="1.5"
          >
            {r.role}
          </text>
        </>
      ) : (
        <>
          <text
            x={tx}
            y={ty - 2}
            textAnchor="middle"
            className="floor-name"
            fill={isFound && isHover ? "var(--floor-bg)" : isPool ? "var(--accent)" : "var(--floor-ink)"}
            style={{ transition: "fill 200ms ease" }}
          >
            {r.name}
          </text>
          <text
            x={tx}
            y={ty + 14}
            textAnchor="middle"
            className="floor-mono"
            fontSize={10}
            fill={isFound && isHover ? "color-mix(in oklch, var(--floor-bg) 70%, transparent)" : "var(--floor-muted)"}
            letterSpacing="1.5"
          >
            {r.role}
          </text>
        </>
      )}

      {r.pending && (
        <text x={r.x + r.w - 8} y={r.y + 14} textAnchor="end" className="floor-mono" fontSize="8" fill="var(--floor-muted)" letterSpacing="1.5">P2</text>
      )}
    </g>
  );
}

export function FloorPlanSection() {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <section id="system" className="floorplan-section">
      <div className="container">
        <div className="section-head-centered">
          <div className="eyebrow mono cap">The system</div>
          <h2 className="h2">
            Eighteen subsystems. <span className="text-accent">One building.</span>
          </h2>
          <p className="section-sub">
            The codebase is named after the parts of a Roman house. Plinth carries weight.
            Postern is the small gate. Aqueduct moves water. Each subsystem owns its room.
          </p>
        </div>
      </div>
      <div className="floorplan-frame">
        <div className="floor-wrap">
          <div className="draw-label floor-head">
            <div>
              <div className="mono cap">Fig. 02 · The Atrium of Atrium</div>
              <div className="mono cap muted" style={{ marginTop: 4 }}>
                Plan view · domus floor plan · all 18 subsystems
              </div>
            </div>
            <div className="mono cap" style={{ textAlign: "right" }}>
              <div>Sheet 03 / 08</div>
              <div className="muted" style={{ marginTop: 4 }}>Atrium · May 2026</div>
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
              <radialGradient id="lglow-lantern" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </radialGradient>
            </defs>

            <line x1="20" y1="760" x2="1220" y2="760" stroke="var(--floor-ink)" strokeWidth={0.6} strokeDasharray="6 6" opacity={0.4} />
            <text x="20" y="754" className="floor-mono" fontSize="10" fill="var(--floor-muted)">-, PLAN VIEW · upper levels, -</text>
            <text x="1220" y="754" className="floor-mono" textAnchor="end" fontSize="10" fill="var(--floor-muted)">-, SECTION · foundation, -</text>

            <rect x="90" y="124" width="1060" height="600" fill="none" stroke="var(--floor-ink)" strokeWidth={1.6} />
            <rect x="100" y="560" width="1040" height="160" fill="none" stroke="var(--floor-ink)" strokeWidth={0.8} opacity={0.6} />
            <text x="120" y="555" className="floor-mono" fontSize="9" fill="var(--floor-muted)" letterSpacing="2">PERISTYLE</text>
            <text x="120" y="145" className="floor-mono" fontSize="9" fill="var(--floor-muted)" letterSpacing="2">ATRIUM</text>
            <text x="120" y="435" className="floor-mono" fontSize="9" fill="var(--floor-muted)" letterSpacing="2">TABLINUM</text>

            <g>
              <line x1="780" y1="310" x2="1150" y2="310" stroke="var(--floor-ink)" strokeWidth={0.5} opacity={0.35} />
              <line x1="780" y1="320" x2="1150" y2="320" stroke="var(--floor-ink)" strokeWidth={0.5} opacity={0.35} />
              <line x1="780" y1="315" x2="1150" y2="315" stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 8" opacity={0.7}
                    style={{ animation: "atrium-aqFlow 2s linear infinite" }} />
              <polyline points="800,300 780,315 800,330" fill="none" stroke="var(--floor-ink)" strokeWidth={0.8} opacity={0.6} />
            </g>

            <g>
              <line x1="90" y1="315" x2="110" y2="315" stroke="var(--floor-ink)" strokeWidth={0.5} opacity={0.4} />
              <polyline points="118,305 100,315 118,325" fill="none" stroke="var(--floor-ink)" strokeWidth={0.8} opacity={0.6} />
            </g>

            <g opacity={0.5}>
              {[510, 555, 600, 640, 680, 720].map((x) => (
                <line key={x} x1={x} y1="155" x2={x} y2="205"
                      stroke="var(--accent)" strokeWidth={0.6} opacity={0.35} strokeDasharray="2 4"
                      style={{ animation: "atrium-rainFall 1.8s linear infinite" }} />
              ))}
              <text x="615" y="148" textAnchor="middle" className="floor-mono" fontSize="8" fill="var(--floor-muted)" letterSpacing="2">via compluvium →</text>
            </g>

            <g opacity={0.45}>
              {Array.from({ length: 14 }, (_, i) => 130 + i * 76).map((cx) => (
                <circle key={"ct" + cx} cx={cx} cy="567" r="3" fill="var(--floor-ink)" />
              ))}
              {Array.from({ length: 14 }, (_, i) => 130 + i * 76).map((cx) => (
                <circle key={"cb" + cx} cx={cx} cy="713" r="3" fill="var(--floor-ink)" />
              ))}
            </g>

            <g opacity={0.5}>
              {[280, 640, 1000].map((x) => (
                <g key={x}>
                  <line x1={x} y1="724" x2={x} y2="780" stroke="var(--floor-ink)" strokeWidth={0.5} strokeDasharray="2 3" />
                  <line x1={x - 20} y1="724" x2={x + 20} y2="724" stroke="var(--floor-ink)" strokeWidth={0.6} />
                </g>
              ))}
            </g>

            {ROOMS.map((r) => (
              <RoomG key={r.id} r={r} hover={hover} setHover={setHover} />
            ))}

            <text x="110" y="775" className="floor-mono" fontSize="10" fill="var(--floor-muted)" letterSpacing="2">FOUNDATION · STYLUS (RUST → WASM)</text>

            <g transform="translate(1180, 50)">
              <circle cx="0" cy="0" r="18" fill="none" stroke="var(--floor-ink)" strokeWidth={0.8} />
              <polygon points="0,-14 5,8 0,4 -5,8" fill="var(--floor-ink)" />
              <text x="0" y="-22" className="floor-mono" textAnchor="middle" fontSize="10" fill="var(--floor-ink)">N</text>
            </g>

            <g transform="translate(40, 50)">
              <text x="0" y="-6" className="floor-mono" fontSize="9" fill="var(--floor-muted)" letterSpacing="1.5">SCALE 1:1 · TESTNET</text>
              <g>
                <rect x="0" y="0" width="20" height="6" fill="var(--floor-ink)" />
                <rect x="20" y="0" width="20" height="6" fill="none" stroke="var(--floor-ink)" strokeWidth={0.6} />
                <rect x="40" y="0" width="20" height="6" fill="var(--floor-ink)" />
                <rect x="60" y="0" width="20" height="6" fill="none" stroke="var(--floor-ink)" strokeWidth={0.6} />
              </g>
              <text x="0" y="18" className="floor-mono" fontSize="8" fill="var(--floor-muted)">0</text>
              <text x="80" y="18" className="floor-mono" fontSize="8" fill="var(--floor-muted)">100m</text>
            </g>

            <DimLine x1={90} y1={744} x2={1150} y2={744} label="1,060" />
            <DimLineV x1={1224} y1={124} x2={1224} y2={724} label="600" />
          </svg>

          <div className="floor-detail">
            {hover ? (
              <>
                <div className="serif" style={{ fontSize: 28, letterSpacing: "-0.012em" }}>
                  {ROOMS.find((r) => r.id === hover)?.name}
                </div>
                <div className="mono cap" style={{ marginTop: 6, color: "var(--muted)" }}>
                  {ROOMS.find((r) => r.id === hover)?.role}
                </div>
                <div className="mt-3" style={{ color: "var(--ink-soft)", maxWidth: 520, fontSize: 13 }}>
                  {ROOM_DESC[hover]}
                </div>
              </>
            ) : (
              <>
                <div className="mono cap" style={{ color: "var(--muted)" }}>Hover a room</div>
                <div className="mt-2" style={{ color: "var(--ink-soft)", maxWidth: 520, fontSize: 13 }}>
                  Eighteen subsystems arranged as a domus. The impluvium at the centre is the
                  unified margin pool. Foundation engines carry the load. Side gates handle traffic
                  in and out.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
