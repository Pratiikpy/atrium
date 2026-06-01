# Atrium — DO-NOW Plan (the 48h-window work list)

Everything here is actionable **right now** and is **not** blocked by the 48h PraetorTimelock.
Derived from the full audit in `/map.md` (+ `results/*.md`) and `human_left.md`.

**Effort:** S = <1h · M = 1–8h · L = >8h
**Env/needs:** `code` (edit only) · `FE` (ships on verify-app redeploy) · `sol-redeploy` (Foundry, Windows-OK) · `stylus-redeploy` (Rust — needs WSL/Linux) · `svc` (service redeploy) · `on-chain` (deployer key) · `re-arms-48h` (changes a staged address → re-schedule)

---

## ⚠️ Read this first — the one time-sensitive decision
The cutover's timelock batch registers the **new Aave adapter** (`registerAdapter(2, newAave)`), and that adapter currently fails 4 tests by supplying its **entire ~10M balance** instead of `min(funded, notional)` (`contracts/adapters/aave-horizon/src/AaveHorizonAdapterV11.sol:100-115`).

- If the **staged adapter bytecode was built from already-fixed source**, just prove the 4 tests green and verify the staged address matches. ✅ no timeline hit.
- If you must **rebuild + redeploy** the adapter to fix it, its address changes → you must **re-stage and re-schedule that timelock op = another 48h**. So if a redeploy is needed, **do it today**, not after the current window, or you lose ~2 more days.

**→ P0-1 below settles this. Do it first.**

---

## Blocked until the flip (skip these now)
- Flipping staged → live (`flip-cutover.mjs`) and the money-path e2e (deposit / Aave open-close / transfer / mandate-use).
- Verifying agent on-chain execution end-to-end (needs executable Router).
- Anything that asserts behavior of the *live* (post-flip) system.

---

## P0 — do today (de-risk the cutover + stop-the-bleed security)

| id | task | area / file | why | effort | needs |
|---|---|---|---|---|---|
| P0-1 | Reproduce the 4 failing tests, pin source-vs-bytecode, fix Aave supply to `min(funded,notional)`, get green; confirm staged adapter == fixed build | `AaveHorizonAdapterV11.sol:100-115`, `tests/foundry/AaveHorizonAdapterV11.t.sol`, `cache/test-failures` | live money-path goes out at cutover | M | sol-redeploy, maybe `re-arms-48h` |
| P0-2 | Fix Codex payment-DB bind-arg mismatch (7 vs 6) | `services/codex/src/lib/upstash-db.ts:170`, `inmemory-db.ts:85` | corrupts every stored payment record on deploy | S | svc |
| P0-3 | Fix Lantern proof-of-reserves cron: add pagination (drop `first:1000`) + use `convertToAssets` not `balanceWei` | `services/lantern-attestor/api/_scribe.ts`, `api/_publish-once.ts` | wrong PoR Merkle roots; >1000 users dropped | M | svc |
| P0-4 | Add `requireWalletMatch` to margin-impact route (IDOR) | `apps/verify/src/app/api/trade/margin-impact/route.ts:30-34` | any wallet's collateral enumerable | S | FE |
| P0-5 | Add Vigil `testnet-stake` mainnet compile guard (`assert!`/cfg lock) | `contracts/vigil/src/lib.rs` (feature gate) | mainnet build could ship 0.01 ETH min-stake | S | stylus-redeploy |
| P0-6 | Generate fresh deployer EOA offline; draft admin-migration to multisig | — | leaked key still admin of everything | M | code/on-chain prep |
| P0-7 | Add CI secret-grep (`0x[0-9a-fA-F]{64}`) workflow | `.github/workflows/` | incident follow-up never done | S | code |
| P0-8 | Propagate `redact()` + stop raw `--private-key` on argv | `scripts/redeploy-timelock-{execute,schedule}.mjs`, `pyth-push-usdc.sh`, `redeploy-solidity.mjs`, `tplus48-aave-fill.sh` | repeat-leak risk | M | code |

## P1 — high-value, this window

| id | task | area / file | effort | needs |
|---|---|---|---|---|
| P1-1 | Add AtriumRouter reentrancy guard (inherit existing `ReentrancyGuard`) + test | `contracts/atrium-router/src/AtriumRouter.sol` | M | sol-redeploy |
| P1-2 | Chain-guard on the 8 write hooks + wait-for-receipt on the 5 submit-only hooks | `apps/verify/src/lib/use-*.ts` | M | FE |
| P1-3 | Curve slippage: replace `min_amount=0` with a real bound | `contracts/adapters/curve/src/CurveAdapter.sol` | S | sol-redeploy |
| P1-4 | Polymarket `setDestination` → `onlyTimelock`; fix adapter balance-sweep-on-close | `PolymarketAdapter.sol`, `HyperliquidHybridAdapter.sol` | M | sol-redeploy |
| P1-5 | Rostrum: dedupe follow, gate `recordAction`, resolve `mirrorOpen` Plinth auth | `contracts/rostrum/src/Rostrum.sol:96-112,178,196` | M | sol-redeploy |
| P1-6 | Notifier: deliver system-wide alerts (no `user` field) | `services/notifier/src/tick.ts:176` | S | svc |
| P1-7 | Codex rate-limit: durable store + don't trust `X-Wallet-Address` | `services/codex/src/middleware/rate-limit.ts` | M | svc |
| P1-8 | `use-issue-mandate` revocation nonce hardcoded `0n` → read real nonce | `apps/verify/src/lib/use-issue-mandate.ts:89` | S | FE |
| P1-9 | Stake a Vigil keeper so liquidations actually run (after P0-5 build) | `services/vigil-keeper` | S | stylus-redeploy + on-chain |
| P1-10 | Rotate Cloudflare token / Graph deploy key / cron secrets; move to a vault | `.env` | M | ops |
| P1-11 | Decide agents: ABI-encode calldata (`agents/*/tick.ts`) + keystore, OR clearly mark scaffold | `agents/*/src/tick.ts`, `services/agents/*` | M | code/svc |

## P1 — tests & confidence (the biggest assurance gap)

| id | task | area | effort | needs |
|---|---|---|---|---|
| T-1 | Add a harness that runs integration tests against the **real Stylus** contracts (not mocks) | `tests/integration/*` | L | stylus (WSL) |
| T-2 | Replace `HedgedPairMarginSavings` hardcoded stub with real SPAN engine call | `tests/integration/HedgedPairMarginSavings.t.sol` | M | sol |
| T-3 | Make `MarginLiquidationRecovery.executeLiquidation` actually reduce notional + assert | `tests/integration/MarginLiquidationRecovery.t.sol` | M | sol |
| T-4 | Add a stale-oracle test (feed goes stale → revert) | `tests/foundry` + MockChainlinkUsdFeed | S | sol |
| T-5 | Strengthen Halmos: prove against real model or document the divergence risk | `tests/halmos/*` | M | code |
| T-6 | Add adapter reentrancy-attack + fuzz tests; PlinthMath host tests | `tests/foundry`, `contracts/plinth-math` | M | sol/WSL |

## P2 — polish, data, docs, cleanup

| id | task | area / file | effort | needs |
|---|---|---|---|---|
| P2-1 | Delete orphan fake-number files | `apps/verify/public/mobile-landing.html`, `mobile-app.html` | S | FE |
| P2-2 | Fix code-vs-doc contradictions (upper-s, testnet-stake guard, "715/715 green", per-block cap, honesty-page mobile claim) | `FEATURE_COMPLETION.md`, `LAUNCH_READY.md`, honesty page, audit docs | M | docs |
| P2-3 | Subgraph: write/remove `CohortPartner`; decrement `activeAgentsCount`; wire `Agent.totalPnlSigned`; clamp counters | `subgraph/src/*` | M | svc |
| P2-4 | Buying-power 1d/7d/30d pills functional (or remove) | `components/portfolio/buying-power-card.tsx` | S | FE |
| P2-5 | Finish or honest-gate settings tabs 3–6 | `app/app/settings/page.tsx:50-53` | M | FE |
| P2-6 | Per-venue haircut in risk preview; rostrum reputation scale label; FloorPlan a11y; team-page dead links | various components | M | FE |
| P2-7 | Aqueduct ctor zero-addr check + admin-transfer; Router abs(notional) over-pull guard | `Aqueduct.sol`, `AtriumRouter.sol` | M | sol-redeploy |
| P2-8 | Dockerfiles non-root `USER`; pin checkout SHA in `vigil-keeper.yml`; un-soft-fail Lighthouse | `agents/Dockerfile`, `contracts/stylus.Dockerfile`, `.github/workflows/*` | S | code |
| P2-9 | Remove real Hardhat#0 key from `.env.example` (use placeholder) | `.env.example:26` | S | code |

## Audit / verification (do-now, no chain)
- A-1: Re-run full suites + triage — `forge test` & `vitest` (Windows), `cargo test` (WSL). Get a true current pass/fail board.
- A-2: Run Slither/static analysis on all Solidity (`make audit`); attach to map.
- A-3: Freeze a contracts commit + finalize the external-audit scope (`ops/code4rena-submission-pack.md`) so an audit can start the moment funds allow.
- A-4: Reconcile `docs/deployment.md` status table with reality (Stylus contracts missing from table; mark mock-backed venues honestly).

---

## Suggested 2-day sequence
1. **Today AM:** P0-1 (settle the Aave/timelock question — redeploy today if needed) → P0-2, P0-3, P0-4.
2. **Today PM:** P0-5→P0-8 (security/keys) + A-1 (true test board).
3. **Day 2 AM:** P1-1…P1-8 (contract + FE + service fixes), batch a single Solidity redeploy.
4. **Day 2 PM:** T-2…T-4 (real tests), P2 quick wins (P2-1, P2-9, P2-2), A-3 (audit prep).
5. **Bigger/parallel (needs WSL):** T-1 real-Stylus harness, P0-5/P1-9 Stylus rebuild.

## Environment notes
- Solidity (Foundry), frontend (vitest), and TS/Python services all build/test **here on Windows**.
- The **Stylus (Rust) contracts need WSL/Linux** to compile/redeploy (plinth, coffer, sigil, vigil, plinth-math, plinth-oracle).
- Items marked `re-arms-48h` change a staged address and restart the timelock clock for that op — sequence them before executing the batch.
