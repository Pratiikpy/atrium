// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {AqueductClaimback} from "../../contracts/aqueduct/src/AqueductClaimback.sol";

/// @title AqueductClaimback foundry test suite
/// @notice Hardens the cross-chain double-spend defense per Agent B audit #12.
///         The destination AqueductReceiver writes an ack into this contract
///         via the CCIP router on the source chain. Source-chain `claim_back`
///         must read `hasDeliveryAck` before refunding — if an ack exists, the
///         claim-back path is closed.
///
///         This suite pins: only the router can write acks; reads return false
///         for unknown messages; once set, the flag is observable for the
///         source Aqueduct to gate its claim-back path.
contract AqueductClaimbackTest is Test {
    AqueductClaimback internal claimback;
    address internal aqueduct;
    address internal ccipRouter;
    address internal hostile;

    event DeliveryAckReceived(bytes32 indexed message_id);

    function setUp() public {
        aqueduct = makeAddr("aqueduct-source");
        ccipRouter = makeAddr("ccip-router");
        hostile = makeAddr("hostile");
        claimback = new AqueductClaimback(aqueduct, ccipRouter);
    }

    function test_setDeliveryAck_onlyByRouter() public {
        bytes32 messageId = keccak256("msg-1");

        // Aqueduct itself is NOT the router. The router is the ONLY authorized
        // ack-writer (cross-chain authenticator). Any other caller, including
        // the source Aqueduct contract, must be rejected.
        vm.prank(aqueduct);
        vm.expectRevert(AqueductClaimback.Unauthorized.selector);
        claimback.setDeliveryAck(messageId);

        vm.prank(hostile);
        vm.expectRevert(AqueductClaimback.Unauthorized.selector);
        claimback.setDeliveryAck(messageId);
    }

    function test_setDeliveryAck_router_happyPath_emitsAndPersists() public {
        bytes32 messageId = keccak256("real-delivery-ack");

        vm.expectEmit(true, false, false, false, address(claimback));
        emit DeliveryAckReceived(messageId);

        vm.prank(ccipRouter);
        claimback.setDeliveryAck(messageId);

        assertTrue(claimback.hasDeliveryAck(messageId), "ack must persist for source-chain reads");
    }

    function test_hasDeliveryAck_defaultsFalse() public view {
        // An unknown message id must report false — the source Aqueduct
        // must treat "no ack received" as "claim-back still permitted".
        assertFalse(claimback.hasDeliveryAck(keccak256("never-acked")));
        assertFalse(claimback.hasDeliveryAck(bytes32(0)));
    }

    function test_setDeliveryAck_multipleMessagesIsolated() public {
        bytes32 messageA = keccak256("msg-a");
        bytes32 messageB = keccak256("msg-b");

        vm.prank(ccipRouter);
        claimback.setDeliveryAck(messageA);

        assertTrue(claimback.hasDeliveryAck(messageA), "A must be true");
        assertFalse(claimback.hasDeliveryAck(messageB), "B must remain false");

        vm.prank(ccipRouter);
        claimback.setDeliveryAck(messageB);

        assertTrue(claimback.hasDeliveryAck(messageA), "A must still be true");
        assertTrue(claimback.hasDeliveryAck(messageB), "B must now be true");
    }

    function test_setDeliveryAck_idempotent() public {
        // Re-acking the same message should not revert. CCIP may retry the
        // ack delivery; if it lands twice the second call is a no-op write.
        bytes32 messageId = keccak256("retry-ack");

        vm.prank(ccipRouter);
        claimback.setDeliveryAck(messageId);

        // Second call from the router must not revert.
        vm.prank(ccipRouter);
        claimback.setDeliveryAck(messageId);

        assertTrue(claimback.hasDeliveryAck(messageId));
    }

    function test_immutables_aqueductAndRouterPersist() public view {
        assertEq(claimback.aqueduct(), aqueduct);
        assertEq(claimback.ccip_router(), ccipRouter);
    }

    // ── Constructor zero-checks (audit NNNN-1) ───────────────────────
    // Audit TTTT-1: NNNN-1 added two `require(_X != address(0))` guards
    // to the AqueductClaimback constructor. Pin both revert branches.

    function test_constructor_revertsOnZeroAqueduct() public {
        vm.expectRevert(bytes("zero aqueduct"));
        new AqueductClaimback(address(0), ccipRouter);
    }

    function test_constructor_revertsOnZeroCcipRouter() public {
        vm.expectRevert(bytes("zero ccip router"));
        new AqueductClaimback(aqueduct, address(0));
    }
}
