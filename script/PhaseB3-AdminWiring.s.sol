// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

/// @title Atrium Phase-B.3, post-deploy admin wiring (timelock-gated)
/// @notice After Plinth + adapters are live the chain needs:
///         1. PorticoRegistry.registerAdapter(venue_id, adapter, bytecode_hash, major)
///            for each of the 9 adapters, gated by PraetorTimelock (48 h).
///         2. Aqueduct.setAqueductOnDest(chain_selector, address) for each
///            destination chain we want to bridge to, timelock-gated.
///         3. AqueductReceiver.setAllowedSource(chain_selector, source_aqueduct)
///            on the destination chains.
///         4. Aqueduct.setClaimbackRegistry(claimback_addr).
///
///         All setters are `onlyTimelock` → the multisig schedules each call
///         on PraetorTimelock with a 48 h delay, then executes after the
///         veto window passes. This script generates the schedule + execute
///         calldata for every action; copy-paste into the multisig UI.
///
/// @dev Run with: `forge script script/PhaseB3-AdminWiring.s.sol \
///                  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL --sig "encode()"`
///      to print the schedule calldata. Then submit those calls via the
///      Gnosis Safe UI (or whichever multisig is wired as praetor).
contract PhaseB3AdminWiring is Script {
    // === Deployed addresses (deployments/arbitrum_sepolia.json) ===
    address constant PORTICO_REGISTRY     = 0x9A9aF6e50491Cd4694699d48564bBFF18f9B40BC;
    address constant AQUEDUCT             = 0x6139449BF43F44385D08640B2E6FD2B82cb87EC2;
    address constant AQUEDUCT_RECEIVER    = 0x9a66c9Cb43DcFaFa696cEC66b33beC74c94DDc70;
    address constant AQUEDUCT_CLAIMBACK   = 0x4d441FCA986d51D17C71f979814E2A492A429382;

    // === Adapter registry (venue_id ↔ address) ===
    // Venue IDs match `ATRIUM_PRD.md §17`, see PorticoRegistry.adapters_by_venue.
    address constant ADAPTER_HYPERLIQUID  = 0x87014fbaCe9AdE49BF923bcFAE74b4C858CF371E;
    address constant ADAPTER_AAVE         = 0xE991eC988a62bcc38740f8B8C549E5400dED8D5D;
    address constant ADAPTER_PENDLE       = 0x54a1Bc2c5c73cC531035B0f008c8A252A02Daf7d;
    address constant ADAPTER_CURVE        = 0xf3Da25F3fF8bDDDc093e34C2f2B117CDb7505682;
    address constant ADAPTER_TRADE_XYZ    = 0xf34C38D9e61a1b1BEAfFfbb681b07e489C36a1ce;
    address constant ADAPTER_POLYMARKET   = 0x98A688723c47ab6909bE04fD0AA3eCA5EE8B08Db;
    address constant ADAPTER_GMX          = 0x2531af9f7596D74F412bFab7D3b84EE7a32cD2d4;
    address constant ADAPTER_SYNTHETIX    = 0x62B3b34ffA76FB62245702C0b7EfD37832eB39b8;
    address constant ADAPTER_MORPHO       = 0xfaBE2B0D1C66bC2976Ed3B0c58F3CDcB7878344e;

    // CCIP chain selectors (Chainlink docs).
    uint64 constant ETH_SEPOLIA_SELECTOR    = 16015286601757825753;
    uint64 constant POLYGON_AMOY_SELECTOR   = 16281711391670634445;

    /// Print every schedule/execute call as ABI-encoded calldata. The
    /// multisig operator paste-runs each into the Gnosis Safe transaction
    /// builder. Two passes are needed per action (schedule, then execute
    /// after 48 h), calldata is the same shape.
    function encode() external view {
        // -- Portico whitelisting -----------------------------------------
        // registerAdapter(uint8 venue, address adapter, bytes32 codehash, uint256 major)
        // expected_major_version defaults to 1 (matches IPorticoAdapter.version()
        // return tuple for all 9 deployed adapters).
        _printRegister(1, ADAPTER_HYPERLIQUID, "Hyperliquid HIP-3");
        _printRegister(2, ADAPTER_AAVE,        "Aave Horizon");
        _printRegister(3, ADAPTER_PENDLE,      "Pendle V2");
        _printRegister(4, ADAPTER_CURVE,       "Curve");
        _printRegister(5, ADAPTER_TRADE_XYZ,   "Trade.xyz");
        _printRegister(6, ADAPTER_POLYMARKET,  "Polymarket");
        _printRegister(7, ADAPTER_HYPERLIQUID, "Hyperliquid HIP-4 (shares adapter)");
        _printRegister(8, ADAPTER_GMX,         "GMX V2");
        _printRegister(9, ADAPTER_SYNTHETIX,   "Synthetix V3");
        _printRegister(10, ADAPTER_MORPHO,     "Morpho Blue");

        // -- Aqueduct cross-chain wiring ----------------------------------
        // setAqueductOnDest(uint64, address), for now, point both
        // testnet destinations at the same address (deploy the receiver
        // pair on each destination chain in a follow-up).
        console.log("");
        console.log("--- Aqueduct setAqueductOnDest ---");
        bytes memory dest1 = abi.encodeWithSignature(
            "setAqueductOnDest(uint64,address)",
            ETH_SEPOLIA_SELECTOR,
            AQUEDUCT_RECEIVER
        );
        console.log("target:", AQUEDUCT);
        console.logBytes(dest1);

        // -- AqueductReceiver allowed-source --------------------------------
        console.log("");
        console.log("--- AqueductReceiver setAllowedSource ---");
        bytes memory src1 = abi.encodeWithSignature(
            "setAllowedSource(uint64,address)",
            ETH_SEPOLIA_SELECTOR,  // Source = the destination side calling back
            AQUEDUCT
        );
        console.log("target:", AQUEDUCT_RECEIVER);
        console.logBytes(src1);

        // -- Aqueduct claimback wiring --------------------------------------
        console.log("");
        console.log("--- Aqueduct setClaimbackRegistry ---");
        bytes memory cb = abi.encodeWithSignature(
            "setClaimbackRegistry(address)",
            AQUEDUCT_CLAIMBACK
        );
        console.log("target:", AQUEDUCT);
        console.logBytes(cb);

        console.log("");
        console.log("=== INSTRUCTIONS ===");
        console.log("1. Take each (target, calldata) pair above.");
        console.log("2. In the multisig wallet (Gnosis Safe UI), call");
        console.log("   PraetorTimelock.schedule(target, 0, calldata, 0, 0, MIN_DELAY)");
        console.log("3. Wait 48h (PraetorTimelock MIN_DELAY).");
        console.log("4. Call PraetorTimelock.execute(target, 0, calldata, 0, 0)");
        console.log("5. Confirm via PorticoRegistry.adapters_by_venue(N).is_active = true");
    }

    function _printRegister(uint8 venueId, address adapter, string memory name) internal view {
        bytes32 codehash;
        // Pull live bytecode hash. PorticoRegistry verifies the adapter's
        // .codehash against this when registerAdapter runs.
        assembly {
            codehash := extcodehash(adapter)
        }
        bytes memory data = abi.encodeWithSignature(
            "registerAdapter(uint8,address,bytes32,uint256)",
            venueId,
            adapter,
            codehash,
            uint256(1)            // major version = 1 (first deployment)
        );
        console.log("");
        console.log("--- PorticoRegistry.registerAdapter ---");
        console.log("venue %s (%s):", venueId, name);
        console.log("target:", PORTICO_REGISTRY);
        console.log("adapter:", adapter);
        console.logBytes(data);
    }
}
