# Months 2–12 — Build Blueprint

This is the per-month implementation guide. Each section names the files to create or edit, the contracts/services involved, the audit gates that must close before the next month opens, and the deferred work that lands in the audit-fix window.

Month 1 closed with 48 source files / 4,456 lines (`docs/MONTH_01_AUDIT.md`). Months 2–12 build on that foundation.

## Month 2 — Liquidations + agent layer (3 founder-weeks)

**Theme:** Activate the security boundary for agents and close all Month-1 deferred items.

### Files to add or edit

| Path | Action | Description |
|---|---|---|
| `contracts/sigil/src/lib.rs` | Replace stub `validate_action` | Full EIP-712 typed-data decode, dual ECDSA recovery (owner intent + agent action), all 9 caps checked in order |
| `contracts/sigil/src/eip712.rs` | Create | Pure typed-data hashing + signature recovery, Kani-verifiable |
| `contracts/vigil/src/lib.rs` | Edit `queue_liquidation` | Replace "first position" with PorticoRegistry.get_venue_health-driven NMS ordering |
| `contracts/adapters/hyperliquid/src/HyperliquidHybridAdapter.sol` | Wire deposit + withdraw | Connect to Bridge2.sol on Sepolia; validator-signed attestation flow live |
| `contracts/adapters/pendle/src/PendleV2Adapter.sol` | Create | YT/PT/SY adapter using resources/pendle-core-v2-public |
| `tests/foundry/Plinth.t.sol` | Create | Foundry integration suite covering open → margin → liquidate happy path |
| `tests/foundry/Coffer.t.sol` | Create | Deposit/withdraw round-trip, per-adapter cap, circuit-breaker |
| `tests/foundry/Sigil.t.sol` | Create | Full mandate lifecycle, revocation, replay protection |
| `tests/foundry/Vigil.t.sol` | Create | Keeper stake/slash, margin_version race fix, NMS ordering |
| `contracts/coffer/tests/proptest.rs` | Create | Share monotonicity, deposit→withdraw neutrality |
| `services/praetor-cli/src/main.rs` | Stub | `deploy`, `verify`, `keepers list/stake` commands |
| `apps/verify/src/app/verify/[step]/page.tsx` | Edit | Wire steps 1–3 to deployed Plinth/Coffer/Postern |
| `docs/MONTH_02_AUDIT.md` | Create at month close | Same template as Month 1 audit |

### Audit gates to close (Month-1 carry-over)

1. Sigil `validate_action` returns the real result, not `Ok(false)` — required for any agent traffic
2. Coffer proptest suite passes
3. Vigil NMS ordering implemented + tested

### New audit items for Month 2

- Sigil EIP-712 domain separator computed correctly per chain id
- Vigil keeper slash threshold tested with 3, 4, 5 missed windows
- Hyperliquid adapter: validator-signed attestation accepted, duplicate rejected
- Pendle adapter: YT yield accrual matches Pendle's published rates within 5 bps
- Foundry coverage ≥ 85% on every new Solidity contract
- Stylus test suite runs in CI (TestVM API verified)

---

## Month 3 — Cross-chain + more adapters

**Files to add**

| Path | Description |
|---|---|
| `contracts/aqueduct/src/AqueductReceiver.sol` | The destination-chain receiver that mints CCIP-delivered credits |
| `contracts/adapters/trade-xyz/src/TradeXyzAdapter.sol` | Trade.xyz adapter |
| `contracts/adapters/curve/src/CurveAdapter.sol` | Curve liquidity-pool adapter |
| `contracts/adapters/polymarket/src/PolymarketAdapter.sol` | Polymarket on Polygon Amoy via Aqueduct |
| `contracts/edict/src/Edict.sol` | Tier registry + Sumsub callback handler |
| `tests/foundry/Aqueduct.t.sol` | CCIP send + receive + claim-back |
| `tests/foundry/EdictTiers.t.sol` | Tier gating across Plinth.open_position + Coffer.deposit |

**Audit gates**

- 3 of 5 Kani invariants green (solvency, oracle freshness, mandate expiry)
- CCIP round-trip on Sepolia tested + recorded in `/incidents/test-ccip-roundtrip.md`
- LINK balance metric live in `loadtest.atrium.fi`

---

## Month 4 — Indexer + Codex API

**Files to add**

| Path | Description |
|---|---|
| `subgraph/src/sigil.ts` | Indexer for Sigil revocations + revoke_all events |
| `subgraph/src/edict.ts` | Indexer for tier assignments |
| `services/codex/src/index.ts` | Hono entrypoint with x402 middleware |
| `services/codex/src/routes/margin.ts` | `/v1/margin/account/{address}` |
| `services/codex/src/routes/positions.ts` | `/v1/positions/{address}` |
| `services/codex/src/routes/risk.ts` | `/v1/risk/snapshot/{address}` |
| `services/codex/src/routes/venues.ts` | `/v1/venues/health` |
| `services/codex/src/middleware/rate-limit.ts` | Per-IP + per-wallet + per-agent |
| `services/codex/src/middleware/sign-response.ts` | HMAC-SHA256 backend signature |
| `services/codex/src/db/schema.sql` | Postgres schema with RLS |
| `services/codex/wrangler.toml` | Cloudflare Workers config |

**Audit gates**

- Scribe self-hosted fallback live on Hetzner CX31 (verified in `loadtest`)
- Codex deployed to Workers, hit by E2E test, returns signed response within p95 budget
- x402 facilitator fallback to on-chain verification tested

---

## Month 5 — Lantern proof of reserves

**Files to add**

| Path | Description |
|---|---|
| `services/lantern-attestor/src/index.ts` | Hourly cron entry |
| `services/lantern-attestor/src/merkle.ts` | Tree builder using sparse Merkle pattern |
| `services/lantern-attestor/src/signer.ts` | Software key + Argon2id + Shamir backup integration |
| `contracts/lantern-attestor/src/LanternAttestor.sol` | On-chain root publisher |
| `apps/verify/src/app/lantern/page.tsx` | Public proof-of-reserves dashboard |
| `apps/verify/src/app/lantern/sla/page.tsx` | Withdrawal SLA + 5 circuit-breaker spec |
| `apps/verify/src/lib/merkle-verifier.ts` | Client-side inclusion proof |

**Audit gates**

- Hourly attestation publish for 7 consecutive days without miss
- Inclusion proof verifies for a random sample of 100 users
- Key rotation drill executed and documented in `/runbooks/key-rotation.md`

---

## Month 6 — Reference agents

**Files to add**

| Path | Description |
|---|---|
| `agents/template/src/main.rs` | Reusable agent skeleton |
| `agents/template/README.md` | "How to build an agent" Curator-grant guide |
| `agents/augur/src/strategy.rs` | Mean-reversion logic |
| `agents/augur/src/main.rs` | Run loop on Fly.io |
| `agents/haruspex/src/strategy.rs` | Momentum on HIP-3 perps |
| `agents/auspex/src/strategy.rs` | Basis-trade Pendle YT vs Aave Horizon |
| `apps/verify/src/app/rostrum/page.tsx` | Leaderboard UI |
| `subgraph/src/rostrum.ts` | Agent + follower indexer |

**Audit gates**

- 5 of 5 Kani + proptest invariants green
- 3 agents running 7 consecutive days without crash
- Rostrum leaderboard renders live PnL from Scribe — never invented

---

## Month 7 — Mobile PWA + Cohort UI

**Files to add**

| Path | Description |
|---|---|
| `apps/verify/public/manifest.json` | PWA manifest |
| `apps/verify/public/sw.js` | Service worker |
| `apps/verify/src/app/cohort/page.tsx` | Cohort Status Page |
| `apps/verify/src/components/cohort-card.tsx` | Per-partner card |
| `subgraph/src/cohort.ts` | CohortPartner entity indexer |

**Audit gates**

- Lighthouse Mobile ≥ 90 on perf, a11y, best practices, SEO
- PWA install tested on iOS Safari + Android Chrome
- Cohort Status Page shows live partner count, never aspirational

---

## Month 8 — Tablet (UK CGT)

**Files to add**

| Path | Description |
|---|---|
| `services/tablet/src/main.py` | FastAPI entry |
| `services/tablet/src/jurisdictions/uk.py` | Same-day → b-and-b → s.104 pool |
| `services/tablet/src/exporters/csv.py` | HMRC SA108 CSV |
| `services/tablet/src/db/queries.py` | Scribe GraphQL client |
| `services/tablet/tests/test_uk_cgt.py` | Per-rule unit tests |

**Audit gates**

- UK CGT calculator matches HMRC worked examples for 5 scenarios
- Export delivered via SendGrid free tier within 5 min of request

---

## Month 9 — Chaos Mode + benchmarks

**Files to add**

| Path | Description |
|---|---|
| `apps/verify/src/app/chaos/page.tsx` | Chaos Mode UI |
| `apps/verify/src/lib/chaos-agent.ts` | Off-chain fault injector |
| `apps/verify/src/app/benchmarks/page.tsx` | Side-by-side comparison |
| `apps/verify/src/app/loadtest/page.tsx` | 24/7 perf dashboard |
| `apps/verify/src/app/learn/page.tsx` | 18 subsystem Looms |

**Audit gates**

- 5 chaos faults each tested 100 times — graceful degradation in every run
- Benchmarks page numbers come from actual venue docs, every claim cited

---

## Month 10 — Codex polish + Edict integration

**Files to add or edit**

| Path | Description |
|---|---|
| `services/codex/src/routes/agents.ts` | `/v1/agents/leaderboard`, `/v1/agents/{address}/history` |
| `services/codex/src/routes/backtest.ts` | `/v1/backtest/{strategy_id}` async job + webhook |
| `services/codex/src/routes/attestation.ts` | `/v1/attestation/latest` |
| `contracts/edict/src/EdictModifier.sol` | onlyTier modifier library |
| `legal/jurisdictional-note-v1.pdf` | Stanford Law Crypto Clinic consult output |

**Audit gates**

- All 8 Codex endpoints live, signed, rate-limited
- Edict modifiers exercise the right tiers on the right entry points

---

## Month 11 — Tablet US + DE + Praetor CLI v1

**Files to add**

| Path | Description |
|---|---|
| `services/tablet/src/jurisdictions/us.py` | Form 8949, short vs long classification |
| `services/tablet/src/jurisdictions/de.py` | German FIFO per asset per venue |
| `services/praetor-cli/src/commands/deploy.rs` | Full deploy pipeline |
| `services/praetor-cli/src/commands/migrate.rs` | Schedule + execute upgrades |
| `services/praetor-cli/src/commands/keepers.rs` | List + stake + slash |
| `services/praetor-cli/src/commands/lantern.rs` | Publish-now |
| `runbooks/deploy.md` | Wave-by-wave deploy procedure |
| `runbooks/incident-oracle.md` | Oracle drift procedure |
| `runbooks/incident-keeper.md` | Keeper failure procedure |
| `runbooks/key-rotation.md` | Lantern + Codex key rotation |

**Audit gates**

- Praetor CLI single binary builds for macOS, Linux, Windows
- All runbooks tested via tabletop drill

---

## Month 12 — Hardening + rehearsals + final audit

**Files to add**

| Path | Description |
|---|---|
| `rehearsals/dress-run-01.md` … `dress-run-10.md` | 10 logged dry runs |
| `JUDGE_ONE_PAGER.md` | 500-word story-arc Jamie narrative |
| `docs/MONTH_12_AUDIT.md` | Final pre-launch audit |
| `docs/LAUNCH_READINESS.md` | Sign-off checklist |
| `incidents/README.md` | Post-mortem template + index |

**Final cross-cutting audit (parallel sub-agents)**

| Agent | Scope |
|---|---|
| A | Contracts: Plinth + Vigil + Coffer + Sigil + Postern compile, deploy, satisfy invariants |
| B | Adapters: all 6 adapters pass IPorticoAdapter conformance suite |
| C | Off-chain: Codex + Lantern + Scribe + 3 agents healthy for 7d |
| D | UI: every screen matches `desing/`, all 6 required states present per `.claude/rules/ui.md` |
| E | Honesty: every "live" number reads from Scribe or on-chain; banned words absent |
| F | Security: STRIDE complete on every subsystem, oracles green, multisig drilled |

Any red finding blocks launch.

## Cross-cutting commitments per .claude/rules/*

These apply every month, not just at audit:

- **No banned words in any committed text** (`.claude/rules/writing.md`)
- **No personal files in `git status`** (`.claude/rules/git.md`)
- **Every commit has a clear type/scope/summary** (`.claude/rules/git.md`)
- **Every UI screen has all 6 required states** (`.claude/rules/ui.md`)
- **Every test passing matters; coverage is the floor** (`.claude/rules/testing.md`)
- **Every external dependency verified against `resources/`** (`.claude/rules/security.md`)

## Tripwires that fire scope cuts

| Condition | Cut action | Public announcement |
|---|---|---|
| Plinth not deploying by EOD Month 1 Week 3 | Defer Sigil full validator to Month 3 | Mirror micro-post the same day |
| Less than 2 of 3 keepers operational by Month 4 | Honest "1 of 3" in Lantern dashboard | Lantern dashboard banner |
| Pyth Sepolia equity feed gap not resolved by Month 5 | Praetor mainnet relay launch, disclosed | `lantern.atrium.fi/sla` page |
| Fewer than 3 Cohort partners by Month 7 | F3 reallocates from press to BD | Mirror post |
| Tablet UK CGT not matching HMRC by Month 8 | Defer auto-file feature, ship CSV only | Tablet docs |
| Mobile Lighthouse below 85 by Month 7 | Skip native-feel polish, ship functional PWA | Release notes |

Every cut is announced. Silent slippage is forbidden.
