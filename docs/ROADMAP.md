# Atrium 12-month build roadmap

This is the canonical month-by-month plan. After each month a half-baked audit runs against `ATRIUM_PRD.md` + `TECH_DESIGN.md` + `desing/`. Findings get patched before the next month starts.

## Month-by-month

### Month 1 — Foundation (current)

**Goal:** Plinth + Coffer + Postern + Verifier MVP live on Sepolia. CI green.

**Deliverables**

| Subsystem | What lands | Owner |
|---|---|---|
| Repo skeleton | pnpm + cargo workspaces, foundry, Makefile, CI, design HTML wired | F1+F2 |
| Plinth (Stylus) | SPAN margin engine, dual oracle, margin_version race fix | F1 |
| Coffer (Stylus) | ERC-4626 vault, circuit breakers, adapter cap | F1 |
| Postern Kill Switch + Key Registry (Solidity) | One-tap revoke flow | F1 |
| IPorticoAdapter v1.0 interface | Open standard published | F1 |
| PorticoRegistry | Bytecode-hash whitelist + version pinning | F1 |
| Sigil scaffold | Storage + ABI; full validator land Month 2 | F1 |
| Vigil scaffold | Storage + queue + execute happy path | F1 |
| Aave Horizon adapter | First reference IPorticoAdapter implementation | F1 |
| Subgraph schema (Scribe) | All entities defined, ABIs scaffolded | F2 |
| Verifier UI scaffold | Landing, Jamie hook, 7 step list, live-counter wired to Scribe | F2 |
| Design extractor script | Browser snippet + Node bundle peek | F2 |
| Docs | README, SECURITY, CONTRIBUTING, LICENSE, ROADMAP | F3 |

**Month-1 audit checklist**

- [ ] Every contract compiles via `cargo stylus check`
- [ ] Foundry tests pass on every Solidity contract
- [ ] `make demo` reaches the Verifier UI in ≤90s
- [ ] No fake numbers in the UI — LiveCounter renders empty-state when Scribe is empty
- [ ] CI green on lint, test, kani, frontend, subgraph, secrets-scan
- [ ] All design tokens match `desing/Atrium.html` head
- [ ] README accurate vs what is actually scaffolded
- [ ] No personal files in `git status`
- [ ] No banned words anywhere

### Month 2 — Liquidations + agent layer

**Goal:** Vigil keeper happy path + Sigil full EIP-712 validator + first hybrid adapter (Hyperliquid).

**Deliverables**

- Vigil: full execute_liquidation with NMS ordering, slashing, 3-keeper deployment script
- ✅ Sigil: full EIP-712 typed-data decoder + ECDSA signature recovery (audit G-3 / H-C2 landed in Waves G–H before Month 2)
- Hyperliquid HIP-3 adapter (hybrid): bridge integration + off-chain attestation (✅ shipped; deploy pending)
- ✅ Pendle V2 adapter (shipped; deploy pending)
- Proptest suites for Coffer share monotonicity + mirror-trade math
- 2 of 5 Kani invariants green (solvency + oracle freshness)
- ✅ Praetor CLI: deploy + verify commands working (Wave-F #16 with real forge / cargo-stylus calls; keystore preferred over raw key after Wave-I)
- 3 keeper bots running on Sepolia (founder + 2 mocks)

**Audit:** rerun the Month-1 audit + verify cross-contract integration tests cover the full open → margin → liquidate flow.

### Month 3 — Cross-chain + more adapters

**Goal:** Aqueduct CCIP working + 3 more adapters live.

**Deliverables**

- Aqueduct: send_collateral + claim_back on Arbitrum Sepolia ↔ Ethereum Sepolia
- LINK prefunding + balance monitoring
- Trade.xyz adapter
- Curve adapter
- Polymarket adapter (Polygon Amoy via Aqueduct)
- ResearchAttestation contract live
- Edict tier registry + Sumsub sandbox integration
- 3 of 5 Kani invariants green (+ mandate expiry)

### Month 4 — Indexer + Codex API

**Goal:** Scribe fully indexing live testnet data; Codex 4 endpoints live.

**Deliverables**

- Scribe subgraph deployed to The Graph hosted with real Atrium addresses
- Self-hosted Scribe fallback on Hetzner CX31
- Codex API: 4 of 8 endpoints (account, positions, risk snapshot, venue health)
- x402 facilitator integration + on-chain fallback
- Per-IP + per-wallet + per-agent rate limits
- Postgres row-level security
- Codex deployed to Cloudflare Workers free tier

### Month 5 — Lantern + Proof-of-reserves

**Goal:** Hourly Merkle attestations live; users can verify their own balance.

**Deliverables**

- Lantern attestor cron on founder VPS
- Software signing key with Argon2id + Shamir 3-of-5 backup
- Merkle tree builder
- LanternAttestor contract live
- web3.storage IPFS pinning
- `lantern.atrium.fi` dashboard live
- `lantern.atrium.fi/sla` SLA page with 5 circuit-breakers documented
- User-side proof verifier (Verifier Mode step 6)

### Month 6 — Reference agents

**Goal:** Augur + Haruspex + Auspex live on Sepolia rebalancing $500 each hourly.

**Deliverables**

- Agent template (`agents/template/`)
- Augur (mean-reversion on HIP-3) — Rust binary on Fly.io free tier
- Haruspex (momentum on HIP-3)
- Auspex (basis-trade Pendle YT vs Aave Horizon)
- Curator grant program announcement
- 5 of 5 Kani + proptest invariants green
- Rostrum leaderboard (read-only)

### Month 7 — Mobile PWA + Cohort UI

**Goal:** Mobile-first PWA Lighthouse ≥90; Cohort Status Page live.

**Deliverables**

- PWA manifest + service worker
- Passkey login flow on mobile (Coinbase Smart Wallet)
- All 5 required mobile flows working (deposit, open hedged, view Lantern, Kill Switch, PWA install)
- Cohort Status Page (`cohort.atrium.fi`) — reads from Scribe `CohortPartner`
- Rostrum follow flow (write side)

### Month 8 — Tablet + Tax exports

**Goal:** UK CGT export working (US 8949 + DE FIFO deferred to Month 11).

**Deliverables**

- Tablet Python service
- UK CGT: same-day → bed-and-breakfasting → s.104 pool
- CSV export with HMRC SA108 format
- SendGrid integration for emailed exports
- Cohort partner #1–#3 onboarded (real)
- Press contact #1 outreach

### Month 9 — Chaos Mode + benchmarks

**Goal:** Chaos Mode UI + benchmarks page live.

**Deliverables**

- Chaos Mode: oracle drift, keeper offline, partial fill, gas spike, indexer stall injection
- `chaos.atrium.fi` public log
- `benchmarks.atrium.fi` honest side-by-side vs Cascade/August/Project 0
- `loadtest.atrium.fi` running 24/7
- 18 subsystem Loom videos (30s each)

### Month 10 — Codex polish + Edict expansion

**Goal:** All 8 Codex endpoints live; Edict tier registry fully wired into Plinth + Coffer modifiers.

**Deliverables**

- Codex endpoints 5–8 (agents leaderboard, agent history, backtest job, attestation latest)
- Edict modifiers (`onlyTier`) applied on Plinth.open_position, Coffer.deposit
- Sumsub callback handler hardened
- Legal memo PDF in `/legal/` (Stanford Law Crypto Clinic consult)

### Month 11 — Tablet US + DE + Praetor CLI v1

**Goal:** Three-jurisdiction tax exports + full Praetor CLI for ops.

**Deliverables**

- Tablet US Form 8949 short/long classification
- Tablet German FIFO per asset per venue
- Praetor CLI: deploy, migrate, monitor, keepers, lantern, pause/resume, backtest
- Single-binary distribution
- Runbooks complete in `/runbooks/`

### Month 12 — Hardening + rehearsals

**Goal:** Gas optimization, 10 demo rehearsals, JUDGE_ONE_PAGER, final cross-subsystem audit.

**Deliverables**

- Plinth gas budget targets hit (≤120K open, ≤80K update_margin)
- All 5 Kani + proptest invariants green in CI
- 10 demo dress rehearsals logged in `/rehearsals/`
- JUDGE_ONE_PAGER.md v2 (story-arc Jamie, 500 words)
- Final parallel sub-agent audit across all 18 subsystems
- Launch readiness checklist signed off
- Buildathon submission packet (if relevant timing)

## Per-month audit format

Every month closes with an audit pass. Run these in order:

1. **Doc audit** — compare delivered code to PRD §X + TDD §X. Flag any half-baked surface.
2. **Design audit** — every screen built this month matches `desing/` tokens.
3. **Test audit** — every new contract has unit + proptest + (where applicable) Kani.
4. **Honesty audit** — every "live" number reads from Scribe or on-chain. No invented data.
5. **Security audit** — STRIDE on new subsystems, missing mitigations added to PRD §21.
6. **Calendar audit** — `.claude/rules/git.md` clean: no personal files, no AI coauthor lines.

Audit findings get patched **before** the next month starts. Tripwires from PRD §26.3 fire if scope must be cut — the cut goes public the same day.

## Final audit (post-Month 12)

Launch 4–6 parallel sub-agents in this configuration:

- **Agent A:** Contracts cross-check (Plinth + Vigil + Coffer + Sigil + Postern)
- **Agent B:** Adapters cross-check (IPorticoAdapter conformance for all 6 venues)
- **Agent C:** Off-chain services audit (Codex + Lantern + Scribe + agents)
- **Agent D:** UI audit (every screen matches `desing/` + .claude/rules/ui.md)
- **Agent E:** Honesty + claims audit (no fake numbers, no aspirational present tense)
- **Agent F:** Security audit (oracles, multisig, key handling, CCIP, adapter caps)

Findings synthesized into a single launch-readiness report. Anything red blocks launch.
