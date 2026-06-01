// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {AaveHorizonAdapter} from "../contracts/adapters/aave-horizon/src/AaveHorizonAdapter.sol";
import {CurveAdapter} from "../contracts/adapters/curve/src/CurveAdapter.sol";
import {GmxV2Adapter} from "../contracts/adapters/gmx/src/GmxV2Adapter.sol";
import {HyperliquidHybridAdapter} from "../contracts/adapters/hyperliquid/src/HyperliquidHybridAdapter.sol";
import {MorphoBlueAdapter} from "../contracts/adapters/morpho/src/MorphoBlueAdapter.sol";
import {PendleV2Adapter} from "../contracts/adapters/pendle/src/PendleV2Adapter.sol";
import {PolymarketAdapter} from "../contracts/adapters/polymarket/src/PolymarketAdapter.sol";
import {SynthetixV3Adapter} from "../contracts/adapters/synthetix/src/SynthetixV3Adapter.sol";
import {TradeXyzAdapter} from "../contracts/adapters/trade-xyz/src/TradeXyzAdapter.sol";

/// @title Atrium Phase-C, 9 venue adapters (Plinth + Coffer now live)
/// @notice For venues with no Arbitrum-Sepolia testnet contract (most
///         perp venues), the adapter is wired to a deployer-EOA placeholder.
///         The adapter deploys + has a real address; calls to its venue-
///         specific endpoint will revert with "call to non-contract", the
///         honest "venue not on this testnet" failure mode. When a venue
///         publishes a testnet contract, run a setVenue(address) Praetor
///         action to repoint.
contract PhaseC is Script {
    // === Phase-A + B outputs ===
    address constant USDC             = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    address constant COFFER           = 0x7420084855421EF0794a971BD5190F5c0C292071;
    address constant AQUEDUCT         = 0x6139449BF43F44385D08640B2E6FD2B82cb87EC2;
    address constant PRAETOR_TIMELOCK = 0x0dAd24d7feb2bB797e0f69e02c2F32104FCF22d4;

    // CCIP destination chain selectors (Chainlink docs).
    uint64 constant POLYGON_AMOY_SELECTOR = 16281711391670634445;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        require(block.chainid == 421614, "expected Arbitrum Sepolia (421614)");

        // Venue addresses without an Arbitrum-Sepolia testnet contract get
        // the deployer's address as a placeholder. Adapter deploys cleanly;
        // venue-call reverts with NoCode, honest "not wired on this chain".
        address venuePlaceholder = deployer;

        vm.startBroadcast(pk);

        // ---- 1. Aave Horizon ----
        AaveHorizonAdapter aave = new AaveHorizonAdapter(
            venuePlaceholder, USDC, COFFER, deployer
        );
        console.log("AaveHorizonAdapter:    ", address(aave));

        // ---- 2. Curve ----
        // _usdc_index=0 (USDC is conventionally slot 0 in 3pool-style LPs).
        // _instrument is a deterministic id (keccak256("curve.3pool.usdc"))
        // used to scope the adapter's haircut config, must be non-zero.
        CurveAdapter curve = new CurveAdapter(
            venuePlaceholder, USDC, venuePlaceholder, int128(0), COFFER, deployer, PRAETOR_TIMELOCK,
            keccak256("curve.3pool.usdc")
        );
        console.log("CurveAdapter:          ", address(curve));

        // ---- 3. GMX V2 ----
        GmxV2Adapter gmx = new GmxV2Adapter(
            venuePlaceholder, USDC, COFFER, deployer, PRAETOR_TIMELOCK
        );
        console.log("GmxV2Adapter:          ", address(gmx));

        // ---- 4. Hyperliquid (HIP-3 + HIP-4 share this adapter) ----
        // _required = 1 → single-validator placeholder (real HL uses ~5).
        HyperliquidHybridAdapter hl = new HyperliquidHybridAdapter(
            venuePlaceholder, USDC, COFFER, deployer, PRAETOR_TIMELOCK, uint16(1)
        );
        console.log("HyperliquidHybrid:     ", address(hl));

        // ---- 5. Morpho Blue ----
        MorphoBlueAdapter morpho = new MorphoBlueAdapter(
            venuePlaceholder, COFFER, deployer, PRAETOR_TIMELOCK
        );
        console.log("MorphoBlueAdapter:     ", address(morpho));

        // ---- 6. Pendle V2 ----
        PendleV2Adapter pendle = new PendleV2Adapter(
            venuePlaceholder, USDC, COFFER, deployer, PRAETOR_TIMELOCK
        );
        console.log("PendleV2Adapter:       ", address(pendle));

        // ---- 7. Polymarket ----
        // Routes via Aqueduct/CCIP to Polygon Amoy testnet.
        PolymarketAdapter poly = new PolymarketAdapter(
            AQUEDUCT, USDC, COFFER, deployer, PRAETOR_TIMELOCK, POLYGON_AMOY_SELECTOR
        );
        console.log("PolymarketAdapter:     ", address(poly));

        // ---- 8. Synthetix V3 ----
        // _atrium_account_id = 1 (single-account placeholder per development conventions).
        SynthetixV3Adapter synth = new SynthetixV3Adapter(
            venuePlaceholder, USDC, COFFER, deployer, PRAETOR_TIMELOCK, uint128(1)
        );
        console.log("SynthetixV3Adapter:    ", address(synth));

        // ---- 9. Trade.xyz ----
        TradeXyzAdapter trade = new TradeXyzAdapter(
            venuePlaceholder, USDC, COFFER, deployer, PRAETOR_TIMELOCK
        );
        console.log("TradeXyzAdapter:       ", address(trade));

        vm.stopBroadcast();
    }
}
