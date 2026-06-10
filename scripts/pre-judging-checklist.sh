#!/usr/bin/env bash
# Pre-judging freshness ritual (buildathon, 2026-06). Run before any demo,
# recording session, or judging window. Fires the keepers, then verifies every
# judge-visible freshness signal and prints a green/red summary.
#
# Usage: bash scripts/pre-judging-checklist.sh
# Needs: gh (authed), curl, cast (foundry), python3. Reads RPC from env or
# falls back to the public Arbitrum Sepolia endpoint.

set -u
RPC="${ARBITRUM_SEPOLIA_RPC_URL:-${ARBITRUM_SEPOLIA_RPC:-https://sepolia-rollup.arbitrum.io/rpc}}"
BASE="${ATRIUM_BASE_URL:-https://useatrium.me}"
KEEPER=0x6821e3360D686A11b73AfaB4e3BC258fE7CC4a76
FAUCET=0x7f3a714c824c0926ae98ecfb2e59513e78d82bbc
USDC=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
PASS=0; FAIL=0
ok()   { echo "  [OK]   $1"; PASS=$((PASS+1)); }
bad()  { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

echo "== 1. fire the publishers =="
gh workflow run lantern-cron.yml >/dev/null 2>&1 && ok "lantern-cron dispatched" || bad "lantern-cron dispatch failed (gh auth?)"
gh workflow run pyth-keeper.yml >/dev/null 2>&1 && ok "pyth-keeper dispatched" || echo "  [..]   pyth-keeper dispatch skipped (may already be looping)"

echo "== 2. judge-visible freshness =="
SUM=$(curl -s --max-time 15 "$BASE/api/reserves/summary" 2>/dev/null)
STALE=$(echo "$SUM" | python3 -c "import sys,json;print(json.load(sys.stdin).get('isStale'))" 2>/dev/null)
[ "$STALE" = "False" ] && ok "PoR fresh (isStale:false)" || bad "PoR STALE on $BASE (isStale=$STALE) - wait for the dispatched lantern run, then re-check"

SCRIBE=$(curl -s --max-time 15 "$BASE/api/scribe/health" 2>/dev/null)
SSTALE=$(echo "$SCRIBE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('isStale'))" 2>/dev/null)
[ "$SSTALE" = "False" ] && ok "Scribe indexer fresh" || bad "Scribe stale ($SSTALE) - check SCRIBE_URL version vs Studio"

LANT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/api/lantern/latest" 2>/dev/null)
[ "$LANT" = "200" ] && ok "lantern/latest 200" || bad "lantern/latest HTTP $LANT"

CODEX=$(curl -s --max-time 15 "$BASE/api/codex/health" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('source'))" 2>/dev/null)
[ "$CODEX" = "live" ] && ok "Codex worker live" || bad "Codex health source=$CODEX"

echo "== 3. demo-path fuel =="
FB=$(cast call $USDC "balanceOf(address)(uint256)" $FAUCET --rpc-url "$RPC" 2>/dev/null | awk '{print $1}')
DROP=$(curl -s --max-time 15 "$BASE/api/faucet/status" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('usdcDrop') or 5)" 2>/dev/null)
if [ -n "${FB:-}" ] && [ -n "${DROP:-}" ] && [ "$DROP" != "0" ]; then
  CLAIMS=$(python3 -c "print(int('$FB')//(int(float('$DROP'))*1000000))" 2>/dev/null)
  if [ "${CLAIMS:-0}" -ge 5 ]; then ok "faucet stock: $CLAIMS claims left"; else bad "faucet LOW: ${CLAIMS:-?} claims left - refill via faucet.circle.com -> $FAUCET"; fi
else
  bad "faucet stock unreadable"
fi
KETH=$(cast balance $KEEPER --rpc-url "$RPC" 2>/dev/null)
python3 -c "import sys;sys.exit(0 if int('${KETH:-0}')>2000000000000000 else 1)" 2>/dev/null \
  && ok "keeper ETH healthy ($KETH wei)" || bad "keeper ETH LOW ($KETH wei) - top up $KEEPER (~7h per 0.005)"

echo "== 4. submission links =="
for u in "$BASE" "$BASE/pitch" "$BASE/verify" "$BASE/docs/honesty" "$BASE/architecture"; do
  C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$u" 2>/dev/null)
  [ "$C" = "200" ] && ok "$u" || bad "$u -> HTTP $C"
done

echo ""
echo "== RESULT: $PASS ok, $FAIL failing =="
[ $FAIL -eq 0 ] && echo "GREEN - judge-ready." || echo "RED - fix the FAIL lines before any demo or recording."
exit $FAIL
