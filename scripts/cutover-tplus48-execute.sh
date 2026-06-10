#!/usr/bin/env bash
# cutover-tplus48-execute.sh - complete the Sigil-fix cutover after the 48h
# timelock matures (ready 2026-06-06 ~09:10 UTC). Executes the 3 scheduled
# timelock ops on the NEW stack, then drives the real agent-mandate fill and
# verifies it landed. Idempotent: skips an op already executed.
#
#   bash scripts/cutover-tplus48-execute.sh check   # read-only state
#   bash scripts/cutover-tplus48-execute.sh run     # execute + drive the fill
#
# Cutover stack deployed 2026-06-04 (commit b4701dc Sigil selector fix):
#   sigil  0x3b58b39579dbbf4fcab5e2a3331812dc86b1f193  (validateAction(bytes,bytes) fixed)
#   plinth 0x2751021c9cb98f6d5fb07053e3e0e18bacfe0693  (-> new sigil)
#   router 0x237113cd7FEBa065795d9b38DB42075E91601718  (-> new plinth)
# Verified live pre-timelock: the fill reverts code 9 (UNKNOWN_VENUE), NOT code 6
# (INVALID_ACTION_SIGIL) - the Sigil selector fix works; only the instrument
# config + Coffer approval (these timelock ops) remain.
set -uo pipefail
# foundry (cast/forge) must be on PATH; add your install dir if needed, e.g.:
#   export PATH="$PATH:$HOME/.foundry/bin"
cd "$(dirname "$0")/.."
REPO="$(pwd)"; REPO_WIN=$(echo "$REPO" | sed 's|^/\([a-zA-Z]\)/|\1:/|')
set -a; source .env 2>/dev/null; set +a
MODE="${1:-check}"
RPC="${ARBITRUM_SEPOLIA_RPC_URL}"
KEY="${DEPLOYER_PRIVATE_KEY:-${PRIVATE_KEY:-${ARBITRUM_DEPLOYER_KEY:-}}}"
TL=0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4
SIGIL=0x3b58b39579dbbf4fcab5e2a3331812dc86b1f193
PLINTH=0x2751021c9cb98f6d5fb07053e3e0e18bacfe0693
ROUTER=0x237113cd7FEBa065795d9b38DB42075E91601718
COFFER=0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3
AAVE=0xd71C5D88d62e92EE8941cAE51f8637a73111C4E1
IID=0x128570b155efd3ba4fae8e482ebd851f483ef0bd8056503fc4e12ffd3e6ceedc
PYTH_FEED=0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a
MOCKCL=0x5D5e0996954114b70848587D7A7b49dEeA9c5D44
# scheduled timestamps captured at schedule time (2026-06-04T09:10Z)
TS_PLINTH=1780564242; TS_COFFER=1780564250; TS_ADAPTER=1780564256
D1=$(cast calldata "setInstrumentRisk(uint8,bytes32,uint16,uint16,bytes32,address,bool)" 2 "$IID" 100 1 "$PYTH_FEED" "$MOCKCL" true)
D2=$(cast calldata "setAdapter(address,bool,uint256)" "$ROUTER" true 1000000000000)
D3=$(cast calldata "setAuthorizedCaller(address,bool)" "$ROUTER" true)

exec_op() { # label target data ts
  local now=$(date +%s); local ready=$(($4+172800))
  if [ "$now" -lt "$ready" ]; then echo "[$1] NOT READY (in $(( (ready-now)/60 ))min)"; return 1; fi
  if [ "$MODE" != "run" ]; then echo "[$1] READY (check mode, no tx)"; return 0; fi
  cast send "$TL" "execute(address,bytes,uint64)" "$2" "$3" "$4" --private-key "$KEY" --rpc-url "$RPC" --json 2>&1 \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print('[$1] status',d.get('status'),'tx',d.get('transactionHash'))" 2>/dev/null || echo "[$1] exec failed/again"
}
echo "=== T+48h cutover completion ($MODE) ==="
exec_op plinth_instrument_risk "$PLINTH" "$D1" "$TS_PLINTH"; R1=$?
exec_op coffer_set_adapter     "$COFFER" "$D2" "$TS_COFFER"; R2=$?
exec_op adapter_authorize      "$AAVE"   "$D3" "$TS_ADAPTER"; R3=$?
echo "wiring: instrument_supported=$(cast call "$AAVE" "is_supported_instrument(bytes32)(bool)" "$IID" --rpc-url "$RPC" 2>&1|head -1)  coffer_approves_router=$(cast call "$COFFER" "isAdapterApproved(address)(bool)" "$ROUTER" --rpc-url "$RPC" 2>&1|head -1)  adapter_auth_router=$(cast call "$AAVE" "is_authorized_caller(address)(bool)" "$ROUTER" --rpc-url "$RPC" 2>&1|head -1)"
[ "$MODE" != "run" ] && { echo "check done"; exit 0; }
[ "$R1" -ne 0 -o "$R2" -ne 0 -o "$R3" -ne 0 ] && { echo "not all ready; re-run after 2026-06-06T09:10Z"; exit 0; }

echo "=== drive the real agent-mandate fill via new Router ==="
bash scripts/pyth-push-usdc.sh 2>&1 | tail -2
TKEY=$(python3 -c "import json;print(json.load(open(r'$REPO_WIN/.e2e-test-key.json'))[0]['private_key'])")
TADDR=$(python3 -c "import json;print(json.load(open(r'$REPO_WIN/.e2e-test-key.json'))[0]['address'])")
ENV_JSON=$(cd apps/verify && L_CHAIN_ID=421614 L_SIGIL=$SIGIL L_KEY=$TKEY node scripts/build-local-envelope.mjs)
INTENT=$(echo "$ENV_JSON"|python3 -c "import sys,json;print(json.load(sys.stdin)['intent_sigil'])")
ACTION=$(echo "$ENV_JSON"|python3 -c "import sys,json;print(json.load(sys.stdin)['action_sigil'])")
SUP_BEFORE=$(cast call 0x2e1360faE80c7937e684067450202D921F72555B "supplied(address,address)(uint256)" 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d "$AAVE" --rpc-url "$RPC" 2>/dev/null)
cast send "$ROUTER" "open_position_via_adapter(uint8,bytes32,int256,bytes,bytes,bytes)" \
  2 "$IID" 1000000 "$ACTION" "$INTENT" 0x --private-key "$TKEY" --rpc-url "$RPC" --json 2>&1 \
  | python3 -c "import sys,json
try: d=json.load(sys.stdin);print('[FILL] status',d.get('status'),'tx',d.get('transactionHash'))
except: print('[FILL] reverted:', sys.stdin.read()[:300])"
echo "pool.supplied: was $SUP_BEFORE now $(cast call 0x2e1360faE80c7937e684067450202D921F72555B "supplied(address,address)(uint256)" 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d "$AAVE" --rpc-url "$RPC" 2>/dev/null)"
echo "Then flip the app: update apps/verify deployment manifest + NEXT_PUBLIC addrs to sigil/plinth/router above, commit, push (auto-deploys)."
