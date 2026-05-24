// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {PosternKeyRegistry} from "../../contracts/postern-kill-switch/src/PosternKeyRegistry.sol";

/// @title PosternKeyRegistry foundry test suite
/// @notice Without this registry Kill Switch cannot enumerate "all active session
///         keys" to revoke them — ERC-7715 has no native enumeration. The judge
///         demo path is:
///           1. user (or their Postern wallet) calls recordIssued() at grant time
///           2. KillSwitch calls markAllRevoked() to clear every active key in one tx
///         This suite pins every invariant the demo relies on.
contract PosternKeyRegistryTest is Test {
    PosternKeyRegistry internal registry;
    address internal killSwitch;
    address internal user;
    address internal hostile;

    event SessionKeyIssued(address indexed user, address indexed sessionKey, uint256 expiresAt);
    event SessionKeyRevoked(address indexed user, address indexed sessionKey);
    event SessionKeyExpiredCleaned(address indexed user, address indexed sessionKey);

    function setUp() public {
        killSwitch = makeAddr("postern-kill-switch");
        user = makeAddr("user");
        hostile = makeAddr("hostile");
        registry = new PosternKeyRegistry(killSwitch);
    }

    // ── recordIssued() gating ─────────────────────────────────────────

    function test_recordIssued_userCanRegisterTheirOwnKey() public {
        address key = makeAddr("session-key-1");
        uint256 exp = block.timestamp + 1 days;

        vm.expectEmit(true, true, false, true, address(registry));
        emit SessionKeyIssued(user, key, exp);

        vm.prank(user);
        registry.recordIssued(user, key, exp);

        assertTrue(registry.isActive(user, key), "isActive must be set");
        assertEq(registry.expiresAt(user, key), exp);
        assertEq(registry.activeKeyCount(user), 1);
    }

    function test_recordIssued_thirdPartyCannotRegisterForUser() public {
        // The "_isAuthenticatedPosternWallet" stub returns false on Year-1
        // testnet, so the only allowed registrant is `user == msg.sender`.
        address key = makeAddr("session-key");
        vm.prank(hostile);
        vm.expectRevert("unauthorized");
        registry.recordIssued(user, key, block.timestamp + 1 days);
    }

    function test_recordIssued_rejectsDuplicateKey() public {
        address key = makeAddr("session-key");
        vm.prank(user);
        registry.recordIssued(user, key, block.timestamp + 1 days);

        vm.prank(user);
        vm.expectRevert("duplicate");
        registry.recordIssued(user, key, block.timestamp + 2 days);
    }

    function test_recordIssued_rejectsAlreadyExpiredTimestamp() public {
        // expiresAt must be strictly in the future.
        vm.warp(1_000);
        address key = makeAddr("session-key");
        vm.prank(user);
        vm.expectRevert("expired");
        registry.recordIssued(user, key, 1_000);
    }

    // ── markAllRevoked() ─────────────────────────────────────────────

    function test_markAllRevoked_onlyByKillSwitch() public {
        address key = makeAddr("session-key");
        vm.prank(user);
        registry.recordIssued(user, key, block.timestamp + 1 days);

        vm.prank(user);
        vm.expectRevert("kill-switch only");
        registry.markAllRevoked(user);

        vm.prank(hostile);
        vm.expectRevert("kill-switch only");
        registry.markAllRevoked(user);
    }

    function test_markAllRevoked_clearsEveryActiveKey() public {
        // Register three keys, then revoke all in one tx.
        address[] memory keys = new address[](3);
        keys[0] = makeAddr("session-key-1");
        keys[1] = makeAddr("session-key-2");
        keys[2] = makeAddr("session-key-3");

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(user);
            registry.recordIssued(user, keys[i], block.timestamp + 1 days);
        }
        assertEq(registry.activeKeyCount(user), 3, "expected 3 active before revoke");

        // Each revoke emits an event.
        for (uint256 i = 0; i < 3; i++) {
            vm.expectEmit(true, true, false, false, address(registry));
            emit SessionKeyRevoked(user, keys[i]);
        }

        vm.prank(killSwitch);
        registry.markAllRevoked(user);

        assertEq(registry.activeKeyCount(user), 0, "active list must be empty after revoke");
        for (uint256 i = 0; i < 3; i++) {
            assertFalse(registry.isActive(user, keys[i]), "isActive must be false");
        }
    }

    function test_markAllRevoked_isolatesPerUser() public {
        // Revoking userA's keys must not affect userB's keys.
        address userB = makeAddr("user-b");
        address keyA = makeAddr("key-a");
        address keyB = makeAddr("key-b");

        vm.prank(user);
        registry.recordIssued(user, keyA, block.timestamp + 1 days);
        vm.prank(userB);
        registry.recordIssued(userB, keyB, block.timestamp + 1 days);

        vm.prank(killSwitch);
        registry.markAllRevoked(user);

        assertFalse(registry.isActive(user, keyA), "user A revoked");
        assertTrue(registry.isActive(userB, keyB), "user B untouched");
    }

    // ── cleanExpired() ───────────────────────────────────────────────

    function test_cleanExpired_anyoneCanPrune() public {
        // Cleaner pattern — anyone can pay gas to prune expired keys.
        address keyShort = makeAddr("expiring-soon");
        address keyLong = makeAddr("expiring-later");

        vm.prank(user);
        registry.recordIssued(user, keyShort, block.timestamp + 1 hours);
        vm.prank(user);
        registry.recordIssued(user, keyLong, block.timestamp + 7 days);

        // Warp past the short key's expiry but not the long key's.
        vm.warp(block.timestamp + 2 hours);

        vm.expectEmit(true, true, false, false, address(registry));
        emit SessionKeyExpiredCleaned(user, keyShort);

        // Hostile can prune — no caller gate.
        vm.prank(hostile);
        registry.cleanExpired(user);

        assertFalse(registry.isActive(user, keyShort), "expired key cleaned");
        assertTrue(registry.isActive(user, keyLong), "fresh key untouched");
        assertEq(registry.activeKeyCount(user), 1, "active count must drop to 1");
    }

    function test_cleanExpired_noOpWhenNothingExpired() public {
        address key = makeAddr("session-key");
        vm.prank(user);
        registry.recordIssued(user, key, block.timestamp + 7 days);

        vm.prank(hostile);
        registry.cleanExpired(user);

        assertTrue(registry.isActive(user, key));
        assertEq(registry.activeKeyCount(user), 1);
    }

    function test_cleanExpired_pruneOrderDoesNotMisLabel() public {
        // The swap-and-pop algorithm could skip an entry if implemented
        // wrong (e.g. with `i++` after a swap). Verify three expired keys
        // in a row all get pruned in one pass.
        address[] memory keys = new address[](3);
        keys[0] = makeAddr("k-1");
        keys[1] = makeAddr("k-2");
        keys[2] = makeAddr("k-3");

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(user);
            registry.recordIssued(user, keys[i], block.timestamp + 1 hours);
        }

        vm.warp(block.timestamp + 2 hours);

        vm.prank(hostile);
        registry.cleanExpired(user);

        assertEq(registry.activeKeyCount(user), 0, "all three must be pruned in one pass");
        for (uint256 i = 0; i < 3; i++) {
            assertFalse(registry.isActive(user, keys[i]));
        }
    }

    // ── getActiveKeys() ──────────────────────────────────────────────

    function test_getActiveKeys_returnsCurrentList() public {
        address k1 = makeAddr("k-1");
        address k2 = makeAddr("k-2");
        vm.prank(user);
        registry.recordIssued(user, k1, block.timestamp + 1 days);
        vm.prank(user);
        registry.recordIssued(user, k2, block.timestamp + 1 days);

        address[] memory keys = registry.getActiveKeys(user);
        assertEq(keys.length, 2, "expected 2 active");
        assertEq(keys[0], k1);
        assertEq(keys[1], k2);
    }

    // ── Audit MMM-10 lock: constructor zero-check ────────────────────
    // Without this guard, deploying with `address(0)` for the kill-switch
    // dep would brick `markAllRevoked` forever — the registry can never
    // bulk-revoke session keys, defeating the Postern emergency design.

    function test_constructor_revertsOnZeroKillSwitch_MMM10() public {
        vm.expectRevert(bytes("zero kill switch"));
        new PosternKeyRegistry(address(0));
    }
}
