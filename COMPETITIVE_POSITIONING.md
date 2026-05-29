# Atrium - Competitive Positioning

> The one-page answer to "why this, and why can't an incumbent just do it?"
> Written to be defensible: every claim is either a structural argument or a
> verifiable fact, and the honest limits are stated in the same breath as the
> wedge. Companion to `ATRIUM_PRD.md` (scope) and `/docs/honesty` (what is
> mocked or interim on testnet today).

Authored 2026-05-29. Banned-word and no-em-dash rules per `.claude/rules/writing.md`.

---

## The wedge, in one sentence

Atrium nets your risk **across independent venues** into one buying-power number, so a single deposit backs a Hyperliquid perp, an Aave T-bill, and a Pendle yield position at the same time, instead of you re-posting collateral at each.

That capability, cross-**venue** portfolio margin from a neutral layer, is the thing no single venue can offer. Everything below is why.

---

## Who we win for

| Persona | The pain today | What Atrium changes |
|---|---|---|
| **The cross-venue trader** | Runs a perp on one venue, a hedge on another, yield on a third. Posts full margin at each. Capital sits idle in three silos. | One vault. Plinth nets correlated risk across all three. The same collateral does multiple jobs. |
| **The delegating trader** | Wants an agent or strategy to trade for them, but handing over a key means handing over everything. | Signs a bounded mandate (per-action cap, daily count, expiry, venue allowlist) the agent physically cannot exceed. One-tap kill switch revokes all. |
| **The careful allocator** | Will not custody funds with a venue they cannot audit. | Non-custodial ERC-4626 vault plus a signed on-chain proof-of-reserves they can verify themselves in seconds. |

We are not trying to out-execute a single venue on that venue's own book. We sit a layer above and make the **portfolio** efficient.

---

## The category map

| | Cross-venue netting | Non-custodial | On-chain proof of reserves | KYC-gated | Where it runs |
|---|---|---|---|---|---|
| **Single-venue perp DEX** (Hyperliquid, GMX, dYdX, Drift) | No, only within the one venue | Yes | Partial / per-venue | No | One venue |
| **CEX portfolio margin** (Binance, OKX, Deribit) | Within the one platform's products only | No, custodial | No | Yes | One platform |
| **TradFi prime broker** | Yes, but centralized | No | No | Yes, high minimums | Off-chain |
| **Atrium** | Yes, across independent on-chain venues | Yes | Yes, signed Merkle attestation | No (optional access tiers only) | Neutral on-chain layer |

The point of the table is the first column. Plenty of products give you cross-margin **inside their own walls**. None of them net your position on venue A against your position on venue B, because A and B are competitors.

---

## Why an incumbent venue structurally cannot do this

A venue that offered to net your risk against a position held on a **competitor's** venue would have to trust that competitor's solvency and settlement in real time. That is commercially adversarial (you do not extend margin credit on a rival's book) and technically fragile (you do not control the rival's liquidation engine).

A neutral layer sidesteps the whole problem:

- **Coffer** (the vault) holds the collateral, so no venue is extending credit to another.
- **Plinth** (the margin engine) computes one portfolio-wide SPAN number, owned by neither venue.
- **Portico** (the adapter standard) lets each venue pull collateral only within a per-adapter, per-block cap, so a venue can act on your behalf without ever touching the pool freely.

This is the same reason prime brokerage exists in TradFi as a separate entity rather than a feature of any one exchange. Atrium is that entity, on-chain and non-custodial.

So the moat is not a clever trick a competitor copies next week. It is a position: to net across venues you must be neutral to all of them, and a venue cannot be neutral to itself.

---

## Why Arbitrum, and why this has not shipped on-chain before

SPAN-style portfolio margin is a scenario-grid computation (shock every instrument up and down, net correlated classes, take the worst case). In hand-written Solidity that math is expensive enough to be impractical per-block. Atrium's engine is written in Rust and deployed as an Arbitrum Stylus contract, which runs that class of computation at roughly 10 to 100 times lower gas than the equivalent Solidity (sourced to `TECH_DESIGN.md` and the `contracts/plinth/src/span.rs` scenario matrix).

That gas gap is the practical reason an on-chain cross-venue margin engine has been hard to build, and it is why we build it where the math is affordable. The wedge itself (neutrality) is chain-agnostic; what Stylus changes is the **feasibility** of running the engine on-chain at all.

A single-venue protocol on any chain, fast L1 or otherwise, does not close this gap by being faster. The gap is cross-venue netting, not latency.

---

## The concrete scenario

A trader holds `$100K` and wants a long ETH perp on Hyperliquid plus tokenized T-bills on Aave Horizon for carry.

- **Without unified margin:** the `$100K` of T-bills sits on Aave earning yield but does nothing for the perp. To open the perp they post its initial margin as a separate, idle balance on Hyperliquid. Capital is split across two silos.
- **With Atrium:** the `$100K` goes into Coffer once. It earns the T-bill yield **and** counts as collateral. Plinth sees `$100K`, charges the perp's initial margin against it, and leaves the rest as buying power. One balance, two jobs.

The live version of this number is computed by Plinth on `/app/trade` (`GET /api/trade/margin-impact`); the `/app/markets` starter strategies show the same comparison as a labelled worked example. We never present the example as a measured result.

---

## The honest limits (stated, not buried)

Being defensible means saying what is not done:

- **Testnet, Year 1.** Arbitrum Sepolia. Nothing here has economic value yet.
- **Upgradeable contracts.** UUPS behind a 48-hour timelock, today controlled by a founder deployer key; the production model is a 3-of-5 multisig behind the same timelock. We say so on `/docs/honesty` and `/docs/deployment` rather than claiming false immutability.
- **Some venues are mocked or relayed** where the real upstream is not on Sepolia (for example Aave V3, equity feeds, certain perp venues). Each one is named with its mechanism and path to real on `/docs/honesty`.
- **Two adapters are scaffolds** (open is disabled, shown as such on `/app/markets`).

None of these change the wedge. They are the honest state of a Year-1 testnet build, and disclosing them is part of the trust argument, not a footnote to it.

---

## How we talk about it

- Lead with the money (one deposit, more buying power), not the architecture.
- Name the structural reason a venue cannot copy us (neutrality), because that is what makes the wedge durable rather than clever.
- Always pair the claim with the limit. The credibility is the product.

*If a fact in here cannot be traced to a doc, a contract, or a verifiable public competitor, it does not belong in this file. Names of specific small competitors are intentionally omitted unless we can cite them.*
