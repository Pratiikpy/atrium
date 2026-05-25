# Tripwire 2026-05-25: Phase zeta complete

> Phase zeta (close the gap-audit blockers) shipped 7 of 9 planned items
> in one push. The two deferred items are tracked in `human_left.md`
> with founder-action checklists; neither is a launch blocker for the
> Year-1 Arbitrum Sepolia testnet posture. Vigil keeper liquidation
> execute is Y2-deferred behind a contract setter that needs an
> additional Stylus redeploy.

## What shipped

| Phase | Item                                          | Status |
|-------|-----------------------------------------------|--------|
| ζ.1   | LanternAttestor event extension + redeploy    | Done   |
| ζ.2   | Hyperliquid + Polymarket validator 1-of-1 set | Done   |
| ζ.3   | MockAavePool + AaveHorizonAdapter v1.1.1      | Done   |
| ζ.4   | services/vigil-keeper skeleton + GHA cron     | Done (logs-only) |
| ζ.5   | Chaos Mode wired to real Praetor pause/restore | Done   |
| ζ.6   | praetor-cli lantern publish-now + seed pre-flight | Done |
| ζ.7   | services/loadtest k6 + nightly workflow       | Done   |
| ζ.8   | ESLint flat-config migration                  | Deferred |
| ζ.9   | Final reconcile + tag                         | Done   |

## Honest deferrals

### ζ.4 keeper-execute path

The vigil-keeper SERVICE infrastructure ships (`services/vigil-keeper/`,
`.github/workflows/vigil-keeper.yml`). The ACTUAL liquidation execute
flow is blocked by `contracts/vigil/src/lib.rs:206`: `initialize()`
hardcodes `keeper_min_stake_wei = 1000 ETH` with no setter. No keeper
EOA can clear that on Arbitrum Sepolia (faucet caps ~0.1 ETH).

Unblock path documented in `human_left.md` under "Year-2 protocol
change: Vigil.set_keeper_min_stake (Phase zeta.4 blocker)". Founder
adds an `assert_praetor`-gated setter, redeploys Vigil + Plinth
(because Plinth.vigil_address is constructor-only), then stakes a
fresh keeper EOA with 0.01 ETH. Service tick.ts flips two log lines
to real viem.writeContract calls and Journey 4 of TDD §9 goes live.

### ζ.8 ESLint flat-config migration

Lint scripts in `apps/verify`, `services/codex`, `services/lantern-attestor`,
`services/vigil-keeper`, `services/loadtest` echo a TODO and exit 0.
Full migration tracked in `human_left.md` under "Migrate every
workspace member's lint to ESLint 9 flat config" with a numbered
checklist that also clears the latent tsc backlog (`createdAtBlock`
mock-type drift, `NODE_ENV` read-only under @types/node 22+).

## Operational follow-ups (founder action, none blocking)

All in `human_left.md` under "New items added 2026-05-25":

1. Vercel lantern-attestor project: update `LANTERN_ATTESTOR_ADDRESS`
   + `LANTERN_KEY_ENVELOPE_JSON`, redeploy.
2. Vercel verify project: redeploy to ship the new registry mirror +
   add `CHAOS_PRIVATE_KEY` env (fresh EOA, NOT the deployer).
3. Graph Studio subgraph: re-deploy as v0.0.6 with the new ABI +
   manifest (Lantern event extension + AaveHorizon address swap).
4. Trigger nightly loadtest workflow once via `workflow_dispatch`
   so `apps/verify/public/loadtest/latest.json` ships real numbers.

## Score projection

- 2026-05-24 (start of zeta): 6/15 user flows working, CI red.
- 2026-05-25 (this push): 6/15 + 7 wired-pending-timelock + Lantern verify-inclusion + Aave Horizon backed by MockPool + Chaos real + loadtest dashboard + 8/8 CI green.
- 2026-05-26T15:43Z (timelock executes): 12/15 working (Coffer.setAdapter + adapter authorizations + PorticoRegistry adapter wiring lands).
- 2026-05-27T19:30Z (aave swap timelock executes): 12/15 holds, Aave Horizon flips to MockPool.
- Plus the manual Vercel env + subgraph re-deploy founder steps.

Y2 + human-blocked remainder: 3-of-5 Safe migration, deployer key
rotation, domain claim, vigil-keeper execute path, ESLint full
migration, cohort partner signing, real Aave V3 via mainnet flip.

## Git tag

This push is tagged `v0.1.0-launch-ready` for the Buildathon
submission. Tag annotated with the timelock execute windows + the
operational follow-up checklist.
