# Security policy

## Reporting a vulnerability

Email **security@atrium.fi** with a description and reproduction steps. Encrypt with the PGP key at `https://atrium.fi/security/pgp.asc` if the issue is sensitive.

We respond within 48 hours. Critical issues are triaged the same day.

## Scope

In scope:

- All contracts under `contracts/`
- All services under `services/`
- The subgraph and indexer
- The Verifier Mode frontend
- The reference agents

Out of scope:

- Cloned dependencies under `resources/` (report to those upstream)
- Third-party adapters listed in PorticoRegistry that we did not author (the IPorticoAdapter v1.0 interface itself is in scope; specific adapter implementations are owned by their authors)
- Theoretical risks already documented in `docs/architecture.md §17` and `docs/prd.md §21`

## Year-1 posture

Atrium targets Arbitrum Sepolia testnet for Year 1. No user funds will be at real economic risk. The audit-findings register tracks the gap between the security model below and what is wired today; see `docs/AUDIT_FINDINGS.md`.

Design intent (live by Month 3 per `docs/ROADMAP.md`):

- Kani + proptest formal-method invariants in CI. 3 of 5 invariants wired at scaffold time; the remaining 2 land Month 2–6.
- Dual oracle (Chainlink + Pyth) with 50 bps tolerance and 60 s freshness on every Plinth price read.
- 3-keeper redundancy with economic slashing. Vigil contract scaffolded; live keeper deployment lands Month 2.
- Praetor 3-of-5 multisig with a 48-hour PraetorTimelock on every parameter change. Contract exists; downstream contracts route admin calls through it from Month 2 onward.
- ERC-7201 namespaced storage for safe upgrades.
- Per-adapter per-block notional cap on Coffer.

Where live code differs from this posture, the gap is honestly logged in `docs/AUDIT_FINDINGS.md`. No claim above is presented as a property the system already enforces.

## Bug bounty

- Year 1 testnet: bug bounty program standup pending. Interim disclosure: email security@atrium.fi for same-day triage. A formal Immunefi-style program lands ahead of mainnet flip.
- Year 2 mainnet flip: formal program live before the flip. Tier target set on board sign-off.

## Hall of fame

Researchers who responsibly disclose appear here with their permission.

(None yet — repo is pre-launch.)

## Threat model

The full STRIDE matrix per subsystem is in `docs/prd.md §21`. Architecture-level mitigations in `docs/architecture.md §13` and `docs/conventions/security.md`.
