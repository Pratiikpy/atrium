# Incident runbook: Codex API down

Codex is the x402-payable read API surface (`codex.atrium.fi`). When
it is down, third-party agents and dashboards cannot query Atrium
data even though the contracts are healthy.

## Severity

- **SEV-2** if Codex returns 5xx for less than 30 minutes
- **SEV-1** if Codex is down longer than 30 minutes OR returns 401/403
  unexpectedly (auth bypass risk)
- **SEV-0** if Codex returns fake data (silent failure)

## Signals

Better Stack uptime monitor pages Discord (or whichever channel is
wired in `ops/monitoring/uptime-config.md`). Sentry events tagged
`service: codex` cluster in the project dashboard.

## Triage (15 min target)

1. `curl https://codex.atrium.fi/health` . expect 200 with all
   endpoint statuses; if 5xx, escalate.
2. Check Vercel deployments dashboard (Cloudflare Workers for the
   Codex deploy). Look for a recent deploy that correlates with the
   outage window.
3. Check Sentry issues. Group by `tags.endpoint` to localise.
4. Check Cloudflare D1 dashboard for migration drift. If `no such
   table` errors land in Sentry, rerun `pnpm migrate:remote` per
   `services/codex/package.json:migrate` script.

## Mitigations

| Symptom | Fix | Rollback safe? |
|---|---|---|
| New deploy 5xx | `wrangler rollback <version-id>` | yes |
| D1 migration drift | `pnpm --filter @atrium/codex migrate` | yes |
| x402 verifier rejecting valid payments | revert middleware change | yes |
| Auth bypass (security incident) | flip `CODEX_DISABLED=true` env, redeploy | yes |
| HMAC key compromise | rotate `CODEX_HMAC_KEY` env + bump `X-Codex-Key-Id` | yes |

## Resolution checklist

- [ ] Sentry events stop firing
- [ ] Better Stack returns to green
- [ ] `/health` returns 200 with every endpoint live
- [ ] A test x402 payment + response round-trips successfully
- [ ] Post-mortem filed in `/incidents/` within 7 days

## Escalation contacts

- F1 / F2 / F3 founders on-call rotation per `runbooks/on-call-rotation.md`
- Cloudflare support for D1 / Workers infrastructure
- Sentry support for free-tier quota issues
