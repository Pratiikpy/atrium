// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {ReentrancyGuard} from "../../contracts/portico-registry/src/ReentrancyGuard.sol";

/// @title ReentrancyGuard primitive foundry test suite
/// @notice Pins the F-11 audit fix at the abstract-contract level. Every
///         Portico adapter inherits this guard and wraps `open_position`
///         + `close_position` with `nonReentrant`. Existing adapter tests
///         exercise the happy path through the guard but never assert
///         that a re-entrant call FAILS with `ReentrantCall()`. This test
///         file pins the primitive so every inheriting adapter inherits
///         the proof.
///
///         Tests:
///           1. nonReentrant allows a single linear call
///           2. nonReentrant rejects a self-reentry attempt
///           3. nonReentrant resets after the call completes (next call OK)
///           4. nonReentrant resets even after a child external call
contract ReentrancyGuardTest is Test {
    TestableReentrant internal target;
    Reenterer internal reenterer;

    function setUp() public {
        target = new TestableReentrant();
        reenterer = new Reenterer(target);
    }

    function test_nonReentrant_allowsSingleLinearCall() public {
        // Linear call: enter → do work → exit. No reentry attempt.
        target.linear();
        assertEq(target.linearCount(), 1, "linear call must run once");
    }

    function test_nonReentrant_rejectsSelfReentry() public {
        // The TestableReentrant.selfReenter() attempts to call its own
        // linear() while still inside its nonReentrant frame. The guard
        // must reject with ReentrantCall(). Pre-F-11 the inner call would
        // have re-entered and re-run linear's body, double-counting.
        vm.expectRevert(ReentrancyGuard.ReentrantCall.selector);
        target.selfReenter();
        // After the revert: linearCount stays at 0 (whole tx unwound),
        // not 2 (which would mean the guard let the inner call through).
        assertEq(target.linearCount(), 0, "reentry must NOT increment");
    }

    function test_nonReentrant_rejectsExternalReentry() public {
        // The more realistic F-11 scenario: a guarded function calls an
        // external (malicious) contract that calls back into the same
        // guarded function. Reenterer simulates a hostile venue/adapter.
        vm.expectRevert(ReentrancyGuard.ReentrantCall.selector);
        target.callOut(address(reenterer));
        assertEq(target.linearCount(), 0, "external reentry attempt must NOT have landed");
    }

    function test_nonReentrant_resetsAfterCallCompletes() public {
        // The status flag must reset to _NOT_ENTERED after a successful
        // call. Without the reset, the SECOND call would revert. Pre-F-11
        // a missing reset is the classic OpenZeppelin v3 → v4 migration
        // bug.
        target.linear();
        target.linear();
        assertEq(target.linearCount(), 2, "two sequential calls must both succeed");
    }

    function test_nonReentrant_resetsAfterChildCallCompletes() public {
        // Status must reset even if the guarded function makes an
        // external call that succeeds (no reentry). Confirms the modifier
        // doesn't lock the contract permanently after any external call.
        BenignChild benign = new BenignChild();
        target.callOut(address(benign)); // benign returns without reentering
        target.linear();
        assertEq(target.linearCount(), 2, "subsequent calls must succeed after a successful external child call");
    }
}

/// @dev Test harness. Inherits the production ReentrancyGuard so we test
/// the EXACT abstract contract, not a copy.
contract TestableReentrant is ReentrancyGuard {
    uint256 public linearCount;

    function linear() external nonReentrant {
        linearCount++;
    }

    /// Attempt direct self-reentry. The inner this.linear() call goes
    /// through ITS OWN external call frame, so the modifier triggers.
    function selfReenter() external nonReentrant {
        this.linear();
        linearCount++;
    }

    /// Call an arbitrary external. Used to model a malicious adapter
    /// venue that tries to reenter the guarded path. Bubble the child's
    /// revert data so a ReentrantCall() child reverts the parent with
    /// the same selector, otherwise the test sees a generic require
    /// string and can't distinguish reentry from any other failure.
    function callOut(address target) external nonReentrant {
        (bool ok, bytes memory ret) = target.call(abi.encodeWithSignature("hit(address)", address(this)));
        if (!ok) {
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }
        linearCount++;
    }
}

/// @dev Malicious external, reenters the guarded contract.
contract Reenterer {
    TestableReentrant public target;
    constructor(TestableReentrant _t) { target = _t; }
    function hit(address t) external {
        // t is the testable contract (passed by callOut). Reenter its
        // linear() function. The guard must reject this.
        TestableReentrant(t).linear();
    }
}

/// @dev Benign external, doesn't try to reenter. Confirms the guard
/// doesn't accidentally block legitimate external calls.
contract BenignChild {
    function hit(address) external pure {
        // Intentionally empty.
    }
}
