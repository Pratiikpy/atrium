# Architecture

How Atrium fits together. High-level only, for implementation detail, read the code.

## What problem this solves

Traders running positions across multiple onchain venues post collateral twice. A $50K perp on one venue and a $50K cash position on another sit as $100K of locked collateral even though the risk nets out.

Atrium gives each user one margin account that prices net exposure across all whitelisted venues. Same wallet, same collateral, one liquidation surface.

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
       │  vault     │        │            │        └─────────────┘
       └────────────┘        └────────────┘
              ▲                     │
              │ inclusion           │ pause triggers
              │ proof               ▼
       ┌────────────┐        ┌────────────┐
       │  Lantern   │        │   Vigil    │
       │ (Sol)      │        │  (Stylus)  │
       │ proof-of-  │        │ liquidator │
       │ reserves   │        │  engine    │
       └────────────┘        └────────────┘
```

Off-chain, three services pace the system:

- **Codex**, x402-payable read API. HMAC-signed responses, replay-deduped via D1/Upstash.
- **Scribe**, subgraph indexer (The Graph hosted).
- **Vigil keeper**, cron service that queues + executes liquidations against `Vigil`.

## Contract layer

| Contract | Language | Role |
|---|---|---|
| `Plinth` | Stylus (Rust) | SPAN-style portfolio margin engine. Quantifies net exposure across venues. |
| `Coffer` | Stylus (Rust) | ERC-4626 collateral vault. Approved orchestrators may pull USDC up to a per-block cap. |
| `Sigil` | Stylus (Rust) | EIP-712 mandate validator for delegated agent actions. |
| `Vigil` | Stylus (Rust) | Liquidation queue + execute engine, gated on keeper stake. |
| `AtriumRouter` | Solidity | Dispatches user open/close calls to the right venue adapter (v1.0 + v1.1 via `version()` probe). |
| `Aqueduct` + `AqueductReceiver` + `AqueductClaimback` | Solidity | Chainlink CCIP collateral bridge with reorg-safe replay protection and claim-back. |
| `PorticoRegistry` | Solidity | Whitelist of approved adapters, keyed by `venue_id`. Multisig + 48h timelock for changes. |
| `PraetorTimelock` | Solidity | 48h-delay timelock on every parameter change (admin today is a single founder deployer key; 3-of-5 Safe queued). Instant `emergencyPause` lever, no timelock. |
| `PosternKillSwitch` | Solidity | One-tx revoke of every active Sigil mandate + Postern session key for the calling wallet. |
| `LanternAttestor` | Solidity | Merkle root of share balances every 10 minutes; off-chain attestor signs, on-chain stores. |
| `Edict` | Solidity | Jurisdiction tier registry. Plinth + Coffer gate sensitive actions behind a minimum tier. |
| `Adapters` (`adapters/<venue>/`) | Solidity | Per-venue integration. All implement `IPorticoAdapter` v1.0 or v1.1. |

## Security model

- **Timelock for parameters, multisig for pause.** Every parameter setter is timelock-gated (`onlyTimelock`). Emergency pause is multisig-only, no timelock, can pause but cannot upgrade.
- **Dual-oracle.** Every Plinth price read takes the median of Chainlink + Pyth with a 50bps tolerance + 60s freshness window. Either oracle stale or out of tolerance → revert.
- **Reentrancy guards.** Every state-changing Stylus function carries an `is_updating` flag entered before any external call.
- **Per-adapter per-block notional cap.** Coffer enforces a notional cap per adapter per block so a compromised adapter can drain at most 1% of TVL per block.
- **Account abstraction emergency lever.** Postern Kill Switch routes through `Sigil.revoke_all_on_behalf_of` so the revoke counts against the user, not the kill-switch contract.

Full audit history under [`audits/`](../audits/). Incident post-mortems under [`incidents/`](../incidents/).

## Off-chain services

- **`services/codex/`**, Hono-based API on Cloudflare Workers (primary) + Vercel (mirror). x402 USDC payment per call. HMAC-signed responses keyed by `X-Codex-Key-Id`. Idempotency-Key honored for 24h.
- **`services/lantern-attestor/`**, Vercel cron. Pulls Coffer balances via RPC every 10 minutes, builds a Merkle tree, pins to IPFS, signs the root, publishes to `LanternAttestor.publish`.
- **`services/vigil-keeper/`**, GitHub Actions cron. Watches the subgraph for accounts crossing the liquidation threshold; calls `queueLiquidation` + `executeLiquidation` against `Vigil`.
- **`services/notifier/`**, Subgraph-driven alert delivery (Telegram / Discord / email / webhook). Per-user preferences via Bearer-gated REST API.
- **`services/praetor-cli/`**, Rust CLI for deploys, multisig schedule/execute, lantern publish-now, seed pre-flight, parameter changes.

## Data flow

A typical hedged-position lifecycle:

1. User deposits USDC into `Coffer` → receives ERC-4626 shares.
2. User opens a position on venue A via `AtriumRouter.open_position_via_adapter(...)`. The router asks the adapter to take collateral from Coffer (`adapterPull`), establishes the venue-side position, and records the margin row on Plinth.
3. User opens an offsetting position on venue B the same way. Plinth's SPAN math nets the exposures; the required margin updates live.
4. Scribe indexes both opens. The verify-app reads the user's margin tile from the subgraph.
5. If price action pushes the account below the maintenance margin, `Vigil` queues a liquidation. After the queue's deadline block, the keeper executes; partial or full liquidation per the configured policy.
6. User closes via `AtriumRouter.close_position_via_adapter(...)`. Adapter settles with the venue, transfers proceeds back to Coffer.

## Stack choices and tradeoffs

- **Stylus for the math, Solidity for the integrations.** Stylus gives ~10–100× compute headroom for the SPAN engine and signature recovery; Solidity is where every venue adapter lives because every venue documents in Solidity.
- **Upgradeable in Year 1.** All Year-1 contracts are UUPS-upgradeable behind the 48h timelock with ERC-7201 namespaced storage. The community has the 48h window to object on Discord or Mirror. Year-2 mainnet flip locks the most critical contracts.
- **No single oracle.** Dual-feed median with explicit freshness checks. A single oracle is the most common DeFi blowup vector.

## What lives where

- Contract source: [`../contracts/`](../contracts/)
- Off-chain services: [`../services/`](../services/)
- Frontend: [`../apps/verify/`](../apps/verify/)
- Subgraph: [`../subgraph/`](../subgraph/)
- Reference cloned dependencies (cached locally): see [`./resources.md`](./resources.md)
- Live deployment addresses: see [`./deployment.md`](./deployment.md)
- Local dev setup: see [`./development.md`](./development.md)

## Disclosures

What's a mock, what's a relay, what's a stub on testnet is published at [`/docs/honesty`](https://www.useatrium.me/docs/honesty) on the live app. Year-1 testnet posture: certain venues (Aave on Sepolia, Pyth equity feeds, Hyperliquid HIP-3) are not natively available, so Atrium uses mocks or Praetor-signed relays disclosed openly. None of the landing-page numbers ever pretend a mock is a real upstream.
