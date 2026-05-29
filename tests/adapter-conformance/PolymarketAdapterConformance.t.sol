// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IPorticoAdapterConformance.t.sol";
import {PolymarketAdapter} from "../../contracts/adapters/polymarket/src/PolymarketAdapter.sol";

contract MockAqueductConformance {
    function send(uint64, address, uint256, bytes calldata) external pure returns (bytes32) {
        return keccak256("msg");
    }
}

contract PolymarketAdapterConformanceTest is IPorticoAdapterConformance {
    function setUp() public {
        address praetor = makeAddr("praetor");
        address tl = makeAddr("timelock");
        MockAqueductConformance aqueduct = new MockAqueductConformance();

        PolymarketAdapter a = new PolymarketAdapter(
            address(aqueduct), makeAddr("usdc"), makeAddr("coffer"), praetor, tl, 16015286601757825753
        );

        bytes32 instrument = keccak256("POLY-ELECTION-2024");
        vm.prank(tl);
        a.addInstrument(instrument, 500, 2000, 1000);

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
