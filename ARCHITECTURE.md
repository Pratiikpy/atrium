# Atrium architecture

The full system: what every contract does, where it is deployed on both testnets,
how a position flows through it, and how it is secured. Every address below is a
live, verified deployment. This is the canonical reference; the high-level
conceptual version is in [`docs/architecture.md`](./docs/architecture.md), and the
auto-generated registry is in [`docs/deployment.md`](./docs/deployment.md).

---

## What it solves

A trader running positions across more than one on-chain venue posts collateral at
each venue separately. A `$50K` perp on one venue and a `$50K` cash position on
another sit as `$100K` of locked collateral even though the net risk is far smaller.

Atrium gives each user one margin account that prices net exposure across all
whitelisted venues: same wallet, same collateral, one liquidation surface, owned by
no venue.

## System map

```
  ┌────────────┐   signs    ┌────────────────────────┐
  │   Wallet   │──tx──────▶│  AtriumRouter (Sol)    │
  └────────────┘            │  dispatches to adapter │
                            └─────────┬──────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                ▼                     ▼                     ▼
         ┌────────────┐        ┌────────────┐        ┌─────────────┐
         │  Coffer    │        │   Plinth   │        │  Adapter[i] │
         │ (Stylus)   │◀──pull─│  (Stylus)  │        │  (Solidity) │
         │ ERC-4626   │  USDC  │  SPAN math │        │  per venue  │
         └────────────┘        └────────────┘        └─────────────┘
                ▲                     │
                │ inclusion           │ liquidation trigger
                │ proof               ▼
         ┌────────────┐        ┌────────────┐
         │  Lantern   │        │   Vigil    │
         │ (Sol)      │        │  (Stylus)  │
         │ proof of   │        │ liquidator │
         │ reserves   │        │  engine    │
         └────────────┘        └────────────┘
```

## Contract layer

| Contract | Language | Role |
|---|---|---|
| `Plinth` | Stylus (Rust) | SPAN portfolio-margin engine. One buying-power number across venues, netting correlated exposure. Split into `Plinth`, `Plinth-Math` (SPAN compute, to fit the 24 KB code cap), and `Plinth-Oracle` (dual-feed reader). |
| `Coffer` | Stylus (Rust) | ERC-4626 collateral vault. Approved orchestrators pull USDC up to a per-adapter, per-block cap. |
| `Sigil` | Stylus (Rust) | EIP-712 mandate validator. Recovers the owner from the signature on every delegated action; enforces caps. |
| `Vigil` | Stylus (Rust) | Liquidation queue and execute engine, gated on keeper stake. |
| `AtriumRouter` | Solidity | Opens and closes positions across margin to vault to venue adapter in one transaction. Probes adapter `version()` to route v1.0 or v1.1. |
| `PorticoRegistry` | Solidity | Whitelist of approved adapters, keyed by venue id. Changes go through the multisig and 48-hour timelock. |
| `PraetorTimelock` | Solidity | 3-of-5 multisig with a 48-hour delay on every parameter change. Separate instant `emergencyPause` lever with no delay (can pause, cannot upgrade). |
| `PosternKillSwitch` | Solidity | One transaction revokes every active Sigil mandate and Postern session key for the calling wallet, via `Sigil.revoke_all_on_behalf_of`. |
| `PosternKeyRegistry` | Solidity | On-chain registry of ERC-7715 session keys, with expiry and a clean-expired path. |
| `LanternAttestor` | Solidity | Stores a signed Merkle root of share balances roughly every 10 minutes; the off-chain attestor builds and signs the tree. |
| `Aqueduct` + `AqueductReceiver` + `AqueductClaimback` | Solidity | Chainlink CCIP collateral bridge with reorg-safe replay protection and a claim-back path. |
| `Edict` | Solidity | Jurisdiction tier registry; Plinth and Coffer can gate sensitive actions behind a minimum tier. |
| `Curator` | Solidity | Adapter curation and grant accounting. |
| `Adapters` | Solidity | Per-venue integrations, all implementing `IPorticoAdapter` (v1.0 or v1.1). |

## Live deployment, Arbitrum Sepolia (chain 421614)

RPC `https://arbitrum-sepolia.publicnode.com`. Solidity contracts are verified on
Sourcify (full match); Stylus contracts are verified with `cargo stylus verify`.

**Core (Stylus)**

| Contract | Address |
|---|---|
| Coffer | `0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3` |
| Plinth | `0xd86f579ec880eaab27dfa698ae056d1893ec7553` |
| Plinth-Math | `0xc53dbfc0c35291f79e7d8d876603ab35ab97ddab` |
| Plinth-Oracle | `0x66064d18722f50e055d74daf51a13fd8e331f0b7` |
| Sigil | `0xdba97d39ff790e69c3526bb0c0b99a38f686d6d9` |
| Vigil | `0x5ccd3422f430f6d034ff46715b41509de9d0deed` |

**Core (Solidity)**

| Contract | Address |
|---|---|
| AtriumRouter | `0xF593e012196BDe8A58Ccdbf685f7A74fD3bD35e0` |
| PorticoRegistry | `0x9a9af6e50491cd4694699d48564bbff18f9b40bc` |
| PraetorTimelock | `0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4` |
| PosternKillSwitch | `0xCD899f715462A33Ae880310d72b37bde102ab0b7` |
| PosternKeyRegistry | `0x28c9fd500d2d8e3b56259a1054e9da05dec747d8` |
| LanternAttestor (v2) | `0xF0B90b94C0B8a52c545768bFf06a3932c67d5888` |
| Aqueduct | `0x6139449bf43f44385d08640b2e6fd2b82cb87ec2` |
| AqueductReceiver | `0x49Bd2AF2d2ee1844235bb6500Ba4EC6F24704b42` |
| Edict | `0x66577042b4d47312e554bbfa5e29ae20f55dd631` |
| Curator | `0x21c5ecc5b3ad6b066ef32145a06ed1b688d3103d` |
| ResearchAttestation | `0xfabc1fee1342be58996fec74cfc3612d4ac8a0ba` |
| Rostrum | `0x748A0a4E53F3E94f9a279bfDC5eCbF8A7c88f093` |

**Venue adapters (Portico)**

| Venue | Address | Version |
|---|---|---|
| Aave Horizon | `0xd71C5D88d62e92EE8941cAE51f8637a73111C4E1` | v1.1.1 |
| Hyperliquid (HIP-3 + HIP-4) | `0x87014fbace9ade49bf923bcfae74b4c858cf371e` | v1.1 |
| Pendle | `0x54a1bc2c5c73cc531035b0f008c8a252a02daf7d` | v1.1 |
| Curve | `0xf3da25f3ff8bdddc093e34c2f2b117cdb7505682` | v1.1 |
| GMX | `0x2531af9f7596d74f412bfab7d3b84ee7a32cd2d4` | v1.1 |
| Morpho | `0xfabe2b0d1c66bc2976ed3b0c58f3cdcb7878344e` | v1.1 |
| Polymarket (via Aqueduct to Polygon Amoy) | `0x98a688723c47ab6909be04fd0aa3eca5ee8b08db` | v1.1 |
| Synthetix | `0x62b3b34ffa76fb62245702c0b7efd37832eb39b8` | v1.1 |
| Trade.xyz | `0xf34c38d9e61a1b1beafffbb681b07e489c36a1ce` | v1.1 |

**Tokens and utility**

| Item | Address | Notes |
|---|---|---|
| Testnet USDC | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | Collateral asset |
| Faucet | `0x7f3a714c824c0926ae98ecfb2e59513e78d82bbc` | 5 USDC + 0.0005 ETH per claim, 24h cooldown |
| MockAavePool | `0x2e1360faE80c7937e684067450202D921F72555B` | Testnet stub for Aave V3 Pool (Aave V3 is not on Sepolia) |

## Live deployment, Robinhood Chain testnet (chain 46630)

RPC `https://rpc.testnet.chain.robinhood.com`. The full stack is deployed, wired, and
verified. Because the chain lacked the canonical Stylus deployer, a copy of it was
deployed first so `#[constructor]` Stylus contracts could be deployed natively.

| Contract | Address |
|---|---|
| Plinth (Stylus) | `0xa08ba28ef31658df67e874dd2bf8a2b2d34597fa` |
| Coffer (Stylus) | `0x71d872bd76738887415439a7fc0a1acbc4218fbc` |
| Vigil (Stylus) | `0x6c6901a9ca6f13aede06f0d20050052a94a854da` |
| Sigil (Stylus, initialized) | `0xede8444c622b8ae28364e86784749744bd0a1c23` |
| AtriumRouter | `0xB90a51A726740065BD0DbC20cD79306b30D8b676` |
| Aave Horizon adapter (v1.1.0) | `0x66064d18722F50E055D74daf51A13fd8e331F0b7` |
| PraetorTimelock | `0x0dAd24d7feb2bB797e0f69e02c2F32104FCF22d4` |
| PorticoRegistry | `0x9A9aF6e50491Cd4694699d48564bBFF18f9B40BC` |
| Mock USDC (open mint) | `0x67713074650Ad05c832C781101Ac447Cb847522E` |
| Faucet | `0x93eE00c00b6ff20583Ee6400A6e49884EC150d1A` |

Verified on-chain: the Router resolves the live plinth, coffer, and registry; the
Aave adapter reports `version() == (1,1,0)`; Coffer and Plinth share the same praetor
multisig. Trade-fill wiring (`Coffer.setAdapter`, `adapter.setAuthorizedCaller`,
`registry.registerAdapter`) is gated by the 48-hour timelock, exactly as on Arbitrum
Sepolia.

## Off-chain services

| Service | Runtime | Role |
|---|---|---|
| `services/codex/` | Cloudflare Workers (primary) + Vercel (mirror) | x402-payable read API. HMAC-signed responses keyed by `X-Codex-Key-Id`, replay-deduped, idempotency honored 24h. |
| `services/lantern-attestor/` | Scheduled cron | Pulls Coffer balances each interval, builds a Merkle tree, pins to IPFS, signs the root, publishes to `LanternAttestor.publish`. |
| `services/vigil-keeper/` | GitHub Actions cron | Watches the subgraph for accounts past the liquidation threshold; calls `queueLiquidation` and `executeLiquidation` against Vigil. |
| `services/notifier/` | Subgraph-driven | Alert delivery (Telegram, Discord, email, webhook) with per-user preferences behind a Bearer-gated API. |
| `services/praetor-cli/` | Rust CLI | Deploys, multisig schedule and execute, lantern publish-now, seed pre-flight, parameter changes. |
| Scribe | The Graph subgraph | Indexes every contract event; the app reads margin, mandates, attestations, and activity from it. |

## Data flow, a hedged-position lifecycle

1. User deposits USDC into Coffer and receives ERC-4626 shares.
2. User opens a position on venue A via `AtriumRouter.open_position_via_adapter`. The
   router asks the adapter to take collateral from Coffer within its per-block cap
   (`adapterPull`), establishes the venue-side position, and records the margin row
   on Plinth.
3. User opens an offsetting position on venue B the same way. Plinth's SPAN math nets
   the exposures; the required margin updates live, freeing buying power.
4. Scribe indexes both opens. The app reads the user's margin tile from the subgraph.
5. If price action pushes the account below the maintenance margin, Vigil queues a
   liquidation. After the queue's deadline block, the keeper executes; partial or
   full per the configured policy.
6. User closes via `AtriumRouter.close_position_via_adapter`. The adapter settles with
   the venue and transfers proceeds back to Coffer.

In parallel, Lantern attests the share-balance Merkle root roughly every 10 minutes,
so any user can prove their balance is included without trusting Atrium.

## Security model

- **Timelock for parameters, multisig for pause.** Every parameter setter is
  timelock-gated (`onlyTimelock`). Emergency pause is multisig-only with no delay; it
  can pause but cannot upgrade.
- **Dual-oracle.** Every Plinth price read takes the median of Chainlink and Pyth,
  with a 50 bps tolerance and a 60-second freshness window. Either feed stale or out
  of tolerance reverts. A single oracle is the most common DeFi blowup vector.
- **Reentrancy guards.** Every state-changing Stylus function carries an
  `is_updating` flag entered before any external call.
- **Per-adapter, per-block notional cap.** Coffer caps how much a single adapter can
  pull per block, so a compromised adapter can drain at most about 1% of TVL per
  block.
- **Account-abstraction emergency lever.** The Postern Kill Switch routes through
  `Sigil.revoke_all_on_behalf_of`, so the revoke counts against the user, not the
  kill-switch contract.
- **No silent fallbacks in the core.** Coffer and Plinth refuse to operate (revert
  loudly) when the USDC contract state is unreadable, rather than assuming a safe
  default.

## Stack choices and tradeoffs

- **Stylus for the math, Solidity for the integrations.** Stylus gives roughly 10 to
  100 times the compute headroom for the SPAN engine and signature recovery; Solidity
  is where every venue adapter lives because every venue documents in Solidity.
- **Upgradeable in Year 1.** All Year-1 contracts are UUPS-upgradeable behind the
  48-hour timelock with ERC-7201 namespaced storage. The community has the 48-hour
  window to object. The Year-2 mainnet flip locks the most critical contracts. We say
  this on `/docs/honesty` rather than claiming false immutability.

## Verification and tests

- Solidity contracts verified on Sourcify; Stylus contracts via `cargo stylus
  verify` against the Arbitrum Stylus verifier.
- The SPAN margin saving is locked by a unit test:
  `span::hedge_frees_a_pinned_share_of_the_isolated_margin` frees about 51% of the
  isolated margin on a canonical equal-size hedge, with a 40 to 70 percent guardrail
  band (`cargo test -p atrium-plinth span::`).
- 768 frontend and library tests pass. The Stylus core carries Kani formal-
  verification proofs on solvency and mandate-expiry invariants (`make kani`).

## Honest limits, what is mocked or interim on testnet

The full, current list is published on the live app at `/docs/honesty`. In summary:

- Where a real upstream is not on the testnet (Aave V3, certain perp venues, some
  feeds), Atrium uses a named mock or a Praetor-signed relay, each disclosed with its
  mechanism and path to real.
- A new venue's live fill is enabled only after a scheduled 48-hour timelock batch,
  by design.
- The deployer-key timelock owner moves to a 3-of-5 multisig before any mainnet flag.

No landing-page or app number presents a mock as a real upstream.

## Where things live

- Contract source: [`contracts/`](./contracts/)
- Off-chain services: [`services/`](./services/)
- Frontend (Verifier Mode): [`apps/verify/`](./apps/verify/)
- Subgraph: [`subgraph/`](./subgraph/)
- Generated registry: [`docs/deployment.md`](./docs/deployment.md)
- Conceptual overview: [`docs/architecture.md`](./docs/architecture.md)
