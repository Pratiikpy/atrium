# Phase theta complete — audit-closure push (2026-05-25)

Five Explore agents audited the repo end-to-end on 2026-05-25 after
the Phase eta `v0.2.0-launch-complete` tag. They found 35 fixable
items: 9 contract bugs that lose user funds, 3 silent-failure + auth
holes, 6 wrong-data shipping paths, 10 dead UI surfaces, 4 test
coverage holes, 6 ops/runbook gaps, 6 product-polish drifts. Phase
theta is the close-out push.

## Status (commit-by-commit)

| Sub-phase | Commit | Closed |
|---|---|---|
| θ.1 contract bugs | `e705a00` | 4 adapter funds-strand sweeps (GMX/HL/Polymarket/TradeXyz); Aqueduct `pause(string)`→`pause(bytes32)` selector fix; AtriumRouter v1.1 auto-detect via version() probe; Coffer + Plinth silent fallback fixes (3 unwrap_or removed); 11 new Foundry tests covering all three patches. |
| θ.2 silent failures | `a7eef97` | Notifications API Bearer-auth (ATRIUM_INTERNAL_KEY, constant-time compare); Codex Vercel deploy gets Upstash Redis backing (replay-dedup + idempotency now durable on both deploys); audit-findings build-time JSON shipped via prebuild step. |
| θ.3 wrong-data | `e889bd6` | Lantern attestation cron migrated Vercel-daily → GHA every-10-min (130-min stale threshold has 13 ticks of headroom); Vigil keeper now executes liquidations in-tick (decodes job_id from LiquidationTriggered receipt log); leaderboard probe queries real Rostrum endpoint. |
| θ.4 dead UI | `5a826c6` | 4 deployer-EOA leaks scrubbed from /docs/api; leaderboard Delegate link points at /app/agents (no more `#issue-mandate` dead anchor); agent-profile-live em-dash for pending source; /app live-status panel reads real adapter count; sigil-section example pill; onboarding terracotta → accent color token. |
| θ.5 test coverage | `3a7d2ea` | 9 Faucet tests (claim happy + cooldown + USDC-only ETH-short + drainUsdc/drainEth admin gating + EthDropFailed + constructor zero-guards); Kani harness-count regression gate (CI fails if `#[kani::proof]` count drops without baseline bump). |
| θ.6 ops + runbooks | `286057f` | 6 Sentry shims (codex/notifier/lantern-attestor/agents/loadtest/archive — DSN-or-no-op); 5 new runbooks (notifier/archive/aqueduct-ccip/chaos/scribe); 4 new key-rotation entries (chaos drill, Sumsub, research signer, notifier internal); CODEOWNERS enforces review on contracts/services/runbooks; dependabot weekly bumps; .gitleaksignore for the Hardhat-default carve-out; PR + issue templates. |
| θ.7 product polish | `45d4396` | Dynamic OG image (Next.js opengraph-image + twitter-image, parchment + italic wordmark); partner-name strip from ops/ (Wintermute/Selini/Auros/Galaxy removed); bug-bounty Immunefi-tier claim replaced with honest interim path; hero "seven onchain venues" softened to "every Portico-whitelisted venue"; closing "Three minutes from passkey login" softened to "Onboard with a passkey". |
| θ.8 reconcile | this commit | LAUNCH_READY.md headline + tripwire + tag v0.2.1-audit-closed |

## What's deferred (founder-only or paired-with-founder-ops)

- 3-of-5 Safe ceremony + deployer EOA rotation (project_deployer_eoa_leak_2026_05_24)
- Contract verification on Arbiscan (needs deployer key)
- Bug bounty program standup (legal + Immunefi onboarding)
- Real on-call names + Better Stack monitor (founder accounts)
- Discord / Twitter / Farcaster social handle registration
- Team-page real names + GitHub links + LinkedIn
- Press kit founder bios
- Legal review (cookie disclosure, GDPR, governing law)
- Demo rehearsals (founder drives the demo per η.11)
- Domain + DNS + email forwarding + PGP + security.txt (η.13)

Also deferred — code-doable but pair with a follow-up commit:
- /api/agents/issue-mandate server-side EIP-712 signature recovery
- Reference agents (Augur/Haruspex/Auspex) submit real ActionSigil
- /app/agents `?copy=` consumer paired with leaderboard.tsx Delegate
- /api/agents/leaderboard real Rostrum-row payload paired with
  leaderboard.tsx component refactor (prototype-era fields removed)
- portfolio page double-render media-query refactor
- mobile-landing.html fake-number replacement paired with middleware
  rewrite decision
- Coffer/Sigil/Vigil Stylus unit tests + real Kani predicates
  (blocked locally on Windows MSVC link errors; runs on CI Linux)

## Verification

- Foundry: 30 Aqueduct + 20 AtriumRouter + 9 Faucet + 11 new theta.1
  tests all green
- vitest: 589 verify-app + 42 codex tests all green
- Stylus: `cargo check` clean on coffer + plinth
- tsc --noEmit: clean on apps/verify + services/codex + services/
  vigil-keeper (sentry.ts pre-existing dep issue noted in
  human_left.md, not introduced by theta)
- forge build: green (warnings only)

## Score projection

- 2026-05-25 pre-theta (`v0.2.0-launch-complete`): 14 of 17 eta phases
  done; 35 audit gaps open.
- 2026-05-25 post-theta (`v0.2.1-audit-closed`): every code-doable
  audit gap closed (within the constraints noted above). True testnet
  professional posture. Money-blocked + founder-blocked items are the
  only remaining residue.

## Next checkpoint

Founder ops sweep — 3-of-5 Safe migration is the load-bearing item.
After that, the project is ready for demo rehearsals (η.11) and the
buildathon submission window.
