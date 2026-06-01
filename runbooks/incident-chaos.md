# Incident runbook: Chaos Mode misfire

Chaos Mode is the judge-facing demo lever that injects a controlled
oracle-drift OR keeper-pause OR Plinth-pause via the Praetor multisig
(an earlier hardening cycle). A misfire means either the chaos toggle did NOT actually
pause anything, OR (worse) the resume path is stuck and the subsystem
stays paused after the demo.

## Severity

- **SEV-2** if a chaos action did not pause as expected (demo failure)
- **SEV-1** if a chaos action paused but resume() reverts (testnet
  stays paused after demo, blocks the next user flow)
- **SEV-0** if a chaos action accidentally paused mainnet (Year-2
  surface; not applicable in Year-1 testnet)

## Signals

- Verifier-mode step 4 (chaos) shows neither `EmergencyPaused` nor
  `Plinth paused` events on Arbiscan
- /lantern dashboard banner stays red after the demo concludes
- Sentry events tagged `chaos: misfire`

## Triage (5 min target, demo is live)

1. Confirm whether the chaos tx landed at all:
   `cast tx <hash>` against the Praetor multisig.
2. If the tx landed but no `EmergencyPaused` event fired, the target
   is wrong, check `praetor pause <contract>` in the CLI; the
   `<contract>` slug must resolve to a live address in
   `deployments/arbitrum_sepolia.json`.
3. If the pause landed but resume() reverts, check the `Resumed`
   event handler in `services/agents/api/chaos.ts`, confirm it
   targets the same contract slug.

## Mitigations

| Symptom | Fix | Rollback safe? |
|---|---|---|
| Chaos tx never sent | Re-fire from Praetor multisig; verify CLI args | yes |
| Wrong target | Update target slug; re-fire | yes |
| Pause stuck on (resume reverts) | Direct multisig call to `<contract>.resume()`; bypass the CLI | yes |
| Cascading pause (paused one contract, blocked the chained next-step) | Resume in the correct order, Plinth before Coffer before Aqueduct | yes |
| Demo-time misfire | Switch to the Loom backup recorded per `runbooks/demo-day.md` | yes |

## Resolution checklist

- [ ] Every chaos-injected pause is resumed
- [ ] /lantern banner returns to green
- [ ] Verifier-mode step 4 shows the expected `EmergencyPaused →
      Resumed` event pair
- [ ] Post-mortem in `/incidents/` if SEV ≤ 2

## Escalation contacts

- On-call demo lead per `runbooks/on-call-rotation.md`
- Praetor multisig signers (3-of-5) for emergency resume
