# Deploy runbook

Pre-flight:
- [ ] `.env` populated, all secrets present
- [ ] Praetor multisig has 3 of 5 signers reachable
- [ ] LINK balance on Aqueduct prefund wallet ≥ 100 testnet LINK
- [ ] CI green on the commit being deployed

## Wave 1 — foundation

1. `praetor deploy --network arbitrum_sepolia --contract praetor-timelock`
2. Record address in `deployments/arbitrum-sepolia.json`
3. `praetor deploy --contract coffer`
4. `praetor deploy --contract portico-registry`
5. `praetor deploy --contract sigil`
6. `praetor deploy --contract edict`
7. Wire addresses into `apps/verify/.env.local` and `services/codex/wrangler.toml`

## Wave 2 — core protocol

8. `praetor deploy --contract plinth` — pass coffer/sigil/portico/edict addresses to initialize
9. `praetor deploy --contract vigil` — pass plinth/coffer addresses to initialize
10. `praetor deploy --contract postern-kill-switch`
11. `praetor deploy --contract research-attestation`

## Wave 3 — adapters

12. For each adapter: deploy, verify on Arbiscan, register in PorticoRegistry with bytecode hash
13. `praetor multisig schedule --target portico-registry --call <abi-encoded registerAdapter call>`
14. Wait 48h, then `praetor multisig execute --id <id>`

## Post-deploy smoke test

- Run `tests/e2e/full-journey.spec.ts` against the live testnet
- Verify Lantern publishes an attestation within 60 minutes
- Verify Scribe indexer is < 30s behind chain head
- Verify Codex /v1/venues/health returns all 6 venues
