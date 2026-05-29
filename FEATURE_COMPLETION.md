# Phase 3 reconciliation - what is actually built vs the plan

Authored 2026-05-29 after verifying each BUILD_PLAN Phase 3 item against the live code. The BUILD_PLAN's Phase 3 was drafted partly from stale pre-fix audit notes (the same drift `PRODUCT_GAP_AUDIT.md` flags); this file is the corrected, source-checked state. No item is claimed done without a file + line reference.

## Verified state of each Phase 3 item

| Item | Plan said | Actual state (verified) | Remaining |
|---|---|---|---|
| **Sigil EIP-712 signature recovery** | "a Phase-1 stub returning false" | **Already wired.** `contracts/sigil/src/lib.rs:573 ecrecover_via_precompile` calls the 0x01 precompile with strict v accept-list ({0,1,27,28}) + EIP-2 upper-s rejection. `validate_action_inner` (line 356/365) recovers both intent + action signers and asserts they match the claimed signer. | None. Plan item was stale. |
| **Vigil keeper min-stake 1000 ETH -> 0.01 ETH** | "reduce + Praetor-only setter + redeploy + stake" | **Code complete.** A `testnet-stake` cargo feature (`contracts/vigil/src/lib.rs:615`) makes the default 0.01 ETH (10^16 wei) with a mainnet-must-not-enable guard; the eta.2 Praetor-only emergency setter `set_keeper_min_stake_emergency` also exists and is unit-tested. | **Founder-gated:** build with `--features testnet-stake` + redeploy Vigil (deployer key), then a keeper stakes. |
| **Foundry integration tests (mandate -> open -> close -> PnL)** | "new AtriumRouter.integration.t.sol" | **Substantial coverage exists:** `tests/foundry/AtriumRouter.t.sol`, `RouterV11RoutingTest.t.sol`, `tests/integration/{DepositWithdrawRoundTrip,AdapterPullPauseRespect,AqueductSendSettle,AqueductExpiredClaimBack}.t.sol`. | A single end-to-end mandate->open->close->PnL scenario test could still be added for the demo narrative, but the constituent paths are covered. |
| **Agent ActionSigil real submission** | "agents sign + submit via AtriumRouter; /api/status shows action_submitted" | **Scaffold, honest.** `services/agents/api/augur.ts:35` logs `would-act-on: <intentHash>` and explicitly documents itself as a buildathon scaffold that does not spam on-chain. Same for haruspex/auspex. | **Code writable now, but cannot be verified end-to-end this session.** Real submission needs: (1) each agent's funded session key (founder-held secret in the GHA/Vercel cron env), (2) AtriumRouter executable, which is gated on the **timelock executing ~2026-05-31** (founder-run, task beta.5), (3) a registered Sigil mandate on-chain. Shipping submission code now = untested funds-moving path. |
| **Codex `POST /execute`** | "decode envelopes, validate on-chain, route, error codes + x402 + rate-limit" | **Missing.** The Codex worker (`services/codex/src/index.ts`) exposes GET read endpoints only. | Same gating as agent submission: needs a relayer key (or agent-submits-direct design) + the executable router (post-timelock). Writable now, not verifiable now. |

## The honest conclusion

Phase 3's contract-side keystones (Sigil recovery, Vigil stake tunability) are **already implemented in code**; the integration-test floor **exists**. What genuinely remains is the **agent execution path** (agents submitting real ActionSigils, and/or a Codex `/execute` relay) - and that path is **activation-gated on founder-held items**:

1. **Execute the Praetor timelock batch** (~2026-05-31 02:20 UTC, `node scripts/execute-phase-b3.mjs`) so AtriumRouter can open/close cross-venue positions. Until then, no execution path can be verified end-to-end.
2. **Provision agent session keys** (funded EOAs) in the agent cron env.
3. **Build + redeploy Vigil with `--features testnet-stake`** and stake a keeper.
4. (If the relay design is chosen) **a Codex relayer key**.

Writing the agent-submission + Codex `/execute` code before (1)-(2) means shipping a funds-moving path we cannot test, which the no-half-feature rule forbids presenting as done. The right sequence is: founder executes the timelock + provides keys, then the execution code is written and verified against the live, executable router in one pass.

## What this session DID complete and verify (Phases 1, 2, 4-code)

All green (tsc clean, 627/627 vitest from `apps/verify`, `node --check` on the SW):
- **Phase 1 (legibility):** `copy.ts` label map, hero benefit band, benefit-first landing eyebrows, portfolio "why margin lower" + stat tooltips, Emergency-Stop card, reserves "prove your balance", onboarding benefit wedge, `/app/markets` starter combos, plain-first app breadcrumbs, glossary + deployment docs, `COMPETITIVE_POSITIONING.md`.
- **Phase 2 (surfaces):** `/docs/runbooks` (34, rendered via a tested zero-dep markdown renderer), `/docs/adr` (12), `/docs/api` live health + try-it, `/app/settings/session-keys` (real PosternKeyRegistry reads), `/app/integrations` hub, `/app/trade` venue-margin compare drawer, honesty link in footer.
- **Phase 4 (PWA/data, code-doable):** fixed the broken manifest/SW icon assets (the SW could never install), branded `offline.html`, confirmed self-hosted fonts, Lantern `redeemableUsd` from `Coffer.totalAssets()`.

The a11y/Lighthouse gate is a runtime check that belongs with the Phase 5 browser rig.
