// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Aqueduct} from "../../contracts/aqueduct/src/Aqueduct.sol";

/// @title Aqueduct foundry test suite
/// @notice Closes the "Foundry test suites" item from docs/LAUNCH_READINESS.md
///         (#4, previously unmet). Covers pause/resume admin (audit G-6 +
///         H-C1 ABIs), replay-nonce + admin-gating + claim-back lifecycle.
///         Wave-U hardening: MockRouter implements the real
///         IRouterClient.EVM2AnyMessage struct signature so the contract
///         actually calls into the mock (Wave-T's mock used `bytes` which
///         produces a different selector and made every send_collateral
///         test a false positive).
contract AqueductTest is Test {
    Aqueduct internal aqueduct;
    MockRouter internal router;
    MockERC20 internal usdc;
    MockERC20 internal link;
    MockCoffer internal coffer;

    address internal praetor;
    address internal timelock;
    address internal user;
    address internal destUser;
    address internal hostile;

    function setUp() public {
        // Audit U-5 fix: makeAddr produces unique, deterministic, non-precompile
        // addresses. `0xPA` style literals from Wave-T were invalid hex.
        praetor = makeAddr("praetor");
        timelock = makeAddr("timelock");
        user = makeAddr("user");
        destUser = makeAddr("destUser");
        hostile = makeAddr("hostile");

        router = new MockRouter();
        usdc = new MockERC20("USDC", 6);
        link = new MockERC20("LINK", 18);
        coffer = new MockCoffer(address(usdc));

        aqueduct = new Aqueduct(
            address(router),
            address(usdc),
            address(link),
            address(coffer),
            praetor,
            timelock
        );

        usdc.mint(user, 1_000_000 * 10 ** 6);
        link.mint(address(aqueduct), 100 * 10 ** 18);
    }

    // ── Pause / resume admin path (audit G-6) ───────────────────────

    function test_pause_acceptsMultisig() public {
        vm.prank(praetor);
        aqueduct.pause(keccak256(bytes("emergency drill")));
        assertTrue(aqueduct.is_paused());
    }

    function test_pause_acceptsTimelock() public {
        vm.prank(timelock);
        aqueduct.pause(keccak256(bytes("scheduled")));
        assertTrue(aqueduct.is_paused());
    }

    function test_pause_rejectsRandomCaller() public {
        vm.prank(hostile);
        vm.expectRevert(Aqueduct.Unauthorized.selector);
        aqueduct.pause(keccak256(bytes("hostile")));
    }

    function test_send_collateral_revertsWhenPaused() public {
        vm.prank(timelock);
        aqueduct.setAqueductOnDest(1, makeAddr("aqueductOnDest"));
        router.setChainSupported(1, true);

        vm.prank(praetor);
        aqueduct.pause(keccak256(bytes("test")));

        vm.startPrank(user);
        usdc.approve(address(aqueduct), 1_000_000);
        vm.expectRevert(Aqueduct.AqueductPaused.selector);
        aqueduct.send_collateral(1, destUser, 1_000_000, block.timestamp + 1 hours);
        vm.stopPrank();
    }

    function test_resume_onlyTimelock() public {
        vm.prank(praetor);
        aqueduct.pause(keccak256(bytes("p")));

        vm.prank(praetor);
        vm.expectRevert(Aqueduct.Unauthorized.selector);
        aqueduct.resume();

        vm.prank(timelock);
        aqueduct.resume();
        assertFalse(aqueduct.is_paused());
    }

    // ── Replay-nonce / reorg-safety (audit G-1 / B-12) ──────────────

    function test_send_collateral_replaySameBlockSameParams_reverts() public {
        vm.prank(timelock);
        aqueduct.setAqueductOnDest(1, makeAddr("aqueductOnDest"));
        router.setChainSupported(1, true);

        // Audit V-C1 fix: Aqueduct calls `coffer.adapterPull(amount, user, aqueduct)`.
        // MockCoffer.adapterPull does `usdc.transferFrom(user, aqueduct, amount)` —
        // so the allowance check is `allowance[user][coffer]`, not [user][aqueduct].
        // Prior test only approved aqueduct, so even the FIRST send_collateral
        // call hit "allowance" before reaching the replay check. Approve coffer
        // (the actual transferFrom caller) plus aqueduct for any downstream path.
        vm.startPrank(user);
        usdc.approve(address(coffer), 5_000_000);
        usdc.approve(address(aqueduct), 5_000_000);
        aqueduct.send_collateral(1, destUser, 1_000_000, block.timestamp + 1 hours);

        // identical second send in the same block → replay nonce caught.
        // Audit U-6 fix: explicit selector so a different revert path
        // (e.g. USDC allowance, mock router) fails the test loudly.
        bytes32 expectedNonce = keccak256(abi.encode(user, uint256(1_000_000), block.number, destUser, uint64(1)));
        vm.expectRevert(abi.encodeWithSelector(Aqueduct.ReplayDetected.selector, expectedNonce));
        aqueduct.send_collateral(1, destUser, 1_000_000, block.timestamp + 1 hours);
        vm.stopPrank();
    }

    function test_send_collateral_revertsOnUnknownDestination() public {
        router.setChainSupported(1, false);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(Aqueduct.UnsupportedDestination.selector, uint64(1)));
        aqueduct.send_collateral(1, destUser, 1_000_000, block.timestamp + 1 hours);
    }

    // ── Audit DDDD-1 lock: expires_at minimum window ────────────────
    //
    // Pre-DDDD-1, a malicious user could set expires_at = now + 1 sec then
    // race claim_back before CCIP delivers (testnet finality 7-12s). This
    // test pins the minimum-window enforcement so the race re-opens loudly
    // if the constant is ever lowered.

    function test_send_collateral_rejectsExpiresAtBelowMinimum() public {
        vm.prank(timelock);
        aqueduct.setAqueductOnDest(1, makeAddr("aqueductOnDest"));
        router.setChainSupported(1, true);

        vm.startPrank(user);
        usdc.approve(address(coffer), 1_000_000);
        usdc.approve(address(aqueduct), 1_000_000);

        // 1 second past now — well below the 1-hour minimum
        uint256 tooSoon = block.timestamp + 1;
        uint256 expectedMin = block.timestamp + aqueduct.MIN_EXPIRES_AT_DELTA();
        vm.expectRevert(abi.encodeWithSelector(Aqueduct.ExpiresAtTooSoon.selector, tooSoon, expectedMin));
        aqueduct.send_collateral(1, destUser, 1_000_000, tooSoon);
        vm.stopPrank();
    }

    function test_send_collateral_acceptsExpiresAtExactlyAtMinimum() public {
        // Boundary condition: expires_at == block.timestamp + MIN delta is
        // accepted (the check is strictly `<`, not `<=`).
        vm.prank(timelock);
        aqueduct.setAqueductOnDest(1, makeAddr("aqueductOnDest"));
        router.setChainSupported(1, true);

        vm.startPrank(user);
        usdc.approve(address(coffer), 1_000_000);
        usdc.approve(address(aqueduct), 1_000_000);

        uint256 atMin = block.timestamp + aqueduct.MIN_EXPIRES_AT_DELTA();
        // Should not revert.
        aqueduct.send_collateral(1, destUser, 1_000_000, atMin);
        vm.stopPrank();
    }

    // ── Admin-gating on setters ─────────────────────────────────────

    function test_setAqueductOnDest_onlyTimelock() public {
        vm.prank(praetor);
        vm.expectRevert(Aqueduct.Unauthorized.selector);
        aqueduct.setAqueductOnDest(1, makeAddr("aq2"));

        vm.prank(timelock);
        aqueduct.setAqueductOnDest(1, makeAddr("aq2"));
        assertTrue(aqueduct.aqueductOnDest(1) != address(0));
    }

    function test_setClaimbackRegistry_onlyTimelock() public {
        vm.prank(praetor);
        vm.expectRevert(Aqueduct.Unauthorized.selector);
        aqueduct.setClaimbackRegistry(makeAddr("registry"));

        vm.prank(timelock);
        aqueduct.setClaimbackRegistry(makeAddr("registry"));
        assertTrue(aqueduct.claimback_registry() != address(0));
    }

    // ── Audit CCCCC-1 lock: setClaimbackRegistry emits rotation event ──
    //
    // Pre-CCCCC-1 the setter silently flipped storage. Operators tracking
    // who is authorized to flip is_settled had no event log to bind
    // alerts to — they had to poll storage. Now the rotation is a first-
    // class observable event (subgraph + UI dashboards).

    event ClaimbackRegistryUpdated(address indexed previous, address indexed next);

    function test_setClaimbackRegistry_emitsRotationEvent_CCCCC1() public {
        address first = makeAddr("registry-1");
        address second = makeAddr("registry-2");

        // First set: previous = address(0), next = first.
        vm.expectEmit(true, true, false, false, address(aqueduct));
        emit ClaimbackRegistryUpdated(address(0), first);
        vm.prank(timelock);
        aqueduct.setClaimbackRegistry(first);

        // Rotation: previous = first, next = second. The pre-CCCCC-1 bug
        // would have left the rotation invisible — this assertion catches
        // a future regression that drops the emit.
        vm.expectEmit(true, true, false, false, address(aqueduct));
        emit ClaimbackRegistryUpdated(first, second);
        vm.prank(timelock);
        aqueduct.setClaimbackRegistry(second);
    }

    // ── Audit CCCC-1 lock: dead-event `CrossChainCreditSettled` is now wired
    //
    // Pre-CCCC-1, the event was declared but never emitted, so the subgraph
    // handler never fired → every CrossChainCredit stayed `isSettled = false`
    // forever even after CCIP delivery acked. These tests pin the wiring:
    // `markSettled` is registry-only, flips is_settled, emits the event,
    // and is idempotent.

    event CrossChainCreditSettled(bytes32 indexed message_id);

    function _seedCredit() internal returns (bytes32 messageId) {
        vm.prank(timelock);
        aqueduct.setAqueductOnDest(1, makeAddr("aqueductOnDest"));
        router.setChainSupported(1, true);
        vm.startPrank(user);
        usdc.approve(address(coffer), 1_000_000);
        usdc.approve(address(aqueduct), 1_000_000);
        // ccipSend in MockRouter returns keccak256(block.number, block.timestamp)
        messageId = keccak256(abi.encode(block.number, block.timestamp));
        aqueduct.send_collateral(1, destUser, 1_000_000, block.timestamp + 1 hours);
        vm.stopPrank();
    }

    function test_markSettled_onlyByConfiguredRegistry() public {
        bytes32 mid = _seedCredit();
        address registry = makeAddr("registry");
        vm.prank(timelock);
        aqueduct.setClaimbackRegistry(registry);

        // hostile can't fire it
        vm.prank(hostile);
        vm.expectRevert(Aqueduct.Unauthorized.selector);
        aqueduct.markSettled(mid);

        // praetor (also hostile relative to this call) can't fire it
        vm.prank(praetor);
        vm.expectRevert(Aqueduct.Unauthorized.selector);
        aqueduct.markSettled(mid);

        // registry can
        vm.expectEmit(true, false, false, false, address(aqueduct));
        emit CrossChainCreditSettled(mid);
        vm.prank(registry);
        aqueduct.markSettled(mid);
    }

    function test_markSettled_flipsIsSettled() public {
        bytes32 mid = _seedCredit();
        address registry = makeAddr("registry");
        vm.prank(timelock);
        aqueduct.setClaimbackRegistry(registry);

        // Read the credit record's is_settled (6th field of CrossChainCreditRecord
        // per Aqueduct.credits getter return order: user, amount_wei, source_chain,
        // dest_chain, expires_at, is_settled).
        (, , , , , bool preSettled) = aqueduct.credits(mid);
        assertFalse(preSettled, "should start unsettled");

        vm.prank(registry);
        aqueduct.markSettled(mid);

        (, , , , , bool postSettled) = aqueduct.credits(mid);
        assertTrue(postSettled, "markSettled must flip is_settled");
    }

    function test_markSettled_idempotent() public {
        // CCIP retries could deliver ack twice. Second call must not revert.
        bytes32 mid = _seedCredit();
        address registry = makeAddr("registry");
        vm.prank(timelock);
        aqueduct.setClaimbackRegistry(registry);

        vm.prank(registry);
        aqueduct.markSettled(mid);

        // Second call from registry: idempotent (early-return, no revert).
        vm.prank(registry);
        aqueduct.markSettled(mid);

        (, , , , , bool isSettled) = aqueduct.credits(mid);
        assertTrue(isSettled, "still settled after second call");
    }

    function test_markSettled_revertsOnUnknownMessageId() public {
        address registry = makeAddr("registry");
        vm.prank(timelock);
        aqueduct.setClaimbackRegistry(registry);

        bytes32 fake = keccak256("does-not-exist");
        vm.prank(registry);
        vm.expectRevert(abi.encodeWithSelector(Aqueduct.CreditNotFound.selector, fake));
        aqueduct.markSettled(fake);
    }

    // ── Audit GGG-1 lock: claim_back surfaces silent USDC transfer fails
    //
    // Pre-GGG-1, `usdc.transfer(record.user, amount)` discarded its return
    // value. A Tether-style false-return token would have marked the credit
    // is_settled = true while NOT actually moving USDC to the user. The
    // fix added `bool ok = usdc.transfer(...); if (!ok) revert ...`. Pin
    // both the revert and the happy-path emit.

    event CrossChainCreditClaimedBack(bytes32 indexed message_id, address indexed user, uint256 amount_wei);

    function test_claimBack_happyPath_emitsAndPaysUser() public {
        // Fund the aqueduct so it actually holds USDC to pay back. In production
        // the cross-chain transfer would leave USDC locked here pending ack;
        // for this unit test we mint directly.
        usdc.mint(address(aqueduct), 1_000_000);

        bytes32 mid = _seedCredit();

        // Wait past the expiry window.
        vm.warp(block.timestamp + 2 hours);

        uint256 preBal = usdc.balanceOf(user);

        vm.expectEmit(true, true, false, true, address(aqueduct));
        emit CrossChainCreditClaimedBack(mid, user, 1_000_000);

        vm.prank(user);
        aqueduct.claim_back(mid);

        assertEq(usdc.balanceOf(user), preBal + 1_000_000, "user must receive USDC back");
        (, , , , , bool isSettled) = aqueduct.credits(mid);
        assertTrue(isSettled, "credit must be marked settled after claim_back");
    }

    function test_claimBack_revertsOnTransferReturnsFalse() public {
        usdc.mint(address(aqueduct), 1_000_000);
        bytes32 mid = _seedCredit();
        vm.warp(block.timestamp + 2 hours);

        // Flip the mock to silent-fail mode.
        usdc.setTransferReturnsFalse(true);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(Aqueduct.UsdcTransferFailed.selector, user, uint256(1_000_000)));
        aqueduct.claim_back(mid);

        // The load-bearing assertion: pre-GGG-1 the credit would have been
        // marked is_settled = true even though USDC didn't move. Post-fix,
        // the revert rolls back the storage write so the user can retry.
        (, , , , , bool isSettled) = aqueduct.credits(mid);
        assertFalse(isSettled, "transfer-fail must NOT leave credit settled");
    }

    function test_claimBack_revertsBeforeExpiry() public {
        bytes32 mid = _seedCredit();
        // expires_at is now + 1 hour (per _seedCredit). Try claim immediately.
        // Pin the specific selector: `vm.expectRevert()` with no arg masks
        // unrelated reverts (CreditNotFound, msg.sender check, registry
        // state). The audit lesson from earlier iterations: every revert
        // expectation should name the selector or the test silently passes
        // when the contract fails for a different reason.
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(Aqueduct.CreditNotExpired.selector, block.timestamp + 1 hours, block.timestamp)
        );
        aqueduct.claim_back(mid);
    }

    function test_claimBack_revertsIfAlreadyAcked() public {
        // The ack-registry check makes claim_back fail with CreditAlreadySettled
        // when CCIP delivery already landed downstream.
        usdc.mint(address(aqueduct), 1_000_000);
        bytes32 mid = _seedCredit();

        // Configure a claimback registry that reports hasDeliveryAck = true.
        MockClaimbackRegistry registry = new MockClaimbackRegistry();
        registry.setAck(mid, true);
        vm.prank(timelock);
        aqueduct.setClaimbackRegistry(address(registry));

        vm.warp(block.timestamp + 2 hours);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(Aqueduct.CreditAlreadySettled.selector, mid));
        aqueduct.claim_back(mid);
    }

    // ── Audit GGG-1b lock: depositLink surfaces silent transferFrom fails
    //
    // Pre-GGG-1b, `link.transferFrom(...)` discarded its return value. A
    // false return would have left the depositor's allowance consumed
    // without LINK moving. The fix added the return-value check. Pin both
    // happy path and revert.

    function test_depositLink_happyPath() public {
        // Mint LINK to praetor + approve aqueduct.
        link.mint(praetor, 10 * 10 ** 18);
        vm.startPrank(praetor);
        link.approve(address(aqueduct), 10 * 10 ** 18);
        aqueduct.depositLink(5 * 10 ** 18);
        vm.stopPrank();

        assertEq(link.balanceOf(address(aqueduct)), 105 * 10 ** 18, "LINK must transfer in");
        assertEq(link.balanceOf(praetor), 5 * 10 ** 18, "depositor balance reduced");
    }

    function test_depositLink_revertsOnTransferFromReturnsFalse() public {
        link.mint(praetor, 10 * 10 ** 18);
        vm.startPrank(praetor);
        link.approve(address(aqueduct), 10 * 10 ** 18);
        vm.stopPrank();

        link.setTransferFromReturnsFalse(true);

        vm.prank(praetor);
        vm.expectRevert(
            abi.encodeWithSelector(Aqueduct.LinkTransferFromFailed.selector, praetor, uint256(5 * 10 ** 18))
        );
        aqueduct.depositLink(5 * 10 ** 18);
    }

    // ── Audit CCCCC-2 lock: depositLink emits LinkDeposited ──────────
    //
    // Pre-CCCCC-2, depositLink moved LINK silently. The LinkBalanceLow
    // alert event fires when send_collateral notices a depletion, but
    // there was no corresponding refill event. Operators reading the
    // event channel saw alerts trigger but couldn't see whether they
    // were acted on. The fix adds LinkDeposited(depositor, amount,
    // new_balance) so balance-tracking dashboards can wire both sides.

    event LinkDeposited(address indexed depositor, uint256 amount, uint256 new_balance);

    // ── Iter 89: pin emit assertions on CrossChainCredit (main subgraph
    //               event) + EmergencyPaused + Resumed + AqueductOnDestSet.
    //
    // Pre-iter-89 these events were emitted but no test used expectEmit
    // against them. Subgraph mappings depend on the CrossChainCredit
    // signature for cross-chain credit indexing — a dropped emit would
    // silently desync every Scribe-fed dashboard.

    event CrossChainCredit(
        bytes32 indexed message_id,
        address indexed user,
        uint64 source_chain,
        uint64 dest_chain,
        uint256 amount_wei,
        uint256 expires_at
    );
    event EmergencyPaused(address indexed by, bytes32 reason);
    event Resumed(address indexed by);
    event AqueductOnDestSet(uint64 indexed chain_selector, address dest);

    function test_send_collateral_emitsCrossChainCredit_iter89() public {
        vm.prank(timelock);
        aqueduct.setAqueductOnDest(1, makeAddr("aqueductOnDest"));
        router.setChainSupported(1, true);

        vm.startPrank(user);
        usdc.approve(address(coffer), 1_000_000);
        usdc.approve(address(aqueduct), 1_000_000);

        // Expect the indexed message_id + user, plus the data tuple. The
        // message_id is mock-router-deterministic but block-timestamp-
        // dependent, so use vm.expectEmit's last-arg `false` for data
        // mode and check by hashed-call shape. Cleaner: use the
        // checkData=false form to spot-check just the indexed topics.
        vm.expectEmit(false, true, false, false, address(aqueduct));
        emit CrossChainCredit(bytes32(0), user, 0, 0, 0, 0);
        aqueduct.send_collateral(1, destUser, 1_000_000, block.timestamp + 1 hours);
        vm.stopPrank();
    }

    function test_pause_emitsEmergencyPaused_iter89() public {
        bytes32 reason = keccak256(bytes("test"));
        // Check indexed `by` topic and the bytes32 data payload now that
        // Phase theta.1 migrated the reason field from off-event to indexed-data.
        vm.expectEmit(true, false, false, true, address(aqueduct));
        emit EmergencyPaused(praetor, reason);
        vm.prank(praetor);
        aqueduct.pause(reason);
    }

    function test_resume_emitsResumed_iter89() public {
        vm.prank(praetor);
        aqueduct.pause(keccak256(bytes("test")));

        vm.expectEmit(true, false, false, false, address(aqueduct));
        emit Resumed(timelock);
        vm.prank(timelock);
        aqueduct.resume();
    }

    function test_setAqueductOnDest_emitsRotationEvent_iter89() public {
        address dest = makeAddr("destAq");
        // Event has chain_selector indexed but dest in data — adjust the
        // topic mask: (true=topic1, false=topic2, false=topic3, true=data).
        vm.expectEmit(true, false, false, true, address(aqueduct));
        emit AqueductOnDestSet(7, dest);
        vm.prank(timelock);
        aqueduct.setAqueductOnDest(7, dest);
    }

    function test_depositLink_emitsLinkDeposited_CCCCC2() public {
        link.mint(praetor, 10 * 10 ** 18);
        vm.startPrank(praetor);
        link.approve(address(aqueduct), 10 * 10 ** 18);
        vm.stopPrank();

        // Expected new_balance: setUp minted 100 LINK to aqueduct, plus 5 from
        // this deposit = 105e18.
        vm.expectEmit(true, false, false, true, address(aqueduct));
        emit LinkDeposited(praetor, 5 * 10 ** 18, 105 * 10 ** 18);

        vm.prank(praetor);
        aqueduct.depositLink(5 * 10 ** 18);
    }

    // ── FIRE76-7: rolling-30d LINK burn accumulator + alert (iter 59) ─

    event LinkUsage30dUpdated(uint256 total_burned_30d_wei, uint64 window_start);
    event LinkBalanceLow(uint256 current_balance, uint256 monthly_usage);

    /// Iter 59 audit fix: pin that send_collateral increments the
    /// rolling-30d accumulator and emits LinkUsage30dUpdated. Pre-iter-
    /// 59 the MockRouter returned fee=0 unconditionally, so the
    /// accumulator path at Aqueduct.sol:248-257 was reachable but
    /// total_link_burned_30d_wei never advanced — meaning the
    /// LinkBalanceLow alert (line 260-262) could never fire in tests.
    /// Without this test, a refactor stripping the accumulator update
    /// would slip past CI with zero signal.
    function test_send_collateral_incrementsLinkBurnAccumulator_FIRE76_7_iter59() public {
        uint256 fee = 1 * 10 ** 18;
        router.setFee(fee);
        vm.prank(timelock);
        aqueduct.setAqueductOnDest(1, makeAddr("aqueductOnDest"));
        router.setChainSupported(1, true);

        vm.startPrank(user);
        usdc.approve(address(coffer), 5_000_000);
        usdc.approve(address(aqueduct), 5_000_000);

        // First send: accumulator advances by fee, window_start sets to now.
        vm.expectEmit(false, false, false, true, address(aqueduct));
        emit LinkUsage30dUpdated(fee, uint64(block.timestamp));
        aqueduct.send_collateral(1, destUser, 1_000_000, block.timestamp + 1 hours);
        vm.stopPrank();

        assertEq(
            aqueduct.total_link_burned_30d_wei(),
            fee,
            "FIRE76-7: accumulator must advance by fee on each send"
        );
        assertEq(
            aqueduct.link_burn_window_start(),
            uint64(block.timestamp),
            "FIRE76-7: window_start must be set on first send"
        );
    }

    /// Iter 59 audit fix: pin the LinkBalanceLow alert threshold per
    /// TDD §16.1 ("balance < 10 × monthly-burn"). MockRouter doesn't
    /// actually pull LINK on ccipSend (just returns a messageId), so
    /// the LINK balance stays at 100e18 from setUp. With fee = 11e18,
    /// the accumulator hits 11e18; 11 * 10 = 110 > 100 → alert fires
    /// with current balance (100e18) and current monthly usage (11e18).
    function test_send_collateral_firesLinkBalanceLow_FIRE76_7_iter59() public {
        uint256 fee = 11 * 10 ** 18;
        router.setFee(fee);
        vm.prank(timelock);
        aqueduct.setAqueductOnDest(1, makeAddr("aqueductOnDest"));
        router.setChainSupported(1, true);

        vm.startPrank(user);
        usdc.approve(address(coffer), 5_000_000);
        usdc.approve(address(aqueduct), 5_000_000);

        // After this send: accumulator = 11. Balance = 100 (mock doesn't
        // burn LINK on ccipSend). 11 * 10 = 110 > 100 → alert fires.
        vm.expectEmit(false, false, false, true, address(aqueduct));
        emit LinkBalanceLow(100 * 10 ** 18, fee);
        aqueduct.send_collateral(1, destUser, 1_000_000, block.timestamp + 1 hours);
        vm.stopPrank();
    }

    /// Iter 59 audit fix: pin the 30-day window slide at
    /// Aqueduct.sol:252-255. After 30 days the accumulator must reset
    /// and window_start advance to now. Without this, a long-running
    /// deployment would carry the historical burn forward indefinitely
    /// and the alert threshold would lose its rolling-window semantics.
    function test_send_collateral_slidesAccumulatorAfter30d_FIRE76_7_iter59() public {
        uint256 fee = 1 * 10 ** 18;
        router.setFee(fee);
        vm.prank(timelock);
        aqueduct.setAqueductOnDest(1, makeAddr("aqueductOnDest"));
        router.setChainSupported(1, true);

        // Phase 1: anchor at T0 and send. Use literal timestamps to dodge
        // any block.timestamp evaluation surprises across prank windows.
        uint256 t0 = 1_700_000_000;
        vm.warp(t0);

        vm.startPrank(user);
        usdc.approve(address(coffer), 10_000_000);
        usdc.approve(address(aqueduct), 10_000_000);
        aqueduct.send_collateral(1, destUser, 1_000_000, t0 + 1 hours);
        vm.stopPrank();

        uint64 firstWindow = aqueduct.link_burn_window_start();
        assertEq(aqueduct.total_link_burned_30d_wei(), fee);
        assertEq(uint256(firstWindow), t0, "iter59: first window must be set to t0");

        // Phase 2: advance >30d, send again. Counter resets to JUST this
        // fee, window_start advances. Use literal t1 for the same reason.
        uint256 t1 = t0 + 30 days + 1;
        vm.warp(t1);

        vm.startPrank(user);
        aqueduct.send_collateral(1, destUser, 1_000_001, t1 + 1 hours);
        vm.stopPrank();

        assertEq(
            aqueduct.total_link_burned_30d_wei(),
            fee,
            "FIRE76-7: window slide must reset accumulator to current-period fee only"
        );
        assertGt(
            uint256(aqueduct.link_burn_window_start()),
            uint256(firstWindow),
            "FIRE76-7: window_start must advance after slide"
        );
    }
}

// Minimal stub for the source-side hasDeliveryAck reader.
contract MockClaimbackRegistry {
    mapping(bytes32 => bool) internal acked;
    function setAck(bytes32 messageId, bool v) external { acked[messageId] = v; }
    function hasDeliveryAck(bytes32 messageId) external view returns (bool) { return acked[messageId]; }
}

// ──────────────────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────────────────

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;
    // Audit UUUU-2: toggle Tether-style silent-fail return to exercise
    // GGG-1 (transfer) + GGG-1b (transferFrom) revert paths.
    bool public transferReturnsFalse;
    bool public transferFromReturnsFalse;

    constructor(string memory _symbol, uint8 _decimals) {
        symbol = _symbol;
        name = _symbol;
        decimals = _decimals;
    }
    function setTransferReturnsFalse(bool v) external {
        transferReturnsFalse = v;
    }
    function setTransferFromReturnsFalse(bool v) external {
        transferFromReturnsFalse = v;
    }
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
    function approve(address sp, uint256 v) external returns (bool) {
        allowance[msg.sender][sp] = v;
        return true;
    }
    function transferFrom(address f, address t, uint256 v) external returns (bool) {
        if (transferFromReturnsFalse) return false;
        require(allowance[f][msg.sender] >= v, "allowance");
        require(balanceOf[f] >= v, "balance");
        allowance[f][msg.sender] -= v;
        balanceOf[f] -= v;
        balanceOf[t] += v;
        return true;
    }
    function transfer(address t, uint256 v) external returns (bool) {
        if (transferReturnsFalse) return false;
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[t] += v;
        return true;
    }
}

/// MockRouter — matches the real IRouterClient interface in `Aqueduct.sol`
/// (struct EVM2AnyMessage, struct EVMTokenAmount). Audit U-1 fix: the
/// previous mock used `bytes calldata` which produced a different selector
/// and silently never matched the contract's call.
contract MockRouter {
    struct EVMTokenAmount { address token; uint256 amount; }
    struct EVM2AnyMessage {
        bytes receiver;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
        address feeToken;
        bytes extraArgs;
    }

    mapping(uint64 => bool) internal supported;
    /// Iter 59 / FIRE76-7 test support: settable per-message LINK fee.
    /// Default 0 preserves existing-test behavior (no accumulator drift).
    uint256 public fee_per_send;

    function setChainSupported(uint64 selector, bool ok) external {
        supported[selector] = ok;
    }
    function setFee(uint256 v) external { fee_per_send = v; }
    function isChainSupported(uint64 selector) external view returns (bool) {
        return supported[selector];
    }
    function getFee(uint64, /* destinationChainSelector */ EVM2AnyMessage memory) external view returns (uint256) {
        return fee_per_send;
    }
    function ccipSend(uint64, /* destinationChainSelector */ EVM2AnyMessage calldata)
        external
        payable
        returns (bytes32)
    {
        // Deterministic message id for the test
        return keccak256(abi.encode(block.number, block.timestamp));
    }
}

contract MockCoffer {
    address public immutable usdc;
    constructor(address _usdc) { usdc = _usdc; }
    function adapterPull(uint256 amount, address from_user, address to) external {
        MockERC20(usdc).transferFrom(from_user, to, amount);
    }
}
