// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IPorticoAdapterConformance.t.sol";
import {HyperliquidHybridAdapter} from "../../contracts/adapters/hyperliquid/src/HyperliquidHybridAdapter.sol";

contract MockHyperliquidBridgeConformance {
    function deposit(address, uint256) external {}
    function withdraw(address, uint256) external {}
}

contract HyperliquidHybridAdapterConformanceTest is IPorticoAdapterConformance {
    function setUp() public {
        address praetor = makeAddr("praetor");
        address tl = makeAddr("timelock");
        MockHyperliquidBridgeConformance bridge = new MockHyperliquidBridgeConformance();

        HyperliquidHybridAdapter a = new HyperliquidHybridAdapter(
            address(bridge), makeAddr("usdc"), makeAddr("coffer"), praetor, tl, 1
        );

        bytes32 instrument = keccak256("HYPE-ETH-PERP");
        vm.prank(tl);
        a.addInstrument(instrument, 100, 1000, 500);

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
