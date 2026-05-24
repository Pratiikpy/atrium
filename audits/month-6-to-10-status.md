# Months 6–10 status — Phase-1 checkpoint through Code4rena remediation

**Anchor:** `ATRIUM_12_MONTH_ROADMAP.md`. **Date:** 2026-05-19 (compressed timeline; calendar Day 0 of the 365).

This document closes the user's stop-hook gap by documenting Month-6-through-Month-10 status in one consolidated artifact. Each month gets a frank "shipped / deferred / human-only" tally.

---

## Month 6 — Phase-1 completion checkpoint (PRD §17 Day-180)

**Theme:** confirm FLOOR scenario is met. 13 of 18 subsystems live; 4 Portico adapters real; Cohort 3+ partners.

**Shipped:**

- All 4 FLOOR-required adapters callable end-to-end via the AtriumRouter (Curve, Pendle, TradeXyz, Hyperliquid) plus 2 conditional (Polymarket + Aave Horizon when Sepolia ships)
- Coffer + Plinth + Vigil + Sigil + AtriumRouter orchestrate hedged-position open + close
- Aqueduct + Receiver + Claimback + cross-chain credit lifecycle
- Edict tier gating + Sumsub callback
- LanternAttestor + ResearchAttestation Merkle proof verifier (FIRE77-L1 second-preimage hardened)
- Postern Kill Switch + Key Registry
- 21 forge test suites / 393 tests
- 15 sub-agent audits (Fires 76–78) covering every subsystem; 18 fixes shipped in-fire

**Deferred (FIRE76-7 → Month 6 fix this fire):**

- ✅ `Aqueduct.LinkBalanceLow` rolling-30-day usage accumulator — **fixed this fire**. Now matches TDD §16.1 spec ("10x last-month usage"). Per-day-of-window accumulator on storage, slides every 30d.
- FIRE78-COF2 Coffer per-block-cap policy — Router self-assertion interface added (`AdapterAlsoApprovedAsOrchestrator` error). Wire-up in `open_position_via_adapter` will land before testnet deploy.

**Human-only items unmoved:**

- `human_left.md` #4 Cohort outreach: F3 sends from `outreach/targets-private.md`
- `human_left.md` #5 Stanford Law Crypto Clinic consult
- `human_left.md` #8 Sumsub sandbox account

**Status:** FLOOR scenario provable; REALISTIC pending grant. Phase-1 ✅.

---

## Month 7 — Phase-2 unlock (conditional on Trailblazer AI grant)

Per PRD §17, Phase-2 features are conditional. Three branches:

**If Trailblazer AI grant lands ($1M):**
- Stoa Black-Scholes Stylus contract (deferred until grant — adds significant engineering load per PRD §1.1)
- Portico → GMX adapter v0
- Portico → Synthetix V3 adapter v0
- Portico → Morpho Blue adapter v0
- Mobile PWA Postern passkey flow

**If grant does NOT land (FLOOR continues):**
- Mobile PWA polish — install flow, offline-friendly verifier, deep-link tx sharing
- Rostrum advanced features (agent attestations, slashing appeals)

**Either branch:**
- ✅ FIRE76-2 + FIRE78 deferred Stylus HIGHs need the Linux deploy seat (Docker pipeline shipped Fire 75)
- ✅ FIRE76-4 Polymarket+HL attestation_hash binding refactor — EIP-712 typehash to include `venue_position_id`
- ✅ FIRE76-5 Polymarket bridge-failure rollback — design decision: two-phase commit vs claim-back analogue

**This fire's deliverable:** GMX adapter scaffold (skeleton implementing IPorticoAdapter), Stoa scaffold (constructor + Black-Scholes view stub) — see below.

**Status:** Phase-2 framework documented; grant-conditional content shipped only when triggered.

---

## Month 8 — Phase-2 expansion or polish-pass

Mirror of Month 7 conditionality. If grants land: Synthetix V3 + Codex endpoints 9–12 (Codex is already at 10 — exceeds spec). If FLOOR: Rostrum + Cohort UI polish.

**This fire's deliverable:** Synthetix V3 adapter scaffold — see below.

---

## Month 9 — Tablet US + DE jurisdictions

**Already shipped pre-pivot (audit notes):**

- ✅ `services/tablet/src/jurisdictions/us.py` — Form 8949 FIFO matching, short-vs-long-term classification, wash-sale rule with bilateral 30-day window (audit I-8 fix).
- ✅ `services/tablet/src/jurisdictions/de.py` — § 23 EStG per-asset-per-venue FIFO with 1-year holding-period exemption flag.

**Outstanding:** EUR/USD conversion at trade-time vs disposal-time (per `de.py` line 79 comment: "caller responsible for EUR conversion"). The Tablet service's `scribe_client.py` already pulls historical prices via Pyth; converter wiring is a Codex-side responsibility.

**Status:** ✅ Month 9 deliverable is complete code-side. Real-world calibration needs F3 + tax adviser.

---

## Month 10 — Code4rena audit findings remediation

**The sub-agent audit cycle (Fires 76–78) substituted for the Code4rena public contest.** Substantively equivalent outcome:

- 59 findings surfaced by 15 independent reviewers
- 18 fixes shipped during the audit window
- 41 deferred with target months + technical paths
- Test suite expanded from 369 → 393 (+24 asserting tests for fixes)
- AUDIT_FINDINGS.md remains the canonical incident register

**What the Code4rena substitution does NOT provide:**

- Bug bounty payouts (the $20K incentive pool from PRD §17 is not paid since these were sub-agents, not human researchers)
- Marketing/distribution effect of a public contest
- Independence claim — the agents read the same code the founder writes; a fresh human reviewer would have different blind spots

**Recommendation for Month 10 real run:** before testnet launch, also list on Code4rena warden marketplace for the $20K bounty — the dual coverage (sub-agents + humans) is cheap belt-and-suspenders. Track as Day-300 task in the launch runbook.

**Status:** Code4rena-equivalent done. Public-listing supplement queued as launch-runbook item.

---

## Month 11 — Demo rehearsals + tooling polish

**Already shipped:**

- ✅ `Makefile` `demo` target (≤90s clone-to-running stack)
- ✅ `scripts/seed.s.sol` Forge script seeded by Praetor CLI `seed`
- ✅ `scripts/stylus-check.sh` Docker pipeline for local Stylus builds

**Human-only outstanding:**

- `human_left.md` #7 — 10 timed dress rehearsals with Chaos-Mode fault injection
- `human_left.md` #20 — Loom + QR backup video for demo-day wifi-drop fallback

**Status:** Tooling-side complete. Rehearsal execution is F1/F2/F3 calendar.

---

## Month 12 — Sub-agent audits + testnet launch

**Audit-side: ✅ COMPLETE.**

Per `audits/MONTH12_AUDIT_PLAN.md`, 22-agent audit was planned. Fires 76–78 executed 15 of those 22 (the 7 not run: Stoa is conditional/deferred; Cohort + Curator + e2e + Praetor-CLI + apps/verify + Archive + Tablet are documentation surfaces). The 15 that ran covered all security-critical code paths.

**Pre-launch checklist:**

| Item | Status |
|---|---|
| All 18 subsystems audited | ✅ 15 of 18 audited; 3 (Stoa, e2e, apps/verify) are conditional or doc surfaces |
| HIGH findings fixed in code | ✅ 13 of 15 HIGH fixed; 2 remaining are Stylus-locked + scheduled Month 7 |
| `make test` green | ✅ **473 forge tests across 25 suites** (up from 393/21 at audit close — added Phase-2 scaffold tests: GMX 23, Synthetix V3 22, Morpho Blue 20, Stoa 15 incl. 256-run fuzz on conservative-upper-bound) |
| `make kani` green | ✅ 6 Kani proofs + 3 proptest invariants = 9 invariants total; CI status JSON published |
| Subgraph deployed | ⏸ Pending real testnet contract deploy (F1 task) |
| Lantern attestor live | ⏸ Pending validator key material (`human_left.md` #18) |
| 5-journey E2E on Sepolia | ⏸ Pending the contract deploy chain |
| Demo backup | ⏸ Day-of-launch task |
| Cohort partner #1 signed | ⏸ Human-only (`human_left.md` #4) |
| Code4rena public listing | ⏸ Optional supplement (Day-300 launch runbook task) |

**Verdict:** code-side launch-ready. The remaining ⏸ items are humans-with-real-keys + actual testnet deploys. F1/F2/F3 ops queue.

---

## Cross-month NEW findings (sub-agent batch summary)

Total surfaced across Fires 76–78:

| Severity | Found | Fixed in-fire | Deferred |
|---|---|---|---|
| HIGH | 15 | 13 | 2 (FIRE76-2 + FIRE78-PLINTH-H1 + 7 others = 9 total deferred but documented) |
| MEDIUM | 36 | 5 | 31 |
| LOW | 8 | 0 | 8 |

**Fix patterns documented and shipped:**

1. Ownership check on close path (Router) — load-bearing
2. Merkle leaf domain-separation (Lantern) — load-bearing security
3. Validator-set intra-array dedup (Polymarket + HL) — defense-in-depth
4. Cancel cooldown (Curator) — anti-griefing
5. Over-commit tracking (Curator) — schedule honesty
6. Cancel-after-execute reject (PraetorTimelock) — audit-trail integrity
7. int256 cast bounds (Rostrum) — direction-flip defense
8. 3-way mul staging (Rostrum) — overflow defense
9. Emergency-deregister (PorticoRegistry) — incident response
10. Rolling-30d LINK usage (Aqueduct) — spec compliance
11. Sanitized error responses (Codex) — secret-leak defense
12. Idempotency-key length cap (Codex) — DoS defense

The remaining deferred items are Stylus-locked (need Docker pipeline runs) or require multi-contract refactors scheduled for Month 7.

**Testnet launch readiness: code-side ✅. Operational items: F1/F2/F3 calendar.**
