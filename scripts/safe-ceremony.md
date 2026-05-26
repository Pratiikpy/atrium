# 3-of-5 Safe ceremony runbook

Right now `praetor_multisig = deployer EOA` on every Atrium contract.
Any single key compromise = total protocol drain.
The deployer EOA was leaked locally on 2026-05-24 (see
`incidents/2026-05-24-deployer-key-leaked-to-local-temp-log.md`).
This ceremony hands admin to a 3-of-5 Gnosis Safe.

## Pre-requisites

1. Three founders with hardware wallets (Ledger or Trezor).
2. Two trusted external signers willing to hold an Atrium signer key.
3. Each signer has 0.05 ETH on Arbitrum Sepolia for ceremony gas.
4. Foundry installed (`forge`).
5. Deployer EOA private key in `.forge-cache/deployer-pk.txt`
   (wiped after the ceremony per `docs/conventions/security.md`).

## Steps

### 1. Generate the 5 signer addresses

Each signer creates a new hardware-wallet account dedicated to Atrium
admin. **Do not reuse a personal wallet.** Record the addresses in
order (signer index will matter for the Safe UI).

```
signer1: 0xF1FOUNDER1...
signer2: 0xF2FOUNDER2...
signer3: 0xF3FOUNDER3...
signer4: 0xEXTERNAL1...
signer5: 0xEXTERNAL2...
```

Update `scripts/transfer-admin.s.sol` with the new Safe address (you
will have it after step 3).

### 2. Each signer adds Arbitrum Sepolia to their hardware wallet

In the wallet UI, add the network manually:
- Chain ID: 421614
- RPC URL: https://arbitrum-sepolia.publicnode.com
- Explorer: https://sepolia.arbiscan.io

### 3. Create the Safe on Sepolia

Go to https://app.safe.global, switch chain to Arbitrum Sepolia, click
**Create Safe**. Paste the 5 signer addresses, set threshold to **3 of 5**,
review, sign with signer1 (the creator) to deploy. Cost: ~0.005 ETH.

Record the deployed Safe address: `NEW_SAFE=0x...` (will use in step 5).

### 4. Verify the Safe is healthy

```bash
cast call $NEW_SAFE "getThreshold()(uint256)" --rpc-url $RPC
# expect: 3

cast call $NEW_SAFE "getOwners()(address[])" --rpc-url $RPC
# expect: the 5 addresses you supplied
```

### 5. Run the transferAdmin script

```bash
export DEPLOYER_PK=$(cat .forge-cache/deployer-pk.txt)
export NEW_SAFE=0x...   # from step 3
export RPC=https://arbitrum-sepolia.publicnode.com

forge script scripts/transfer-admin.s.sol:TransferAdmin \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PK \
  --broadcast \
  --slow
```

The script reads `deployments/arbitrum_sepolia.json` for every contract
with an admin role and emits one `transferAdmin(NEW_SAFE)` tx per
contract. Slow flag prevents reorg on the testnet.

### 6. Verify admin transferred everywhere

```bash
for c in coffer plinth sigil vigil portico-registry atrium-router \
         praetor-timelock aqueduct lantern-attestor postern-kill-switch \
         research-attestation edict rostrum; do
  ADDR=$(jq -r ".contracts.\"$c\".address" deployments/arbitrum_sepolia.json)
  CURRENT=$(cast call "$ADDR" "praetor_multisig()(address)" --rpc-url $RPC)
  echo "$c $CURRENT (expect $NEW_SAFE)"
done
```

Every line must show the new Safe address. If any contract still
shows the deployer EOA, re-run the script with that contract
allow-listed via the `ONLY_CONTRACTS` env.

### 7. Wipe the deployer key + rotate Vercel deploy keys

```bash
shred -u .forge-cache/deployer-pk.txt   # macOS: rm -P
```

Generate a fresh deployer EOA for any future deploys (the leaked one
has no admin power anymore but should not be reused). Document the
rotation in `incidents/2026-XX-deployer-key-rotated.md`.

### 8. File the tripwire

Add `tripwires/2026-XX-3of5-safe-migration-complete.md` recording:
- ceremony date
- the 5 signer addresses (public, ok to commit)
- the new Safe address
- the rotation tx hashes per contract
- the deployer key wipe confirmation

## What this gives us

- Single-key compromise no longer drains the protocol. Three signers
  must collude (or be compromised) for a malicious admin action.
- Praetor multisig delays match the existing 48 h timelock + emergency
  pause separation; the Safe is the source of the multisig signature.
- Insurance + bug bounty programs require multisig admin; this
  unblocks the Year-2 mainnet flip discussion.

## What this does NOT give us

- The keeper key, the Lantern signing key, the Chaos drill key remain
  per-service EOAs. Those are documented separately in
  the internal ops log under each service.
- The Safe itself is not a hardware-recovery system. If three signers
  lose their hardware wallets, Atrium is locked. Each signer must
  keep their recovery phrase in a separate secure location.
