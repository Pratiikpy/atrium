// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

/// @title CofferRoundTrip Halmos symbolic proof
/// @notice Property: convertToShares(convertToAssets(shares)) <= shares (round-down).
/// @custom:halmos --solver-timeout-assertion 60000

contract CofferMath {
    uint256 public totalAssets;
    uint256 public totalSupply;

    function setVaultState(uint256 _totalAssets, uint256 _totalSupply) external {
        totalAssets = _totalAssets;
        totalSupply = _totalSupply;
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        if (totalSupply == 0) return shares;
        return (shares * totalAssets) / totalSupply;
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        if (totalSupply == 0) return assets;
        return (assets * totalSupply) / totalAssets;
    }
}

contract CofferRoundTripHalmosTest is Test {
    CofferMath internal coffer;

    function setUp() public {
        coffer = new CofferMath();
    }

    /// @notice convertToShares(convertToAssets(shares)) <= shares
    function check_roundTrip_shares_roundDown(
        uint256 shares,
        uint256 _totalAssets,
        uint256 _totalSupply
    ) external {
        // Preconditions: non-zero vault state, bounded to avoid overflow
        vm.assume(_totalAssets > 0);
        vm.assume(_totalSupply > 0);
        vm.assume(_totalAssets <= 1e30);
        vm.assume(_totalSupply <= 1e30);
        vm.assume(shares <= _totalSupply);
        vm.assume(shares > 0);

        coffer.setVaultState(_totalAssets, _totalSupply);

        uint256 assets = coffer.convertToAssets(shares);
        uint256 sharesBack = coffer.convertToShares(assets);

        assert(sharesBack <= shares);
    }

    /// @notice convertToAssets(convertToShares(assets)) <= assets
    function check_roundTrip_assets_roundDown(
        uint256 assets,
        uint256 _totalAssets,
        uint256 _totalSupply
    ) external {
        vm.assume(_totalAssets > 0);
        vm.assume(_totalSupply > 0);
        vm.assume(_totalAssets <= 1e30);
        vm.assume(_totalSupply <= 1e30);
        vm.assume(assets <= _totalAssets);
        vm.assume(assets > 0);

        coffer.setVaultState(_totalAssets, _totalSupply);

        uint256 shares = coffer.convertToShares(assets);
        uint256 assetsBack = coffer.convertToAssets(shares);

        assert(assetsBack <= assets);
    }
}
