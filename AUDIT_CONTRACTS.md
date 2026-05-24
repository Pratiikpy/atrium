# Atrium contracts audit — 2026-05-24

Auditor: A (contracts + on-chain wiring). Scope: 31 deployed contracts on Arbitrum Sepolia + all `script/Phase*.s.sol`. Not in scope: frontend, subgraph runtime, off-chain services. All on-chain probes use `https://arbitrum-sepolia.publicnode.com` via `cast` in the `ghcr.io/foundry-rs/foundry` container.

## Headline (one paragraph)

The chain has **31 contracts deployed and zero of them wired into a working flow**. Plinth is the one Stylus contract that initialized itself via its `#[constructor]` (storage slots 4–13 read as the expected dependency addresses), but Coffer, Sigil, and Vigil all use a manual `initialize(...)` pattern that **was never called** — every storage slot reads `0x00…00`, so `Coffer.asset()`, `Coffer.totalAssets()`, and `Sigil.praetorMultisig()` all return zero or revert. No flow that touches a vault, mandate, or liquidation can succeed today. On top of that, three pieces of wiring exist only on paper: (1) `AtriumRouter.open_position_via_adapter` calls `coffer.adapter_pull(...)` using a snake_case selector that does not match Stylus's camelCase export `adapterPull`, and also calls `is_adapter_approved(address)` which no Coffer build exposes; (2) `PraetorTimelock.emergencyPause` invokes `IPausable(target).pause(string)` but Plinth and Coffer expose `pause(bytes32 reason)` — selectors `0x6da66355` vs `0xed56531a`, so the documented emergency-pause path reverts on every Stylus contract; (3) the 13 PhaseB3 scheduled actions whitelist adapters in PorticoRegistry but **never call `Coffer.set_adapter(...)`**, so even after the 48h timelock window expires no adapter or the Router can pull collateral from Coffer. The 9 venue adapters are deployed and 8 of them carry the `onlyAuthorizedCaller` orchestrator pattern, but Praetor never called `setAuthorizedCaller(AtriumRouter, true)` on any of them. AaveHorizonAdapter at `0xe991…` is the legacy v1.0 (`onlyCoffer`-only) — the v1.1 build with `onlyAuthorizedCaller` exists in `contracts/adapters/aave-horizon/src/AaveHorizonAdapterV11.sol` but was not the artefact deployed. None of this is a Stylus-migration regression — event signatures and ABIs match across `Coffer.json`, `Plinth.json`, `Vigil.json`, the subgraph manifest, and the contract source. The migration is clean. The remaining work is post-deploy choreography that was scheduled, partially scripted, but not executed.

## Critical findings (must fix before testnet launch)

### C-1. Coffer was never initialized — `asset()`, `totalAssets()`, all admin reads return zero

- Severity: **critical**
- File/contract: `contracts/coffer/src/lib.rs:155-189` (`initialize(...)`) — Coffer `0x7420084855421ef0794a971bd5190f5c0c292071`
- Evidence:
  - `cast call 0x7420…2071 "asset()(address)"` → `0x0000000000000000000000000000000000000000`
  - `cast call 0x7420…2071 "totalAssets()(uint256)"` → `0`
  - `cast call 0x7420…2071 "totalSupply()(uint256)"` → `0`
  - Raw `cast storage 0x7420…2071 <slot>` for slots 0..11 all return `0x00…00`
  - The deployment registry lists an `activationTx` (`0x7ca26822e99cb210050b2e81f2614cbbbc1ddcadb238ad385ecb9ad08e19e2fd`) but Coffer has no `#[constructor]` — Stylus activation is not the same as calling `initialize(...)`. Compare against Plinth which DOES have `#[constructor]` (`contracts/plinth/src/lib.rs:263-303`) and reads back correctly: slot 4 = Coffer, slot 5 = Vigil, slot 6 = Sigil, slot 7 = PorticoRegistry, slot 8 = Chainlink ETH/USD, slot 9 = Pyth, slot 10 = praetor (deployer), slot 11 = timelock, slot 12 = PlinthMath, slot 13 = PlinthOracle — all expected.
- Recommendation: send one tx that calls `Coffer.initialize(USDC, Plinth, deployer_as_praetor, PraetorTimelock, deposit_cap_wei, per_user_cap_wei)`. The function checks `praetor_multisig == 0`, so it's only callable once. Pick caps that match `ATRIUM_FULL_FLOW_DESIGN.md` (suggest 1e12 USDC global, 5e10 per-user for testnet — i.e. $1M / $50k). Add the call to a new `script/PhaseB4-Initialize.s.sol`.

### C-2. Sigil was never initialized — every storage slot reads zero

- Severity: **critical**
- File/contract: `contracts/sigil/src/lib.rs:128-170` (`initialize(...)`) — Sigil `0xefd38821466ca31e0b1734f89f1d6ec9a4bc70d0`
- Evidence:
  - `cast storage 0xefd3…70d0 5` (slot for `praetor_multisig` after the 5 mappings) → `0x00…00`
  - `cast call 0xefd3…70d0 "praetorMultisig()(address)"` → reverts with empty data (storage field not exposed via auto-getter on Stylus; even so, raw storage scan confirms uninitialized).
  - `cast call 0xefd3…70d0 "getOpenNotional(address)(uint256)" 0x000…01` returns `0` — so the contract is reachable and code is live; it just has nothing in storage.
- Recommendation: `Sigil.initialize(praetor=deployer, praetor_timelock=PraetorTimelock, plinth=Plinth, erc8004_registry=0xdead-or-real, postern_kill_switch=PosternKillSwitch)`. Sigil sets `hard_cap_wei`, `reputation_multiplier_bps`, `max_mandate_duration_seconds`, `max_actions_per_24h_hard_cap` inside `initialize` — leave them at the defaults baked into the function. **Domain separator (line 164-168) is the hashed-name `keccak256("AtriumSigil")` + version `keccak256("1")` + chainId + verifyingContract, built lazily inside `validate_action`**, so no chainId-encoded `domain_separator` parameter is needed — but the contract field stays zero, which is fine as `validate_action` recomputes the digest per call.

### C-3. Vigil was never initialized — keeper-staking, liquidation queue all bricked

- Severity: **critical**
- File/contract: `contracts/vigil/src/lib.rs:157-195` (`initialize(...)`) — Vigil `0x67713074650ad05c832c781101ac447cb847522e`
- Evidence:
  - `cast storage 0x6771…522e 3` (slot `praetor_multisig` after 3 address slots) → `0x00…00`
  - `cast call 0x6771…522e "activeKeeperCount()(uint32)"` → `0` — the keepers array is empty (consistent with uninitialized state).
  - `Plinth.do_update_margin` (`contracts/plinth/src/lib.rs:849-856`) calls `vigil.queue_liquidation(user, new_version)` on underwater accounts. If Vigil is uninitialized the call enters `queue_liquidation` (`vigil/src/lib.rs:198`) and immediately reverts with `Unauthorized(caller=Plinth)` because `plinth_address` storage is `0x00`. Plinth catches the revert and emits `VigilQueueFailed`, but no liquidation job is ever queued. The user stays paused with no enforcement path — exactly the failure mode the AAA-1 audit fix was supposed to surface, not the steady state.
- Recommendation: `Vigil.initialize(plinth=Plinth, coffer=Coffer, portico_registry=PorticoRegistry, praetor=deployer, praetor_timelock=PraetorTimelock)`. Once initialized, Praetor must `stake_keeper{value: 1000 ether}()` from at least one keeper account — Vigil's `params.keeper_min_stake_wei = 1000 * 10^18` per `vigil/src/lib.rs:188`. **On Arbitrum Sepolia 1000 ETH is not realistic**; reduce `keeper_min_stake_wei` via a timelock-gated `set_param` call (no such function exists today — see F-7 below) or hard-code a testnet-appropriate value in a fresh deploy.

### C-4. `AtriumRouter` uses the wrong selector for `Coffer.adapterPull` and calls a non-existent view

- Severity: **critical** (every Router-mediated open and close reverts)
- File/contract: `contracts/atrium-router/src/AtriumRouter.sol:37-38, 56-58, 195, 213`
- Evidence:
  - Source line 38: `function adapter_pull(uint256 amount, address from_user, address to) external;` — snake_case selector `adapter_pull(uint256,address,address)`.
  - Stylus exports snake_case Rust as camelCase Solidity per the G-2 audit comment in `contracts/coffer/src/lib.rs:104-107` and confirmed live by the Aqueduct + Vigil interfaces which declare `adapterPull(...)`. The deployed Coffer ABI selector is `adapterPull(uint256,address,address)`, not `adapter_pull(...)`. The Router's `coffer.adapter_pull(amount, user, adapter_addr);` (line 213) will call selector `0xb14a3fe9` instead of `0x8e2ee066`, hitting Coffer's fallback (no fallback defined) → revert.
  - Source line 56-58: `interface ICofferApprovedQuery { function is_adapter_approved(address adapter) external view returns (bool); }`. `Grep is_adapter_approved` across `contracts/coffer/` returns **zero matches** — Coffer declares `mapping(address => bool) approved_adapters` (line 128) but never exposes it as a public view. Stylus storage fields in `sol_storage!` are private by default. So every Router open/close on line 195 reverts before reaching the adapter.
- Recommendation:
  1. Patch `AtriumRouter.sol` line 38 to `function adapterPull(uint256, address, address) external;` and line 213 to `coffer.adapterPull(...)`, then redeploy AtriumRouter.
  2. Add `pub fn is_adapter_approved(&self, adapter: Address) -> bool { self.approved_adapters.getter(adapter).get() }` to Coffer (`contracts/coffer/src/lib.rs` near the other view fns). This means re-deploying Coffer (Stylus contracts are not upgradeable today — there is no UUPS proxy for the Stylus contracts despite the PRD pattern), OR delete the `ICofferApprovedQuery` defense-in-depth check in AtriumRouter and rely solely on the multisig discipline (Praetor must NEVER call `Coffer.set_adapter(sub_adapter, true)` directly; only the Router goes through `adapter_pull`).

### C-5. `PraetorTimelock.emergencyPause` cannot reach Plinth, Coffer, Sigil, or Vigil

- Severity: **critical** (emergency pause is a Year-1 security pillar per `.claude/rules/security.md`)
- File/contract: `contracts/praetor-timelock/src/PraetorTimelock.sol:11-13, 93-101`
- Evidence:
  - `IPausable.pause(string calldata reason)` (line 12). `cast sig "pause(string)"` = `0x6da66355`.
  - `contracts/coffer/src/lib.rs:550 pub fn pause(&mut self, reason: B256)` → `pause(bytes32)`. `cast sig "pause(bytes32)"` = `0xed56531a`. Same for Plinth `contracts/plinth/src/lib.rs:612`.
  - Sigil and Vigil **do not expose any `pause(...)` function at all** (`Grep "pub fn pause"` in `contracts/sigil/src/lib.rs` and `contracts/vigil/src/lib.rs` returns no matches), so the timelock's emergencyPause path has no target there even with a matching signature.
  - Aqueduct's `pause(string calldata reason)` (line 172) IS the right shape and would work — but Aqueduct is one of seven pausable surfaces, and the Stylus ones are the largest blast radius.
- Recommendation: pick one ABI and converge. Recommended: change `PraetorTimelock.IPausable.pause` to `pause(bytes32 reason)` and patch Aqueduct.pause likewise. Cheaper to redeploy PraetorTimelock + Aqueduct (Solidity) than to redeploy 3 Stylus contracts. Also add `pub fn pause(&mut self, reason: B256)` to Sigil and Vigil so the three Stylus contracts share an interface. The `B256` keccak digest is already the documented carrier per the comment in `contracts/coffer/src/lib.rs:42-43`.

### C-6. Adapters cannot be reached by `AtriumRouter` — `setAuthorizedCaller(Router, true)` never called

- Severity: **critical**
- File/contract: 8 of 9 adapters carry the `onlyAuthorizedCaller` modifier (Curve, GMX, HyperliquidHybrid, Morpho, Pendle, Polymarket, Synthetix, TradeXyz). AaveHorizon v1.0 is the exception — see C-7.
- Evidence:
  - `cast call 0xf3da…5682 "is_authorized_caller(address)(bool)" 0xf134…2717` (Curve) → `false`
  - `cast call 0xfabe…344e "is_authorized_caller(address)(bool)" 0xf134…2717` (Morpho) → `false`
  - `cast call 0x98a6…08db "is_authorized_caller(address)(bool)" 0xf134…2717` (Polymarket) → `false`
  - `cast call 0x8701…371e "is_authorized_caller(address)(bool)" 0xf134…2717` (Hyperliquid) → `false`
  - `setAuthorizedCaller(...)` is `onlyPraetor`, so this is a 9-tx script for the multisig. Not present in any `script/Phase*.s.sol`.
- Recommendation: add a `script/PhaseB5-AuthorizeRouter.s.sol` that, from the praetor EOA, calls `setAuthorizedCaller(ATRIUM_ROUTER, true)` on the 8 v1.1 adapters. Skip Aave until C-7 is resolved.

### C-7. AaveHorizonAdapter at `0xe991…` is the legacy v1.0 — has no `onlyAuthorizedCaller`, no `setAuthorizedCaller`, no `setRiskParams`

- Severity: **high** (1 of 10 venue-ids permanently unreachable through the Router)
- File/contract: `contracts/adapters/aave-horizon/src/AaveHorizonAdapter.sol` (deployed) vs `AaveHorizonAdapterV11.sol` (intended)
- Evidence:
  - `cast call 0xe991…8d5d "name()(string)"` → `"AaveHorizon"`, `version()` → `(1, 0, 0)`.
  - `cast call 0xe991…8d5d "is_authorized_caller(address)(bool)" 0xf134…2717` → reverts (no such function). V1 only has `onlyCoffer` (line 95-98 of v1.0).
  - PhaseC.s.sol line 47-49 imports `AaveHorizonAdapter` (v1.0), not `AaveHorizonAdapterV11`. Deploy script picked the wrong artefact.
  - The PhaseB3 schedule registers venue-id 2 with `expected_major_version = 1` (matches v1.0), so registry-side this is consistent, but the Router cannot route to it.
- Recommendation: redeploy Aave Horizon adapter using `AaveHorizonAdapterV11` (`contracts/adapters/aave-horizon/src/AaveHorizonAdapterV11.sol`). Update the PhaseB3 schedule's `expected_major_version` for venue-id 2 to `2` (V11 reports major=2 presumably; verify by reading `version()` of the new deploy). Cancel the existing scheduled action via `PraetorTimelock.cancel(id)` before the 48h window expires, then re-schedule.

### C-8. `Coffer.set_adapter(...)` never scheduled — Aqueduct and AtriumRouter cannot pull collateral

- Severity: **critical**
- File/contract: `script/PhaseB3-Schedule.s.sol` (no occurrence of `set_adapter` / `setAdapter`)
- Evidence:
  - `Grep "set_adapter|setAdapter" script/` returns no matches.
  - Aqueduct's `send_collateral` (`contracts/aqueduct/src/Aqueduct.sol:214`) calls `coffer.adapterPull(...)` — Coffer line 453 checks `approved_adapters[caller]`. Without a `set_adapter` call, every adapter call reverts with `UnauthorizedCaller(caller=Aqueduct)`.
  - Same for AtriumRouter once C-4 is fixed.
- Recommendation: add three scheduled actions to PhaseB3 (or a new PhaseB6):
  - `Coffer.setAdapter(AtriumRouter, true, ROUTER_PER_BLOCK_CAP_WEI)` — suggest cap = 1% of testnet deposit cap.
  - `Coffer.setAdapter(Aqueduct, true, AQUEDUCT_PER_BLOCK_CAP_WEI)` — suggest 0.5% (CCIP traffic is bursty).
  - `Coffer.setAdapter(Vigil, true, VIGIL_PER_BLOCK_CAP_WEI)` — needed for Vigil to forward liquidated collateral back to the receiver. Suggest 5% (forced unwinds are exceptional).

  All three go through PraetorTimelock with the standard 48h window.

## Wiring gaps (post-deploy admin actions still pending)

| Action | Target | Caller | In any script? | Effect if skipped |
|---|---|---|---|---|
| `Coffer.initialize(...)` | Coffer | deployer (one-time, msg.sender-bound) | **No** | C-1 — vault permanently unusable |
| `Sigil.initialize(...)` | Sigil | deployer (one-time) | **No** | C-2 — agent mandates impossible |
| `Vigil.initialize(...)` | Vigil | deployer (one-time) | **No** | C-3 — no liquidation engine |
| `Coffer.setAdapter(Router, true, cap)` | Coffer | timelock | **No** | C-8 — Router open/close fails |
| `Coffer.setAdapter(Aqueduct, true, cap)` | Coffer | timelock | **No** | C-8 — cross-chain transfer fails |
| `Coffer.setAdapter(Vigil, true, cap)` | Coffer | timelock | **No** | C-8 — Vigil can't pull during liquidation |
| `<each adapter>.setAuthorizedCaller(Router, true)` | 8 adapters | praetor | **No** | C-6 — Router cannot reach any venue |
| `Plinth.setInstrumentRisk(venue, instrument, ...)` | Plinth | timelock | **No** | `open_position` reverts `ERR_UNKNOWN_VENUE` for every venue |
| `PorticoRegistry.registerAdapter(...)` × 10 | PorticoRegistry | timelock | **Yes** — scheduled, awaiting 48h | Router lookups return `address(0)` |
| `Aqueduct.setAqueductOnDest(selector, addr)` | Aqueduct | timelock | **Yes** — scheduled | Cross-chain destination unset → revert |
| `AqueductReceiver.setAllowedSource(...)` | AqueductReceiver | timelock | **Yes** — scheduled | Incoming CCIP messages refused |
| `Aqueduct.setClaimbackRegistry(...)` | Aqueduct | timelock | **Yes** — scheduled | Double-spend defense disabled |
| `Aqueduct.depositLink(...)` (LINK top-up) | Aqueduct | anyone | **No** | `send_collateral` reverts `InsufficientLinkBalance` (current LINK balance: 0) |
| `LanternAttestor.rotateSigningKey(...)` | LanternAttestor | timelock | **No** | Live attestations still signed by deployer EOA — fine for testnet, must rotate before mainnet |
| `Faucet` stocking | Faucet | praetor | Done | Faucet has 40 USDC + 0.04 ETH (8 claims). OK. |
| `Vigil.stakeKeeper{value: 1000 ETH}()` | Vigil | keeper EOA | **No** | No active keepers → liquidations never execute. Also the 1000 ETH min stake is not feasible on Sepolia — must be reduced. |

Adapter venue-address re-pointing (C-7 + adapter-table below) and a `script/PhaseB4-Initialize.s.sol` for the three Stylus `initialize` calls are the gating dependencies. Until those land, nothing past step 4 of the 15 launch-ready flows works.

## Stylus migration ABI consistency

The 0.6 → 0.10 migration is **internally consistent**. Spot-check confirms:

| Surface | bytes32 reason / trigger? | bytes32 in subgraph ABI? | bytes32 in subgraph manifest? |
|---|---|---|---|
| `Coffer.DepositsPaused` | ✅ `bytes32 reason` (`coffer/src/lib.rs:43`) | ✅ (`subgraph/abis/Coffer.json:99-100`) | ✅ (`subgraph.yaml:115`) |
| `Coffer.WithdrawalsPaused` | ✅ | ✅ | ✅ (`subgraph.yaml:119`) |
| `Coffer.CircuitBreakerTripped` | ✅ `bytes32 trigger` | ✅ (`subgraph/abis/Coffer.json:162`) | ✅ |
| `Plinth.AccountPaused` | ✅ (`plinth/src/lib.rs:71`) | ✅ (`subgraph/abis/Plinth.json:105`) | ✅ (`subgraph.yaml:34`) |
| `Plinth.PlinthPaused` | ✅ | ✅ | ✅ |
| `Vigil.KeeperSlashed` | ✅ `bytes32 reason` (`vigil/src/lib.rs:29`) | ✅ (`subgraph/abis/Vigil.json:99`) | (handler present) |

`Plinth.PlinthErr(uint16 code)` consolidation (`plinth/src/lib.rs:92-94`) is consistent across the source — the 15 codes are listed at `plinth/src/lib.rs:97-111`. Off-chain consumers must decode `code` against this list; recommend adding a JSON map at `subgraph/abis/PlinthErrorCodes.json` and exporting from `services/codex` so the UI's error surfacer is not hard-coded.

The Stylus snake → camelCase export convention is in active use: confirmed live by `cast call PlinthOracle.safePrice(...)` returning a real revert (`OracleErr(uint16)` data), while `cast call Plinth.coffer_address()` reverts (no auto-getter), and `cast call Plinth.getAccount(addr)` returns the expected zero-tuple. The convention is real; the C-4 finding is a single Router-side miss, not a migration regression.

## Per-adapter venue-address status (9 adapters)

All 9 adapter contracts are deployed and accept calls; venue placeholders are the deployer EOA `0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42`. Each adapter call into the venue placeholder will revert with `call to non-contract` (the deployer is an EOA), which is the documented honest-failure mode per `script/PhaseC.s.sol:38-43`.

| Adapter | Venue placeholder | Real testnet contract exists? | Action when venue ships |
|---|---|---|---|
| AaveHorizon `0xe991…8d5d` | deployer EOA (Aave Pool slot) | **No** — Aave V3 has no Arbitrum Sepolia deployment (Aave V3 mainnet only). Aave Horizon is RWA-permissioned and lives behind a permit list on mainnet. | Need a vendor relationship + a testnet Aave V3 fork pool. Until then, treat venue-id 2 as permanently pending. **Also: redeploy with V11 build (C-7).** |
| Curve `0xf3da…5682` | deployer for both `_pool` and `_lp_token` | **No** — Curve has not deployed to Arbitrum Sepolia. | When Curve ships, call `setVenue(pool)` (no such function — adapter would need redeployment because `pool` is immutable). |
| GMX V2 `0x2531…d2d4` | deployer | **No** — GMX V2 testnet is on Avalanche Fuji only. | Redeployment required; `pool` is immutable. |
| HyperliquidHybrid `0x8701…371e` | deployer (bridge slot) | **No** — Hyperliquid bridges into Arbitrum mainnet, not Sepolia. | Redeployment required; `bridge` is immutable. Also requires HL HIP-3 / HIP-4 attestor validator set rotation via `setValidatorSet`. |
| Morpho Blue `0xfabe…344e` | deployer | **No** — Morpho Blue is on Base Sepolia, not Arb Sepolia, as of 2026-05-24. | Redeployment required. |
| Pendle V2 `0x54a1…af7d` | deployer | **No** Pendle V2 testnet on Arbitrum Sepolia. | Redeployment required. |
| Polymarket `0x98a6…08db` | venue is Aqueduct address (CCIP route to Polygon Amoy) | **Yes** — Polygon Amoy has Polymarket V1 conditional tokens. | Need to deploy a Polymarket-side AqueductReceiver pair on Amoy + configure `setAllowedSource` both ways. None of this scheduled. |
| Synthetix V3 `0x62b3…39b8` | deployer | **No** — Synthetix V3 is on Base, not Arb Sepolia. | Redeployment required. |
| Trade.xyz `0xf34c…a1ce` | deployer | **No** — Trade.xyz testnet only on dydx-style chain. | Redeployment required. |

**Action needed:** publish this table in `human_left.md` as the venue-pointer ledger so the front-end can render honest "pending: <vendor handoff>" labels on each venue chip. The current `LAUNCH_READY.md` section C only enumerates that adapters are deployed; it does not call out that all 9 are routing into EOAs.

## Timelocked action ledger (13 scheduled 2026-05-24)

`script/PhaseB3-Schedule.s.sol` scheduled 13 actions. From the on-chain `Scheduled(bytes32 id, address target, bytes data, uint64 scheduled_at)` event scan on PraetorTimelock for blocks 270745000-270900000 (confirmed at least 4 distinct event tx hashes — `0xa72c3e…`, `0xcc7d7b…`, `0xd9d609…`, plus the trailing 10):

| # | Target | Function | scheduled_at (unix) | Earliest execute (48h later) | Status |
|---|---|---|---|---|---|
| 1 | PorticoRegistry | registerAdapter(1, Hyperliquid HIP-3, codehash, 1) | 1779139504 (`0x6a12d1b0`) | 1779312304 (2026-05-26 22:18 UTC) | Pending |
| 2 | PorticoRegistry | registerAdapter(2, Aave Horizon, codehash, 1) | 1779139505 | 1779312305 | Pending — **stop and re-schedule per C-7** |
| 3 | PorticoRegistry | registerAdapter(3, Pendle V2, codehash, 1) | 1779139507 | 1779312307 | Pending |
| 4 | PorticoRegistry | registerAdapter(4, Curve, codehash, 1) | 1779139508 | 1779312308 | Pending |
| 5 | PorticoRegistry | registerAdapter(5, Trade.xyz, codehash, 1) | (likely 1779139509) | 1779312309 | Pending |
| 6 | PorticoRegistry | registerAdapter(6, Polymarket, codehash, 1) | 1779139510 | 1779312310 | Pending |
| 7 | PorticoRegistry | registerAdapter(7, Hyperliquid HIP-4, codehash, 1) | 1779139511 | 1779312311 | Pending |
| 8 | PorticoRegistry | registerAdapter(8, GMX V2, codehash, 1) | 1779139512 | 1779312312 | Pending |
| 9 | PorticoRegistry | registerAdapter(9, Synthetix V3, codehash, 1) | 1779139513 | 1779312313 | Pending |
| 10 | PorticoRegistry | registerAdapter(10, Morpho Blue, codehash, 1) | 1779139514 | 1779312314 | Pending |
| 11 | Aqueduct | setAqueductOnDest(ETH_SEPOLIA_SELECTOR, AqueductReceiver) | (later in run) | +48h | Pending |
| 12 | AqueductReceiver | setAllowedSource(ETH_SEPOLIA_SELECTOR, Aqueduct) | | +48h | Pending |
| 13 | Aqueduct | setClaimbackRegistry(AqueductClaimback) | | +48h | Pending |

**If any action never executes:**
- ids 1, 3-10 not executed → `PorticoRegistry.getAdapter(venue_id) == 0x0` for that venue, AtriumRouter reverts `VenueNotRegistered(venue_id)`. (Adapter still works via direct Coffer-only path, but Router-mediated open/close is dead.)
- id 2 — must not execute as-is per C-7 (wrong codehash will be verified against v1.0 build; recommend `cancel(id)` before 48h window expires).
- id 11 → `Aqueduct.send_collateral` reverts `UnsupportedDestination(selector)`.
- id 12 → CCIP delivery to AqueductReceiver reverts `UnknownSource(...)`.
- id 13 → `Aqueduct.claim_back` skips the delivery-ack check; double-spend window reopens per audit B-12.

**Each id can be recomputed by anyone** as `keccak256(abi.encode(target, data, uint256(scheduled_at)))` against `PraetorTimelock.executed` and `scheduledAt`. Recommend a `script/PhaseB3-Execute.s.sol` that calls `execute(target, data, scheduled_timestamp)` for each — it does not exist today, only the schedule script.

**Carve-out (not a finding):** the 48h timelock is the documented testnet floor. If the buildathon judging window pre-dates 2026-05-26 22:18 UTC, the entire on-chain flow stays gated regardless of every other fix. Recommend dropping `TIMELOCK_DURATION` to 1h for the testnet build (this requires a contract change — PraetorTimelock's value is `constant`, not stored — so it's a redeploy, not a setter call). Honest alternative: judges read from view functions and `AtriumRouter` events rather than walking a real flow.

## Reference repo cross-checks

- `resources/openzeppelin-contracts/contracts/governance/TimelockController.sol`: Atrium's `PraetorTimelock` is intentionally simpler (no role enumeration, no batch operations). The OZ pattern stores `getMinDelay()` as a setter-mutable variable; Atrium's is a `constant`. For a 1h testnet override this means redeploying PraetorTimelock — workable but worth tracking.
- `resources/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol`: Coffer's virtual-shares offset (1e6 shares + 1 asset) at `coffer/src/lib.rs:227` matches the OZ Upgradeable ERC4626 inflation defense exactly. `convert_to_shares_ceil` (line 250) implements the round-up withdraw helper the OZ spec recommends. Correct.
- `resources/chainlink-brownie-contracts/contracts/src/v0.8/ccip/applications/CCIPReceiver.sol`: AqueductReceiver's CCIPReceiverBase abstract at `contracts/aqueduct/src/AqueductReceiver.sol:6-24` is a faithful subset (just `onlyRouter` + `i_router`). The `ccipReceive` impl at line 125 correctly reads `destTokenAmounts[i].token` (audit B-6/F-4 fix) rather than re-decoding the message body — matches the Chainlink reference. `extraArgs: ""` on the send path at `Aqueduct.sol:226` deserves a note: CCIP v1.5 requires `_argsToBytes(EVMExtraArgsV1{gasLimit: ...})` on most destination chains. Empty bytes defaults to 200_000 gas on the destination — fine for testnet, brittle for production.
- `resources/account-abstraction/contracts/interfaces/IEntryPoint.sol`: PosternKillSwitch imports `@account-abstraction/interfaces/IEntryPoint.sol` but never invokes a single EntryPoint method — `IEntryPoint entryPoint` is a write-once immutable that no code path reads from in `activate(...)`. Either remove the field + import, or wire it to `IEntryPoint.handleOps(...)` for the session-key revocation path. The current state is dead weight that confuses auditors.
- `resources/stylus-sdk-rs/0.6+ stylus_sdk::testing::TestVM`: contract test suites under each Stylus contract still compile under stylus-sdk 0.10, but the recipe in `LAUNCH_READY.md` Phase A is silent on whether the harness changed. `cargo test` in `contracts/coffer/` is the only on-host verification we have today; recommend re-running before declaring Coffer+Sigil+Vigil "tested under 0.10".

## Things that are correct (call them out so the team doesn't re-audit)

- **Plinth constructor wiring is complete and correct.** Storage slots 4-13 read as Coffer / Vigil / Sigil / PorticoRegistry / Chainlink ETH-USD / Pyth / praetor=deployer / PraetorTimelock / PlinthMath / PlinthOracle. The cargo-stylus 0.10.7 multi-fragment factory did call the constructor. Pyth address `0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF` matches the Arbitrum-Sepolia row in `resources/pyth-crosschain/.../developer-hub/.../evm.mdx:92`. Chainlink ETH/USD `0xd30e2101…` is the documented Sepolia ETH/USD aggregator.
- **Plinth's reentrancy guard is correctly armed on every state-changing path** (`is_updating.set(true)` at function entry, cleared before return). `open_position` (line 327), `close_position` (line 440), `update_margin` (line 522). FIRE78-PLINTH-H1 fix is real.
- **Coffer's withdraw + adapter_pull both fail loud on Plinth call failure** (lines 380-385 + 469-471). KKK-3 + MMMM-1 + OOO-2 fixes hold up.
- **Coffer's USDC transfer return value is checked on every path** (`deposit` line 313-322, `withdraw` line 421-428, `adapter_pull` line 520-527). ZZ-5/6 fixes hold up; no silent money-loss path remains.
- **Sigil signature recovery is real** — `ecrecover_via_precompile` at `sigil/src/lib.rs:488-521` correctly builds the 128-byte precompile calldata and rejects malformed v values. G-3 fix is real, not a fail-open stub.
- **Vigil's `margin_version` race fix is real** (lines 286-311). M6 race closed.
- **PraetorTimelock's TargetNotAContract guard** (lines 73 + 98) catches the EOA-as-target footgun on both `execute` and `emergencyPause`.
- **PorticoRegistry's `emergencyDeregisterAdapter`** path (lines 100-116) gives the multisig a 1-tx delisting power without the 48h delay — needed for live-exploit response. FIRE77-PR5 fix lands correctly.
- **Faucet** is correctly stocked (40 USDC + 0.04 ETH on `0x7f3a…2bbc`) and the deprecated v1 at `0xb982…8549` is documented as such.
- **`AqueductReceiver.ccipReceive`** correctly reads USDC from `destTokenAmounts` (line 138-144) not the message body — B-6/F-4 fix.
- **All 23 Solidity contracts compiled under 0.8.28 with their PRD-mandated zero-address constructor guards in place** (DDD-5 / NNNN-1 / BBBBB-1 / MMM-10 pattern). Spot-checked AaveHorizonAdapter, AtriumRouter, AqueductReceiver, LanternAttestor, PorticoRegistry, PraetorTimelock, Rostrum, Curator (via grep).
- **Subgraph manifest event signatures match the migrated bytes32 fields exactly** — `subgraph.yaml:34, 115, 119` declare `(bytes32)` arms, and the `subgraph/abis/*.json` mirrors. No regression here.
- **Sourcify state** (per LAUNCH_READY.md line 244-245): all 13 Solidity contracts verified exact_match. Stylus contracts (Coffer, Plinth, Sigil, Vigil, PlinthMath, PlinthOracle) are not in scope — Sourcify has no Stylus wasm support. Verified the legacy 7 Phase-0 contracts (PraetorTimelock, PorticoRegistry, LanternAttestor, Curator, Edict, ResearchAttestation, StoaBlackScholes) by querying their public storage getters end-to-end (e.g. `cast call 0x900a…1168 "praetor_multisig()(address)"` returns the deployer EOA — so bytecode and ABI are intact, regardless of Sourcify cache state).

## Recommended next-step ordering (one founder afternoon)

Sequence matters; each step unblocks the next.

1. **Patch + redeploy AtriumRouter** with `adapterPull` selector and `is_adapter_approved` either fixed (Coffer redeploy) or removed (just multisig discipline). C-4. ~20 min.
2. **Patch + redeploy PraetorTimelock + Aqueduct** with unified `pause(bytes32)`. Add `pause(bytes32)` to Sigil + Vigil (Stylus redeploy). C-5. ~1h.
3. **Write `script/PhaseB4-Initialize.s.sol`** that calls `Coffer.initialize`, `Sigil.initialize`, `Vigil.initialize` from the deployer EOA. C-1/2/3. ~20 min.
4. **Redeploy Aave Horizon with V11 build.** Cancel the existing PhaseB3 schedule id for venue-id 2 via `PraetorTimelock.cancel`. C-7. ~15 min.
5. **Write `script/PhaseB5-AuthorizeRouter.s.sol`** that calls `setAuthorizedCaller(AtriumRouter, true)` on the 8 v1.1 adapters. C-6. ~15 min.
6. **Add three new schedules** for `Coffer.setAdapter(Router, ...)`, `Coffer.setAdapter(Aqueduct, ...)`, `Coffer.setAdapter(Vigil, ...)`. C-8. Wait 48h (or reduce TIMELOCK_DURATION first per the carve-out above). ~10 min.
7. **Fund Aqueduct with LINK** from the Chainlink testnet faucet (`Aqueduct.depositLink(amount)`). ~5 min.
8. **Rotate Lantern signing key** off the deployer EOA. ~30 min.
9. **Reduce `Vigil.params.keeper_min_stake_wei` to a Sepolia-feasible value** via a new timelock-gated setter (does not exist today — needs a `set_keeper_min_stake(U256)` fn on Vigil). ~20 min + Stylus redeploy.

Total: about 5h of focused work plus the 48h timelock window. Past step 7 the 15 launch-ready user flows are reachable end-to-end for the first time.

## Out of scope (for reference, do not act on these here)

- Frontend selector hard-codings (`apps/verify/src/lib/abi-literals/*`) — auditor B.
- Subgraph mapping correctness — auditor B.
- Codex / Lantern / Praetor / Augur service deploys — auditor C.
- Kani re-proofs after Stylus migration — held under `LAUNCH_READY.md` Phase A.
- Praetor multisig migration (deployer EOA → 3-of-5 Safe) — explicit in `LAUNCH_READY.md` Phase D, deferred.
