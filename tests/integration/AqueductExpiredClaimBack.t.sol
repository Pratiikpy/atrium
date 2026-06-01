// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

/// @title AqueductExpiredClaimBack, integration test
/// @notice Send to dest, dest doesn't ack within window, source user calls
///         claimBack. Time-warp via vm.warp past expires_at. Asserts
///         CrossChainCredit.isClaimedBack flips, claimedBackAmountWei matches.

contract MockERC20Minimal {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract AqueductWithClaimBack {
    MockERC20Minimal public usdc;

    struct CrossChainCredit {
        address user;
        uint256 amountWei;
        uint64 destChain;
        uint256 expiresAt;
        bool isSettled;
        bool isClaimedBack;
        uint256 claimedBackAmountWei;
    }

    mapping(bytes32 => CrossChainCredit) public credits;
    mapping(bytes32 => bool) public hasDeliveryAck;
    uint256 private _nonce;

    event CreditSent(bytes32 indexed messageId, address indexed user, uint256 amount);
    event ClaimedBack(bytes32 indexed messageId, address indexed user, uint256 amount);

    error NotExpired();
    error AlreadySettled();
    error AlreadyClaimed();
    error DeliveryAckExists();
    error NotCreditOwner();

    constructor(address _usdc) { usdc = MockERC20Minimal(_usdc); }

    function send(uint256 amount, uint64 destChain, uint256 ttl) external returns (bytes32 messageId) {
        usdc.transferFrom(msg.sender, address(this), amount);
        messageId = keccak256(abi.encodePacked(msg.sender, _nonce++));
        credits[messageId] = CrossChainCredit(msg.sender, amount, destChain, block.timestamp + ttl, false, false, 0);
        emit CreditSent(messageId, msg.sender, amount);
    }

    function claimBack(bytes32 messageId) external {
        CrossChainCredit storage c = credits[messageId];
        if (c.user != msg.sender) revert NotCreditOwner();
        if (c.isSettled) revert AlreadySettled();
        if (c.isClaimedBack) revert AlreadyClaimed();
        if (hasDeliveryAck[messageId]) revert DeliveryAckExists();
        if (block.timestamp < c.expiresAt) revert NotExpired();

        c.isClaimedBack = true;
        c.claimedBackAmountWei = c.amountWei;
        usdc.transfer(msg.sender, c.amountWei);
        emit ClaimedBack(messageId, msg.sender, c.amountWei);
    }

    function setDeliveryAck(bytes32 messageId) external { hasDeliveryAck[messageId] = true; }
    function settle(bytes32 messageId) external { credits[messageId].isSettled = true; }
}

contract AqueductExpiredClaimBackTest is Test {
    AqueductWithClaimBack internal aqueduct;
    MockERC20Minimal internal usdc;
    address internal user;

    uint256 internal constant SEND_AMOUNT = 5_000e6;
    uint256 internal constant TTL = 1 days;

    function setUp() public {
        user = makeAddr("sender");
        usdc = new MockERC20Minimal();
        aqueduct = new AqueductWithClaimBack(address(usdc));

        usdc.mint(user, SEND_AMOUNT * 10);
        vm.prank(user);
        usdc.approve(address(aqueduct), type(uint256).max);
    }

    function test_claimBack_afterExpiry() public {
        vm.prank(user);
        bytes32 messageId = aqueduct.send(SEND_AMOUNT, 16015286601757825753, TTL);

        // Warp past expiry
        vm.warp(block.timestamp + TTL + 1);

        uint256 balBefore = usdc.balanceOf(user);
        vm.prank(user);
        aqueduct.claimBack(messageId);

        // Assert isClaimedBack flips
        (,,,,, bool claimed, uint256 claimedAmount) = aqueduct.credits(messageId);
        assertTrue(claimed, "isClaimedBack must be true");
        assertEq(claimedAmount, SEND_AMOUNT, "claimedBackAmountWei must match");
        assertEq(usdc.balanceOf(user), balBefore + SEND_AMOUNT, "user must receive funds back");
    }

    function test_claimBack_beforeExpiry_reverts() public {
        vm.prank(user);
        bytes32 messageId = aqueduct.send(SEND_AMOUNT, 16015286601757825753, TTL);

        // Still within TTL
        vm.prank(user);
        vm.expectRevert(AqueductWithClaimBack.NotExpired.selector);
        aqueduct.claimBack(messageId);
    }

    function test_claimBack_withDeliveryAck_reverts() public {
        vm.prank(user);
        bytes32 messageId = aqueduct.send(SEND_AMOUNT, 16015286601757825753, TTL);

        // Simulate delivery ack
        aqueduct.setDeliveryAck(messageId);

        vm.warp(block.timestamp + TTL + 1);

        vm.prank(user);
        vm.expectRevert(AqueductWithClaimBack.DeliveryAckExists.selector);
        aqueduct.claimBack(messageId);
    }

    function test_claimBack_alreadySettled_reverts() public {
        vm.prank(user);
        bytes32 messageId = aqueduct.send(SEND_AMOUNT, 16015286601757825753, TTL);

        aqueduct.settle(messageId);
        vm.warp(block.timestamp + TTL + 1);

        vm.prank(user);
        vm.expectRevert(AqueductWithClaimBack.AlreadySettled.selector);
        aqueduct.claimBack(messageId);
    }

    function test_claimBack_doubleClaimReverts() public {
        vm.prank(user);
        bytes32 messageId = aqueduct.send(SEND_AMOUNT, 16015286601757825753, TTL);

        vm.warp(block.timestamp + TTL + 1);

        vm.prank(user);
        aqueduct.claimBack(messageId);

        vm.prank(user);
        vm.expectRevert(AqueductWithClaimBack.AlreadyClaimed.selector);
        aqueduct.claimBack(messageId);
    }

    function test_claimBack_wrongUser_reverts() public {
        vm.prank(user);
        bytes32 messageId = aqueduct.send(SEND_AMOUNT, 16015286601757825753, TTL);

        vm.warp(block.timestamp + TTL + 1);

        vm.prank(makeAddr("attacker"));
        vm.expectRevert(AqueductWithClaimBack.NotCreditOwner.selector);
        aqueduct.claimBack(messageId);
    }
}
