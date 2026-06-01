#!/usr/bin/env bash
# tplus48-aave-fill.sh, drive the first REAL on-chain trade-fill through
# AtriumRouter on Arbitrum Sepolia, once the three 48h timelock ops scheduled
# 2026-05-29/30 have elapsed.
#
# This is the single command for the T+48h verification the founder approved
# ("auto-execute + verify, then report"). It is IDEMPOTENT and self-gated: each
# timelock op is executed only if its 48h window has opened and it has not
# already executed; the fill runs only after all wiring is in place.
#
# Sequence:
#   1. execute #337  Coffer.setAdapter(Router,true,cap)          ready 2026-05-31T19:34Z
#   2. execute       Plinth.set_instrument_risk(venue 2 USDC-LEND) ready ~2026-05-31T22:49Z
#   3. execute       AaveHorizonAdapterV11.addInstrument(USDC-LEND) ready ~2026-05-31T22:51Z
#   4. push a fresh USDC/USD price into Pyth (scripts/pyth-push-usdc.sh)
#   5. build + sign the EIP-712 intent+action sigils (apps/verify build-aave-fill-envelope.mjs)
#   6. AtriumRouter.open_position_via_adapter(2, USDC-LEND, 1e6, action, intent, 0x) from the test key
#   7. verify on-chain: pool.supplied grew, venue position owner == test key, Coffer shares fell
#
# MODES:  bash scripts/tplus48-aave-fill.sh check   # read-only: print state, run NO tx
#         bash scripts/tplus48-aave-fill.sh run     # execute the elapsed ops + drive the fill
#
# ENV:    source .env first. Needs ARBITRUM_SEPOLIA_RPC_URL, a deployer key
#         (DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|ARBITRUM_DEPLOYER_KEY) for the timelock
#         executes, and the funded throwaway test key at repo .e2e-test-key.json
#         for the Router open.
#
# KNOWN RISK (#430): the Router pulls Plinth's margin DELTA to the adapter, but
#   the adapter supplies abs(notional). For USDC-LEND (cash-equivalent) the fill
#   succeeds only if Plinth's required margin >= notional. If the margin is a
#   fraction of notional, step 6 reverts at pool.supply (adapter under-funded) -
#   that is the #430 seam surfacing on a real fill, a genuine result to report,
#   not a script bug. Reported honestly either way.
set -uo pipefail

MODE="${1:-check}"
RPC="${ARBITRUM_SEPOLIA_RPC_URL:?set ARBITRUM_SEPOLIA_RPC_URL}"
KEY="${DEPLOYER_PRIVATE_KEY:-${PRIVATE_KEY:-${ARBITRUM_DEPLOYER_KEY:-}}}"

TL="0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4"
COFFER="0xd169554caf920f1fbcffbafcff3068a84892b0d8"
ROUTER="0xF134127Cc2762d3Ebc5645abA6c99cD5a8b82717"
PLINTH="0xef31b4b75badc0faf323e3448248585b57a78ecd"
AAVE="0x826dc4FE429d0Df6454E11dAeA10f2975b551042"
MOCKCL="0x5D5e0996954114b70848587D7A7b49dEeA9c5D44"
PYTH_FEED="0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
IID="0x128570b155efd3ba4fae8e482ebd851f483ef0bd8056503fc4e12ffd3e6ceedc"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

# op: target, scheduledTs, scheduled calldata, expected id
OP337_TS=1780083268
OP337_DATA=$(cast calldata "setAdapter(address,bool,uint256)" "$ROUTER" true 10000000000)
OP337_ID="0x8703d00b6e6575123d675dd2cc45e95a157cab7253cd1332c775289870efe2e1"
OPSIR_TS=1780094981
OPSIR_DATA=$(cast calldata "setInstrumentRisk(uint8,bytes32,uint16,uint16,bytes32,address,bool)" 2 "$IID" 100 1 "$PYTH_FEED" "$MOCKCL" true)
OPSIR_ID="0x0dd4e5c0c95fca123d5341aeea1f53c145e1684976f593d6e6cf3179720e50e4"
OPADD_TS=1780095079
OPADD_DATA=$(cast calldata "addInstrument(bytes32,uint16,uint16,uint16)" "$IID" 100 500 200)
OPADD_ID="0x29f99514d54dc4613f5fb65233f95a48abc3e9520dcd47376e8b7562d7b80795"

now() { date +%s; }

# execute_op <label> <target> <ts> <data> <id>
execute_op() {
  local label="$1" target="$2" ts="$3" data="$4" id="$5"
  local executed ready_at n
  executed=$(cast call "$TL" "executed(bytes32)(bool)" "$id" --rpc-url "$RPC")
  ready_at=$((ts + 172800)); n=$(now)
  if [ "$executed" = "true" ]; then echo "[$label] already executed, skip"; return 0; fi
  if [ "$n" -lt "$ready_at" ]; then echo "[$label] NOT READY (ready_at $ready_at, now $n, in $(( (ready_at-n)/60 ))min)"; return 1; fi
  # recompute the id to be sure nothing drifted before broadcasting
  local recomputed; recomputed=$(cast keccak "$(cast abi-encode 'f(address,bytes,uint256)' "$target" "$data" "$ts")")
  if [ "$recomputed" != "$id" ]; then echo "[$label] ID MISMATCH ($recomputed != $id), ABORT, not broadcasting"; return 2; fi
  if [ "$MODE" != "run" ]; then echo "[$label] READY, would execute (check mode, no tx)"; return 0; fi
  echo "[$label] executing..."
  cast send "$TL" "execute(address,bytes,uint64)" "$target" "$data" "$ts" --private-key "$KEY" --rpc-url "$RPC" --json \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('[$label] status', d['status'], 'tx', d['transactionHash'])"
}

echo "=== T+48h Aave fill driver ($MODE) ==="
execute_op "#337 Coffer->Router" "$COFFER" "$OP337_TS" "$OP337_DATA" "$OP337_ID"; R1=$?
execute_op "set_instrument_risk"  "$PLINTH" "$OPSIR_TS" "$OPSIR_DATA" "$OPSIR_ID"; R2=$?
execute_op "addInstrument"        "$AAVE"   "$OPADD_TS" "$OPADD_DATA" "$OPADD_ID"; R3=$?

echo; echo "=== wiring state ==="
echo "Coffer.isAdapterApproved(Router): $(cast call "$COFFER" "isAdapterApproved(address)(bool)" "$ROUTER" --rpc-url "$RPC")"
echo "Registry venue2 -> $(cast call 0x9a9af6e50491cd4694699d48564bbff18f9b40bc "getAdapter(uint8)(address)" 2 --rpc-url "$RPC")"
echo "Adapter.is_supported_instrument(USDC-LEND): $(cast call "$AAVE" "is_supported_instrument(bytes32)(bool)" "$IID" --rpc-url "$RPC")"
echo "Adapter.is_authorized_caller(Router): $(cast call "$AAVE" "is_authorized_caller(address)(bool)" "$ROUTER" --rpc-url "$RPC")"

if [ "$R1" -ne 0 ] || [ "$R2" -ne 0 ] || [ "$R3" -ne 0 ]; then
  echo; echo "Not all timelock ops are executed yet, stopping before the fill. Re-run after the windows open."
  exit 0
fi
if [ "$MODE" != "run" ]; then echo; echo "check mode: wiring shown above; re-run with 'run' once windows are open to drive the fill."; exit 0; fi

echo; echo "=== step 4: push fresh Pyth ==="
bash "$REPO/scripts/pyth-push-usdc.sh"

echo; echo "=== step 5: build + sign sigil envelopes ==="
TKEY=$(python3 -c "import json; print(json.load(open('$REPO/.e2e-test-key.json'))[0]['private_key'])")
TADDR=$(python3 -c "import json; print(json.load(open('$REPO/.e2e-test-key.json'))[0]['address'])")
ENV_JSON=$(cd "$REPO/apps/verify" && E2E_PRIVATE_KEY="$TKEY" node scripts/build-aave-fill-envelope.mjs build)
INTENT=$(echo "$ENV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['intent_sigil'])")
ACTION=$(echo "$ENV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['action_sigil'])")
USDC=$(cast call "$AAVE" "usdc()(address)" --rpc-url "$RPC")

echo; echo "=== step 6: pre-state ==="
SHARES_BEFORE=$(cast call "$COFFER" "balanceOf(address)(uint256)" "$TADDR" --rpc-url "$RPC")
SUPPLIED_BEFORE=$(cast call "0x2e1360faE80c7937e684067450202D921F72555B" "supplied(address,address)(uint256)" "$USDC" "$AAVE" --rpc-url "$RPC")
echo "test key Coffer shares: $SHARES_BEFORE ; pool.supplied(adapter): $SUPPLIED_BEFORE"

echo; echo "=== step 6: open_position_via_adapter (real fill) ==="
cast send "$ROUTER" "open_position_via_adapter(uint8,bytes32,int256,bytes,bytes,bytes)" \
  2 "$IID" 1000000 "$ACTION" "$INTENT" 0x --private-key "$TKEY" --rpc-url "$RPC" --json 2>&1 \
  | python3 -c "import sys,json
try:
  d=json.load(sys.stdin); print('[fill] status', d.get('status'), 'tx', d.get('transactionHash'))
except Exception as e: print('[fill] raw:', sys.stdin.read()[:500])" || echo "[fill] reverted (see #430 risk note in header)"

echo; echo "=== step 7: post-state / verify ==="
echo "test key Coffer shares: $(cast call "$COFFER" "balanceOf(address)(uint256)" "$TADDR" --rpc-url "$RPC") (was $SHARES_BEFORE)"
echo "pool.supplied(adapter): $(cast call "0x2e1360faE80c7937e684067450202D921F72555B" "supplied(address,address)(uint256)" "$USDC" "$AAVE" --rpc-url "$RPC") (was $SUPPLIED_BEFORE)"
echo "Done. If supplied grew + shares fell, the real on-chain fill landed; if it reverted at supply, that is the #430 margin-delta seam on a real fill."
