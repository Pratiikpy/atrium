// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {PosternKillSwitch} from "../../contracts/postern-kill-switch/src/PosternKillSwitch.sol";

/// @title PosternKillSwitch foundry test suite
/// @notice Demo step 7 is the Kill Switch. This suite enforces the audit
///         F-2 fix (revoke via `revokeAllOnBehalfOf(user, agent)`, not by
///         making the kill-switch contract the owner of the revocation),
///         and pins the activate() side-effects: every agent passed in
///         gets revoked AND the key registry is marked.
contract PosternKillSwitchTest is Test {
    PosternKillSwitch internal killSwitch;
    MockSigil internal sigil;
    MockEntryPoint internal entryPoint;
    MockKeyRegistry internal keyRegistry;
    address internal user;
    address internal agentA;
    address internal agentB;

    function setUp() public {
        user = makeAddr("user");
        agentA = makeAddr("agentA");
        agentB = makeAddr("agentB");
        sigil = new MockSigil();
        entryPoint = new MockEntryPoint();
        keyRegistry = new MockKeyRegistry();
        keyRegistry.setActiveKeys(user, _two(makeAddr("k1"), makeAddr("k2")));
        killSwitch = new PosternKillSwitch(address(sigil), address(entryPoint), address(keyRegistry));
    }

    // ── activate() callable by anyone, applies to msg.sender (audit F-2) ──

    function test_activate_revokesAllPassedAgents() public {
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        vm.prank(user);
        killSwitch.activate(agents);

        assertTrue(sigil.wasRevoked(user, agentA), "agentA revoke not recorded for user");
        assertTrue(sigil.wasRevoked(user, agentB), "agentB revoke not recorded for user");
        assertEq(sigil.revokeCount(), 2);
    }

    function test_activate_revokesOnBehalfOfMsgSenderNotContract() public {
        // Audit F-2: the revocation must bind to the user, not to the
        // PosternKillSwitch contract address.
        address[] memory agents = new address[](1);
        agents[0] = agentA;

        vm.prank(user);
        killSwitch.activate(agents);

        // The Kill Switch contract itself must NOT have a revoke record.
        assertFalse(sigil.wasRevoked(address(killSwitch), agentA), "wrong owner used for revoke");
    }

    function test_activate_marksKeyRegistry() public {
        address[] memory agents = new address[](0);
        vm.prank(user);
        killSwitch.activate(agents);
        assertTrue(keyRegistry.wasMarked(user));
    }

    function test_activate_emitsActivatedEvent() public {
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        vm.expectEmit(true, false, false, true, address(killSwitch));
        emit PosternKillSwitch.KillSwitchActivated(user, 2, 2, block.timestamp);
        vm.prank(user);
        killSwitch.activate(agents);
    }

    function test_activate_emptyAgents_stillMarksRegistry() public {
        // Even with zero mandates to revoke, the session-key cancel must run.
        address[] memory empty = new address[](0);
        vm.prank(user);
        killSwitch.activate(empty);
        assertTrue(keyRegistry.wasMarked(user));
        assertEq(sigil.revokeCount(), 0);
    }

    // ── Two users cannot interfere with each other ─────────────────

    function test_activate_isolatedByMsgSender() public {
        address otherUser = makeAddr("otherUser");
        address[] memory agents = new address[](1);
        agents[0] = agentA;

        vm.prank(otherUser);
        killSwitch.activate(agents);

        // user's mandate for agentA must NOT be affected.
        assertFalse(sigil.wasRevoked(user, agentA));
        assertTrue(sigil.wasRevoked(otherUser, agentA));
    }

    function _two(address a, address b) internal pure returns (address[] memory) {
        address[] memory arr = new address[](2);
        arr[0] = a;
        arr[1] = b;
        return arr;
    }

    // ── Audit MMM-6 lock: kill switch is resilient to per-agent failures
    //
    // Pre-MMM-6, a single reverting `sigil.revokeAllOnBehalfOf` would have
    // reverted the entire activate() call. The user's session keys would
    // NOT have been cancelled, the most important step of the kill switch
    // skipped because of an unrelated stale-nonce error on one agent. The
    // fix wrapped each per-agent revoke in try/catch and emits
    // `SigilRevokeSkipped`. Same protection on the markAllRevoked side.

    event SigilRevokeSkipped(address indexed user, address indexed agent, bytes reason);

    function test_activate_skipsRevertingAgent_andContinues_MMM6() public {
        // Configure agentA to revert with a stale-nonce-style reason.
        bytes memory reason = abi.encodeWithSignature("StaleRevocation(uint256)", uint256(7));
        sigil.setRevertForAgent(agentA, reason);

        address[] memory agents = new address[](2);
        agents[0] = agentA; // will revert
        agents[1] = agentB; // will succeed

        vm.expectEmit(true, true, false, true, address(killSwitch));
        emit SigilRevokeSkipped(user, agentA, reason);

        vm.prank(user);
        killSwitch.activate(agents);

        // agentB must still get revoked despite agentA's revert.
        assertFalse(sigil.wasRevoked(user, agentA), "agentA should NOT be marked revoked (the call reverted)");
        assertTrue(sigil.wasRevoked(user, agentB), "agentB MUST still be revoked even after agentA failed");
        assertEq(sigil.revokeCount(), 1, "only the successful revoke counts");

        // Load-bearing assertion: the registry step must still run. Pre-MMM-6
        // the whole tx reverted; post-fix the registry call is reached.
        assertTrue(keyRegistry.wasMarked(user), "session keys must still be cancelled despite agent revert");
    }

    function test_activate_recordsCorrectRevokedCount_whenSomeFail_MMM6() public {
        sigil.setRevertForAgent(agentA, abi.encode("revert"));

        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        // Emitted event must report 1 revoked, NOT 2 (the count excludes the
        // failed agent, KillSwitchActivated.sigil_agents_revoked is the
        // honest "actually revoked" count, not the input length).
        vm.expectEmit(true, false, false, true, address(killSwitch));
        emit PosternKillSwitch.KillSwitchActivated(user, 1, 2, block.timestamp);

        vm.prank(user);
        killSwitch.activate(agents);
    }

    // ── Audit MMM-10 lock: constructor zero-checks ───────────────────
    //
    // Without these guards, deploying with any of `_sigil`, `_entryPoint`,
    // or `_keyRegistry` set to `address(0)` would silently produce a
    // half-broken kill switch. Per the MMM-10 doc-comment: zero sigil →
    // every per-agent try/catch in activate() catches the extcodesize-zero
    // revert + emits SigilRevokeSkipped → user thinks 0 mandates revoked.
    // Fail loud at deploy time so the broken state never reaches users.

    function test_constructor_revertsOnZeroSigil_MMM10() public {
        vm.expectRevert(bytes("zero sigil"));
        new PosternKillSwitch(address(0), address(entryPoint), address(keyRegistry));
    }

    function test_constructor_revertsOnZeroEntryPoint_MMM10() public {
        vm.expectRevert(bytes("zero entry point"));
        new PosternKillSwitch(address(sigil), address(0), address(keyRegistry));
    }

    function test_constructor_revertsOnZeroKeyRegistry_MMM10() public {
        vm.expectRevert(bytes("zero key registry"));
        new PosternKillSwitch(address(sigil), address(entryPoint), address(0));
    }

    function test_activate_resilientToRegistryRevert_MMM6() public {
        // The outer try/catch wrapper around markAllRevoked: even if the
        // registry call reverts, the Sigil revocation must already have
        // landed. Same defense-in-depth pattern.
        keyRegistry.setMarkReverts(true);

        address[] memory agents = new address[](1);
        agents[0] = agentA;

        vm.prank(user);
        killSwitch.activate(agents);

        // Sigil revoke must have succeeded even though the registry call
        // failed. Pre-MMM-6 this would have reverted before Sigil ran.
        assertTrue(sigil.wasRevoked(user, agentA), "Sigil revocation must persist even if registry revert");
        // Registry was never marked because its call reverted. The honest
        // post-fix behavior: do the salvageable part, don't pretend the
        // unsalvageable part landed.
        assertFalse(keyRegistry.wasMarked(user), "registry not marked is the honest record");
    }
}

// ──────────────────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────────────────

contract MockSigil {
    mapping(address => mapping(address => bool)) internal revoked;
    uint256 public revokeCount;
    // Audit VVVV-3: toggle a per-agent revert to exercise the MMM-6
    // try/catch + SigilRevokeSkipped path. Maps agent → revertReason.
    // An empty reason means "no revert".
    mapping(address => bytes) internal revertReasonForAgent;

    function setRevertForAgent(address agent, bytes calldata reason) external {
        revertReasonForAgent[agent] = reason;
    }

    function revokeAllOnBehalfOf(address owner, address agent) external {
        bytes memory reason = revertReasonForAgent[agent];
        if (reason.length > 0) {
            assembly { revert(add(reason, 32), mload(reason)) }
        }
        revoked[owner][agent] = true;
        revokeCount++;
    }
    function wasRevoked(address owner, address agent) external view returns (bool) {
        return revoked[owner][agent];
    }
}

contract MockKeyRegistry {
    mapping(address => address[]) internal active;
    mapping(address => bool) internal marked;
    // Audit VVVV-3: toggle reverts so MMM-6's outer try/catch (around
    // markAllRevoked) can be tested independently.
    bool public markRevertsNext;

    function setMarkReverts(bool v) external {
        markRevertsNext = v;
    }
    function setActiveKeys(address user, address[] memory keys) external {
        active[user] = keys;
    }
    function getActiveKeys(address user) external view returns (address[] memory) {
        return active[user];
    }
    function markAllRevoked(address user) external {
        if (markRevertsNext) revert("registry OOG");
        marked[user] = true;
    }
    function wasMarked(address user) external view returns (bool) {
        return marked[user];
    }
}

/// Minimal EntryPoint stub, PosternKillSwitch only stores the address.
contract MockEntryPoint {}
