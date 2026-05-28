// Atrium — typed mock domain (Lovable port, 2026-05-28)
// Source: Lovable prototype src/lib/atrium/types.ts (verbatim port).
// These types back the landing-page visual mocks. Live data still flows
// through wagmi/viem + Scribe queries on the /app/* routes.

export type Phase = "P1" | "P2";

export type Venue = {
  id: string;
  name: string;
  short: string;
  type: string;
  asset: string;
  chain: string;
  collateral: number;
  pending?: boolean;
};

export type Subsystem = {
  num: string;
  name: string;
  sub: string;
  stack: string;
  phase: Phase;
};

export type Position = {
  id: string;
  venue: string;
  market: string;
  side: "LONG" | "SHORT" | "LEND" | "YIELD" | "BET";
  size: number;
  notional: number;
  entry: number;
  mark: number;
  pnl: number;
  pnlPct: number;
  marginUsed: number;
};

export type ActivityEvent = {
  id: string;
  at: string;
  kind: "deposit" | "withdraw" | "trade" | "mandate" | "transfer" | "kill";
  label: string;
  amount?: number;
  asset?: string;
  hash?: string;
  status: "success" | "pending" | "failed";
};

export type Agent = {
  id: string;
  name: string;
  strategy: string;
  risk: "Low" | "Medium" | "High";
  pnl30d: number;
  maxDrawdown: number;
  venues: string[];
  status: "live" | "backtest" | "deboost";
};

export type Mandate = {
  id: string;
  agentId: string;
  budget: number;
  perAction: number;
  totalCap: number;
  maxDailyLoss: number;
  dailyActions: number;
  venues: string[];
  expiresAt: string;
  intentHash: string;
};

export type WalletState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; address: string; chain: "arb-sepolia" }
  | { status: "wrong-network"; address: string; chain: string }
  | { status: "rejected" };

export type TxState =
  | { status: "idle" }
  | { status: "pending"; label: string; startedAt: number }
  | { status: "success"; label: string; hash: string }
  | { status: "rejected"; label: string; reason: string }
  | { status: "stuck"; label: string; hash: string };

export type Attestation = {
  id: string;
  at: string;
  merkleRoot: string;
  ipfsHash: string;
  assets: number;
  liabilities: number;
};

export type TaxEvent = {
  id: string;
  date: string;
  kind: string;
  venue: string;
  proceeds: number;
  cost: number;
  pnl: number;
};

export type Jurisdiction = "UK" | "US" | "DE";

export const BLOCKER = {
  coffer: "Coffer deploys Month 1 W2",
  safety: "Safety contracts deploy Month 1 W2",
  verifier: "Agent verifier deploys Month 1 W2",
  lantern: "Lantern publisher starts Month 6",
  recovery: "Recovery — coming Month 8",
  notifications: "Notifications — coming Month 5",
  network: "Network settings — coming Month 3",
  account: "Account settings — coming Month 4",
  postern: "Postern session-key indexing pending",
} as const;
