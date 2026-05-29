#!/usr/bin/env bash
# pyth-push-usdc.sh — push a fresh USDC/USD price into the on-chain Pyth oracle
# on Arbitrum Sepolia, then confirm it is readable inside Plinth's 60s freshness
# window.
#
# WHY THIS EXISTS
#   Plinth's dual-oracle reader (PlinthOracle.safe_price) requires BOTH a
#   Chainlink and a Pyth price no older than 60 seconds. Arbitrum Sepolia has no
#   Chainlink USDC/USD feed (we supply that leg via the MockChainlinkUsdFeed
#   stub, always fresh), and Pyth on this testnet is PULL-based: nobody keeps it
#   continuously fresh, so a read can be tens of minutes stale. Before any trade
#   that prices the USDC-LEND instrument, a caller must pull a signed update
#   from Hermes and push it on-chain so the Pyth leg is inside the window.
#
#   This is the per-trade "fresh mark" step for the venue-2 (Aave Horizon) fill.
#   Run it immediately before Router.open_position_via_adapter at T+48h.
#
# CAVEAT: Hermes requires an API key after 2026-07-31; until then this is
#   unauthenticated. For production a self-hosted Hermes or a keeper push is the
#   Year-2 path (see project memory + task #429).
#
# USAGE:  source .env first (needs ARBITRUM_SEPOLIA_RPC_URL + a deployer/test
#         private key in DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|ARBITRUM_DEPLOYER_KEY),
#         then:  bash scripts/pyth-push-usdc.sh
set -euo pipefail

PYTH="${PYTH_ADDR:-0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF}"
FEED="${PYTH_USDC_FEED:-0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a}"
RPC="${ARBITRUM_SEPOLIA_RPC_URL:?set ARBITRUM_SEPOLIA_RPC_URL}"
KEY="${DEPLOYER_PRIVATE_KEY:-${PRIVATE_KEY:-${ARBITRUM_DEPLOYER_KEY:-}}}"
if [ -z "$KEY" ]; then echo "no private key in env (DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|ARBITRUM_DEPLOYER_KEY)"; exit 1; fi

echo "[pyth-push] fetching fresh USDC/USD update from Hermes..."
BLOB=$(curl -fsS "https://hermes.pyth.network/v2/updates/price/latest?ids[]=${FEED}&encoding=hex" \
  | python3 -c "import sys,json; print('0x'+json.load(sys.stdin)['binary']['data'][0])")
if [ "${#BLOB}" -lt 100 ]; then echo "[pyth-push] Hermes returned no update blob"; exit 1; fi
echo "[pyth-push] update blob ${#BLOB} hex chars"

FEE=$(cast call "$PYTH" "getUpdateFee(bytes[])(uint256)" "[$BLOB]" --rpc-url "$RPC")
echo "[pyth-push] update fee: $FEE wei"

echo "[pyth-push] pushing updatePriceFeeds..."
cast send "$PYTH" "updatePriceFeeds(bytes[])" "[$BLOB]" --value "$FEE" \
  --private-key "$KEY" --rpc-url "$RPC" --json | python3 -c "import sys,json; d=json.load(sys.stdin); print('[pyth-push] status', d['status'], 'tx', d['transactionHash'])"

echo "[pyth-push] verifying getPriceNoOlderThan(60s)..."
cast call "$PYTH" "getPriceNoOlderThan(bytes32,uint256)(int64,uint64,int32,uint256)" "$FEED" 60 --rpc-url "$RPC"
echo "[pyth-push] OK — USDC/USD is fresh within the 60s window"
