# Security rules

## Posture

Year-1 testnet only. No real money at risk. We still treat security like mainnet for two reasons:

- Bad habits formed on testnet ship to mainnet
- A judge or partner who spots a bug on Sepolia loses faith fast

Defense in depth, not single points of failure. PRD §21 has the STRIDE matrix per subsystem. TDD §13 has the architecture.

## Authentication and authorization

- Every off chain to on chain action requires a wallet signature
- Every off chain to off chain action requires a signed response or x402 payment
- Target: no single-key admin path anywhere. Today admin is a single founder deployer key behind the 48h timelock; the Praetor 3-of-5 Safe ceremony is queued (see /docs/honesty).
- Praetor multisig (3-of-5 target) plus 48h timelock for every parameter change and upgrade
- Emergency pause is multisig only, no timelock, pause only (cannot upgrade)

## Oracles

Dual oracle: the median of Chainlink Data Feeds and Pyth within a 50 bps tolerance, or Plinth pauses. Median, not primary plus fallback (ADR-007).

- Both must be live for normal operation
- If either is stale beyond 60 seconds, revert with `OracleStaleError`
- If the two disagree by more than 50bps, pause Plinth with `OracleDisagreementError`
- Never trust a single oracle. Never trust an oracle without a freshness check.

Pyth equity feeds are mainnet only as of 2026-05-18. For Sepolia, use the Praetor signed mainnet relay and disclose this honestly on the landing page. See TDD §13.2.

## Reentrancy

- Every state changing function on Plinth and Coffer uses the `is_updating` flag pattern shown in TDD §7.1
- Proptest invariant covers the reentrancy case
- Never call into an external contract before updating state, unless the external call is to a trusted, immutable system contract

## Keys

| Key | Storage | Notes |
|---|---|---|
| Praetor multisig keys | Hardware wallets, one per founder | Year-1 free. Geographic separation. |
| Lantern attestation signing key | Software key on VPS, Argon2id encrypted | Shamir 3 of 5 backup. Cloud HSM deferred to Year-2. |
| Codex backend signing key | HashiCorp Vault free tier | Rotated quarterly. Versioned via `X-Codex-Key-Id`. |
| Keeper bot keys | Encrypted at rest on VPS, env at runtime | Replace on suspected compromise. |
| Agent operator keys (Augur, Haruspex, Auspex) | Fly.io secrets | Replace on suspected compromise. |

No production master keys. Mainnet key management is Year-2.

## Upgrades

- All Year-1 contracts upgradeable via OZ UUPS pattern
- ERC-7201 namespaced storage to prevent slot collisions
- Upgrade path: multisig schedule → 48h timelock → multisig execute
- Community can object via Discord or Mirror during the 48h window
- Post deploy smoke test runs in CI before the new version is considered live

Never bypass timelock. Never disable the multisig.

## CCIP and bridges

- Aqueduct uses LINK as fee token, not native ETH. See TDD §7.6 and ADR if it changes.
- `seen_messages` mapping prevents replay after Sepolia reorgs
- CCIP messages have an `expires_at` window. After expiry, `claim_back` on source chain.
- Aqueduct LINK balance is monitored. Alert fires at less than 10x last month usage.

## External adapters

- Adapter bytecode is immutable once whitelisted
- Adapter upgrade requires re-whitelisting through Curator multisig (3 reviewers from 3 organizations)
- Coffer enforces a per adapter per block notional cap so a malicious adapter cannot drain more than 1% of TVL per block
- No adapter holds the right to mint or burn Coffer shares

## API security (Codex)

- Every endpoint requires x402 payment
- Every response is HMAC signed with a key versioned by `X-Codex-Key-Id`
- Rate limits per IP, per wallet, per agent. Most restrictive applies.
- Idempotency keys honored for 24h
- Per user data isolated via Postgres row level security

## Threat model

Use STRIDE per subsystem. PRD §21 is the canonical version.

When adding a new subsystem:

- Walk through Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege
- Document mitigations or accept the risk explicitly
- Add a row to the §21 table

## Disclosure

- `SECURITY.md` in the repo root with the disclosure email and PGP key
- Bug bounty via Immunefi standard tier ($25K ceiling) on testnet
- Bounty raises to $250K+ at mainnet flip
- All reported issues triaged within 48h, fixed or disclosed within 30 days

## What never to do

- Never disable a Kani or proptest invariant to make CI green
- Never deploy without timelock on a parameter change
- Never store private keys in the repo, in env files committed to git, or in CI logs
- Never accept an oracle price without a freshness and tolerance check
- Never let a contract upgrade ship without the post upgrade smoke test
- Never run `git push --no-verify` without explicit written approval from the engineering leads
- Never assume mainnet contracts behave the same as their testnet counterparts. Test on the actual target chain.

## What to do when something looks wrong

- Page F1 on Discord webhook
- Pause the affected contract via Praetor emergency pause (instant, no timelock)
- Investigate root cause in a separate branch
- Write a post mortem in `/incidents/` within 7 days
- Add a regression test before resuming the contract
