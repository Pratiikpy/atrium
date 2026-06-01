// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

/// @title AdapterPullPauseRespect, integration test
/// @notice Pause Coffer withdrawals, attempt adapter pull, assert revert
///         WithdrawalsPausedError (Phase 2b/2a coordination). Then resume,
///         assert pull succeeds.

contract MockERC20Pull {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

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

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract MockCofferWithPause {
    MockERC20Pull public usdc;
    bool public withdrawalsPaused;
    mapping(address => bool) public approvedAdapters;
    mapping(address => uint256) public userBalances;
    address public praetor;

    error WithdrawalsPausedError();
    error NotApprovedAdapter();

    constructor(address _usdc, address _praetor) {
        usdc = MockERC20Pull(_usdc);
        praetor = _praetor;
    }

    function deposit(address user, uint256 amount) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        userBalances[user] += amount;
    }

    function adapterPull(uint256 amount, address fromUser, address to) external {
        if (withdrawalsPaused) revert WithdrawalsPausedError();
        if (!approvedAdapters[msg.sender]) revert NotApprovedAdapter();
        require(userBalances[fromUser] >= amount, "insufficient balance");
        userBalances[fromUser] -= amount;
        usdc.transfer(to, amount);
    }

    function setApprovedAdapter(address adapter, bool approved) external {
        require(msg.sender == praetor, "only praetor");
        approvedAdapters[adapter] = approved;
    }

    function pauseWithdrawals() external {
        require(msg.sender == praetor, "only praetor");
        withdrawalsPaused = true;
    }

    function resumeWithdrawals() external {
        require(msg.sender == praetor, "only praetor");
        withdrawalsPaused = false;
    }
}

contract MockAdapterPull {
    MockCofferWithPause public coffer;

    constructor(address _coffer) { coffer = MockCofferWithPause(_coffer); }

    function pullFromCoffer(uint256 amount, address user) external {
        coffer.adapterPull(amount, user, address(this));
    }
}

contract AdapterPullPauseRespectTest is Test {
    MockERC20Pull internal usdc;
    MockCofferWithPause internal coffer;
    MockAdapterPull internal adapter;
    address internal user;
    address internal praetor;

    uint256 internal constant DEPOSIT = 10_000e6;

    function setUp() public {
        user = makeAddr("user");
        praetor = makeAddr("praetor");
        usdc = new MockERC20Pull();
        coffer = new MockCofferWithPause(address(usdc), praetor);
        adapter = new MockAdapterPull(address(coffer));

        // Wire adapter as approved
        vm.prank(praetor);
        coffer.setApprovedAdapter(address(adapter), true);

        // Fund user in coffer
        usdc.mint(user, DEPOSIT);
        vm.startPrank(user);
        usdc.approve(address(coffer), DEPOSIT);
        coffer.deposit(user, DEPOSIT);
        vm.stopPrank();

        // Fund coffer with USDC for transfers
        usdc.mint(address(coffer), DEPOSIT);
    }

    function test_pausedCoffer_adapterPullReverts() public {
        // Pause withdrawals
        vm.prank(praetor);
        coffer.pauseWithdrawals();

        // Adapter pull must revert
        vm.expectRevert(MockCofferWithPause.WithdrawalsPausedError.selector);
        adapter.pullFromCoffer(1_000e6, user);
    }

    function test_resumedCoffer_adapterPullSucceeds() public {
        // Pause then resume
        vm.prank(praetor);
        coffer.pauseWithdrawals();

        vm.prank(praetor);
        coffer.resumeWithdrawals();

        // Adapter pull must succeed
        adapter.pullFromCoffer(1_000e6, user);
        assertEq(coffer.userBalances(user), DEPOSIT - 1_000e6);
    }

    function test_unpausedCoffer_adapterPullWorks() public {
        // Without pausing, pull should work
        adapter.pullFromCoffer(2_000e6, user);
        assertEq(coffer.userBalances(user), DEPOSIT - 2_000e6);
    }

    function test_unapprovedAdapter_reverts() public {
        MockAdapterPull rogue = new MockAdapterPull(address(coffer));

        vm.expectRevert(MockCofferWithPause.NotApprovedAdapter.selector);
        rogue.pullFromCoffer(1_000e6, user);
    }
}
