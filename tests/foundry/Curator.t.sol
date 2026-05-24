// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Curator} from "../../contracts/curator/src/Curator.sol";

/// @title Curator foundry test suite
/// @notice PRD §17 Day-180 deliverable. Year-1 budget $20–50K in REALISTIC,
///         $0 in FLOOR — the contract ships either way.
contract CuratorTest is Test {
    Curator internal curator;
    MockUSDC internal usdc;

    address internal praetor;
    address internal timelock;
    address internal grantee;
    address internal hostile;

    bytes32 internal constant CID = keccak256("ipfs://Qm.../grant-attestation.json");

    event GrantCreated(uint256 indexed grant_id, address indexed grantee, uint256 amount, bytes32 ipfs_attestation_cid);
    event GrantClaimed(uint256 indexed grant_id, address indexed grantee, uint256 amount);
    event GrantCancelled(uint256 indexed grant_id, string reason);

    function setUp() public {
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        grantee = makeAddr("grantee-builder");
        hostile = makeAddr("hostile");
        usdc = new MockUSDC();
        curator = new Curator(praetor, timelock, address(usdc));
        // Audit FIRE76-6 fix (sub-agent MEDIUM): createGrant now requires
        // pre-funding to prevent over-commitment. Pool the Curator with
        // 500K USDC up front so existing tests don't need per-test mints.
        usdc.mint(address(curator), 500_000e6);
    }

    // ── Constructor zero-checks (BBBBB / DDD-5 pattern) ─────────────

    function test_constructor_revertsOnZeroPraetor() public {
        vm.expectRevert(bytes("zero praetor"));
        new Curator(address(0), timelock, address(usdc));
    }

    function test_constructor_revertsOnZeroTimelock() public {
        vm.expectRevert(bytes("zero timelock"));
        new Curator(praetor, address(0), address(usdc));
    }

    function test_constructor_revertsOnZeroUsdc() public {
        vm.expectRevert(bytes("zero usdc"));
        new Curator(praetor, timelock, address(0));
    }

    // ── createGrant gating ─────────────────────────────────────────

    function test_createGrant_onlyTimelock() public {
        vm.prank(praetor);
        vm.expectRevert(Curator.Unauthorized.selector);
        curator.createGrant(grantee, 25_000e6, CID);

        vm.prank(hostile);
        vm.expectRevert(Curator.Unauthorized.selector);
        curator.createGrant(grantee, 25_000e6, CID);
    }

    function test_createGrant_rejectsZeroGrantee() public {
        vm.prank(timelock);
        vm.expectRevert(Curator.ZeroGrantee.selector);
        curator.createGrant(address(0), 25_000e6, CID);
    }

    function test_createGrant_rejectsZeroAmount() public {
        vm.prank(timelock);
        vm.expectRevert(Curator.ZeroAmount.selector);
        curator.createGrant(grantee, 0, CID);
    }

    function test_createGrant_rejectsZeroCid() public {
        vm.prank(timelock);
        vm.expectRevert(Curator.ZeroIpfs.selector);
        curator.createGrant(grantee, 25_000e6, bytes32(0));
    }

    function test_createGrant_emitsEventAndStores() public {
        vm.expectEmit(true, true, false, true, address(curator));
        emit GrantCreated(1, grantee, 25_000e6, CID);

        vm.prank(timelock);
        uint256 id = curator.createGrant(grantee, 25_000e6, CID);
        assertEq(id, 1);

        (address g, uint256 amt, bytes32 cid,, uint64 claimedAt, bool exists) = curator.getGrant(1);
        assertEq(g, grantee);
        assertEq(amt, 25_000e6);
        assertEq(cid, CID);
        assertEq(uint256(claimedAt), 0);
        assertTrue(exists);
    }

    // ── claim ──────────────────────────────────────────────────────

    function test_claim_onlyGrantee() public {
        vm.prank(timelock);
        curator.createGrant(grantee, 25_000e6, CID);
        usdc.mint(address(curator), 25_000e6);

        vm.prank(hostile);
        vm.expectRevert(Curator.Unauthorized.selector);
        curator.claim(1);
    }

    function test_claim_revertsOnUnknownId() public {
        vm.prank(grantee);
        vm.expectRevert(abi.encodeWithSelector(Curator.GrantNotFound.selector, uint256(9_999)));
        curator.claim(9_999);
    }

    function test_claim_revertsIfDoubleClaim() public {
        vm.prank(timelock);
        curator.createGrant(grantee, 10_000e6, CID);
        usdc.mint(address(curator), 10_000e6);

        vm.prank(grantee);
        curator.claim(1);

        vm.prank(grantee);
        vm.expectRevert(abi.encodeWithSelector(Curator.AlreadyClaimed.selector, uint256(1)));
        curator.claim(1);
    }

    function test_createGrant_revertsOnOverCommit_FIRE76_6() public {
        // Audit FIRE76-6 fix (sub-agent MEDIUM): the pool was pre-funded
        // with 500K. Schedule 4 grants of 200K each — the 4th must reject
        // with InsufficientFundsForCommitment because 4 * 200K = 800K > 500K.
        vm.startPrank(timelock);
        curator.createGrant(makeAddr("g1"), 200_000e6, keccak256("a"));
        curator.createGrant(makeAddr("g2"), 200_000e6, keccak256("b"));
        // 3rd would commit 600K > 500K. Reject.
        vm.expectRevert(
            abi.encodeWithSelector(
                Curator.InsufficientFundsForCommitment.selector,
                uint256(600_000e6),
                uint256(500_000e6)
            )
        );
        curator.createGrant(makeAddr("g3"), 200_000e6, keccak256("c"));
        vm.stopPrank();

        assertEq(curator.total_committed_wei(), 400_000e6, "two grants committed, third rejected");
    }

    function test_commitmentReleasesOnClaim() public {
        vm.prank(timelock);
        curator.createGrant(grantee, 25_000e6, CID);
        assertEq(curator.total_committed_wei(), 25_000e6);

        vm.prank(grantee);
        curator.claim(1);
        assertEq(curator.total_committed_wei(), 0, "claim must release commitment");
    }

    function test_commitmentReleasesOnCancel() public {
        vm.prank(timelock);
        curator.createGrant(grantee, 25_000e6, CID);
        assertEq(curator.total_committed_wei(), 25_000e6);

        // FIRE76-9: warp past cooldown before cancelling.
        vm.warp(block.timestamp + 7 hours);
        vm.prank(praetor);
        curator.cancelGrant(1, "test");
        assertEq(curator.total_committed_wei(), 0, "cancel must release commitment");
    }

    function test_claim_happyPath_movesUsdcAndEmits() public {
        vm.prank(timelock);
        curator.createGrant(grantee, 25_000e6, CID);
        usdc.mint(address(curator), 25_000e6);

        uint256 preBal = usdc.balanceOf(grantee);

        vm.expectEmit(true, true, false, true, address(curator));
        emit GrantClaimed(1, grantee, 25_000e6);

        vm.prank(grantee);
        curator.claim(1);

        assertEq(usdc.balanceOf(grantee), preBal + 25_000e6, "USDC must reach the grantee");
        assertEq(curator.total_disbursed_wei(), 25_000e6, "running disbursed total must update");

        (,,,, uint64 claimedAt,) = curator.getGrant(1);
        assertGt(uint256(claimedAt), 0, "claimed_at must be stamped");
    }

    function test_claim_revertsOnTransferReturnsFalse() public {
        // GGG-1 pattern: surface false-return transfers as a real revert.
        // Pre-fix codebase let `let _ = transfer` discard failures.
        vm.prank(timelock);
        curator.createGrant(grantee, 25_000e6, CID);
        usdc.mint(address(curator), 25_000e6);
        usdc.setTransferReturnsFalse(true);

        vm.prank(grantee);
        vm.expectRevert(abi.encodeWithSelector(Curator.UsdcTransferFailed.selector, grantee, uint256(25_000e6)));
        curator.claim(1);

        // claimed_at must NOT be stamped — revert rolled back the storage write.
        // total_disbursed_wei must NOT include this grant — same rollback.
        (,,,, uint64 claimedAt,) = curator.getGrant(1);
        assertEq(uint256(claimedAt), 0, "transfer-fail must NOT mark the grant claimed");
        assertEq(curator.total_disbursed_wei(), 0, "total_disbursed must roll back");
    }

    // ── cancelGrant ────────────────────────────────────────────────

    function test_cancelGrant_onlyPraetor() public {
        vm.prank(timelock);
        curator.createGrant(grantee, 25_000e6, CID);

        vm.prank(hostile);
        vm.expectRevert(Curator.Unauthorized.selector);
        curator.cancelGrant(1, "bad-grant");
    }

    function test_cancelGrant_emitsAndDeletes() public {
        vm.prank(timelock);
        curator.createGrant(grantee, 25_000e6, CID);

        // FIRE76-9: cooldown — warp past it before cancelling.
        vm.warp(block.timestamp + 7 hours);

        vm.expectEmit(true, false, false, true, address(curator));
        emit GrantCancelled(1, "reviewer-NACK");

        vm.prank(praetor);
        curator.cancelGrant(1, "reviewer-NACK");

        (,,,,, bool exists) = curator.getGrant(1);
        assertFalse(exists, "cancelled grant must not exist anymore");
    }

    function test_cancelGrant_revertsOnClaimedGrant() public {
        vm.prank(timelock);
        curator.createGrant(grantee, 25_000e6, CID);
        vm.prank(grantee);
        curator.claim(1);

        // Warp past cooldown so the only revert reason is AlreadyClaimed.
        vm.warp(block.timestamp + 7 hours);
        vm.prank(praetor);
        vm.expectRevert(abi.encodeWithSelector(Curator.AlreadyClaimed.selector, uint256(1)));
        curator.cancelGrant(1, "too-late");
    }

    /// FIRE76-9 lock — cancel-cooldown enforced.
    function test_cancelGrant_rejectsBeforeCooldown_FIRE76_9() public {
        vm.prank(timelock);
        curator.createGrant(grantee, 25_000e6, CID);

        // Immediate cancel attempt — must revert.
        uint64 cancellable_at = uint64(block.timestamp) + curator.CANCEL_COOLDOWN_SECONDS();
        vm.prank(praetor);
        vm.expectRevert(
            abi.encodeWithSelector(
                Curator.CancelCooldownActive.selector,
                cancellable_at,
                uint64(block.timestamp)
            )
        );
        curator.cancelGrant(1, "too-fast");
    }

    // ── Iter 96: fuzz invariants on Curator commitment accounting ────
    //
    // The accounting invariant: total_committed_wei = sum of all
    // unclaimed grant amounts. Pre-FIRE76-6 the accounting could
    // drift on overcommit; FIRE76-6 added the cap check. Fuzz across
    // create+claim+cancel sequences to assert the invariant always
    // holds.

    /// Invariant: total_committed_wei ≤ contract USDC balance at all times.
    /// If this drifts, future createGrant calls would silently revert with
    /// InsufficientFundsForCommitment because the cap check reads contract balance.
    function testFuzz_commitmentNeverExceedsBalance_iter96(
        uint64 amount1,
        uint64 amount2,
        uint64 amount3
    ) public {
        // Bound to sane sizes (each ≤ 100K USDC; balance is 500K from setUp).
        vm.assume(amount1 > 0 && amount1 <= 100_000e6);
        vm.assume(amount2 > 0 && amount2 <= 100_000e6);
        vm.assume(amount3 > 0 && amount3 <= 100_000e6);

        // Three sequential grants.
        vm.startPrank(timelock);
        curator.createGrant(grantee, amount1, CID);
        curator.createGrant(grantee, amount2, CID);
        curator.createGrant(grantee, amount3, CID);
        vm.stopPrank();

        // Invariant: total_committed_wei must equal sum (no drift).
        assertEq(curator.total_committed_wei(),
                 uint256(amount1) + uint256(amount2) + uint256(amount3),
                 "iter96: commitment must equal sum of unclaimed grants");
        // Invariant: committed must never exceed available balance.
        assertLe(curator.total_committed_wei(),
                 usdc.balanceOf(address(curator)),
                 "iter96: commitment must never exceed contract balance");
    }

    /// Invariant: after claim, total_committed_wei decreases by claimed
    /// amount AND total_disbursed_wei increases by the same amount.
    /// Conservation of value across claim transitions.
    function testFuzz_claimConservesAccounting_iter96(uint64 amount) public {
        vm.assume(amount > 0 && amount <= 100_000e6);

        vm.prank(timelock);
        curator.createGrant(grantee, amount, CID);
        uint256 beforeCommitted = curator.total_committed_wei();
        uint256 beforeDisbursed = curator.total_disbursed_wei();

        vm.prank(grantee);
        curator.claim(1);

        assertEq(curator.total_committed_wei(), beforeCommitted - amount,
                 "iter96: commitment decreases by claimed amount");
        assertEq(curator.total_disbursed_wei(), beforeDisbursed + amount,
                 "iter96: disbursed increases by claimed amount");
    }

    /// Iter 84: pin the cancel-cooldown boundary. The check is
    /// `if (now < cancellable_at) revert`. So at exactly `cancellable_at`
    /// the cancel MUST succeed. A future contributor relaxing to `<=`
    /// would silently extend the cooldown by 1 second.
    function test_cancelGrant_passesAtExactCooldownBoundary_iter84() public {
        vm.prank(timelock);
        curator.createGrant(grantee, 25_000e6, CID);

        uint64 funded_at = uint64(block.timestamp);
        uint64 cancellable_at = funded_at + curator.CANCEL_COOLDOWN_SECONDS();
        vm.warp(cancellable_at);  // exactly at the boundary

        vm.prank(praetor);
        curator.cancelGrant(1, "at boundary");
        // No revert → boundary is inclusive (>= passes).
        ( , , , , , bool exists) = curator.grants(1);
        assertFalse(exists, "iter84: cancel at boundary must wipe the grant");
    }

    /// Iter 84: pin that cancel frees the commitment, allowing a
    /// re-create at the freed amount. Pre-FIRE76-6 the commitment was
    /// never released → cancel-then-recreate would falsely report
    /// over-commit. Already partially covered by `commitmentReleasesOnCancel`
    /// (which only checks total_committed_wei goes to 0). This test
    /// confirms the END-TO-END: a fresh grant for the same amount actually
    /// succeeds after the cancel.
    function test_cancelThenRecreate_sameAmount_succeeds_iter84() public {
        vm.prank(timelock);
        uint256 firstId = curator.createGrant(grantee, 25_000e6, CID);
        assertEq(curator.total_committed_wei(), 25_000e6);

        // Advance past cooldown, then cancel.
        vm.warp(block.timestamp + curator.CANCEL_COOLDOWN_SECONDS());
        vm.prank(praetor);
        curator.cancelGrant(firstId, "rescope");
        assertEq(curator.total_committed_wei(), 0, "iter84: commitment must reset to 0");

        // Re-create at the same amount must succeed.
        vm.prank(timelock);
        uint256 secondId = curator.createGrant(grantee, 25_000e6, CID);
        // Different ID — next_grant_id keeps incrementing per grant.
        assertEq(secondId, firstId + 1, "iter84: cancelled IDs are NOT reused");
        assertEq(curator.total_committed_wei(), 25_000e6);
    }

    /// Iter 84: claim frees commitment AND advances total_disbursed_wei.
    /// Combined accounting: after claim, the freed commitment + the
    /// underlying balance should support a re-create at the same amount.
    function test_claimThenRecreate_accountingSelfConsistent_iter84() public {
        vm.prank(timelock);
        curator.createGrant(grantee, 25_000e6, CID);

        // Grantee claims.
        vm.prank(grantee);
        curator.claim(1);
        assertEq(curator.total_committed_wei(), 0, "iter84: claim frees commitment");
        assertEq(curator.total_disbursed_wei(), 25_000e6, "iter84: claim advances disbursed");

        // Re-create succeeds (balance still has 500_000e6 - 25_000e6 = 475k
        // free from the setUp mint). 25k commitment fits in 475k balance.
        vm.prank(timelock);
        uint256 secondId = curator.createGrant(grantee, 25_000e6, CID);
        assertEq(secondId, 2);
        assertEq(curator.total_committed_wei(), 25_000e6);
    }

    /// FIRE76-8 lock — canonical funding path emits + tracks.
    function test_fund_emitsAndIncrementsTotal_FIRE76_8() public {
        // Mint to test contract + approve curator.
        usdc.mint(address(this), 100_000e6);
        usdc.approve(address(curator), 100_000e6);

        vm.expectEmit(true, false, false, true, address(curator));
        emit FundsReceived(address(this), 50_000e6, 50_000e6);
        curator.fund(50_000e6);
        assertEq(curator.total_funded_wei(), 50_000e6);

        vm.expectEmit(true, false, false, true, address(curator));
        emit FundsReceived(address(this), 30_000e6, 80_000e6);
        curator.fund(30_000e6);
        assertEq(curator.total_funded_wei(), 80_000e6);
    }

    event FundsReceived(address indexed from, uint256 amount, uint256 new_total_funded);

    /// Iter 55 audit fix: `fund(0)` was guarded by `if (amount == 0) revert
    /// ZeroAmount()` at Curator.sol:199 but no test pinned the revert. A
    /// silent failure here would let dashboards emit spurious
    /// `FundsReceived(_, 0, _)` events on every accidental zero-amount
    /// call, polluting the funding-history channel ops uses to reconcile
    /// the contract balance.
    function test_fund_revertsOnZeroAmount_iter55() public {
        usdc.mint(address(this), 1_000e6);
        usdc.approve(address(curator), 1_000e6);
        vm.expectRevert(Curator.ZeroAmount.selector);
        curator.fund(0);
        // Funded total stays at 0 — no event emitted.
        assertEq(curator.total_funded_wei(), 0, "iter55: zero-amount fund() must NOT advance total");
    }

    /// Iter 55 audit fix: symmetric GGG-1 coverage. `claim` is pinned for
    /// `transfer returns false` at test_claim_revertsOnTransferReturnsFalse
    /// (line 195) — but `fund` does the same return-value check on
    /// `transferFrom` at Curator.sol:200-201 and that branch had no test.
    /// USDT on mainnet famously returns void instead of bool, but other
    /// real ERC-20s (and any future Praetor-configured asset) may return
    /// false on transferFrom; the contract MUST refuse to advance the
    /// funding counter when that happens. Without this test a refactor
    /// dropping the `if (!ok)` check would silently increment
    /// total_funded_wei without USDC actually moving.
    function test_fund_revertsOnTransferFromReturnsFalse_iter55() public {
        usdc.mint(address(this), 1_000e6);
        usdc.approve(address(curator), 1_000e6);
        usdc.setTransferFromReturnsFalse(true);

        vm.expectRevert(
            abi.encodeWithSelector(
                Curator.UsdcTransferFailed.selector,
                address(curator),
                100e6
            )
        );
        curator.fund(100e6);

        // Load-bearing: counter MUST NOT advance on a failed transferFrom.
        // If the `if (!ok) revert` is ever stripped, this assertion catches
        // the silent funding-total drift.
        assertEq(curator.total_funded_wei(), 0, "iter55: failed fund() must NOT advance total_funded_wei");
    }

    // ── Sequential grants increment id ─────────────────────────────

    function test_grantIdIncrementsAcrossRounds() public {
        vm.startPrank(timelock);
        uint256 a = curator.createGrant(makeAddr("g1"), 1e6, keccak256("a"));
        uint256 b = curator.createGrant(makeAddr("g2"), 2e6, keccak256("b"));
        uint256 c = curator.createGrant(makeAddr("g3"), 3e6, keccak256("c"));
        vm.stopPrank();
        assertEq(a, 1);
        assertEq(b, 2);
        assertEq(c, 3);
        assertEq(curator.next_grant_id(), 3);
    }
}

contract MockUSDC {
    string public name = "USDC";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public transferReturnsFalse;
    /// Iter 55: gives test_fund_revertsOnTransferFromReturnsFalse_iter55 a
    /// way to simulate a misbehaving USDC token that returns false on
    /// transferFrom (per ERC-20 spec, allowed; Curator.fund must catch).
    bool public transferFromReturnsFalse;

    function setTransferReturnsFalse(bool v) external { transferReturnsFalse = v; }
    function setTransferFromReturnsFalse(bool v) external { transferFromReturnsFalse = v; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address sp, uint256 v) external returns (bool) { allowance[msg.sender][sp] = v; return true; }
    function transfer(address to, uint256 v) external returns (bool) {
        if (transferReturnsFalse) return false;
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
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
}
