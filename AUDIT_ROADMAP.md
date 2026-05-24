# Atrium roadmap-delivery audit — 2026-05-24

Auditor: D (scope: promise-vs-reality gap, not contracts/pages/pipeline internals)
Method: read `ATRIUM_12_MONTH_ROADMAP.md`, `ATRIUM_FULL_FLOW_DESIGN.md`, `ATRIUM_PRD.md` §17 (FLOOR/REALISTIC), `JUDGE_ONE_PAGER.md`, `LAUNCH_READY.md`, `human_left.md`, `AUDIT_USER_FLOWS.md`, `audits/month-*-half-baked-audit*.md`, `deployments/arbitrum_sepolia.json`, and walked the apps/contracts/services trees. Cross-referenced every Month-1 / Month-2 / Month-3 promise against artefacts on disk. Did not re-walk individual flows (Auditor B+C territory).

---

## Headline

**Month-1 contract scope is ~85% landed; the off-chain operational layer that turns those contracts into a live demo is ~30% landed.** Buildathon submission day is Day 17 (2026-06-10) per `ATRIUM_12_MONTH_ROADMAP.md:5`. Today (Day -1 of Month 1, with Month-1 nominally Day 1-30) the picture is unusual: contract work is *ahead* of schedule (Plinth, Sigil, Vigil, Coffer, 9 adapters, Aqueduct trio, Router, Rostrum, Faucet — 30 contracts deployed on Sepolia, all 22 Solidity verified on Sourcify), but every promised cross-roadmap operational step is unfinished: Lantern cron is not generating attestations, Codex/Tablet are deployed-but-unreachable behind SSO walls, agents are idle on the droplet, Faucet is unstocked, no Praetor multisig exists. The roadmap's Month-1 "tripwire T1" (verifier flow Steps 1-5 end-to-end on Sepolia) is **not met today** — submitting in current state needs the Loom-only fallback per `ATRIUM_12_MONTH_ROADMAP.md:240`. Worse: there's **no tripwire announcement** in any doc acknowledging that Cohort (0 partners vs Day-90 target of 2), 5 Kani invariants (3/5 in CI), or several Month-2/3 deliverables have already slipped or been redrawn — silent cuts per `.claude/rules/writing.md`.

---

## Month 1 deliverables — done / partial / blocked / missing

Source: `ATRIUM_12_MONTH_ROADMAP.md:72-87` (numbered items 1-5).

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | **Adapter orchestration (Option A — Coffer orchestrator)** | **PARTIAL with deviation** | Roadmap committed to `Coffer.open_position_via_adapter`. **Reality**: `human_left.md:524-526` says "Resolved by `AtriumRouter` (Option C)". That is a documented swap — Option C was the un-recommended path per `human_left.md:547`. No tripwire announcement in PRD or any doc. The Router contract is deployed (`0xf134…2717`) and tests exist (`tests/foundry/AtriumRouter.t.sol`, 11 tests per `audits/month-1-half-baked-audit.md:20`). Only **CurveAdapter** is currently migrated to `onlyAuthorizedCaller`; the other 5 (Pendle, AaveV11, TradeXyz, Polymarket, Hyperliquid) and the 4 new ones (GMX, Morpho, Synthetix, Stoa) are pending the same modifier swap. Roadmap said "≥7 tests" — Router has 11 integration tests but **only for Curve**; the 7-adapters-through-Router promise is unmet. |
| 2 | **Stylus build unblock (Linux Docker)** | **DONE** | `contracts/stylus.Dockerfile` exists. `ATRIUM_12_MONTH_ROADMAP.md:79` committed to "F1 commits the Dockerfile; CI runs Stylus checks per push" — `.github/workflows/ci.yml` exists. Plinth/Sigil/Vigil/Coffer all migrated to stylus-sdk 0.10 and deployed via cargo-stylus 0.10.7 multi-fragment factory per `deployments/arbitrum_sepolia.json:77-83` + `LAUNCH_READY.md:175-183`. **Ahead of schedule** — this was supposed to be Month-1 critical work but landed pre-Month-1. |
| 3 | **Subgraph deploy to The Graph hosted service** | **DONE** | `DEPLOY_PLAN.md:15` shows live endpoint `api.studio.thegraph.com/query/1753863/atrium-arbitrum-sepolia/v0.0.1`. `subgraph/subgraph.yaml` indexes Plinth/Vigil/Coffer/Aqueduct/Sigil/PosternKillSwitch/PosternKeyRegistry/Rostrum + 11 Solidity sources. Note: subgraph mapping tests blocked per `human_left.md:3-11` (#34) on Stylus ABI emptiness — Solidity event handlers index fine, but matchstick test coverage = 0. **Ahead of schedule + half-baked**. |
| 4 | **Codex remaining 3 endpoints (catalog 5 → 8)** | **PARTIAL** | `services/codex/src/routes/` shows **8 route files** (`agents`, `attestation`, `backtest`, `margin`, `options`, `positions`, `risk`, `venues`) — and `audits/month-1-half-baked-audit.md:63` claims a "Codex catalog (10 endpoints)". So endpoint count is hit. **But**: `AUDIT_USER_FLOWS.md:167` says `atrium-codex.workers.dev/health` → DNS failure; `DEPLOY_PLAN.md:11` shows the worker URL live but Codex API claimed health-OK. Tests blocked by `@x402/core` version mismatch (`human_left.md:13-31`, #33). The HIGH-severity x402 middleware audit fixes (FIRE78-CODEX1, FFF-2, iter-42, BBBB-5) remain untested. Endpoints exist; verification gap; not provably wired into the verifier flow. |
| 5 | **Buildathon submission package (Day 17)** | **AT-RISK** | `LAUNCH_READY.md:1-11` headline scores 9 of 15 flows wired but `AUDIT_USER_FLOWS.md:9-11` (more honest) says ~9 of 15 at contract layer, ~3 of 15 actually end-to-end (Land/Passkey/Kill Switch tx). README/judge runbook updates with final URLs are listed open in `LAUNCH_READY.md:292`. Demo backup (Loom + QR per `human_left.md:512-522` #20) **not done**. No domain claimed (`LAUNCH_READY.md:290`, `human_left.md` implicit). Per roadmap tripwire T1, today's state requires Loom-only entry — **no doc has announced T1 fired yet**. |

### Month-1 *end-of-month sweep* commitments (roadmap §"End-of-month sweep")

- **Half-baked: every direct adapter test must have a Router-orchestrated sibling test** — `audits/month-1-half-baked-audit.md:26` admits only Curve has this; Router `close_position_via_adapter` has zero integration tests. **MISSING / DEFERRED**.
- **Design parity: landing matches `desing/Atrium.html` 10 sections in order** — `AUDIT_USER_FLOWS.md:39` flags landing-v2.html at 1.6 MB (over the 250 KB budget in `.claude/rules/ui.md §3.4`). Auditor B's territory; flagging that the *parity* sweep promised by the roadmap has not been formally executed.
- **Tripwire: announce if Buildathon submission slips Day 17** — no `incidents/` entry exists; the folder has only `dress-run-template.md`. T1 either hasn't fired yet (we're pre-Day-17) or has already silently fired by failing items 1, 4, 5 above.

---

## Month 2 — what shipped early, what's outstanding

Source: `ATRIUM_12_MONTH_ROADMAP.md:89-102` (items 1-4).

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | **Sigil credit-line decrement (item #29)** | **PARTIAL — shipped on-disk, untested** | `audits/month-2-5-half-baked-audits.md:9-23` confirms `Sigil.record_close(agent, amount)` + `SigilOpenNotionalDecremented` event in source. **No Foundry test pinned** (Stylus-blocked locally per finding M2-1). The `agent` field on Plinth's `Position` struct — required per `human_left.md:577` step 1 — is unverified in this audit window. **Ahead of roadmap calendar, behind on tests.** |
| 2 | **Postern passkey login (Coinbase SW + Pimlico)** | **DONE** | `AUDIT_USER_FLOWS.md:49-52` (Flow 3) marks passkey wallet creation as ✅. **Ahead of schedule** (Month-2 deliverable shipped pre-Month-1). |
| 3 | **Postern session-key issuance + revocation + Kill Switch UI** | **PARTIAL** | `PosternKillSwitch` (`0xB90a…b676`) + `PosternKeyRegistry` (`0x28c9…47d8`) deployed. UI exists at `/app/agents`. **But**: `AUDIT_USER_FLOWS.md:99-103` (Flow 10) — `activeKeys[user]` always empty because Flow 9 (mandate signing → agent acts) is broken (no agent picking up mandates from droplet, see Month-3 cohort below). The button works; the chain is wired; the demo lands but revokes zero things. Half-baked. |
| 4 | **Subgraph `PosternKeyEvent` entity** (`human_left.md` #21) | **PARTIAL** | `subgraph/subgraph.yaml:331-345` confirms `PosternKeyRegistry` data source wired. `human_left.md:21` (#21) item is **still open** — schema needs `PosternKeyEvent`; mapping handlers + frontend `/api/agents/summary` to stop returning null for `activeSessionKeys`. Codex `/agents/summary` still returns null per Wave JJ-7. **Partially landed.** |

### Month 2 also shipped early (ahead of calendar)

- **Faucet contract** (`0x7f3a…2bbc`, `deployments/arbitrum_sepolia.json:183-193`) — scoped for Month-1 W2 per `ATRIUM_FULL_FLOW_DESIGN.md:69`. Deployed. **Unstocked** (per `AUDIT_USER_FLOWS.md:55-63` Flow 4).
- **9 venue adapters all deployed** (Aave Horizon, Curve, GMX, Hyperliquid, Morpho, Pendle, Polymarket, Synthetix, Trade.xyz). Roadmap Day-180 FLOOR target is **4 adapters real** (`ATRIUM_PRD.md:810`); REALISTIC is 8. **30 contracts now deployed vs. PRD FLOOR target of ~13-15.** This is scope creep that benefits the demo.

---

## Month 3 + later — relevance check

Source: `ATRIUM_12_MONTH_ROADMAP.md:104-178`.

| Month | Item | Relevance now |
|---|---|---|
| M3 | **Aqueduct round-trip Arb Sepolia → Eth Sepolia** | Aqueduct/Receiver/Claimback deployed but `AUDIT_USER_FLOWS.md:119-127` (Flow 13) confirms zero LINK in contract + no allowed destinations set + no USDC. **Cross-chain demo path is contract-ready but operationally dead.** Tripwire T2 (Day 90 if round-trip incomplete) — has 90 days. Currently at risk. |
| M3 | **Tablet UK CGT** | `services/tablet/` exists, deployed to Vercel per `DEPLOY_PLAN.md:12`, BUT behind SSO wall. The page works in source but the tax download is structurally blocked: requires real trade events from Plinth, which require Coffer balance + Plinth.open_position via the Router pipeline that needs adapters whitelisted. **Tablet ships dead until the demo flow lands.** |
| M3 | **Edict + Sumsub sandbox wiring** | `human_left.md` #8 — pending human dashboard onboarding. **Not started.** |
| M3 | **Lantern attestor hourly cron deploy** | `lantern-attestor` (`0x900a…1168`) deployed. Cron deployed to Vercel (`DEPLOY_PLAN.md:13`). **Lantern signing key NOT generated** per `AUDIT_USER_FLOWS.md:107-109` Flow 11. Even with key, no Coffer balances exist → nothing to attest. Verifier Step 6 reads honest "no attestation published yet". Listed Month-3, was promised "Verifier Mode Step 4 reads real `latest_root`" — not happening today. |
| M4 | **Rostrum MVP** | Rostrum.sol deployed (`0xbaf3…b0af`). UI page exists (`/rostrum`). Subgraph indexes Rostrum (`subgraph/subgraph.yaml:378`). **Ahead of schedule.** Copy-trade end-to-end blocked on agents not running. |
| M4 | **Curator grants v1** | `contracts/curator/` exists. `audits/month-2-5-half-baked-audits.md:50-60` confirms 22 tests, GrantCreated/Claimed/Cancelled events. No `/curator` Next.js page in `apps/verify/src/app/` (grep returns nothing). UI side missing. **Contract ahead, UI behind.** |
| M4 | **Praetor CLI `lantern publish-now` + `seed`** | Still stubs per `human_left.md:554-567` (#30). Blocks `make demo`. |
| M5 | **Code4rena audit prep + 5 Kani invariants in CI** | `LAUNCH_READY.md:331` — 3 of 5 Kani invariants today. CI badge says "pending" per `AUDIT_USER_FLOWS.md:181-182`. Code4rena submission pack — `ops/code4rena-submission-pack.md` exists (per `human_left.md:72`) but unconfirmed. |
| M5 | **Cohort partner #1** | **0 partners signed** per `LAUNCH_READY.md:336` + `human_left.md:101-105` (#4). Day-90 target is 2 per `ATRIUM_PRD.md:830`. Already behind. |
| M6 | **Day-180 PRD §17 metrics: 13 subsystems live, 4 adapters real** | On track for subsystem count; over on adapter count (9 deployed). Tripwire T3 is Day 180. |
| M7+ | Phase-2 Stoa, GMX, Synthetix, Tablet US/DE, etc. | GMX + Synthetix + Morpho adapters already deployed (Phase-2 work shipped early). Stoa contract scaffolded (`contracts/stoa/`) but no UI surface or wiring. |

---

## Full-flow design surface inventory

Source: `ATRIUM_FULL_FLOW_DESIGN.md` cross-referenced against `apps/verify/src/app/` route tree.

| Flow surface (FULL_FLOW_DESIGN section) | Code location | Status |
|---|---|---|
| Onboarding (5 steps) | `/app/onboarding/page.tsx` | UI exists; faucet step inert (contract unstocked) |
| Risk Preview modal (first trade) | `components/trade/risk-preview-modal.tsx` | Built; test exists (`DEPLOY_PLAN.md:59-63`) |
| Opening a position (Trade page) | `/app/trade/page.tsx` | Renders. Hardcoded `venue = 'hl-hip3'` + leverage slider not threaded per `human_left.md` #24. Half-baked. |
| Topping up | `components/portfolio/top-up-banner.tsx` | Built per `DEPLOY_PLAN.md:60` |
| Portfolio | `/app/portfolio/page.tsx` | UI exists; data returns `source: 'pending'` per `AUDIT_USER_FLOWS.md:85-91` |
| Agent marketplace + leaderboard | `/agents/marketplace/` + `/rostrum/page.tsx` | Pages exist. Per `human_left.md:401` (UU-1) Rostrum subgraph mapping now wired (`subgraph.yaml:378`). Reads still return empty (no on-chain follows yet). |
| Closing a position | Within `/app/portfolio/` open-positions-table | Per-row Revoke button + emergency close shipped (`DEPLOY_PLAN.md:60-61`) |
| Emergency close (no liquidity) | `components/portfolio/emergency-close-banner.tsx` | Built |
| Moving money between chains | `/app/transfer/page.tsx` | Page exists. Aqueduct unfunded with LINK; destinations unauthorized per `AUDIT_USER_FLOWS.md:122-126`. |
| Mandate signing | `/app/agents/page.tsx` | EIP-712 signing wired. Storage doesn't centrally persist (matches design caveat at `ATRIUM_FULL_FLOW_DESIGN.md:600-624`). |
| Revoke single mandate | `lib/use-revoke-mandate.ts` + agents panel | Built per `DEPLOY_PLAN.md:61` |
| Agent trades on your behalf | requires droplet agents | **3 agents (Augur/Haruspex/Auspex) idle** on droplet `157.245.201.53` per `DEPLOY_PLAN.md:14`. |
| Liquidation | Vigil deployed + UI surfaces | Contract live; no Vigil keeper bots running (`human_left.md` #16) |
| Kill Switch | `/app/agents/page.tsx` shortcut | Contract live; revokes 0 things until mandates exist |
| Withdraw + withdrawal SLA | `/app/vault/page.tsx` + `/sla/page.tsx` | UI exists. Withdraw path requires Coffer state. |
| Tax export | `/app/tax/page.tsx` + Tablet service | Page exists; Tablet behind Vercel SSO wall |
| Verifier walk (7 steps) | `/verify/[step]/page.tsx` | Dynamic route covers steps 1-7. Per `AUDIT_USER_FLOWS.md:140-149` table — steps 3,4,5,6,7 each gated on a missing operational piece. |
| Notifications inbox | `/app/notifications/page.tsx` | UI exists |
| Notification settings + off-app | per FULL_FLOW_DESIGN: Month 5 | Pending — Settings Notifications tab honest banner per design contract |
| Connected sites / session keys | `/app/settings/page.tsx` | Wallet tab live per design; other tabs are honest-pending banners |
| Mobile flows | `desing/Mobile *.html` deployed via middleware | Per `AUDIT_USER_FLOWS.md:129-135` Flow 14 — **vanilla JS mockup, not React; no wagmi**. Buttons decorative. |
| Reserves (Lantern) page | `/lantern/page.tsx` | Renders. "No attestation published yet" honest state. |
| Public pages (landing/docs/learn/security/brand/manifesto/team/cohort/changelog/legal) | `/`, `/docs`, `/learn`, `/security`, `/brand`, `/manifesto`, `/team`, `/cohort`, `/changelog`, `/legal/*` | All routes exist. Landing carries fake "Built with" partner logos per `AUDIT_USER_FLOWS.md:163-164` finding B (writing-rules violation). |
| Chaos drill (Step 4 of Verifier) | `/chaos/page.tsx` | "Chaos agent deploys Month 9" honest banner per design |
| Migrating testnet → mainnet | No dedicated page | Documented in design, page not built (acceptable — mainnet is Year-2) |
| Eligibility / KYC disclosure | No dedicated page | Documented in design, page not built (Year-2 scope) |
| Markets page | `/app/markets/page.tsx` | Exists; **not enumerated in `ATRIUM_FULL_FLOW_DESIGN.md`** — minor scope creep (low-risk) |
| Loadtest page | `/loadtest/page.tsx` | Exists; **not enumerated in any roadmap** — internal tooling, fine |

---

## PRD FLOOR + REALISTIC reconciliation

Source: `ATRIUM_PRD.md:807-833` §17.

### FLOOR targets (Day 365, zero-money scenario)

| Tier | Item | Status today (Day -1 of Month 1) | Notes |
|---|---|---|---|
| FLOOR | 13/18 subsystems live | **Effectively 14 deployed** (Plinth, Vigil, Coffer, Sigil, Portico, Aqueduct, Edict, Tablet, Praetor-Timelock, Lantern-attestor, Codex, Scribe, Postern, Curator), Stoa contract scaffold but no integration. Cohort + Rostrum also live. Curator contract live but no UI. | Subsystem *count* beat early, but "live" definition is generous — many contracts deployed without operational wiring. |
| FLOOR | 4 Portico adapters real | **9 deployed** | Massive over-delivery on count; *none* are end-to-end whitelisted via PorticoRegistry per `LAUNCH_READY.md:259`. |
| FLOOR | 5 Codex paid endpoints | **8 endpoints implemented**; Cloudflare deploy live per `DEPLOY_PLAN.md:11` | Over-delivered on count; reach/test gap per `human_left.md` #33. |
| FLOOR | 3 cohort partners | **0** | Behind on Day-90 target (2). Tripwire-worthy. |
| FLOOR | $0 Curator grants | $0 | Met (vacuously). |
| FLOOR | 5K Codex queries/month | n/a | Pre-launch. |
| FLOOR | 10 Rostrum agents | **0 agents registered** | Behind. |
| FLOOR | 99% Lantern uptime | **0%** (no attestations ever published) | Behind — Lantern key never generated. |
| FLOOR | $5M testnet TVL | **$0** | Behind. |

### REALISTIC targets

REALISTIC adds Stoa (Phase-2 cond. on Trailblazer AI grant), 8 adapters, Code4rena live, Immunefi live, 5-8 cohort partners, $20-50K Curator. **Stoa Phase-2 conditional on grant** — no grant landed yet, but Stoa contract scaffold + Synthetix + Morpho + GMX already deployed. **Scope creep into REALISTIC pre-grants.**

### Silent cuts (FLOOR items missing without tripwire)

- **Cohort partners** at 0 vs Day-90 target of 2 — no tripwire entry.
- **Lantern uptime** at 0% — Lantern was promised "Day 16" per PRD §4.1 — silent slip to whenever key gets generated.
- **Rostrum agents** at 0 vs FLOOR target 10 — at -340 days no problem, but the agents are already on a droplet idle.

---

## JUDGE_ONE_PAGER claim-by-claim

Source: `JUDGE_ONE_PAGER.md`. The doc itself disclaims: "Wiring lands as contracts deploy; the Verifier page shows the live deployment status for each step" — which softens many claims.

| Claim | Verifiable today? | Source | Status |
|---|---|---|---|
| "One wallet posts collateral once and trades across multiple onchain venues with one margin number" | ❌ end-to-end | needs Faucet + Coffer + Plinth + Router + adapter | **NOT YET** — the contract chain exists; user can't run the flow because Faucet is unstocked + adapters not whitelisted |
| "Built on Arbitrum + Robinhood Chain testnet" | ⚠️ partial | RH testnet has no SDK per PRD §1.1 + `human_left.md` #3 | Arbitrum-only today; honestly demoted in PRD §1.1 but the one-pager phrases it as if both are live. **Misleading phrasing.** |
| "Jamie hook: ~55% saved" | ⚠️ simulator output (disclosed) | "simulated Q1-2026 backtest in `services/archive/notebooks/q1-2026-backtest.ipynb`" | One-pager labels this honestly. **OK.** |
| "ResearchAttestation deploys to Sepolia (Month 1 W2)" — verifier in 10s | ⚠️ contract deployed, backtest not published | `deployments/arbitrum_sepolia.json:30-33` confirms `research-attestation` live | Live demo unverifiable until Archive notebook publishes via `ResearchAttestation` — `human_left.md` #23 documents PP-3 baseline-USD gap. **Not 10-second-verifiable today.** |
| "Stylus contracts for Plinth, Vigil, Coffer, Sigil" | ✅ | `deployments/arbitrum_sepolia.json:40-83` | All four live and activated. **OK.** |
| "5-invariant Kani+proptest target in CI" | ⚠️ 3 of 5 today | `LAUNCH_READY.md:331` | One-pager says "target" — honest. Tripwire T4 is Day 270. **Mostly OK.** |
| "Dual-oracle (Chainlink + Pyth) with 50bps tolerance and 60-second freshness" | ✅ contract | `plinth-oracle` deployed at `0x6606…f0b7` | Wired in Plinth constructor per `deployments/arbitrum_sepolia.json:82`. **OK.** |
| "Praetor 3-of-5 multisig + 48h timelock" | ❌ | `AUDIT_USER_FLOWS.md:184-185` finding H — every contract has deployer EOA as admin. PraetorTimelock contract exists but multisig not migrated. | **FAKE IMMUTABILITY violation** per `CLAUDE.md` "No fake immutability" rule. One-pager states present-tense; reality is single-key EOA. |
| "Per-adapter per-block notional cap on Coffer" | ✅ contract surface | Coffer source per `contracts/coffer/src/` | Adapters not whitelisted so untestable end-to-end. |
| "Cohort partner program will list named design partners with live testnet TVL on `cohort.atrium.fi` once partners sign… At Day -7 the partner count is 0; the page renders the live count" | ⚠️ contradiction | `AUDIT_USER_FLOWS.md:38, 163-164` says 6 fake "Built with" partner logos appear on landing | **One-pager honest; landing dishonest.** This is a `.claude/rules/writing.md` violation that contradicts the one-pager. |
| "Open `IPorticoAdapter v1.0` adapter standard, MIT-licensed at buildathon end" | ⏳ pending Jun-24 | n/a | Future commitment, OK. |
| "AI agents are first-class users via `Sigil` mandates + `Postern` session keys; one-click Kill Switch revokes every active delegation in a single batched tx" | ⚠️ contract live, demo dead | `AUDIT_USER_FLOWS.md:99-103` | Kill switch tx works but revokes zero things — no agent has issued. **Half-true.** |
| "On-chain backtest attestation pattern (`ResearchAttestation`) so claims are judge-verifiable in 10 seconds" | ❌ no attestation published | `human_left.md` #23 + per `JUDGE_ONE_PAGER.md:11` itself | Cannot verify in 10 seconds today. |
| Surfaces table: `verify.atrium.fi` (M1 W2), `cohort.atrium.fi` (M7), `lantern.atrium.fi` (M6), `lantern.atrium.fi/sla` (M6), `benchmarks.atrium.fi` (M9) | ❌ no subdomain DNS | `LAUNCH_READY.md:290` — domain not yet claimed | The `verify-n7xoe20z3-pratiikpys-projects.vercel.app` URL serves the app per `DEPLOY_PLAN.md:10`; subdomains promised on the one-pager are vapor today. |
| "Competitive landscape (Cascade, August) does cross-margin within one venue; Atrium nets across venues and across instrument classes" | ⚠️ assertion | no `benchmarks/page.tsx` per `apps/verify/src/app/` ls; `apps/verify/src/app/benchmarks/page.tsx` does exist per grep | Page exists; honest comparison requires live cross-venue example which is not running yet. |

**Bottom line on one-pager**: 3 outright violations (RH "dual" phrasing, multisig fake-immutability, fake trust logos on landing contradicting cohort claim). Most other items are conditional ("once X deploys") and remain technically honest. The one-pager is more conservative than the live site — the live site's marketing landing is the more dishonest surface.

---

## Silent scope cuts (missing tripwire announcements)

Per `.claude/rules/writing.md` "Honesty patterns": "When a scope cut happens, announce it the same day." Format quoted in the rule. Below are cuts that *should* have a tripwire note today.

1. **Roadmap Item M1.1 — Coffer orchestrator → AtriumRouter swap.** Roadmap committed to Option A (Coffer). Reality shipped Option C (Router). `human_left.md:524-526` is the historical note, but no `incidents/` entry or `LAUNCH_READY.md` note explains the architectural change to a reader of the roadmap. **Suggested tripwire:** "Day -6. Committed: Coffer.open_position_via_adapter orchestrator (Option A). Actual: external AtriumRouter contract (Option C). Reason: cyclic init + storage layout concerns in Coffer Stylus contract. Reallocation: 5 remaining adapters need onlyAuthorizedCaller migration in Month 2. Next checkpoint: Day 30."

2. **Roadmap Item M1.1 — adapter integration test count.** Roadmap promised "≥7 tests; each adapter through Coffer's orchestrator end-to-end." Today only Curve has a Router-orchestrated integration test (1 adapter). **Suggested tripwire:** "5 adapter Router tests sliding to Month 2."

3. **Roadmap Item M3 — Tablet UK CGT.** Code shipped pre-Month-3 but is operationally dead behind Vercel SSO + zero trade events. No announcement that "Tablet works in source but is unreachable until X". The roadmap describes it as a Month-3 ship — reality is "shipped to /dev/null".

4. **Praetor multisig**: never deployed as a 3-of-5 Safe. PRD §0 and CLAUDE.md security rules require it. `LAUNCH_READY.md:271` lists it as "required before mainnet; testnet acceptable" — but `.claude/rules/security.md` "Praetor 3 of 5 multisig plus 48h timelock for every parameter change" is unconditional. **Suggested tripwire:** "Multisig migration deferred to Month 5 (Code4rena prep). Risk: every parameter change today is single-key admin path. Mitigation: testnet only, no real funds."

5. **5 Kani invariants in CI**: roadmap Month 5 + PRD G7 + Judge One-Pager. 3 of 5 today per `LAUNCH_READY.md:331`. No tripwire — 7 months until T4 fires, but the badge already shows on Verifier as "Kani CI badge" and reads "pending" (per `AUDIT_USER_FLOWS.md:181-182`) which is itself misleading — 5 proptests pass, formal verification pending. Should be re-labelled.

6. **Cohort partner program**: 0 partners vs Day-90 target 2. Day-180 target 3. No tripwire. Roadmap Month 5 says "Cohort partner #1 — close at least one of the named outreach targets". Outreach has not started visibly. Tripwire-worthy.

7. **Lantern attestation Day-16 commitment**: PRD §4.1 Phase 1 says Lantern by Day 30. `LAUNCH_READY.md:265-266` says key not generated. No announcement that "Lantern slips to whenever the founder generates the signing key".

8. **Day-17 Buildathon submission**: T1 effectively fires today (verifier flow 5/7 steps gated on ops). No T1 announcement in any doc. **Most critical missing tripwire of all.**

---

## Scope creep (in code, not in roadmap)

These are items in the code/contracts that the 12-month roadmap and PRD don't name. Some are valuable; some should be planned-around.

| Item | In roadmap? | Worth it? | Notes |
|---|---|---|---|
| **`plinth-math` extracted contract** (`0xc53d…ddab`) | **NO** | YES — forced by EIP-170 cap, documented in `LAUNCH_READY.md:188-203` | Phase A.7 emergency surgery. Should have been captured in roadmap retroactively as a "Plinth size surgery" sub-task. |
| **`plinth-oracle` extracted contract** (`0x6606…f0b7`) | **NO** | YES — same reason | Same: documented in LAUNCH_READY, not in 12-month roadmap. |
| **`AtriumRouter` contract** | **NO** (roadmap committed to Coffer-orchestrator) | YES (working architecture) | Architectural decision; should be reflected back into roadmap M1.1. |
| **9 venue adapters deployed** (vs FLOOR target 4) | **NO** | MIXED | Over-delivery on count, under-delivery on integration: none whitelisted in PorticoRegistry. Sequencing problem. |
| **Stoa contract scaffold** (`contracts/stoa/`) | NO (Phase-2 conditional on Trailblazer grant) | Premature | Stoa was explicitly grant-conditional per PRD §1.1. Scaffolding it pre-grant is fine; deploying as a stub `0x6d65…b5db` is a half-baked surface that promises options support without the engine. |
| **Synthetix + Morpho + GMX adapters** | NO (Phase-2 grant-conditional) | YES with caveat | Same shape as Stoa — deployed under FLOOR before grant landed. Good for demo breadth; flag in PRD as Phase-2-deliverables-shipped-early. |
| **Faucet contract v1 (deprecated) + v2** | NO (Faucet shipped as planned, not the v1/v2 sequence) | The deprecation is honest | `deployments/arbitrum_sepolia.json:194` keeps the dead v1 contract under `faucet-deprecated-v1`. Good honesty pattern; minor noise. |
| **`/markets` and `/loadtest` Next.js pages** | NO | `/markets` is reasonable scope; `/loadtest` is unclear | Minor. |
| **Mobile app shell** (`desing/Mobile App.html` deployed) | NO (PWA was committed; vanilla-JS shell isn't) | NO | Per `AUDIT_USER_FLOWS.md:129-135` Flow 14 — pretty but non-functional. Mobile design parity gain at the cost of a non-React surface that doesn't run wagmi. **Half-baked addition.** |
| **Codex 10 endpoints** (vs roadmap promise of 8) | NO (over-delivery on count) | YES | Per `audits/month-1-half-baked-audit.md:63`. Aligns with REALISTIC §17 target. |

---

## human_left.md accuracy review

Source: `human_left.md` (35 numbered items, but most truly numbered).

| # | Item | Truly human-only? | Still relevant? | Notes |
|---|---|---|---|---|
| 1 | Full browser-render of `desing/` HTML | ⚠️ debatable | YES | Could be Playwright-driven in headless Chromium with `DecompressionStream` (the rendering uses real Web APIs). "Just open in Chrome" is human-tagged because it's faster, not because it's human-only. |
| 2 | Hardware-wallet multisig signatures | YES | YES | Real human-only by `.claude/rules/security.md`. |
| 3 | RH partnership outreach | YES | YES | |
| 4 | Cohort partner outreach | YES | YES — and overdue per PRD §17 Day-90 target |
| 5 | Stanford Law consult | YES | YES |
| 6 | Brand designer LOI | YES | Optional |
| 7 | 10 demo dress rehearsals | YES | YES — Buildathon imminent; not run yet |
| 8 | Sumsub sandbox setup | YES | YES |
| 9 | Press warm-intros | YES | YES |
| 10 | Mirror/X/Farcaster post | YES | YES |
| 11 | Stylus build on Windows MSVC | **NO longer relevant** | Closed by stylus.Dockerfile; verify on Linux per `LAUNCH_READY.md:175-183` | **Stale — should be removed or marked closed.** Migration succeeded via cargo-stylus 0.10.7. |
| 12 | Migrate Praetor deploy CLI off raw-key | YES (mainnet only) | YES, mainnet-gated |
| 13 | Stylus build environment | **CLOSED** | NO — superseded by stylus.Dockerfile + Docker pipeline | **Stale.** |
| 14 | CI pipeline secrets + branch protection | YES (GitHub admin) | YES |
| 15 | Subgraph deploy | **CLOSED** | NO — `DEPLOY_PLAN.md:15` confirms live | **Stale.** |
| 16 | Vigil keeper bot operational setup | YES | YES — keepers not running, "0/3" honest UI display per design |
| 17 | Codex backend deploy | **PARTIALLY CLOSED** | Codex deployed per `DEPLOY_PLAN.md:11`; but `AUDIT_USER_FLOWS.md:167` says health check fails | Status divergence between LAUNCH_READY + DEPLOY_PLAN + AUDIT_USER_FLOWS — needs reconciliation. |
| 18 | Validator keys (Lantern + HL) | YES | YES |
| 19 | Playwright E2E on Sepolia | YES | YES — gated on items above |
| 20 | Demo backup video | YES | YES — overdue for Buildathon |
| 21 | Subgraph `PosternKeyEvent` aggregation | **debatable** | partially landed per `subgraph.yaml:331` | Can be done by Claude. |
| 22 | Connected-sites cross-tenant scoping | NO — code task | YES |
| 23 | ResearchAttestation off-chain fetch | NO — code task | YES |
| 24 | TradePage venue + leverage state lift | NO — code task | YES |
| 25 | LanternAttestor event extension | NO — code task | YES (contract redeploy though) |
| 26 | Subgraph mapping gaps (9 events) | NO — code task | **PARTIALLY CLOSED** per `subgraph.yaml` now indexing Rostrum + Postern; Plinth's OracleDisagreement + Aqueduct's LinkBalanceLow + PraetorTimelock's EmergencyPaused etc may still be open |
| 27 | Self-host Geist + Instrument Serif fonts | NO — code task | YES |
| 28 | Stylus `unwrap_or(0)` defaults | NO — code task (fixed on-disk, awaits Linux) | YES |
| 29 | Sigil credit-line semantics | NO — code task | **PARTIALLY CLOSED** per `audits/month-2-5-half-baked-audits.md:9` |
| 30 | Praetor CLI lantern publish-now + seed | NO — code task | YES |
| 31 | Adapter orchestration | **CLOSED** | NO | Stale — explicitly marked closed in the file. |
| 32 | `git init` for Atrium repo | **CLOSED** | Repo now `master` branch per git status | **Stale.** Should be removed. |
| 33 | @x402/core version mismatch | YES (CHANGELOG read) | YES |
| 34 | Subgraph mapping tests blocked on Stylus ABI emptiness | YES partially | Mostly mitigated by Linux Docker pipeline | Should be reframed as "low-priority" given the Linux path works. |

**Accuracy summary**: 4 items (11, 13, 15, 32) are formally closed but still in the file — stale. Several items (1, 17, 21, 26, 29, 31) are partially or fully closed but listed as open. About a dozen items are genuinely human-only (2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 18, 20). The file's discipline ("verified three times that no automated path exists") is being respected for new additions but historical entries are not being culled per the roadmap's end-of-month rule.

---

## Cross-doc consistency report

Findings where the same fact is stated differently across canonical docs:

1. **Number of deployed contracts**: `LAUNCH_READY.md:5-6` says "30 contracts deployed". `AUDIT_USER_FLOWS.md:9` agrees. `deployments/arbitrum_sepolia.json` shows **30 entries including the deprecated faucet** — so 29 live + 1 deprecated. Headline counts are loose.

2. **User flow score**: `LAUNCH_READY.md:1-6` headline says "~9 / 15 user flows wired end-to-end (~60%)". `LAUNCH_READY.md:315` per-flow table says "2.5 of 15 = ~17%". `AUDIT_USER_FLOWS.md:11` says "~9 of 15 at contract layer". The headline and the supporting table contradict each other. **The 60% figure is misleading; the underlying table is the truth.**

3. **Codex status**: `DEPLOY_PLAN.md:11` "x402-payable gateway live". `AUDIT_USER_FLOWS.md:167` "DNS failure". `human_left.md:13-31` "@x402/core dep mismatch, tests can't run". Three different stories.

4. **Tablet status**: `DEPLOY_PLAN.md:12` "live, SSO-wall-on (toggle off in dashboard)". `AUDIT_USER_FLOWS.md:113-117` "Tablet not deployed to Vercel". Contradiction — likely AUDIT_USER_FLOWS was written before Tablet was deployed; needs reconciliation.

5. **Adapter count**: `ATRIUM_PRD.md §17 FLOOR target 4 / REALISTIC 8`. Today **9 deployed**. PRD should be updated to reflect over-delivery (or PRD §17 reframed as "venues whitelisted in PorticoRegistry" which is 0 — different metric, would track the real wiring gap).

6. **Verifier walk step count**: `JUDGE_ONE_PAGER.md:47` + `LAUNCH_READY.md:34` say 7-step. `ATRIUM_12_MONTH_ROADMAP.md:70` says "Step 1 through Step 5". `ATRIUM_FULL_FLOW_DESIGN.md:901-921` lists Steps 1-7. 7 is the right number. Roadmap text is stale.

7. **Cohort count**: PRD §17 Day-90 target 2 partners, Day-180 target 3. `LAUNCH_READY.md:336` 0 partners. `JUDGE_ONE_PAGER.md:34` "At Day -7 the partner count is 0". One-pager and LAUNCH_READY agree; PRD §17 timeseries says we should be at 0 today (Day 16 milestone) so honest — but Day-90 is a tripwire risk.

8. **Lantern target date**: PRD §4.1 says "Lantern (Day 30)". `ATRIUM_12_MONTH_ROADMAP.md:113` says "Lantern attestor real hourly cron deploy" in Month 3. `ATRIUM_FULL_FLOW_DESIGN.md` says Month 6. Three different dates for the same milestone.

9. **Stylus migration completion**: `LAUNCH_READY.md:174` "ALL 4 contracts migrated to stylus-sdk 0.10 and compile clean". `human_left.md:11, 13` still list it as the highest-leverage blocker. Stale `human_left` entries.

---

## Demo-readiness for buildathon Verifier walk

The 6-min Verifier walk is the immediate north star. Per `ATRIUM_FULL_FLOW_DESIGN.md:901-921`:

| Step | What it should do | Ready? | Blocker |
|---|---|---|---|
| 1. Deposit USDC | Wallet prompt → Coffer.deposit → tx receipt | **NO** | Faucet unstocked; user has no USDC to deposit |
| 2. Open hedged position | Router.openPosition → Plinth.open_position → adapter.open_position_v11 | **NO** | Adapters not whitelisted in PorticoRegistry; Coffer not approved as caller |
| 3. Trigger margin recompute | Plinth.update_margin via Router | **NO** | Depends on Step 2 succeeding |
| 4. Inject chaos: oracle drift | Per design: "PRAETOR_CHAOS_URL not configured. Chaos agent deploys Month 9." | **HONEST PENDING** | Designed as pending; OK for demo. |
| 5. Trigger liquidation via Vigil | Vigil.queue_liquidation + keeper executes | **NO** | No keepers running; depends on Step 2 |
| 6. Verify balance against PoR | Lantern.latest_root + Merkle proof check | **NO** | Lantern signing key not generated; no attestation ever published |
| 7. Kill switch | PosternKillSwitch.activate | **HALF** | Tx works; revokes zero things because no mandates were ever issued via Sigil from a running agent |

**4 of 7 steps are technically un-runnable end-to-end today.** Per roadmap T1, this means the Buildathon submission should be Loom-only with a public tripwire note. No such note has been written.

### What's mission-critical to fix vs what can slip

**Mission-critical for a real 6-min demo** (ranked by leverage):
1. **Stock Faucet** (5 min, human) — unblocks Steps 1 → 7 cascade.
2. **Whitelist 1 adapter in PorticoRegistry** (multisig call, ~1h with deployer EOA) — unblocks Step 2.
3. **Add deployer/Coffer/Router as approved adapter caller across Coffer + adapters** — unblocks Step 2 → 3 → 5.
4. **Run 1 agent on droplet under a real mandate** — Step 7 actually revokes something. ~2h.
5. **Generate Lantern signing key + run 1 attestation** — Step 6 becomes verifiable. ~30 min after Step 1 produces a balance.
6. **3-of-5 Safe ceremony** — required by `CLAUDE.md` / `.claude/rules/security.md`. **Currently violated.** ~3h with three founders + hardware wallets.

**Can slip without harming demo**:
- Sigil credit-line decrement test coverage (UX-bug, fail-safe)
- Tablet US + DE jurisdictions (Month 9)
- Code4rena audit prep (Month 5)
- Stoa Black-Scholes engine (Phase-2 grant-conditional)
- Curator grants UI (Month 4)
- Mobile app shell wagmi integration (the mockup will look polished in screenshots if the judge doesn't tap)

### Demo backup path

`human_left.md` #20 + `ATRIUM_12_MONTH_ROADMAP.md:240` T1 require: pre-recorded Loom + QR + mirror. **None recorded today.** With Buildathon at Day 17 (16 days out per roadmap calendar — adjusted for today's Day 0 = 2026-05-24), recording the Loom is the single highest-leverage demo-protection task.

---

## Summary

- **Ahead of schedule on contracts**: 30 deployed, 22 Sourcify-verified, Stylus migration complete, Aqueduct trio + Router + Rostrum + 9 adapters all live. Big over-delivery on M1.1, M1.2, M2.2, M2.3.
- **Behind on operations**: Faucet unstocked, Lantern key ungenerated, agents idle, keepers offline, Codex deploy partial, Tablet behind SSO, Praetor multisig nonexistent, cohort partners at 0, no domain claimed, no Loom backup, no chaos rehearsals.
- **Silent cuts**: 8 specific items (above) lack tripwire announcements — most critically, the buildathon T1 itself. Three roadmap commitments were silently re-architected (Coffer orchestrator → Router; venue-count over-delivered without test parity; Phase-2 adapter contracts deployed pre-grant).
- **Stale**: `human_left.md` carries ~7 closed items (#1, #11, #13, #15, #31, #32, partial #17/#21/#26/#29). LAUNCH_READY headline "9/15 (60%)" contradicts its own table showing 2.5/15 (17%).
- **Scope creep**: PlinthMath/PlinthOracle split (forced, justified, undocumented in roadmap); Stoa + Synthetix + Morpho + GMX deployed pre-grant (REALISTIC scope shipped under FLOOR); vanilla-JS mobile shell that doesn't run wagmi (visual win, functional dead-end).
- **Demo-readiness**: 4 of 7 Verifier steps un-runnable end-to-end. Three of those (Steps 1, 2, 6) can be fixed in ~6 hours of focused work + ~1 hour of human-only steps. After that, the Buildathon demo is live. Without it, T1 fires and the submission is Loom-only.

**Single most important pre-Buildathon action**: write the tripwire note for T1 today, then choose: (a) burn the next 7 hours wiring Faucet → adapter whitelist → 1 agent → 1 Lantern attestation, hitting a real 6/7 demo by Day 10, or (b) ship Loom-only and submit a documented partial system. The roadmap's `CLAUDE.md` rule "best product option, no compromise" pushes hard toward (a).
