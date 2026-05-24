// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AqueductClaimback
/// @notice Hardens the Aqueduct claim-back path against double-spend per Agent
///         B audit #12. The destination AqueductReceiver issues a `delivery_ack`
///         attestation back to the source chain via a follow-up CCIP message;
///         claim-back is only permitted if no ack has arrived by `expires_at`.
///
/// Year-1 testnet: in the absence of native CCIP backchannels for ack receipts,
/// the destination receiver writes the message_id into a single bytes32 storage
/// slot. Source-chain claim-back reads that slot via a cross-chain query through
/// the existing CCIP router (1 round-trip, ~3-5 min on testnet). The source
/// Aqueduct refuses `claim_back` if the ack is present.
interface IAqueductSource {
    function setDeliveryAck(bytes32 message_id) external;
    function hasDeliveryAck(bytes32 message_id) external view returns (bool);
}

/// Audit CCCC-1 fix: callback into Aqueduct so the source-chain credit's
/// `is_settled` state flips + `CrossChainCreditSettled` fires (subgraph
/// listener handleCrossChainCreditSettled was wired but the event was dead).
interface IAqueductSettle {
    function markSettled(bytes32 messageId) external;
}

contract AqueductClaimback is IAqueductSource {
    address public immutable aqueduct;
    address public immutable ccip_router;
    mapping(bytes32 => bool) private acks;

    error Unauthorized();

    event DeliveryAckReceived(bytes32 indexed message_id);

    constructor(address _aqueduct, address _ccip_router) {
        // Audit NNNN-1 fix (DDD-5 pattern, partial-coverage closer): zero
        // aqueduct → setDeliveryAck's markSettled callback dies via the
        // CCCC-1 code-length guard (silent soft-failure, ack still records);
        // zero ccip_router → onlyRouter check is always-false → no acks
        // ever land. Both bric path-of-deliveries are deploy-typo footguns.
        require(_aqueduct != address(0), "zero aqueduct");
        require(_ccip_router != address(0), "zero ccip router");
        aqueduct = _aqueduct;
        ccip_router = _ccip_router;
    }

    /// Called by the CCIP router on the source chain when the destination
    /// AqueductReceiver successfully credited the user. The router-level
    /// authentication is the same access-control surface used by Aqueduct
    /// itself; only the router can deliver ack messages.
    function setDeliveryAck(bytes32 message_id) external {
        if (msg.sender != ccip_router) revert Unauthorized();
        acks[message_id] = true;
        emit DeliveryAckReceived(message_id);
        // Audit CCCC-1: also flip the source-chain credit's is_settled state
        // by calling back to Aqueduct.markSettled. Two-stage guard:
        //  1. `aqueduct.code.length > 0` skips the call if aqueduct is an
        //     EOA (e.g. test fixtures with `makeAddr`). Solidity 0.8.10+'s
        //     extcodesize-check at the interface call site is NOT
        //     try/catch-wrappable — it reverts before the call expression
        //     evaluates inside try. Explicit guard handles this cleanly.
        //  2. `try { ... } catch` swallows any revert FROM the contract
        //     itself (CreditNotFound, paused, etc.) so the ack registry
        //     stays useful for claim_back gating even when the callback
        //     misses. The ack-storage step above already ran.
        if (aqueduct.code.length > 0) {
            try IAqueductSettle(aqueduct).markSettled(message_id) {
                // settled OK
            } catch {
                // soft failure — ack registry already wrote
            }
        }
    }

    function hasDeliveryAck(bytes32 message_id) external view returns (bool) {
        return acks[message_id];
    }
}
