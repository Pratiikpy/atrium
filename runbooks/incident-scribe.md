# Incident runbook: Scribe (subgraph) indexing lag

Scribe is the Atrium subgraph deployed to Graph Studio. Every UI
dashboard reads through Scribe (Plinth margin numbers, Vigil keeper
stats, Lantern reserve attestations, Rostrum agent reputation). A
multi-block index lag means the UI silently shows stale on-chain
state.

## Severity

- **SEV-3** if Scribe lags less than 50 blocks (~3 min on Arbitrum)
- **SEV-2** if Scribe lags more than 200 blocks (~12 min)
- **SEV-1** if Scribe stops indexing entirely OR a deployment is
  pinned at an old block

## Signals

- `/api/scribe/health` returns `lag_blocks > 50`
- Better Stack monitor on Scribe head-block gauge
- Subgraph health endpoint:
  `curl https://api.studio.thegraph.com/query/atrium/v0.0.6/__health`
- User report: "I made a deposit but the /portfolio page doesn't show it
  after 5 minutes"

## Triage (15 min target)

1. Open Graph Studio for the deployed subgraph version. Check the head
   block reported vs the latest Arbitrum Sepolia block via
   `cast block-number --rpc-url $ARBITRUM_SEPOLIA_RPC`.
2. If lagging: check the `indexingErrors` field. A handler crash on
   one event blocks all subsequent blocks.
3. If pinned at an old block: confirm `SCRIBE_URL` env var across
   verify-app / notifier / agents is NOT pinned to an old subgraph
   version. The canonical URL is in `services/_shared/scribe-url.md`.

## Mitigations

| Symptom | Fix | Rollback safe? |
|---|---|---|
| Handler crashed on one event | Patch `subgraph/src/<entity>.ts`; bump version; `pnpm subgraph:deploy` | yes (subgraph is independent of chain) |
| Indexer slow but no errors | Wait — Graph Studio sometimes throttles free-tier indexing | yes |
| `SCRIBE_URL` pinned to an old version | Update every Vercel + GHA env that reads `SCRIBE_URL` to the current `v0.0.X` | yes |
| Subgraph dropped / unavailable | Redeploy the same version; update env vars if the URL changed | yes |

## Resolution checklist

- [ ] Subgraph head block within 50 blocks of RPC head
- [ ] Every dependent service (verify-app, notifier, agents) reports
      healthy queries against Scribe
- [ ] No `indexingErrors` in Graph Studio
- [ ] Post-mortem in `/incidents/` if SEV ≤ 2

## Escalation contacts

- F2 (subgraph owner) per `runbooks/on-call-rotation.md`
- The Graph Studio support (free tier — best-effort SLA)
