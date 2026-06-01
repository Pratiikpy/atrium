// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {ResearchAttestation} from "../../contracts/research-attestation/src/ResearchAttestation.sol";

/// @title ResearchAttestation foundry test suite
/// @notice The backtest-commitment contract. Per PRD §22.2 patch 6 and
///         JUDGE_ONE_PAGER L-C1, the figures the one-pager promises
///         become judge-verifiable in 10 seconds once an attestation
///         publishes. This suite pins the publish gate (timelock-only),
///         the invariant check (`ipfs_hash != 0`), and the event payload.
contract ResearchAttestationTest is Test {
    ResearchAttestation internal ra;
    address internal timelock;
    address internal hostile;

    function setUp() public {
        timelock = makeAddr("timelock");
        hostile = makeAddr("hostile");
        ra = new ResearchAttestation(timelock);
    }

    function test_publish_onlyTimelock() public {
        vm.prank(hostile);
        vm.expectRevert(ResearchAttestation.Unauthorized.selector);
        ra.publish(keccak256("ipfs"), 100, 5500, "ipfs://Qm.../notebook.ipynb");
    }

    function test_publish_rejectsZeroIpfs() public {
        vm.prank(timelock);
        vm.expectRevert(ResearchAttestation.InvalidIpfsHash.selector);
        ra.publish(bytes32(0), 100, 5500, "ipfs://Qm.../notebook.ipynb");
    }

    function test_publish_happyPath_emitsEvent() public {
        bytes32 ipfs = keccak256("ipfs-cid");
        // Audit-aware values: Jamie's hedged-vs-unhedged ~55% saving in bps.
        vm.expectEmit(true, false, false, true, address(ra));
        emit ResearchAttestation.BacktestPublished(
            ipfs,
            12_847, // trades_count
            int256(5500), // collateral_delta_bps (55%)
            block.timestamp,
            "ipfs://Qm.../q1-2026-backtest.ipynb"
        );
        vm.prank(timelock);
        ra.publish(ipfs, 12_847, int256(5500), "ipfs://Qm.../q1-2026-backtest.ipynb");
    }

    function test_publish_supportsNegativeDelta() public {
        // The contract uses int256 specifically so a backtest can publish
        // a loss honestly. Verify it accepts negative deltas without revert.
        bytes32 ipfs = keccak256("losing-backtest");
        vm.prank(timelock);
        ra.publish(ipfs, 1_000, int256(-200), "ipfs://Qm.../losing-run.ipynb");
    }

    function test_publish_multipleAttestations_emitSeparately() public {
        bytes32 ipfs1 = keccak256("first");
        bytes32 ipfs2 = keccak256("second");

        vm.prank(timelock);
        ra.publish(ipfs1, 100, 5500, "url-1");

        // Each publish is an event-only record; nothing in storage prevents
        // republishing or publishing different runs. Verify a second publish
        // succeeds (no stuck single-shot state).
        vm.prank(timelock);
        ra.publish(ipfs2, 200, 5700, "url-2");
    }

    function test_publish_largeTradeCount() public {
        bytes32 ipfs = keccak256("ipfs-large");
        vm.prank(timelock);
        ra.publish(ipfs, type(uint256).max, int256(1), "url-stress");
    }

    // ── Audit DDD-5 lock: constructor zero-check ─────────────────────
    //
    // Without this guard, deploying with `_praetor_timelock == address(0)`
    // would brick the contract, only the timelock can publish, and
    // msg.sender == address(0) is structurally impossible.

    function test_constructor_revertsOnZeroTimelock_DDD5() public {
        vm.expectRevert(bytes("zero timelock"));
        new ResearchAttestation(address(0));
    }
}
