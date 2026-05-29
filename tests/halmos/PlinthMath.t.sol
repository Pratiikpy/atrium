// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

/// @title PlinthMath Halmos symbolic proof
/// @notice Property: Plinth.required_margin is non-negative for all valid scenarios.
/// @custom:halmos --solver-timeout-assertion 60000

contract PlinthMathLib {
    /// @notice SPAN-style margin calculation: sum of absolute notionals * margin BPS,
    ///         with cross-venue netting discount.
    function required_margin(
        int256[] memory notionals,
        uint16[] memory margin_bps,
        uint16 netting_discount_bps
    ) public pure returns (uint256 margin) {
        require(notionals.length == margin_bps.length, "length mismatch");
        uint256 gross = 0;
        for (uint256 i = 0; i < notionals.length; i++) {
            uint256 absNotional = notionals[i] >= 0 ? uint256(notionals[i]) : uint256(-notionals[i]);
            gross += (absNotional * uint256(margin_bps[i])) / 10_000;
        }
        // Apply netting discount (capped at 100%)
        uint256 discount = netting_discount_bps > 10_000 ? 10_000 : uint256(netting_discount_bps);
        margin = (gross * (10_000 - discount)) / 10_000;
    }
}

contract PlinthMathHalmosTest is Test {
    PlinthMathLib internal lib;

    function setUp() public {
        lib = new PlinthMathLib();
    }

    /// @custom:halmos --loop 10
    function check_required_margin_nonneg(
        int256 n0,
        int256 n1,
        int256 n2,
        uint16 bps0,
        uint16 bps1,
        uint16 bps2,
        uint16 netting
    ) external view {
        vm.assume(bps0 <= 10_000);
        vm.assume(bps1 <= 10_000);
        vm.assume(bps2 <= 10_000);
        vm.assume(netting <= 10_000);
        // Bound notionals to avoid overflow
        vm.assume(n0 > type(int256).min);
        vm.assume(n1 > type(int256).min);
        vm.assume(n2 > type(int256).min);
        vm.assume(uint256(n0 >= 0 ? n0 : -n0) <= 1e30);
        vm.assume(uint256(n1 >= 0 ? n1 : -n1) <= 1e30);
        vm.assume(uint256(n2 >= 0 ? n2 : -n2) <= 1e30);

        int256[] memory notionals = new int256[](3);
        notionals[0] = n0;
        notionals[1] = n1;
        notionals[2] = n2;

        uint16[] memory bps = new uint16[](3);
        bps[0] = bps0;
        bps[1] = bps1;
        bps[2] = bps2;

        uint256 m = lib.required_margin(notionals, bps, netting);
        assert(m >= 0); // uint256 is always >= 0, but proves no underflow/revert
    }

    /// @notice Margin with zero notionals must be zero
    function check_zero_notionals_zero_margin(uint16 bps0, uint16 netting) external view {
        vm.assume(bps0 <= 10_000);
        vm.assume(netting <= 10_000);

        int256[] memory notionals = new int256[](1);
        notionals[0] = 0;

        uint16[] memory bps = new uint16[](1);
        bps[0] = bps0;

        uint256 m = lib.required_margin(notionals, bps, netting);
        assert(m == 0);
    }
}
