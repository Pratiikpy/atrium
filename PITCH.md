# Atrium, the pitch

> Cross-venue portfolio margin for the EVM. One wallet posts collateral once and
> trades across multiple on-chain venues with a single margin number.
> Deployed and verified on two testnets today: Arbitrum Sepolia (chain 421614)
> and Robinhood Chain testnet (chain 46630).

Every number, address, and claim in this document is real and traceable to a
deployed contract, a passing test, or an on-chain transaction. Where something is
illustrative or not yet live, it says so in the same line.

---

## The problem

A trader who runs positions across more than one on-chain venue posts collateral
at each venue separately. A long perp on one venue and a hedge or a yield position
on another sit as two locked balances, even though the net risk is far smaller than
the sum. The capital is split across silos and most of it does nothing.

Today there is no neutral place to net that risk. Every venue can only cross-margin
positions held inside its own walls, because the venue on the other side is a
competitor.

## The insight

Put the collateral in one neutral, non-custodial vault, and price the net exposure
across every venue with a single portfolio-margin number. The same deposit then
backs a perp on one venue, a tokenized T-bill on another, and a yield position on a
third, at the same time. One balance, doing several jobs.

This is what a TradFi prime broker does for institutions, except Atrium does it
on-chain, non-custodially, and with no minimums.

## The concrete example (illustrative scale, not a measured reading)

A trader holds `$100K` and wants a long ETH perp plus tokenized T-bills for carry.

- **Without unified margin:** the `$100K` of T-bills earns yield but does nothing
  for the perp. To open the perp they post its initial margin as a separate idle
  balance. Capital is split across two silos.
- **With Atrium:** the `$100K` goes into the Coffer vault once. It earns the T-bill
  yield *and* counts as collateral. The Plinth engine charges only the perp's
  initial margin against it and leaves the rest as buying power.

The live version of this number is computed by Plinth on `/app/trade`; the
`/app/markets` page shows the same comparison as a labelled worked example. We never
present the example as a measured result.

---

## Why a single venue structurally cannot copy this

A venue that offered to net your risk against a position on a *competitor's* venue
would have to extend margin credit on a rival's book and trust the rival's
liquidation engine in real time. That is commercially adversarial and technically
fragile. No venue will do it.

A neutral layer sidesteps the problem entirely:

- **Coffer** holds the collateral, so no venue extends credit to another.
- **Plinth** computes one portfolio-wide SPAN number, owned by neither venue.
- **Portico** (the adapter standard) lets each venue pull collateral only within a
  per-adapter, per-block cap, so a venue can act on your behalf without ever
  touching the pool freely.

The moat is a position, not a trick: to net across venues you must be neutral to all
of them, and a venue cannot be neutral to itself. This is the same reason prime
brokerage exists as a separate entity in TradFi rather than as a feature of one
exchange.

## Why now, and why Arbitrum Stylus

SPAN-style portfolio margin is a scenario-grid computation: shock every instrument
up and down, net the correlated classes, take the worst case. In hand-written
Solidity that math is expensive enough to be impractical per block, which is the
practical reason an on-chain cross-venue margin engine has been hard to ship.

Atrium's engine is written in Rust and deployed as an Arbitrum Stylus contract,
which runs that class of computation at roughly 10 to 100 times lower gas than the
Solidity equivalent. The wedge itself (neutrality) is chain-agnostic; what Stylus
changes is the *feasibility* of running the engine on-chain at all. A faster L1 does
not close this gap, because the gap is cross-venue netting, not latency.

---

## How it works

| Piece | Language | What it does |
|---|---|---|
| **Coffer** | Stylus (Rust) | ERC-4626 vault. Holds collateral once; approved orchestrators pull USDC up to a per-block cap. |
| **Plinth** | Stylus (Rust) | SPAN portfolio-margin engine. Computes one buying-power number across venues, netting correlated risk. |
| **Sigil** | Stylus (Rust) | EIP-712 mandates. A user signs a bounded delegation (per-action cap, daily count, expiry, venue allowlist) an agent physically cannot exceed. |
| **Vigil** | Stylus (Rust) | Liquidation queue and execute engine, gated on keeper stake. |
| **AtriumRouter** | Solidity | Opens a position across margin to vault to venue adapter in a single transaction. |
| **Postern Kill Switch** | Solidity | One transaction revokes every active agent mandate and session key for the calling wallet. |
| **Lantern** | Solidity | Publishes a signed Merkle proof-of-reserves root that any user can verify against the on-chain attested root. |
| **Aqueduct** | Solidity | Chainlink CCIP collateral bridge, with reorg-safe replay protection. |

The compute-heavy core (Plinth, Coffer, Sigil, Vigil) is Arbitrum Stylus; adapters
and the cross-chain layer are Solidity, because every venue documents in Solidity.

---

## Proof it is real

This is not a mockup. The whole protocol is deployed, wired, and verified on two
testnets, and the core flows produce real on-chain transactions.

- **Dual-chain, fully deployed.** The protocol is deployed, wired, and verified on
  Arbitrum Sepolia (chain 421614), and the 15-contract core is replicated on
  Robinhood Chain testnet (chain 46630). Solidity contracts are verified on Sourcify;
  Stylus contracts are verified with `cargo stylus verify`.
  Addresses for both chains are in [`ARCHITECTURE.md`](./ARCHITECTURE.md) and
  [`docs/deployment.md`](./docs/deployment.md).
- **The margin saving is a passing test, not a slide.** On a canonical equal-size
  hedge, Plinth frees about 51% of the isolated margin, locked by a unit test with a
  40 to 70 percent guardrail band:
  `span::hedge_frees_a_pinned_share_of_the_isolated_margin`
  (`cargo test -p atrium-plinth span::`).
- **The money path works end to end on real wallets.** Deposit mints ERC-4626 shares
  and withdraw redeems them, both gated on a mined receipt. Example verified testnet
  transactions on Arbitrum Sepolia (public on Arbiscan):
  - withdraw `0x976e098cad97978b4d34f5a0ddc85f48e03f023937d9a678485b530c3d4addbf`
  - mobile deposit `0x8c8d1f0ddf292bac321f0da5fe33115238ecfbe848ab56b1dee74a277b820347`
- **Proof of reserves is live.** Lantern's latest attested Merkle root is
  `0x4b9e107780ddcbfcd0a3178d5ee25104494b8333ecadf4b2c9acf49419fef1f0`
  (Arbitrum Sepolia block 272828085), readable on `/lantern` and `/app/reserves`.
- **You can verify every claim yourself.** Verifier Mode (`/verify`) walks seven
  steps against the live contracts: deposit, open, see the margin saving, trigger a
  chaos fault, run a liquidation drill, verify proof of reserves, revoke with the
  kill switch.
- **The suite is green.** 768 frontend and library tests pass; the Stylus core
  carries Kani formal-verification proofs on solvency and mandate-expiry invariants.

---

## Who we win for

| Persona | Pain today | What Atrium changes |
|---|---|---|
| Cross-venue trader | Posts full margin at each venue; capital sits idle in silos. | One vault, one netted margin number; the same collateral does several jobs. |
| Delegating trader | Handing an agent a key hands over everything. | A signed, bounded mandate the agent cannot exceed; one-tap kill switch revokes all. |
| Careful allocator | Will not custody with a venue they cannot audit. | Non-custodial ERC-4626 vault plus a signed proof-of-reserves they verify in seconds. |

## The category

|  | Cross-venue netting | Non-custodial | On-chain proof of reserves | KYC-gated |
|---|---|---|---|---|
| Single-venue perp DEX | No, only within one venue | Yes | Partial | No |
| CEX portfolio margin | Within one platform only | No | No | Yes |
| TradFi prime broker | Yes, but centralized | No | No | Yes, high minimums |
| **Atrium** | Yes, across independent on-chain venues | Yes | Yes, signed Merkle attestation | No (optional access tiers only) |

The first column is the point. Many products cross-margin inside their own walls.
None net your position on venue A against your position on venue B, because A and B
are competitors.

---

## Status and the honest limits

Being defensible means stating what is not done, in the same breath as the claim:

- **Testnet, Year 1.** Arbitrum Sepolia and Robinhood Chain testnets. Nothing here
  has economic value yet.
- **Upgradeable contracts.** UUPS behind a 48-hour timelock. Today the timelock is
  controlled by a founder deployer key; the production model is a 3-of-5 multisig
  behind the same timelock. We say so on `/docs/honesty` rather than claiming false
  immutability.
- **Some venues are mocked or relayed** where the real upstream is not on the
  testnet (for example Aave V3 via a MockAavePool, certain perp venues). Each one is
  named with its mechanism and path to real on `/docs/honesty`.
- **Trade-fill on a new venue is timelock-gated.** Enabling a live fill on a venue
  requires a scheduled 48-hour timelock batch, exactly as a production parameter
  change would. The contracts are deployed and wired; the gate is by design.

None of these change the wedge. They are the honest state of a Year-1 testnet build,
and disclosing them is part of the trust argument, not a footnote to it.

## Where this goes next

1. Flip the deployer-key timelock owner to the 3-of-5 multisig.
2. Open the public app at a hosted URL (the app reads the live contracts today; the
   pending piece is DNS and deploy).
3. Year-2 mainnet, with the most critical contracts locked.

The wedge is durable because it is structural. The proof is that it already runs.
