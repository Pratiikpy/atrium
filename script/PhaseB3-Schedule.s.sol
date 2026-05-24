// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

interface IPraetorTimelock {
    function schedule(address target, bytes calldata data) external returns (bytes32);
}

/// Calls PraetorTimelock.schedule(...) for every Phase B.3 admin action.
/// Each scheduled id becomes executable 48 h after the schedule tx confirms.
/// Run once now; run PhaseB3-Execute.s.sol after the 48 h window.
contract ScheduleAll is Script {
    address constant PRAETOR_TIMELOCK     = 0x0dAd24d7feb2bB797e0f69e02c2F32104FCF22d4;
    address constant PORTICO_REGISTRY     = 0x9A9aF6e50491Cd4694699d48564bBFF18f9B40BC;
    address constant AQUEDUCT             = 0x6139449BF43F44385D08640B2E6FD2B82cb87EC2;
    address constant AQUEDUCT_RECEIVER    = 0x9a66c9Cb43DcFaFa696cEC66b33beC74c94DDc70;
    address constant AQUEDUCT_CLAIMBACK   = 0x4d441FCA986d51D17C71f979814E2A492A429382;

    // Adapter addresses
    address constant ADAPTER_HYPERLIQUID  = 0x87014fbaCe9AdE49BF923bcFAE74b4C858CF371E;
    address constant ADAPTER_AAVE         = 0xE991eC988a62bcc38740f8B8C549E5400dED8D5D;
    address constant ADAPTER_PENDLE       = 0x54a1Bc2c5c73cC531035B0f008c8A252A02Daf7d;
    address constant ADAPTER_CURVE        = 0xf3Da25F3fF8bDDDc093e34C2f2B117CDb7505682;
    address constant ADAPTER_TRADE_XYZ    = 0xf34C38D9e61a1b1BEAfFfbb681b07e489C36a1ce;
    address constant ADAPTER_POLYMARKET   = 0x98A688723c47ab6909bE04fD0AA3eCA5EE8B08Db;
    address constant ADAPTER_GMX          = 0x2531af9f7596D74F412bFab7D3b84EE7a32cD2d4;
    address constant ADAPTER_SYNTHETIX    = 0x62B3b34ffA76FB62245702C0b7EfD37832eB39b8;
    address constant ADAPTER_MORPHO       = 0xfaBE2B0D1C66bC2976Ed3B0c58F3CDcB7878344e;

    uint64 constant ETH_SEPOLIA_SELECTOR  = 16015286601757825753;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        IPraetorTimelock timelock = IPraetorTimelock(PRAETOR_TIMELOCK);

        vm.startBroadcast(pk);

        _scheduleRegister(timelock, 1, ADAPTER_HYPERLIQUID, "HL HIP-3");
        _scheduleRegister(timelock, 2, ADAPTER_AAVE,        "Aave Horizon");
        _scheduleRegister(timelock, 3, ADAPTER_PENDLE,      "Pendle V2");
        _scheduleRegister(timelock, 4, ADAPTER_CURVE,       "Curve");
        _scheduleRegister(timelock, 5, ADAPTER_TRADE_XYZ,   "Trade.xyz");
        _scheduleRegister(timelock, 6, ADAPTER_POLYMARKET,  "Polymarket");
        _scheduleRegister(timelock, 7, ADAPTER_HYPERLIQUID, "HL HIP-4");
        _scheduleRegister(timelock, 8, ADAPTER_GMX,         "GMX V2");
        _scheduleRegister(timelock, 9, ADAPTER_SYNTHETIX,   "Synthetix V3");
        _scheduleRegister(timelock, 10, ADAPTER_MORPHO,     "Morpho Blue");

        // Aqueduct destination wiring
        bytes memory destData = abi.encodeWithSignature(
            "setAqueductOnDest(uint64,address)",
            ETH_SEPOLIA_SELECTOR, AQUEDUCT_RECEIVER
        );
        bytes32 id = timelock.schedule(AQUEDUCT, destData);
        console.log("Aqueduct.setAqueductOnDest scheduled:");
        console.logBytes32(id);

        // Receiver source allowlist
        bytes memory srcData = abi.encodeWithSignature(
            "setAllowedSource(uint64,address)",
            ETH_SEPOLIA_SELECTOR, AQUEDUCT
        );
        id = timelock.schedule(AQUEDUCT_RECEIVER, srcData);
        console.log("AqueductReceiver.setAllowedSource scheduled:");
        console.logBytes32(id);

        // Aqueduct claimback registry
        bytes memory cbData = abi.encodeWithSignature(
            "setClaimbackRegistry(address)",
            AQUEDUCT_CLAIMBACK
        );
        id = timelock.schedule(AQUEDUCT, cbData);
        console.log("Aqueduct.setClaimbackRegistry scheduled:");
        console.logBytes32(id);

        vm.stopBroadcast();

        console.log("");
        console.log("=== 13 actions scheduled. Execute after:");
        console.log("    schedule_timestamp + 48 hours");
        console.log("=== Run PhaseB3-Execute.s.sol on/after that window.");
    }

    function _scheduleRegister(
        IPraetorTimelock timelock,
        uint8 venueId,
        address adapter,
        string memory name
    ) internal {
        bytes32 codehash;
        assembly { codehash := extcodehash(adapter) }
        bytes memory data = abi.encodeWithSignature(
            "registerAdapter(uint8,address,bytes32,uint256)",
            venueId, adapter, codehash, uint256(1)
        );
        bytes32 id = timelock.schedule(PORTICO_REGISTRY, data);
        console.log("registerAdapter scheduled (%s, %s):", venueId, name);
        console.logBytes32(id);
    }
}
