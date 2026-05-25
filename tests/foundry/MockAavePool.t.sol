// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockAavePool} from "../../contracts/mocks/MockAavePool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Minimal ERC-20 for the supply/withdraw round-trip.
contract MockUSDC is IERC20 {
    string public name = "MockUSDC";
    string public symbol = "mUSDC";
    uint8 public decimals = 6;
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract MockAavePoolTest is Test {
    MockAavePool pool;
    MockUSDC usdc;
    address supplier = address(0xBEEF);
    address recipient = address(0xCAFE);

    function setUp() public {
        pool = new MockAavePool();
        usdc = new MockUSDC();
        usdc.mint(supplier, 1_000_000e6);
    }

    function test_supply_pulls_usdc_from_caller() public {
        vm.startPrank(supplier);
        usdc.approve(address(pool), 100e6);
        pool.supply(address(usdc), 100e6, supplier, 0);
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(pool)), 100e6, "pool holds the deposit");
        assertEq(pool.supplied(address(usdc), supplier), 100e6, "supplier accounted");
    }

    function test_supply_zero_reverts() public {
        vm.prank(supplier);
        vm.expectRevert(MockAavePool.AmountZero.selector);
        pool.supply(address(usdc), 0, supplier, 0);
    }

    function test_withdraw_returns_usdc_to_recipient() public {
        vm.startPrank(supplier);
        usdc.approve(address(pool), 100e6);
        pool.supply(address(usdc), 100e6, supplier, 0);
        uint256 actual = pool.withdraw(address(usdc), 40e6, recipient);
        vm.stopPrank();
        assertEq(actual, 40e6, "withdraw returns exact amount");
        assertEq(usdc.balanceOf(recipient), 40e6, "recipient credited");
        assertEq(pool.supplied(address(usdc), supplier), 60e6, "supplier accounting reduced");
    }

    function test_withdraw_beyond_supplied_reverts() public {
        vm.startPrank(supplier);
        usdc.approve(address(pool), 100e6);
        pool.supply(address(usdc), 100e6, supplier, 0);
        vm.expectRevert(abi.encodeWithSelector(
            MockAavePool.InsufficientSupplied.selector,
            address(usdc), supplier, 200e6, 100e6
        ));
        pool.withdraw(address(usdc), 200e6, recipient);
        vm.stopPrank();
    }

    function test_liquidity_index_drifts_monotonically() public {
        uint128 first;
        (, first, , , , , , , , , , , , , ) = pool.getReserveData(address(usdc));
        uint128 second;
        (, second, , , , , , , , , , , , , ) = pool.getReserveData(address(usdc));
        uint128 third;
        (, third, , , , , , , , , , , , , ) = pool.getReserveData(address(usdc));
        assertGt(first, 0, "initial index seeded non-zero");
        assertGt(second, first, "index drifts up on second read");
        assertGt(third, second, "index keeps drifting");
        // 5 bps drift per read: second / first ~= 1.0005.
        assertApproxEqRel(second, first * 10005 / 10000, 1e15, "5 bps drift");
    }

    function test_reserve_data_view_does_not_advance_index() public {
        uint128 before = pool.getReserveDataView(address(usdc));
        uint128 again = pool.getReserveDataView(address(usdc));
        assertEq(before, again, "view-only read does not mutate");
    }

    function test_two_suppliers_isolated() public {
        address other = address(0xABCD);
        usdc.mint(other, 500e6);

        vm.startPrank(supplier);
        usdc.approve(address(pool), 200e6);
        pool.supply(address(usdc), 200e6, supplier, 0);
        vm.stopPrank();

        vm.startPrank(other);
        usdc.approve(address(pool), 300e6);
        pool.supply(address(usdc), 300e6, other, 0);
        vm.stopPrank();

        // Each supplier's accounting independent; pool holds total.
        assertEq(pool.supplied(address(usdc), supplier), 200e6);
        assertEq(pool.supplied(address(usdc), other), 300e6);
        assertEq(usdc.balanceOf(address(pool)), 500e6);

        // Other supplier can't drain supplier's balance.
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(
            MockAavePool.InsufficientSupplied.selector,
            address(usdc), other, 400e6, 300e6
        ));
        pool.withdraw(address(usdc), 400e6, recipient);
    }
}
