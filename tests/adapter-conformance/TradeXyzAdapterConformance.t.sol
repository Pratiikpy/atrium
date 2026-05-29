// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IPorticoAdapterConformance.t.sol";
import {TradeXyzAdapter} from "../../contracts/adapters/trade-xyz/src/TradeXyzAdapter.sol";

contract MockClearinghouseConformance {
    function openPosition(address, uint256, bool) external pure returns (bytes32) { return keccak256("pos"); }
    function closePosition(bytes32) external pure returns (int256) { return 0; }
    function getPosition(bytes32) external pure returns (address, uint256, int256, bool) {
        return (address(0), 0, 0, true);
    }
    function isOperational() external pure returns (bool) { return true; }
    function quotedSpreadBps(bytes32) external pure returns (uint16) { return 5; }
}

contract TradeXyzAdapterConformanceTest is IPorticoAdapterConformance {
    function setUp() public {
        address praetor = makeAddr("praetor");
        address tl = makeAddr("timelock");
        MockClearinghouseConformance ch = new MockClearinghouseConformance();

        TradeXyzAdapter a = new TradeXyzAdapter(
            address(ch), makeAddr("usdc"), makeAddr("coffer"), praetor, tl
        );

        bytes32 instrument = keccak256("TRADE-BTC-PERP");
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
