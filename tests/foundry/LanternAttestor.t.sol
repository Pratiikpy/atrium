// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {LanternAttestor} from "../../contracts/lantern-attestor/src/LanternAttestor.sol";

/// @title LanternAttestor foundry test suite
/// @notice Lantern is the hourly proof-of-reserves root publisher.
///         Atrium PRD §22.3 + TDD §10.1 spec the gate: signing_key signs and
///         publishes; the Praetor timelock can rotate that key (audit F-32);
///         the contract refuses stale or out-of-order roots. This suite pins
///         every gate plus the on-chain inclusion-proof verifier so the
///         "verify your own balance" judge demo can never silently break.
contract LanternAttestorTest is Test {
    LanternAttestor internal lantern;
    address internal signingKey;
    address internal praetor;
    address internal timelock;
    address internal hostile;

    event AttestationPublished(
        bytes32 indexed root,
        uint256 block_number,
        uint256 timestamp,
        uint256 indexed leafCount,
        string ipfsCid
    );
    event SigningKeyRotated(address indexed previous, address indexed next);

    // Convenience defaults for tests that don't care about leafCount / ipfsCid
    // semantics. Real cron calls always pass meaningful values; these match
    // the on-chain ABI but stay terse at the call site.
    uint256 internal constant TEST_LEAF_COUNT = 0;
    string internal constant TEST_IPFS_CID = "QmTestIpfsCidPlaceholderForUnitTestsOnly0000";

    function setUp() public {
        signingKey = makeAddr("lantern-signing-key");
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        hostile = makeAddr("hostile");
        lantern = new LanternAttestor(signingKey, praetor, timelock);
    }

    // ── publish() gating ────────────────────────────────────────────────

    function test_publish_onlyBySigningKey() public {
        vm.prank(hostile);
        vm.expectRevert(LanternAttestor.Unauthorized.selector);
        lantern.publish(keccak256("root"), 1_000_000, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");
    }

    function test_publish_rejectsBlockEqualToLatest() public {
        vm.prank(signingKey);
        lantern.publish(keccak256("root-1"), 1_000_000, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");

        // Same block number must revert, strict-greater required.
        vm.prank(signingKey);
        vm.expectRevert(
            abi.encodeWithSelector(LanternAttestor.StaleAttestation.selector, uint64(1_000_000), uint64(1_000_000))
        );
        lantern.publish(keccak256("root-2"), 1_000_000, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");
    }

    function test_publish_rejectsOlderBlock() public {
        vm.prank(signingKey);
        lantern.publish(keccak256("root-newer"), 2_000_000, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");

        vm.prank(signingKey);
        vm.expectRevert(
            abi.encodeWithSelector(LanternAttestor.StaleAttestation.selector, uint64(2_000_000), uint64(1_999_999))
        );
        lantern.publish(keccak256("root-older"), 1_999_999, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");
    }

    function test_publish_happyPath_emitsEvent() public {
        bytes32 root = keccak256("first-real-root");
        uint256 blk = 5_000_000;
        uint256 leafCount = 42;
        string memory cid = "QmRealCidEmittedByTheCronInThisTest012345678";

        vm.warp(1_700_000_000); // pin block.timestamp so the event payload is deterministic
        // checkTopic1 + checkTopic2 (root + leafCount), checkData (timestamp + ipfsCid)
        vm.expectEmit(true, true, false, true, address(lantern));
        emit AttestationPublished(root, blk, 1_700_000_000, leafCount, cid);

        vm.prank(signingKey);
        lantern.publish(root, blk, leafCount, cid, hex"");

        assertEq(lantern.latest_root(), root, "root not stored");
        assertEq(uint256(lantern.latest_block()), blk, "block not stored");
    }

    function test_publish_overwritesRootOnNewerBlock() public {
        vm.prank(signingKey);
        lantern.publish(keccak256("first"), 100, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");

        vm.prank(signingKey);
        lantern.publish(keccak256("second"), 200, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");

        assertEq(lantern.latest_root(), keccak256("second"), "newer root must win");
        assertEq(uint256(lantern.latest_block()), 200);
    }

    /// Phase zeta.1 fix: the event must carry leafCount + ipfsCid so the
    /// verify-app's inclusion-proof flow + the dashboard can lookup the
    /// pinned tree without a second on-chain read. Tests the event payload
    /// shape so a future refactor that drops the new fields fails CI loudly
    /// instead of silently bricking /verify/6.
    function test_publish_carries_leafCount_and_ipfsCid_in_event() public {
        bytes32 root = keccak256("payload-shape-pin");
        uint256 blk = 7_000_000;
        uint256 leafCount = 12345;
        string memory cid = "bafybeicGdRzNoneIndexedRealCidThatTheRouteParses";
        vm.warp(1_750_000_000);
        vm.expectEmit(true, true, false, true, address(lantern));
        emit AttestationPublished(root, blk, 1_750_000_000, leafCount, cid);
        vm.prank(signingKey);
        lantern.publish(root, blk, leafCount, cid, hex"");
    }

    // ── rotateSigningKey() gating ───────────────────────────────────────

    function test_rotateSigningKey_onlyTimelock() public {
        // Direct multisig call is rejected, only the timelock contract can
        // rotate. Forces the 48h objection window for every key rotation.
        vm.prank(praetor);
        vm.expectRevert(LanternAttestor.Unauthorized.selector);
        lantern.rotateSigningKey(makeAddr("next-key"));

        vm.prank(hostile);
        vm.expectRevert(LanternAttestor.Unauthorized.selector);
        lantern.rotateSigningKey(makeAddr("next-key"));
    }

    function test_rotateSigningKey_happyPath() public {
        address next = makeAddr("rotated-signing-key");

        vm.expectEmit(true, true, false, false, address(lantern));
        emit SigningKeyRotated(signingKey, next);

        vm.prank(timelock);
        lantern.rotateSigningKey(next);

        assertEq(lantern.signing_key(), next, "rotation did not persist");

        // The previous key can no longer publish.
        vm.prank(signingKey);
        vm.expectRevert(LanternAttestor.Unauthorized.selector);
        lantern.publish(keccak256("post-rotation"), 1, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");

        // The new key can.
        vm.prank(next);
        lantern.publish(keccak256("post-rotation"), 1, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");
        assertEq(lantern.latest_root(), keccak256("post-rotation"));
    }

    // ── verifyInclusion() ─────────────────────────────────────────────

    function test_verifyInclusion_singleLeafRoot() public {
        // Audit FIRE77-L1 fix: leaves are double-hashed at the leaf-vs-
        // interior-node boundary. The root of a single-leaf tree is the
        // SECOND hash of the leaf, not the leaf itself.
        bytes32 leaf = keccak256(abi.encodePacked(address(0xAB), uint256(100e6)));
        bytes32 leafHashed = keccak256(bytes.concat(leaf));
        vm.prank(signingKey);
        lantern.publish(leafHashed, 1, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");

        assertTrue(lantern.verifyInclusion(leaf, new bytes32[](0)), "single-leaf proof must verify");
    }

    function test_verifyInclusion_twoLeafTree() public {
        // Audit FIRE77-L1 fix: hash convention is now
        //   nodeForLeaf = keccak256(leaf)   <-- double-hash leaf-vs-node
        //   root = sortedPair(nodeForA, nodeForB)
        bytes32 leafA = keccak256("alice-balance");
        bytes32 leafB = keccak256("bob-balance");
        bytes32 nodeA = keccak256(bytes.concat(leafA));
        bytes32 nodeB = keccak256(bytes.concat(leafB));
        bytes32 root = nodeA < nodeB
            ? keccak256(abi.encodePacked(nodeA, nodeB))
            : keccak256(abi.encodePacked(nodeB, nodeA));

        vm.prank(signingKey);
        lantern.publish(root, 10, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");

        bytes32[] memory proofForA = new bytes32[](1);
        proofForA[0] = nodeB;
        assertTrue(lantern.verifyInclusion(leafA, proofForA), "alice's proof must verify");

        bytes32[] memory proofForB = new bytes32[](1);
        proofForB[0] = nodeA;
        assertTrue(lantern.verifyInclusion(leafB, proofForB), "bob's proof must verify");
    }

    /// FIRE77-L1, second-preimage attack must be rejected.
    function test_verifyInclusion_rejectsInteriorNodeAsLeaf_FIRE77_L1() public {
        bytes32 leafA = keccak256("alice-balance");
        bytes32 leafB = keccak256("bob-balance");
        bytes32 nodeA = keccak256(bytes.concat(leafA));
        bytes32 nodeB = keccak256(bytes.concat(leafB));
        bytes32 root = nodeA < nodeB
            ? keccak256(abi.encodePacked(nodeA, nodeB))
            : keccak256(abi.encodePacked(nodeB, nodeA));

        vm.prank(signingKey);
        lantern.publish(root, 10, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");

        // Attacker submits `nodeA` (an interior node) AS the leaf, with an
        // empty proof and the root being itself. Pre-fix, this would verify
        // because the verifier hashed `leaf` indistinguishably from a node.
        // Post-fix, the verifier double-hashes `leaf` so the computed root
        // becomes keccak256(nodeA) ≠ actual root. Attack rejected.
        assertFalse(
            lantern.verifyInclusion(nodeA, new bytes32[](0)),
            "FIRE77-L1: interior-node-as-leaf must NOT verify"
        );
    }

    function test_verifyInclusion_rejectsTamperedLeaf() public {
        bytes32 leafA = keccak256("real-balance");
        bytes32 leafB = keccak256("sibling");
        bytes32 nodeA = keccak256(bytes.concat(leafA));
        bytes32 nodeB = keccak256(bytes.concat(leafB));
        bytes32 root = nodeA < nodeB
            ? keccak256(abi.encodePacked(nodeA, nodeB))
            : keccak256(abi.encodePacked(nodeB, nodeA));

        vm.prank(signingKey);
        lantern.publish(root, 10, TEST_LEAF_COUNT, TEST_IPFS_CID, hex"");

        // Hostile leaf with the same sibling must not verify, the judge demo
        // hinges on this being unforgeable.
        bytes32 tampered = keccak256("inflated-balance");
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = nodeB;
        assertFalse(lantern.verifyInclusion(tampered, proof), "tampered leaf must not verify");
    }

    function test_verifyInclusion_emptyRoot_rejectsAnyLeaf() public {
        // Before any attestation is published, `latest_root` is zero. A real
        // leaf must not coincidentally verify against the zero root.
        bytes32 leaf = keccak256("any");
        assertFalse(lantern.verifyInclusion(leaf, new bytes32[](0)), "leaf must not verify against zero root");
    }

    // ── Audit BBBBB-1 lock: constructor zero-checks ──────────────────
    //
    // Found by the test-coverage sweep: LanternAttestor had no constructor
    // zero-checks at all, breaking the DDD-5 / MMM-10 / LLL-1 pattern of
    // failing loud at deploy time. The most dangerous branch:
    // `_praetor_timelock = 0` would permanently brick rotateSigningKey
    // because msg.sender == address(0) is structurally impossible.

    function test_constructor_revertsOnZeroSigningKey_BBBBB1() public {
        vm.expectRevert(bytes("zero signing key"));
        new LanternAttestor(address(0), praetor, timelock);
    }

    function test_constructor_revertsOnZeroPraetor_BBBBB1() public {
        vm.expectRevert(bytes("zero praetor"));
        new LanternAttestor(signingKey, address(0), timelock);
    }

    function test_constructor_revertsOnZeroTimelock_BBBBB1() public {
        // The load-bearing one: pre-fix, deploying with timelock=0 would
        // permanently brick rotateSigningKey, leaving the contract unable
        // to recover from a compromised signing_key.
        vm.expectRevert(bytes("zero timelock"));
        new LanternAttestor(signingKey, praetor, address(0));
    }

    // ── Audit iteration 43 lock: rotateSigningKey zero + no-op guards ─
    //
    // Constructor's BBBBB-1 fix guards `_signing_key != address(0)` but
    // the rotate setter had the same risk without the same guard, a
    // Praetor multisig accidentally scheduling a rotation to zero would
    // brick publish() (msg.sender is never address(0)) for 48h (timelock
    // recovery) + 48h (next rotation landing). 96h of broken attestations
    // during demo / launch. Partial-coverage class same as iter 18.

    function test_rotateSigningKey_rejectsZeroAddress_iter43() public {
        vm.prank(timelock);
        vm.expectRevert(LanternAttestor.ZeroAddressKey.selector);
        lantern.rotateSigningKey(address(0));
    }

    function test_rotateSigningKey_rejectsNoOpRotation_iter43() public {
        // Praetor accidentally schedules a rotation to the current key
        // (typo / copy-paste from the wrong column). Pre-fix this would
        // succeed and emit a misleading SigningKeyRotated event, wasting
        // a timelock slot. Now: reject with NoOpRotation.
        vm.prank(timelock);
        vm.expectRevert(LanternAttestor.NoOpRotation.selector);
        lantern.rotateSigningKey(signingKey);
    }

    // ── Iter 99: fuzz invariants on verifyInclusion ─────────────────

    /// Invariant: with latest_root = 0 (no attestation published), no leaf
    /// + empty proof can verify (would require keccak collision with 0).
    /// 256 random leaves all reject.
    function testFuzz_verifyInclusion_emptyRoot_rejectsAllLeaves_iter99(bytes32 leaf) public view {
        // latest_root is still bytes32(0) since setUp doesn't publish.
        bool ok = lantern.verifyInclusion(leaf, new bytes32[](0));
        assertFalse(ok, "iter99: no leaf may verify against the zero root");
    }

    /// Invariant: empty-proof case verifies iff keccak256(bytes.concat(leaf))
    /// equals latest_root. Publish a known leaf-hash as root, then verify
    /// THE pre-image leaf passes, ALL OTHER random leaves fail.
    function testFuzz_verifyInclusion_singleLeafTree_onlyMatchingLeafVerifies_iter99(
        bytes32 realLeaf,
        bytes32 randomLeaf
    ) public {
        vm.assume(realLeaf != randomLeaf);
        // For a single-leaf tree, the root is keccak256(bytes.concat(leaf))
        // (the double-hash of the leaf at the tree boundary).
        bytes32 root = keccak256(bytes.concat(realLeaf));
        vm.prank(signingKey);
        lantern.publish(root, 1, TEST_LEAF_COUNT, TEST_IPFS_CID, "");

        // Real leaf with empty proof verifies.
        assertTrue(lantern.verifyInclusion(realLeaf, new bytes32[](0)),
            "iter99: real leaf must verify against its own keccak root");
        // Random leaf with empty proof rejects (collision-free).
        assertFalse(lantern.verifyInclusion(randomLeaf, new bytes32[](0)),
            "iter99: random leaf must NOT verify against unrelated root");
    }
}
