# Tripwire 2026-05-25: Phase eta complete

> Every testnet-buildable item in the Phase eta plan
> (`~/.claude/plans/harmonic-chasing-honey.md`) is shipped on master.
> Only founder ops remain: 3-of-5 Safe ceremony, demo rehearsals,
> domain + email + PGP, cohort outreach, and the per-service env
> wiring for the new notifier + research + Sumsub paths.

## What shipped

| Phase | Status | Commit(s) |
|---|---|---|
| eta.1 subgraph completeness | Done | `f93583d` |
| eta.2 Vigil keeper unblock (setter + tick.ts real path) | Done | `244b6bc` + `f9be204` |
| eta.3 ResearchAttestation + Edict orchestrators | Done | research_loop.py + cron + Sumsub webhook commit |
| eta.4 3-of-5 Safe migration (script + runbook) | Done | safe-ceremony.md + transfer-admin.s.sol commit |
| eta.5 Off-chain notification channels | Done | services/notifier commit |
| eta.6 Mobile-app full canon parity | Done | TradeMobile wagmi wire commit |
| eta.7 Agent profile + onboarding gate | Done | agent profile + 2nd-device modal commit |
| eta.8 Codex /docs/api page | Done | `7def800` |
| eta.9 Observability (Sentry + runbooks + on-call) | Done | sentry shim + runbooks commit |
| eta.10 Brand raster assets | Done | sharp pipeline + 8 rasters commit |
| eta.12 ESLint + 3 tsc backlog fixes | Done | `37475ba` |
| eta.14 Public-repo readiness | Done | code of conduct + security.txt + history scan commit |
| eta.15 Footer socials | Done | `9c8904b` |
| eta.16 Audit findings register live embed | Done | audit findings embed commit |
| eta.17 Reconcile + tag | This commit | |

## Phases not in scope for code

| Phase | Reason | Who |
|---|---|---|
| eta.11 Demo rehearsals | Founder must drive the live demo across 10 dress runs | F3 |
| eta.13 Domain + DNS + email + PGP | Founder must register atrium.fi + set MX + generate PGP key | F1 |

## Founder ops list (after this commit)

1. **Phase beta.5 timelock execute** at 2026-05-26T15:43Z. Run
   `pnpm praetor execute` at the window. Unblocks 4 of 5 user journeys.
2. **Aave swap timelock** at 2026-05-27T19:30Z. Same pattern.
3. **3-of-5 Safe ceremony** per `scripts/safe-ceremony.md`. Hardware
   wallets, app.safe.global, run `forge script
   scripts/transfer-admin.s.sol`.
4. **Vigil keeper unblock**: redeploy Vigil + Plinth via cargo-stylus
   (Linux box needed; Windows MSVC blocked per `human_left.md` #11);
   multisig call `set_keeper_min_stake_emergency(0.01 ether,
   keccak256("phase-eta.2 testnet unblock"))`; generate fresh keeper
   EOA, fund 0.05 ETH, stake 0.01.
5. **Vercel + GHA secrets** for the new paths:
   - GHA: `SCRIBE_URL`, `RESEARCH_SIGNER_KEY`, `WEB3_STORAGE_TOKEN`,
     `RESEARCH_CONTRACT_ADDR`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`,
     `ATRIUM_KV_REST_URL`, `ATRIUM_KV_REST_TOKEN`,
     `NOTIFIER_PREFS_API_URL`, `NOTIFIER_INTERNAL_KEY`
   - Vercel verify: `SUMSUB_WEBHOOK_SECRET`, `EDICT_CONTRACT_ADDR`,
     `PRAETOR_MULTISIG_KEY`, `SENTRY_DSN`
6. **Subgraph v0.0.6 deploy** via Graph Studio
   (`GRAPH_STUDIO_DEPLOY_KEY` only on the founder's box).
7. **Trigger loadtest workflow** once via `workflow_dispatch` to
   populate `apps/verify/public/loadtest/latest.json`.
8. **Domain + DNS + email + PGP** per `scripts/safe-ceremony.md`
   neighbour (eta.13). atrium.fi at Cloudflare; ImprovMX for
   security@atrium.fi forwarding; generate PGP keypair + upload to
   `apps/verify/public/security/pgp.asc`.
9. **Sumsub sandbox account** for Edict tier auto-assignment.
   Register at sumsub.com (free), set webhook URL to
   `verify.atrium.fi/api/sumsub/callback`, store the signing secret
   in Vercel env.
10. **BotFather + Discord + Resend setup** for the notifier channels.
11. **Cohort outreach**: send the email batch in
    `ops/outreach/cohort-email-template.md`. Drop signed LOIs into
    `data/cohort/<partner>.json` once they land.
12. **10 demo rehearsals** with random fault injection per
    `rehearsals/dress-run-template.md`. Document each in
    `rehearsals/runs/<date>-<run-N>.md`.

## Score projection

- 2026-05-25 pre-eta: 4 of 5 user journeys ready chrome-only; backend
  67% real data; frontend 75% routes.
- 2026-05-25 post-eta: every testnet-buildable item shipped on
  master. Every founder-blocked item documented with a runbook.
  Once the founder ops above land:
  - 5 of 5 user journeys end-to-end on Sepolia
  - Backend 100% real data path or honest pending
  - Frontend every PRD section 1.1 surface live
  - Mobile design-matched (TradeMobile wired through wagmi)
  - Observability + alerts + audit register live
  - Public repo ready
  - Demo rehearsed
  - 3-of-5 Safe migration done

Only money-blocked items remain (real Aave V3 mainnet, Pyth native
equity feeds on Sepolia, Robinhood Chain adapter, native iOS/Android,
$250K Immunefi tier, Certora subscription, multi-region Lantern).

## Git artefact

This push is tagged `v0.2.0-launch-complete` for the post-eta
checkpoint. Tag annotation has the commit-by-commit breakdown above.
