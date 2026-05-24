# Month 2-5 half-baked audits (catch-up)

**Date:** 2026-05-19 — written during Fire 78 to fill the gap noted by the user's stop-hook feedback. Each month's audit is brief because Months 2–5 shipped fewer artifacts than Month 1, but every one of those artifacts gets the same five-lens sweep (works end-to-end / event-emit completeness / failure-path tests / constructor zero-checks / sibling-comparison).

---

## Month 2 — Sigil mandate lifecycle + Postern indexing

**What shipped:** Sigil `record_close(agent, amount)` + `SigilOpenNotionalDecremented` event; `PosternKeyEvent`/`PosternSessionKey` subgraph entities + 3 handlers; `PosternKeyRegistry` data source wired in manifest; ABI exported.

**Five-lens sweep:**

| Lens | Result |
|---|---|
| End-to-end | ⚠️ Sigil source change ships but Stylus build is locally blocked. CI ubuntu pipeline validates syntax. Integration test from Plinth.close_position → Sigil.record_close requires Stylus runtime — deferred to Linux build seat. |
| Event-emit | ✅ `SigilOpenNotionalDecremented(agent, previous, next, amount)` declared in `sol!` macro at `sigil/src/lib.rs:31-36`. |
| Failure-path | ❌ No asserting test pinned (Stylus-blocked). When the Linux pipeline runs, the test set should cover: (a) non-Plinth caller rejected, (b) saturating-sub at zero, (c) event payload correctness. Tracked. |
| Constructor zero-checks | ✅ pre-existing — Sigil constructor zero-checked since DDD-5 sweep. |
| Sibling-comparison | ✅ The pattern matches Plinth's own `is_updating` cross-contract authorization pattern. |

**Half-baked finding M2-1:** Sigil.record_close has no Foundry test because Stylus-blocked locally. Add a Foundry mock-Stylus test that exercises the access control via deployed-bytecode-replay against the running ubuntu CI, OR mark the cross-contract test as a Year-2 deliverable. **Action:** logged as work for the Linux deploy seat.

**Outstanding from FIRE76 sub-agent audit:** none touching Month 2 artifacts.

---

## Month 3 — Aqueduct + Tablet UK CGT

**What shipped:** Tablet UK CGT was already shipped pre-pivot (audit I-7 forward-looking BnB fix already landed). Aqueduct event-emit completeness (CCCCC-1 setClaimbackRegistry, CCCCC-2 depositLink). Aqueduct DDDD-1 expires_at minimum window.

**Five-lens sweep:**

| Lens | Result |
|---|---|
| End-to-end | ✅ CCIP send → ack → settle pinned by 6 new tests (Wave-SSSS). claim_back + depositLink + GGG-1/-1b pinned by 7 new tests (Wave-UUUU). |
| Event-emit | ✅ All 3 timelock-gated setters emit. setClaimbackRegistry captures `previous` for rotation chain. |
| Failure-path | ✅ test_claimBack_revertsOnTransferReturnsFalse + test_depositLink_revertsOnTransferFromReturnsFalse pin both. |
| Constructor zero-checks | ✅ Aqueduct + AqueductReceiver + AqueductClaimback all covered (NNNN-1 + Wave-TTTT). |
| Sibling-comparison | ✅ vs AqueductReceiver — GGG-2 fix mirrored on the dest side. |

**Half-baked finding M3-1:** **FIRE76 sub-agent caught two unresolved findings on Aqueduct** (FIRE76-7 `LinkBalanceLow` threshold spec gap; FIRE76-10 claim_back vs delayed CCIP delivery race). Both deferred to Month 6/7 per `docs/AUDIT_FINDINGS.md` Fire 76 entry.

**Half-baked finding M3-2:** Tablet UK CGT exporter exists; US + DE jurisdictions deferred to Month 9 per roadmap. No regression risk.

**Half-baked finding M3-3:** Edict + Sumsub sandbox wiring (`human_left.md` #8) — pending human dashboard onboarding.

---

## Month 4 — Rostrum MVP + Curator

**What shipped:** Curator.sol (20-line orchestrator pattern + 18 tests + FIRE76-6/8/9 fixes); Curator's fund() + cancel-cooldown.

**Five-lens sweep:**

| Lens | Result |
|---|---|
| End-to-end | ✅ Curator: 22 tests cover lifecycle from fund → createGrant → claim/cancel. Rostrum existing 25 tests cover follow + mirror + deboost. |
| Event-emit | ✅ Curator: GrantCreated/Claimed/Cancelled/FundsReceived. Rostrum: ReputationUpdated emit added Wave-DDDDD-5. |
| Failure-path | ✅ Curator: transfer-fail revert + insufficient-balance + over-commit + cancel-cooldown. Rostrum: DDD-4 reentrancy + DDDDD-1 follower clearing. |
| Constructor zero-checks | ✅ Curator (DDD-5 pattern); Rostrum (DDD-5 pattern from Wave-DDD). |
| Sibling-comparison | ✅ Curator inherits the ResearchAttestation timelock-gated single-action contract pattern. Rostrum compared against Sigil (mandate lifecycle) — patterns are consistent. |

**Half-baked finding M4-1:** **FIRE77 sub-agent caught two unresolved Rostrum HIGHs** (FIRE77-R1 3-way mul overflow — **fixed Fire 78 by staging the multiply**; FIRE77-R2 int256 cast — fixed Fire 77). Plus MEDIUM follower_exposure semantics (FIRE77-R3 — fixed Fire 77, partial finding "gross-vs-net" still documented for Year-2).

**Half-baked finding M4-2:** Rostrum UI follow/unfollow + leaderboard not built — frontend deliverable, Month 5 work continuing into Month 7.

---

## Month 5 — Code4rena prep + initial public review

**What shipped:** 9 Kani+proptest invariants in Plinth/Sigil (oracle_freshness_rejects_stale added Fire 75); audit-pattern completeness sweep documented in AUDIT_FINDINGS.md; sub-agent audit plan for Month 12 locked.

**Five-lens sweep:**

| Lens | Result |
|---|---|
| End-to-end | ⚠️ Code4rena submission pack not yet bundled — needs Day-150 trigger; auto-bundle script can wire later. |
| Event-emit | n/a (no contract delta this month) |
| Failure-path | n/a |
| Constructor zero-checks | n/a |
| Sibling-comparison | ✅ Kani proofs cross-check against TDD §14.2's named invariants — solvency + oracle freshness + mandate expiry are all named + proven. |

**Half-baked finding M5-1:** Code4rena submission script doesn't exist (`scripts/code4rena-bundle.sh`) — Day-150 task; not blocking earlier work.

---

## Cross-month observations

1. **Stylus-blocked tests are the single biggest test-coverage gap** across the codebase. Sigil.record_close (Month 2), Coffer.adapter_pull edge cases, Vigil keeper flow — all live in Rust crates that can't run Foundry tests locally. The Docker pipeline shipped Fire 75 (`contracts/stylus.Dockerfile`) is the unblock for F1 to verify locally; CI already runs them on ubuntu.

2. **Sub-agent audits caught real bugs** that the per-month sweeps did not — proving the methodology is worth running mid-build, not just at Month 12. Going forward each month closes with a 2–3 agent audit on that month's deliverables.

3. **Design-parity sweep against `desing/`** is still deferred. Frontend work has been minimal so far (apps/verify scaffolded but not wired to Router). Month 7 will pick this up explicitly.

4. **Human-only items** (`human_left.md` #4, #5, #7, #8, #9, #10, ...) are tracked but unmoved — these are not code I can ship. F3 ops queue.
