# Tripwire 2026-05-25: Hyperliquid + Polymarket validator set is 1-of-1

> Hyperliquid + Polymarket adapter validators were set to 1-of-1 with
> the deployer EOA on 2026-05-25, not the 3-of-5 set the PRD scopes
> for production. This is the testnet bootstrap: same one-key posture
> that holds every other admin slot. It expands to the real 3-of-5
> set when the Safe migration ceremony lands (Phase ε.1, founder
> action, dependent on hardware-wallet setup).

## Why this is fine for Year-1 testnet

- Validators only sign hybrid-attestation paths. Their compromise lets
  an attacker submit a fake `attest_off_chain_state` payload that
  marks a position as cleared on the venue side. The on-chain margin
  state on Plinth still reflects the real position, so the worst
  outcome is a desync that resolves on the next real attestation. No
  user funds at risk.
- The deployer EOA controls every admin slot today (auditor C-7's
  "praetor_multisig = deployer EOA on every contract" finding). The
  validator set being 1-of-1 with the same key adds zero new attack
  surface beyond what already exists.
- Live since: 2026-05-25T18:51Z
- Tx (Hyperliquid): 0xcb7afa38856e4990e67865781d635db6977103c5e44f6190cb1f50ee6c495138
- Tx (Polymarket):  0x1e1ccda1100c192398920e12cb2f28b6d0dacfd1a7bab59e5e92dc37fbc8f069

## What triggers the expansion

- Phase ε.1 (Safe migration ceremony) lands a 3-of-5 Gnosis Safe.
- The same multisig then issues a single `setValidators([v1, v2, v3,
  v4, v5], 3)` call on each adapter.
- This file moves to a closed-tripwire archive at that point.

## Why not skip straight to 3-of-5

The 3-of-5 validator set requires real validator infrastructure
(separate keys, separate physical custody, monitoring). That work
hangs off the Safe ceremony, which itself hangs off three founders
acquiring hardware wallets. Bootstrap-1-of-1 is the honest path
that keeps the demo end-to-end functional while the production
validator infra catches up.
