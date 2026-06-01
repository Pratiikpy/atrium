// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Faucet} from "../../contracts/faucet/src/Faucet.sol";

/// @title Faucet test suite
/// @notice Phase theta.5 fix (2026-05-25). Pre-fix the Faucet shipped to
///         Sepolia with zero unit tests despite holding USDC + ETH that
///         users claim on onboarding. The audit (Round 1) flagged this
///         as a HIGH coverage hole, a faucet failure on judge day is
///         the first interaction in the demo flow, so a regression that
///         silently lands in production blocks the entire user funnel.
///
///         This suite covers the five named code paths:
///           1. claim happy-path + emits Claimed
///           2. claim cooldown enforcement (Cooldown error w/ seconds)
///           3. ETH balance < ethDrop path (USDC only, ethAmount: 0)
///           4. drainUsdc Praetor-only + hostile rejected
///           5. drainEth Praetor-only + transfer failure path
contract FaucetTest is Test {
    Faucet internal faucet;
    MockERC20 internal usdc;
    address internal praetor;
    address internal user;
    address internal hostile;

    uint256 internal constant USDC_DROP = 1_000_000;   // 1 USDC (6 decimals)
    uint256 internal constant ETH_DROP  = 0.01 ether;
    uint64  internal constant COOLDOWN  = 24 hours;

    event Claimed(address indexed user, uint256 usdcAmount, uint256 ethAmount);

    function setUp() public {
        praetor = makeAddr("praetor");
        user = makeAddr("user");
        hostile = makeAddr("hostile");

        usdc = new MockERC20("USDC", 6);
        faucet = new Faucet(address(usdc), praetor, USDC_DROP, ETH_DROP, COOLDOWN);

        // Stock the faucet: USDC + ETH so a real claim can settle both legs.
        usdc.mint(address(faucet), 100 * USDC_DROP);
        vm.deal(address(faucet), 10 * ETH_DROP);
    }

    // ── Path 1: claim happy-path ─────────────────────────────────────

    function test_claim_emitsClaimedAndTransfersBoth() public {
        vm.expectEmit(true, false, false, true, address(faucet));
        emit Claimed(user, USDC_DROP, ETH_DROP);

        uint256 ethBefore = user.balance;
        vm.prank(user);
        faucet.claim();

        assertEq(usdc.balanceOf(user), USDC_DROP, "user must receive USDC drop");
        assertEq(user.balance - ethBefore, ETH_DROP, "user must receive ETH drop");
        assertEq(faucet.lastClaim(user), uint64(block.timestamp), "lastClaim must be recorded");
    }

    // ── Path 2: cooldown enforcement ─────────────────────────────────

    function test_claim_revertsDuringCooldownWindow() public {
        vm.prank(user);
        faucet.claim();

        // Half-way through the cooldown: must still revert.
        vm.warp(block.timestamp + COOLDOWN / 2);
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(Faucet.Cooldown.selector, uint64(COOLDOWN / 2))
        );
        faucet.claim();
    }

    function test_claim_clearsAfterCooldownExpires() public {
        vm.prank(user);
        faucet.claim();
        vm.warp(block.timestamp + COOLDOWN + 1);
        vm.prank(user);
        faucet.claim();
        assertEq(usdc.balanceOf(user), 2 * USDC_DROP, "second claim must settle after cooldown");
    }

    // ── Path 3: USDC-only when ETH balance is short ─────────────────

    function test_claim_skipsEthDropWhenFaucetEthBalanceShort() public {
        // Drain all ETH so the next claim cannot deliver ethDrop. The
        // contract must still ship USDC and emit Claimed with ethAmount=0.
        vm.deal(address(faucet), 0);

        vm.expectEmit(true, false, false, true, address(faucet));
        emit Claimed(user, USDC_DROP, 0);

        vm.prank(user);
        faucet.claim();
        assertEq(usdc.balanceOf(user), USDC_DROP);
        assertEq(user.balance, 0, "user must not receive ETH when faucet is dry");
    }

    // ── Path 4: drainUsdc admin gating ──────────────────────────────

    function test_drainUsdc_onlyPraetor() public {
        vm.prank(hostile);
        vm.expectRevert(Faucet.Unauthorized.selector);
        faucet.drainUsdc(hostile, USDC_DROP);

        // Praetor success
        vm.prank(praetor);
        faucet.drainUsdc(praetor, USDC_DROP);
        assertEq(usdc.balanceOf(praetor), USDC_DROP);
    }

    // ── Path 5: drainEth admin gating + transfer failure ────────────

    function test_drainEth_onlyPraetor() public {
        vm.prank(hostile);
        vm.expectRevert(Faucet.Unauthorized.selector);
        faucet.drainEth(payable(hostile), ETH_DROP);
    }

    function test_drainEth_transferFailedRevertsEthDropFailed() public {
        // Use a recipient with no receive() so the .call returns false.
        RejectingReceiver rj = new RejectingReceiver();
        vm.prank(praetor);
        vm.expectRevert(Faucet.EthDropFailed.selector);
        faucet.drainEth(payable(address(rj)), ETH_DROP);
    }

    // ── Constructor guards ──────────────────────────────────────────

    function test_constructor_revertsOnZeroUsdc() public {
        vm.expectRevert(bytes("zero usdc"));
        new Faucet(address(0), praetor, USDC_DROP, ETH_DROP, COOLDOWN);
    }

    function test_constructor_revertsOnZeroPraetor() public {
        vm.expectRevert(bytes("zero praetor"));
        new Faucet(address(usdc), address(0), USDC_DROP, ETH_DROP, COOLDOWN);
    }
}

// ── Test doubles ────────────────────────────────────────────────────

contract RejectingReceiver {
    // No receive(), no fallback. Plain .call returns false.
}

contract MockERC20 {
    string public name;
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;

    constructor(string memory _name, uint8 _decimals) {
        name = _name;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 v) external returns (bool) {
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }
}
