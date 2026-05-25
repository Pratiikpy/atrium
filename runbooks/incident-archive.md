# Incident runbook: Archive weekly backtest cron failed

The archive service runs the weekly Atrium-vs-baseline backtest +
publishes the result via `ResearchAttestation.publishBacktest` on
chain. A failure means the next ResearchAttestation never lands and
the /research dashboard renders stale.

## Severity

- **SEV-3** if a single weekly run fails (next run can recover)
- **SEV-2** if the last 4 weekly runs all failed (research dashboard
  staler than 30 days)
- **SEV-1** if the `RESEARCH_SIGNER_KEY` has been rotated but the GHA
  secret is stale (signing failures with a now-public key)

## Signals

- `.github/workflows/archive-weekly.yml` shows red on the Actions tab
- Discord ops webhook fires on `if: failure()`
- Sentry events tagged `service: archive`
- `/research` page: `generatedAt` field older than 14 days

## Triage (30 min target)

1. Open the failed workflow run. The notebook-execution step prints the
   Python traceback if the model rebuild crashed.
2. Check the `publish-step`: a failure here means
   `RESEARCH_SIGNER_KEY` is wrong, or `RESEARCH_CONTRACT_ADDR` points
   at a redeployed instance.
3. Check IPFS pinning: `web3.storage` token may have expired (free-tier
   quota or token revocation).

## Mitigations

| Symptom | Fix | Rollback safe? |
|---|---|---|
| Notebook crash | Pin previous notebook commit; reopen issue with the failing cell | yes |
| `RESEARCH_SIGNER_KEY` rotated | Update GHA secret + Vercel env; rerun cron via `workflow_dispatch` | yes |
| IPFS pin 401 | Rotate `WEB3_STORAGE_TOKEN`; rerun | yes |
| RPC throttle | Wait 60 min, rerun; if persistent, swap RPC endpoint | yes |
| Backtest produced impossible deltas (sanity-check fail) | DO NOT publish; reopen issue | yes |

## Resolution checklist

- [ ] Latest archive run is green
- [ ] On-chain `ResearchAttestation.latestRoot()` reflects the new run
- [ ] /research page `generatedAt` is recent
- [ ] Sentry events stop firing
- [ ] Post-mortem in `/incidents/` if SEV ≤ 2

## Escalation contacts

- F3 (research + archive owner) per `runbooks/on-call-rotation.md`
- web3.storage support for IPFS pinning issues
