# Atrium — judge one-pager

**Cross-venue portfolio margin for the EVM.** One wallet posts collateral once and trades across multiple onchain venues with one margin number. Built on Arbitrum + Robinhood Chain testnet, $0 founder capital in Year 1.

---

## The Jamie hook

Real trader. Open $3M HIP-3 perp on Hyperliquid. Also long $500K Aave Horizon T-bills as cash equivalent. To stay hedged today, Jamie posts margin twice. Unhedged isolated margin requires about $2M total collateral. **Atrium nets the hedge under one SPAN-style margin calculation. Same risk, about $900K total collateral. Roughly 55% saved.**

Source: simulated Q1-2026 backtest in `services/archive/notebooks/q1-2026-backtest.ipynb`. The figures become judge-verifiable in 10 seconds the moment `ResearchAttestation` deploys to Sepolia (Month 1 W2). At Day -7 those four numbers are simulator output, clearly labelled below.

[Run the demo at verify.atrium.fi](https://verify.atrium.fi). Wiring lands as contracts deploy; the Verifier page shows the live deployment status for each step.

---

## Why now

| Signal | Source |
|---|---|
| Hyperliquid HIP-3 OI grew from ~$280M to over $2B in Q1 2026 | Yahoo Finance / CoinDesk / The Defiant, Apr 2026 |
| ERC-8004 trustless-agents standard live on Ethereum mainnet 2026-01-29 | Ethereum Magicians, Jan 2026 |
| BlackRock and Robinhood chose Arbitrum for institutional rails | Public announcements 2024–2025 |
| Coinbase x402 micropayments shipped | x402.org, 2026 |

Cross-margin demand is here. Atrium is the EVM substrate it lands on.

---

## What we ship (judging-criteria evidence)

**1. Smart-contract quality.** Stylus contracts for the compute-heavy core (Plinth margin engine, Vigil liquidator, Coffer ERC-4626 vault, Sigil EIP-712 agent mandates). Solidity for adapters and CCIP. 5-invariant Kani+proptest formal-verification target in CI. Dual-oracle (Chainlink + Pyth) with 50bps tolerance and 60-second freshness. Praetor 3-of-5 multisig + 48h timelock. Per-adapter per-block notional cap on Coffer to bound any malicious-adapter blast radius.

**2. Product-market fit.** Jamie persona is concrete. Every cross-venue HIP-3+T-bill trader today is the target user. Cohort partner program will list named design partners with live testnet TVL on `cohort.atrium.fi` once partners sign and the Cohort Status Page deploys (Month 7). At Day -7 the partner count is 0; the page renders the live count, never an inflated one.

**3. Innovation.** Open `IPorticoAdapter v1.0` adapter standard, MIT-licensed at buildathon end (Jun 24, 2026). AI agents are first-class users via `Sigil` mandates + `Postern` session keys; one-click Kill Switch revokes every active delegation in a single batched tx. On-chain backtest attestation pattern (`ResearchAttestation`) so claims are judge-verifiable in 10 seconds. Competitive landscape (Cascade, August) does cross-margin within one venue; Atrium nets across venues and across instrument classes.

**4. Real problem solving.** Hedged traders today lock 2× the capital they need to. Atrium closes that gap with code that is honestly testnet-only in Year 1, audit-gated for mainnet in Year 2.

---

## Verifiable surfaces

All surfaces are scaffolded today. Each becomes judge-clickable as the underlying contracts deploy on Arbitrum Sepolia. Build state below mirrors `docs/AUDIT_FINDINGS.md` (83 patches landed at Day -7).

| Surface | What it shows | Deploys |
|---|---|---|
| `verify.atrium.fi` | 7-step demo with Arbiscan tx links | Month 1 W2 |
| `cohort.atrium.fi` | Live partner TVL from Scribe; renders 0 when 0 | Month 7 |
| `lantern.atrium.fi` | Hourly proof-of-reserves Merkle root + your inclusion proof | Month 6 |
| `lantern.atrium.fi/sla` | Five circuit-breakers + withdrawal SLA | Month 6 |
| `benchmarks.atrium.fi` | Honest side-by-side vs Cascade and August | Month 9 |
| GitHub Kani badge on verify.atrium.fi | CI status, never green-by-default | Live (renders "unknown" until first Kani run on main) |
| `docs/AUDIT_FINDINGS.md` | Self-audit register: 94 patches landed across audit Waves F–L | Live |

---

## The asks

- **Top-3 finish.** Validation that the work is at the right standard.
- **Founder House invitation.** Four days with the Arbitrum technical team and ecosystem founders is the single highest-value compound we could earn.
- **Warm intros to Arbitrum + Robinhood ecosystem teams.** We built Atrium to be the substrate they need; the bridge from buildathon to partner conversation is the asset we want most.

---

## Team

Three founders. Open GitHub histories on `team.atrium.fi`. Year 1 testnet-only on $0 founder capital. Year 2 raises with the buildathon track record as the credential.

---

*Every number here either has a footnote or is rendered from on-chain Scribe data on the live site. No number on this page is invented.*
