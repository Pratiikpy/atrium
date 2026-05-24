#!/bin/sh
cd /work
verify() {
  echo "=== $2 ==="
  forge verify-contract "$1" "$2" --chain-id 421614 --verifier sourcify --watch 2>&1 | grep -E "Status|verified|already|Error" | head -3
  echo
}
verify 0xe991ec988a62bcc38740f8b8c549e5400ded8d5d contracts/adapters/aave-horizon/src/AaveHorizonAdapter.sol:AaveHorizonAdapter
verify 0xf3da25f3ff8bdddc093e34c2f2b117cdb7505682 contracts/adapters/curve/src/CurveAdapter.sol:CurveAdapter
verify 0x2531af9f7596d74f412bfab7d3b84ee7a32cd2d4 contracts/adapters/gmx/src/GmxV2Adapter.sol:GmxV2Adapter
verify 0x87014fbace9ade49bf923bcfae74b4c858cf371e contracts/adapters/hyperliquid/src/HyperliquidHybridAdapter.sol:HyperliquidHybridAdapter
verify 0xfabe2b0d1c66bc2976ed3b0c58f3cdcb7878344e contracts/adapters/morpho/src/MorphoBlueAdapter.sol:MorphoBlueAdapter
verify 0x54a1bc2c5c73cc531035b0f008c8a252a02daf7d contracts/adapters/pendle/src/PendleV2Adapter.sol:PendleV2Adapter
verify 0x98a688723c47ab6909be04fd0aa3eca5ee8b08db contracts/adapters/polymarket/src/PolymarketAdapter.sol:PolymarketAdapter
verify 0x62b3b34ffa76fb62245702c0b7efd37832eb39b8 contracts/adapters/synthetix/src/SynthetixV3Adapter.sol:SynthetixV3Adapter
verify 0xf34c38d9e61a1b1beafffbb681b07e489c36a1ce contracts/adapters/trade-xyz/src/TradeXyzAdapter.sol:TradeXyzAdapter
