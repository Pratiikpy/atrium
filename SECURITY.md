# Security policy

## Reporting a vulnerability

Email **security@useatrium.me** with a description and reproduction steps.

- PGP encryption optional. See `runbooks/pgp-key-generation.md` for the public key (placeholder until Phase 7 publishes).
- Best-effort 48-hour acknowledgment. Critical issues triaged same-day.
- 90-day responsible disclosure window.

## Bug bounty

Full scope, severity matrix, and reward tiers are documented at:

**[/security/bounty](https://www.useatrium.me/security/bounty)**: the single source of truth.

Summary: Critical $5–25K, High $1–5K, Medium $250–1K, Low/Info swag + hall-of-fame.

Funded from Praetor treasury post-mainnet. During testnet: best-effort by founding team with public credit.

## Hall of fame

Researchers who responsibly disclose are credited at:

**[/security/hall-of-fame](https://www.useatrium.me/security/hall-of-fame)**

(None yet, repo is pre-launch.)

## Scope

In scope:

- All contracts under `contracts/`
- All services under `services/`
- The subgraph and indexer
- The Verifier Mode frontend (www.useatrium.me)
- Codex API (codex.useatrium.me)
- Tablet API (tablet.useatrium.me)
- The reference agents

Out of scope:

- Cloned dependencies under `resources/` (report to those upstream)
- Third-party adapters listed in PorticoRegistry that we did not author
- Theoretical risks already documented in `docs/architecture.md` and `docs/conventions/security.md`
- Third-party services (Vercel, Cloudflare, Sentry)
- Front-end UI bugs without security impact
- Social engineering

## Year-1 posture

Atrium targets Arbitrum Sepolia testnet for Year 1. No user funds will be at real economic risk. The audit-findings register tracks the gap between the security model and what is wired today; see `audits/2026-05-25-contract-quality-audit.md`.

Design intent (formal-verification CI lane lands Month 3):

- Kani plus proptest formal-method invariants: 9 Kani proofs authored; 5 of 9 proptest invariants pass locally today. The formal-verification CI lane lands Month 3.
- Dual oracle (Chainlink + Pyth) with 50 bps tolerance and 60 s freshness on every Plinth price read.
- 3-keeper redundancy with economic slashing.
- Praetor 3-of-5 multisig with a 48-hour PraetorTimelock on every parameter change.
- ERC-7201 namespaced storage for safe upgrades.
- Per-adapter per-block notional cap on Coffer.

Where live code differs from this posture, the gap is honestly logged in `audits/2026-05-25-contract-quality-audit.md`.

## Incident response

Operational runbooks for each service live under `runbooks/`. Key procedures:

- `runbooks/key-rotation.md`: deployer key rotation
- `runbooks/incident-notifier.md`: notifier outage
- `runbooks/incident-lantern.md`: Lantern attestor outage
- `runbooks/incident-scribe.md`: subgraph indexer lag
- `runbooks/incident-keeper.md`: vigil-keeper failover
- `runbooks/pgp-key-generation.md`: PGP key for encrypted disclosures

## Threat model

The full STRIDE matrix per subsystem is in `docs/conventions/security.md` ("Threat model"). Architecture-level mitigations are detailed in `docs/architecture.md` ("Security model").
