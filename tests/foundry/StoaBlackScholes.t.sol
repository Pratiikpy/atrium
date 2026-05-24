// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {StoaBlackScholes} from "../../contracts/stoa/src/StoaBlackScholes.sol";

/// @title StoaBlackScholes Phase-2 scaffold tests
/// @notice Two jobs:
///         1. Pin the public interface (signatures + revert reasons) so the
///            Codex `/v1/options/price` endpoint and Plinth's options-margin
///            call site can target stable signatures while Phase-2 fills math.
///         2. Verify the conservative-upper-bound fallback in
///            `margin_for_long_call` so an accidental routing to the scaffold
///            on testnet cannot under-margin a position.
contract StoaBlackScholesTest is Test {
    StoaBlackScholes internal stoa;

    function setUp() public {
        stoa = new StoaBlackScholes();
    }

    function test_moduleStatus_signalsScaffold() public view {
        assertEq(stoa.module_status(), "phase-2-scaffold");
    }

    // ── Input validation: price_call ─────────────────────────────────

    function test_priceCall_revertsOnZeroSpot() public {
        vm.expectRevert(abi.encodeWithSelector(StoaBlackScholes.InvalidInput.selector, "spot"));
        stoa.price_call(0, 1e18, 5e17, 5e16, 30 days);
    }

    function test_priceCall_revertsOnZeroStrike() public {
        vm.expectRevert(abi.encodeWithSelector(StoaBlackScholes.InvalidInput.selector, "strike"));
        stoa.price_call(1e18, 0, 5e17, 5e16, 30 days);
    }

    function test_priceCall_revertsOnZeroVol() public {
        vm.expectRevert(abi.encodeWithSelector(StoaBlackScholes.InvalidInput.selector, "vol"));
        stoa.price_call(1e18, 1e18, 0, 5e16, 30 days);
    }

    function test_priceCall_revertsOnZeroTime() public {
        vm.expectRevert(abi.encodeWithSelector(StoaBlackScholes.InvalidInput.selector, "time_to_expiry"));
        stoa.price_call(1e18, 1e18, 5e17, 5e16, 0);
    }

    function test_priceCall_scaffoldReturnsZero() public view {
        // Until Phase-2 lands the math, scaffold returns 0 — locked behavior
        // so Codex can detect-and-degrade rather than reporting a non-existent
        // option price as live.
        uint256 p = stoa.price_call(2_000e18, 2_100e18, 8e17, 5e16, 30 days);
        assertEq(p, 0);
    }

    // ── price_put symmetry ───────────────────────────────────────────

    function test_pricePut_revertsOnZeroSpot() public {
        vm.expectRevert(abi.encodeWithSelector(StoaBlackScholes.InvalidInput.selector, "spot"));
        stoa.price_put(0, 1e18, 5e17, 5e16, 30 days);
    }

    function test_pricePut_scaffoldReturnsZero() public view {
        uint256 p = stoa.price_put(2_000e18, 2_100e18, 8e17, 5e16, 30 days);
        assertEq(p, 0);
    }

    // ── Greeks ────────────────────────────────────────────────────────

    function test_greeks_revertsOnZeroVol() public {
        vm.expectRevert(abi.encodeWithSelector(StoaBlackScholes.InvalidInput.selector, "vol"));
        stoa.greeks_call(1e18, 1e18, 0, 5e16, 30 days);
    }

    function test_greeks_scaffoldReturnsZeros() public view {
        StoaBlackScholes.Greeks memory g = stoa.greeks_call(2_000e18, 2_100e18, 8e17, 5e16, 30 days);
        assertEq(g.delta_e18, 0);
        assertEq(g.gamma_e18, 0);
        assertEq(g.vega_e18, 0);
        assertEq(g.theta_e18, 0);
        assertEq(g.rho_e18, 0);
    }

    // ── Conservative-fallback assertion ──────────────────────────────

    function test_marginForLongCall_returnsFullNotionalAsUpperBound() public view {
        // 1 contract @ spot 2_000e18 → scaffold returns 2_000e18 as the
        // conservative SPAN margin upper bound. A real BSM-derived margin
        // would be smaller (a fraction of notional). The scaffold cannot
        // under-margin a real position by definition.
        uint256 margin = stoa.margin_for_long_call(2_000e18, 2_100e18, 8e17, 5e16, 30 days, 1e18);
        assertEq(margin, 2_000e18);
    }

    function test_marginForLongCall_scalesWithContracts() public view {
        uint256 margin = stoa.margin_for_long_call(2_000e18, 2_100e18, 8e17, 5e16, 30 days, 5e18);
        assertEq(margin, 10_000e18); // 5x the 1-contract value
    }

    function test_marginForLongCall_revertsOnZeroContracts() public {
        vm.expectRevert(abi.encodeWithSelector(StoaBlackScholes.InvalidInput.selector, "contracts"));
        stoa.margin_for_long_call(2_000e18, 2_100e18, 8e17, 5e16, 30 days, 0);
    }

    function test_marginForLongCall_revertsOnZeroSpot() public {
        vm.expectRevert(abi.encodeWithSelector(StoaBlackScholes.InvalidInput.selector, "spot"));
        stoa.margin_for_long_call(0, 2_100e18, 8e17, 5e16, 30 days, 1e18);
    }

    // ── Fuzz: conservative-upper-bound property ──────────────────────
    // Scaffold MUST never return less than (spot_e18 * contracts_e18) / 1e18
    // — that is the upper bound a real BSM SPAN value can never exceed.
    // This property is what Plinth relies on to treat the scaffold output as
    // a strict ceiling so a scaffold cannot under-margin a real position.
    //
    // The 256 fuzz runs (foundry.toml default) sample the full uint128 space
    // for inputs, way past any realistic option setup. If a future refactor
    // accidentally reduces the upper bound (e.g., bps haircut, vol discount,
    // anything BSM-flavored), this test fails before the change can ship.

    function testFuzz_marginForLongCall_isConservativeUpperBound(
        uint128 spot,
        uint128 strike,
        uint128 vol,
        uint128 rate,
        uint64 expirySeconds,
        uint128 contractsCount
    ) public view {
        // Bound to the scaffold's accepted input space (non-zero required).
        vm.assume(spot > 0);
        vm.assume(strike > 0);
        vm.assume(vol > 0);
        vm.assume(expirySeconds > 0);
        vm.assume(contractsCount > 0);

        uint256 spot_e18 = uint256(spot);
        uint256 contracts_e18 = uint256(contractsCount);
        // Skip combinations that would overflow on `spot_e18 * contracts_e18`.
        // type(uint256).max / max(uint128) ~= 2^128, so combined inputs above
        // that threshold can't arise in any realistic option setup.
        vm.assume(spot_e18 == 0 || contracts_e18 <= type(uint256).max / spot_e18);

        uint256 margin = stoa.margin_for_long_call(
            spot_e18,
            uint256(strike),
            uint256(vol),
            uint256(rate),
            uint256(expirySeconds),
            contracts_e18
        );
        uint256 expectedUpperBound = (spot_e18 * contracts_e18) / 1e18;
        // Scaffold contract must return exactly the conservative upper bound.
        // Plinth's invariant relies on this being a strict equality, not just
        // >=, so a future Phase-2 swap doesn't silently lower margin while
        // claiming to be the same scaffold.
        assertEq(margin, expectedUpperBound);
    }
}
