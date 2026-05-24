#!/bin/sh
set -e
ROOT=//work
CHAIN=421614
verify() {
  local addr="$1" path="$2" name="$3"
  echo "=== $name @ $addr ==="
  cd "$ROOT" && forge verify-contract "$addr" "$path:$name" --chain-id "$CHAIN" --verifier sourcify --watch 2>&1 | grep -E "Status|verified|already|Error" | head -3
  echo
}

# Phase 0 contracts
verify 0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4 contracts/praetor-timelock/src/PraetorTimelock.sol PraetorTimelock
verify 0x9a9af6e50491cd4694699d48564bbff18f9b40bc contracts/portico-registry/src/PorticoRegistry.sol PorticoRegistry
verify 0x900a9fb4bab7576fc11e4bb3c002d89dbe261168 contracts/lantern-attestor/src/LanternAttestor.sol LanternAttestor
verify 0x21c5ecc5b3ad6b066ef32145a06ed1b688d3103d contracts/curator/src/Curator.sol Curator
verify 0x66577042b4d47312e554bbfa5e29ae20f55dd631 contracts/edict/src/Edict.sol Edict
verify 0xfabc1fee1342be58996fec74cfc3612d4ac8a0ba contracts/research-attestation/src/ResearchAttestation.sol ResearchAttestation
verify 0x6d655803bac4bf61ad5ad26fd3b88429671cb5db contracts/stoa/src/StoaBlackScholes.sol StoaBlackScholes

# Phase B contracts (Aqueduct already done)
verify 0x9a66c9cb43dcfafa696cec66b33bec74c94ddc70 contracts/aqueduct/src/AqueductReceiver.sol AqueductReceiver
verify 0x4d441fca986d51d17c71f979814e2a492a429382 contracts/aqueduct/src/AqueductClaimback.sol AqueductClaimback
verify 0x28c9fd500d2d8e3b56259a1054e9da05dec747d8 contracts/postern-kill-switch/src/PosternKeyRegistry.sol PosternKeyRegistry
verify 0xb90a51a726740065bd0dbc20cd79306b30d8b676 contracts/postern-kill-switch/src/PosternKillSwitch.sol PosternKillSwitch
verify 0xb982c46d7a4aa7f1ebef91ca4cc0a34be1cf8549 contracts/faucet/src/Faucet.sol Faucet
