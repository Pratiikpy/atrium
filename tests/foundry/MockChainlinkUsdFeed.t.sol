// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {MockChainlinkUsdFeed} from "../../contracts/mocks/MockChainlinkUsdFeed.sol";

/// @title MockChainlinkUsdFeed, testnet-stub behavior tests
/// @notice Pins the two invariants PlinthOracle.safe_price relies on: the feed
///         is ALWAYS fresh (updatedAt == block.timestamp, answeredInRound ==
///         roundId so the stale-round + freshness gates always pass) and the
///         admin can move the mark to exercise the disagreement path on-chain.
contract MockChainlinkUsdFeedTest is Test {
    MockChainlinkUsdFeed internal feed;
    address internal admin;
    address internal hostile;

    function setUp() public {
        admin = makeAddr("admin");
        hostile = makeAddr("hostile");
        vm.prank(admin);
        feed = new MockChainlinkUsdFeed(int256(100_000_000), 8, "USDC / USD (testnet mock)");
    }

    function test_latestRoundData_isAlwaysFreshAndComplete() public {
        vm.warp(1_780_000_000); // arbitrary future timestamp
        (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) =
            feed.latestRoundData();
        assertEq(answer, int256(100_000_000), "$1.00 @ 8 decimals");
        assertEq(updatedAt, block.timestamp, "updatedAt is always now (passes 60s freshness)");
        assertEq(startedAt, block.timestamp, "startedAt is now");
        assertEq(answeredInRound, roundId, "answeredInRound == roundId (passes stale-round gate)");
        assertEq(feed.decimals(), 8);
    }

    function test_setAnswer_advancesRound_adminOnly() public {
        (uint80 r0,,,,) = feed.latestRoundData();
        vm.prank(admin);
        feed.setAnswer(int256(99_990_000)); // $0.9999
        (uint80 r1, int256 a1,,,) = feed.latestRoundData();
        assertEq(a1, int256(99_990_000), "new answer set");
        assertEq(r1, r0 + 1, "round advanced");
    }

    function test_setAnswer_rejectsNonAdmin() public {
        vm.prank(hostile);
        vm.expectRevert(MockChainlinkUsdFeed.NotAdmin.selector);
        feed.setAnswer(int256(1));
    }

    function test_constructor_rejectsNonPositiveAnswer() public {
        vm.expectRevert(bytes("answer must be positive"));
        new MockChainlinkUsdFeed(int256(0), 8, "bad");
    }

    function test_setAnswer_rejectsNonPositive() public {
        vm.prank(admin);
        vm.expectRevert(bytes("answer must be positive"));
        feed.setAnswer(int256(-1));
    }
}
