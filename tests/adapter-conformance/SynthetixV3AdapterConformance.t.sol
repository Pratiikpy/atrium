// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IPorticoAdapterConformance.t.sol";
import {SynthetixV3Adapter} from "../../contracts/adapters/synthetix/src/SynthetixV3Adapter.sol";

contract MockSynthetixPerpsConformance {
    function commitOrder(uint128, int128, uint256, uint256, address) external pure returns (bytes32) {
        return keccak256("order");
    }
    function settleOrder(uint128) external pure returns (int256) { return 0; }
    function getOpenPosition(uint128, uint128) external pure returns (int256, int256, int256) { return (0, 0, 0); }
}

contract SynthetixV3AdapterConformanceTest is IPorticoAdapterConformance {
    function setUp() public {
        address praetor = makeAddr("praetor");
        address tl = makeAddr("timelock");
        MockSynthetixPerpsConformance perps = new MockSynthetixPerpsConformance();

        SynthetixV3Adapter a = new SynthetixV3Adapter(
            address(perps), makeAddr("susd"), makeAddr("coffer"), praetor, tl, 1
        );

        bytes32 instrument = keccak256("SNX-ETH-PERP");
        vm.prank(tl);
        a.addInstrument(instrument, 100, 100, 1000, 500);

        vm.prank(tl);
        a.setAuthorizedCaller(makeAddr("router"), true);

        setUp_conformance(
            IPorticoAdapter(address(a)),
            makeAddr("router"),
            tl,
            instrument,
            abi.encode(makeAddr("originator"))
        );
    }
}
