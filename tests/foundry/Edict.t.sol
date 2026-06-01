// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Edict} from "../../contracts/edict/src/Edict.sol";

/// @title Edict foundry test suite
/// @notice Edict gates Plinth + Coffer behind the user tier ladder. The judge
///         demo never crosses the Tier1 boundary, but every other production
///         path does. Mis-gating here would let an unverified wallet open
///         derivatives positions (audit T-19, T-20). This suite pins:
///           1. tierOf() default = Tier1
///           2. requireTier() reverts with the right selector + args
///           3. assignTier callers: only Sumsub verifier OR Praetor multisig
///           4. Sumsub proofs: cannot be zero, cannot be replayed
///           5. setSumsubVerifier: timelock-only (audit F-32)
contract EdictTest is Test {
    Edict internal edict;
    address internal praetor;
    address internal timelock;
    address internal sumsub;
    address internal hostile;
    address internal user;

    event TierAssigned(address indexed user, Edict.UserTier tier, uint64 timestamp, address indexed assigned_by);
    event SumsubVerifierUpdated(address indexed previous, address indexed next);

    function setUp() public {
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        sumsub = makeAddr("sumsub-verifier");
        hostile = makeAddr("hostile");
        user = makeAddr("user");
        edict = new Edict(praetor, timelock, sumsub);
    }

    // ── Default state ──────────────────────────────────────────────────

    function test_tierOf_defaultsToTier1() public view {
        assertEq(uint256(edict.tierOf(user)), uint256(Edict.UserTier.Tier1), "default tier must be Tier1");
        assertEq(edict.assigned_at(user), 0, "default assigned_at must be zero");
    }

    function test_requireTier_allowsTier1Default() public view {
        // No revert expected.
        edict.requireTier(user, Edict.UserTier.Tier1);
    }

    function test_requireTier_revertsWhenBelow() public {
        vm.expectRevert(
            abi.encodeWithSelector(Edict.TierTooLow.selector, Edict.UserTier.Tier3, Edict.UserTier.Tier1)
        );
        edict.requireTier(user, Edict.UserTier.Tier3);
    }

    /// Iter 83: pin exact-match passes (Tier2 user requiring Tier2).
    function test_requireTier_allowsExactMatch_iter83() public {
        vm.prank(sumsub);
        edict.assignTier(user, Edict.UserTier.Tier2, keccak256("proof-iter83a"));
        // No revert expected: required == actual.
        edict.requireTier(user, Edict.UserTier.Tier2);
    }

    /// Iter 83: pin higher-tier-passes (Tier3 user requiring Tier1).
    /// Without this test, a refactor that swapped the comparison from
    /// `<` to `!=` would silently reject every legitimately-higher user.
    function test_requireTier_allowsHigherTier_iter83() public {
        vm.prank(sumsub);
        edict.assignTier(user, Edict.UserTier.Tier3, keccak256("proof-iter83b"));
        edict.requireTier(user, Edict.UserTier.Tier1);
        edict.requireTier(user, Edict.UserTier.Tier2);
        edict.requireTier(user, Edict.UserTier.Tier3);
    }

    /// Iter 83: revert path carries the right error args (required, actual).
    /// Pre-fix, a refactor could swap the two args and the catch in calling
    /// code would log misleading values. Pin both args explicitly.
    function test_requireTier_revertArgsOrder_required_actual_iter83() public {
        // Default user is Tier1; we require Tier4 → revert with
        // (required=Tier4, actual=Tier1).
        vm.expectRevert(
            abi.encodeWithSelector(
                Edict.TierTooLow.selector,
                Edict.UserTier.Tier4,    // required (first arg)
                Edict.UserTier.Tier1     // actual (second arg)
            )
        );
        edict.requireTier(user, Edict.UserTier.Tier4);
    }

    // ── assignTier() gating ───────────────────────────────────────────

    function test_assignTier_onlySumsubOrPraetor() public {
        vm.prank(hostile);
        vm.expectRevert(Edict.Unauthorized.selector);
        edict.assignTier(user, Edict.UserTier.Tier3, keccak256("proof"));

        // Timelock cannot directly assign, only Sumsub or Praetor.
        vm.prank(timelock);
        vm.expectRevert(Edict.Unauthorized.selector);
        edict.assignTier(user, Edict.UserTier.Tier3, keccak256("proof"));
    }

    function test_assignTier_praetor_acceptsZeroProof() public {
        // Manual Praetor override uses proof=0 by convention.
        vm.warp(1_700_000_000);
        vm.expectEmit(true, true, false, true, address(edict));
        emit TierAssigned(user, Edict.UserTier.Tier2, 1_700_000_000, praetor);

        vm.prank(praetor);
        edict.assignTier(user, Edict.UserTier.Tier2, bytes32(0));

        assertEq(uint256(edict.tierOf(user)), uint256(Edict.UserTier.Tier2));
        assertEq(uint256(edict.assigned_at(user)), 1_700_000_000);
    }

    function test_assignTier_sumsub_rejectsZeroProof() public {
        // Sumsub-attested path requires a non-zero proof.
        vm.prank(sumsub);
        vm.expectRevert(abi.encodeWithSelector(Edict.InvalidProof.selector, bytes32(0)));
        edict.assignTier(user, Edict.UserTier.Tier3, bytes32(0));
    }

    function test_assignTier_sumsub_rejectsReplay() public {
        bytes32 proof = keccak256("sumsub-attestation-1");

        vm.prank(sumsub);
        edict.assignTier(user, Edict.UserTier.Tier3, proof);
        assertEq(uint256(edict.tierOf(user)), uint256(Edict.UserTier.Tier3));

        // Same proof, second time, must revert.
        address otherUser = makeAddr("other-user");
        vm.prank(sumsub);
        vm.expectRevert(abi.encodeWithSelector(Edict.ProofReplay.selector, proof));
        edict.assignTier(otherUser, Edict.UserTier.Tier3, proof);
    }

    function test_assignTier_sumsub_distinctProofsBothSucceed() public {
        vm.prank(sumsub);
        edict.assignTier(user, Edict.UserTier.Tier2, keccak256("proof-a"));

        address other = makeAddr("other");
        vm.prank(sumsub);
        edict.assignTier(other, Edict.UserTier.Tier3, keccak256("proof-b"));

        assertEq(uint256(edict.tierOf(user)), uint256(Edict.UserTier.Tier2));
        assertEq(uint256(edict.tierOf(other)), uint256(Edict.UserTier.Tier3));
    }

    function test_assignTier_canDowngrade() public {
        // Praetor must be able to demote (compliance recall, sanctions hit).
        vm.prank(praetor);
        edict.assignTier(user, Edict.UserTier.Tier3, bytes32(0));

        vm.prank(praetor);
        edict.assignTier(user, Edict.UserTier.Tier1, bytes32(0));

        assertEq(uint256(edict.tierOf(user)), uint256(Edict.UserTier.Tier1), "downgrade must take effect");
    }

    function test_assignTier_higherTierUnlocksLowerRequire() public {
        vm.prank(praetor);
        edict.assignTier(user, Edict.UserTier.Tier4, bytes32(0));

        // No revert, Tier4 satisfies any lower requirement.
        edict.requireTier(user, Edict.UserTier.Tier1);
        edict.requireTier(user, Edict.UserTier.Tier2);
        edict.requireTier(user, Edict.UserTier.Tier3);
        edict.requireTier(user, Edict.UserTier.Tier4);
    }

    // ── setSumsubVerifier() gating (F-32 fix) ─────────────────────────

    function test_setSumsubVerifier_onlyTimelock() public {
        // Multisig direct call must revert, parameter change requires the
        // 48h objection window. This is the F-32 audit fix locked in.
        vm.prank(praetor);
        vm.expectRevert(Edict.Unauthorized.selector);
        edict.setSumsubVerifier(makeAddr("rotated"));

        vm.prank(sumsub);
        vm.expectRevert(Edict.Unauthorized.selector);
        edict.setSumsubVerifier(makeAddr("rotated"));
    }

    function test_setSumsubVerifier_timelock_happyPath() public {
        address next = makeAddr("rotated-sumsub");

        vm.expectEmit(true, true, false, false, address(edict));
        emit SumsubVerifierUpdated(sumsub, next);

        vm.prank(timelock);
        edict.setSumsubVerifier(next);

        assertEq(edict.sumsubVerifier(), next, "rotation did not persist");

        // Old verifier rejected; new verifier accepted.
        vm.prank(sumsub);
        vm.expectRevert(Edict.Unauthorized.selector);
        edict.assignTier(user, Edict.UserTier.Tier3, keccak256("p"));

        vm.prank(next);
        edict.assignTier(user, Edict.UserTier.Tier3, keccak256("p"));
        assertEq(uint256(edict.tierOf(user)), uint256(Edict.UserTier.Tier3));
    }

    // ── Audit LLL-1 lock: constructor zero-checks ────────────────────
    //
    // Per LLL-1 comment: zero-praetor would lock the manual-override path
    // (Unauthorized always-taken); zero-timelock would brick the
    // sumsubVerifier rotation; zero-sumsub combined with either would
    // leave the registry unable to assign tiers at all.

    function test_constructor_revertsOnZeroPraetor_LLL1() public {
        vm.expectRevert(bytes("zero praetor"));
        new Edict(address(0), timelock, sumsub);
    }

    function test_constructor_revertsOnZeroTimelock_LLL1() public {
        vm.expectRevert(bytes("zero timelock"));
        new Edict(praetor, address(0), sumsub);
    }

    function test_constructor_revertsOnZeroSumsubVerifier_LLL1() public {
        vm.expectRevert(bytes("zero sumsub verifier"));
        new Edict(praetor, timelock, address(0));
    }

    // ── Audit iteration 44 lock: setSumsubVerifier mirrors LLL-1 ──────
    //
    // Partial-coverage closer: constructor's LLL-1 check guarded
    // `_sumsubVerifier != address(0)`, but the setter accepted any
    // address including zero. Praetor accidentally scheduling a rotation
    // to zero would brick the sumsub callback path for 48h until another
    // rotation landed. Same shape as iter 43 LanternAttestor.rotateSigningKey.

    function test_setSumsubVerifier_rejectsZeroAddress_iter44() public {
        vm.prank(timelock);
        vm.expectRevert(Edict.ZeroAddressVerifier.selector);
        edict.setSumsubVerifier(address(0));
    }

    function test_setSumsubVerifier_rejectsNoOpRotation_iter44() public {
        // Praetor typo-rotates to the current verifier address. Pre-fix
        // this would emit a misleading SumsubVerifierUpdated event with
        // identical from/to and consume a timelock slot. Now: bail loud.
        vm.prank(timelock);
        vm.expectRevert(Edict.NoOpVerifierRotation.selector);
        edict.setSumsubVerifier(sumsub);
    }
}
