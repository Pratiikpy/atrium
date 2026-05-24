// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {PraetorTimelock} from "../../contracts/praetor-timelock/src/PraetorTimelock.sol";

/// @title PraetorTimelock foundry test suite
/// @notice Verifies the schedule/wait/execute lifecycle, multisig-only
///         scheduling, 48h timelock enforcement, and the emergencyPause
///         passthrough. PraetorTimelock gates every parameter change across
///         the protocol (audit F-32) so its tests are demo-critical.
contract PraetorTimelockTest is Test {
    PraetorTimelock internal timelock;
    address internal multisig;
    address internal hostile;
    MockPausable internal target;

    function setUp() public {
        multisig = makeAddr("multisig");
        hostile = makeAddr("hostile");
        timelock = new PraetorTimelock(multisig);
        target = new MockPausable();
    }

    // ── Schedule ────────────────────────────────────────────────────

    function test_schedule_onlyMultisig() public {
        vm.prank(hostile);
        vm.expectRevert(PraetorTimelock.Unauthorized.selector);
        timelock.schedule(address(target), abi.encodeWithSelector(MockPausable.setN.selector, uint256(7)));
    }

    function test_schedule_recordsId() public {
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(7));
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);
        assertGt(timelock.scheduledAt(id), 0);
    }

    function test_schedule_rejectsDuplicate() public {
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(7));
        vm.startPrank(multisig);
        bytes32 id = timelock.schedule(address(target), data);
        vm.expectRevert(abi.encodeWithSelector(PraetorTimelock.AlreadyScheduled.selector, id));
        timelock.schedule(address(target), data);
        vm.stopPrank();
    }

    // ── Execute (48h gate) ──────────────────────────────────────────

    function test_execute_revertsBeforeTimelock() public {
        // Audit V-C2 fix: read `scheduledAt` from the contract instead of
        // trusting `uint64(block.timestamp)` to match the timestamp captured
        // inside `schedule()`. The contract is the source of truth — using
        // the contract's recorded value removes any drift between the test's
        // local view of block.timestamp and what `schedule()` snapshotted.
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(7));
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);
        uint64 scheduledAt = timelock.scheduledAt(id);

        uint64 readyAt = scheduledAt + 48 hours;
        uint64 nowAfterWarp = scheduledAt + 47 hours;
        vm.warp(uint256(nowAfterWarp));

        vm.prank(multisig);
        vm.expectRevert(
            abi.encodeWithSelector(PraetorTimelock.TimelockNotExpired.selector, readyAt, nowAfterWarp)
        );
        timelock.execute(address(target), data, scheduledAt);
    }

    function test_execute_succeedsAfter48h() public {
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(7));
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);
        uint64 scheduledAt = timelock.scheduledAt(id);

        vm.warp(uint256(scheduledAt) + 48 hours);
        vm.prank(multisig);
        timelock.execute(address(target), data, scheduledAt);
        assertEq(target.n(), 7);
    }

    function test_execute_revertsOnReplay() public {
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(7));
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);
        uint64 scheduledAt = timelock.scheduledAt(id);

        vm.warp(uint256(scheduledAt) + 48 hours);
        vm.prank(multisig);
        timelock.execute(address(target), data, scheduledAt);

        vm.prank(multisig);
        // second execute must fail — `executed[id]` is now set.
        vm.expectRevert(abi.encodeWithSelector(PraetorTimelock.AlreadyExecuted.selector, id));
        timelock.execute(address(target), data, scheduledAt);
    }

    // ── Cancel ──────────────────────────────────────────────────────

    function test_cancel_onlyMultisig() public {
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(7));
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);

        vm.prank(hostile);
        vm.expectRevert(PraetorTimelock.Unauthorized.selector);
        timelock.cancel(id);

        vm.prank(multisig);
        timelock.cancel(id);
        assertEq(timelock.scheduledAt(id), 0);
    }

    /// Iter 57 audit fix: pin the FIRE77-PT2 cancel-after-execute revert.
    /// Per PraetorTimelock.sol:83-87, a multisig that called execute and
    /// THEN called cancel on the same id would, pre-fix, have silently
    /// emitted both Executed AND Cancelled events on the same id —
    /// polluting the audit trail. The fix reverts with AlreadyExecuted.
    /// Without this test, a refactor stripping the `if (executed[id]) revert`
    /// guard would re-introduce the silent-failure path with no CI signal.
    function test_cancel_revertsAfterExecute_FIRE77_PT2_iter57() public {
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(7));
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);
        uint64 scheduledAt = timelock.scheduledAt(id);

        vm.warp(uint256(scheduledAt) + 48 hours);
        vm.prank(multisig);
        timelock.execute(address(target), data, scheduledAt);

        // Sanity: execute landed cleanly.
        assertTrue(timelock.executed(id), "pre: execute must have landed");

        // FIRE77-PT2: cancel on an already-executed id MUST revert.
        // Otherwise a stale audit trail would carry both Executed AND
        // Cancelled events for the same id.
        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(PraetorTimelock.AlreadyExecuted.selector, id));
        timelock.cancel(id);
    }

    /// Iter 57 audit fix: pin the NotScheduled revert path on `cancel`.
    /// A multisig that calls cancel with the wrong id (typo, off-by-one
    /// nonce, copy-paste from another schedule) must revert loudly —
    /// otherwise nothing happens and the operator may believe the cancel
    /// landed. This branch existed at PraetorTimelock.sol:82 but had no
    /// test enforcing it.
    function test_cancel_revertsOnUnknownId_iter57() public {
        bytes32 unknown = keccak256("never-scheduled");
        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(PraetorTimelock.NotScheduled.selector, unknown));
        timelock.cancel(unknown);
    }

    /// Iter 57 audit fix: pin that successful cancel emits Cancelled. The
    /// existing test_cancel_onlyMultisig checks the scheduledAt reset but
    /// not the event — and the subgraph (Scribe) listens on Cancelled to
    /// flag aborted parameter changes for the ops dashboard. If a future
    /// refactor dropped the emit, the dashboard would silently fall out
    /// of sync with on-chain state.
    function test_cancel_emitsCancelledEvent_iter57() public {
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(7));
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);

        vm.expectEmit(true, false, false, true, address(timelock));
        emit Cancelled(id);

        vm.prank(multisig);
        timelock.cancel(id);
    }

    event Cancelled(bytes32 indexed id);

    // ── Iter 90: emit assertions for Scheduled + Executed + EmergencyPaused ─

    event Scheduled(bytes32 indexed id, address indexed target, bytes data, uint64 scheduled_at);
    event Executed(bytes32 indexed id, address indexed target, bytes data);
    event EmergencyPaused(address indexed target, string reason);

    function test_schedule_emitsScheduled_iter90() public {
        // Scheduled is the canonical Praetor audit-trail event. Every
        // parameter change starts with a Scheduled emit — without test
        // coverage, a dropped emit would silently make every multisig
        // action invisible to Scribe's audit-log indexer.
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(7));
        bytes32 expectedId = keccak256(abi.encode(address(target), data, block.timestamp));

        vm.expectEmit(true, true, false, true, address(timelock));
        emit Scheduled(expectedId, address(target), data, uint64(block.timestamp));

        vm.prank(multisig);
        bytes32 actualId = timelock.schedule(address(target), data);
        // Returned id should match the keccak hash of (target, data, ts).
        assertEq(actualId, expectedId, "iter90: schedule returns the keccak id");
    }

    function test_execute_emitsExecuted_iter90() public {
        // Executed is the OTHER half of the audit trail. Together
        // (Scheduled, Executed) form the canonical record of every
        // landed parameter change.
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(7));
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);
        uint64 scheduledAt = timelock.scheduledAt(id);

        vm.warp(uint256(scheduledAt) + 48 hours);

        vm.expectEmit(true, true, false, true, address(timelock));
        emit Executed(id, address(target), data);

        vm.prank(multisig);
        timelock.execute(address(target), data, scheduledAt);
    }

    function test_emergencyPause_emitsEmergencyPaused_iter90() public {
        // Emergency pause is the "instant action" path — no timelock
        // window. The emit signals ops alerts (PagerDuty/Discord), so
        // dropped-emit would silently disable the alert channel for
        // exactly the worst time (a real emergency).
        vm.expectEmit(true, false, false, true, address(timelock));
        emit EmergencyPaused(address(target), "drill-iter90");

        vm.prank(multisig);
        timelock.emergencyPause(address(target), "drill-iter90");
    }

    // ── Emergency pause passthrough (audit G-6) ─────────────────────

    function test_emergencyPause_callsTargetPause() public {
        vm.prank(multisig);
        timelock.emergencyPause(address(target), "drill");
        assertTrue(target.isPaused());
        assertEq(target.lastReason(), "drill");
    }

    function test_emergencyPause_onlyMultisig() public {
        vm.prank(hostile);
        vm.expectRevert(PraetorTimelock.Unauthorized.selector);
        timelock.emergencyPause(address(target), "h");
    }

    // ── Audit LLL-4 + LLL-5 lock: EOA-target silent-success rejected ──
    //
    // Pre-LLL-4: a multisig typo pointing at a founder wallet (an EOA)
    // would execute() return (true, "") from the low-level call, emit
    // Executed, flip executed[id] = true. No state change anywhere; the
    // dashboard reports success.
    //
    // Pre-LLL-5: same for emergencyPause — IPausable(EOA).pause() compiles
    // to a low-level call which returns (true, "") on an EOA. Operators
    // see the EmergencyPaused event and think the subsystem is paused.
    //
    // The fixes add `if (target.code.length == 0) revert TargetNotAContract(target);`
    // on both paths. Pin them.

    function test_execute_revertsOnEOATarget_LLL4() public {
        address eoaTarget = makeAddr("founderWalletTypo");
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(7));

        vm.prank(multisig);
        bytes32 id = timelock.schedule(eoaTarget, data);
        uint64 scheduledAt = timelock.scheduledAt(id);

        vm.warp(uint256(scheduledAt) + 48 hours);

        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(PraetorTimelock.TargetNotAContract.selector, eoaTarget));
        timelock.execute(eoaTarget, data, scheduledAt);

        // Load-bearing: executed[id] must NOT be set. Pre-LLL-4 the silent
        // call would have flipped this to true; pre-fix replay-protection
        // would then refuse a legitimate redeploy + retry.
        assertFalse(timelock.executed(id), "LLL-4: EOA-target execute MUST NOT mark id as executed");
    }

    function test_emergencyPause_revertsOnEOATarget_LLL5() public {
        address eoaTarget = makeAddr("anotherTypo");

        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(PraetorTimelock.TargetNotAContract.selector, eoaTarget));
        timelock.emergencyPause(eoaTarget, "drill");

        // The MockPausable target deployed in setUp must NOT have been
        // flipped to paused — the wrong-address call hit nothing.
        assertFalse(target.isPaused(), "LLL-5: typo'd target must NOT flip a different contract");
    }

    function test_constructor_revertsOnZeroMultisig_DDD5() public {
        vm.expectRevert(bytes("zero multisig"));
        new PraetorTimelock(address(0));
    }

    function test_execute_acceptsContractTarget_LLL4_happyPath() public {
        // The post-fix happy path: target.code.length > 0 → revert NOT
        // triggered → low-level call proceeds. Already covered by
        // test_execute_succeedsAfter48h but pinning explicitly here so
        // a removal of the .code.length check would still fail at least
        // ONE test, not just slip past.
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, uint256(42));
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);
        uint64 scheduledAt = timelock.scheduledAt(id);

        vm.warp(uint256(scheduledAt) + 48 hours);
        // target has bytecode (MockPausable deployed in setUp). Should NOT
        // trip TargetNotAContract.
        assertGt(address(target).code.length, 0);
        vm.prank(multisig);
        timelock.execute(address(target), data, scheduledAt);
        assertEq(target.n(), 42);
    }

    // ── Iter 98: fuzz state-machine invariants on the timelock ────────
    //
    // (1) Once executed, executed[id] is true and stays true. No path
    //     unsets it. A bug that toggles or clears it would let the
    //     multisig replay the same parameter change.
    // (2) Once cancelled, scheduledAt[id] == 0 and stays 0. No re-cancel
    //     succeeds, no execute succeeds.
    // (3) Schedule then execute on the EXACT 48h boundary succeeds.

    function testFuzz_execute_setsExecutedTrueAndStaysTrue_iter98(uint256 magic) public {
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, magic);
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);
        uint64 scheduledAt = timelock.scheduledAt(id);

        vm.warp(uint256(scheduledAt) + 48 hours);
        vm.prank(multisig);
        timelock.execute(address(target), data, scheduledAt);

        // Invariant: executed[id] flips to true.
        assertTrue(timelock.executed(id), "iter98: executed must flip true");

        // Invariant: second execute attempt MUST revert with AlreadyExecuted.
        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(PraetorTimelock.AlreadyExecuted.selector, id));
        timelock.execute(address(target), data, scheduledAt);

        // Invariant: executed[id] still true after the failed retry.
        assertTrue(timelock.executed(id), "iter98: executed must stay true after retry");
    }

    function testFuzz_cancel_zerosScheduledAtAndBlocksAllFutureOps_iter98(uint256 magic) public {
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, magic);
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);
        uint64 scheduledAt = timelock.scheduledAt(id);
        assertGt(uint256(scheduledAt), 0, "pre: schedule must record timestamp");

        vm.prank(multisig);
        timelock.cancel(id);

        // Invariant: scheduledAt zeros out.
        assertEq(timelock.scheduledAt(id), 0, "iter98: cancel must zero scheduledAt");

        // Invariant: re-cancel reverts with NotScheduled (no double-cancel).
        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(PraetorTimelock.NotScheduled.selector, id));
        timelock.cancel(id);

        // Invariant: execute also reverts with NotScheduled.
        vm.warp(uint256(scheduledAt) + 48 hours);
        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(PraetorTimelock.NotScheduled.selector, id));
        timelock.execute(address(target), data, scheduledAt);
    }

    function testFuzz_execute_atExactBoundarySucceeds_iter98(uint256 magic) public {
        // The cooldown check is `if (block.timestamp < ready_at) revert`.
        // At exactly ready_at the strict-less-than is false → execute succeeds.
        bytes memory data = abi.encodeWithSelector(MockPausable.setN.selector, magic);
        vm.prank(multisig);
        bytes32 id = timelock.schedule(address(target), data);
        uint64 scheduledAt = timelock.scheduledAt(id);
        uint256 readyAt = uint256(scheduledAt) + 48 hours;

        // Warp to exactly readyAt (NOT readyAt + 1).
        vm.warp(readyAt);
        vm.prank(multisig);
        timelock.execute(address(target), data, scheduledAt);
        assertEq(target.n(), magic, "iter98: execute at exact 48h boundary lands");
        assertTrue(timelock.executed(id), "iter98: executed flips on exact-boundary execute");
    }
}

contract MockPausable {
    bool internal _paused;
    bytes32 internal _lastReason;
    uint256 public n;

    // Renamed to pause(bytes32) to match the Coffer/Plinth/Sigil/Vigil
    // Stylus ABI selector. PraetorTimelock.emergencyPause keccak256s the
    // operator string before forwarding, so the mock receives the digest.
    function pause(bytes32 reason) external {
        _paused = true;
        _lastReason = reason;
    }
    function setN(uint256 v) external {
        n = v;
    }
    function isPaused() external view returns (bool) {
        return _paused;
    }
    function lastReason() external view returns (string memory) {
        return _lastReason;
    }
}
