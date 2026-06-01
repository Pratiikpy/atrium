# Runbook, deployer EOA key rotation

Rotates the deployer EOA that holds admin privileges on all Atrium contracts.
Triggered by: compromise, scheduled quarterly rotation, or incident follow-up.

**Incident context:** The May 24 2026 incident (`incidents/2026-05-24-deployer-key-leaked-to-local-temp-log.md`) requires this rotation.

---

## Prerequisites

- Access to PraetorTimelock multisig (3-of-5 signers available)
- `cast` CLI (Foundry) installed
- Doppler CLI authenticated to `atrium-prod`
- 48 hours of calendar time for timelock execution

---

## Procedure

### 1. Generate fresh EOA offline

```bash
# On an air-gapped machine or hardware wallet
cast wallet new
# Record: address + private key
# Never paste the private key into a networked terminal
```

### 2. Fund the new EOA

Transfer minimal ETH (0.05 testnet ETH) from the Praetor treasury to the new address for gas.

### 3. Schedule admin transfer on each contract

For each contract, schedule a `transferAdmin(newAddress)` call via PraetorTimelock:

**Stylus contracts:**
- Plinth: `praetor timelock schedule --target <PLINTH_ADDR> --call "transferAdmin(address)" --arg <NEW_EOA>`
- Coffer: `praetor timelock schedule --target <COFFER_ADDR> --call "transferAdmin(address)" --arg <NEW_EOA>`
- Sigil: `praetor timelock schedule --target <SIGIL_ADDR> --call "transferAdmin(address)" --arg <NEW_EOA>`
- Vigil: `praetor timelock schedule --target <VIGIL_ADDR> --call "transferAdmin(address)" --arg <NEW_EOA>`

**Solidity contracts:**
- Aqueduct: `praetor timelock schedule --target <AQUEDUCT_ADDR> --call "transferOwnership(address)" --arg <NEW_EOA>`
- AtriumRouter: `praetor timelock schedule --target <ROUTER_ADDR> --call "transferOwnership(address)" --arg <NEW_EOA>`
- Rostrum: `praetor timelock schedule --target <ROSTRUM_ADDR> --call "transferOwnership(address)" --arg <NEW_EOA>`
- PorticoRegistry: `praetor timelock schedule --target <PORTICO_ADDR> --call "transferOwnership(address)" --arg <NEW_EOA>`
- PosternKillSwitch: `praetor timelock schedule --target <POSTERN_ADDR> --call "transferOwnership(address)" --arg <NEW_EOA>`
- Edict: `praetor timelock schedule --target <EDICT_ADDR> --call "transferOwnership(address)" --arg <NEW_EOA>`
- ResearchAttestation: `praetor timelock schedule --target <RESEARCH_ADDR> --call "transferOwnership(address)" --arg <NEW_EOA>`
- LanternAttestor: `praetor timelock schedule --target <LANTERN_ADDR> --call "transferOwnership(address)" --arg <NEW_EOA>`

Contract addresses are in `deployments/arbitrum_sepolia.json`.

### 4. Wait 48 hours

The PraetorTimelock enforces a 48-hour delay. Monitor the scheduled txs:

```bash
cast call <TIMELOCK_ADDR> "getTimestamp(bytes32)" <OPERATION_ID>
```

### 5. Execute all transfers

After 48h, execute each scheduled operation:

```bash
praetor timelock execute --operation-id <ID>
```

Repeat for every contract.

### 6. Verify on-chain

For each contract, confirm the new EOA is admin:

```bash
cast call <CONTRACT_ADDR> "admin()" | grep <NEW_EOA>
# or for OZ Ownable:
cast call <CONTRACT_ADDR> "owner()" | grep <NEW_EOA>
```

### 7. Update Doppler

```bash
doppler secrets set DEPLOYER_PRIVATE_KEY=<NEW_PRIVATE_KEY> --project atrium-prod --config praetor-cli
doppler secrets set DEPLOYER_PRIVATE_KEY=<NEW_PRIVATE_KEY> --project atrium-prod --config vigil-keeper
```

Remove the old key from all configs. Confirm no config references the old address.

### 8. Retire old EOA

- Drain remaining ETH from old EOA to treasury.
- Remove old address from any allowlists (GHA secrets, Vercel env).
- Document rotation in `incidents/key-rotation-YYYYMMDD.md`.

---

## Rollback plan (within 48h window)

If the new EOA is compromised before execution, or if the rotation must be aborted:

```bash
# Cancel all pending timelock operations
praetor timelock cancel --operation-id <ID>
```

Each scheduled operation can be cancelled by any multisig signer before the 48h window expires. After execution, rollback requires scheduling a new `transferAdmin` back to the old (or a third) EOA, another 48h wait.

---

## Post-rotation checklist

- [ ] All contracts report new EOA as admin/owner
- [ ] Old EOA has zero admin privileges (verified via on-chain reads)
- [ ] Doppler `atrium-prod` updated
- [ ] GHA repo secrets updated (if any reference deployer directly)
- [ ] Vercel project env updated (if any reference deployer directly)
- [ ] Old EOA drained of ETH
- [ ] Incident doc written
- [ ] Team notified in Discord #ops
