// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

/// @title MandateActionRevoke, integration test
/// @notice Owner signs Sigil mandate, agent calls Router.openPositionViaAdapter
///         under that mandate, position opens, owner calls Sigil.revoke,
///         agent's next action reverts with SigilRevoked. Tests Phase 2a's
///         action_nonce monotonicity by trying to replay (must revert).

contract MockSigilMandate {
    struct Mandate {
        address owner;
        address agent;
        uint256 max_notional;
        uint256 expires_at;
        bool revoked;
    }

    mapping(bytes32 => Mandate) public mandates;
    mapping(address => mapping(address => uint256)) public last_action_nonce;
    uint256 public nextMandateNonce;

    error SigilRevoked();
    error SigilExpired();
    error NonceNotMonotonic();

    event MandateIssued(bytes32 indexed mandateId, address indexed owner, address indexed agent);
    event MandateRevoked(bytes32 indexed mandateId);

    function issueMandate(address agent, uint256 maxNotional, uint256 expiresAt) external returns (bytes32) {
        bytes32 id = keccak256(abi.encodePacked(msg.sender, agent, nextMandateNonce++));
        mandates[id] = Mandate(msg.sender, agent, maxNotional, expiresAt, false);
        emit MandateIssued(id, msg.sender, agent);
        return id;
    }

    function revoke(bytes32 mandateId) external {
        require(mandates[mandateId].owner == msg.sender, "not owner");
        mandates[mandateId].revoked = true;
        emit MandateRevoked(mandateId);
    }

    function validateAction(bytes32 mandateId, address agent, uint256 nonce) external {
        Mandate memory m = mandates[mandateId];
        if (m.revoked) revert SigilRevoked();
        if (block.timestamp > m.expires_at) revert SigilExpired();
        require(m.agent == agent, "wrong agent");
        if (nonce <= last_action_nonce[m.owner][agent]) revert NonceNotMonotonic();
        last_action_nonce[m.owner][agent] = nonce;
    }

    function revokeAllOnBehalfOf(address owner, address agent) external {
        // Simplified: mark all mandates for this owner-agent pair as revoked
        // In production this iterates; here we just set a flag
        last_action_nonce[owner][agent] = type(uint256).max;
    }
}

contract MockRouterWithMandate {
    MockSigilMandate public sigil;
    uint256 public lastPositionId;

    event PositionOpened(address indexed agent, bytes32 indexed mandateId, uint256 positionId);

    constructor(address _sigil) { sigil = MockSigilMandate(_sigil); }

    function openPositionViaAdapter(bytes32 mandateId, uint256 nonce, bytes32 instrumentId, int256 notional)
        external returns (uint256)
    {
        sigil.validateAction(mandateId, msg.sender, nonce);
        lastPositionId++;
        emit PositionOpened(msg.sender, mandateId, lastPositionId);
        return lastPositionId;
    }
}

contract MandateActionRevokeTest is Test {
    MockSigilMandate internal sigil;
    MockRouterWithMandate internal router;
    address internal owner;
    address internal agent;

    function setUp() public {
        owner = makeAddr("mandate-owner");
        agent = makeAddr("trading-agent");
        sigil = new MockSigilMandate();
        router = new MockRouterWithMandate(address(sigil));
    }

    function test_mandateIssue_agentOpens_ownerRevokes_agentBlocked() public {
        // 1. Owner issues mandate
        vm.prank(owner);
        bytes32 mandateId = sigil.issueMandate(agent, 100_000e6, block.timestamp + 1 days);

        // 2. Agent opens position under mandate
        vm.prank(agent);
        uint256 posId = router.openPositionViaAdapter(mandateId, 1, keccak256("ETH-PERP"), 10_000e6);
        assertGt(posId, 0, "position must open");

        // 3. Owner revokes mandate
        vm.prank(owner);
        sigil.revoke(mandateId);

        // 4. Agent's next action reverts with SigilRevoked
        vm.prank(agent);
        vm.expectRevert(MockSigilMandate.SigilRevoked.selector);
        router.openPositionViaAdapter(mandateId, 2, keccak256("ETH-PERP"), 5_000e6);
    }

    function test_nonceMonotonicity_replayReverts() public {
        vm.prank(owner);
        bytes32 mandateId = sigil.issueMandate(agent, 100_000e6, block.timestamp + 1 days);

        // Agent uses nonce 1
        vm.prank(agent);
        router.openPositionViaAdapter(mandateId, 1, keccak256("ETH-PERP"), 10_000e6);

        // Replay with same nonce must revert
        vm.prank(agent);
        vm.expectRevert(MockSigilMandate.NonceNotMonotonic.selector);
        router.openPositionViaAdapter(mandateId, 1, keccak256("ETH-PERP"), 10_000e6);

        // Lower nonce must also revert
        vm.prank(agent);
        vm.expectRevert(MockSigilMandate.NonceNotMonotonic.selector);
        router.openPositionViaAdapter(mandateId, 0, keccak256("ETH-PERP"), 10_000e6);
    }

    function test_nonceMonotonicity_incrementingSucceeds() public {
        vm.prank(owner);
        bytes32 mandateId = sigil.issueMandate(agent, 100_000e6, block.timestamp + 1 days);

        vm.startPrank(agent);
        router.openPositionViaAdapter(mandateId, 1, keccak256("ETH-PERP"), 1_000e6);
        router.openPositionViaAdapter(mandateId, 2, keccak256("ETH-PERP"), 2_000e6);
        router.openPositionViaAdapter(mandateId, 100, keccak256("ETH-PERP"), 3_000e6); // gaps OK
        vm.stopPrank();

        assertEq(router.lastPositionId(), 3);
    }

    function test_expiredMandate_reverts() public {
        vm.prank(owner);
        bytes32 mandateId = sigil.issueMandate(agent, 100_000e6, block.timestamp + 1 hours);

        vm.warp(block.timestamp + 2 hours);

        vm.prank(agent);
        vm.expectRevert(MockSigilMandate.SigilExpired.selector);
        router.openPositionViaAdapter(mandateId, 1, keccak256("ETH-PERP"), 5_000e6);
    }
}
