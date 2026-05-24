# Atrium Deploy Plan — Arbitrum Sepolia

Deployer: `0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42` · funded 0.19 ETH
Generated: 2026-05-23 · last updated 2026-05-23 (post launch session 2)

## Live URLs (production)

| Surface | URL | Notes |
|---|---|---|
| **Landing + full app** | `https://verify-n7xoe20z3-pratiikpys-projects.vercel.app/` | New visual landing at `/`, full app at `/app/*`, 7-step Verifier at `/verify/[1-7]`, public pages at `/docs`, `/security`, `/brand`, `/learn`, `/manifesto`, `/team`, `/cohort`, `/lantern`, `/changelog`, `/agents/marketplace`, `/rostrum`, `/benchmarks`, `/legal/privacy`, `/legal/terms`. |
| **Codex API** | `https://atrium-codex.prtk8899.workers.dev/` | x402-payable gateway on Cloudflare Workers. D1 database live. |
| **Tablet (tax)** | `https://tablet-jd321k29d-pratiikpys-projects.vercel.app/` | Python FastAPI on Vercel. SSO-wall-on (toggle off in dashboard). |
| **Lantern cron** | `https://lantern-attestor-blqvhote1-pratiikpys-projects.vercel.app/api/cron` | Daily POR cron (hobby tier limit). CRON_SECRET-gated; not for direct browser use. |
| **3 reference agents** | DigitalOcean droplet `157.245.201.53` | Augur + Haruspex + Auspex in Docker compose, idle until Plinth deploys. |
| **Subgraph (Scribe)** | `https://api.studio.thegraph.com/query/1753863/atrium-arbitrum-sepolia/v0.0.1` | 38 entities indexing, zero errors. |

## Status snapshot

| Group | Count | Status |
|---|---|---|
| Standalone Solidity contracts | 7 / 7 | **LIVE on Arbitrum Sepolia**, all verifications submitted to Sourcify |
| Missing UI features | 4 / 4 | **BUILT**, all 585 tests passing |
| Vercel deploys | 3 / 3 | verify + tablet + lantern all live, env vars wired |
| DigitalOcean droplet | 1 / 1 | hardened, Docker, 3 agents running |
| Cloudflare Workers | 1 / 1 | Codex API live |
| Subgraph | 1 / 1 | indexing, 0 errors |
| Sentry | 1 / 1 | wired into Next.js prod |
| Stylus contracts (Coffer, Plinth, Sigil, Vigil) | 0 / 4 | **BLOCKED** on stylus-sdk const-eval bug under Rust 1.92 |
| Stylus-dependent Solidity (Aqueduct, Router, Postern, Rostrum) | 0 / 5 | Blocked behind Stylus |
| Venue adapters | 0 / 10 | Phase N+1 |

## Launch-ready user-only blockers

1. **Disable Vercel SSO on `tablet` + `lantern-attestor` projects** (verify already public). Open https://vercel.com/pratiikpys-projects/tablet/settings/deployment-protection and https://vercel.com/pratiikpys-projects/lantern-attestor/settings/deployment-protection — toggle "Vercel Authentication" off, save.
2. **Claim domain from GitHub Student Pack** (atrium.tech via .TECH, or .app / .dev / .live from Name.com). Then paste name to me — I wire DNS via Vercel.
3. **Approve Stylus migration** to unlock deposit/trade/kill switch (30-50h code job).
4. **Cohort partner outreach** (zero today).
5. **Rotate exposed testnet keys** after launch (deployer pk, CF token, Sentry DSN — all visible in this chat history).

## Live contracts (Arbitrum Sepolia, chain 421614)

| Slug | Address | Block |
|---|---|---|
| praetor-timelock | `0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4` | 270408443 |
| portico-registry | `0x9a9af6e50491cd4694699d48564bbff18f9b40bc` | 270408449 |
| lantern-attestor | `0x900a9fb4bab7576fc11e4bb3c002d89dbe261168` | 270408455 |
| curator | `0x21c5ecc5b3ad6b066ef32145a06ed1b688d3103d` | 270408461 |
| edict | `0x66577042b4d47312e554bbfa5e29ae20f55dd631` | 270408469 |
| research-attestation | `0xfabc1fee1342be58996fec74cfc3612d4ac8a0ba` | 270408474 |
| stoa | `0x6d655803bac4bf61ad5ad26fd3b88429671cb5db` | 270408479 |

Source verified on Sourcify (job IDs in conversation log). Source visible at https://sourcify.dev/server/files/421614/ once Sourcify finishes processing.

## UI features built this session

| Feature | Files |
|---|---|
| Risk Preview modal (first-trade gate) | `apps/verify/src/components/trade/risk-preview-modal.tsx` + wired into `order-form.tsx` |
| Top-up flow (buffer-low banner + pre-filled modal) | `apps/verify/src/components/portfolio/top-up-banner.tsx` + wired into portfolio page |
| Emergency close (no-liquidity path) | `apps/verify/src/components/portfolio/emergency-close-banner.tsx` + `apps/verify/src/lib/use-emergency-close.ts` + wired into open-positions-table |
| Per-row Revoke button | `apps/verify/src/components/agents/my-mandates-panel.tsx` (rewritten) + `apps/verify/src/lib/use-revoke-mandate.ts` |

Tests added: `emergency-close-banner.test.ts` (4 tests), `risk-preview-modal.test.ts` (4 tests). Total suite: **585 passed, 0 failed**.

## Blockers found

1. **Cyclic init in Stylus contracts.** Coffer needs Plinth's address; Plinth needs Coffer/Vigil/Sigil; Sigil needs Plinth + PosternKillSwitch; Vigil needs Plinth + Coffer. No post-init setters on any Stylus contract. Same cycle in Solidity between `PosternKillSwitch` and `PosternKeyRegistry`.
2. **Workspace Cargo.lock out of date.** `cargo stylus check` fails on Coffer with `lock file needs to be updated but --locked was passed`. Needs a workspace `cargo update` before any Stylus build.
3. **No deploy script exists.** No `script/Deploy.s.sol`, no Stylus deploy orchestration, no `deployments/arbitrum_sepolia.json` writer.

## Resolution path

**Cycle**: pre-compute every contract address from deployer nonce (deployer fresh, nonce 0, deterministic CREATE address = `keccak256(rlp([deployer, nonce]))[12:]`). Init each contract with the pre-computed addresses of its dependencies. **No contract changes.**

**Lockfile**: run `cargo update` at workspace root once, verify Stylus check passes on one contract before continuing.

**Script**: build it in three layers (Solidity forge script + shell glue for Stylus + deployments-registry writer in Node).

## Testnet constant addresses (Arbitrum Sepolia)

| Service | Address | Source |
|---|---|---|
| USDC | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | Circle docs |
| LINK | `0xb1D4538B4571d411F07960EF2838Ce337FE1E80E` | Chainlink docs |
| CCIP Router | `0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165` | Chainlink CCIP docs |
| Chainlink ETH/USD feed | `0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165` | Chainlink docs |
| Pyth | `0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF` | Pyth docs |
| EntryPoint v0.7 (ERC-4337) | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | eth-infinitism canonical |

All six need a sanity verification (cast code call) before the deploy fires.

## Deploy order (every step writes to the registry)

```
nonce 0  → PraetorTimelock(deployer)         [Solidity, no deps]
nonce 1  → PosternKeyRegistry(predicted PKS) [Solidity, needs PKS addr]
nonce 2  → PosternKillSwitch(predicted Sigil, EntryPoint, KeyRegistry)
nonce 3  → PorticoRegistry(deployer, Timelock)
nonce 4  → LanternAttestor(signing_key, deployer, Timelock)
nonce 5  → Curator(deployer, Timelock, USDC)
nonce 6  → Edict(deployer, Timelock, address(0))
nonce 7  → ResearchAttestation(Timelock)
nonce 8  → StoaBlackScholes()                [no constructor]
nonce 9  → Rostrum(predicted Plinth, deployer, Timelock)
nonce 10 → Coffer (Stylus) init(USDC, predicted Plinth, deployer, Timelock, caps)
nonce 11 → Plinth (Stylus) init(Coffer, predicted Vigil, predicted Sigil, PorticoRegistry, chainlink, pyth, deployer, Timelock)
nonce 12 → Sigil  (Stylus) init(deployer, Timelock, Plinth, address(0) erc8004, PosternKillSwitch)
nonce 13 → Vigil  (Stylus) init(Plinth, Coffer, PorticoRegistry, deployer, Timelock)
nonce 14 → Aqueduct(CCIP_Router, USDC, LINK, Coffer, deployer, Timelock)
nonce 15 → AtriumRouter(Plinth, Coffer, PorticoRegistry, deployer)
```

Adapters defer to a second phase (10 separate adapter deploys, each into PorticoRegistry).

## Stylus deploy reality check

`cargo stylus deploy` uses CREATE under the hood. **Need to verify the activation step doesn't consume an extra nonce** before we trust the pre-compute. If activation is a separate tx from a different sender (Stylus activator), no extra deployer nonce. If activation is from the deployer, nonce drifts and the script must account for it. Phase 0 step 3 below validates this.

## Execution phases

### Phase 0 — Environment
- [ ] `cargo update` at workspace root, commit lockfile (?check with founder)
- [ ] `cargo stylus check` passes on Coffer
- [ ] `cargo stylus check` passes on Plinth, Sigil, Vigil
- [ ] Verify Stylus deploy uses exactly 1 deployer nonce per contract (test on Anvil or read Stylus 0.5 docs)
- [ ] Verify all 6 testnet addresses with `cast code`

### Phase 1 — Deploy script
- [ ] `script/Deploy.s.sol` — Solidity contracts in nonce order with pre-computed Stylus addresses passed as constructor args
- [ ] `scripts/deploy-stylus.sh` — sequential cargo stylus deploys with init args, each validated against pre-computed address
- [ ] `scripts/predict-addresses.mjs` — deterministic CREATE-address pre-computer (input: deployer + start-nonce; output: full address table)
- [ ] `scripts/save-deployments.mjs` — write `deployments/arbitrum_sepolia.json` after each phase

### Phase 2 — Dry-run on local Anvil fork
- [ ] Launch `anvil --fork-url https://arbitrum-sepolia.publicnode.com`
- [ ] Run Solidity portion against Anvil
- [ ] (Stylus can't run on Anvil — accept this as a real testnet risk)
- [ ] Sanity-check: every constructor arg resolves to the right address

### Phase 3 — Real deploy
- [ ] Run `forge script script/Deploy.s.sol --broadcast --rpc-url $ARB_SEPOLIA --verify --etherscan-api-key $ARBISCAN_API_KEY`
- [ ] Run `scripts/deploy-stylus.sh` interleaved at correct nonces
- [ ] Validate every deployed address matches the pre-computed table; abort on any mismatch
- [ ] Verify each Stylus contract is `cargo stylus activated` (or activate explicitly)

### Phase 4 — Registry + UI wake-up
- [ ] Write `deployments/arbitrum_sepolia.json` with all 16 addresses + block numbers
- [ ] Confirm `apps/verify` reads it (the `loadDeploymentRegistry()` call returns non-null)
- [ ] Smoke-test: open the deposit page, see the button enabled

### Phase 5 — Verify on Arbiscan
- [ ] Auto-verification via `--verify` for Solidity
- [ ] Manual verification for Stylus via `cargo stylus verify`
- [ ] Confirm each address shows source code on arbiscan

## Adapters (separate later phase)

Each of the 10 venue adapters needs its own constructor args (venue contracts, vault, oracle). Not load-bearing for the demo. Deploy after the core 16 are live and one happy-path trade works on at least one venue.

## Risk register

| Risk | Mitigation |
|---|---|
| Nonce drifts mid-deploy (any tx fails) | Abort on first failure; print state; do not continue |
| Stylus activation is a second deployer tx | Phase 0 step verifies this before committing |
| Predicted address mismatch on deploy | Abort on first mismatch; do not save partial registry |
| Lock file conflicts after `cargo update` | Founder decision — accept the diff or pin versions |
| Arbitrum Sepolia RPC rate-limit | Use multiple public RPCs in rotation; or switch to Alchemy |
| Run out of ETH mid-deploy | We have 0.19; each Solidity contract ≈ 0.005 ETH on Arb, Stylus more. Budget 0.10 total. |

## Definition of done

- `deployments/arbitrum_sepolia.json` exists with 16 entries
- `loadDeploymentRegistry()` returns non-null in the UI
- Deposit page renders an enabled button
- One smoke-test deposit transaction lands successfully
- All addresses verified on Arbiscan
- Deploy script is re-runnable (idempotent: skips already-deployed contracts based on registry)

## What's explicitly out of scope (Phase N+1)

- 10 venue adapters (separate phase)
- Subgraph deploy (separate phase)
- Services: Lantern cron, Codex API, Tablet, agents (separate phase)
- Mainnet anything (this is testnet)
