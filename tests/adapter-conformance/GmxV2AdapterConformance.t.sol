// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IPorticoAdapterConformance.t.sol";
import {GmxV2Adapter} from "../../contracts/adapters/gmx/src/GmxV2Adapter.sol";

contract MockGmxRouterConformance {
    function createPosition(address, address, uint256, uint256, bool) external pure returns (bytes32) {
        return keccak256("pos");
    }
    function closePosition(bytes32) external pure returns (int256) { return 0; }
}

contract GmxV2AdapterConformanceTest is IPorticoAdapterConformance {
    function setUp() public {
        address praetor = makeAddr("praetor");
        address tl = makeAddr("timelock");
        address usdc = makeAddr("usdc");
        address coffer = makeAddr("coffer");
        MockGmxRouterConformance gmxRouter = new MockGmxRouterConformance();

        GmxV2Adapter a = new GmxV2Adapter(address(gmxRouter), usdc, coffer, praetor, tl);

        bytes32 instrument = keccak256("ETH-USD-PERP");
        vm.prank(tl);
        a.addInstrument(instrument, address(0), 100, 1000, 500);

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
