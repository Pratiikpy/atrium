// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

/// @title  Phase ϑ.followup — execute the Coffer.setAdapter timelock job.
/// @notice Pair of SetCofferAdapterSchedule.s.sol. Must run AT LEAST 48h
///         after the schedule tx confirms — PraetorTimelock will revert
///         `TimelockNotReady` before the window passes.
///
///         The encoded inner-call MUST match the schedule tx byte-for-
///         byte (PraetorTimelock validates the digest). Anything mutated
///         here vs the schedule script means a different jobId and the
///         execute reverts `TimelockJobNotFound`.
///
///         Verification after execute:
///           cast call <coffer> "isAdapterApproved(address)(bool)" <router>
///         must return `true`.
contract SetCofferAdapterExecute is Script {
    address constant PRAETOR_TIMELOCK = 0x0dAd24d7feb2bB797e0f69e02c2F32104FCF22d4;
    address constant COFFER           = 0xD169554cAF920f1fbcFfBAFCff3068a84892b0D8;
    address constant ATRIUM_ROUTER    = 0xF134127Cc2762d3Ebc5645abA6c99cD5a8b82717;

    uint256 constant PER_BLOCK_CAP_USDC_WEI = 10_000 * 10**6;

    bytes4 constant SET_ADAPTER_SELECTOR = bytes4(keccak256("setAdapter(address,bool,uint256)"));

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        bytes memory innerData = _innerCalldata();

        vm.startBroadcast(pk);
        (bool ok, ) = PRAETOR_TIMELOCK.call(
            abi.encodeWithSignature("execute(address,bytes)", COFFER, innerData)
        );
        require(ok, "PraetorTimelock.execute failed");
        vm.stopBroadcast();

        console.log("Executed Coffer.setAdapter via PraetorTimelock");
        console.log("Verify with:");
        console.log("  cast call", COFFER, "isAdapterApproved(address)(bool)", ATRIUM_ROUTER);
    }

    function encode() external view {
        bytes memory innerData = _innerCalldata();
        bytes memory outerData = abi.encodeWithSignature(
            "execute(address,bytes)", COFFER, innerData
        );
        console.log("OUTER (paste into Gnosis Safe - 48h AFTER schedule):");
        console.log("  target:  ", PRAETOR_TIMELOCK);
        console.log("  calldata:");
        console.logBytes(outerData);
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
