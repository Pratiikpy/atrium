// Atrium — landing-page mock data (Lovable port, 2026-05-28)
// VERBATIM from Lovable's src/lib/atrium/mock.ts.
//
// These constants drive the landing page's visual mocks (impluvium,
// browser-window feature mockups, numbers strip). They are placeholder
// values for the visual prototype.
//
// IMPORTANT: the /app/* routes do NOT use these. Live testnet data on
// portfolio, trade, transfer, agents, settings, vault, reserves comes
// from wagmi/viem + Scribe queries via the existing data hooks.

import type {
  Agent,
  ActivityEvent,
  Attestation,
  Mandate,
  Position,
  Subsystem,
  TaxEvent,
  Venue,
} from "./types";

export const VENUES: Venue[] = [
  { id: "hl3", name: "Hyperliquid HIP-3", short: "HL-HIP3", type: "Tokenized-stock perps", collateral: 1_247_820, asset: "USDC · WETH", chain: "Arbitrum Sepolia" },
  { id: "hl4", name: "Hyperliquid HIP-4", short: "HL-HIP4", type: "Permissioned perps",   collateral: 483_160,   asset: "USDC",         chain: "Arbitrum Sepolia" },
  { id: "aav", name: "Aave Horizon",      short: "AAVE-V3", type: "RWA collateral",       collateral: 892_440,   asset: "aUSDC · USTB", chain: "Arbitrum Sepolia" },
  { id: "pen", name: "Pendle V2",         short: "PENDLE",  type: "Fixed-yield · PT",     collateral: 320_500,   asset: "PT-stETH",     chain: "Arbitrum Sepolia" },
  { id: "cur", name: "Curve",             short: "CURVE",   type: "Stableswap LP",        collateral: 186_720,   asset: "3pool LP",     chain: "Ethereum Sepolia" },
  { id: "trd", name: "Trade.xyz",         short: "TRADE",   type: "RFQ · dark pool",      collateral: 401_890,   asset: "WETH · WBTC",  chain: "Arbitrum Sepolia" },
  { id: "pmk", name: "Polymarket",        short: "PMK",     type: "Prediction · CTF",     collateral:  58_200,   asset: "USDC",         chain: "via Aqueduct" },
  { id: "rhc", name: "RH-Chain",          short: "RH-NTV",  type: "Native spot · pending", collateral: 0,        asset: "—",            chain: "Robinhood testnet", pending: true },
];

export const SUBSYSTEMS: Subsystem[] = [
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
  { num: "18", name: "Postern",  sub: "Wallet abstraction",   stack: "ERC-4337 · 7702",     phase: "P1" },
];

export const PORTFOLIO = {
  totalEquity: 3_590_730,
  buyingPower: 10_772_190,
  marginBuffer: 0.62,
  health: "Healthy" as const,
  collateralInVault: 3_590_730,
  unrealizedPnl: 42_180,
  margin: { initial: 1_120_410, maintenance: 612_205 },
};

export const POSITIONS: Position[] = [
  { id: "p1", venue: "HL-HIP3", market: "AAPL-PERP",  side: "LONG",  size: 120,    notional: 28_440,  entry: 232.10, mark: 237.00, pnl:   588.00, pnlPct: 2.07, marginUsed: 9_480 },
  { id: "p2", venue: "HL-HIP4", market: "ETH-PERP",   side: "SHORT", size: 18,     notional: 64_800,  entry: 3_650,  mark: 3_580,  pnl: 1_260.00, pnlPct: 1.94, marginUsed: 21_600 },
  { id: "p3", venue: "AAVE-V3", market: "aUSDC → USTB", side: "LEND", size: 250_000, notional: 250_000, entry: 1.000, mark: 1.000, pnl:   312.40, pnlPct: 0.12, marginUsed: 0 },
  { id: "p4", venue: "PENDLE",  market: "PT-stETH",   side: "YIELD", size: 92,     notional: 312_400, entry: 3_393,  mark: 3_395,  pnl:    184.00, pnlPct: 0.06, marginUsed: 0 },
  { id: "p5", venue: "TRADE",   market: "WBTC-USDC",  side: "LONG",  size: 0.42,   notional: 39_900,  entry: 94_500, mark: 95_000, pnl:    210.00, pnlPct: 0.53, marginUsed: 13_300 },
  { id: "p6", venue: "PMK",     market: "FED 25BP DEC", side: "BET",  size: 1_200,  notional: 720,     entry: 0.60,   mark: 0.62,   pnl:     24.00, pnlPct: 3.33, marginUsed: 720 },
];

export const ACTIVITY: ActivityEvent[] = [
  { id: "a1", at: "2026-05-26T09:14:00Z", kind: "trade",     label: "Open · ETH-PERP short 18 @ 3,650", asset: "ETH", hash: "0x9c2f…d41a", status: "success" },
  { id: "a2", at: "2026-05-26T08:48:00Z", kind: "mandate",   label: "Mandate signed · Augur (60 USDC/day)", hash: "0xeb14…77c1", status: "success" },
  { id: "a3", at: "2026-05-25T17:02:00Z", kind: "transfer",  label: "Aqueduct · 25,000 USDC → Polymarket", amount: 25_000, asset: "USDC", hash: "0x44a2…9012", status: "success" },
  { id: "a4", at: "2026-05-25T11:30:00Z", kind: "deposit",   label: "Vault deposit", amount: 500_000, asset: "USDC", hash: "0xb7e1…ac09", status: "success" },
  { id: "a5", at: "2026-05-24T19:55:00Z", kind: "trade",     label: "Open · AAPL-PERP long 120 @ 232.10", hash: "0x12fa…0d22", status: "success" },
  { id: "a6", at: "2026-05-24T08:20:00Z", kind: "trade",     label: "Close · ETH-PERP long 12 @ 3,712", hash: "0x7e9c…3ab8", status: "success" },
];

export const AGENTS: Agent[] = [
  { id: "augur",     name: "Augur",     strategy: "Mean reversion · cross-venue basis", risk: "Medium", pnl30d: 4.2,  maxDrawdown: -3.1, venues: ["HL-HIP3", "AAVE-V3", "PENDLE"], status: "live" },
  { id: "haruspex",  name: "Haruspex",  strategy: "Momentum · perp-only",               risk: "High",   pnl30d: 11.8, maxDrawdown: -7.4, venues: ["HL-HIP3", "HL-HIP4", "TRADE"], status: "live" },
  { id: "auspex",    name: "Auspex",    strategy: "Basis trade · funding capture",      risk: "Low",    pnl30d: 1.9,  maxDrawdown: -0.6, venues: ["HL-HIP3", "PENDLE"],            status: "backtest" },
];

export const MANDATES: Mandate[] = [
  {
    id: "m1",
    agentId: "augur",
    budget: 60,
    perAction: 12,
    totalCap: 200,
    maxDailyLoss: 25,
    dailyActions: 8,
    venues: ["HL-HIP3", "AAVE-V3"],
    expiresAt: "2026-06-02T00:00:00Z",
    intentHash: "0xeb14…77c1",
  },
];

export const ATTESTATIONS: Attestation[] = [
  { id: "att1", at: "2026-05-26T10:00:00Z", merkleRoot: "0x9f3c…a8e1", ipfsHash: "bafy…q2xa", assets: 4_211_330, liabilities: 4_209_900 },
  { id: "att2", at: "2026-05-26T09:00:00Z", merkleRoot: "0x7c12…3b04", ipfsHash: "bafy…lk39", assets: 4_209_710, liabilities: 4_208_500 },
];

export const TAX_EVENTS: TaxEvent[] = [
  { id: "t1", date: "2026-05-25", kind: "Perp close", venue: "HL-HIP3", proceeds: 28_900, cost: 27_840, pnl: 1_060 },
  { id: "t2", date: "2026-05-22", kind: "PT redeem",  venue: "PENDLE",  proceeds: 12_540, cost: 12_200, pnl:   340 },
  { id: "t3", date: "2026-05-18", kind: "Spot sell",  venue: "TRADE",   proceeds:  8_220, cost:  7_980, pnl:   240 },
];

export const PARTNERS = [
  "Pendle Labs", "Variational", "Horizen", "IOSG",
  "Robinhood Chain", "Hyperliquid", "Aave Labs", "Coinbase",
];

export const fmtUSD = (n: number, opts: { compact?: boolean } = {}) => {
  const { compact = false } = opts;
  if (compact) {
    const a = Math.abs(n);
    if (a >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
    return "$" + n.toFixed(0);
  }
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

export const fmtPct = (n: number, digits = 2) =>
  (n >= 0 ? "+" : "") + n.toFixed(digits) + "%";

export const shortAddr = (a: string) =>
  a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

export const MOCK_ADDRESS = "0x842B…91F4";
