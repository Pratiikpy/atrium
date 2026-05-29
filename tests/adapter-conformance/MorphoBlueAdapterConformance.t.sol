// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IPorticoAdapterConformance.t.sol";
import {MorphoBlueAdapter, IMorpho} from "../../contracts/adapters/morpho/src/MorphoBlueAdapter.sol";

contract MockMorphoConformance {
    function supplyCollateral(IMorpho.MarketParams memory, uint256, address, bytes calldata) external {}
    function borrow(IMorpho.MarketParams memory, uint256, uint256, address, address) external pure returns (uint256, uint256) {
        return (1e6, 0);
    }
    function repay(IMorpho.MarketParams memory, uint256, uint256, address, bytes calldata) external pure returns (uint256, uint256) {
        return (1e6, 0);
    }
}

contract MorphoBlueAdapterConformanceTest is IPorticoAdapterConformance {
    function setUp() public {
        address praetor = makeAddr("praetor");
        address tl = makeAddr("timelock");
        MockMorphoConformance morpho = new MockMorphoConformance();

        MorphoBlueAdapter a = new MorphoBlueAdapter(
            address(morpho), makeAddr("coffer"), praetor, tl
        );

        bytes32 instrument = keccak256("MORPHO-USDC-WETH");

        IMorpho.MarketParams memory mp = IMorpho.MarketParams({
            loanToken: makeAddr("loan"),
            collateralToken: makeAddr("collateral"),
            oracle: makeAddr("oracle"),
            irm: makeAddr("irm"),
            lltv: 8500
        });

        vm.prank(tl);
        a.addInstrument(instrument, mp, 150, 1200, 600);

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
