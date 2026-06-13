// Atrium, static catalog data for the landing page.
//
// VENUES and SUBSYSTEMS describe the system architecture. The factual fields
// on a Venue are id/name/short/type/asset/chain/pending; the `illustrativeCollateral`
// field is an ILLUSTRATIVE relative weight (see note below), NOT a real TVL.
// TECHNOLOGY_STACK lists the protocols Atrium builds on (all verifiable from
// the codebase under resources/ and contracts/).
//
// IMPORTANT: the /app/* routes do NOT use these. Live testnet data on
// portfolio, trade, transfer, agents, settings, vault, reserves comes
// from wagmi/viem + Scribe queries via the existing data hooks.

import type { Subsystem, Venue } from "./types";

// Audit honesty note (#66): the `collateral` figures below are ILLUSTRATIVE
// relative weights used ONLY by the Impluvium schematic (components/atrium/
// Impluvium.tsx), which is explicitly labelled "Plan view · illustrative
// schematic". They are NOT real per-venue TVL and MUST NOT be rendered as a
// dollar figure presented as live data (the landing venue grid used to do
// this under a green "Live" tag - removed; it now shows the factual collateral
// asset types instead). Any real per-venue TVL must come from a live Scribe/
// RPC read, never from this file.
export const VENUES: Venue[] = [
  { id: "hl3", name: "Hyperliquid HIP-3", short: "HL-HIP3", type: "Tokenized-stock perps", illustrativeCollateral: 1_247_820, asset: "USDC · WETH", chain: "Arbitrum Sepolia" },
  { id: "hl4", name: "Hyperliquid HIP-4", short: "HL-HIP4", type: "Permissioned perps",   illustrativeCollateral: 483_160,   asset: "USDC",         chain: "Arbitrum Sepolia" },
  { id: "aav", name: "Aave Horizon",      short: "AAVE-V3", type: "RWA collateral",       illustrativeCollateral: 892_440,   asset: "aUSDC · USTB", chain: "Arbitrum Sepolia" },
  { id: "pen", name: "Pendle V2",         short: "PENDLE",  type: "Fixed-yield · PT",     illustrativeCollateral: 320_500,   asset: "PT-stETH",     chain: "Arbitrum Sepolia" },
  { id: "cur", name: "Curve",             short: "CURVE",   type: "Stableswap LP",        illustrativeCollateral: 186_720,   asset: "3pool LP",     chain: "Ethereum Sepolia" },
  { id: "trd", name: "Trade.xyz",         short: "TRADE",   type: "RFQ · dark pool",      illustrativeCollateral: 401_890,   asset: "WETH · WBTC",  chain: "Arbitrum Sepolia" },
  { id: "pmk", name: "Polymarket",        short: "PMK",     type: "Prediction · CTF",     illustrativeCollateral:  58_200,   asset: "USDC",         chain: "via Aqueduct" },
  { id: "rhc", name: "RH-Chain",          short: "RH-NTV",  type: "Native spot · pending", illustrativeCollateral: 0,        asset: "-",            chain: "Robinhood testnet", pending: true },
];

export const SUBSYSTEMS: Subsystem[] = [
  { num: "01", name: "Plinth",   sub: "Margin engine",        stack: "Stylus · Rust",       phase: "P1" },
  { num: "02", name: "Vigil",    sub: "Liquidation engine",   stack: "Stylus · Rust",       phase: "P1" },
  { num: "03", name: "Stoa",     sub: "Options pricing",      stack: "Stylus · Rust",       phase: "P2" },
  { num: "04", name: "Portico",  sub: "Venue framework",      stack: "Solidity · OZ",       phase: "P1" },
  { num: "05", name: "Aqueduct", sub: "Cross-chain bridge",   stack: "Solidity · CCIP",     phase: "P1" },
  { num: "06", name: "Sigil",    sub: "Agent credit",         stack: "Stylus · ERC-8004",   phase: "P1" },
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

/** Technology stack Atrium builds on, verifiable from resources/ and contracts/. */
export const TECHNOLOGY_STACK = [
  "Arbitrum",
  "Stylus",
  "Chainlink CCIP",
  "Pyth Network",
  "The Graph",
  "ERC-4337",
  "ERC-8004",
  "x402",
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
