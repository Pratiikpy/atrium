// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IPorticoAdapterConformance.t.sol";
import {PendleV2Adapter} from "../../contracts/adapters/pendle/src/PendleV2Adapter.sol";

contract MockPendleRouterConformance {
    function addLiquiditySingleToken(address, address, uint256, uint256) external pure returns (uint256) { return 1e18; }
    function removeLiquiditySingleToken(address, uint256, address, uint256) external pure returns (uint256) { return 1e6; }
}

contract PendleV2AdapterConformanceTest is IPorticoAdapterConformance {
    function setUp() public {
        address praetor = makeAddr("praetor");
        address tl = makeAddr("timelock");
        MockPendleRouterConformance pendleRouter = new MockPendleRouterConformance();

        PendleV2Adapter a = new PendleV2Adapter(
            address(pendleRouter), makeAddr("usdc"), makeAddr("coffer"), praetor, tl
        );

        bytes32 instrument = keccak256("PENDLE-STETH-PT");
        vm.prank(tl);
        a.addInstrument(instrument, makeAddr("market"), 200, 1500, 800);

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
