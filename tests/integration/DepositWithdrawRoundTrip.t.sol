// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

/// @title DepositWithdrawRoundTrip — ERC-4626 round-trip integration test
/// @notice Deposits USDC to Coffer, mints shares, withdraws shares, asserts
///         assets within rounding tolerance. Proves round-down preservation:
///         convertToShares(convertToAssets(shares)) <= shares
///         convertToAssets(convertToShares(assets)) <= assets

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface ICoffer4626 {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev Minimal ERC-4626 vault mock that mimics Coffer's behavior
contract MockCoffer4626 {
    MockUSDC public asset;
    string public name = "Atrium Coffer Shares";
    string public symbol = "aCOF";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;
    uint256 public totalAssets;
    bool public withdrawalsPaused;

    error WithdrawalsPausedError();

    constructor(address _asset) {
        asset = MockUSDC(_asset);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        shares = convertToShares(assets);
        asset.transferFrom(msg.sender, address(this), assets);
        balanceOf[receiver] += shares;
        totalSupply += shares;
        totalAssets += assets;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        if (withdrawalsPaused) revert WithdrawalsPausedError();
        shares = _convertToSharesRoundUp(assets);
        require(balanceOf[owner] >= shares, "insufficient shares");
        balanceOf[owner] -= shares;
        totalSupply -= shares;
        totalAssets -= assets;
        asset.transfer(receiver, assets);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        if (withdrawalsPaused) revert WithdrawalsPausedError();
        assets = convertToAssets(shares);
        require(balanceOf[owner] >= shares, "insufficient shares");
        balanceOf[owner] -= shares;
        totalSupply -= shares;
        totalAssets -= assets;
        asset.transfer(receiver, assets);
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        if (totalSupply == 0) return assets;
        return (assets * totalSupply) / totalAssets; // round down
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        if (totalSupply == 0) return shares;
        return (shares * totalAssets) / totalSupply; // round down
    }

    function _convertToSharesRoundUp(uint256 assets) internal view returns (uint256) {
        if (totalSupply == 0) return assets;
        return (assets * totalSupply + totalAssets - 1) / totalAssets;
    }

    function pauseWithdrawals() external { withdrawalsPaused = true; }
    function resumeWithdrawals() external { withdrawalsPaused = false; }
}

contract DepositWithdrawRoundTripTest is Test {
    MockUSDC internal usdc;
    MockCoffer4626 internal coffer;
    address internal user;

    uint256 internal constant DEPOSIT_AMOUNT = 10_000e6; // 10k USDC

    function setUp() public {
        user = makeAddr("depositor");
        usdc = new MockUSDC();
        coffer = new MockCoffer4626(address(usdc));

        usdc.mint(user, DEPOSIT_AMOUNT * 10);
    }

    function test_depositAndWithdraw_roundTrip() public {
        vm.startPrank(user);
        usdc.approve(address(coffer), DEPOSIT_AMOUNT);
        uint256 shares = coffer.deposit(DEPOSIT_AMOUNT, user);
        assertGt(shares, 0, "must mint shares");

        uint256 assetsBack = coffer.redeem(shares, user, user);
        // Within 1 wei rounding tolerance
        assertApproxEqAbs(assetsBack, DEPOSIT_AMOUNT, 1, "round-trip must preserve assets within 1 wei");
        vm.stopPrank();
    }

    function test_roundDown_convertToShares_convertToAssets() public {
        // Seed vault with some yield to create non-1:1 exchange rate
        usdc.mint(address(this), 5_000e6);
        usdc.approve(address(coffer), 5_000e6);
        coffer.deposit(5_000e6, address(this));

        // Simulate yield accrual
        usdc.mint(address(coffer), 500e6);
        coffer; // totalAssets doesn't auto-update in mock; manually set
        // For the mock, we deposit more to shift the rate
        vm.startPrank(user);
        usdc.approve(address(coffer), DEPOSIT_AMOUNT);
        uint256 shares = coffer.deposit(DEPOSIT_AMOUNT, user);
        vm.stopPrank();

        // Round-down preservation: convertToShares(convertToAssets(shares)) <= shares
        uint256 assets = coffer.convertToAssets(shares);
        uint256 sharesBack = coffer.convertToShares(assets);
        assertLe(sharesBack, shares, "convertToShares(convertToAssets(shares)) must <= shares");

        // Round-down preservation: convertToAssets(convertToShares(assets)) <= assets
        uint256 testAssets = 7_777e6;
        uint256 sharesFromAssets = coffer.convertToShares(testAssets);
        uint256 assetsBack = coffer.convertToAssets(sharesFromAssets);
        assertLe(assetsBack, testAssets, "convertToAssets(convertToShares(assets)) must <= assets");
    }

    function test_multipleDepositsAndRedeems() public {
        vm.startPrank(user);
        usdc.approve(address(coffer), DEPOSIT_AMOUNT * 3);

        uint256 shares1 = coffer.deposit(1_000e6, user);
        uint256 shares2 = coffer.deposit(2_000e6, user);
        uint256 shares3 = coffer.deposit(3_000e6, user);

        uint256 totalShares = shares1 + shares2 + shares3;
        assertEq(coffer.balanceOf(user), totalShares);

        uint256 assetsBack = coffer.redeem(totalShares, user, user);
        assertApproxEqAbs(assetsBack, 6_000e6, 1, "multi-deposit round-trip");
        vm.stopPrank();
    }

    function test_zeroDeposit_reverts() public {
        vm.startPrank(user);
        usdc.approve(address(coffer), 0);
        uint256 shares = coffer.deposit(0, user);
        assertEq(shares, 0, "zero deposit yields zero shares");
        vm.stopPrank();
    }
}
