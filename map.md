# Atrium — Full Codebase Map & Findings

Generated 2026-05-31 from a line-by-line, read-only read of **every product source file** (~700 files), run as 20 parallel auditor agents across 5 batches. Vendored `resources/`, `node_modules`, and build artifacts (`foundry-out`, `target`, `subgraph/build|generated`, `.next`) were excluded as not-your-code.

Exhaustive per-file detail (purpose + findings + line counts proving coverage) lives in
`.kiro/workflows/20260531-1456-fullcode-map/results/<area>.md` — one file per area below.

---

## 1. Executive summary & production verdict

**Verdict: NOT production-ready (real money / mainnet). It is a strong, mostly-honest testnet hackathon build with a genuinely good engineering core, blocked from "production" by operational reality, key-handling, test-confidence, and completeness gaps — not by deep architectural flaws.**

The core math (SPAN margin engine, ERC-4626 vault, dual-oracle hardening, EIP-712 mandates) is real and largely sound. The frontend is now honest and complete in ways prior audits said it wasn't (fake numbers gone from React, tax IDOR fixed, mobile kill-switch shipped). But:

- **The live deployment runs OLD, known-buggy bytecode.** The fixed contracts are *staged*, gated behind a 48h timelock not yet flipped (`human_left.md`, `deployments/arbitrum_sepolia.staged.json`). The end-to-end money path has never been verified live.
- **The test suite gives false confidence** — it exercises Solidity mocks and reimplementations, *not* the deployed Stylus/WASM contracts. "All green" does not mean the real contracts are verified. And 4 tests are currently failing.
- **Key handling is the systemically weakest area** — single deployer EOA controls every contract, that key leaked once and was never rotated, and raw private keys are passed on process argv/env across many scripts and the agent runners.
- **Most "venues" are placeholders** (~4 of ~8 are even testnet-functional), and the reference **agents are scaffolds** whose on-chain calldata would revert.
- **No external/professional smart-contract audit** exists for a system that holds margin + performs liquidations.

**As a testnet hackathon demo:** close, but the verifier walk completes only 4/7 steps and the Aave fill path being prepped for cutover has a live bug.

### Severity tally (whole codebase)
| Severity | Count (approx) | Nature |
|---|---|---|
| 🔴 CRITICAL | ~13 | mostly test-confidence, key-handling, deploy/cutover, PoR correctness |
| 🟠 HIGH | ~22 | exploitable contract gaps, money-UX correctness, broken/scaffold features |
| 🟡 MEDIUM | ~30 | hardening, rate-limits, data accuracy, IDOR-lite |
| 🟢 LOW | many | a11y, polish, forensic data loss |
| ✅ PASS | many | see "what's genuinely good" |

---

## 2. Coverage map (what was read)

| Area | Files | Result file |
|---|---|---|
| Stylus margin/oracle (plinth, plinth-math, plinth-oracle) | 13 | `results/c-stylus-margin.md` |
| Stylus vault/mandates/liquidation (coffer, sigil, vigil) | 11 | `results/c-stylus-vault.md` |
| Solidity core (router, aqueduct, registry) | 8 | `results/c-sol-core.md` |
| Solidity governance/safety (timelock, postern, curator, edict, rostrum, lantern, faucet, stoa, mocks) | 12 | `results/c-sol-gov.md` |
| Venue adapters (10) | 13 | `results/c-adapters.md` |
| Foundry core tests | 22 | `results/t-foundry-core.md` |
| Foundry adapter + conformance tests | 24 | `results/t-foundry-adapters.md` |
| Halmos + integration tests | 15 | `results/t-formal-integration.md` |
| Frontend API routes (auth/portfolio/reserves/vault/trade/transfer/faucet/deployments) | 40 | `results/fe-api-1.md` |
| Frontend API routes (agents/tax/settings/protocol/lantern/chaos/…) | 58 | `results/fe-api-2.md` |
| Frontend lib + hooks | 88 | `results/fe-lib.md` |
| Frontend pages | 66 | `results/fe-pages.md` |
| Frontend components (landing/atrium/mobile/agents/portfolio/vault) | 63 | `results/fe-components-1.md` |
| Frontend components (trade/reserves/settings/tax/ui/verifier/top-level) | 68 | `results/fe-components-2.md` |
| Codex x402 API service | 32 | `results/svc-codex.md` |
| Lantern / Vigil-keeper / Notifier services | 60 | `results/svc-keepers.md` |
| Python (tablet, archive) + agents + praetor-cli + loadtest | 94 | `results/svc-python-agents.md` |
| Subgraph (handlers, schema, tests, manifest) | 32 | `results/data-subgraph.md` |
| Ops/deploy scripts | 41 | `results/ops-scripts.md` |
| Repo config / CI / Docker / secret hygiene | 31 | `results/repo-config-ci.md` |

---

## 3. Master CRITICAL / HIGH findings (prioritized)

### 🔴 CRITICAL
| # | Area | Finding | Evidence |
|---|---|---|---|
| C1 | Ops reality | **Live contracts are the OLD buggy bytecode**; fixed set is staged, gated on a 48h timelock not yet flipped. Money path never verified live. | `human_left.md`, `deployments/arbitrum_sepolia.staged.json` |
| C2 | Security/keys | **Single deployer EOA is admin of every contract, and that key leaked once (2026-05-24) and was never rotated.** Compromise = full protocol control. | `incidents/2026-05-24-…md`, `.env` (on disk) |
| C3 | Contracts | **Vigil `testnet-stake` cargo feature has no compile-time mainnet guard** — an accidental `--features testnet-stake` mainnet build drops keeper min-stake 1000 ETH → 0.01 ETH. (Docs claim a guard exists; it doesn't.) | `contracts/vigil/src/lib.rs` (feature gate) |
| C4 | Tests | **Halmos "formal proofs" verify local Solidity reimplementations, not deployed Stylus/WASM** — can silently diverge from production. | `tests/halmos/*` |
| C5 | Tests | **7/8 integration tests use only Mock\* contracts; real Stylus Plinth/Coffer/Sigil bytecode is never exercised** anywhere in Foundry. | `tests/integration/*`, `tests/foundry/*` |
| C6 | Tests | **Core value-prop test `HedgedPairMarginSavings` is a hardcoded `if(hasPerp&&hasTbill)` stub**, not the real SPAN engine. | `tests/integration/HedgedPairMarginSavings.t.sol` |
| C7 | Tests | **`MarginLiquidationRecovery.executeLiquidation` is a no-op** — never reduces notional; liquidation correctness is unverified. | `tests/integration/MarginLiquidationRecovery.t.sol` |
| C8 | Contracts/Money path | **The 4 currently-failing tests trace to a source/bytecode mismatch in the Aave fill path** being prepped for cutover: it supplies the entire ~10M pre-funded balance instead of `min(funded, notionalAbs)`. | `contracts/adapters/aave-horizon/src/AaveHorizonAdapterV11.sol:100-115`, `cache/test-failures` |
| C9 | Service (PoR) | **Lantern Vercel-cron path caps at `first:1000` with no pagination** → >1000 users silently omitted from the proof-of-reserves Merkle tree. | `services/lantern-attestor/api/_scribe.ts` |
| C10 | Service (PoR) | **Lantern cron uses `balanceWei` (net deposits) instead of `convertToAssets` (redeemable)** → wrong Merkle roots. (`src/` path is correct — deployed path drifted.) | `services/lantern-attestor/api/_publish-once.ts` |
| C11 | Service (payments) | **Codex DB layer destructures 7 bind args but x402 binds 6** → corrupted payment-record columns on deploy. (Replay-dedup SETNX still correct.) | `services/codex/src/lib/upstash-db.ts:170`, `inmemory-db.ts:85` |
| C12 | Security/keys | **Reference agents hold raw private keys in env with no keystore/HSM**, exposed in process memory. | `agents/*/src/tick.ts` |
| C13 | Security/keys | **`tplus48-aave-fill.sh` reads the privkey from `.e2e-test-key.json` into a shell var and passes it on `cast` argv + child node env** — maximum exposure. The leak-incident `redact()` fix was never propagated here. | `scripts/tplus48-aave-fill.sh` |
| C14 | CI | **The incident-mandated CI grep for `0x[0-9a-fA-F]{64}` was never added** to any workflow — the key-leak follow-up is still open. | `.github/workflows/*` |

### 🟠 HIGH (by area)
**Contracts**
- AtriumRouter has **no reentrancy guard** despite external calls to untrusted adapters after Plinth/Coffer state changes (drain risk). `contracts/atrium-router/src/AtriumRouter.sol`
- Rostrum **duplicate-follow** corrupts keeper iteration; **`mirrorOpen` Plinth-authorization gap** may revert all copy-trades. `contracts/rostrum/src/Rostrum.sol:96-112,178`
- Adapter **balance-sweep-on-close** misattributes funds across concurrent positions (Hyperliquid, Polymarket).
- **Polymarket `setDestination` is `onlyPraetor`** (bypasses 48h timelock for CCIP routing).
- **CurveAdapter `min_amount=0`** — zero slippage protection (guaranteed sandwich on mainnet).

**Frontend**
- **IDOR on `/api/trade/margin-impact`** — `?wallet=` without `requireWalletMatch`; enumerate any wallet's collateral/margin. `route.ts:30-34`
- **Chain-guard missing on 8/10 write hooks** → wrong-chain submits fail silently / target wrong contract. `apps/verify/src/lib/use-*.ts`
- **5 write hooks report success on submit, not mining** → a reverted tx shows green "success". (058-FE3 fix applied to only 3 hooks.)

**Services / data**
- **Vigil-keeper is non-functional** because no keeper is staked on-chain (`activeKeeperCount==0`). Code is correct; liquidations won't run.
- **Notifier drops system-wide alerts** (e.g. `usdc_paused`) — skips alerts with no `user` field. `tick.ts:176`
- **Codex rate-limit is cosmetic** (per-isolate memory + unauthenticated `X-Wallet-Address`); only the x402 $1/call gate is real.
- **No Codex `POST /execute`** — service is read-only (may be intentional).
- **Reference agents' calldata is JSON-stringified, not ABI-encoded** → on-chain calls would revert (a "working" feature that isn't).
- **3 agents (augur/haruspex/auspex) are scaffolds** (log "would-act-on", never submit); `archive/span_backtest` real path is `NotImplementedError`.
- **Subgraph `CohortPartner` entity has no writer** → Cohort surfaces are always empty.

**Tests / CI / ops**
- **No stale-oracle test anywhere** — the oracle staleness defense is never exercised.
- **`.env.example` ships the Hardhat #0 real private key hex**; Dockerfiles (`agents`, `stylus`) run as root.
- **Timelock deploy scripts pass `--private-key` raw on `cast` argv** (no redaction); **`transfer-admin.s.sol` swallows reverts** via low-level `.call()` (can report success while admin is not transferred).

---

## 4. Cross-cutting themes

1. **Tests pass but don't test the real thing.** Halmos + 7/8 integration + all Router tests run against Solidity mocks/fakes, never the deployed Stylus bytecode. The headline "forge 715/715 green" overstates assurance — and 4 tests are actually red right now (`cache/test-failures`).
2. **Two-path drift: `src/` correct, deployed path buggy.** Recurs in Lantern (correct `src/`, buggy `api/` Vercel cron) and the Aave adapter (source says `min(funded,notional)`, deployed bytecode supplies full balance). Whatever is *live* is not what passed review.
3. **Systemic key-handling weakness.** Single unrotated leaked deployer EOA = admin of everything; raw keys on argv/env across scripts and agents; the `redact()` fix and the CI secret-grep were never propagated/added.
4. **Most venues are placeholders.** Real/testnet-functional: ~Aave (mock-pool-backed), Curve, Pendle, Trade.xyz. Revert-on-open: GMX, Morpho, Synthetix. Hyperliquid bridge = deployer EOA. The "7–8 venues" story is ~4 in reality.
5. **Agents are scaffolds**, not autonomous traders.
6. **Frontend honesty/completeness is now genuinely strong** — a real improvement over older audits (see §6).
7. **Code contradicts the project's own docs in several places** (see §5).

---

## 5. Code-vs-documentation contradictions (verify these)
- Docs claim Sigil **rejects EIP-2 upper-s** signatures — code does **not** (mitigated by replay guard). `contracts/sigil/src/lib.rs`
- Docs/`FEATURE_COMPLETION.md` claim a **mainnet guard on `testnet-stake`** — none exists. `contracts/vigil/src/lib.rs`
- A prior audit claims a **per-block notional cap (1% TVL) on adapters** — **no adapter implements one**.
- `LAUNCH_READY.md`/`human_left.md` claim **"forge 715/715 green"** — `cache/test-failures` shows **4 failing** V11 tests.
- Honesty page historically claimed mobile fake numbers were removed — they were removed from React **but still exist in orphan static `public/mobile-landing.html` + `public/mobile-app.html`** (`$12,374,820`), which are served publicly.
- `data-subgraph` finds `CohortPartner` is never written, yet `fe-api-2` reads "real cohort/partners data" — reconcile: the API is wired to a real source that returns empty.

---

## 6. What's genuinely good (do not regress)
- SPAN margin math: array-length mismatch **reverts** (old silent-zero/unlimited-leverage bug fixed); oracle staleness/negative-price/disagreement guards are sound.
- ERC-4626 inflation-attack offset + correct rounding direction; Stylus reentrancy guards; `set_plinth` one-shot wiring.
- `Aqueduct.resume()` and `Router.resume()` are **`onlyTimelock`** (old timelock-bypass fixed).
- Hybrid adapters (Hyperliquid/Polymarket) have **gold-standard EIP-712 replay/dedup/ecrecover tests**.
- Frontend data honesty: no fabricated metrics in the React app; null + `source:'pending'` everywhere; BigInt-native money math; EIP-712 encoding correct.
- **Tax/export IDOR fixed** (wallet from session); **chaos routes auth-gated**; **sumsub HMAC timing-safe**; **mobile kill-switch fully implemented**; **no dead buttons**.
- x402 payment verification is sound (on-chain authoritative, D1 UNIQUE dedup, 5-min window, zero-address reject).
- Tablet tax engine (UK CGT / US 8949 / DE FIFO) is correct with a real FX API + pagination; praetor-cli produces real Safe payloads.
- Notifier's old field-name/enum-case bug is fixed, with a CI drift-guard.

---

## 7. Operational reality (must-know before "production")
- **Cutover staged, not flipped** → live = old bytecode. Earliest timelock execution ~2026-06-01 (`human_left.md`).
- **4 failing Foundry tests** right now (`cache/test-failures`, all in `AaveHorizonAdapterV11.t.sol`).
- **Single deployer EOA admin; leaked key not rotated; no 3-of-5 Safe yet.**
- **`.env` with real secrets on local disk** (gitignored — not committed; confirmed via `git ls-files`).
- **No external smart-contract audit** for a margin/liquidation system.
- **Legal pages are self-drafted** with "lawyer review pre-mainnet" banners.

---

## 8. Suggested fix order (P0 → P2)
**P0 (before any real-money/mainnet):** rotate deployer key + migrate admin to multisig (C2); propagate key redaction + add CI secret-grep + move keys to keystore/vault (C12–C14); fix the Aave-fill source/bytecode mismatch + the 4 failing tests (C8); make tests exercise the real Stylus contracts (C4–C6); fix Lantern PoR cron (C9–C10); fix Codex payment-DB bind args (C11); add the AtriumRouter reentrancy guard.
**P1:** Rostrum follow/auth bugs; adapter balance-sweep + Curve slippage + Polymarket timelock; margin-impact IDOR; write-hook chain-guard + receipt-confirmation; stake a keeper (Vigil); notifier system-alert drop; complete or honestly gate the agents/venues.
**P2:** subgraph CohortPartner + agent PnL; rate-limits; Dockerfile non-root; remove orphan `public/mobile-*.html`; finish settings tabs; legal review.

---

_End of map. Per-file evidence in `.kiro/workflows/20260531-1456-fullcode-map/results/`._
