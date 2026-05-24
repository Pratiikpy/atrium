# Atrium backend pipeline audit — 2026-05-24

Auditor C. Scope: `apps/verify/src/app/api/**` (38 route.ts files), `subgraph/`, `services/{codex,tablet,lantern-attestor,agents}/`. Contracts + page UIs excluded — covered by other auditors.

## Headline

The pipeline is wired honestly but is not actually producing end-user data on Sepolia today. Three load-bearing problems:

1. **The Scribe URL baked into every deployed service is a permanently stale subgraph snapshot.** `.env`, `services/codex/vercel.json:11`, and `services/agents/vercel.json:11` all point at `…/v0.0.3`, which is frozen at indexed block **138 685 110** (≈3 months behind tip). The actually-current version is published as `version/latest` (block 270 766 263, in sync with deployments at block 270 408 443+). Every Scribe-backed verify-app route, Codex `/v1/*` route, and agent tick is reading the wrong endpoint.
2. **Every Scribe entity is empty across every version** (`/v0.0.3`, `/v0.0.2`, `/v0.0.1`, `/version/latest`). The subgraph is indexing healthily (`hasIndexingErrors:false`, block-tip current on `/version/latest`) but no contract emissions exist yet. `marginAccounts`, `positions`, `cofferDeposits`, `lanternAttestations`, `cohortPartners`, `agents`, `alertEvents`, `counters`, `crossChainCredits`, `sigilValidations`, `sigilRevocations`, `posternSessionKeys`, `keepers`, `liquidationEvents` — all `[]`. No user has yet deposited, opened a position, attested anything, or activated a mandate. The "pipeline is alive" claim is true only at the subgraph-indexer layer; for everything user-facing the answer is permanently `source: 'pending'`.
3. **`DEMO_WALLET_ADDRESS` is unset in production**, so the 12 routes that gate on it (every per-user portfolio/transfer/agents endpoint) shortcut to `source: 'pending'` before ever touching Scribe. Even if a user deposits and the subgraph indexes the event, these routes will still return null on Vercel until the env var is configured.

Off-chain services are deployed and reachable, but two routes the verify-app calls do not exist on Tablet (`/summary`, `/events` → 404), one Codex route queries entities the schema does not define (`sigilMandate`), and one Codex route inserts into a DB table the in-memory shim does not know (`backtest_jobs` vs `backtests`).

Subgraph YAML signatures match the actual ABIs (no Stylus-migration drift). Lantern cron auth works against `LANTERN_CRON_SECRET`. GitHub Actions agent cron is wired correctly. Sentry SDK is initialized at runtime but no `SENTRY_AUTH_TOKEN` so sourcemaps never upload.

---

## Per-route status — every API in `apps/verify/src/app/api/`

Verdict legend: ✅ returns live data when sources exist; ⚠️ wired but always returns pending given current deploy state; ❌ broken/misrouted/queries non-existent entity.

| Route | Source | Returns real data today? | Top issue |
|---|---|---|---|
| `agents/issue-mandate` POST `route.ts:42` | none — validation only | ✅ (returns 4xx or `accepted: {...}` echo) | Sigil contract not yet emitting; route correctly returns `ok:false` with named blocker. Never writes to chain. |
| `agents/leaderboard` `route.ts:24` | Scribe (probe only) | ⚠️ Always `pending` by design (per audit VV-3 fix) | Rostrum subgraph entities exist now (`rostrumFollows`, `rostrumReputation`) but the route still hardcodes `agents:[]`. The "see human_left.md #26" detail is stale — Rostrum is indexed. |
| `agents/my-mandates` `route.ts:42` | Scribe `sigilValidations` + `sigilRevocations` | ⚠️ Requires `DEMO_WALLET_ADDRESS`; subgraph has 0 SigilValidation entities. Live-once-data-exists. | Gated on env. |
| `agents/summary` `route.ts:7` | Scribe `sigilValidations` + `sigilRevocations` | ⚠️ Returns `activeMandates:0` source=scribe today (zero rows). `activeSessionKeys` hardcoded null despite `PosternSessionKey` now existing in schema. | Stale comment: schema now has `posternSessionKeys`; route should aggregate it. |
| `alerts/recent` `route.ts:79` | Scribe `alertEvents` | ⚠️ Schema correct, no rows. Will go live as soon as an OracleDisagreement etc. fires. | None. |
| `chaos/inject` POST `route.ts:30` | env `PRAETOR_CHAOS_URL` (unset) | ⚠️ Returns `503 chaos_agent_not_deployed` honestly. | Month-9 deferral. |
| `cohort/partners` `route.ts:7` | Scribe `cohortPartners` | ⚠️ Empty array (0 partners onboarded). Honest. | Contract path to register a CohortPartner unclear — no event emits this entity (no handler in any `subgraph/src/*.ts` writes `CohortPartner`). Indexing dead-letter. |
| `deployments/address` `route.ts:71` | `deployments/arbitrum_sepolia.json` | ✅ Returns 30 real addresses from registry. | Closed-enum + zero-address gate clean. |
| `deployments/status` `route.ts:43` | `deployments/arbitrum_sepolia.json` | ✅ All 7 verifier steps report `ready:true` (every required contract is deployed). | None. |
| `faucet/status` `route.ts:18` | registry | ⚠️ Always `available:false`; Coffer deployed but route hardcodes `reason:'Faucet adapter pending Curator whitelist'`. | Faucet contract `0x7f3a714c…` IS in the registry (`deployments/arbitrum_sepolia.json:184`) but this route doesn't read it. Should flip to live once stocked. |
| `kani/status` `route.ts:46` | env `KANI_STATUS_URL` or `public/kani-status.json` | ⚠️ Falls through to `state:'unknown', passed:null, total:6`. | No CI artifact committed; badge renders "checking". |
| `lantern/latest` `route.ts:50` | Scribe `lanternAttestations` | ⚠️ 0 attestations indexed → returns 404 with `reason:'no_attestation_yet'`. | Honest. Will populate once Coffer balances > 0 and cron fires. |
| `lantern/verify-inclusion` POST `route.ts:19` | IPFS gateway | ⚠️ Pure proxy; nothing to verify until Lantern publishes. | CID regex + wallet validation clean. |
| `notifications` `route.ts:30` | Scribe `liquidationEvents` + `sigilRevocations` | ⚠️ Empty + needs wallet env. | None. |
| `portfolio/activity` `route.ts:6` | Scribe `marginUpdates` + `positions` + `sigilValidations` | ⚠️ Wallet-gated, empty. | None. |
| `portfolio/buying-power` `route.ts:17` | Scribe `marginUpdates` | ⚠️ Wallet-gated. | None. |
| `portfolio/margin-health` `route.ts:7` | Plinth contract via `tryGetPlinth` + RPC | ⚠️ Wallet-gated; returns `source:'pending'` if `getAccount()` fails. | Direct RPC reads can work even with empty subgraph. |
| `portfolio/positions` `route.ts:19` | Scribe `positions` | ⚠️ Wallet-gated. | None. |
| `portfolio/summary` `route.ts:9` | Plinth RPC via `tryGetPlinth` | ⚠️ Wallet-gated. | None. |
| `protocol/metrics` `route.ts:15` | Scribe `marginAccounts` + `positions` + registry | ✅ Public — returns `testnetTvlUsd:null, venuesDeployed:{count:9,total:9}` honestly today. | Adapter count is registry-based (9 deployed), not live RPC; field-named `venuesDeployed` makes the gap explicit. |
| `protocol/subsystems` `route.ts:14` | registry | ✅ Returns 30 live slugs. | None. |
| `research-attestation/latest` `route.ts:50` | Scribe `backtestAttestations` + IPFS | ⚠️ 0 attestations → 404 `no_attestation_yet`. | None. |
| `reserves/merkle` `route.ts:6` | Scribe `lanternAttestations` | ⚠️ Empty → pending. | None. |
| `reserves/recent` `route.ts:35` | Scribe `lanternAttestations` | ⚠️ Empty → pending. | Strict-int guards. |
| `reserves/summary` `route.ts:24` | Scribe `cofferUserBalances` + `lanternAttestations` | ⚠️ Empty; `isStale:true, staleReason:'no attestation indexed yet'`. | None. |
| `settings/connected-sites` GET/DELETE `route.ts:43` | in-memory process Map | ⚠️ Cross-tenant leakage acknowledged in code comment (LL-6); per-user scoping is `human_left.md #22`. | Memory-only; resets on Vercel cold start. |
| `settings/gas` `route.ts:5` | none | ⚠️ Returns `sponsored:null, cap:10, active:false, source:'pending'`. | Pimlico paymaster not wired. |
| `settings/wallet` `route.ts:18` | registry `postern-key-registry` + env | ⚠️ Wallet-gated. Postern IS deployed (`0x28c9fd50…`) so when wallet env is set the route would flip to `source:'postern'` and ship the static authenticator description. | Static authenticator strings are flagged "generic descriptions" in the code — borderline honest. |
| `tax/allowance` `route.ts:7` | hardcoded constants | ⚠️ Returns UK-only allowance with `usedUsd:null`; non-UK jurisdictions all pending. | OK. |
| `tax/events` `route.ts:11` | `TABLET_URL/events` | ❌ **`/events` endpoint does not exist on Tablet** (`tablet.../events?...` → `{"detail":"Not Found"}`). Route always falls into catch → `{events:[], source:'pending'}`. | Tablet `src/main.py:37-110` only defines `/health` and `/export`. |
| `tax/export` `route.ts:18` | `TABLET_URL/export` | ⚠️ Lives. Requires `tax_year_start` AND `tax_year_end`, but route sends only `year` — `Tablet` rejects with `{"detail":[{"type":"missing","loc":["query","tax_year_end"]…}]}`. | **API contract mismatch**: verify route sends `?format=csv&jurisdiction=uk&year=2026`; Tablet expects `address`, `jurisdiction`, `tax_year_start`, `tax_year_end`. Route will always return 503 `tablet_unreachable` in practice. |
| `tax/summary` `route.ts:23` | `TABLET_URL/summary` | ❌ **`/summary` endpoint does not exist on Tablet** (`tablet.../summary?...` → `{"detail":"Not Found"}`). Always fall-through to pending. | Same mismatch as `/events`. |
| `trade/margin-impact` `route.ts:27` | Plinth RPC | ⚠️ Wallet-gated. Math is sound (audit JJ-1/JJ-2 fixes). | Heuristic `initialBps` per venue is hardcoded; not read from Portico. |
| `trade/orderbook` `route.ts:9` | Hyperliquid testnet info API | ✅ **Truly live** — pulls L2 book from `api.hyperliquid-testnet.xyz/info`. Returns real bid/ask/mid. | One of the few routes with real, non-pending data. |
| `transfer/chain-balance` `route.ts:11` | viem RPC ERC-20 | ⚠️ Wallet-gated; reads USDC balance live. | OK. |
| `transfer/last` `route.ts:10` | Scribe `crossChainCredits` | ⚠️ Wallet-gated + empty. | None. |
| `transfer/quote` `route.ts:14` | registry `aqueduct` | ✅ Aqueduct deployed → returns deterministic 8.4s estimate, `'$0.00'` fees. | Fees are honest constants (Postern sponsored on testnet), not measurements. |
| `transfer/recent` `route.ts:10` | Scribe `crossChainCredits` | ⚠️ Wallet-gated + empty. | None. |
| `vault/stats` `route.ts:13` | Coffer RPC (totalAssets, balanceOf, convertToAssets) | ⚠️ Wallet-gated for `userSharesFormatted`. **Coffer.totalAssets()** would be a real live read **if** wallet were set. | Will return real `vaultTvlUsd: '$0.00'` if even one user deposits. |

**Routes that DO produce real data today (no wallet env needed, no Scribe data needed):**
- `deployments/address`, `deployments/status`, `protocol/subsystems`, `protocol/metrics` (registry-only fields)
- `trade/orderbook` (Hyperliquid testnet)
- `transfer/quote` (registry + deterministic math)
- `vault/stats` for `vaultTvlUsd` (RPC, but user-share fields gated)

Everything else is honest-pending until either (a) `DEMO_WALLET_ADDRESS` is set and (b) the subgraph has indexed at least one matching event, or (c) the operator points `SCRIBE_URL` at `/version/latest` and the contracts emit.

### Honest-pending contract compliance

`apps/verify/src/app/api/honest-pending.test.ts` enforces that every route returning `source:'pending'` ships `null` instead of fake-zero literals. Spot-check of 5 random routes against this contract: `portfolio/buying-power:53`, `portfolio/positions:90`, `vault/stats:51`, `tax/summary:46-58`, `transfer/recent:46` — all compliant. The cross-route invariant is a real defence.

---

## Subgraph health

### Live meta probe (`/version/latest`)

```
{"block":{"number":270766263},"hasIndexingErrors":false,"deployment":"…"}
```

Block 270 766 263 ≈ tip. Healthy. **Indexing-block is _ahead_ of every deployed contract's `startBlock`** (lowest is `PraetorTimelock` at 270 408 443) so indexing has scanned 358 K blocks of contract life and produced **zero** entities — confirming the contracts have not been called yet.

### Live meta probe (`/v0.0.3` — the one in `.env` and every `vercel.json`)

```
{"block":{"number":138685110},"hasIndexingErrors":false}
```

Block 138 685 110 = ~3 months stale, well below all deployments' `startBlock`. **This subgraph version was a different schema/source-list and is no longer being updated.** Every off-chain service that points here will never see deployed contracts emit, even after users transact.

| Subgraph version | Block | Status |
|---|---|---|
| `/v0.0.1` | n/a | `{"message":"Not found"}` |
| `/v0.0.2` | 173 785 110 | stale, frozen |
| `/v0.0.3` | 138 685 110 | stale, frozen — **but baked into all deploys** |
| `/version/latest` | 270 766 263 | live, in sync |

### Entity counts on `/version/latest`

Probed: `marginAccounts, positions, marginUpdates, cofferDeposits, cofferWithdraws, sigilValidations, sigilRevocations, agents, cohortPartners, lanternAttestations, liquidationEvents, keepers, backtestAttestations, counters, crossChainCredits, timelockSchedules, killSwitchEvents, adapterEvents, alertEvents, subsystemDiagnosticEvents, rostrumFollows, curatorGrants, posternSessionKeys, tierAssignments`.

**Every single one returned `[]`.** Singletons `aqueductPauseState(id:"0")`, `plinthPauseState(id:"0")`, `cofferPauseState(id:"0")` all returned `null` (never created — no pause has fired). `cofferUserBalances` empty.

This is consistent with the reality reported in `LAUNCH_READY.md §6` and `human_left.md`: no user has deposited, no agent has acted, no Praetor multisig op has scheduled, no faucet has been claimed. The subgraph is correctly indexing nothing because nothing has happened.

### Schema vs ABI drift

Verified all 13 data-source event signatures in `subgraph.yaml` against `subgraph/abis/*.json`. **Zero drift.** Post-Stylus events match exactly:

- `Plinth.AccountPaused(indexed address,bytes32)` ✓ (was `string` pre-A.7)
- `Coffer.CircuitBreakerTripped(bytes32,uint256)` ✓
- `Aqueduct.CrossChainCredit(…6 args, 2 indexed)` ✓ (K-1 audit fix locked)
- All 9 Plinth events, all 7 Vigil events, all 10 Coffer events, all 7 Aqueduct events, all 4 Sigil events, all 3 PorticoRegistry events, all 4 PraetorTimelock events, all 3 PosternKeyRegistry events, all 2 PosternKillSwitch events, all 4 Curator events: ✓.

### Handler completeness vs YAML

Cross-checked `subgraph.yaml` `eventHandlers` against `subgraph/src/*.ts`. Every declared handler exists in code. No silent gaps.

### Drift items / smells

1. **`Rostrum` and `AtriumRouter` data sources reference `address: "0x0000…0000"` and `startBlock: 0`** (`subgraph.yaml:381`, `:418`). The real deployed addresses are `rostrum: 0xbaf348e6…` and `atrium-router: 0xf134127c…` (`deployments/arbitrum_sepolia.json:84,91`). **The subgraph will never index Rostrum or Router events even when emitted.** The schema entities (`RostrumFollow`, `RostrumMirrorTrade`, …) exist but stay forever empty.
2. **`CohortPartner` is in the schema but no handler creates one.** No event handler in any `subgraph/src/*.ts` writes to `CohortPartner`. The verify-app `cohort/partners` route will always return `[]`, even once partners onboard, because there is no event-to-entity wiring. Likely need a Curator (cohort-tier-assignment) hook or a new contract event.
3. **`Counter` aggregate entity is in the schema (`schema.graphql:199`) but no handler increments it.** Empty `counters:[]` confirms this. Routes that could benefit (`protocol/metrics`) don't read it.
4. **`subgraph/indexing-todo.md` Tier-4 (`PosternSessionKey` action-log + per-action `AgentAction`)** still open. The `agents/summary` and `agents/leaderboard` routes flag this in code comments. Real follow-up.

---

## Off-chain service status

### Codex (https://codex-8y7umy7c2-pratiikpys-projects.vercel.app)

- `/health` → `{"ok":true}` ✓
- `/v1/margin` (no payment) → `402 payment_required` with proper `accepts:[{scheme:'exact', network:'arbitrum-sepolia', asset:'0x75faf114…', payTo:'0x7DB1c02a…', amountUsdcWei:'1000000', description:'/v1/margin'}]` ✓
- Same for `/v1/positions`, `/v1/options/recent`, `/v1/agents/leaderboard`, `/v1/agents/intent-validation`, `/v1/venues/health`, `/v1/attestation/latest` ✓
- x402 middleware (`services/codex/src/middleware/x402.ts`) is rigorous: 12-confirmation depth, 5-min payment TTL, UNIQUE tx_hash dedup, chain-truth `from`-address binding (BBBB-5 fix), zero-address payTo gate (iter-42 fix), USDC log-decode rather than `tx.value`. **Best-defended surface in the repo.**
- **In-memory D1 stub mismatch:** `services/codex/src/routes/backtest.ts:46` does `INSERT INTO backtest_jobs (id, strategy_id, params_json, status, created_at) VALUES (...)`. `services/codex/src/lib/inmemory-db.ts:122` only matches `INSERT INTO backtests`. The backtest enqueue path will hit the unhandled-SQL warning and return `success:false` from the shim → 500 to caller. Test coverage exists (`x402.test.ts`, `scribe.test.ts`) but doesn't exercise the backtest insert against the shim.
- **Codex `agents/intent-validation` queries entities that don't exist in the schema:** `gql` query is `{ sigilMandate(id: …) { … } sigilRevocation(id: …) { … } }` (`services/codex/src/routes/agents.ts:138`). `schema.graphql` defines `SigilRevocation` (plural list query `sigilRevocations`) but **no `SigilMandate` type and no singleton `sigilRevocation(id:)` resolver**. This endpoint will return `scribe_unavailable` (503) on every call once it gets past the 402 paywall.
- **`SCRIBE_URL` baked into `vercel.json:11` is the stale v0.0.3 endpoint.** Every Codex `/v1/*` data route reads from it. Even when Scribe data exists on `/version/latest`, Codex will see nothing.

### Tablet (https://tablet-nbuequsc6-pratiikpys-projects.vercel.app)

- `/health` → `{"status":"ok","version":"0.2.0","jurisdictions":["uk","us","de"]}` ✓
- `/export?address=…&jurisdiction=uk&tax_year_start=2025-04-06&tax_year_end=2026-04-05` → calls Scribe upstream; today fails with `{"detail":"Scribe upstream failed: Scribe response missing 'data' field: {'message': 'Not found'}"}` because Tablet's hardcoded `SCRIBE_URL` env (whatever it is) is likely also misconfigured or empty.
- **Endpoints `/summary` and `/events` do not exist** — both return `{"detail":"Not Found"}` from FastAPI. `services/tablet/src/main.py:37,59` only defines `/health` and `/export`. But `apps/verify/src/app/api/tax/summary/route.ts:46` and `apps/verify/src/app/api/tax/events/route.ts:23` both POST/GET to those paths. **Hard contract gap.** Verify routes will always fall into the `catch` → `source:'pending'`.
- **`/export` query-arg contract mismatch.** Tablet wants `address, jurisdiction, tax_year_start, tax_year_end`. Verify route sends `format, jurisdiction, year` (`apps/verify/src/app/api/tax/export/route.ts:36-38`). Tablet returns 422 `{"detail":[{"type":"missing","loc":["query","tax_year_end"],…}]}`. Verify route swallows → 503 `tablet_unreachable`.
- TDD §10 plans tax-event-emission per-jurisdiction handlers — the python service implements `jurisdictions/{uk,us,de}.py` calculators correctly (UK CGT, US 8949, DE FIFO) but exposes only the bulk `/export` endpoint. Either implement `/summary` and `/events` on Tablet OR drop them on the verify side.

### Lantern (https://lantern-attestor-cym79nomu-pratiikpys-projects.vercel.app)

- `/api/cron` no auth → `{"error":"unauthorized"}` 401 ✓
- `/api/cron` with `Authorization: Bearer 2eadbdfe…` (`LANTERN_CRON_SECRET` from `.env:54`) → `{"ok":true,"ts":1779624545710}` ✓
- The secret env var Vercel reads is `CRON_SECRET` (`services/lantern-attestor/api/cron.ts:18`), and the value baked in `.env` is named `LANTERN_CRON_SECRET` — operator must verify Vercel project env has `CRON_SECRET` set to the same value. The probe succeeded so it is.
- **Skip-when-empty logic correct:** `services/lantern-attestor/api/_publish-once.ts:62` short-circuits when `balances.length === 0`. With no Coffer deposits this is the expected path; the cron logs "no balances yet, skipping" and returns without writing to chain. Once any deposit lands, the cron will start producing real attestations.
- `requireEnv` (`_publish-once.ts:19`) is strict: missing `LANTERN_ATTESTOR_ADDRESS` or `SCRIBE_URL` throws, so a misconfigured cron loudly fails rather than silently posting empty roots. **Strong design.**
- **Lantern's `SCRIBE_URL` env on Vercel: not directly visible from this audit.** If it inherits the same `.env` value (`…/v0.0.3`), Lantern will permanently see zero balances even after deposits land. Needs operator check.
- Crons fire daily (`vercel.json:9` → `0 12 * * *`) — once per UTC noon, not hourly as PRD §11 suggests.

### Agents (https://agents-9rgcvskkw-pratiikpys-projects.vercel.app)

- `/api/status` no auth → `{"status":"pending","detail":"no ticks recorded on this instance yet…"}` ✓
- `/api/{augur,haruspex,auspex}` with `Authorization: Bearer <LANTERN_CRON_SECRET>` → `{"error":"unauthorized"}`. **The agents endpoints use a different `CRON_SECRET` env value** (or just isn't set the same). Per `services/agents/api/augur.ts:18` they require `process.env.CRON_SECRET`. GitHub Actions workflow `.github/workflows/agents-cron.yml:30` correctly uses `secrets.CRON_SECRET`. Need to verify (a) the Vercel project has `CRON_SECRET` set, and (b) the GH secret matches. Today they don't match my probe (which used the lantern value) — so without verifying the GH secret value I cannot confirm the cron is firing. **Operator should run a synthetic `/api/augur` call with the actual secret and confirm it returns a tick payload.**
- `vercel.json:6-8` schedules **daily** crons (`0 12 * * *`), but GitHub Actions runs **every 5 min** (`agents-cron.yml:15`). The GH path is the real heartbeat for Hobby tier (commented in YAML). OK.
- **Codex `SCRIBE_URL` and agents `SCRIBE_URL` are both the stale `/v0.0.3`** — agents tick by `fetch(SCRIBE_URL)` for `sigilValidations` (`services/agents/lib/scribe.ts`), and that query will return `[]` forever from v0.0.3 even after Sigil emits. Tick produces "mandates.found=0" no matter what. The cron loop will run, the status panel will populate with "alive" badges, but the agents are effectively blind to mandate events.

---

## End-to-end pipeline traces

For each "user-visible data point" from `ATRIUM_FULL_FLOW_DESIGN.md §4` (Portfolio) and adjacent pages, walking chain → subgraph → API → UI.

### 1. Buying power (`/app/portfolio` → "Buying power" tile)

- **chain:** `Plinth.update_margin` emits `MarginUpdated(indexed user, collateral_value_wei, required_margin_wei, …)`; Plinth deployed at `0x485218e3…` block 270 725 278.
- **subgraph:** `Plinth` data source (`subgraph.yaml:7-48`) with `eventHandler MarginUpdated → handleMarginUpdated` → writes `MarginUpdate` + `MarginAccount` entities (`subgraph/src/plinth.ts:42`). **Schema/handler sound.**
- **API:** `apps/verify/src/app/api/portfolio/buying-power/route.ts:17` queries `marginUpdates(where:{account:$u}, …)`, computes `free = collateral - required`, returns `{currentUsd, series, source:'plinth'}`.
- **UI:** consumed by portfolio summary component (out of scope per auditor split).
- **Verdict:** **Pipeline correct; will work when (a) `DEMO_WALLET_ADDRESS` is set, (b) `SCRIBE_URL` points at `/version/latest`, (c) a real user has called `Plinth.update_margin`.** Today: 0 of 3. Returns `source:'pending'`.

### 2. Vault TVL (`/app/vault` → "Vault TVL")

- **chain:** `Coffer.totalAssets()` direct view-call.
- **subgraph:** not needed for TVL (RPC direct).
- **API:** `apps/verify/src/app/api/vault/stats/route.ts:40` does `coffer.read.totalAssets()` via viem on Arb Sepolia.
- **UI:** vault page tile.
- **Verdict:** **Works today.** Bypasses subgraph entirely. Even with no deposits, returns `vaultTvlUsd:'$0.00', source:'coffer'`. The per-user share fields are wallet-gated; the TVL field is not. **Live endpoint, real RPC read.**

### 3. Position list (`/app/portfolio` → positions table)

- **chain:** `Plinth.PositionOpened(indexed position_id, indexed owner, venue_id, instrument_id, notional_signed)`.
- **subgraph:** `handlePositionOpened` (`subgraph/src/plinth.ts:70`) writes `Position` entity. **`entryPriceQ64 = BigInt.zero()`** is hardcoded (line 92) with a comment that it'll populate "when Plinth reads the entry price (event extension v2)." Today the contract emits no entry price, so every position has `entryPriceQ64:'0'`.
- **API:** `portfolio/positions/route.ts:19` reads `positions(where:{owner:$u, closedAtBlock:null}, …)`. The audit U-33 fix (line 59-86) checks `entryPriceInt > 0n` and ships `entryPrice: null` when unmeasured, with `markPrice: null` and `pnlUsd: null` (audit U-21). Honest.
- **UI:** out of scope.
- **Verdict:** **Pipeline correct; entry price will always show "—" until the contract emits it (event-extension v2, deferred).** When a user opens a position today, the row will appear with size + venue + instrument but no price column. Acceptable per honesty rule.

### 4. Agent leaderboard (`/app/agents` → leaderboard)

- **chain:** `Rostrum.MirrorTradeFilled`, `Rostrum.ReputationUpdated`, `Sigil.IntentValidated`.
- **subgraph:** **BROKEN.** `Rostrum` data source has `address: "0x0000000000000000000000000000000000000000"` (`subgraph.yaml:381`). The real Rostrum at `0xbaf348e6…` is unwatched. `RostrumFollow`, `RostrumMirrorTrade`, `RostrumReputation` will always be empty even when Rostrum emits.
- **API:** `agents/leaderboard/route.ts:24` was rewritten per audit VV-3 to hardcode `agents:[]` with `source:'pending'` because it was caught conflating Sigil validations with copy-trade followers. The route is honest but a fix would need to (a) point the Rostrum data source at the real address, (b) redeploy the subgraph, (c) rewrite this route to read `rostrumReputation`/`rostrumFollows`.
- **UI:** out of scope.
- **Verdict:** **Breaks at the subgraph hop. Three changes needed before this surface can ever go live.**

### 5. Aqueduct status / last transfer (`/app/transfer` → "Last transfer")

- **chain:** `Aqueduct.CrossChainCredit(indexed message_id, indexed user, source_selector, dest_selector, amount_wei, expires_at)`.
- **subgraph:** `handleCrossChainCredit` (`subgraph/src/aqueduct.ts:30`) writes `CrossChainCredit`. Lifecycle (`Settled`, `ClaimedBack`) flips state. **Sound.**
- **API:** `transfer/last/route.ts:10` reads `crossChainCredits(where:{user:$u}, first:1, orderBy:createdAtBlock, orderDirection:desc)`, formats with `formatShares`. Per audit U-22, step deltas are `null` (no per-step timestamps from contract).
- **UI:** out of scope.
- **Verdict:** **Pipeline correct end-to-end.** Wallet-gated + empty subgraph today; will populate the moment a user does a cross-chain transfer.

### 6. Lantern attestation root (`/app/reserves` → "Latest attestation")

- **chain:** `LanternAttestor.AttestationPublished(indexed root, block_number, timestamp)`. Publisher = `services/lantern-attestor/api/_publish-once.ts:90` → `walletClient.writeContract({…functionName:'publish', args:[root, blockNumber, signature]})`.
- **subgraph:** `handleAttestationPublished` writes `LanternAttestation` entity. **Note:** the contract event has no `ipfsCid` field, so the entity's `ipfsCid` stays unset; verify-app `lantern/latest/route.ts:78-90` (audit TT-17) treats missing CID as `404 missing_ipfs_cid`. **Real chain-event-extension needed** (`human_left.md #25`).
- **API:** `lantern/latest/route.ts:50`, `reserves/summary/route.ts:24`, `reserves/recent/route.ts:35`, `reserves/merkle/route.ts:6` all read `lanternAttestations` from Scribe.
- **UI:** out of scope.
- **Verdict:** **Pipeline correct, but blocked at three places simultaneously: (a) no Coffer balances → cron skips, (b) cron secret = stale Scribe URL means the cron's `fetchCofferBalances` returns 0 anyway, (c) even when published, IPFS CID won't appear on-chain so verify route returns `missing_ipfs_cid`.** Even once a user deposits, the reserves page will not show a real attestation root until the contract event is extended.

### Summary

| Data point | chain | subgraph | API | Verdict |
|---|---|---|---|---|
| Buying power | ✓ | ✓ | ✓ wallet-gated | breaks at deploy-time (Scribe URL + wallet env) |
| Vault TVL | ✓ (RPC direct) | n/a | ✓ | **works today** |
| Position list | ✓ | ✓ (entryPrice null) | ✓ wallet-gated | breaks at deploy-time only |
| Agent leaderboard | ✓ | **✗ Rostrum 0x0 address** | ✓ hardcoded pending | **breaks at subgraph** |
| Aqueduct last transfer | ✓ | ✓ | ✓ wallet-gated | breaks at deploy-time only |
| Lantern attestation | ✓ | ✓ (CID missing) | ✓ but 404 on missing CID | **breaks at contract event shape** |

---

## Env-var inventory (from `.env`)

| Var | Used by | Real value? | Service that reads |
|---|---|---|---|
| `ARBITRUM_SEPOLIA_RPC_URL` | viem clients | ✓ public node | apps/verify (`vault/stats`, `transfer/chain-balance`, `portfolio-source`), services/codex (`venues`, `x402`) |
| `ETHEREUM_SEPOLIA_RPC_URL` | unused on Arb-only deploy | n/a | none today |
| `POLYGON_AMOY_RPC_URL` | future Polymarket adapter | n/a | not consumed |
| `ARBISCAN_API_KEY` | empty placeholder | ✗ blank | unused at runtime; needed for `cast verify` |
| `DEPLOYER_PRIVATE_KEY` | scripts/deploy only | ✓ real (testnet-only, exposed in chat history) | scripts/, not services |
| `PRAETOR_MULTISIG_ADDRESS` | empty | ✗ blank | timelock owner reads |
| `PIMLICO_API_KEY` + `PIMLICO_RPC_URL` | empty | ✗ blank | `settings/gas` will stay pending |
| `COINBASE_X402_API_URL` + `_KEY` | URL set, key empty | ⚠ partial | codex x402 (key-optional, on-chain is authoritative) |
| `GRAPH_STUDIO_DEPLOY_KEY` | publish only | ✓ real | scripts/subgraph-deploy.sh |
| `NEXT_PUBLIC_SCRIBE_URL` / `SCRIBE_URL` | both point at **stale `/v0.0.3`** | ⚠ wrong endpoint | **EVERY scribe-backed route in verify, codex, lantern, agents, tablet** |
| `CODEX_HMAC_KEY` | empty | ✗ blank | response signing middleware (`sign-response.ts`) — likely no-op |
| `CODEX_KEY_ID` | `v1` | ✓ default | header `X-Codex-Key-Id` |
| `LANTERN_KEY_PATH` | local path | ⚠ dev | not used on Vercel — `services/lantern-attestor/api/_signer.ts` reads `LANTERN_KEY_ENVELOPE_JSON` env, not a file path |
| `LANTERN_KEY_PASSPHRASE` | empty | ✗ blank | required on Vercel; cron will throw without it. **The successful probe of `/api/cron` returning `ok:true` implies the env IS set in Vercel** (just not in `.env`), since the route skipped publish due to zero balances rather than throwing on key load. |
| `CLOUDFLARE_API_TOKEN` + `_ACCOUNT_ID` | legacy CF Workers | ✓ real but obsolete | none — Codex migrated to Vercel |
| `FLY_API_TOKEN` | empty | ✗ blank | not used; agents migrated to Vercel |
| `DATABASE_URL` | local postgres | ⚠ dev only | none in production (Codex uses inMemoryDB) |
| `LANTERN_CRON_SECRET` | `2eadbdfe…` | ✓ real | Vercel must mirror as `CRON_SECRET` for `services/lantern-attestor/api/cron.ts:18` — probe confirms it matches |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | real DSN | ✓ | apps/verify (`instrumentation-client.ts`, `sentry.*.config.ts`) |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_ENVIRONMENT` | set | ✓ | `next.config.mjs:62-63` |
| `SENTRY_AUTH_TOKEN` | **not in .env** | ✗ missing | `next.config.mjs` sentry webpack plugin — without this, sourcemaps not uploaded, error frames will be minified-stack only |
| `TABLET_URL` / `CODEX_URL` / `AGENTS_URL` | real deployed URLs | ✓ | verify-app tax routes; agents lib/codex.ts |
| `DEMO_WALLET_ADDRESS` | **not in .env** | ✗ missing | **12+ verify routes gate on this; all degrade to `source:'pending'` until set** |
| `KANI_STATUS_URL` | not set | ✗ | `kani/status` route falls back to file then to "unknown" |
| `PRAETOR_CHAOS_URL` | not set | ✗ | `chaos/inject` returns 503 honestly |
| `IPFS_GATEWAY` | not set (defaults to `https://ipfs.io`) | n/a | `lantern/verify-inclusion`, `research-attestation/latest` |
| `COFFER_ADDRESS` | not set | ⚠ | `_publish-once.ts:50-53` uses empty fallback → fetchCofferBalances returns 0; should read from deployments json or env |

---

## Critical gaps blocking testnet launch

1. **`SCRIBE_URL=…/v0.0.3` is the wrong endpoint.** Visible in `.env:33`, `services/codex/vercel.json:11`, `services/agents/vercel.json:11`, and almost certainly in Lantern + Tablet Vercel project env. **Fix:** switch all to `…/version/latest` (or pin a fresh tagged version). Without this, every Scribe-backed surface across the stack is permanently empty even after users transact.
2. **`Rostrum` and `AtriumRouter` subgraph data sources are pointed at `0x0` placeholder addresses.** `subgraph.yaml:381,418`. **Fix:** edit yaml to real deployed addresses (`0xbaf348e6…`, `0xf134127c…`), rebuild generated bindings, redeploy. Until then no copy-trade or router-orchestrated event ever indexes.
3. **`CohortPartner` schema entity has no handler.** No code path writes it. **Fix:** either add an event-emission path (Curator? Edict?) and a handler, or remove the entity and the route that reads it. As-is, `cohort/partners` is permanently empty.
4. **Tablet `/summary` and `/events` endpoints don't exist.** `apps/verify/src/app/api/tax/{summary,events}/route.ts` fetch URLs that 404. **Fix:** implement those FastAPI handlers in `services/tablet/src/main.py` (or stop calling them).
5. **Tablet `/export` query contract mismatch.** Verify sends `format/jurisdiction/year`; Tablet wants `address/jurisdiction/tax_year_start/tax_year_end`. **Fix:** align param names on either side.
6. **Codex `/v1/agents/intent-validation` queries `sigilMandate` which doesn't exist in the schema.** Will always return 503 after payment. **Fix:** either add a `SigilMandate` entity to the subgraph + handler from `Sigil` events, or rewrite the route to read from `sigilRevocations` + on-chain Sigil view-calls.
7. **Codex backtest enqueue uses table name `backtest_jobs`; in-memory shim only knows `backtests`.** `services/codex/src/routes/backtest.ts:46` vs `services/codex/src/lib/inmemory-db.ts:122`. Will 500. **Fix:** rename table in either route or shim; add a test.
8. **`DEMO_WALLET_ADDRESS` is unset.** 12 routes return `source:'pending'` unconditionally. **Fix:** set on Vercel project env. (Not visible in this audit — operator's call.)
9. **Lantern contract event lacks `ipfsCid`.** Even after Lantern publishes, verify-app returns 404 `missing_ipfs_cid` (`apps/verify/src/app/api/lantern/latest/route.ts:85`). **Fix:** extend `LanternAttestor.publish` to emit `ipfs_cid` and update the subgraph mapping.

## High-priority gaps

10. **Codex `agents/leaderboard` is hardcoded to return `[]`** even though Rostrum entities now exist in the schema. Code comment is stale (`route.ts:30-31`). Same for `agents/summary.activeSessionKeys` — `PosternSessionKey` is in schema but route returns null.
11. **Lantern cron fires once per day**, not hourly as PRD §11 says. `services/lantern-attestor/vercel.json:9` is `0 12 * * *`. Hobby plan limits crons; either upgrade or document the deviation.
12. **`COFFER_ADDRESS` env unused on Lantern.** `_publish-once.ts:50` falls back to empty string. The Coffer is deployed; Lantern should read it from `deployments/arbitrum_sepolia.json` (same pattern as the verify-app) or accept it as required env.
13. **`SENTRY_AUTH_TOKEN` missing.** No sourcemaps uploaded; production stack traces will be minified. Sentry events still fire (the public DSN is set), but debugging is harder.
14. **Codex `SCRIBE_URL` baked into `vercel.json:11` rather than read from runtime env.** Means changing the subgraph URL requires a Codex redeploy. Same for `services/agents/vercel.json:11`. Consider moving to project env vars.
15. **Codex `CODEX_HMAC_KEY` empty in `.env`.** Response signing middleware almost certainly produces no signature or a dummy one. Agents that verify HMAC will reject. Production must set this.
16. **Agents `CRON_SECRET` discrepancy.** Probing `/api/{augur,…}` with the Lantern secret returns 401 — they're separate values. Operator must verify the GitHub Actions secret matches what Vercel expects for the agents project (cannot determine from .env alone).
17. **`settings/connected-sites` uses a process-local Map.** Vercel cold-starts wipe state and there's no per-user scoping (LL-6 acknowledges this). The Disconnect button is theatre until backed by PosternKeyRegistry.
18. **`research-attestation/latest` route fetches IPFS with 3s timeout on the request hot path.** No caching beyond `next:revalidate`. A slow gateway will surface as 503 to the UI. Consider moving to a background job or caching at the edge.

## Polish items

19. `subgraph/indexing-todo.md` Tier-4 (`PosternSessionKey` action-log + per-action `AgentAction` entity). Two panels stay in "indexing pending" state.
20. `protocol/metrics` `first: 1000` Scribe page cap — known TVL undercount past 1000 accounts. Acknowledged in code comment.
21. `trade/margin-impact` hardcodes `initialBps` per venue (`route.ts:60`). Should read from Portico adapter view-calls.
22. `transfer/quote` returns fixed `'$0.00 · Postern sponsored'` — when paymaster wiring lands, switch to a real Pimlico estimate.
23. `tax/allowance` is UK-only with hardcoded `UK_GBP_TO_USD = 1.27` constant. FX-rate drift across the year not tracked.
24. `agents/issue-mandate` echoes back `accepted:{…}` on validation success even though the route can't actually persist the mandate (Sigil-deploy gate). Borderline misleading — the response payload reads like success.
25. `next.config.mjs` rewrites land `/` on a static HTML bundle (`landing-v2.html`) — make sure the Sentry instrumentation still attaches to the App Router routes underneath (it does, but worth a sanity check after a Next major-version bump).
26. The `Counter` aggregate entity in the schema (`schema.graphql:199`) is dead code — no handler writes it and no route reads it. Either implement or drop.
27. `apps/verify/src/lib/deployments-registry.ts:23-30` flags a known dual-path drift (`deployments/arbitrum_sepolia.json` vs `deploy/arbitrum-sepolia.json`). Worth unifying.

---

## What is currently producing real, non-pending data for a fresh page-load

The honest-pending discipline is excellent but means the verify-app today, with no `DEMO_WALLET_ADDRESS` set and an empty subgraph, shows essentially no real numbers. The only live data a public visitor sees:

- 30 deployed contract addresses (from registry JSON)
- 9 of 9 venue adapters reported as deployed
- Hyperliquid testnet orderbook (live L2 from HL info API)
- Coffer `totalAssets()` = `$0.00` (real but uninteresting)
- Aqueduct transfer-quote = `8.4s · $0.00 LINK · $0.00 gas` (deterministic constants but honest)
- Subgraph block height (`alerts/recent` returns block-current empty array)

Every per-user surface, every TVL claim, every agent count, every attestation root: **honest pending**. That matches `LAUNCH_READY.md §6`: "what we read IS real, but most of what users see is honest-pending placeholders." Verified.

The mechanical fix for unblocking ~80% of the gated surfaces is small:
1. Point every `SCRIBE_URL` at `/version/latest`.
2. Set `DEMO_WALLET_ADDRESS` (or remove the gate and key off a session-cookie/wallet-connect address).
3. Fix the Rostrum + AtriumRouter `0x0` addresses in `subgraph.yaml` and redeploy the subgraph.
4. Implement Tablet `/summary` + `/events` OR drop the verify-app routes that call them.
5. Stock the Coffer (any user deposit) so Lantern starts publishing.

None of these are weeks of work. The pipeline architecture is in good shape; the wiring just hasn't been turned on.
