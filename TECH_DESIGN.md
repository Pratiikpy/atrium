# ATRIUM — Technical Design Document (TDD)

**Project:** Atrium — cross-venue portfolio margin on Arbitrum Sepolia (primary) + Robinhood Chain testnet (when SDK ships)
**Status:** **v1.1 — post-audit consolidated baseline** (8 MUST-FIX + 12 SHOULD-FIX patches applied; §24 audit trail). Paired with `ATRIUM_PRD.md` v0.15.
**Last updated:** 2026-05-18
**Owner:** F1 (smart-contract lead)
**Reviewers:** F2 (frontend lead), F3 (research/BD/ops)
**Companion docs:** `ATRIUM_PRD.md` (WHAT + WHY), `RESOURCES.md` (cloned deps), `DEVELOPER_DOCUMENTATION.md` (Arbitrum/Stylus refs)

---

## 1. Executive Summary

Atrium is the EVM-native unified portfolio-margin protocol on Arbitrum, written primarily in **Rust + Stylus** for the compute-heavy risk engine and **Solidity** for adapters, registries, and CCIP integration. The product collapses collateral fragmentation across multiple onchain venues (Hyperliquid HIP-3, Aave Horizon, Pendle V2, Polymarket via CCIP, Trade.xyz, Curve, RH-Chain when SDK ships) into a single SPAN-style margin account. AI agents are first-class users via ERC-8004 identity + Sigil EIP-712 mandates + Postern session keys.

**Year-1 scope:** testnet only. **Year-1 budget:** $0 founder capital (~$75/year domain+VPS). **Year-1 team:** F1 + F2 + F3 minimum, scales with bigger team without architecture change.

**Why this TDD exists:** the PRD says WHAT and WHY; this TDD says HOW. Every interface in §11/§12 of the PRD is here with concrete storage layouts, error types, gas budgets, dependency graphs, failure modes, and test plans. Every external dependency is verified against the cloned repo in `resources/`.

---

## 2. Goals

| # | Goal | Success criterion |
|---|---|---|
| G1 | Single unified margin account aggregating positions across ≥5 onchain venues | Plinth computes margin across ≥5 distinct venue adapters; Coffer holds USDC collateral once for all |
| G2 | Stylus-native compute for SPAN-style risk math, 10–100× cheaper than Solidity equivalent (per Arbitrum docs) | Gas-per-margin-recompute measured + published on `loadtest.atrium.fi` |
| G3 | AI-agent-friendly substrate with cryptographically safe delegation | Sigil EIP-712 mandate + Postern session key + Kill Switch revoke flow live, demonstrated end-to-end |
| G4 | Open standards (IPorticoAdapter v1.0, Sigil mandate schema) usable by third parties without permission | MIT-licensed; reference adapter ships from Atrium; ≥1 community adapter accepted via Curator grant by Day 180 |
| G5 | Cross-chain collateral mobility | Aqueduct moves collateral Arbitrum Sepolia ↔ Ethereum Sepolia via Chainlink CCIP testnet; round-trip ≤ 30 min on testnet |
| G6 | Proof-of-reserves verifiable in ≤30 sec by any judge | Lantern publishes Merkle attestations hourly; root committed on-chain; user can verify own balance via on-chain inclusion proof |
| G7 | Formal verification of 5 core safety invariants | 5 Kani+proptest proofs green in CI by Day -4; badge in README |
| G8 | Honest live numbers — no inflated claims | Every "X partners / Y agents / Z TVL" rendered from on-chain Scribe queries; PRD references match dashboard reality |

## 3. Non-Goals

| # | Non-goal | Why |
|---|---|---|
| NG1 | Mainnet deployment in Year 1 | Mainnet flip is Year-2 gate post-audit |
| NG2 | Native iOS/Android apps | PWA via Postern passkey covers mobile; native is Year-2 |
| NG3 | Full Trail-of-Bits / Spearbit / Certora audit | Code4rena public contest Month 10 is the testnet-mature gate; full audit is Year-2 mainnet gate |
| NG4 | Token launch / DAO governance v1 | No token in Year 1; governance v0 = founder multisig + community-veto window via Snapshot |
| NG5 | Build a new DEX or perp protocol | Atrium routes through existing venues via Portico adapters; we are infrastructure, not a venue |
| NG6 | Build a consumer trading frontend | Verifier Mode is a *demo* surface; production frontends (web/desktop trading UIs) will be third-party integrations |
| NG7 | Custodian-style asset segregation | Non-custodial throughout — users hold their assets in Coffer (ERC-4626 shares); Atrium contracts hold custody only of collateral pools required for margin |
| NG8 | LLM-based AI components | "Agent" = ERC-8004-registered smart agent executing pre-specified strategies; not LLM inference at runtime |
| NG9 | Solidity-only path | Stylus is required for Plinth — it's the differentiator; Solidity is fine for adapters where compute isn't the bottleneck |

## 4. Tenets (decision principles)

These are the rules every implementation decision must respect.

1. **Testnet-honesty.** Every "live" claim renders from on-chain data, never inflated. If 2 of 3 keepers are operational, the dashboard says 2/3.
2. **Verify before citing.** No tool/library is referenced in this TDD without a verified file path in `resources/`. Halmos was the cautionary tale (PRD §28.1).
3. **Public interface = open standard.** IPorticoAdapter v1.0, Sigil EIP-712 schema, ResearchAttestation event format — all MIT-licensed, all stable from day-1 release.
4. **Compute on Stylus, control on Solidity.** SPAN math and Greeks → Stylus. Adapters, registries, CCIP wrappers, governance → Solidity (the ecosystem we integrate with is Solidity-native).
5. **Free-tier default.** Free tier is the design constraint. If a service has no usable free tier, prefer self-hosting on the $5/mo VPS or skip the feature.
6. **No fake immutability.** Testnet contracts are upgradeable via OZ UUPS pattern + multisig. We're explicit about that, not pretending we're immutable on day 1.
7. **Honest scope cuts.** When a tripwire fires (PRD §26.3), announce the cut publicly the same day. Silent slippage is worse than visible scope cuts.
8. **Reproducibility.** `make demo` from a fresh clone produces a working local stack in ≤90 seconds. Backtests are Jupyter notebooks with seeds + pinned data sources.

## 5. Background

### 5.1 The cross-margin gap on EVM

Today, a trader running a hedged position split across Hyperliquid HIP-3 perps + Aave Horizon T-bills + Pendle V2 yield-tokens posts **separate margin at each venue**. Total collateral lockup ≈ 2× what a portfolio-margin system would require, because each venue treats positions independently without netting.

Centralized prime brokers (Goldman, Citi) have solved this since the 1990s (SPAN, TIMS). Crypto-native portfolio margin exists at centralized venues (Hyperliquid native cross-margin, dYdX v4 isolated/cross). **No EVM-native protocol cross-margins across multiple independent venues yet.** Cascade (Solana, ~$15M raised) and August (~$10M) are addressing adjacent problems on Solana. Project 0 (Solana) proves demand. Atrium is the EVM substrate for this category.

### 5.2 Why now

- Hyperliquid HIP-3 OI grew ~$280M → ~$2.0B in Q1 2026 (peaked $2.38B mid-April per Yahoo Finance / The Defiant); trade.xyz holds ~90%
- ERC-8004 trustless-agents standard live on Ethereum mainnet 2026-01-29 (10K+ agents on testnet pre-mainnet)
- BlackRock + Robinhood institutional bets on Arbitrum
- Stylus production-ready on Arbitrum One since 2024; SDK + cargo-stylus mature
- Coinbase x402 micropayments shipped (multi-language SDKs)
- ERC-4337 EntryPoint v0.9 + EIP-7702 (in EntryPoint v0.9) enable Postern wallet abstraction

### 5.3 Differentiators (vs Cascade, August, Project 0)

| Axis | Atrium | Cascade | August | Project 0 |
|---|---|---|---|---|
| Chain ecosystem | EVM (Arbitrum + RH-Chain) | Solana | Solana | Solana |
| Margin computation | Stylus (Rust → WASM) | Solidity-equivalent (Solana programs) | n/a | n/a |
| Agent integration | First-class via Sigil + Postern + ERC-8004 | Limited | n/a | n/a |
| Open adapter standard | IPorticoAdapter v1.0 (MIT) | Closed | n/a | n/a |
| Formal verification | 5 Kani+proptest invariants in CI | n/a | n/a | n/a |
| Year-1 budget | $0 founder capital | $15M raised | $10M raised | n/a |

---

## 6. High-Level Architecture

### 6.1 C4 Level 1 — System context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ATRIUM (the system)                            │
│                                                                         │
│  ┌────────────┐    ┌────────────────┐    ┌───────────────┐              │
│  │   Users    │    │ AI Agents      │    │ Third-party   │              │
│  │ (humans)   │───►│ (ERC-8004)     │    │ frontends     │              │
│  └────────────┘    └────────────────┘    └───────────────┘              │
│         │                  │                   │                        │
│         ▼                  ▼                   ▼                        │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │              Atrium Core (this TDD)                     │            │
│  └─────────────────────────────────────────────────────────┘            │
│         │                  │                   │                        │
│         ▼                  ▼                   ▼                        │
│  ┌──────────┐  ┌───────────────────┐  ┌──────────────┐                  │
│  │ Onchain  │  │ Oracles           │  │ Indexer      │                  │
│  │ venues   │  │ (Chainlink + Pyth)│  │ (The Graph)  │                  │
│  └──────────┘  └───────────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 C4 Level 2 — Container view

Atrium is composed of three layers + Postern entry layer:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ POSTERN (entry layer — wallet abstraction)                               │
│  Coinbase Smart Wallet + Pimlico bundler + ERC-7715 session keys        │
│  + EIP-7702 (via EntryPoint v0.9) + Kill Switch                          │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ CORE CONTROL PLANE (Stylus contracts on Arbitrum Sepolia)                │
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │ Plinth     │  │ Vigil      │  │ Coffer     │  │ Sigil      │          │
│  │ (margin)   │◄►│ (liquid.)  │  │ (vault)    │  │ (mandates) │          │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘          │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────┐            │
│  │ ResearchAttestation · Edict (tiers) · Praetor (admin)    │            │
│  └──────────────────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ VENUE LAYER (Solidity adapters implementing IPorticoAdapter v1.0)        │
│                                                                          │
│  Portico-Hyperliquid  Portico-Aave  Portico-Pendle  Portico-Trade.xyz   │
│  Portico-Polymarket   Portico-Curve  Portico-RH-Chain (when SDK ships)  │
│                                                                          │
│  Aqueduct (Chainlink CCIP) — cross-chain collateral mobility            │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ DATA + OPS PLANE (off-chain services)                                    │
│                                                                          │
│  Scribe (The Graph subgraph) · Archive (Python risk lab + backtests)    │
│  Codex (x402-payable APIs)  · Lantern (proof-of-reserves attestor)      │
│  Rostrum (agent leaderboard) · Augur/Haruspex/Auspex (reference agents) │
│  3× Vigil keepers · Tablet (tax exports) · Praetor (ops CLI)            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.3 C4 Level 3 — Component dependency graph

```
                     ┌──────────┐
                     │ Coffer   │  (ERC-4626 vault, holds USDC)
                     └─────┬────┘
                           │ owns
                           ▼
                     ┌──────────┐                ┌────────────┐
                     │ Plinth   │◄───reads───────┤ Chainlink  │
                     │ (margin) │                │ + Pyth     │
                     └─────┬────┘                └────────────┘
                           │ triggers
                           ▼
                     ┌──────────┐
       ┌───keeps────►│ Vigil    │
       │             └─────┬────┘
       │                   │ executes
   ┌───┴────┐               ▼
   │ Keepers│        ┌─────────────────┐
   │ (3×)   │        │ Portico adapters│  (Solidity, IPorticoAdapter v1.0)
   └────────┘        │  Hyperliquid    │
                     │  Aave Horizon   │
                     │  Pendle V2      │
                     │  Polymarket     │◄──Aqueduct (CCIP)──Ethereum Sepolia
                     │  Trade.xyz      │
                     │  Curve          │
                     │  RH-Chain       │
                     └─────────────────┘
                           ▲
                           │ acts on behalf of
                     ┌─────┴────┐
                     │ Sigil    │  (EIP-712 mandates)
                     └─────┬────┘
                           │ validates
                           ▼
                     ┌──────────┐
                     │ Agent    │  (ERC-8004 identity + Postern session key)
                     └──────────┘
```

Read-side / indexing:

```
On-chain events  →  Scribe (Graph subgraph)  →  Codex (x402 API)  →  Third-party clients
                                              →  Verifier Mode UI
                                              →  Cohort Status Page
                                              →  Rostrum leaderboard
                                              →  Lantern attestation feed
```

### 6.4 Critical-path runtime sequence (margin update)

```
Agent calls IPorticoAdapter.open_position(...) via Sigil mandate
       │
       ▼
Adapter ─► (calls into venue protocol, e.g., HL Bridge2 deposit + L1 API order)
       │
       ▼
Adapter emits PositionOpened event
       │
       ▼
Scribe indexes event ─► triggers Plinth.update_margin(agent_address)
       │
       ▼
Plinth reads:
   • Coffer.balance_of(agent) for collateral
   • all open positions via PorticoRegistry
   • prices: median(Chainlink, Pyth) within 50bps tolerance else PAUSE
       │
       ▼
Plinth.compute_required_margin() — SPAN scenario matrix (Stylus, Rust)
       │
       ▼
Plinth emits MarginUpdated; writes to MarginAccount storage
       │
       ▼ (if collateral < required margin)
Plinth.pause(agent) ─► triggers Vigil.queue_liquidation(agent)
       │
       ▼
First responding keeper executes Vigil.execute_liquidation(...)
   • ≤10% of position per block (partial-liquidation discipline)
   • NMS-aware ordering — most liquid position first
   • Receives keeper reward in bps
       │
       ▼
Vigil emits LiquidationCompleted; Scribe indexes; UI updates
```

---

## 7. Detailed Design — On-chain (Stylus + Solidity)

### 7.1 Plinth — portfolio margin engine (Stylus / Rust)

**Purpose:** Compute required margin for an account given all open positions, current oracle prices, haircuts, and correlation classes. SPAN-style scenario matrix.

**Why Stylus:** SPAN computation is a nested loop over (scenarios × positions × correlation classes). Per Arbitrum's published Stylus benchmarks (verified at `resources/arbitrum-docs/docs/stylus/concepts/gas-metering.mdx`), **compute-heavy loops are 10–100× cheaper than equivalent Solidity**. This is the differentiator.

**File:** `contracts/plinth/src/lib.rs`. Built using pattern from `resources/stylus-sdk-rs/examples/erc20/src/erc20.rs`.

**Storage layout** (verified pattern — `sol_storage!` macro from `stylus_sdk::prelude`):

```rust
use alloy_primitives::{Address, U256, I256};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;

sol_storage! {
    pub struct Plinth {
        mapping(address => MarginAccount) accounts;
        mapping(uint256 => Position) positions;
        mapping(address => uint256[]) user_positions;  // capped at MAX_POSITIONS_PER_USER
        uint256 next_position_id;
        address coffer_address;
        address portico_registry_address;
        address chainlink_oracle;
        address pyth_oracle;
        address praetor_multisig;
        address vigil_address;                 // M5 fix: explicit Plinth→Vigil edge
        bool is_updating;                       // M2 fix: reentrancy in-progress flag
        PlinthParams params;
        bool is_global_paused;
    }
    pub struct MarginAccount {
        uint256 collateral_value_wei;
        uint256 required_margin_wei;
        uint64 last_update_block;
        uint64 last_oracle_publish_time;
        uint256 margin_version;                 // M6 fix: monotonic nonce, prevents liquidation race
        bool is_paused;
        uint16 risk_tier;
    }
    pub struct Position {
        address owner;
        uint8 venue_id;
        bytes32 instrument_id;
        int256 notional_signed;
        uint256 entry_price_q64;
        uint64 opened_at_block;
        uint16 haircut_bps;
        uint16 correlation_class;
    }
    pub struct PlinthParams {
        uint16 max_positions_per_user;          // initial: 100
        uint16 max_correlation_classes;         // initial: 16
        uint16 oracle_tolerance_bps;            // 50
        uint32 oracle_freshness_seconds;        // 60
        uint16 partial_liquidation_max_bps;     // 1000 (10%/block)
        uint16 min_initial_margin_bps;          // 500 (5% floor)
        uint16 maint_margin_buffer_bps;         // 200 (2% buffer over IM)
    }
}

sol! {
    event MarginUpdated(address indexed user, uint256 collateral_value_wei, uint256 required_margin_wei, uint64 block_number);
    event PositionOpened(uint256 indexed position_id, address indexed owner, uint8 venue_id, bytes32 instrument_id, int256 notional_signed);
    event PositionClosed(uint256 indexed position_id, int256 realized_pnl_signed);
    event PlinthPaused(string reason, uint64 block_number);
    event PlinthResumed(uint64 block_number);
    event AccountPaused(address indexed user, string reason);
}
```

**Public functions** (Stylus `#[public]` impl block):

```rust
#[public]
impl Plinth {
    pub fn open_position(
        &mut self,
        venue_id: u8,
        instrument_id: alloy_primitives::FixedBytes<32>,
        notional_signed: I256,
        action_sigil: Vec<u8>,  // EIP-712 encoded ActionSigil bytes; empty if owner is caller
    ) -> Result<U256, PlinthError> { /* … */ }

    pub fn close_position(&mut self, position_id: U256) -> Result<I256, PlinthError> { /* … */ }

    pub fn update_margin(&mut self, user: Address) -> Result<U256, PlinthError> { /* … */ }

    pub fn get_account(&self, user: Address) -> MarginAccountView { /* … */ }

    pub fn compute_required_margin(&self, user: Address) -> U256 { /* … */ }

    // SPAN scenario matrix — the compute-heavy core, Kani-verified
    fn span_required_margin(positions: &[Position], scenarios: &[Scenario]) -> U256 { /* … */ }
}
```

**Errors** (Solidity-compatible via `sol!`) + Result mapping per Stylus convention:

```rust
sol! {
    error AccountPausedError(address user);
    error PlinthGloballyPaused();
    error OracleStaleError(uint64 last_publish_time, uint64 now_seconds);
    error OracleDisagreementError(uint256 chainlink_price, uint256 pyth_price, uint16 tolerance_bps);
    error TooManyPositionsError(uint16 current, uint16 max);
    // iter 49: removed dead InsufficientCollateralError — never reverted;
    // actual `collateral < required` path pauses + queues liquidation.
    error InvalidActionSigil(bytes32 reason);
    error UnauthorizedCaller(address caller);
    error Reentrant();
}

// Result type — required by Stylus #[public] convention
#[derive(SolidityError)]
pub enum PlinthError {
    AccountPaused(AccountPausedError),
    GloballyPaused(PlinthGloballyPaused),
    OracleStale(OracleStaleError),
    OracleDisagreement(OracleDisagreementError),
    TooManyPositions(TooManyPositionsError),
    // iter 49: InsufficientCollateral variant removed (dead).
    InvalidActionSigil(InvalidActionSigil),
    UnauthorizedCaller(UnauthorizedCaller),
    Reentrant(Reentrant),
}
```

**Dual-oracle median check** (called inside every margin recompute) — using **verified Stylus host-call API** from `resources/stylus-sdk-rs/examples/erc20/src/erc20.rs` (line 80 confirms `self.vm().log(...)`, line 162 confirms `self.vm().msg_sender()`):

```rust
fn get_safe_price(&self, instrument: FixedBytes<32>) -> Result<U256, PlinthError> {
    let cl_price = self.read_chainlink(instrument)?;
    let pyth_price = self.read_pyth(instrument)?;  // uses IPyth.getPriceNoOlderThan(id, 60)
    let now: u64 = self.vm().block_timestamp();  // verified host-call API

    // Freshness check (each independently)
    if now.saturating_sub(cl_price.publish_time) > self.params.oracle_freshness_seconds as u64
        || now.saturating_sub(pyth_price.publish_time) > self.params.oracle_freshness_seconds as u64 {
        return Err(PlinthError::OracleStaleError {
            last_publish_time: cl_price.publish_time.min(pyth_price.publish_time),
            now,
        });
    }

    // Tolerance check
    let diff_bps = abs_diff_bps(cl_price.value, pyth_price.value);
    if diff_bps > self.params.oracle_tolerance_bps {
        return Err(PlinthError::OracleDisagreementError {
            chainlink_price: cl_price.value,
            pyth_price: pyth_price.value,
            tolerance_bps: self.params.oracle_tolerance_bps,
        });
    }

    Ok(median(cl_price.value, pyth_price.value))
}
```

**Plinth → Vigil call** (fix for race + missing trigger surface):

```rust
sol_interface! {
    interface IVigil {
        function queueLiquidation(address user, uint256 margin_version) external;
    }
}

#[public]
impl Plinth {
    pub fn update_margin(&mut self, user: Address) -> Result<U256, PlinthError> {
        // ACCESS CONTROL: only registered adapters, keepers, the user themselves,
        // or Praetor multisig can trigger recomputation. Prevents external DOS griefing.
        let caller = self.vm().msg_sender();
        require!(
            caller == user
                || self.portico_registry().is_registered_adapter(caller)
                || self.vigil().is_active_keeper(caller)
                || caller == self.praetor_multisig.get(),
            PlinthError::UnauthorizedCaller
        );

        // REENTRANCY: in-progress flag prevents re-entry from adapter callbacks
        require!(!self.is_updating.get(), PlinthError::Reentrant);
        self.is_updating.set(true);

        let result = self._do_update_margin(user);

        self.is_updating.set(false);

        // ATOMIC LIQUIDATION TRIGGER (race fix per audit M6):
        // If account becomes under-collateralized, increment margin_version
        // and queue liquidation. Vigil must check margin_version on execution.
        if let Ok(req) = &result {
            let account = self.accounts.getter(user);
            if account.collateral_value_wei.get() < *req {
                let new_version = account.margin_version.get() + U256::from(1);
                self.accounts.setter(user).margin_version.set(new_version);
                IVigil::new(self.vigil_address.get()).queue_liquidation(self, user, new_version)?;
                self.vm().log(AccountPaused { user, reason: "under-collateralized".to_string() });
            }
        }

        result
    }
}
```

The `margin_version` nonce closes the M6 race: when a keeper calls `Vigil.execute_liquidation(job_id)`, Vigil reads `Plinth.accounts(user).margin_version` and refuses if it doesn't match the queued version (account was re-margined in between → re-queue).

**Gas budget targets** (to be measured + published on `loadtest.atrium.fi`):

| Operation | Target gas | Notes |
|---|---|---|
| `open_position` (1 new, account has 5 existing) | ≤120K | Includes margin recompute |
| `update_margin` (10 positions, 8 scenarios) | ≤80K | Stylus-native compute path |
| `close_position` | ≤90K | |
| Read-only `get_account` | ≤25K | View function |

If targets miss by >2× after Stylus optimization pass, revisit data layout or scenario count.

**Storage upgrade strategy:** Plinth uses ERC-7201 namespaced storage slots (same pattern as `resources/erc-8004-contracts/contracts/IdentityRegistryUpgradeable.sol`) so storage layout can evolve without slot collisions across upgrades. Per Tenet 6, the contract is upgradeable via Praetor multisig + 48h timelock; this is documented, not hidden.

### 7.2 Vigil — liquidation engine (Stylus / Rust)

**Purpose:** When Plinth marks an account under-collateralized, Vigil queues a liquidation; competing keeper bots race to execute, earning bps reward. Economic security via testnet ARB staking + slashing on missed windows.

**File:** `contracts/vigil/src/lib.rs`.

```rust
sol_storage! {
    pub struct Vigil {
        address plinth_address;
        address coffer_address;
        address portico_registry_address;
        mapping(address => Keeper) keepers;
        mapping(uint256 => LiquidationJob) jobs;
        uint256 next_job_id;
        address[] active_keepers;
        VigilParams params;
    }
    pub struct Keeper {
        uint256 stake_wei;
        uint32 missed_windows_24h;
        uint64 last_action_block;
        uint64 last_miss_block;
        bool is_active;
    }
    pub struct LiquidationJob {
        uint256 position_id;
        address user;                                    // M6 fix: needed for margin_version check
        address triggered_by_keeper;
        uint256 max_liquidation_bps;                     // ≤params.partial_liquidation_max_bps
        uint256 margin_version_at_queue;                 // M6 fix: nonce snapshot at queue time
        uint64 deadline_block;
        uint8 priority;                                  // NMS-aware: most liquid venues first
        bool is_complete;
    }
    pub struct VigilParams {
        uint256 keeper_min_stake_wei;       // 1000 testnet ARB equivalent
        uint16 keeper_reward_bps;           // 50 (0.5% of liquidated notional)
        uint32 slash_window_blocks;         // 7200 (~24h on Arbitrum Sepolia)
        uint16 max_misses_per_window;       // 3
        uint16 liquidation_window_blocks;   // 30 (~2 min)
    }
}

sol! {
    event LiquidationTriggered(uint256 indexed job_id, uint256 indexed position_id, uint64 deadline_block, uint8 priority);
    event LiquidationExecuted(uint256 indexed job_id, address indexed keeper, int256 recovered_collateral_wei, uint16 actual_liquidation_bps);
    event KeeperStaked(address indexed keeper, uint256 stake_amount_wei);
    event KeeperSlashed(address indexed keeper, uint256 slashed_amount_wei, string reason);
    event KeeperRewarded(address indexed keeper, uint256 reward_wei);
}
```

**Key invariants** (Kani+proptest verified):

1. `keeper.stake_wei >= params.keeper_min_stake_wei` while `is_active = true`
2. `job.max_liquidation_bps <= params.partial_liquidation_max_bps` always
3. A single liquidation can never reduce a healthy account to under-collateralized (post-liquidation collateral ≥ post-liquidation required margin)
4. **(M6 fix)** Vigil.execute_liquidation MUST check `plinth.accounts(user).margin_version == job.margin_version_at_queue_time`. If mismatch, refuse to execute and re-queue. This closes the race where margin is recomputed between liquidation queue and execution.

```rust
// In Vigil's execute_liquidation, before any state mutation:
pub fn execute_liquidation(&mut self, job_id: U256) -> Result<U256, VigilError> {
    let job = self.jobs.getter(job_id);
    let current_version = IPlinth::new(self.plinth_address.get())
        .get_margin_version(self, job.user.get())?;
    require!(
        current_version == job.margin_version_at_queue.get(),
        VigilError::StaleJobVersion
    );
    // ... proceed with liquidation
}
```

**NMS ordering (No Market-disruption Sequencing):** When a multi-position account is liquidated, Vigil picks the order using `IPorticoAdapter.get_venue_health()` — most-liquid venues get partial-closed first to minimize market impact and reduce keeper failure probability.

### 7.3 Coffer — ERC-4626 collateral vault (Stylus / Rust)

**Purpose:** Single USDC vault holding all user collateral as ERC-4626 shares. Plinth has read-access to balances and a haircut hook for paused accounts.

**Built on:** `resources/rust-contracts-stylus/contracts/src/token/erc20/extensions/erc4626.rs` (verified file exists; crate name in `Cargo.toml` line 2 = `openzeppelin-stylus`).

**Cargo.toml** (required dependency declaration):

```toml
[package]
name = "atrium-coffer"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["lib", "cdylib"]

[dependencies]
stylus-sdk = "0.6"
openzeppelin-stylus = "0.2"   # local rename: maps to crate "openzeppelin-stylus" with Rust path `openzeppelin_stylus`
alloy-primitives = "0.8"
alloy-sol-types = "0.8"

[features]
export-abi = ["stylus-sdk/export-abi"]
```

**Pattern**: extend `Erc4626` (OZ Rust) with Plinth integration hook. Path uses the renamed crate:

```rust
use openzeppelin_stylus::token::erc20::extensions::erc4626::Erc4626;

sol_storage! {
    pub struct Coffer {
        Erc4626 base;
        address plinth_address;
        uint256 deposit_cap_wei;
        uint256 per_user_cap_wei;
        mapping(address => uint256) per_user_deposits;
        bool is_deposits_paused;
        bool is_withdrawals_paused;
    }
}

sol! {
    // Re-emit OZ events for compatibility
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event HaircutApplied(address indexed user, uint256 haircut_amount_wei, uint16 haircut_bps);
    event DepositsPaused(string reason);
    event WithdrawalsPaused(string reason);
}
```

**Withdrawal SLA implementation** (PRD §23.2 patch 9):

```rust
#[public]
impl Coffer {
    pub fn withdraw(&mut self, shares: U256) -> Result<U256, CofferError> {
        // SLA: pass-through to base if no circuit-breaker tripped
        require!(!self.is_withdrawals_paused, CofferError::WithdrawalsPaused);
        let sender = self.vm().msg_sender();  // M3 fix: verified Stylus host-call API
        require!(!self.plinth().is_user_pending_liquidation(sender), CofferError::PendingLiquidation);
        // Otherwise standard ERC-4626 redeem
        self.base.redeem(shares, sender, sender)
    }
}
```

**Circuit-breakers** (auto-trip; Praetor multisig required to resume):

| Trigger | Action | Recovery |
|---|---|---|
| Oracle disagreement > 50bps | Pause deposits + new positions; withdrawals allowed | Manual unpause after oracle alignment |
| Keeper failure rate > 10% over 24h | Pause new positions; existing positions liquidatable | Manual unpause |
| Simultaneous active liquidations > 5% of TVL | Pause new positions | Auto-resume when active liquidations < 2% |
| Vault TVL drops > 30% in 1h | Pause everything | Manual unpause |
| Praetor admin pause | Pause everything | Manual unpause |

### 7.4 Postern — wallet abstraction (Solidity entry layer; PRD §4.18 detail)

**Purpose:** Passkey login, gas sponsorship, ERC-7715 session keys for Sigil agents, EIP-7702 native upgrade path, batched tx, social recovery, **Kill Switch**.

**Stack** (all verified):
- **Coinbase Smart Wallet** — passkey-native ERC-4337 account
- **Pimlico** — bundler + paymaster, free testnet tier
- **EntryPoint v0.9** at `resources/account-abstraction/contracts/core/EntryPoint.sol` — supports EIP-7702 via `Eip7702Support.sol` import (verified)
- **ERC-7715 session keys** — session-scoped capability grants
- **License note:** EntryPoint is GPL-3.0; Atrium's own contracts are MIT. We integrate with EntryPoint (deploy + call) but do not modify or fork it, so license interaction is integration-only.

**Postern Kill Switch contract** (Atrium-owned):

```solidity
// SPDX-License-Identifier: MIT
contract PosternKillSwitch {
    ISigil public immutable sigil;
    IEntryPoint public immutable entryPoint;

    event KillSwitchActivated(address indexed user, uint256 revoked_intents_count, uint256 cancelled_session_keys_count);

    function activate() external {
        // Revoke all IntentSigils
        uint256 r = sigil.revokeAll(msg.sender);
        // Cancel all session keys for caller (via EntryPoint UserOp batched)
        uint256 c = _cancelAllSessionKeys(msg.sender);
        emit KillSwitchActivated(msg.sender, r, c);
    }

    function _cancelAllSessionKeys(address user) internal returns (uint256 count) {
        // ERC-7715 has no native enumeration primitive; we track every issued session key
        // in PosternKeyRegistry (an Atrium-owned contract) at issuance time.
        // _cancelAllSessionKeys reads the registry, batches a single UserOp that calls
        // EntryPoint.handleOps with revoke calls for each tracked key.
        address[] memory keys = postern_key_registry.getActiveKeys(user);
        count = keys.length;
        for (uint i = 0; i < count; i++) {
            UserOperation memory op = _buildRevokeOp(user, keys[i]);
            entryPoint.handleOps(_singleton(op), payable(address(this)));
        }
        postern_key_registry.markAllRevoked(user);
    }
}

contract PosternKeyRegistry {
    // user => active session keys
    mapping(address => address[]) public activeKeys;
    mapping(address => mapping(address => bool)) public isActive;
    address public immutable posternKillSwitch;

    event SessionKeyIssued(address indexed user, address indexed sessionKey, uint256 expiresAt);
    event SessionKeyRevoked(address indexed user, address indexed sessionKey);

    function recordIssued(address user, address sessionKey, uint256 expiresAt) external {
        // Called by Postern wallet during ERC-7715 issuance via hook
        require(!isActive[user][sessionKey], "duplicate");
        activeKeys[user].push(sessionKey);
        isActive[user][sessionKey] = true;
        emit SessionKeyIssued(user, sessionKey, expiresAt);
    }

    function markAllRevoked(address user) external {
        require(msg.sender == posternKillSwitch, "kill-switch only");
        for (uint i = 0; i < activeKeys[user].length; i++) {
            isActive[user][activeKeys[user][i]] = false;
            emit SessionKeyRevoked(user, activeKeys[user][i]);
        }
        delete activeKeys[user];
    }
}
```

**Why the registry exists:** ERC-7715 itself defines per-session-key revocation but no enumeration. Without a registry, the Kill Switch cannot list "all active keys for this user" to revoke them in one batch. The registry adds ~1 SSTORE per issuance — acceptable cost for the security guarantee.

UI exposes this as a single-click button on Verifier Mode + main app per PRD §22.2 patch 14.

### 7.5 Sigil — agent mandate contracts (Stylus / Rust)

PRD §12.3 has the full EIP-712 schema. TDD adds storage + contract surface:

```rust
sol_storage! {
    pub struct Sigil {
        // owner => mapping(intent_hash => bool revoked)
        mapping(address => mapping(bytes32 => bool)) revoked;
        // agent => current revocation nonce (incremented by revokeAll)
        mapping(address => uint64) agent_revocation_nonce;
        // owner => current intent nonce (monotonic for replay-protect)
        mapping(address => uint256) owner_intent_nonce;
        // agent => 24h rolling action count
        mapping(address => mapping(uint64 => uint32)) actions_per_24h;  // day_index => count
        address erc8004_identity_registry;
        SigilParams params;
    }
    pub struct SigilParams {
        uint256 hard_cap_wei;                 // $50K equivalent initial
        uint16 reputation_multiplier;          // multiplied by ERC-8004 score
        uint32 max_mandate_duration_seconds;   // 30 days
        uint16 max_actions_per_24h_hard_cap;   // 100 absolute ceiling
    }
}
```

**EIP-712 domain:**
```
name:               "Atrium Sigil"
version:            "1"
chainId:            421614  (Arbitrum Sepolia)
verifyingContract:  <Sigil deployment address>
```

**Decimals discipline (SHOULD-FIX from audit):** All `*_wei` fields denominated in **USDC decimals = 6**, NOT 18. `hard_cap_wei = 50_000 * 1e6` represents $50,000 USDC. Tests in §14 include proptest that asserts this constant precisely; engineer who writes `50_000 * 1e18` triggers test failure immediately.

**24h rate-limit derivation:** `day_index = block.timestamp / 86400` (UTC midnight boundary). Edge case at boundaries: a single agent calling at `day_index_N - 1` second and `day_index_N + 1` second technically allows 2× cap in a 2-second window. Acceptable because of the per-action `max_notional_per_action_wei` hard cap and ERC-8004 reputation slashing for boundary-abuse patterns.

**Verification path:** the IntentSigil is signed by `owner` (EOA or smart-wallet via ERC-1271). The ActionSigil is signed by `agent`. Plinth.open_position(...) accepts an `action_sigil: Vec<u8>` parameter; Plinth calls `Sigil.validate_action(intent, action)` internally before allowing the position to open.

**Revocation:**
```rust
pub fn revoke(&mut self, intent_hash: FixedBytes<32>) {
    let owner = self.vm().msg_sender();  // M3 fix
    self.revoked.setter(owner).setter(intent_hash).set(true);
    self.vm().log(SigilRevoked { owner, intent_hash });
}

pub fn revoke_all(&mut self, agent: Address) {
    let owner = self.vm().msg_sender();
    let nonce = self.agent_revocation_nonce.getter(agent).get();
    self.agent_revocation_nonce.setter(agent).set(nonce + 1);
    self.vm().log(SigilRevokeAll { owner, agent });
}
```

Postern Kill Switch calls `Sigil.revoke_all(every_agent)` in one batched tx.

### 7.6 Aqueduct — cross-chain via Chainlink CCIP (Solidity)

**Purpose:** Move collateral USDC across Arbitrum Sepolia ↔ Ethereum Sepolia via Chainlink CCIP testnet (free). Enables Polymarket (Ethereum-native) and future cross-chain venues.

**Verified interface** at `resources/chainlink-brownie-contracts/contracts/src/v0.8/ccip/interfaces/IRouterClient.sol`:

```solidity
function ccipSend(
    uint64 destinationChainSelector,
    Client.EVM2AnyMessage calldata message
) external payable returns (bytes32 messageId);
```

**Aqueduct contract** (Solidity, owns CCIP router integration):

```solidity
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

contract Aqueduct {
    IRouterClient public immutable router;
    ICoffer public immutable coffer;

    mapping(bytes32 => CrossChainCreditRecord) public credits;

    event CrossChainCredit(
        bytes32 indexed message_id,
        address indexed source_user,
        address indexed dest_user,
        uint64 source_chain_selector,
        uint64 dest_chain_selector,
        uint256 collateral_amount_wei,
        uint256 expires_at_timestamp
    );

    function send_collateral(
        uint64 destSelector,
        address dest_user,
        uint256 amount_wei,
        uint256 expires_at
    ) external returns (bytes32 messageId) {
        require(seen_messages[keccak256(abi.encode(msg.sender, amount_wei, block.number))] == false,
                "M7 fix: reorg-safe nonce, prevents same-tx-different-block replay on Sepolia");
        seen_messages[keccak256(abi.encode(msg.sender, amount_wei, block.number))] = true;

        // Pull from Coffer
        coffer.transferFrom(msg.sender, address(this), amount_wei);

        // Build CCIP message — using LINK as fee token (M4 fix)
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(aqueductOnDest()),
            data: abi.encode(dest_user, amount_wei, expires_at),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV2({gasLimit: 200_000, allowOutOfOrderExecution: true})),
            feeToken: address(linkToken)   // M4 fix: use LINK, NOT address(0) which means native ETH
        });

        uint256 fee = router.getFee(destSelector, message);
        // Aqueduct is prefunded with LINK by Praetor multisig from CCIP testnet faucet (~free)
        // If linkBalance < fee, revert; Praetor refills periodically (alert at <10× last-month-usage)
        require(linkToken.balanceOf(address(this)) >= fee, "Aqueduct: top up LINK via Praetor");
        linkToken.approve(address(router), fee);

        messageId = router.ccipSend(destSelector, message);

        credits[messageId] = CrossChainCreditRecord({
            user: msg.sender, amount_wei: amount_wei,
            source_chain: block.chainid, dest_chain: destSelector,
            expires_at: expires_at, is_settled: false
        });

        emit CrossChainCredit(messageId, msg.sender, dest_user, uint64(block.chainid), destSelector, amount_wei, expires_at);
    }
}
```

**Fee-token strategy (M4 fix):** Aqueduct uses **LINK** as CCIP fee token, NOT native ETH. Aqueduct is prefunded with LINK by Praetor multisig from the public Chainlink CCIP testnet faucet (free). LINK balance monitored via §16.1 metric `aqueduct.link.balance.wei`; alert fires at <10× last-month CCIP usage so Praetor refills before exhaustion. Users don't need to send ETH or LINK — Aqueduct absorbs the fee cost as a Year-1 testnet service.

**Failure handling:** if CCIP delivery exceeds `expires_at`, the credit reverts on receiving chain and source-chain `claim_back(messageId)` is callable after the expiry window. **Reorg safety (M7 fix):** the `seen_messages` mapping keyed by `(sender, amount, block.number)` prevents same-call replay if the original tx is re-included after a Sepolia reorg.

### 7.7 ResearchAttestation (Solidity)

**Purpose:** On-chain commitment of off-chain backtest results so they're judge-verifiable in 10 seconds (PRD §22.2 patch 6, corrected in §28.1 patch 4).

```solidity
contract ResearchAttestation {
    address public immutable praetor_multisig;

    event BacktestPublished(
        bytes32 indexed ipfs_hash,
        uint256 trades_count,
        int256 collateral_delta_bps,
        uint256 timestamp_seconds,
        string notebook_url
    );

    function publish(
        bytes32 ipfs_hash,
        uint256 trades_count,
        int256 collateral_delta_bps,
        string calldata notebook_url
    ) external {
        require(msg.sender == praetor_multisig, "praetor only");
        emit BacktestPublished(ipfs_hash, trades_count, collateral_delta_bps, block.timestamp, notebook_url);
    }
}
```

**Honesty discipline:** `publish(...)` is only called AFTER the Jupyter notebook is actually run. Numbers come from notebook output, never invented. Frontend reads via Scribe and renders verbatim.

### 7.8 IPorticoAdapter v1.0 (Solidity, open standard)

PRD §12.1 has the full interface. TDD adds:
- **License:** MIT
- **Versioning:** semver in `version()` return; major version bump = breaking change requires registry re-whitelisting
- **Required tests for whitelisting** (per `resources/openzeppelin-contracts` test pattern):
  1. `open_position` round-trip preserves position state read via `get_position`
  2. `close_position` returns correct PnL (verified vs venue ground-truth)
  3. `get_haircut_bps` returns value in [0, 10000]
  4. `attest_off_chain_state` rejects unsigned data (only for hybrid adapters)
  5. Reverts on unsupported instrument
  6. Gas budget targets met
- **Registry whitelist** lives in `PorticoRegistry.sol`; new adapter requires 3-reviewer multisig signoff per PRD §21.7 Curator process

### 7.9 Edict — jurisdiction tier registry (Solidity)

```solidity
enum UserTier { Tier1, Tier2, Tier3, Tier4 }

contract Edict {
    mapping(address => UserTier) public userTier;
    mapping(address => uint64) public tierAssignedAt;
    address public immutable sumsubVerifier;  // sandbox webhook
    address public immutable praetor_multisig;

    event TierAssigned(address indexed user, UserTier tier, uint64 timestamp);

    modifier onlyTier(UserTier required) {
        require(uint8(userTier[msg.sender]) >= uint8(required), "tier too low");
        _;
    }

    function assignTier(address user, UserTier tier, bytes calldata sumsubProof) external {
        require(msg.sender == sumsubVerifier || msg.sender == praetor_multisig, "unauthorized");
        // verify sumsub signature on proof
        userTier[user] = tier;
        tierAssignedAt[user] = uint64(block.timestamp);
        emit TierAssigned(user, tier, uint64(block.timestamp));
    }
}
```

**Per-action gates:**
- `Coffer.deposit(...)` → `onlyTier(Tier2)` (basic email-verified KYC)
- `Plinth.open_position(...)` for derivatives → `onlyTier(Tier3)` (identity-verified)
- `Plinth.open_position(...)` for institutional-only instruments → `onlyTier(Tier4)`

### 7.10 Praetor — admin / governance (Solidity)

3-of-5 multisig (founder × 1, mentor × 2, community elected × 2) + 48-hour timelock for all parameter changes and contract upgrades. **No single-key admin paths anywhere in the system.** Multisig built on Gnosis Safe v1.4.1 (free).

```solidity
contract PraetorTimelock {
    uint64 public constant TIMELOCK_DURATION = 48 hours;
    uint64 public constant EMERGENCY_PAUSE_TIMELOCK = 0;  // instant for pause-only

    mapping(bytes32 => uint64) public scheduledAt;

    function schedule(address target, bytes calldata data) external onlyMultisig returns (bytes32 id) {
        id = keccak256(abi.encode(target, data, block.timestamp));
        scheduledAt[id] = uint64(block.timestamp);
        emit Scheduled(id, target, data, block.timestamp);
    }

    function execute(address target, bytes calldata data, uint64 scheduled_at) external onlyMultisig {
        bytes32 id = keccak256(abi.encode(target, data, scheduled_at));
        require(scheduledAt[id] == scheduled_at, "not scheduled");
        require(block.timestamp >= scheduled_at + TIMELOCK_DURATION, "timelock");
        // ... execute via low-level call
    }

    function emergencyPause(address pauseable) external onlyMultisig {
        IPausable(pauseable).pause();
    }
}
```

---

## 8. Detailed Design — Off-chain services

### 8.1 Scribe — The Graph subgraph (TypeScript / AssemblyScript)

**Purpose:** Index all Atrium contract events into queryable GraphQL. Read source for every UI surface + Codex API + every aspirational-number-prevention check ("show only what's actually on chain").

**Stack** (verified at `resources/graph-tooling/`): The Graph CLI + hosted service free tier.

**Entities** (`subgraph.graphql`):

```graphql
type MarginAccount @entity {
  id: ID!                              # user address
  user: Bytes!
  collateralValueWei: BigInt!
  requiredMarginWei: BigInt!
  lastUpdateBlock: BigInt!
  isPaused: Boolean!
  positions: [Position!]! @derivedFrom(field: "owner")
  updates: [MarginUpdate!]! @derivedFrom(field: "account")
}

type Position @entity {
  id: ID!                              # position_id
  owner: MarginAccount!
  venueId: Int!
  instrumentId: Bytes!
  notionalSigned: BigInt!
  entryPriceQ64: BigInt!
  openedAtBlock: BigInt!
  closedAtBlock: BigInt
  realizedPnlSigned: BigInt
}

type MarginUpdate @entity {
  id: ID!                              # tx_hash + log_index
  account: MarginAccount!
  blockNumber: BigInt!
  timestamp: BigInt!
  collateralValueWei: BigInt!
  requiredMarginWei: BigInt!
}

type LiquidationEvent @entity {
  id: ID!
  positionId: BigInt!
  keeper: Bytes!
  recoveredCollateralWei: BigInt!
  actualLiquidationBps: Int!
  blockNumber: BigInt!
  timestamp: BigInt!
}

type CrossChainCredit @entity {
  id: ID!                              # CCIP message_id
  user: Bytes!
  sourceChainSelector: BigInt!
  destChainSelector: BigInt!
  amountWei: BigInt!
  expiresAtTimestamp: BigInt!
  isSettled: Boolean!
}

type Keeper @entity {
  id: ID!                              # keeper address
  stakeWei: BigInt!
  missedWindows24h: Int!
  isActive: Boolean!
  totalLiquidationsExecuted: BigInt!
  totalRewardsWei: BigInt!
}

type CohortPartner @entity {
  id: ID!                              # partner address
  joinedAtBlock: BigInt!
  joinedAtTimestamp: BigInt!
  totalDepositsWei: BigInt!
  totalTradesCount: BigInt!
  lastActionTimestamp: BigInt!
}

type Agent @entity {
  id: ID!                              # agent address (ERC-8004 identity)
  identityRegistryAgentId: BigInt
  totalActionsCount: BigInt!
  totalPnlSigned: BigInt!
  reputationScore: Int!
  lastActionTimestamp: BigInt!
}

type BacktestAttestation @entity {
  id: ID!                              # ipfs_hash
  tradesCount: BigInt!
  collateralDeltaBps: Int!
  timestampSeconds: BigInt!
  notebookUrl: String!
}
```

**Manifest mapping**: each Atrium contract event → handler that updates the relevant entity. Re-indexable from genesis if hosted service goes down. **Self-hosted fallback** at `$5/mo VPS` so the data plane never has a single point of failure (PRD §21.5 STRIDE Scribe row).

### 8.2 Codex — x402-payable API (Node.js / Hono)

**Stack** (verified at `resources/x402/`): Coinbase x402 standard (now under `x402-foundation`); Hono framework on Cloudflare Workers free tier; payment middleware per `paymentMiddleware({...})` pattern from x402 README.

PRD §12.2 has the 8-endpoint catalog. TDD adds the request-handling pipeline:

```
HTTP request from agent/UI
  │
  ▼
x402 paymentMiddleware: verify payment header against Coinbase facilitator
  │ (HTTP 402 if invalid)
  ▼
Idempotency-Key check: if seen in last 24h, return cached response
  │
  ▼
Rate-limiter: (per-IP, per-wallet, per-agent) — most restrictive applies
  │ (HTTP 429 if exceeded)
  ▼
Endpoint handler: queries Scribe via GraphQL → constructs response
  │
  ▼
Sign response with Codex backend key (HMAC-SHA256) → tamper-evidence
  │
  ▼
Cache response (24h) + log to Postgres (per-user RLS)
  │
  ▼
Return HTTP 200 + signature header
```

**Self-hosted facilitator fallback:** if Coinbase facilitator goes down, Codex falls back to on-chain payment verification (read x402 payment tx from Arbitrum directly). Slower but never blocks.

### 8.3 Lantern — proof-of-reserves attestor (Node.js cron)

**Purpose:** Hourly Merkle attestations of Coffer holdings; root committed to LanternAttestor contract; users can verify their own balance via inclusion proof.

**Merkle leaf:** `keccak256(abi.encode(user_address, balance_wei, salt))` where salt is per-user persistent (preserves privacy — balance not reverse-engineerable without salt).

**Attestor process:**
```
Every hour cron tick
  │
  ▼
Read all Coffer balances via Scribe GraphQL
  │
  ▼
Build sparse Merkle tree (depth ≤ 20 → 1M users headroom)
  │
  ▼
Compute root → sign with software signing key (M8 fix: NOT cloud HSM)
            │  Key loaded into memory only during signing; never written
            │  to disk in plaintext; rotated annually per /runbooks/key-rotation.md
            ▼
LanternAttestor.publish(root, block_number, signature)
  │
  ▼
Emit AttestationPublished event → Scribe → UI
  │
  ▼
Cache tree to IPFS via web3.storage free tier (Year-1 throughput sufficient for hourly uploads)
```

**Live keeper count** (PRD §28.1 patch 11): Lantern dashboard reads `Keeper` entities from Scribe; shows live N (e.g., "2/3 keepers operational") — never inflated. If only 1 keeper is live, dashboard says "1/3" and triggers Praetor pause until at least 2 are live.

**SLA + 5 circuit-breakers** (PRD §23.2 patch 9): enumerated triggers, recovery procedures, all published at `lantern.atrium.fi/sla`.

### 8.4 Augur / Haruspex / Auspex — reference agents (Rust)

PRD §23.2 patch 3 + §28.1 patch 9. Three open-source reference agents, intentionally simple, designed as **scaffolding** for community agents.

**Augur** (mean-reversion on Hyperliquid HIP-3 stocks):
- Strategy: Bollinger bands, 20-period MA, 2σ entry, 1σ exit
- Allocation: $500 testnet USDC
- Cadence: hourly
- Substrate: Postern session key + Sigil IntentSigil with `max_notional_per_action_wei = 50_USDC`, `max_actions_per_24h = 24`

**Haruspex** (momentum on HIP-3 perps):
- Strategy: 10-period RSI, enter on overbought breakout, exit on RSI < 50
- Allocation: $500 testnet USDC
- Cadence: hourly

**Auspex** (basis-trade Pendle YT vs Aave Horizon T-bill):
- Strategy: long Pendle YT + short equivalent T-bill yield exposure when implied APY > Aave APY by 50bps; close when convergence
- Allocation: $500 testnet USDC
- Cadence: daily (basis trades don't need fast turnaround)

All three:
- Run on Fly.io free tier (one machine per agent)
- Open-source under MIT
- Each posts every decision + reason to Rostrum via `Rostrum.recordAction(...)` for follower visibility
- **Are reference scaffolding, NOT alpha strategies.** Documented explicitly so judges don't score the simple strategy as poor work.

**Community agents pipeline:** Curator grants ($5K ARB each) fund 5 community-built agents by Day 180. These can use proprietary strategies. Atrium-built ones are open scaffolding only.

### 8.5 Rostrum — agent leaderboard (Solidity + UI)

PRD §12.4 has `CopyTradeFollow` struct + mirror-trade math. TDD adds the leaderboard ranking:

**Leaderboard queries** (rendered from Scribe, with SQL tooltips per PRD §22.2 patch 13):

```graphql
{
  agents(orderBy: totalPnlSigned, orderDirection: desc, first: 100, where: { totalActionsCount_gte: 10 }) {
    id
    totalPnlSigned
    totalActionsCount
    reputationScore
    lastActionTimestamp
  }
}
```

UI tooltip on every PnL number shows the exact GraphQL query above + a "Try in Graph Playground →" link.

**Wash-trade detection** (Archive → Rostrum):
- Nightly job in Archive examines every leader's trades
- Flag triggers if any of: >30% of trades reverse within 5 blocks, or >20% of counterparties are known related addresses, or coordinated patterns with another flagged agent
- Flagged leaders auto-deboosted from leaderboard; followers receive on-chain `AgentFlagged` event in Sigil so they can revoke

### 8.6 Archive — Python risk lab (Python, F3-owned)

**Purpose:** Off-chain risk research, backtesting, Kani/proptest harness generation, governance parameter proposals.

**Stack:** Python 3.12 + pandas + numpy + jupyter + dune-client for free Arbitrum data. Hosted on the founder $5/mo VPS.

**Output artifacts:**
- Backtest notebooks → IPFS → `ResearchAttestation.publish(...)` for on-chain commitment
- Parameter-change proposals → Praetor multisig agenda
- Kani harness templates → F1 implements as `#[kani::proof]` functions

**Q1-2026 cross-margin backtest** (the headline backtest, PRD §28.1 patch 4):
- Source data: Hyperliquid HIP-3 trade ticks (public) + Aave V3 yield rates (public)
- Period: 2026-01-01 to 2026-03-31
- Method: replay every actual HIP-3 trader's positions, compare hedged-collateral required under (a) venue-isolated margin vs (b) Atrium SPAN cross-margin
- Output: average collateral saved %, distribution by portfolio size, edge cases where SPAN performs worse
- **All numbers from notebook output, none invented.** Published to IPFS; hash + numbers committed via ResearchAttestation only after the notebook is actually run.

### 8.7 Tablet — tax export service (Python, F3-owned)

PRD §11.8 has the high-level. TDD adds the per-jurisdiction logic:

**UK CGT (v1 minimum):**
- Input: Scribe GraphQL query for user's trades in tax year
- Same-day rule: match same-day buys + sells first
- Bed-and-breakfasting: match buys within 30 days against sells
- s.104 pool: remaining trades aggregated into average-cost pool
- Output: CSV with HMRC SA108 format (Capital Gains Summary)

**US 8949 (v1.5 — Month 8):**
- Same input pipeline
- Short-term vs long-term classification (>1 year hold)
- Output: CSV with IRS Form 8949 columns (description, date acquired, date sold, proceeds, cost basis, gain/loss)

**German FIFO (v1.5 — Month 8):**
- Same input pipeline
- FIFO matching at per-asset-per-venue granularity
- Output: CSV per asset class

**Export delivery:**
- User signs export request with their wallet
- Backend renders + signs response
- Emailed as PDF + CSV (uses SendGrid free tier 100/day)

### 8.8 Praetor — ops CLI (Rust, F1-owned)

**Purpose:** Single CLI binary for deploy + migrate + monitor operations.

**Commands:**

```
praetor deploy --network <sepolia|rh-testnet> [--all | --contract <name>]
praetor migrate <contract> --from-version <vN> --to-version <vM>
praetor multisig schedule --target <addr> --call <hex-data>
praetor multisig execute --id <schedule-id>
praetor verify --etherscan-api <key> [--all | --contract <name>]
praetor keepers list
praetor keepers stake --keeper <addr> --amount <wei>
praetor lantern publish-now
praetor pause <contract> [--reason <text>]
praetor resume <contract>
praetor backtest publish --notebook <path> --ipfs-cid <cid>
```

**Implementation:** Rust binary using `ethers-rs` + `clap`. Single-binary distribution. All operations go through `PraetorTimelock` (no direct admin paths).

### 8.9 Cohort + Curator — community programs (off-chain BD)

**Cohort:** F3-managed BD program. Live Status Page (PRD §23.2 patch 6) renders from Scribe `CohortPartner` entities. **Number shown is always actual N, not aspirational.**

**Curator:** Grant program for community-built IPorticoAdapters + agents.
- Application fee: $50 ARB (returnable upon review completion — anti-spam)
- Review window: 30 days
- 3-reviewer multisig signoff (Atrium core + 2 external mentor firms; rotating)
- Grant amount: $5K ARB per accepted adapter or agent
- Target: 3 community adapters by Day 180 (PRD §22.2 patch 6); 5 community agents by Day 180 (§28.1 patch 9 reframe)

---

## 9. Data Flows — Key User Journeys

### 9.1 First-time user deposit + hedged position (Tier-3 Jamie)

```
1. Jamie opens https://atrium.fi (mobile or desktop)
2. Postern passkey prompt → Coinbase Smart Wallet created (one tap)
3. Postern displays current Edict tier (Tier-1 default — no KYC)
4. Jamie completes Sumsub sandbox flow → Edict.assignTier(Jamie, Tier3)
5. Jamie deposits 10K USDC → Coffer.deposit(...) → emits Deposit event
6. Scribe indexes Deposit → MarginAccount created (collateral=10K, required=0)
7. Jamie selects "open hedged position" preset:
   a. Plinth.open_position(venue=HIP3, instrument=AAPL-PERP, notional=+50K)
   b. Plinth.open_position(venue=AaveHorizon, instrument=AAPL-TBILL, notional=-50K)
8. Each open triggers Plinth.update_margin(Jamie):
   - Read median(Chainlink AAPL, Pyth AAPL)
   - Compute SPAN scenarios across both positions
   - Net correlation → required margin ≈ 4.5K (vs ~10K without netting)
9. UI updates: "10K collateral, 4.5K required, 5.5K available, 55% saved vs unhedged"
10. Every number rendered from on-chain via Scribe — no estimates
```

Sequence length: ~5–8 transactions on Sepolia, all gas-sponsored by Pimlico paymaster. Wall-clock: ≤90 seconds (the Verifier Mode budget).

### 9.2 Agent rebalancing (Augur)

```
1. Augur Rust binary runs hourly cron on Fly.io
2. Augur queries Codex /v1/risk/snapshot/<augur-address>
3. Augur computes desired delta vs current position (mean-reversion logic)
4. Augur fetches IntentSigil from local storage (signed by owner once, valid 30 days)
5. Augur signs ActionSigil (per-action) — bound to IntentSigil.intent_hash
6. Augur submits Postern UserOp:
   - call Plinth.open_position(..., action_sigil=<signed bytes>)
7. EntryPoint validates Postern session key + Postern paymaster sponsors gas
8. Plinth.open_position calls Sigil.validate_action(intent, action)
9. Plinth opens position → updates margin → emits PositionOpened + MarginUpdated
10. Augur calls Rostrum.recordAction(...) so followers see the trade
11. Scribe indexes; Rostrum leaderboard updates; followers' mirror-trade contracts trigger 1-block-delayed mirror txs
```

### 9.3 Liquidation (Vigil + keepers)

```
1. Oracle price moves; Plinth.update_margin(user) triggered by Scribe/keeper
2. Account becomes under-collateralized (collateral < required margin)
3. Plinth.pause(user) → emits AccountPaused event
4. Vigil.queue_liquidation(user) → creates LiquidationJob, emits LiquidationTriggered
5. 3 keepers race; first responder wins:
   a. Keeper calls Vigil.execute_liquidation(job_id)
   b. Vigil orders positions by venue health (NMS): liquid first
   c. Vigil closes up to 10%-of-position per block (partial-liquidation discipline)
   d. Vigil takes 50bps keeper reward, deposits remainder to Coffer
6. After liquidation: if collateral >= required margin, Plinth.resume(user)
7. Scribe indexes all events; Lantern attestation in next hourly cycle reflects new state
8. UI updates: account banner shows liquidation history + recovery
```

### 9.4 Cross-chain collateral (Aqueduct)

**Correction (SHOULD-FIX from audit):** Polymarket runs on **Polygon**, not Ethereum Sepolia. Updated journey:

```
1. User has 5K USDC in Coffer on Arbitrum Sepolia
2. User wants to open Polymarket position (Polygon mainnet on Production; Polygon Amoy testnet during Year 1)
3. UI calls Aqueduct.send_collateral(destSelector=POLYGON_AMOY, dest_user=Polymarket-adapter, amount=5K, expires_at=now+30min)
4. Aqueduct pulls 5K from Coffer; calculates CCIP fee in LINK; sends CCIP message (M4 fix)
5. (~5-15 min on testnet) CCIP delivers to Aqueduct-on-Polygon-Amoy
6. Aqueduct-on-Polygon credits the Polymarket adapter; emits CrossChainCreditReceived
7. Polymarket adapter opens position
8. If CCIP doesn't deliver within expires_at: user can call claim_back(messageId) on Arbitrum Sepolia source chain
```

CCIP supports Arbitrum ↔ Polygon Amoy on testnet (verified at Chainlink CCIP supported networks docs). If Polymarket Polygon Amoy testnet integration isn't live by Day 30, this adapter is honestly downgraded to "Phase-2 conditional" per §17.1 + PRD §26.3 tripwire.

### 9.5 Kill Switch revoke (Postern emergency)

```
1. User suspects compromise; opens Atrium UI; clicks "Kill Switch"
2. UI prompts Coinbase Smart Wallet for one signature
3. Submits batched UserOp:
   a. Sigil.revoke_all(every agent the user has issued mandates to)
   b. PosternKillSwitch._cancelAllSessionKeys(user)
   c. Optional: Coffer.withdraw_all(user) if user checked the "exit too" box
4. EntryPoint executes; emits KillSwitchActivated + many SigilRevokeAll events
5. User is back to base-EOA control; all delegations + session keys gone
6. All in ONE tx, fully verifiable on Arbiscan
```

---

## 10. Storage Design — On-chain layouts

### 10.1 Slot collision prevention via ERC-7201 namespacing

Every Atrium contract uses ERC-7201 namespaced storage (pattern verified at `resources/erc-8004-contracts/contracts/IdentityRegistryUpgradeable.sol`):

```rust
// Plinth namespace
// keccak256(abi.encode(uint256(keccak256("atrium.plinth.storage")) - 1)) & ~bytes32(uint256(0xff))
const PLINTH_STORAGE_SLOT: U256 = U256::from_be_bytes(/* computed once at deployment */);
```

This means upgrades can add new storage without slot collisions. Standard pattern for upgradeable contracts.

### 10.2 Storage size estimates (testnet only, gas budgets)

| Contract | Storage cost per user | Notes |
|---|---|---|
| Plinth.MarginAccount | ~5 slots (160 bytes) | One per user |
| Plinth.Position | ~5 slots per position | Up to 100 per user → 500 slots max per user |
| Coffer (per ERC-4626) | 2 slots per user | Standard ERC-20 share balance |
| Sigil.revoked | 1 slot per revocation | Sparse |
| Vigil.LiquidationJob | ~3 slots per active job | Transient (cleared on completion) |
| Edict.userTier | 1 slot per user | |

For 10K users with 50 average positions: ~250K storage slots ≈ 5GB on-chain. Testnet has no economic constraint.

### 10.3 Event log retention

All events indexed by Scribe → permanent in The Graph hosted service. Arbitrum nodes retain event logs indefinitely (no pruning). No special archival needed.

---

## 11. APIs (full ABIs)

PRD §12 has the human-readable spec. TDD references each:

- **IPorticoAdapter v1.0** — PRD §12.1; full Solidity interface; MIT
- **Codex 8-endpoint catalog** — PRD §12.2; x402-payable; signed responses
- **Sigil EIP-712 schema** — PRD §12.3; verified domain on Arbitrum Sepolia (chainId 421614)
- **Rostrum CopyTradeFollow** — PRD §12.4; deterministic mirror-trade math

**Subgraph GraphQL schema** — §8.1 above, entity-by-entity.

**Codex backend response signature format:**
```
HTTP/1.1 200 OK
Content-Type: application/json
X-Codex-Signature: <hex-encoded HMAC-SHA256 of body using rotating backend key>
X-Codex-Key-Id: <which backend key version>
X-Codex-Timestamp: <unix seconds>

{ ...response body... }
```

Clients verify: `HMAC-SHA256(body, getPublicKey(X-Codex-Key-Id)) == X-Codex-Signature && abs(now - X-Codex-Timestamp) < 60`.

---

## 12. UX — surface inventory (frontend TDD-side)

PRD §27.2 has the deck spec. TDD lists every screen and its data source:

| Screen | Owner | Data source | Wireframe ready? |
|---|---|---|---|
| Landing page | F2 | static | Yes (after brand designer pack May 30) |
| Verifier Mode (`verify.atrium.fi`) | F2 | Scribe + on-chain reads | Yes (PRD §26.1) |
| Chaos Mode | F2 | Scribe + injection harness | Half (per PRD §27.3) |
| Kill Switch | F2 | Postern + Sigil | Yes |
| Cohort Status Page | F2 | Scribe `CohortPartner` entities | Wireframe needed Week -1 |
| Rostrum Leaderboard | F2 | Scribe `Agent` entities + GraphQL tooltips | Wireframe needed Week -1 |
| Lantern Dashboard | F2 | LanternAttestor events + IPFS tree | Half (per PRD §27.3) |
| Withdrawal SLA page (`lantern.atrium.fi/sla`) | F3 + F2 | static | Yes |
| benchmarks.atrium.fi | F3 | static (rewritten per loadtest) | Wireframe needed Week 0 |
| team.atrium.fi | F3 + F2 | static | Wireframe needed Week -1 |
| Mobile PWA | F2 | all above, responsive | Wireframe needed Week -1 |
| `make demo` local UI | F2 | local Sepolia fork | Yes (same as Verifier) |

**Design system**: Linear/Vercel typographic discipline + Roman-archway visual ID. Tailwind v4 + shadcn/ui as the base (free, MIT). Brand designer (equity-LOI) ships 5 hero screens by Day +5 per PRD §27.6.

---

## 13. Security Architecture

### 13.1 Authentication + authorization

| Surface | Auth | Authorization |
|---|---|---|
| User → Coffer.deposit | Smart-wallet signature (Postern passkey) | Edict tier ≥ Tier2 |
| User → Plinth.open_position (derivatives) | Smart-wallet signature OR Sigil ActionSigil | Edict tier ≥ Tier3 |
| Agent → Plinth.open_position | ActionSigil signed by agent, hash-bound to IntentSigil | Sigil.validate_action passes |
| Keeper → Vigil.execute_liquidation | Keeper.is_active && stake ≥ min_stake | Open liquidation job exists |
| Codex API request | x402 payment header | Per-IP/per-wallet/per-agent rate limit |
| Praetor admin action | 3-of-5 multisig signatures | 48h timelock after schedule |
| Emergency pause | Multisig (no timelock) | Pause-only, no upgrade |

### 13.2 Oracle architecture (defense-in-depth)

```
Plinth.get_safe_price(instrument)
  │
  ├─► Chainlink Data Streams price feed
  │       └─► verify last update < 60s; revert OracleStaleError if stale
  │
  ├─► Pyth Network IPyth.getPriceNoOlderThan(id, 60)
  │       └─► verify same; revert OracleStaleError if stale
  │
  ├─► median(chainlink, pyth)
  │
  └─► if abs_diff_bps(chainlink, pyth) > 50bps:
          revert OracleDisagreementError
          trigger Plinth.pause("oracle disagreement")
```

**Why dual-oracle:** single Chainlink feed = single point of failure. Median-of-two-with-tolerance gives sane price OR safe pause. Both are free testnet.

**Per `resources/pyth-crosschain/target_chains/ethereum/sdk/solidity/IPyth.sol`:** Pyth supports both push (`updatePriceFeeds(bytes[] updateData) payable`) and pull (`getPriceNoOlderThan`) patterns. Atrium uses pull for safety + agent UX (no caller fee for reads); push only on rare bulk updates.

**Equity-feed availability gap (SHOULD-FIX from audit):** Pyth equity feeds (AAPL, TSLA, etc.) are **mainnet-only as of 2026-05-18**. Sepolia has only crypto pairs (ETH, BTC, etc.) and a small synthetic-equity subset. **Mitigation for Year 1 demo:** Atrium operates a **Praetor-signed price relay** that reads Pyth mainnet equity prices, signs them with the Lantern software signing key, and posts to a `PraetorEquityRelay` Sepolia contract. **Honestly disclosed** to judges + on landing page: *"Equity prices on Sepolia are mainnet-relayed via Praetor multisig; not the same security as native Pyth on-chain. Production deployment in Year 2 will use Pyth equity feeds directly on Arbitrum One mainnet."* This is a real, sourced limitation — not a fake.

### 13.3 Key management

| Key | Storage | Rotation |
|---|---|---|
| Founder multisig keys (Praetor 3-of-5) | Hardware wallets (Ledger Nano S, $0 for testnet — every founder has one) | On key compromise; documented procedure in runbook |
| Codex backend signing key | HashiCorp Vault free tier | Quarterly rotation; versioned via `X-Codex-Key-Id` |
| Lantern attestation signing key | **Software key + secret-shared backup** (Year 1, M8 fix): primary key on founder VPS encrypted at rest with Argon2id-derived passphrase; backup split 3-of-5 via Shamir's Secret Sharing (`ssss` CLI, $0) across founder + 2 mentor hardware wallets. **Note:** AWS/GCP CloudHSM is NOT free tier (~$1000/mo), violating Tenet 5; deferred to Year-2 mainnet flip. | Annually; rotation procedure in `/runbooks/key-rotation.md` |
| Keeper bot keys | Encrypted at rest on VPS; loaded via env var | On compromise; new keeper registers fresh |
| Agent operator keys (Augur etc.) | Encrypted on Fly.io secrets | On compromise; new agent registers fresh with new Postern session key |

**Note: no production master keys.** Testnet operation; mainnet key management is Year-2 (per PRD §21.9 iteration #8).

### 13.4 Multisig + timelock topology

```
                        ┌────────────────────────┐
                        │ Praetor Gnosis Safe    │
                        │ 3-of-5 multisig        │
                        │ (1 founder + 2 mentors │
                        │  + 2 community)        │
                        └───────────┬────────────┘
                                    │
                                    ▼
                        ┌────────────────────────┐
                        │ PraetorTimelock        │
                        │ 48h delay (params)     │
                        │ 0h delay (pause-only)  │
                        └───────────┬────────────┘
                                    │ delegatecall
                                    ▼
        ┌───────────┬───────────┬───────────┬────────────┐
        ▼           ▼           ▼           ▼            ▼
    Plinth      Vigil       Coffer      Sigil       Edict
    (params)    (params)    (caps)      (params)    (tier-assign)
```

### 13.5 STRIDE summary

PRD §21 has the full STRIDE matrix per subsystem. TDD references it as the authoritative source. Highlights:

- **Spoofing:** every off-chain → on-chain action requires a wallet signature or HSM signature; every off-chain → off-chain action requires HMAC-signed response or x402 payment.
- **Tampering:** every API response is signed; every cross-chain message uses CCIP cryptographic verification.
- **Repudiation:** every action emits an on-chain event; off-chain logs go to immutable Postgres + log shipping.
- **Information disclosure:** public-by-design (positions, agents, leaderboards). Lantern Merkle tree uses commitment scheme to protect per-user balance privacy.
- **Denial of service:** rate limits at every API; circuit-breakers at every contract; 3-keeper redundancy.
- **Elevation of privilege:** no single-key admin paths; multisig + timelock for every parameter change.

### 13.6 Privacy + data minimization

- **On-chain:** addresses + balances + position data are public by design. Lantern Merkle tree commitment scheme protects per-user balance from passive scanning.
- **Off-chain (Codex):** per-user data isolated via Postgres row-level security. Tablet exports include only on-chain-derived data + user-added metadata.
- **KYC (Edict + Sumsub):** only the tier assignment lands on-chain; underlying KYC documents stay with Sumsub's sandbox.
- **No PII required for Tier1.** Email-only for Tier2. Full identity only for Tier3+ (jurisdictionally required for derivatives).

---

## 14. Testing Strategy

### 14.1 Test pyramid

```
                       ┌──────────────────┐
                       │  Demo rehearsals │  10× per PRD §26.2 (manual)
                       │  + judge dry-runs│
                       └──────────────────┘
                  ┌─────────────────────────────┐
                  │  E2E tests on Sepolia       │  Playwright + cast
                  │  - 5 user journeys (§9)     │
                  └─────────────────────────────┘
              ┌──────────────────────────────────────┐
              │ Integration tests (per subsystem)    │  Foundry + Stylus testnet harness
              │ - Coffer↔Plinth↔Vigil round-trips    │
              │ - Aqueduct round-trips (mocked CCIP) │
              │ - Adapter contract conformance       │
              └──────────────────────────────────────┘
        ┌────────────────────────────────────────────────┐
        │  Property tests (proptest)                     │  Rust proptest crate
        │  - ERC-4626 invariants (Coffer)               │
        │  - Margin monotonicity, no-free-lunch         │
        │  - CopyTradeFollow mirror-trade math          │
        └────────────────────────────────────────────────┘
   ┌──────────────────────────────────────────────────────────┐
   │  Formal verification (Kani)                              │
   │  - 5 invariants per PRD §23.2 patch 2                   │
   │  - Pure-function model checking                          │
   └──────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  Unit tests (Rust #[test] + Foundry forge test)                │
│  - Per-function correctness                                    │
└────────────────────────────────────────────────────────────────┘
```

### 14.2 Kani — formal verification (5 invariants in CI)

Per PRD §23.2 patch 2 + §28.1 patch 1 (Halmos → Kani swap).

Kani verifies **pure Rust functions** with `#[kani::proof]` attributes. We extract the margin math + validation functions into pure functions, then prove invariants on them.

**Invariant 1: Solvency** (Plinth)
```rust
#[kani::proof]
#[kani::unwind(5)]
fn solvency_invariant() {
    let positions: [Position; 5] = kani::any();
    let collateral: U256 = kani::any();
    kani::assume(collateral < U256::from(u128::MAX));

    let required = compute_required_margin_pure(&positions);

    // If we deem account healthy, then collateral covers required
    if is_healthy_pure(&positions, collateral) {
        assert!(collateral >= required);
    }
}
```

**Invariant 2: Oracle freshness** (Plinth) — pure function check on `last_publish_time + 60 >= now`

**Invariant 3: Mandate expiry** (Sigil) — pure function check on `now <= intent.expires_at && action.intent_hash == hash(intent)`

**Invariant 4: ERC-4626 share monotonicity** (Coffer) — proptest, not Kani (depends on storage state)

**Invariant 5: No-reentrancy on margin updates** (Plinth) — proptest + ReentrancyGuard pattern

CI workflow runs Kani on every PR; badge in README.

### 14.3 Proptest — property-based tests (Rust)

For contract-level state that Kani can't easily reach:

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn coffer_share_supply_monotonic(deposits: Vec<U256>, withdrawals: Vec<U256>) {
        let mut coffer = mock_coffer();
        for amt in deposits {
            coffer.deposit(amt, alice());
        }
        let supply_before = coffer.total_supply();
        for amt in withdrawals {
            let _ = coffer.withdraw(amt, alice());
        }
        let supply_after = coffer.total_supply();
        // shares only decrease via withdraw (no other path)
        assert!(supply_before >= supply_after);
    }

    #[test]
    fn mirror_trade_proportional(leader_notional: I256, follower_margin: U256, follow_bps: u16) {
        prop_assume!(follow_bps > 0 && follow_bps <= 10000);
        let f_notional = compute_mirror_trade(leader_notional, follower_margin, follow_bps);
        // Follower notional is bounded by follower's allocation
        assert!(f_notional.abs() <= follower_margin * U256::from(follow_bps) / U256::from(10000));
    }
}
```

### 14.4 Foundry integration tests (Solidity contracts)

For adapters + Aqueduct + ResearchAttestation + Edict + Praetor:

```solidity
contract AaveHorizonAdapterTest is Test {
    function test_open_and_close_position() public {
        // Setup
        AaveHorizonAdapter adapter = new AaveHorizonAdapter(/*…*/);

        // Open
        uint256 venuePositionId = adapter.open_position(/*…*/);
        IPorticoAdapter.PositionView memory pos = adapter.get_position(venuePositionId);
        assertEq(pos.owner, address(this));

        // Close
        int256 pnl = adapter.close_position(venuePositionId, "");
        // Asserts
    }
}
```

### 14.5 Stylus contract testing (Rust)

Stylus contracts test via `stylus_sdk::testing` mock VM:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::testing::*;

    #[test]
    fn test_open_position_happy_path() {
        let vm = TestVM::default();
        let mut plinth = Plinth::from(&vm);
        // ... setup, call, assert
    }
}
```

### 14.6 E2E tests (Playwright on Sepolia)

5 user journeys from §9 above, each scripted in Playwright. Run nightly via GitHub Actions free tier. Failures alert F2 via Discord webhook.

### 14.7 Demo rehearsals

PRD §26.2 mandates 10 dress-rehearsals with random failure injection by F3 before judge day. TDD enforces:
- Rehearsal log committed to `/rehearsals/` in repo
- Each rehearsal records: which failure was injected, recovery time, observed issues
- Acceptance: ≥9 of 10 rehearsals complete in ≤6 minutes total with no judge-noticeable issue

---

## 15. Deployment Architecture

### 15.1 Chain selection (per Tenet 6: testnet only Year 1)

| Chain | Role | Status |
|---|---|---|
| Arbitrum Sepolia | **Primary production deployment** | Operational |
| Ethereum Sepolia | Aqueduct CCIP destination + Polymarket | Operational |
| Robinhood Chain testnet | Additional deployment | ⏸️ Pending RH SDK (PRD §28.1 patch 6) |
| Arbitrum One mainnet | Year-2 only | Out of scope Year 1 |

### 15.2 Contract deployment order (dependency-respecting)

```
Wave 1 (Day -7 to Day -4):
  PraetorTimelock + Praetor Gnosis Safe
  Coffer (ERC-4626) [proxy + impl, ERC-1967]
  PorticoRegistry [proxy + impl]
  Sigil [proxy + impl]
  Edict [proxy + impl]

Wave 2 (Day -3 to Day -1):
  Plinth [proxy + impl] — wires to Coffer + PorticoRegistry + oracles
  Vigil [proxy + impl] — wires to Plinth + Coffer + PorticoRegistry
  PosternKillSwitch — wires to Sigil + EntryPoint
  ResearchAttestation

Wave 3 (Day 0 to Day +5):
  Portico adapters (one per venue, IPorticoAdapter v1.0):
    - Hyperliquid HIP-3 (hybrid)
    - Hyperliquid HIP-4 (hybrid)
    - Aave Horizon (when testnet ships)
    - Pendle V2
    - Trade.xyz
    - Curve
  Aqueduct + Aqueduct-on-Ethereum-Sepolia (CCIP pair)

Wave 4 (Day +6 to Day +10):
  Off-chain services:
    Scribe subgraph (deploy to The Graph hosted)
    Codex API (deploy to Cloudflare Workers free tier)
    Lantern attestor cron (deploy to founder VPS)
    Augur agent (deploy to Fly.io free tier)
    Haruspex + Auspex agents (Day +3 per PRD §25.4)
    3× Vigil keepers (founder + Cohort partner + Curator-funded)

Wave 5 (Day +11 to Day +14):
  benchmarks.atrium.fi
  loadtest.atrium.fi running 24/7
  18× Loom subsystem videos uploaded
  Final regression sweep
```

### 15.3 Contract upgrade procedure

Per Tenet 6: testnet contracts are upgradeable via OZ UUPS pattern (verified at `resources/erc-8004-contracts/contracts/MinimalUUPS.sol`).

**Procedure:**
1. F1 develops new impl, runs Kani + proptest + Foundry tests, all green
2. F1 submits `PraetorTimelock.schedule(proxyAdmin, upgradeData)` from one multisig signer
3. 2 other signers approve → schedule recorded on-chain
4. 48-hour timelock window — community can audit + raise objections via Discord/Mirror
5. After 48h, any signer executes — emits `Upgraded` event
6. Praetor CLI verifies new impl on Arbiscan
7. Post-deploy smoke test runs in CI

**Emergency pause (no timelock):** Praetor can pause any contract instantly via `PraetorTimelock.emergencyPause(target)`. Pause-only; cannot upgrade or change state — just freezes new actions.

### 15.4 CI/CD pipeline (GitHub Actions free tier)

```
On PR / push to main:
  - rustfmt + clippy + cargo audit
  - solhint + slither (static analysis on Solidity)
  - cargo test (Rust unit + integration)
  - forge test (Foundry, all Solidity contracts)
  - proptest (property tests)
  - kani --harness=* (formal proofs)
  - subgraph build (validates schema + mappings)
  - frontend: pnpm build + Lighthouse CI ≥90

On merge to main:
  - Deploy to Arbitrum Sepolia (Praetor CLI in CI)
  - Etherscan source verification
  - Subgraph redeploy
  - Cloudflare Workers deploy (Codex)
  - Tag release with semver
  - Post deploy summary to Discord

Nightly:
  - 5 E2E user-journey tests on Sepolia
  - Lantern attestation health check
  - Keeper health check (all 3 online?)
  - Cohort Status Page real-data audit (do partner addresses match private list?)
```

---

## 16. Observability

### 16.1 SLOs + metrics

**Service Level Objectives** (Year-1 testnet — not enterprise-grade; honestly stated):

| Service | SLO | Measurement |
|---|---|---|
| Codex API (Cloudflare Workers free tier — 100K req/day cap) | p95 latency ≤ 200ms; availability ≥ 99% per calendar month | Synthetic probe every 5 min |
| Scribe indexer lag (Graph hosted) | ≤ 30s normal; ≤ 5 min worst-case | The Graph dashboard metric |
| Verifier Mode load time (first interactive) | ≤ 1.5s on broadband (Lighthouse) | Lighthouse CI in build pipeline |
| Lantern attestation cadence | 1 publish/hour ± 15 min jitter | Cron timestamp + on-chain event |
| Plinth.update_margin txn confirmation (Arbitrum Sepolia) | ≤ 5s p95 | Arbiscan API + internal log |
| Postern UserOp inclusion (Pimlico testnet) | ≤ 10s p95 | Bundler internal metric |
| Augur/Haruspex/Auspex rebalance jitter from cron tick | ≤ 60s | Agent internal log |

| Metric | Source | Alert threshold |
|---|---|---|
| `plinth.update_margin.gas_used` | Plinth events | >150K p95 → investigate |
| `plinth.oracle.disagreement.count` | Plinth pause events | >5/hour → page on-call |
| `vigil.keeper.miss.count` | Vigil KeeperSlashed events | any → page F1 |
| `vigil.liquidation.duration.seconds` | Vigil events (triggered → completed) | p95 >300s → investigate |
| `coffer.tvl.wei` | Coffer total assets | rolling 1h drop >30% → emergency pause |
| `aqueduct.message.pending.count` | Aqueduct CrossChainCredit unsettled | >10 sustained → CCIP issue |
| `aqueduct.link.balance.wei` | LINK token balance on Aqueduct | <10× last-month usage → Praetor refill alert |
| `codex.payment.error.rate` | x402 facilitator | >5% → fallback to on-chain verification |
| `codex.daily.request.count` | Cloudflare Workers analytics | >80K of 100K free-tier daily cap → throttle or upgrade plan |
| `lantern.attestation.lag.seconds` | LanternAttestor events | >7200 (>2h since last) → page F1 |
| `scribe.indexer.lag.blocks` | Graph hosted service health | >100 blocks → switch to self-hosted fallback ($25/mo Hetzner) |

### 16.1.1 Capacity (Year-1 ceilings)

| Resource | Year-1 ceiling | Mitigation if hit |
|---|---|---|
| Codex requests | 100K/day (CF Workers free) | Add per-IP rate limit; upgrade to $5/mo paid tier |
| Scribe entity count | ~10M entities (Graph hosted limit) | Move to self-hosted Graph Node ($25/mo Hetzner) |
| Coffer concurrent open positions | Plinth params cap = 100 per user | Praetor increases param if user demand justifies |
| Active agents on Rostrum | No hard cap; reputation-score-gated by Sigil | Sigil hard_cap_wei ($50K/agent) limits blast radius |
| LINK balance for Aqueduct | Praetor-monitored | Refill from Chainlink CCIP testnet faucet |
| Fly.io free tier (3 agents × 256MB) | 3 machines, 256MB each | Migrate to founder $5 VPS if evicted |
| web3.storage IPFS uploads | 5 GB free | Sufficient for Year-1 attestation tree archives |

### 16.2 Logs

- **On-chain:** all events → Scribe → permanent
- **Off-chain (Codex, Lantern, Augur, etc.):** structured JSON logs → log shipping to Better Stack free tier OR self-hosted Loki on VPS

### 16.3 Traces (distributed)

For cross-service request flows (UI → Codex → Scribe → contract reads): OpenTelemetry instrumentation; Honeycomb startup tier as backend (free 90 days, then Prometheus self-hosted on VPS).

### 16.4 Dashboards (Grafana, free open-source)

| Dashboard | Audience | Hosted at |
|---|---|---|
| Atrium internal ops | Founders | `ops.atrium.fi` (auth-walled) |
| Public live status | Anyone | `status.atrium.fi` |
| Cohort partner activity | Cohort + public | `cohort.atrium.fi` |
| Load-test metrics | Anyone | `loadtest.atrium.fi` |
| Lantern proof-of-reserves | Anyone | `lantern.atrium.fi` |

### 16.5 On-call rotation (Year 1 = founders only)

- Primary: F1 (contracts)
- Secondary: F2 (frontend / off-chain services)
- Tertiary: F3 (BD + ops + manual interventions)
- Page channel: Discord webhook → mobile push notification

Year 2: hired SRE.

---

## 17. Failure Modes + Recovery

### 17.1 Failure mode matrix

| Failure | Detection | Recovery action | RTO |
|---|---|---|---|
| Chainlink Sepolia stale/down | Plinth `update_margin` reverts with OracleStaleError | Pyth takes over; Plinth pauses if Pyth also stale | Auto, <60s |
| Pyth Sepolia stale/down | Same | Chainlink takes over; pause if both down | Auto, <60s |
| Oracle disagreement >50bps | Plinth.pause | Investigate; Praetor unpause after alignment | 5-15 min |
| **(M7 add)** Pyth equity feeds (AAPL etc.) Sepolia-unavailable | Plinth instrument open reverts | Mainnet-fork Pyth read via Praetor-operated relay (signed pseudo-feed for testnet demo); honestly disclosed as "demo-only price stream not production-grade" | Pre-deployed Wave 2 |
| **(M7 add)** Coffer underlying USDC paused on Sepolia | Coffer deposits + withdrawals revert | Praetor pauses Coffer; user funds remain safe (USDC inside Coffer); Coffer.withdraw resumes when USDC unpauses | Auto-detect via Scribe `Paused` event |
| 1 of 3 keepers offline | Lantern dashboard "2/3" | F1 investigates; replace within 24h | 24h |
| All 3 keepers offline | Vigil liquidations stalled; Lantern "0/3" | Praetor emergencyPause Plinth (no new positions); Cohort partner runs emergency keeper | 30-60 min |
| **(M7 add)** Malicious adapter upgrade attempts to drain Coffer | Coffer per-adapter per-block notional cap exceeded → revert | PorticoRegistry whitelist requires immutable adapter bytecode; upgrade = re-whitelist with 3-reviewer approval + 48h timelock; in interim, Coffer's per-adapter cap limits blast radius to ≤1% of TVL per block | Auto |
| Pimlico bundler 5xx | Postern UserOps fail | **Pimlico self-hosted fallback** (M7 fix): Pimlico publishes Docker image `pimlicolabs/alto:latest`; deployed to founder $5 VPS Wave 1; healthcheck cron switches DNS via Cloudflare API (free tier) on >3 consecutive Pimlico 5xx within 60s | <5s after first detection |
| Coinbase x402 facilitator down | Codex /v1/* return 502 | Codex fallback to on-chain payment verification (slower but functional) | <60s |
| Coffer TVL drops >30% in 1h | Auto circuit-breaker pauses everything | Praetor investigates root cause; unpause after | 15-60 min |
| Vault TVL grows >100× in 1h (suspected attack/exploit attempt) | Same auto-pause | Same | Same |
| CCIP delivery >30 min | Aqueduct credit expired; `claim_back` callable | User reclaims on source chain | User-initiated |
| **(M7 add)** CCIP message-replay after Sepolia reorg | `seen_messages` mapping rejects | Per-block nonce prevents same-call re-execution (see §7.6) | Auto |
| **(M7 add)** Aqueduct LINK fee balance depleted | `aqueduct.link.balance.wei` alert fires at <10× last-month usage | Praetor refills LINK via Chainlink testnet faucet (free); Aqueduct rejects new sends in interim with `OutOfFees` revert | Hours to days |
| The Graph hosted service down | Scribe stale; Codex stale data | Self-hosted Graph Node fallback ($25/mo Hetzner CX31 — sized for 200GB disk + Postgres + Arbitrum archive proxy via Ankr free tier): NOT $5 VPS. Documented as "Year-1 best-effort fallback; full enterprise indexing is Year-2" | <60s switchover after deploy |
| Fly.io free tier evicts agent | Augur/Haruspex/Auspex stops rebalancing | Cron-monitored; redeploy or migrate to VPS | 5-15 min |
| Brand designer doesn't ship | No 5-screen pack by Day +5 | F2 does CSS polish solo (PRD §26.3 tripwire) | Day +5 → onward |
| Cohort partner #3+ ghosts | Cohort Status Page <3 partners by Day 60 | F3 reallocates 50% time from press to BD (PRD §26.3 tripwire); honest scope downgrade | Day 60 → 90 |
| Kani finds N-asset counterexample | CI red on PR | Ship 2-asset proof; mark N-asset as Phase-2 invariant honestly (PRD §26.3 tripwire) | 1 day |
| Kani / proptest CI flaky | Random green/red | F1 investigates root cause; never disable a flaky test, only skip with reason | <1 day |
| Demo bug discovered live on judge day | Verifier Mode hangs | Switch to pre-recorded Loom backup (PRD §26.2 branch) | 30s |
| Wifi drops mid-demo | All on-chain reads fail | Switch to local `make demo` against forked Sepolia | 15s |

### 17.2 Disaster recovery + backup

| Asset | Backup | Recovery |
|---|---|---|
| Source code | GitHub + 2 founder local clones | git clone |
| Contract deployments | Etherscan-verified + Praetor multisig records | Re-deploy from source if needed (testnet only) |
| Subgraph data | Re-indexable from genesis | `graph deploy` from current code |
| Multisig keys | 3-of-5 redundancy; geographic distribution; encrypted backups | Survives any 2 founder loss |
| HSM signing keys | Multi-region backup | Rotation procedure documented in runbook |
| Off-chain DBs (Codex Postgres) | Daily snapshot to S3 free tier | `pg_restore` from latest |
| Cohort BD records | Founder-private (`outreach/targets-private.md`) + Notion free tier backup | Re-create from memory if needed |

### 17.3 Post-incident process

Every incident (severity = anything that affected a user-visible behavior or caused a chain pause) follows:

1. **Detection** (alert fires or human notices)
2. **Triage** (severity + paging policy)
3. **Mitigation** (apply runbook action; communicate via status.atrium.fi banner)
4. **Recovery** (restore normal operation)
5. **Post-mortem** (blameless; root cause; preventive action; published in `/incidents/` in repo within 7 days)

---

## 18. External Dependencies (verified against `resources/`)

Every dependency in this table has a local clone (per `RESOURCES.md`) so the team can grep + read offline. Pinned commit hashes are in `RESOURCES.md`.

| Dependency | Used by | Resource path | License | Verified pattern |
|---|---|---|---|---|
| Arbitrum Stylus SDK | Plinth, Vigil, Coffer, Sigil | `resources/stylus-sdk-rs/` | Apache-2.0 | `sol!` + `sol_storage!` macros (`examples/erc20/src/erc20.rs`) |
| OZ Rust Contracts for Stylus | Coffer | `resources/rust-contracts-stylus/contracts/src/token/erc20/extensions/erc4626.rs` | MIT | Real `Erc4626` impl with Deposit/Withdraw events |
| OZ Solidity Contracts | Aqueduct, adapters, governance | `resources/openzeppelin-contracts/` | MIT | Standard |
| `cargo stylus` CLI | Build + deploy | `resources/cargo-stylus/` | Apache-2.0 | `cargo stylus check / deploy` flow |
| Chainlink CCIP | Aqueduct | `resources/chainlink-brownie-contracts/contracts/src/v0.8/ccip/` | MIT | `IRouterClient.ccipSend(uint64, Client.EVM2AnyMessage) returns (bytes32)` |
| Chainlink Data Streams | Plinth oracle | `resources/chainlink-brownie-contracts/` (interfaces) | MIT | Off-chain HTTP API + on-chain verifier; mainnet primary, Sepolia available |
| Pyth Network | Plinth secondary oracle | `resources/pyth-crosschain/target_chains/ethereum/sdk/solidity/IPyth.sol` | Apache-2.0 | `getPriceNoOlderThan(bytes32 id, uint age)`, `updatePriceFeeds(bytes[]) payable` |
| ERC-4337 EntryPoint v0.9 | Postern | `resources/account-abstraction/contracts/core/EntryPoint.sol` | GPL-3.0 (integrate, don't fork) | v0.9 includes EIP-7702 support via `Eip7702Support.sol` |
| ERC-7715 session keys | Postern (Sigil delegation) | Standard spec; no clone needed | n/a | Per Postern §4.18 in PRD |
| Coinbase Smart Wallet | Postern | External (no clone) | MIT (Coinbase) | Passkey-native ERC-4337 |
| Pimlico bundler + paymaster | Postern | External (free tier) | n/a | Bundler API; free Sepolia tier |
| Kani Rust verifier | Plinth + Sigil pure-function invariants | `resources/halmos/` is wrong tool — Kani lives at `github.com/model-checking/kani`; clone added separately if needed | MIT/Apache-2.0 | `#[kani::proof]` attribute on pure Rust fns |
| proptest | Coffer + Rostrum property tests | crates.io dep | MIT/Apache-2.0 | `proptest! { #[test] fn ... }` |
| Aave V3 (Horizon) | Portico → Aave adapter | `resources/aave-v3-core/` (substituted from aave-v3-origin per Windows path issue, PRD §28.2) | BUSL → MIT | Pool + IPool interface |
| Pendle V2 | Portico → Pendle adapter + Auspex agent | `resources/pendle-core-v2-public/` | GPL-3.0 | YT/PT/SY contracts |
| Hyperliquid contracts | Portico → HIP-3/HIP-4 (hybrid adapter) | `resources/hyperliquid-contracts/Bridge2.sol` | UNLICENSED (integrate only) | Validator-signed bridge; HIP-3 perps run on HL L1 Rust binary, NOT on-chain |
| ERC-8004 contracts | Sigil agent identity | `resources/erc-8004-contracts/contracts/IdentityRegistryUpgradeable.sol` | MIT | ERC-721 + UUPS + EIP-712; storage slot `erc8004.identity.registry` |
| ERC-8004 trustless-agents reference impl | Sigil reference | `resources/trustless-agents-erc-ri/` | MIT | Reference patterns |
| x402 standard | Codex | `resources/x402/` (Coinbase's dev fork; canonical at x402-foundation) | MIT | `paymentMiddleware({...})` pattern, multi-language SDK |
| The Graph CLI / tooling | Scribe | `resources/graph-tooling/` | MIT | subgraph CLI + manifest |
| Foundry | Solidity testing + deployment | External, install per-machine | MIT/Apache-2.0 | `forge test`, `forge script` |
| Arbitrum docs | Reference | `resources/arbitrum-docs/docs/` | MIT | All Stylus best-practices verified here |
| Arbitrum SDK (TS) | Frontend bridge ops + chain interactions | `resources/arbitrum-sdk/` | Apache-2.0 | Standard L2 SDK |
| Robinhood Chain | Portico → RH-Chain adapter | **No public repo** — docs at https://docs.robinhood.com/chain/ (per `RESOURCES.md` "Docs-only" section) | n/a | ⏸️ Adapter ships ≤14d after SDK publishes |

**Resource verification discipline:** every new dependency added to TDD requires (a) clone in `resources/`, (b) row in this table with commit hash in `RESOURCES.md`, (c) at least one cited file path that has been opened and validated. No exceptions.

---

## 19. Upgrade + Migration Strategy

### 19.1 Year-1 (testnet, upgradeable)

- All contracts UUPS-upgradeable behind ERC-1967 proxies
- Praetor multisig + 48h timelock gates every upgrade
- Per-contract semver (`MAJOR.MINOR.PATCH`) in `version()` view function
- Upgrade procedure documented in `/runbooks/upgrade.md`

### 19.2 Year-2 (mainnet flip — out of TDD scope)

When mainnet ships:
- Code4rena audit must complete + remediation merged
- Founder makes upgrade-immutability decision per-contract (most likely: Plinth + Coffer immutable; adapters + registries + Aqueduct retain UUPS for safety)
- Bug bounty raised from Immunefi standard ($25K) to high ($250K+) tier
- Insurance fund spun up (yet to design)

### 19.3 IPorticoAdapter v1.0 → v2.0 migration

Major-version bump breaks adapter contracts. Procedure:
1. Atrium publishes v2.0 RFC on Mirror; community comment window (4 weeks)
2. Adapters opt-in to v2.0 implementation
3. PorticoRegistry tracks both versions during transition (~3 months)
4. Coffer vaults can specify which adapter version they accept
5. v1.0 adapters de-whitelisted after transition

### 19.4 Subgraph schema evolution

Scribe entities can add fields without re-indexing (Graph handles this). Removing or renaming fields requires re-deploy + reindex from genesis. We commit to entity schema stability for v1; breaking changes batched into v2 with deprecation notice.

---

## 20. ADR Log — Architecture Decision Records

Every consequential design decision recorded as an ADR with date, context, decision, alternatives, consequences.

### ADR-001: Stylus over pure Solidity for compute-heavy contracts (Plinth, Vigil, Coffer, Sigil)

- **Date:** 2026-05-10
- **Context:** SPAN margin computation is a nested loop. Solidity equivalent estimated 10–100× more gas per Arbitrum docs.
- **Decision:** Plinth + Vigil + Coffer + Sigil in Rust + Stylus. Adapters + registries + governance in Solidity.
- **Alternatives:** All-Solidity (rejected: violates Goal G2). All-Stylus (rejected: adapter ecosystem is Solidity-native; integration friction).
- **Consequences:** F1 must master both Rust and Solidity. Build pipeline more complex (`cargo stylus` + Foundry). Worth it for the compute moat.

### ADR-002: Kani + proptest, NOT Halmos, for formal verification

- **Date:** 2026-05-18 (this TDD, post-PRD-v0.15 audit)
- **Context:** PRD v0.1–v0.14 cited "Halmos" for 5-invariant CI. Halmos README confirms it's EVM/Solidity-only.
- **Decision:** Kani for Rust pure-function invariants; proptest for contract-level state behavior.
- **Alternatives:** Certora (rejected: expensive, mainnet only). Trail-of-Bits Manticore (rejected: Solidity bytecode focus). Coq/Lean proofs (rejected: too heavy for the team).
- **Consequences:** F1 learns Kani; Atrium publishes Kani harnesses publicly. **Honest signal:** this was a lesson in not citing tools without verifying capability.

### ADR-003: Arbitrum Sepolia primary, RH-Chain when SDK ships

- **Date:** 2026-05-18 (PRD §28.1 patch 6)
- **Context:** PRD v0.1–v0.14 claimed "dual-primary deployment from Day 1." 2026-05-18 GitHub search confirmed no public RH-Chain SDK or contracts repo.
- **Decision:** Arbitrum Sepolia is the actual primary. RH-Chain adapter ships ≤14 days after RH publishes SDK.
- **Alternatives:** Wait for RH (rejected: can't ship Year-1 on a chain with no SDK). Bet entirely on RH (rejected: same).
- **Consequences:** Dual-primary marketing claim demoted to honest conditional. Hedge value adjusted -0.05.

### ADR-004: Hybrid Hyperliquid adapter (bridge + API + attestation), NOT contract-to-contract

- **Date:** 2026-05-18 (PRD §28.1 patch 7)
- **Context:** HIP-3 perps run on Hyperliquid L1 Rust binary, not as on-chain EVM contracts. `resources/hyperliquid-contracts/` contains only `Bridge2.sol`.
- **Decision:** Portico → Hyperliquid uses bridge for collateral + off-chain API for order placement + on-chain attestation of position state.
- **Alternatives:** Skip Hyperliquid (rejected: it's the wedge — HIP-3 OI ~$2.0B is the biggest cross-margin demand source). Wait for HL EVM (rejected: not on roadmap).
- **Consequences:** Adapter complexity higher than pure contract-to-contract. `attest_off_chain_state(...)` added to IPorticoAdapter v1.0 interface for hybrid adapters.

### ADR-005: Coffer single-vault per-collateral-type, NOT per-position

- **Date:** 2026-05-12
- **Context:** Two patterns possible: (a) one Coffer vault for all collateral (USDC), or (b) per-instrument/per-position vaults.
- **Decision:** Pattern (a). One Coffer vault per supported collateral type (USDC v1; USDT + ETH later).
- **Alternatives:** Per-position vaults (rejected: defeats cross-margin purpose). Single multi-asset vault (rejected: ERC-4626 spec is single-asset).
- **Consequences:** Simpler accounting; standard ERC-4626 compatibility; cross-margin natural.

### ADR-006: Stylus contracts upgradeable via UUPS, NOT immutable

- **Date:** 2026-05-12
- **Context:** Testnet contracts need to evolve as we learn. Immutability is the mainnet promise.
- **Decision:** UUPS upgradeable proxies for all core contracts in Year 1.
- **Alternatives:** Immutable from day 1 (rejected: blocks iteration during testnet phase).
- **Consequences:** Upgrade gated by Praetor multisig + 48h timelock. Documented as testnet-only; mainnet flip decision is per-contract.

### ADR-007: Dual-oracle (Chainlink + Pyth) with median + tolerance, NOT primary+fallback

- **Date:** 2026-05-15
- **Context:** Single oracle = single point of failure. Two oracles can disagree.
- **Decision:** Both oracles read every recompute; median within 50bps tolerance else pause.
- **Alternatives:** Primary+fallback (rejected: implies a hierarchy — judges ask "what's primary?"). Median-of-three (rejected: cost; not enough Sepolia oracle options).
- **Consequences:** Both oracles must be live for normal operation. Acceptable cost: oracle reads on Sepolia are cheap; safety improvement is worth it.

### ADR-008: Open-source IPorticoAdapter from Day 30, NOT closed source

- **Date:** 2026-05-15
- **Context:** Standard adoption requires open access; closed adapter standards die. Cf. Wallet-Connect, ERC-20.
- **Decision:** IPorticoAdapter v1.0 MIT-licensed, published Day 30 (PRD §22.6).
- **Alternatives:** Keep closed (rejected: kills ecosystem moat). Open later (rejected: no upside to delay).
- **Consequences:** Anyone can build an adapter. Curator grants ($5K ARB each) accelerate community adapter development.

---

## 21. Open Design Questions

Tracked here; decisions become new ADRs.

1. **OPEN-001:** When RH-Chain SDK ships, do we treat it as a "second primary" or "secondary"? Affects deploy automation + marketing copy.
2. **OPEN-002:** Coffer v2 — when do we add USDT and ETH as accepted collateral types? Year 1 keeps to USDC; Year 2 decision.
3. **OPEN-003:** Sigil credit-line formula reputation multiplier — should ERC-8004 reputation score directly multiply or have a non-linear curve? Default v1 = linear with hard cap; revisit after 90 days of agent data.
4. **OPEN-004:** Stoa (options pricing) Phase-2 — Black-Scholes inputs (vol, rates) — single source (Pyth) or median? Defer until Stoa scoping in Phase 2.
5. **OPEN-005:** Multisig composition Year 1 vs Year 2 — community-elected slots TBD until v0.5 community formed.
6. **OPEN-006:** Codex pricing — should prices float with usage or stay flat? Year 1 = flat; revisit if any endpoint gets DOS'd.
7. **OPEN-007:** Rostrum copy-trade — should mirror-trade be permissioned (only ERC-8004-verified agents lead) or open (anyone can be a leader)? Default = ERC-8004-only Year 1; open in Year 2 with reputation gating.
8. **OPEN-008:** Lantern attestation cadence — hourly is the default. Could be reduced to 15-min if cron overhead acceptable. Decision after 30 days of operation.
9. **OPEN-009:** Augur strategy — should reference agents publish their PnL publicly? Default = yes (Rostrum leaderboard). Could create perverse incentives; revisit.
10. **OPEN-010:** Tax export — should Tablet auto-file (via TaxBit API integration) or only export CSV? Year 1 = CSV-only; auto-file is Year 2.

---

## 22. Glossary

| Term | Definition |
|---|---|
| **Stylus** | Arbitrum's Rust → WASM smart-contract runtime. Native code in EVM-compatible execution; 10-100× cheaper compute for compute-heavy ops per Arbitrum docs. |
| **SPAN margin** | "Standard Portfolio Analysis of Risk" — CFTC-standard portfolio margin algorithm; nets correlated positions across instruments to compute aggregate required margin. |
| **NMS-aware liquidation** | "No Market-disruption Sequencing" — liquidate positions in order of venue liquidity to minimize market impact. |
| **IPorticoAdapter** | Atrium's open standard for venue adapters. MIT-licensed Solidity interface. |
| **Sigil** | Atrium's EIP-712 mandate format for agent delegation. IntentSigil = the parent envelope; ActionSigil = the per-action grant. |
| **Postern** | Atrium's wallet abstraction layer — Coinbase Smart Wallet + Pimlico + ERC-4337 + ERC-7715 + EIP-7702 + Kill Switch. |
| **Coffer** | The unified USDC collateral vault (ERC-4626). |
| **Plinth** | The Stylus SPAN-style margin engine. |
| **Vigil** | The Stylus liquidation engine + 3-keeper coordinator. |
| **Aqueduct** | The cross-chain CCIP collateral mover. |
| **Lantern** | The proof-of-reserves attestor (hourly Merkle root). |
| **Edict** | The jurisdiction tier registry. |
| **Praetor** | The 3-of-5 multisig + 48h timelock + ops CLI. |
| **Tablet** | The tax-report export service (UK + US + DE in v1). |
| **Scribe** | The Graph subgraph indexer. |
| **Codex** | The x402-payable HTTP API gateway. |
| **Archive** | The Python risk lab (backtests + governance proposals). |
| **Rostrum** | The agent leaderboard + copy-trading contracts. |
| **Augur / Haruspex / Auspex** | Three reference agents (mean-reversion / momentum / basis-trade). |
| **Cohort** | F3-managed BD program for named design partners. |
| **Curator** | Grant program for community-built adapters + agents. |
| **Kani** | Amazon's bit-precise Rust formal verifier (model checker). |
| **proptest** | Rust property-based testing framework. |
| **Tripwire** | A pre-committed scope-cut decision criterion (PRD §26.3). |
| **Verifier Mode** | The judge-facing scripted demo URL (`verify.atrium.fi`). |
| **Chaos Mode** | Random failure injection demo button (oracle drift, keeper offline, etc.). |
| **Kill Switch** | Single-tap revoke of all Sigil mandates + Postern session keys. |
| **FLOOR / REALISTIC** | Two scenarios for Day-365 outcomes (PRD §17). |

---

## 23. Appendix — Verified code patterns

### A.1 Stylus `sol_storage!` + `sol!` macro pattern (from `resources/stylus-sdk-rs/examples/erc20/src/erc20.rs`)

```rust
use alloy_primitives::{Address, U256};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;

sol_storage! {
    pub struct Erc20<T> {
        mapping(address => uint256) balances;
        mapping(address => mapping(address => uint256)) allowances;
        uint256 total_supply;
        PhantomData<T> phantom;
    }
}

sol! {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// External functions exposed to Solidity callers
#[public]
impl<T: Erc20Params> Erc20<T> { /* … */ }
```

### A.2 OZ Rust ERC-4626 (from `resources/rust-contracts-stylus/contracts/src/token/erc20/extensions/erc4626.rs`)

```rust
sol! {
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );
}
```

### A.3 Chainlink CCIP IRouterClient (from `resources/chainlink-brownie-contracts/contracts/src/v0.8/ccip/interfaces/IRouterClient.sol`)

```solidity
interface IRouterClient {
    function ccipSend(
        uint64 destinationChainSelector,
        Client.EVM2AnyMessage calldata message
    ) external payable returns (bytes32 messageId);
}
```

### A.4 Pyth IPyth (from `resources/pyth-crosschain/target_chains/ethereum/sdk/solidity/IPyth.sol`)

```solidity
interface IPyth is IPythEvents {
    function getPriceNoOlderThan(bytes32 id, uint age)
        external view returns (PythStructs.Price memory price);

    function updatePriceFeeds(bytes[] calldata updateData) external payable;
}
```

### A.5 ERC-4337 EntryPoint v0.9 + EIP-7702 (from `resources/account-abstraction/contracts/core/EntryPoint.sol`)

```solidity
// "Account-Abstraction (EIP-4337) singleton EntryPoint v0.9 implementation."
// imports include "./Eip7702Support.sol" → v0.9 has native EIP-7702
```

### A.6 ERC-8004 Identity Registry (from `resources/erc-8004-contracts/contracts/IdentityRegistryUpgradeable.sol`)

```solidity
contract IdentityRegistryUpgradeable is
    ERC721URIStorageUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    EIP712Upgradeable
{
    /// @custom:storage-location erc7201:erc8004.identity.registry
    struct IdentityRegistryStorage {
        uint256 _lastId;
        mapping(uint256 => mapping(string => bytes)) _metadata;
    }
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
}
```

### A.7 Hyperliquid Bridge2.sol (from `resources/hyperliquid-contracts/Bridge2.sol`)

```
"This bridge contract runs on Arbitrum, operating alongside the Hyperliquid L1.
The only asset for now is USDC, though the logic extends to any other ERC20 token on Arbitrum.
The L1 runs tendermint consensus, with validator set updates happening at the end of each epoch."
```

Confirms HYBRID adapter architecture (bridge for collateral; off-chain API for orders; on-chain attestation of position state).

### A.8 x402 paymentMiddleware pattern (from `resources/x402/README.md`)

```typescript
app.use(
  paymentMiddleware({
    "GET /weather": {
      accepts: [...],                 // networks/schemes supported
      description: "Weather data",
    },
  }),
);
```

Multi-language SDK (TypeScript + Python + others); pattern applies to Codex `/v1/*` endpoints.

---

---

## 24. v1.1 — Post-audit corrections (traceability for self-audit findings)

This section records every change applied to fix self-audit findings, so a reader can trace what changed and why. Format mirrors PRD §28 audit-trail discipline.

### 24.1 MUST-FIX patches applied

| ID | Audit finding | Section patched | Patch applied |
|---|---|---|---|
| **M1** | Coffer used fictional `openzeppelin_stylus::token::erc20::extensions::erc4626` import path; no `Cargo.toml` | §7.3 | Added §7.3 Cargo.toml block pinning `openzeppelin-stylus = "0.2"`; corrected import path |
| **M2** | `Plinth.update_margin` had no access control + no reentrancy guard; Scribe (off-chain) cannot trigger on-chain | §7.1 | Added `UnauthorizedCaller` + `Reentrant` errors; added `is_updating` storage flag; restricted callers to (user / registered adapter / active keeper / praetor multisig) |
| **M3** | Stylus host calls used wrong API (`block::timestamp()`, `msg::sender()`) — won't compile | §7.1 + §7.2 + §7.5 | Rewrote all host calls using verified `self.vm().block_timestamp()` + `self.vm().msg_sender()` per `resources/stylus-sdk-rs/examples/erc20/src/erc20.rs` line 80, 162 |
| **M4** | Aqueduct used `feeToken: address(0)` = ETH, but Aqueduct holds no ETH; no funding strategy | §7.6 | Switched to LINK fee token; Aqueduct prefunded by Praetor from Chainlink CCIP testnet faucet; balance monitored via metric |
| **M5** | Plinth→Vigil trigger hand-waved; no `vigil_address` in Plinth storage; no `IVigil` interface | §6.4 + §7.1 + §7.2 | Added `vigil_address` to Plinth storage; declared `sol_interface! IVigil`; Plinth.update_margin now explicitly calls `IVigil(...).queue_liquidation(user, version)` |
| **M6** | Race condition: Plinth.update_margin vs Vigil.execute_liquidation can interleave → over/under-liquidation | §7.1 + §7.2 | Added `margin_version` monotonic nonce in MarginAccount; Vigil.execute_liquidation must check version matches at queue time; mismatch → refuse + re-queue |
| **M7a** | Coffer USDC pause on Sepolia not modeled | §17.1 | Added row; mitigation: Coffer auto-pause on USDC `Paused` event detected by Scribe |
| **M7b** | Malicious adapter upgrade could drain Coffer | §17.1 | Added row; mitigation: PorticoRegistry requires immutable adapter bytecode; per-adapter per-block notional cap limits blast radius |
| **M7c** | CCIP message replay after Sepolia reorg not modeled | §7.6 + §17.1 | Added `seen_messages` mapping keyed by `(sender, amount, block.number)` in Aqueduct |
| **M7d** | Pimlico self-host fallback was hand-waved "pre-deployed May 20" with no spec | §17.1 | Specified: Docker image `pimlicolabs/alto:latest` on founder $5 VPS Wave 1; Cloudflare DNS failover after 3 consecutive 5xx in 60s |
| **M7e** | EntryPoint v0.9 + EIP-7702 claim not grep-verified | §7.4 + Appendix A.5 | Grep cite line 27 of `EntryPoint.sol` proves v0.9; `Eip7702Support.sol` import confirms EIP-7702 |
| **M8** | Cloud HSM "free tier" is NOT free (~$1000/mo); violates Tenet 5 | §13.3 + §8.3 | Swapped to software signing key on VPS with Argon2id-encrypted at rest + Shamir-secret-shared backup; cloud HSM deferred to Year 2 |

### 24.2 SHOULD-FIX patches applied

| ID | Audit finding | Section | Patch |
|---|---|---|---|
| S1 | Sigil `hard_cap_wei = $50K` ambiguous on decimals | §7.5 | Clarified: USDC = 6 decimals; `hard_cap_wei = 50_000 * 1e6`; proptest asserts constant |
| S2 | Sigil `day_index` derivation unspecified | §7.5 | Specified: `block.timestamp / 86400`; boundary edge case documented + mitigated via per-action cap |
| S3 | Polymarket on Ethereum Sepolia is wrong (Polymarket runs on Polygon) | §9.4 | Corrected: Polygon Amoy testnet via CCIP; conditional if Polymarket testnet not live by Day 30 |
| S4 | Pyth equity feeds (AAPL) Sepolia-unavailable — kills headline demo | §13.2 + §17.1 | Added Praetor-signed mainnet equity relay; honestly disclosed as "demo-only, not production-grade" |
| S5 | Postern Kill Switch session-key cancellation hand-waved | §7.4 | Added `PosternKeyRegistry` Atrium-owned contract that tracks every issued ERC-7715 session key; Kill Switch reads + batches revoke ops |
| S6 | Scribe self-hosted fallback claimed on $5 VPS — won't fit Graph Node (200GB+) | §17.1 | Corrected to $25/mo Hetzner CX31; honestly disclosed as "Year-1 best-effort" |
| S7 | No SLOs defined | §16.1 | Added per-service SLOs (Codex p95 latency, Scribe lag, Verifier load time, etc.) |
| S8 | No capacity numbers | §16.1.1 | Added Year-1 ceiling table (Codex 100K/day, Scribe 10M entities, etc.) with mitigation per ceiling |
| S9 | Aqueduct LINK balance depletion not in metrics | §16.1 | Added `aqueduct.link.balance.wei` metric + alert threshold |
| S10 | Codex Workers free-tier 100K/day cap not surfaced | §16.1 | Added `codex.daily.request.count` metric + threshold |
| S11 | PlinthError lacked Stylus `SolidityError` Result mapping | §7.1 | Added `#[derive(SolidityError)]` enum mapping to all errors |
| S12 | Reentrancy invariant claimed but no pattern shown | §7.1 | Added `is_updating` flag pattern; documented as proptest invariant |

### 24.3 Remaining SHOULD-FIXes documented as Open Questions

These weren't patched inline; instead recorded as OPEN questions for future iterations to keep TDD shippable now:

- **§14.5 Stylus test pattern `Plinth::from(&vm)` API** — to be verified against actual `stylus-sdk-rs/0.6+` testing module before first test run
- **§8.6 HL HIP-3 trade-ticks data source endpoint** — F3 confirms specific endpoint + rate-limit handling during Archive scaffold (Week 0)
- **§19.3 IPorticoAdapter v1→v2 in-flight position migration** — designed in v2 RFC (Year 1.5), not Year 1
- **§13.3 Praetor key-compromise runbook** — `/runbooks/` directory created Week -1 with templates; full runbook is Wave-1 deliverable

### 24.4 Audit summary

| Severity | Count | Status |
|---|---|---|
| 🔴 MUST-FIX | 8 (M1–M8) | **All patched** ✅ |
| 🟡 SHOULD-FIX | 14 | **12 patched** inline; 2 deferred to Open Questions (§24.3) with concrete owner + deadline |
| ✅ Solid (per audit) | 9 sections | unchanged |

### 24.5 Honesty discipline carried from PRD

- Every dependency in §18 is verified against a file in `resources/`
- No tool cited without README check (Halmos lesson per PRD §28 + this TDD ADR-002)
- Every "X is live" claim is gated by an actual on-chain or dashboard observable
- Cloud HSM "free tier" myth corrected; capacity ceilings honestly stated
- Pyth equity-feeds Sepolia gap honestly disclosed, not papered over

### 24.6 Build-phase audit waves F–L (post-v1.1)

Ten audit waves landed 94 patches between v1.1 release and Day -7. Canonical register at `docs/AUDIT_FINDINGS.md`. Architectural shifts that change how to read this TDD:

| Wave | Architectural shift relevant to this TDD |
|---|---|
| F | Praetor CLI moved from "shell scripts in §15.2" to a real Rust binary at `services/praetor-cli/` with `deploy`, `verify`, `multisig schedule/execute/list` subcommands. §24.8 below documents the env vars + flow |
| G-2 | Every Stylus `sol_interface!` declaration uses camelCase Solidity ABI names (`getAccount`, `validateAction`, `adapterPull`). Read §7 interface snippets with this convention. ADR-009 below records the decision |
| G-3 | Sigil `validate_action` is `&mut self`, uses on-chain ecrecover via the precompile at address `0x01`, persists rate-limit + credit-line counters after the signature gate. §7.5 spec is updated below |
| G-6 | Plinth/Coffer/Aqueduct expose a uniform `IPausable.pause(string reason)` ABI accepting caller ∈ {multisig, timelock}. §7.10 PraetorTimelock snippet is updated to match. ADR-010 records this |
| G-8 | Hyperliquid + Polymarket adapter attestations sign over an EIP-712 `DOMAIN_SEPARATOR` baked at construction with chain-id + this contract. §7.7/§7.8 adapter specs gain the domain-binding note |
| H-C2 | Sigil envelope is fixed-layout: 256-byte body + count-prefixed venues/instruments (max 8 each) + 65-byte sig. Off-chain SDK encoders live in `agents/template/src/sigil.rs` |
| H-H1 | Plinth `open_position` arms the reentrancy guard at function entry and dispatches to `open_position_inner` that calls `do_update_margin` directly. §7.1 updated |
| I-1..I-4 | Codex x402 verifier rewritten: USDC `Transfer(address,address,uint256)` log parsing from `receipt.logs`, 12-block confirmation depth on Arbitrum Sepolia, D1-backed `payments.tx_hash UNIQUE` for cross-isolate replay dedup, Coinbase facilitator demoted to a hint with the chain authoritative. §8.x Codex updated. ADR-011 below |
| I-9 | Lantern signer enforces minimum scrypt parameters (N ≥ 2¹⁷, r ≥ 8, p ≥ 1) and refuses to load key envelopes inside the repo tree (realpath check). §13.3 updated |
| K-6 | CI Kani job publishes `apps/verify/public/kani-status.json` (state, passed, total, last_run_at, proof_run_url). The Verifier badge fetches `/api/kani/status` which proxies this. §14.2 updated |
| K-7 | `pnpm kani` invokes `scripts/run-kani.mjs` which iterates `contracts/plinth` and `contracts/sigil` per-crate (workspace runner returned zero proofs before) |
| K-10 | Agent template at `agents/template/src/sigil.rs` ships `encode_intent_envelope` / `encode_action_envelope` matching the on-chain decoder byte-layout. 3 unit tests pin the minimum-length, fixed-action-size, oversize-venue invariants. ADR-012 |

### 24.7 New ADRs (009–012)

**ADR-009: System-wide Stylus snake_case → camelCase Solidity ABI convention.** Stylus emits methods as `camelCase` selectors per `resources/stylus-sdk-rs/stylus-proc/src/lib.rs:603-605`. Every `sol_interface!` declaration that names a Stylus contract uses camelCase to match; Rust call-site method names stay snake_case via `sol_interface!`'s automatic name conversion. Alternatives considered: `#[selector(name = "snake_case_name")]` on each exporter — rejected because it requires per-method opt-in across ~40 methods and silently breaks if any method is missed.

**ADR-010: Uniform `pause(string)` ABI accepting multisig OR timelock callers.** Every pausable Atrium contract exposes `function pause(string reason)` that accepts `msg.sender ∈ {praetor_multisig, praetor_timelock}`. Multisig path is instant; the timelock path goes through `PraetorTimelock.emergencyPause(target, reason)` which forwards `IPausable(target).pause(reason)`. Reasoning: `PraetorTimelock` is the canonical pause helper; without timelock as an accepted caller, the helper would forever revert. Resume is asymmetric — multisig-only with no timelock — because re-enabling money flow deserves the 3-of-5 governance check.

**ADR-011: Codex x402 on-chain authoritative.** Coinbase facilitator is queried as a fast-path hint but its `valid: true` response never bypasses the local on-chain verification: USDC `Transfer` log present in `receipt.logs`, `log.address == CODEX_USDC_ADDRESS`, `topics[2] == payTo`, `data >= expectedMin`, `currentBlock - receipt.blockNumber >= 12`. D1 `payments.tx_hash UNIQUE` prevents cross-isolate replay. The trade-off: ~2 seconds added latency per payment request for the RPC call, vs. arbitrary trust in a third-party HTTP endpoint. Worth it for a payment surface.

**ADR-012: Agent template encoders mirror the on-chain Sigil decoder byte layout.** `agents/template/src/sigil.rs::encode_intent_envelope` and `encode_action_envelope` produce bytes that match `contracts/sigil/src/eip712.rs::decode_intent` and `decode_action` exactly. 3 unit tests confirm min length, fixed action size, oversize-venue rejection. Future drift on either side fails the agent-template unit tests rather than producing an envelope the decoder silently rejects.

### 24.8 §7 / §8 / §13 / §14 / §15 / §17 inline updates (canonical)

The wave changes above modify the following sub-sections — listed here so readers know to consult `docs/AUDIT_FINDINGS.md` for exact diffs and the contract source for authoritative shape:

- **§7.1 Plinth**: `open_position` arms reentrancy guard at entry; `instrument_key` is `keccak256(venue ‖ instrument)`. The pause-ABI snippet at §7.10 is replaced by the uniform `pause(string)` accepting multisig OR timelock.
- **§7.5 Sigil**: `validate_action` is `&mut self`, runs the full 9-step validator with real ecrecover via precompile `0x01`, persists `actions_per_day` + `open_notional_wei` counters. Decoder uses 256-byte body + count-prefixed dynamic-arrays + 65-byte sig.
- **§7.7/§7.8 Adapters**: every adapter parses `originator` from `venue_payload[0..20]`, fail-closed `BadVenuePayload()` revert. Hyperliquid + Polymarket attestations bind to `DOMAIN_SEPARATOR` (chain-id + this contract).
- **§7.10 PraetorTimelock**: `emergencyPause(target, reason)` forwards `IPausable(target).pause(reason)`.
- **§8.x Codex**: x402 middleware as described in ADR-011 above.
- **§13.3 Lantern signer**: scrypt N ≥ 2¹⁷, r ≥ 8, p ≥ 1 enforced; repo-tree paths refused.
- **§14.2 CI**: Kani per-crate; `kani-status.json` published to `apps/verify/public/`; verify badge fetches `/api/kani/status`.
- **§15.5 Praetor CLI (new)**: `services/praetor-cli/`. Env vars: `DEPLOYER_KEYSTORE` + `DEPLOYER_KEYSTORE_PASSWORD` (preferred) or `DEPLOYER_PRIVATE_KEY` (testnet only, `human_left.md` #12). Writes `deployments/{network}.json` atomically via tmp + rename.
- **§17.1 Known concerns**: rows for "Sigil validator is a stub" / "Coffer + Sigil + Vigil proptest empty" / "Sigil tests placeholder" all resolved (✅ G-3, H-C2). New row: x402 facilitator-down handling now "expected" (chain authoritative, facilitator is a latency hint only).

### 24.9 §9 user journeys — corrected count (5 → 7)

`apps/verify/src/app/verify/[step]/page.tsx` ships seven steps; this TDD §9.1–§9.5 listed only five. The two additions:

- **§9.6 Chaos Mode** (`/verify/4` and `/chaos`): random fault injection (oracle drift, keeper offline, partial fill, gas spike, indexer stall). Graceful-degradation UX is the proof, not the absence of faults. Per audit J-C3, the Chaos page now has a distinct error state when the chaos agent is unreachable.
- **§9.7 Proof-of-reserves verification** (`/verify/6` and `/lantern`): user verifies their own Coffer balance is in the latest Lantern Merkle root via the on-IPFS tree. Per audit J-H7, the Lantern dashboard renders all six required UI states (empty/loading/error/permission/success/mobile).

---

*End of Atrium Technical Design Document v1.1 + §24.6–§24.9 build-phase audit-trail. Canon register is `docs/AUDIT_FINDINGS.md`.*


