// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {PosternKillSwitch} from "../../contracts/postern-kill-switch/src/PosternKillSwitch.sol";
import {PosternKeyRegistry} from "../../contracts/postern-kill-switch/src/PosternKeyRegistry.sol";

/// @title KillSwitchRevokesEverything — integration test
/// @notice Issue 3 mandates via Sigil, issue 2 session keys via PosternKeyRegistry.
///         Call PosternKillSwitch.activate. Assert all 5 (3+2) revoked.
///         Tests PosternKeyRegistry chunked-revoke (Phase 2b) by varying key
///         counts; uses 50-key cap to test revert condition.

contract MockSigilForKillSwitch {
    mapping(address => mapping(address => bool)) public revoked;
    uint256 public revokeCount;

    function revokeAllOnBehalfOf(address owner, address agent) external {
        revoked[owner][agent] = true;
        revokeCount++;
    }

    function wasRevoked(address owner, address agent) external view returns (bool) {
        return revoked[owner][agent];
    }
}

contract MockEntryPointMinimal {
    // Minimal stub — KillSwitch doesn't call EntryPoint in activate()
}

contract KillSwitchRevokesEverythingTest is Test {
    PosternKillSwitch internal killSwitch;
    PosternKeyRegistry internal keyRegistry;
    MockSigilForKillSwitch internal sigil;
    MockEntryPointMinimal internal entryPoint;

    address internal user;
    address internal agent1;
    address internal agent2;
    address internal agent3;
    address internal key1;
    address internal key2;

    function setUp() public {
        user = makeAddr("user");
        agent1 = makeAddr("agent1");
        agent2 = makeAddr("agent2");
        agent3 = makeAddr("agent3");
        key1 = makeAddr("sessionKey1");
        key2 = makeAddr("sessionKey2");

        sigil = new MockSigilForKillSwitch();
        entryPoint = new MockEntryPointMinimal();

        // Deploy KillSwitch first to get its address for KeyRegistry
        // But KeyRegistry needs killSwitch address in constructor...
        // Use CREATE2 prediction or deploy in correct order
        // Deploy killSwitch with a placeholder, then deploy registry, then redeploy
        // Actually: deploy registry first with predicted killSwitch address
        // Simpler: use vm.etch or deploy with address prediction

        // Deploy key registry with a temporary kill switch, then deploy real kill switch
        // The real pattern: deploy kill switch first, then registry pointing to it
        // But PosternKeyRegistry constructor needs killSwitch address...
        // And PosternKillSwitch constructor needs keyRegistry address...
        // This is a circular dependency — resolve with CREATE2 or two-step

        // For testing: compute the kill switch address ahead of time
        address predictedKillSwitch = computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        keyRegistry = new PosternKeyRegistry(predictedKillSwitch);
        killSwitch = new PosternKillSwitch(address(sigil), address(entryPoint), address(keyRegistry));
        assertEq(address(killSwitch), predictedKillSwitch, "predicted address must match");

        // Issue 2 session keys
        vm.startPrank(user);
        keyRegistry.recordIssued(user, key1, block.timestamp + 1 days);
        keyRegistry.recordIssued(user, key2, block.timestamp + 1 days);
        vm.stopPrank();
    }

    function test_activateRevokesAll3Mandates_and_2SessionKeys() public {
        address[] memory agents = new address[](3);
        agents[0] = agent1;
        agents[1] = agent2;
        agents[2] = agent3;

        vm.prank(user);
        killSwitch.activate(agents);

        // All 3 mandates revoked
        assertTrue(sigil.wasRevoked(user, agent1), "agent1 must be revoked");
        assertTrue(sigil.wasRevoked(user, agent2), "agent2 must be revoked");
        assertTrue(sigil.wasRevoked(user, agent3), "agent3 must be revoked");
        assertEq(sigil.revokeCount(), 3);

        // All 2 session keys revoked
        assertFalse(keyRegistry.isActive(user, key1), "key1 must be revoked");
        assertFalse(keyRegistry.isActive(user, key2), "key2 must be revoked");
    }

    function test_maxActiveKeys_cap50_reverts() public {
        address newUser = makeAddr("heavy-user");
        vm.startPrank(newUser);

        // Issue 50 keys (the max)
        for (uint256 i = 0; i < 50; i++) {
            address k = address(uint160(0xBEEF0000 + i));
            keyRegistry.recordIssued(newUser, k, block.timestamp + 1 days);
        }

        // 51st key must revert
        vm.expectRevert(PosternKeyRegistry.MaxActiveKeysExceeded.selector);
        keyRegistry.recordIssued(newUser, makeAddr("key51"), block.timestamp + 1 days);
        vm.stopPrank();
    }

    function test_killSwitch_withZeroAgents_stillRevokesKeys() public {
        address[] memory agents = new address[](0);

        vm.prank(user);
        killSwitch.activate(agents);

        // Session keys still revoked even with no agents
        assertFalse(keyRegistry.isActive(user, key1), "key1 must be revoked");
        assertFalse(keyRegistry.isActive(user, key2), "key2 must be revoked");
    }

    function test_killSwitch_idempotent() public {
        address[] memory agents = new address[](1);
        agents[0] = agent1;

        vm.prank(user);
        killSwitch.activate(agents);

        // Second activation should not revert
        vm.prank(user);
        killSwitch.activate(agents);

        assertTrue(sigil.wasRevoked(user, agent1));
    }
}
