// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

/// @title  Phase ϑ.followup, wire AtriumRouter onto every adapter's
///         authorised-caller allowlist.
/// @notice Closes audit task #335. Each v1.1 adapter has an
///         `is_authorized_caller[router]` flag default-false. With it
///         false the adapter rejects every `open_position` /
///         `close_position` from the Router with `Unauthorized()`. The
///         Router needs to be flipped on once per adapter.
///
///         `setAuthorizedCaller(address, bool)` is `onlyTimelock`, must be
///         called via PraetorTimelock (48h veto window). Phase 2b changed
///         all 9 adapters from onlyPraetor to onlyTimelock per MASTER_PLAN §6.2.
///
///         IMPORTANT: This script is DEPRECATED for production use. Use
///         `services/praetor-cli/src/commands/setup-stylus-adapters.ts`
///         which routes through timelock-schedule → timelock-execute.
///
///         For testnet bootstrapping only (deployer == timelock admin),
///         the script can still be run with the deployer key if the
///         PraetorTimelock.execute() path is used, or if the deployer
///         is temporarily set as the timelock executor.
///
///         Verification: `cast call <adapter> "is_authorized_caller(address)(bool)" <router>`
///         returns `true` for all 8.
contract SetAuthorizedCallerOnAdapters is Script {
    // Address of the AtriumRouter, destination caller we are whitelisting.
    // From deployments/arbitrum_sepolia.json.
    address constant ATRIUM_ROUTER = 0xF134127Cc2762d3Ebc5645abA6c99cD5a8b82717;

    // Eight v1.1 adapters from deployments/arbitrum_sepolia.json. The
    // Aave adapter listed here is the V11 redeploy from Phase ζ.3, the
    // legacy 0xE991 entry is v1.0 and intentionally NOT in this list
    // (task #336, also closed).
    //
    // TODO(founder): the Aave V11 address in deployments/ needs to be
    // updated to the new redeploy address when Phase ζ.3 lands.
    address constant ADAPTER_HYPERLIQUID  = 0x87014fbaCe9AdE49BF923bcFAE74b4C858CF371E;
    address constant ADAPTER_AAVE_V11     = 0xE991eC988a62bcc38740f8B8C549E5400dED8D5D; // ζ.3 redeploy pending
    address constant ADAPTER_PENDLE       = 0x54a1Bc2c5c73cC531035B0f008c8A252A02Daf7d;
    address constant ADAPTER_CURVE        = 0xf3Da25F3fF8bDDDc093e34C2f2B117CDb7505682;
    address constant ADAPTER_TRADE_XYZ    = 0xf34C38D9e61a1b1BEAfFfbb681b07e489C36a1ce;
    address constant ADAPTER_POLYMARKET   = 0x98A688723c47ab6909bE04fD0AA3eCA5EE8B08Db;
    address constant ADAPTER_GMX          = 0x2531af9f7596D74F412bFab7D3b84EE7a32cD2d4;
    // Synthetix + Morpho are scaffold-locked (revert ScaffoldNotImplemented
    // on open_position), adding them as authorized callers is harmless
    // but pointless until Year-2. Included for symmetry so a future
    // unlock just requires flipping the scaffold lock, not a new script.
    address constant ADAPTER_SYNTHETIX    = 0x62B3b34ffA76FB62245702C0b7EfD37832eB39b8;
    address constant ADAPTER_MORPHO       = 0xfaBE2B0D1C66bC2976Ed3B0c58F3CDcB7878344e;

    /// Mode 1, broadcast directly with the praetor key. Year-1 1-of-1.
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        _set(ADAPTER_HYPERLIQUID, "Hyperliquid");
        _set(ADAPTER_AAVE_V11,    "AaveHorizonV11");
        _set(ADAPTER_PENDLE,      "PendleV2");
        _set(ADAPTER_CURVE,       "Curve");
        _set(ADAPTER_TRADE_XYZ,   "Trade.xyz");
        _set(ADAPTER_POLYMARKET,  "Polymarket");
        _set(ADAPTER_GMX,         "GMX V2");
        _set(ADAPTER_SYNTHETIX,   "Synthetix (scaffold-locked)");
        _set(ADAPTER_MORPHO,      "Morpho (scaffold-locked)");
        vm.stopBroadcast();
    }

    /// Mode 2, print (target, calldata) for paste into Gnosis Safe UI.
    /// Run with: `forge script ... --sig "encode()"`
    function encode() external view {
        bytes memory data = abi.encodeWithSignature(
            "setAuthorizedCaller(address,bool)",
            ATRIUM_ROUTER,
            true
        );
        console.log("Paste each (target, calldata) pair into Gnosis Safe transaction-builder.");
        console.log("All 9 calls use the SAME calldata; only target changes.");
        console.log("");
        console.log("calldata (same for all):");
        console.logBytes(data);
        console.log("");
        _printTarget(ADAPTER_HYPERLIQUID, "Hyperliquid");
        _printTarget(ADAPTER_AAVE_V11,    "AaveHorizonV11");
        _printTarget(ADAPTER_PENDLE,      "PendleV2");
        _printTarget(ADAPTER_CURVE,       "Curve");
        _printTarget(ADAPTER_TRADE_XYZ,   "Trade.xyz");
        _printTarget(ADAPTER_POLYMARKET,  "Polymarket");
        _printTarget(ADAPTER_GMX,         "GMX V2");
        _printTarget(ADAPTER_SYNTHETIX,   "Synthetix");
        _printTarget(ADAPTER_MORPHO,      "Morpho");
    }

    function _set(address adapter, string memory name) internal {
        (bool ok, ) = adapter.call(
            abi.encodeWithSignature("setAuthorizedCaller(address,bool)", ATRIUM_ROUTER, true)
        );
        require(ok, string.concat("setAuthorizedCaller failed on ", name));
        console.log("OK", name, adapter);
    }

    function _printTarget(address adapter, string memory name) internal pure {
        console.log("target:", adapter, name);
    }
}
