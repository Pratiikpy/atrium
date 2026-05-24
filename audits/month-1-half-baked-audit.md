# Month-1 half-baked audit

**Date:** 2026-05-19 (catch-up — original Month-1 sweep was deferred during the cron-loop pattern; this is the formal sweep now that the roadmap is the pacing artifact).

**Method:** for each shipped Month-1 deliverable, ask:
1. Does it actually work end-to-end on a fresh clone?
2. Is every state-changing surface observable (event-emit completeness — CCCCC lens)?
3. Is the failure path tested with the same rigor as the happy path (SSSS lens)?
4. Are constructor zero-checks present (BBBBB lens)?
5. Is governance gating consistent with sibling contracts (DDDDD/EEEEE sibling-comparison lens)?

---

## Month-1 deliverable inventory

### 1. AtriumRouter.sol — adapter orchestration

| Check | Status |
|---|---|
| Works end-to-end | ✅ — `tests/foundry/AtriumRouter.t.sol` exercises Plinth → Coffer → CurveAdapter via Router; the load-bearing test (`test_open_via_router_endToEnd_chainExecutes`) asserts all 4 chain effects |
| Event emit on every state change | ✅ — `PositionOpenedViaRouter` + `PositionClosedViaRouter` emit on every entry |
| Failure-path tests | ✅ — `revertsIfAccountPaused`, `revertsOnUnregisteredVenue`, `directCall_byUnauthorized_stillRejected` |
| Constructor zero-checks | ✅ — all 4 deps (plinth, coffer, registry, praetor) zero-checked; tests pin them |
| Governance gating sibling consistency | ✅ — no setters in Router (designed minimal); the Router itself is added to Coffer's approved_adapters via Praetor multisig at deploy |

**Half-baked finding:** the Router has NO `close_position_via_adapter` test. The function exists but no integration test exercises it. Add in Month 2.

**Action:** queued — Router close-path integration test (sibling pattern from `test_open_via_router_endToEnd_chainExecutes`).

### 2. CurveAdapter modifier migration

| Check | Status |
|---|---|
| `onlyCoffer` retained for backwards-compat | ✅ — legacy tests still pass |
| `onlyAuthorizedCaller` covers Coffer + setable list | ✅ — `test_curve_directCall_byCoffer_stillWorks` pins it |
| `setAuthorizedCaller` praetor-gated + emits event | ✅ — `test_setAuthorizedCaller_onlyPraetor` + `_emitsEvent` |
| Sibling-comparison vs other 5 adapters | ✅ post-fire 75 — all 6 adapters migrated identically |

**Half-baked finding:** none. CurveAdapter migration is clean.

### 3. Stylus Dockerfile + scripts/stylus-check.sh

| Check | Status |
|---|---|
| Docker image builds | UNTESTED — `docker build` not run locally (developer-facing escape hatch, not CI) |
| Script works against all 4 Stylus contracts | UNTESTED — runs `cargo stylus check` per contract |
| CI confirms ubuntu pipeline still works | ✅ — `.github/workflows/ci.yml` `test-rust` job unchanged |

**Half-baked finding:** the Dockerfile is "ship-ready in source" but the F1 developer has to actually run `docker build -t atrium-stylus -f contracts/stylus.Dockerfile .` to validate. The Dockerfile pins `rust:1.81-bookworm` and the cargo-stylus install line. Both are correct based on the project's existing CI workflow. Risk of regression: low.

**Action:** documented; F1 to verify at next on-call.

### 4. scripts/subgraph-deploy.sh

| Check | Status |
|---|---|
| Address patcher correct | ✅ source review — regex-based YAML patcher handles the `name:` + `source:` pattern in the manifest |
| Network selection | ✅ — `--check` (no deploy), `--local`, default studio |
| Auth env var fenced | ✅ — `GRAPH_DEPLOY_KEY` required for studio mode; clear error if absent |

**Half-baked finding:** the script assumes `deploy/arbitrum-sepolia.json` exists; this depends on `praetor deploy --network arbitrum_sepolia --all` having run. Order-of-operations is documented in the script header. Risk: low.

### 5. Codex catalog (10 endpoints)

| Check | Status |
|---|---|
| `/v1/risk/correlations` ships with input validation | ✅ — comma-list parse + per-id regex + 16-item cap |
| `/v1/positions/aggregated/:address` uses BigInt for sum precision | ✅ — `BigInt` arithmetic, not float |
| `/v1/agents/intent-validation` validates all input | ✅ — 4 input fields, 4 validation patterns |
| Subgraph queries exist for the data each endpoint needs | UNTESTED — schema has `correlationClasses`, `sigilMandate`, `sigilRevocation` entities referenced; these need handler-side population (Plinth subgraph events) |

**Half-baked finding:** the 3 new endpoints reference subgraph fields (`correlationClasses`, `sigilMandate`, `sigilRevocation`) that the schema declares but the handlers in `subgraph/src/plinth.ts` + `subgraph/src/sigil.ts` may not fully populate. Verification needed: grep each entity name across `subgraph/src/` to confirm a writer exists.

**Action:** carry into Month 2 — subgraph handler-coverage sweep.

---

## Design-parity sweep (against `desing/`)

Not run this month because Month 1 was contract-heavy by design. No UI deliverables shipped that touch the design system. Carry to Month 3 when frontend work begins in earnest.

---

## Outstanding items rolled into Month 2

| Item | Source |
|---|---|
| Router `close_position_via_adapter` integration test | Half-baked finding #1 |
| Subgraph handler-coverage sweep for new Codex queries | Half-baked finding #5 |
| 5 sibling adapter Router-integration tests (Pendle, AaveV11, TradeXyz, Polymarket, Hyperliquid) | Roadmap Month-1 continuation, already noted |

---

**Net:** Month 1 ships durably with three small carry-overs. None of them block PRD Verifier-Mode Step 2 (which is the load-bearing Month-1 success criterion).
