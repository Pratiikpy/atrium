// Shared mock data for the Atrium app prototype

const VENUES = [
  { id: "hl3", name: "Hyperliquid HIP-3", short: "HL-HIP3", type: "Tokenized-stock perps", collateral: 1247820, asset: "USDC · WETH",    chain: "Arbitrum Sepolia",    chainShort: "arb-sepolia", integration: "hybrid",  status: "live"    },
  { id: "hl4", name: "Hyperliquid HIP-4", short: "HL-HIP4", type: "Permissioned perps",    collateral:  483160, asset: "USDC",          chain: "Arbitrum Sepolia",    chainShort: "arb-sepolia", integration: "hybrid",  status: "live"    },
  { id: "aav", name: "Aave Horizon",      short: "AAVE-V3", type: "RWA collateral",        collateral:  892440, asset: "aUSDC · USTB",  chain: "Arbitrum Sepolia",    chainShort: "arb-sepolia", integration: "native",  status: "live"    },
  { id: "pen", name: "Pendle V2",         short: "PENDLE",  type: "Fixed-yield · PT",      collateral:  320500, asset: "PT-stETH",      chain: "Arbitrum Sepolia",    chainShort: "arb-sepolia", integration: "native",  status: "live"    },
  { id: "cur", name: "Curve",             short: "CURVE",   type: "Stableswap LP",         collateral:  186720, asset: "3pool LP",      chain: "Ethereum Sepolia",    chainShort: "eth-sepolia", integration: "native",  status: "live"    },
  { id: "trd", name: "Trade.xyz",         short: "TRADE",   type: "RFQ · dark pool",       collateral:  401890, asset: "WETH · WBTC",   chain: "Arbitrum Sepolia",    chainShort: "arb-sepolia", integration: "native",  status: "live"    },
  { id: "pmk", name: "Polymarket",        short: "PMK",     type: "Prediction · CTF",      collateral:   58200, asset: "USDC",          chain: "via Aqueduct",        chainShort: "polygon",     integration: "bridged", status: "live"    },
  { id: "rhc", name: "RH-Chain",          short: "RH-NTV",  type: "Native spot equities",  collateral:       0, asset: "—",             chain: "Robinhood testnet",   chainShort: "rh-chain",    integration: "native",  status: "pending" }
];

const POSITIONS = [
  { id: "p1", venue: "hl3", instrument: "rTSLA-PERP",      side: "long",  size: "+1,840",  notional: 1820400, leverage: 4.0, entry: 248.30, mark: 251.10, pnl24h:  42180, pnlPct: 2.31, margin: 1250000 },
  { id: "p2", venue: "hl3", instrument: "rAAPL-PERP",      side: "long",  size: "+820",    notional: 484100,  leverage: 4.0, entry: 188.40, mark: 190.60, pnl24h:  18020, pnlPct: 2.18, margin: 320000  },
  { id: "p3", venue: "aav", instrument: "USTB collateral", side: "supply", size: "892,440", notional: 892440, leverage: 0,   entry: 1.00,   mark: 1.0012, pnl24h:   1084, pnlPct: 0.12, margin: 0       },
  { id: "p4", venue: "pen", instrument: "PT-stETH Mar27",  side: "long",  size: "+320,500", notional: 320500, leverage: 0,   entry: 1.000,  mark: 1.008,  pnl24h:   2920, pnlPct: 0.92, margin: 0       },
  { id: "p5", venue: "trd", instrument: "WBTC/USDC",       side: "short", size: "−5.42",   notional: 401890, leverage: 2.0, entry: 74180,  mark: 73680,  pnl24h:  -8420, pnlPct: -2.05, margin: 200900 },
  { id: "p7", venue: "hl4", instrument: "rNFLX-PERP",      side: "long",  size: "+212",    notional: 142800, leverage: 3.0, entry: 666.10, mark: 670.20, pnl24h:    870, pnlPct: 0.61, margin: 47600  },
  { id: "p8", venue: "cur", instrument: "3pool LP",        side: "supply", size: "186,720", notional: 186720, leverage: 0,   entry: 1.00,   mark: 1.0001, pnl24h:    24,  pnlPct: 0.01, margin: 0       }
];

const AGENTS = [
  { id: "a1", handle: "delphi.eth",  strategy: "Volatility arbitrage", pnl7d:  14.82, copiers: 41, fee: 0.20, status: "running",  sharpe: 2.18, aum: 1240000, mandates: 3 },
  { id: "a2", handle: "pareto.eth",  strategy: "PT / YT spread",       pnl7d:   9.31, copiers: 27, fee: 0.15, status: "running",  sharpe: 1.84, aum: 820000,  mandates: 2 },
  { id: "a3", handle: "helios.eth",  strategy: "Funding-rate carry",   pnl7d:   6.04, copiers: 63, fee: 0.10, status: "running",  sharpe: 1.62, aum: 1880000, mandates: 5 },
  { id: "a4", handle: "kepler.eth",  strategy: "Mean reversion · perps", pnl7d: 3.18, copiers: 18, fee: 0.20, status: "running",  sharpe: 1.10, aum: 410000,  mandates: 1 },
  { id: "a5", handle: "aurora.eth",  strategy: "Liquidation keeper",   pnl7d:  -0.94, copiers: 11, fee: 0.25, status: "running",  sharpe: 0.92, aum: 220000,  mandates: 1 },
  { id: "a6", handle: "atlas.eth",   strategy: "RWA basis trade",      pnl7d:   2.10, copiers:  6, fee: 0.15, status: "paused",   sharpe: 1.40, aum: 320000,  mandates: 0 },
  { id: "a7", handle: "sentinel.eth", strategy: "Risk-parity LP",      pnl7d:   1.84, copiers:  9, fee: 0.10, status: "running",  sharpe: 0.78, aum: 540000,  mandates: 2 }
];

const MANDATES = [
  { id: "m1", agent: "delphi.eth",  status: "active",  cap: 50000, used: 12418, ttlDays: 5,  venues: ["HL-HIP3", "HL-HIP4"], created: "2026-05-12 14:32",  txCount: 87 },
  { id: "m2", agent: "pareto.eth",  status: "active",  cap: 25000, used:  8420, ttlDays: 12, venues: ["PENDLE"],             created: "2026-05-06 09:14",  txCount: 32 },
  { id: "m3", agent: "helios.eth",  status: "active",  cap: 75000, used: 41280, ttlDays: 22, venues: ["HL-HIP3", "AAVE-V3"], created: "2026-04-26 18:42",  txCount: 142 },
  { id: "m4", agent: "kepler.eth",  status: "expired", cap: 20000, used: 19840, ttlDays: 0,  venues: ["HL-HIP3"],            created: "2026-04-15 11:08",  txCount: 64 },
  { id: "m5", agent: "atlas.eth",   status: "revoked", cap: 40000, used:  6200, ttlDays: 0,  venues: ["AAVE-V3"],            created: "2026-04-04 16:21",  txCount: 18 }
];

const ACTIVITY = [
  { id: "t1", ts: "16:14:08", kind: "agent",     desc: "delphi.eth · openLong rTSLA-PERP", value: "+ $182,400 notional", hash: "0x4f29…e10a", ok: true },
  { id: "t2", ts: "16:13:52", kind: "sigil",     desc: "Action Sigil emitted · delphi.eth", value: "↳ mandate verified",  hash: "0x9b32…71c4", ok: true },
  { id: "t3", ts: "16:11:30", kind: "deposit",   desc: "Aqueduct · USDC inbound",          value: "+ $50,000",            hash: "0xa1f0…b288", ok: true },
  { id: "t4", ts: "16:07:14", kind: "vigil",     desc: "Vigil scan · all positions ok",    value: "7 venues checked",     hash: "—",            ok: true },
  { id: "t5", ts: "15:58:42", kind: "lantern",   desc: "Lantern · attestation #8,142,316", value: "Δ 0.00 bps",            hash: "0xa72f…91c4", ok: true },
  { id: "t6", ts: "15:42:18", kind: "trade",     desc: "Trade.xyz · short WBTC/USDC",      value: "− 5.42 WBTC",          hash: "0xc833…40af", ok: true },
  { id: "t7", ts: "15:21:04", kind: "agent",     desc: "kepler.eth · stop-out triggered",   value: "− $4,820",             hash: "0x720c…0e15", ok: false },
  { id: "t8", ts: "14:58:32", kind: "transfer",  desc: "Aqueduct · USDC → rh-chain",       value: "$200,000 ✓",           hash: "0x301f…9d22", ok: true }
];

const RECENT_RESERVES = [
  { block: 8142317, time: "16:00 UTC", delta: "0.00 bps", root: "0xa72f…91c4", ok: true  },
  { block: 8142057, time: "15:00 UTC", delta: "0.00 bps", root: "0xb18a…2204", ok: true  },
  { block: 8141801, time: "14:00 UTC", delta: "+0.40 bps", root: "0xc0f1…8b3c", ok: true  },
  { block: 8141544, time: "13:00 UTC", delta: "0.00 bps", root: "0xd29c…51e0", ok: true  },
  { block: 8141288, time: "12:00 UTC", delta: "0.00 bps", root: "0xe401…aa2b", ok: true  }
];

const TAX_LOTS = [
  { id: "l1", asset: "rTSLA",     event: "perp realised gain", date: "2026-05-12", proceeds: 84200, cost: 71800, gain: 12400, jurisdiction: "UK" },
  { id: "l2", asset: "rAAPL",     event: "spot disposal",      date: "2026-04-29", proceeds: 42100, cost: 38900, gain:  3200, jurisdiction: "UK" },
  { id: "l3", asset: "PT-stETH",  event: "PT redemption",      date: "2026-04-12", proceeds: 12080, cost: 12000, gain:    80, jurisdiction: "UK" },
  { id: "l4", asset: "USTB",      event: "interest realised",  date: "2026-04-01", proceeds:  1084, cost:     0, gain:  1084, jurisdiction: "UK" }
];

const SESSION_KEYS = [
  { id: "sk1", agent: "delphi.eth",  fp: "0x9f3a…b71d", created: "2026-05-12", ttl: "5d", scope: "HL-HIP3 · HL-HIP4 · ≤$50K" },
  { id: "sk2", agent: "pareto.eth",  fp: "0x2b4e…0a17", created: "2026-05-06", ttl: "12d", scope: "PENDLE · ≤$25K" },
  { id: "sk3", agent: "helios.eth",  fp: "0x7c91…d8f2", created: "2026-04-26", ttl: "22d", scope: "HL-HIP3 · AAVE-V3 · ≤$75K" }
];

const RECOVERY_GUARDIANS = [
  { id: "g1", label: "Hardware wallet · Ledger Nano X",  fp: "0x4f29…81e0", added: "2026-04-01", status: "active" },
  { id: "g2", label: "Co-founder · vitalik@atrium.fi",   fp: "0x9a02…3c4d", added: "2026-04-01", status: "active" },
  { id: "g3", label: "Legal counsel · Cooley · safe",     fp: "0xc4f1…22a9", added: "2026-04-05", status: "active" }
];

/* ---------------------------------------------------------------- */
/* Format helpers                                                    */
/* ---------------------------------------------------------------- */

const fmtUSD = (n, opts = {}) => {
  const { compact = false, decimals = 0, signed = false } = opts;
  const sign = signed && n > 0 ? "+ " : (n < 0 ? "− " : "");
  const v = Math.abs(n);
  if (compact) {
    if (v >= 1e9) return sign + "$" + (v/1e9).toFixed(2) + "B";
    if (v >= 1e6) return sign + "$" + (v/1e6).toFixed(2) + "M";
    if (v >= 1e3) return sign + "$" + (v/1e3).toFixed(1) + "K";
    return sign + "$" + v.toFixed(decimals);
  }
  return sign + "$" + v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const fmtPct = (n, decimals = 2) => {
  const sign = n > 0 ? "+ " : (n < 0 ? "− " : "");
  return sign + Math.abs(n).toFixed(decimals) + "%";
};

const shorten = (addr) => addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";

const ME = {
  address: "0x1a3b09f5e7c290b2d419a7c00bd4f4cd5f4e7f29",
  ens: "atrium.eth",
  passkey: "ATRIUM · Yubikey 5C · Touch ID",
  recoveryCount: 3
};

Object.assign(window, {
  VENUES, POSITIONS, AGENTS, MANDATES, ACTIVITY, RECENT_RESERVES, TAX_LOTS,
  SESSION_KEYS, RECOVERY_GUARDIANS, ME,
  fmtUSD, fmtPct, shorten
});
