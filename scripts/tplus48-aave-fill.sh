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
# Sequence (post-cutover contracts; #337 already done in the cutover):
#   1. execute       Plinth.set_instrument_risk(venue 2 USDC-LEND) ready 2026-06-03T13:48:22Z
#   2. execute       AaveHorizonAdapterV11.addInstrument(USDC-LEND) ready 2026-06-03T13:48:24Z
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

# Post-cutover contract set (verified on chain 2026-06-02; the app's
# /api/deployments + Plinth.sigilAddress() are the source of truth). The
# pre-cutover addresses this script first shipped with were retired in the
# cutover, so the fill must run against these or it lands on dead contracts.
TL="0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4"
COFFER="0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3"
ROUTER="0xF593e012196BDe8A58Ccdbf685f7A74fD3bD35e0"
PLINTH="0xd86f579ec880eaab27dfa698ae056d1893ec7553"
AAVE="0xd71C5D88d62e92EE8941cAE51f8637a73111C4E1"
MOCKCL="0x5D5e0996954114b70848587D7A7b49dEeA9c5D44"
PYTH_FEED="0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
IID="0x128570b155efd3ba4fae8e482ebd851f483ef0bd8056503fc4e12ffd3e6ceedc"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

# Post-cutover ops (.forge-cache/aave-instrument-ops.json, scheduled
# 2026-05-31, 48h delay -> ready 2026-06-03T13:48:22Z). #337 Coffer.setAdapter
# is NOT here: the new Coffer already has isAdapterApproved(Router)=true
# (executed during the cutover, verified on chain 2026-06-02). IDs below were
# recomputed from (target,data,ts) and matched the timelock's executed()=false
# on chain; execute_op re-checks the id before broadcasting.
OPSIR_TS=1780321702
OPSIR_DATA=$(cast calldata "setInstrumentRisk(uint8,bytes32,uint16,uint16,bytes32,address,bool)" 2 "$IID" 100 1 "$PYTH_FEED" "$MOCKCL" true)
OPSIR_ID="0x04b06d5cccba794a713a766d2a49dd0a5bdea2be3f80e83f4203db981aa3f84b"
OPADD_TS=1780321704
OPADD_DATA=$(cast calldata "addInstrument(bytes32,uint16,uint16,uint16)" "$IID" 100 500 200)
OPADD_ID="0xc5bb3f537f8464f5c1a4d3284a05e26740cf0f80511afb268ad24e8e35f42e8e"

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
R1=0  # #337 Coffer.setAdapter already executed in the cutover (isAdapterApproved=true)
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
