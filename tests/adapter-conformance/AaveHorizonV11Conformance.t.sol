// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IPorticoAdapterConformance.t.sol";
import {AaveHorizonAdapterV11} from "../../contracts/adapters/aave-horizon/src/AaveHorizonAdapterV11.sol";

contract MockAavePoolConformance {
    function supply(address, uint256, address, uint16) external {}
    function withdraw(address, uint256, address) external returns (uint256) { return 0; }
    function borrow(address, uint256, uint256, uint16, address) external {}
    function repay(address, uint256, uint256, address) external returns (uint256) { return 0; }
    function getReserveData(address) external pure returns (
        uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16,
        address, address, address, address, uint128, uint128, uint128
    ) { return (0,0,0,0,0,0,0,0,address(0),address(0),address(0),address(0),0,0,0); }
}

contract AaveHorizonV11ConformanceTest is IPorticoAdapterConformance {
    function setUp() public {
        address praetor = makeAddr("praetor");
        address tl = makeAddr("timelock");
        MockAavePoolConformance pool = new MockAavePoolConformance();

        AaveHorizonAdapterV11 a = new AaveHorizonAdapterV11(
            address(pool), makeAddr("usdc"), makeAddr("coffer"), praetor, tl
        );

        bytes32 instrument = keccak256("AAVE-USDC-SUPPLY");
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
