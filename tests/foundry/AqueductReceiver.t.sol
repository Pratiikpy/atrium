// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {
    AqueductReceiver,
    CCIPReceiverBase,
    IAny2EVMMessageReceiver
} from "../../contracts/aqueduct/src/AqueductReceiver.sol";

/// @title AqueductReceiver foundry test suite
/// @notice Closes the destination-side of the CCIP roundtrip (Aqueduct's
///         counterpart). Verifies:
///           - onlyRouter gates `ccipReceive` (audit B-13)
///           - source-aqueduct allowlist gates which senders are accepted
///           - replay protection via `processed[messageId]`
///           - USDC parsed from `destTokenAmounts` (audit B-6/F-4 fix)
///           - claim-back-ack emitted to the registered registry (audit B-12)
///           - admin setters gated by timelock
contract AqueductReceiverTest is Test {
    AqueductReceiver internal receiver;
    address internal router;
    address internal praetor;
    address internal timelock;
    address internal hostile;
    address internal sourceAq;
    address internal destUser;
    MockUSDC internal usdc;

    function setUp() public {
        router = makeAddr("router");
        praetor = makeAddr("praetor");
        timelock = makeAddr("timelock");
        hostile = makeAddr("hostile");
        sourceAq = makeAddr("sourceAqueduct");
        destUser = makeAddr("destUser");
        usdc = new MockUSDC();
        // coffer_or_zero = 0 → receiver forwards via plain `transfer` (no Coffer path).
        receiver = new AqueductReceiver(router, address(usdc), address(0), praetor, timelock);
    }

    // ── onlyRouter / onlyTimelock gates ──────────────────────────────

    function test_ccipReceive_rejectsNonRouter() public {
        IAny2EVMMessageReceiver.Any2EVMMessage memory msg_ = _emptyMsg();
        vm.prank(hostile);
        // `InvalidRouter` is declared on the abstract `CCIPReceiverBase`
        // parent, not on the AqueductReceiver child. Reference the base
        // directly so the selector matches the on-chain selector.
        vm.expectRevert(abi.encodeWithSelector(CCIPReceiverBase.InvalidRouter.selector, hostile));
        receiver.ccipReceive(msg_);
    }

    function test_setAllowedSource_onlyTimelock() public {
        vm.prank(praetor);
        vm.expectRevert(AqueductReceiver.Unauthorized.selector);
        receiver.setAllowedSource(1, sourceAq);

        vm.prank(timelock);
        receiver.setAllowedSource(1, sourceAq);
        assertEq(receiver.allowedSourceAqueduct(1), sourceAq);
    }

    function test_setSourceClaimbackRegistry_onlyTimelock() public {
        address registry = makeAddr("registry");
        vm.prank(praetor);
        vm.expectRevert(AqueductReceiver.Unauthorized.selector);
        receiver.setSourceClaimbackRegistry(1, registry);

        vm.prank(timelock);
        receiver.setSourceClaimbackRegistry(1, registry);
        assertEq(receiver.sourceClaimbackRegistry(1), registry);
    }

    // ── Happy path: source allowed, USDC in payload, dest credited ──

    function test_ccipReceive_creditsDestUserOnSuccess() public {
        // Register allowed source
        vm.prank(timelock);
        receiver.setAllowedSource(1, sourceAq);

        // Pre-fund receiver with USDC (CCIP router would normally mint/forward)
        usdc.mint(address(receiver), 1_000_000);

        IAny2EVMMessageReceiver.Any2EVMMessage memory msg_ = _buildMsg(
            keccak256("msg1"),
            1, // source chain selector
            sourceAq,
            destUser,
            block.timestamp + 1 hours,
            address(usdc),
            1_000_000
        );

        vm.prank(router);
        receiver.ccipReceive(msg_);

        assertEq(usdc.balanceOf(destUser), 1_000_000, "destUser not credited");
        assertTrue(receiver.processed(keccak256("msg1")), "messageId not marked processed");
    }

    function test_ccipReceive_rejectsUnknownSource() public {
        IAny2EVMMessageReceiver.Any2EVMMessage memory msg_ = _buildMsg(
            keccak256("msg2"),
            1,
            hostile, // sender NOT in allowlist
            destUser,
            block.timestamp + 1 hours,
            address(usdc),
            1_000_000
        );
        vm.prank(router);
        vm.expectRevert(abi.encodeWithSelector(AqueductReceiver.UnknownSource.selector, uint64(1), hostile));
        receiver.ccipReceive(msg_);
    }

    function test_ccipReceive_rejectsReplay() public {
        vm.prank(timelock);
        receiver.setAllowedSource(1, sourceAq);
        usdc.mint(address(receiver), 2_000_000);

        IAny2EVMMessageReceiver.Any2EVMMessage memory msg_ = _buildMsg(
            keccak256("msg3"),
            1,
            sourceAq,
            destUser,
            block.timestamp + 1 hours,
            address(usdc),
            1_000_000
        );
        vm.prank(router);
        receiver.ccipReceive(msg_);

        vm.prank(router);
        vm.expectRevert(abi.encodeWithSelector(AqueductReceiver.AlreadyProcessed.selector, keccak256("msg3")));
        receiver.ccipReceive(msg_);
    }

    function test_ccipReceive_rejectsEmptyUsdcPayload() public {
        vm.prank(timelock);
        receiver.setAllowedSource(1, sourceAq);

        // destTokenAmounts contains a non-USDC token → received == 0 → revert
        IAny2EVMMessageReceiver.Any2EVMMessage memory msg_ = _buildMsg(
            keccak256("msg4"),
            1,
            sourceAq,
            destUser,
            block.timestamp + 1 hours,
            makeAddr("wrongToken"),
            1_000_000
        );
        vm.prank(router);
        vm.expectRevert(AqueductReceiver.NoUsdcInPayload.selector);
        receiver.ccipReceive(msg_);
    }

    function test_ccipReceive_emitsClaimbackAckWhenRegistryRegistered() public {
        address registry = makeAddr("registry");
        vm.startPrank(timelock);
        receiver.setAllowedSource(1, sourceAq);
        receiver.setSourceClaimbackRegistry(1, registry);
        vm.stopPrank();

        usdc.mint(address(receiver), 1_000_000);

        IAny2EVMMessageReceiver.Any2EVMMessage memory msg_ = _buildMsg(
            keccak256("msg5"),
            1,
            sourceAq,
            destUser,
            block.timestamp + 1 hours,
            address(usdc),
            1_000_000
        );

        vm.expectEmit(true, true, false, true, address(receiver));
        emit AqueductReceiver.DeliveryAckQueued(keccak256("msg5"), registry);
        vm.prank(router);
        receiver.ccipReceive(msg_);
    }

    // ── Audit GGG-2 lock: rescue-path transfer fail surfaces revert ──
    //
    // The else-branch (coffer_or_zero == 0 OR credit expired) used to call
    // `IERC20(usdc).transfer(dest_user, received)` and discard the return.
    // A Tether-style false return would have marked `processed[messageId]
    // = true` while never delivering the USDC. The fix added the return-
    // value check. This test pins it with one critical caveat: because the
    // revert happens AFTER `processed[...] = true` (which is set at line
    // 114, BEFORE the transfer at line 139), the revert MUST roll back
    // that storage write or the user can't retry. EVM atomic-revert
    // semantics guarantee this — but the assertion makes the property
    // visible to a future reader.

    function test_ccipReceive_revertsAndRollsBackOnTransferReturnsFalse() public {
        vm.prank(timelock);
        receiver.setAllowedSource(1, sourceAq);

        usdc.mint(address(receiver), 1_000_000);
        usdc.setTransferReturnsFalse(true);

        bytes32 mid = keccak256("vvvv-1-fail");
        IAny2EVMMessageReceiver.Any2EVMMessage memory msg_ = _buildMsg(
            mid, 1, sourceAq, destUser, block.timestamp + 1 hours, address(usdc), 1_000_000
        );

        vm.prank(router);
        vm.expectRevert(abi.encodeWithSelector(AqueductReceiver.UsdcTransferFailed.selector, destUser, uint256(1_000_000)));
        receiver.ccipReceive(msg_);

        // Load-bearing assertion: processed[mid] must NOT be set, otherwise
        // CCIP can never retry delivery and the user's USDC is permanently
        // stuck on the source chain (claim_back path on source already gated
        // by hasDeliveryAck, which never gets set if this path never lands).
        assertFalse(receiver.processed(mid), "transfer-fail must NOT mark messageId processed");
        assertEq(usdc.balanceOf(destUser), 0, "user balance must NOT move on failure");
    }

    function test_ccipReceive_rescuePathExpiredCredit_alsoRevertsOnTransferFail() public {
        // Same fix applies to the expired-credit branch (coffer_or_zero set
        // but block.timestamp > expires_at). Construct a credit with expiry
        // in the past — receiver falls into the else-branch.
        vm.prank(timelock);
        receiver.setAllowedSource(1, sourceAq);
        usdc.mint(address(receiver), 1_000_000);
        usdc.setTransferReturnsFalse(true);

        // Move forward in time first so expires_at is in the past.
        vm.warp(block.timestamp + 2 hours);
        uint256 expired = block.timestamp - 1;

        bytes32 mid = keccak256("vvvv-1-expired");
        IAny2EVMMessageReceiver.Any2EVMMessage memory msg_ = _buildMsg(
            mid, 1, sourceAq, destUser, expired, address(usdc), 1_000_000
        );

        vm.prank(router);
        vm.expectRevert(abi.encodeWithSelector(AqueductReceiver.UsdcTransferFailed.selector, destUser, uint256(1_000_000)));
        receiver.ccipReceive(msg_);

        assertFalse(receiver.processed(mid), "expired-credit transfer-fail must NOT mark processed");
    }

    // ── helpers ──────────────────────────────────────────────────────

    function _emptyMsg() internal pure returns (IAny2EVMMessageReceiver.Any2EVMMessage memory m) {
        m.messageId = bytes32(0);
        m.sourceChainSelector = 0;
        m.sender = abi.encode(address(0));
        m.data = abi.encode(address(0), uint256(0), address(0));
        m.destTokenAmounts = new IAny2EVMMessageReceiver.EVMTokenAmount[](0);
    }

    function _buildMsg(
        bytes32 messageId,
        uint64 source,
        address senderAddr,
        address dest,
        uint256 expires,
        address token,
        uint256 amount
    ) internal pure returns (IAny2EVMMessageReceiver.Any2EVMMessage memory m) {
        m.messageId = messageId;
        m.sourceChainSelector = source;
        m.sender = abi.encode(senderAddr);
        m.data = abi.encode(dest, expires, address(0));
        m.destTokenAmounts = new IAny2EVMMessageReceiver.EVMTokenAmount[](1);
        m.destTokenAmounts[0] = IAny2EVMMessageReceiver.EVMTokenAmount({ token: token, amount: amount });
    }

    // ── Audit iteration 46 lock: constructor zero-checks ──────────────
    //
    // AqueductReceiver pre-fix accepted any address for 4 of 5 constructor
    // params (only _coffer_or_zero is intentionally zero-allowed for testnet
    // bootstrap). Worst-case _praetor_timelock=0 leaves the contract
    // permanently unconfigurable — setAllowedSource + setSourceClaimbackRegistry
    // are both onlyTimelock and msg.sender can never equal address(0) on EVM.
    // Same DDD-5 / NNNN-1 / BBBBB-1 / LLL-1 partial-coverage pattern.

    function test_constructor_revertsOnZeroRouter_iter46() public {
        // The parent CCIPReceiverBase reverts with InvalidRouter(address(0))
        // BEFORE our body runs. Lock that contract — the property we need
        // is "zero router rejected at deploy"; the specific selector lives
        // in the parent and we don't duplicate the require to avoid
        // ambiguity with the parent's error message.
        vm.expectRevert();
        new AqueductReceiver(address(0), address(usdc), address(0), praetor, timelock);
    }

    function test_constructor_revertsOnZeroUsdc_iter46() public {
        vm.expectRevert(bytes("zero usdc"));
        new AqueductReceiver(router, address(0), address(0), praetor, timelock);
    }

    function test_constructor_revertsOnZeroPraetor_iter46() public {
        vm.expectRevert(bytes("zero praetor"));
        new AqueductReceiver(router, address(usdc), address(0), address(0), timelock);
    }

    function test_constructor_revertsOnZeroTimelock_iter46() public {
        // Load-bearing case: pre-fix this branch made the contract
        // permanently unconfigurable. Cross-chain trust setters were
        // forever bricked.
        vm.expectRevert(bytes("zero timelock"));
        new AqueductReceiver(router, address(usdc), address(0), praetor, address(0));
    }

    function test_constructor_allowsZeroCoffer_iter46() public {
        // Intentional: testnet bootstrap may deploy AqueductReceiver
        // before Coffer ships. Zero-coffer means CCIP-received USDC stays
        // in the receiver contract until the Coffer wire-up lands.
        AqueductReceiver r = new AqueductReceiver(router, address(usdc), address(0), praetor, timelock);
        assertEq(r.coffer_or_zero(), address(0), "coffer_or_zero should accept zero");
    }

    // ── Iter 92: emit assertions for CrossChainCreditReceived + setters ──
    //
    // CrossChainCreditReceived is the dest-side credit-arrival event.
    // When a destination-chain subgraph ships, this is the canonical
    // record of every successful delivery. A dropped emit would
    // silently make every delivered credit invisible to the dest-side
    // indexer. SourceAqueductSet + SourceClaimbackRegistrySet are
    // timelock rotations indexed for ops dashboards.

    event CrossChainCreditReceived(
        bytes32 indexed message_id,
        uint64 indexed source_chain,
        address dest_user,
        uint256 amount_wei
    );
    event SourceAqueductSet(uint64 indexed chain_selector, address aqueduct);
    event SourceClaimbackRegistrySet(uint64 indexed chain_selector, address registry);

    function test_ccipReceive_emitsCrossChainCreditReceived_iter92() public {
        vm.prank(timelock);
        receiver.setAllowedSource(1, sourceAq);
        usdc.mint(address(receiver), 1_000_000);

        bytes32 mid = keccak256("iter92-received");
        IAny2EVMMessageReceiver.Any2EVMMessage memory msg_ = _buildMsg(
            mid, 1, sourceAq, destUser, block.timestamp + 1 hours, address(usdc), 1_000_000
        );

        vm.expectEmit(true, true, false, true, address(receiver));
        emit CrossChainCreditReceived(mid, 1, destUser, 1_000_000);

        vm.prank(router);
        receiver.ccipReceive(msg_);
    }

    function test_setAllowedSource_emitsRotationEvent_iter92() public {
        address aq = makeAddr("rotated-source-aq");
        vm.expectEmit(true, false, false, true, address(receiver));
        emit SourceAqueductSet(7, aq);
        vm.prank(timelock);
        receiver.setAllowedSource(7, aq);
    }

    function test_setSourceClaimbackRegistry_emitsRotationEvent_iter92() public {
        address reg = makeAddr("rotated-claimback-registry");
        vm.expectEmit(true, false, false, true, address(receiver));
        emit SourceClaimbackRegistrySet(7, reg);
        vm.prank(timelock);
        receiver.setSourceClaimbackRegistry(7, reg);
    }

    // ── Iter 85: pin expires_at inclusive boundary (Coffer vs rescue) ─

    /// AqueductReceiver._ccipReceive routes to Coffer when
    /// `block.timestamp <= expires_at`. At exactly the boundary the
    /// inclusive `<=` keeps the credit on the Coffer path. A future
    /// "consistency cleanup" toward strict `<` would silently route
    /// at-boundary credits to the rescue path one second early — the
    /// user-facing UX surprise of "credit expired one second before
    /// the dashboard said it would."
    function test_ccipReceive_atExactExpiresAt_routesToCoffer_iter85() public {
        // Build a fresh receiver with a non-zero MockCoffer so the
        // Coffer branch is reachable.
        MockCoffer coffer = new MockCoffer(address(usdc));
        AqueductReceiver r = new AqueductReceiver(
            router, address(usdc), address(coffer), praetor, timelock
        );
        vm.prank(timelock);
        r.setAllowedSource(1, sourceAq);
        usdc.mint(address(r), 1_000_000);

        // expires_at = now exactly. The condition `block.timestamp <= expires_at`
        // evaluates true → Coffer path.
        uint256 expires = block.timestamp;
        IAny2EVMMessageReceiver.Any2EVMMessage memory msg_ = _buildMsg(
            keccak256("iter85-boundary"),
            1,
            sourceAq,
            destUser,
            expires,
            address(usdc),
            1_000_000
        );

        vm.prank(router);
        r.ccipReceive(msg_);

        // Load-bearing: Coffer.deposit was called (1 USDC at destUser),
        // NOT direct transfer to destUser. destUser balance stays 0.
        assertEq(usdc.balanceOf(destUser), 0, "iter85: boundary credit must NOT land in destUser via rescue");
        assertEq(coffer.lastDepositAmount(), 1_000_000, "iter85: Coffer.deposit must have been called");
        assertEq(coffer.lastDepositOnBehalf(), destUser, "iter85: deposit target = destUser");
    }

    /// One second past expiry → rescue path. Confirms the asymmetry:
    /// boundary is inclusive on the Coffer side, exclusive on the rescue.
    function test_ccipReceive_oneSecondPastExpiry_routesToRescue_iter85() public {
        MockCoffer coffer = new MockCoffer(address(usdc));
        AqueductReceiver r = new AqueductReceiver(
            router, address(usdc), address(coffer), praetor, timelock
        );
        vm.prank(timelock);
        r.setAllowedSource(1, sourceAq);
        usdc.mint(address(r), 1_000_000);

        // expires_at = now - 1 → `block.timestamp <= expires_at` false → rescue.
        uint256 expires = block.timestamp - 1;
        IAny2EVMMessageReceiver.Any2EVMMessage memory msg_ = _buildMsg(
            keccak256("iter85-past-expiry"),
            1,
            sourceAq,
            destUser,
            expires,
            address(usdc),
            1_000_000
        );

        vm.prank(router);
        r.ccipReceive(msg_);

        // Rescue path: USDC lands on destUser directly. Coffer.deposit
        // must NOT have been called.
        assertEq(usdc.balanceOf(destUser), 1_000_000, "iter85: past-expiry must rescue to destUser");
        assertEq(coffer.lastDepositAmount(), 0, "iter85: Coffer.deposit must NOT fire for expired");
    }
}

contract MockCoffer {
    address public immutable usdc;
    uint256 public lastDepositAmount;
    address public lastDepositOnBehalf;

    constructor(address _usdc) {
        usdc = _usdc;
    }

    /// Must return uint256 to match ICoffer.deposit signature — without
    /// the return value, the ABI-strict caller reverts on decoded-bytes.
    function deposit(uint256 amount, address onBehalfOf) external returns (uint256) {
        MockUSDC(usdc).transferFromForMock(msg.sender, address(this), amount);
        lastDepositAmount = amount;
        lastDepositOnBehalf = onBehalfOf;
        return amount; // ERC-4626 returns shares; for the test, shares==assets.
    }
}

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public transferReturnsFalse;
    function setTransferReturnsFalse(bool v) external { transferReturnsFalse = v; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address sp, uint256 v) external returns (bool) { allowance[msg.sender][sp] = v; return true; }
    function transfer(address t, uint256 v) external returns (bool) {
        if (transferReturnsFalse) return false;
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[t] += v;
        return true;
    }
    /// Iter 85: helper for MockCoffer.deposit to pull approved USDC.
    function transferFromForMock(address from, address to, uint256 v) external {
        require(balanceOf[from] >= v, "balance");
        balanceOf[from] -= v;
        balanceOf[to] += v;
    }
}
