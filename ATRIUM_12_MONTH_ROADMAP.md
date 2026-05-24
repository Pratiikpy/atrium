# ATRIUM — 12-month testnet build roadmap

**Status:** Living plan — v0.1, dated 2026-05-19.
**Source of truth:** `ATRIUM_PRD.md` v0.15 + `TECH_DESIGN.md` v1.1.
**Calendar anchor:** Day 1 = 2026-05-25. Day 365 = 2027-05-24. Buildathon submission = Day 17 (2026-06-10).
**Working assumption:** F1 (smart contracts, this seat) + F2 (frontend) + F3 (research/BD/ops). FLOOR budget (~$200/year). All cuts visible.

---

## How this document is used

The earlier work pattern (test-coverage sweep fires SSSS → EEEEE) caught **10 NEW bugs** and added **41 asserting tests** but drifted from the actual product build. This roadmap fixes the scope problem.

**Each month is a discrete checkpoint.** End-of-month checklist:

1. **What shipped vs the PRD line for this month** (honest delta).
2. **Half-baked sweep**: every feature touched gets the "is this actually wired, or is the inner machinery orphaned?" check. (Item #31 in `human_left.md` is the canonical example — adapter contracts existed for weeks before anyone noticed they were never called.)
3. **Design parity sweep**: any visible surface gets compared against `desing/Atrium.html` + `desing/Atrium App.standalone.html`. Tokens, copy, motion, micro-interactions.
4. **Tripwire check** (PRD §26.3): is any committed scope sliding? Announce same day if so.
5. **`human_left.md` cull**: items resolved get removed; new deferrals get logged honestly.

**Month 12 closer:** parallel sub-agent audits across the 18 subsystems (Plinth, Vigil, Stoa, Portico, Aqueduct, Sigil, Rostrum, Codex, Scribe, Archive, Lantern, Coffer, Edict, Tablet, Praetor, Cohort, Curator, Postern). One agent per subsystem. Each agent reports half-baked items, scope drift, and demo-readiness. Findings rolled into a single final pre-launch fix pass.

---

## Current baseline (Day 0 — 2026-05-19, six days pre-Buildathon)

What's actually on disk, audited by the test-coverage sweep:

**Contracts (all compile via `forge build`):**
- Solidity: PraetorTimelock, Aqueduct, AqueductReceiver, AqueductClaimback, Edict, LanternAttestor, PorticoRegistry, PosternKillSwitch, PosternKeyRegistry, ResearchAttestation, Rostrum (11)
- Stylus (Rust, build blocked on Windows MSVC per `human_left.md` #11; Linux unblock required): Plinth, Vigil, Coffer, Sigil (4)
- Adapters: AaveHorizonAdapter v1.0, AaveHorizonAdapterV11, CurveAdapter, PendleV2Adapter, PolymarketAdapter, TradeXyzAdapter, HyperliquidHybridAdapter (7)

**Tests:** 358 Foundry tests passing across 19 suites. Audit-pattern completeness now structural-class-complete (NNNN-1 zero checks + F-32 timelock-gates + G-8 EIP-712 binding + F-11 reentrancy + MMM-6 kill-switch resilience).

**Services:**
- `services/codex/` — Hono on Cloudflare Workers, x402-payable, 5 endpoints implemented + 3 stubs.
- `services/lantern-attestor/` — exists, hourly Merkle root publisher; not yet deployed.
- `services/archive/` — Python backtest scaffold; one notebook.
- `services/praetor-cli/` — 5 of 7 commands wired; `lantern publish-now` + `seed` are stubs (item #30).
- `services/tablet/` — UK CGT only; US + DE deferred.

**Subgraph:** schema + 11 data sources mapped; matchstick tests scaffold absent.

**Frontend:** `apps/verify/` — Next.js 15 app exists; landing + verifier flows scaffolded; design tokens partially extracted from HTML (`human_left.md` #1 — full React-bundle decode awaits a real browser).

**Deferrals (`human_left.md`):** 31 items. The critical one is **#31 — adapter orchestration layer missing** (Wave-EEEE finding). Plinth.open_position records margin in its own storage but never calls any adapter; the 6 venue adapters are orphaned. **This breaks PRD Verifier-Mode Step 2 entirely.** First Month-1 priority.

**What's NOT on disk yet (clear gaps vs PRD):**
- End-to-end "open hedged position" path (item #31)
- Stoa options engine (Phase-2 conditional per PRD)
- Tablet US + DE exports
- Curator grants surface (UI + multisig flow)
- 3 of 8 Codex endpoints
- Subgraph deploy to The Graph hosted service
- Stylus build pipeline on Linux (blocks every Stylus-touching test)
- Sumsub sandbox integration (`human_left.md` #8)
- 5 Kani+proptest invariants in CI (G7 of TDD §2 — exists as goal, no CI badge yet)
- PWA install on Postern passkey login flow
- 10 demo rehearsals (`human_left.md` #7)
- Cohort + Curator dashboards rendering live Scribe data

---

## Month-by-month plan

### Month 1 (Day 1–30 · 2026-05-25 → 2026-06-23) — Verifier path lives end-to-end

**Theme:** make `verify.atrium.fi` Step 1 through Step 5 actually work on Arbitrum Sepolia.

Critical work:

1. **Adapter orchestration (item #31)** — Decision: **Option A (Coffer orchestrator)**.
   - Add `Coffer.open_position_via_adapter(adapter_slug, instrument_id, notional, sigils) → (plinth_position_id, venue_position_id)`.
   - Mirror `close_position_via_adapter`.
   - Foundry integration tests: each adapter through Coffer's orchestrator end-to-end. ≥7 tests.
   - Wire Verifier-Mode Step 2 to this single entry point.
2. **Stylus build unblock** — Linux container (Docker) for `cargo stylus check` until WSL/native Linux deploy seat lands. F1 commits the Dockerfile; CI runs Stylus checks per push.
3. **Subgraph deploy** to The Graph hosted service. Replace local-only handlers with deployed endpoint. `apps/verify/` reads from deployed subgraph.
4. **Codex remaining 3 endpoints** — `/correlations`, `/positions/aggregated`, `/agents/intent-validation`. Bring catalog from 5 to 8.
5. **Buildathon submission package (Day 17)** — README that judge reads, working demo URL, deployment addresses, video backup (`human_left.md` #20).

End-of-month sweep:
- Half-baked: every `vm.prank(coffer); adapter.open_position(...)` test must have a sibling test that goes through `coffer.open_position_via_adapter` and exercises the full margin → adapter → venue chain.
- Design parity: landing page matches `desing/Atrium.html` (hero, Plinth section, Aqueduct section, Sigil dark section, Lantern, live stats, subsystems, architecture, cohort, closing CTA — 10 sections in order).
- Tripwire: if Buildathon submission slips Day 17, announce same day with a public note.

### Month 2 (Day 31–60) — Sigil mandate lifecycle + Postern session keys live

**Theme:** AI-agent path end-to-end. Item #29 (Sigil credit-line cumulative-vs-open semantics) decided + landed.

Critical work:

1. **Sigil credit-line decrement** (`human_left.md` #29) — add `agent` field to Plinth's `Position` struct; Plinth.close_position calls Sigil.record_close. Cross-contract test ride.
2. **Postern passkey login** — Coinbase Smart Wallet + Pimlico bundler (free testnet) integrated into `apps/verify/`. PWA install button on mobile.
3. **Postern session-key issuance + revocation** through PosternKeyRegistry. Kill Switch demo flow on UI.
4. **Subgraph schema** — `PosternKeyEvent` entity (`human_left.md` #21). Replace null `activeSessionKeys` in Codex `/agents/summary` with real count.

End-of-month sweep:
- Half-baked: every Sigil mandate that opens a position must have a path to close it AND decrement Sigil's open_notional. Single-write asymmetries are the audit-trail-drift class we caught 8× during the test-coverage sweep.
- Design parity: Postern login modal matches the prototype passkey flow (no third-party crypto wallet branding; "Sign in with Atrium" framing).

### Month 3 (Day 61–90) — Aqueduct round-trip + Tablet UK CGT

**Theme:** cross-chain demonstrable; first tax-export shipped.

Critical work:

1. **Aqueduct round-trip** — Send collateral Arbitrum Sepolia → Ethereum Sepolia, receive, ack, settle. Both directions verified via Arbiscan + Etherscan tx hashes. CCIP testnet (free).
2. **Tablet UK CGT** — pull positions from Scribe, compute pooling per HMRC rules, generate CSV download. F1 + F3 share-account check the math against a known portfolio.
3. **Edict + Sumsub sandbox wiring** (`human_left.md` #8). Tier assignment via Sumsub callback into Codex.
4. **Lantern attestor** real hourly cron deploy. Verifier Mode Step 4 reads real `latest_root`.

End-of-month sweep:
- Half-baked: Aqueduct's claim-back path tests already pinned (UUUU). Add E2E test: send → wait expiry → claim-back → verify USDC restored.
- Design parity: `/tax` page matches prototype rhythm (export-as-CSV button, per-jurisdiction tabs).

### Month 4 (Day 91–120) — Rostrum MVP + Curator grants surface

**Theme:** agent leaderboard + community-funded adapters become visible.

Critical work:

1. **Rostrum MVP** — Follow/unfollow flow, leaderboard from Scribe, copy-trade execution path (DDD-4 reentrancy + WWW-1 mirror-notional already covered in tests). UI built from prototype `Rostrum` section.
2. **Curator grants v1** — `Curator.sol` contract (multisig-gated grant disbursement), `apps/verify/curator/` page rendering rounds. ResearchAttestation-style on-chain commitments.
3. **Praetor CLI** — `lantern publish-now` + `seed` (`human_left.md` #30) actually implemented now that Lantern attestor is deployed.

End-of-month sweep:
- Half-baked: copy-trading metrics on the leaderboard must come from Scribe queries, never config files. Apply VVV-1 lens (parseFloat-on-formatted-string) to every metric render.

### Month 5 (Day 121–150) — Code4rena audit prep + initial public review

**Theme:** harden for the audit contest while it's open.

Critical work:

1. **Code4rena public contest** — submission pack (PRD §28 honesty docs + AUDIT_FINDINGS.md history + spec + invariants). $20K bounty pool per PRD §1.2.
2. **5 Kani+proptest invariants in CI** (TDD §14.2): solvency, oracle freshness, mandate expiry, ERC-4626 share monotonicity, no-reentrancy. CI badge in README links to proof run.
3. **Cohort partner #1** — close at least one of the named outreach targets. Cohort Status Page renders 1/5 honestly; no inflation.

End-of-month sweep:
- Sub-agent reviewer pass: 4 parallel agents review (a) contract security, (b) frontend a11y, (c) copy honesty, (d) deployment runbook.

### Month 6 (Day 151–180) — Phase-1 completion checkpoint

**Theme:** PRD §17 Day-180 metrics met. FLOOR scenario is fully provable.

Day-180 PRD targets:
- 13 subsystems live (Stoa deferred per Phase-2 conditional)
- 4 Portico adapters real (Hyperliquid HIP-3, Pendle, Trade.xyz, Curve) — Aave conditional on Aave Horizon hitting Sepolia
- Codex 5 paid endpoints generating ~2K queries/month
- Cohort partners: 3 honest (out of 5-8 target by Day 365)
- Testnet TVL: $2M (per PRD §17 — testnet collateral, not real-money TVL)

**Mid-year half-baked audit** — full sweep of all 18 subsystems against PRD spec. Honest "this part is done, this part is missing" grid published.

### Month 7 (Day 181–210) — Phase-2 unlock (conditional on grants)

**Theme:** if Trailblazer AI / Stylus Sprint lands, Stoa + GMX adapter start. Otherwise polish Phase-1.

Branch:
- **Grant scenario:** Stoa skeleton (Black-Scholes pricing + Greeks via Plinth-style Stylus math). GMX adapter v0 (read-only).
- **FLOOR scenario:** mobile PWA polish — install flow, offline-friendly verifier page, deep-link to specific tx hashes for sharing on social.

### Month 8 (Day 211–240) — Phase-2 expansion or polish-pass

Branch:
- **Grant:** Synthetix V3 adapter v0; Codex endpoints 9–12 if engineering capacity allows.
- **FLOOR:** Rostrum advanced features (agent attestations, slashing appeals) — Stylus Sprint deferred items but partially implementable on FLOOR.

### Month 9 (Day 241–270) — Tablet US + DE jurisdictions

**Theme:** finish the 3-jurisdiction tax surface promised in PRD §17.

Critical work:
- **US Form 8949** — short/long-term capital gains classification, wash-sale rule (deferred to Year-2 if too costly).
- **DE FIFO** — first-in-first-out cost basis per German tax law.
- **Tablet** generates 3 separate exports from a single position history.

### Month 10 (Day 271–300) — Code4rena audit findings remediation

**Theme:** fix every issue from the public contest. Re-run Kani + proptest after each fix.

Critical work:
- Issue triage: HIGH within 7 days, MEDIUM within 14, LOW within 28.
- Regression test added for every reported issue (the SSSS lens applied properly).
- Updated `AUDIT_FINDINGS.md` with public contest findings inline.

### Month 11 (Day 301–330) — Demo rehearsal + tooling polish

**Theme:** 10 dress rehearsals per PRD §26.2 + `human_left.md` #7. Tooling that makes a fresh clone bootable in ≤90s (`make demo`).

Critical work:
- F3 schedules 10 timed rehearsals with random Chaos-Mode fault injection.
- `make demo` script — `git clone` → working local stack in ≤90s.
- Demo backup plan (`human_left.md` #20) — Loom + QR mirror confirmed working when wifi drops.

### Month 12 (Day 331–365) — Parallel sub-agent audits + testnet launch

**Theme:** the big finish. Parallel sub-agent area audits, single final fix pass, public testnet launch announcement.

**Sub-agent audit plan** (one per subsystem):

| # | Sub-agent | Subsystem | Scope |
|---|---|---|---|
| 1 | code-reviewer | Plinth | SPAN-math correctness; Stylus storage layout; gas budget vs TDD §G2 |
| 2 | code-reviewer | Vigil | Liquidation queue ordering; NMS adherence |
| 3 | code-reviewer | Portico framework | IPorticoAdapter v1.0 spec compliance + 7 adapters |
| 4 | code-reviewer | Aqueduct + Receiver + Claimback | CCIP integration; double-spend defense; replay protection |
| 5 | code-reviewer | Sigil + Postern | EIP-712 schema; session-key lifecycle; kill switch |
| 6 | code-reviewer | Rostrum | Copy-trade math; reentrancy guard; reputation cache |
| 7 | security-reviewer | Coffer | ERC-4626 invariants; adapter-pull authz; transfer-fail handling |
| 8 | code-reviewer | Edict | Tier ladder; Sumsub callback flow; jurisdictional gating |
| 9 | code-reviewer | LanternAttestor + ResearchAttestation | Merkle proof verifier; backtest commitment |
| 10 | code-reviewer | PraetorTimelock | Schedule/execute/cancel; EOA-target rejection |
| 11 | code-reviewer | PorticoRegistry | Bytecode-hash pinning; venue lifecycle |
| 12 | e2e-runner | Verifier Mode | All 5 PRD journeys on deployed Sepolia |
| 13 | code-reviewer | Codex | 8 endpoints; x402 payment; HMAC signing; rate limits |
| 14 | code-reviewer | Scribe (subgraph) | Schema completeness; handler coverage |
| 15 | code-reviewer | Archive (Python) | Backtest reproducibility; seed pinning; data-source attestation |
| 16 | code-reviewer | Tablet | UK + US + DE export correctness vs hand-calculated reference portfolio |
| 17 | code-reviewer | Praetor CLI | All commands wired (no stubs); cast-calldata format |
| 18 | code-reviewer | apps/verify/ | Design parity vs `desing/`; a11y; mobile responsive; copy follows `writing.md` |

Each agent writes findings to `audits/month12/<subsystem>.md`. Findings rolled into a single fix wave Day 360-365.

**Day 365 testnet launch announcement** — public note on `atrium.fi`, social posts, judge-facing summary, mainnet roadmap (Appendix B per PRD §0).

---

## Tripwires (PRD §26.3 format)

When a committed scope is missed, the format is:

> **Tripwire fired Day N.** Committed: \<thing\>. Actual: \<thing\>. Reason: \<cause\>. Reallocation: \<what we're cutting or sliding\>. Next checkpoint: Day N+30.

Standing tripwires for this roadmap:

- **T1 (Day 17 — Buildathon submission):** if verifier flow Steps 1-5 aren't end-to-end on Sepolia, **submit a Loom-only entry** (no live demo) and announce the missing path same day.
- **T2 (Day 90 — Aqueduct round-trip):** if CCIP testnet round-trip doesn't complete within 30 min per TDD G5, defer to Month 4 and announce.
- **T3 (Day 180 — Phase-1 checkpoint):** if fewer than 13 subsystems are live + 3 adapters real, FLOOR scenario isn't met. Announce + recut Phase-2.
- **T4 (Day 270 — Code4rena ready):** if Kani + proptest proofs aren't green on 5 invariants, skip the public audit contest until they are; don't ship into a contest with broken proofs.
- **T5 (Day 330 — 10 rehearsals):** if F1/F2/F3 haven't run all 10 dress runs, defer testnet launch by however long it takes to finish them.

---

## What "complete professionalism" means here

CLAUDE.md is explicit: best product option always, honesty over hype, free-tier as design constraint, no fake immutability, tripwires beat silent slips. The 12-month roadmap implements these:

- Every shipped feature carries an asserting test that would fail on regression (SSSS lens, now applied to feature delivery not just bug closures).
- Every "live" number renders from on-chain data, never inflated (PRD Tenet 1).
- Every external library cited is verified via `resources/` (PRD Tenet 2).
- Every scope cut surfaces same-day via the tripwire format.
- Sub-agent audits at Month 12 are independent reads — they're not allowed to see this roadmap or `AUDIT_FINDINGS.md` until after writing their finding.

---

## Audit-trail-drift defense

The test-coverage sweep methodology (Waves SSSS–EEEEE) generated 10 NEW bug catches in 12 fires by applying sibling-comparison + pattern-completeness lenses. **These lenses keep running throughout the 12 months** as the end-of-month half-baked sweep:

1. **Closure-needs-test (SSSS)** — every PR adding a feature also adds an asserting test.
2. **`/*param*/` mock-level drift (VVVV)** — no mock function may drop an argument that production code reads.
3. **Audit-pattern by name (BBBBB)** — every contract is graded against the named patterns (DDD-5 zero-checks, F-32 timelock, F-11 reentrancy, G-8 EIP-712).
4. **Event-emit completeness (CCCCC)** — every state-changing setter emits.
5. **Sibling-comparison (DDDDD, EEEEE)** — every contract is read against its closest sibling; the diff is where the bug hides.

These lenses run at every monthly checkpoint and at the Month-12 sub-agent audits.

---

## Open questions feeding into Year-2 plan (Appendix B placeholder)

- Mainnet flip gate: when do we trigger? (PRD says Year-2; this roadmap commits Year-1 testnet only.)
- Token launch decision: deferred per PRD §19 #1 (decision by Day 180).
- Native iOS/Android: PWA is Year-1 sufficient; native gated on funding (Year-2).
- Multi-region: single EU/London on Vercel free tier suffices for FLOOR; multi-region is Year-2.

---

**This roadmap supersedes the cron-loop test-coverage sweep pattern. The lenses from those sweeps carry forward; the scope does not.**
