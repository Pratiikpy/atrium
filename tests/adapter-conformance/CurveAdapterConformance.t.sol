// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IPorticoAdapterConformance.t.sol";
import {CurveAdapter} from "../../contracts/adapters/curve/src/CurveAdapter.sol";

contract MockCurvePoolConformance {
    function add_liquidity(uint256[2] calldata, uint256) external pure returns (uint256) { return 1e18; }
    function remove_liquidity_one_coin(uint256, int128, uint256) external pure returns (uint256) { return 1e6; }
    function get_virtual_price() external pure returns (uint256) { return 1e18; }
}

contract CurveAdapterConformanceTest is IPorticoAdapterConformance {
    function setUp() public {
        address praetor = makeAddr("praetor");
        address tl = makeAddr("timelock");
        MockCurvePoolConformance pool = new MockCurvePoolConformance();
        bytes32 instrument = keccak256("CURVE-3POOL-USDC");

        CurveAdapter a = new CurveAdapter(
            address(pool),
            makeAddr("usdc"),
            makeAddr("lpToken"),
            int128(0),
            makeAddr("coffer"),
            praetor,
            tl,
            instrument
        );

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
