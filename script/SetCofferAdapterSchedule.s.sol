// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

/// @title  Phase ϑ.followup — schedule Coffer.setAdapter(AtriumRouter, true).
/// @notice Closes audit task #337. Without this, every Router-driven
///         deposit/withdraw routed through `Coffer.adapterPull(...)`
///         reverts `UnauthorizedCaller` because the Router isn't on the
///         approved-orchestrators list.
///
///         `Coffer.set_adapter` is timelock-gated (`assert_timelock()` —
///         see contracts/coffer/src/lib.rs:633). 48h wait required.
///
///         Stylus 0.10 auto-converts `set_adapter` → camelCase selector
///         `setAdapter` (same class as audit task #333). This script
///         uses the camelCase selector when encoding the inner calldata
///         so PraetorTimelock's eventual `execute()` lands on the right
///         dispatcher entry.
///
///         Run modes mirror SetAuthorizedCallerOnAdapters.s.sol:
///           1. ONE-OF-ONE: `forge script ... --broadcast` posts the
///              timelock schedule tx directly with DEPLOYER_PRIVATE_KEY.
///           2. SAFE BATCH: `forge script ... --sig "encode()"` prints
///              the outer (PraetorTimelock, calldata) pair plus the
///              inner (Coffer, calldata) for the Safe operator's audit.
///
///         After 48h pass, run SetCofferAdapterExecute.s.sol.
///
///         Per-block notional cap = 1% of Year-1 testnet cap
///         (~10_000 USDC = 10_000 * 1e6 wei). Tunable per founder.
contract SetCofferAdapterSchedule is Script {
    address constant PRAETOR_TIMELOCK = 0x0dAd24d7feb2bB797e0f69e02c2F32104FCF22d4;
    address constant COFFER           = 0xD169554cAF920f1fbcFfBAFCff3068a84892b0D8;
    address constant ATRIUM_ROUTER    = 0xF134127Cc2762d3Ebc5645abA6c99cD5a8b82717;

    // Year-1 testnet cap: 10_000 USDC (6 decimals) per block. Tune up
    // post-mainnet flip after stress-testing.
    uint256 constant PER_BLOCK_CAP_USDC_WEI = 10_000 * 10**6;

    /// Selector dispatch: Stylus camelCase, NOT Rust snake_case.
    /// Source of truth: contracts/coffer/src/lib.rs:627 `pub fn set_adapter`
    /// → exported as `setAdapter(address,bool,uint256)` by stylus 0.10.
    bytes4 constant SET_ADAPTER_SELECTOR = bytes4(keccak256("setAdapter(address,bool,uint256)"));

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        bytes memory innerData = _innerCalldata();

        vm.startBroadcast(pk);
        (bool ok, bytes memory ret) = PRAETOR_TIMELOCK.call(
            abi.encodeWithSignature("schedule(address,bytes)", COFFER, innerData)
        );
        require(ok, "PraetorTimelock.schedule failed");
        bytes32 jobId = abi.decode(ret, (bytes32));
        vm.stopBroadcast();

        console.log("Scheduled Coffer.setAdapter(Router, true, cap)");
        console.log("  timelock:", PRAETOR_TIMELOCK);
        console.log("  target:  ", COFFER);
        console.log("  router:  ", ATRIUM_ROUTER);
        console.log("  cap:     ", PER_BLOCK_CAP_USDC_WEI);
        console.logBytes32(jobId);
        console.log("Run SetCofferAdapterExecute.s.sol after 48h.");
    }

    function encode() external view {
        bytes memory innerData = _innerCalldata();
        bytes memory outerData = abi.encodeWithSignature(
            "schedule(address,bytes)", COFFER, innerData
        );
        console.log("=== Phase theta-followup #337 - schedule Coffer.setAdapter ===");
        console.log("");
        console.log("OUTER (paste into Gnosis Safe):");
        console.log("  target:  ", PRAETOR_TIMELOCK);
        console.log("  calldata:");
        console.logBytes(outerData);
        console.log("");
        console.log("INNER (the eventual call PraetorTimelock will execute after 48h):");
        console.log("  target:  ", COFFER);
        console.log("  selector: setAdapter(address,bool,uint256) [Stylus camelCase]");
        console.log("  args:    ", ATRIUM_ROUTER, "true", PER_BLOCK_CAP_USDC_WEI);
        console.log("  calldata:");
        console.logBytes(innerData);
    }

    function _innerCalldata() internal pure returns (bytes memory) {
        return abi.encodeWithSelector(
            SET_ADAPTER_SELECTOR,
            ATRIUM_ROUTER,
            true,
            PER_BLOCK_CAP_USDC_WEI
        );
    }
}
