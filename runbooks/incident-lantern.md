# Incident runbook: Lantern proof-of-reserves stalled

Lantern publishes hourly Merkle attestations of the Coffer vault
balances. When publication stops, `/lantern` dashboard renders honest
"no attestation in N hours" and `/api/lantern/verify-inclusion` 404s.

## Severity

- **SEV-2** if no publish in 2-4 hours
- **SEV-1** if no publish in 4+ hours (PoR claim degrades)
- **SEV-0** if a publish includes a wrong root (false claim)

## Signals

- `/lantern` page shows "last attestation N hours ago" climbing past 2
- Better Stack alerts on `/api/lantern/latest` returning 404
- Sentry events tagged `service: lantern-attestor` cluster
- Subgraph query `lanternAttestations(first: 1, orderBy: timestamp,
  orderDirection: desc)` returns a row older than 2 hours

## Triage

1. `curl https://verify.useatrium.me/api/lantern/latest` . inspect
   `timestamp` field.
2. Check the Lantern attestor host (Vercel cron OR `$5 VPS` per
   the internal ops log). Log tail for the most recent tick.
3. Check signing key health: `cast call <lantern-attestor>
   "signing_key()" --rpc-url $RPC`. Must match the env-loaded key
   address. If mismatched, `LANTERN_KEY_ENVELOPE_JSON` Vercel env
   was not redeployed after rotation.
4. Check Scribe is up: a Lantern publish reads the Coffer balance
   list from Scribe. If Scribe is stale, publish has no input.

## Mitigations

| Symptom | Fix |
|---|---|
| Cron not firing | trigger manual run via praetor-cli `lantern publish-now` (an earlier hardening cycle) |
| Signing key mismatch | redeploy lantern-attestor with correct `LANTERN_KEY_ENVELOPE_JSON` |
| Scribe stale | see `runbooks/incident-scribe.md` (subgraph stalled) |
| Wrong root published | DO NOT REVERT  the publish is on-chain. File `/incidents/` immediately, publish a corrective attestation in the next hour with a `correction-of-root: 0x...` note in the IPFS pin. |

## Resolution checklist

- [ ] Next scheduled publish completes successfully
- [ ] `/lantern` shows recent attestation
- [ ] Subgraph indexed the new attestation
- [ ] Sentry events stop firing
- [ ] Post-mortem filed if SEV-1 or higher
