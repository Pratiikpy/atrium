// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {AtriumRouter} from "../../contracts/atrium-router/src/AtriumRouter.sol";
import {CurveAdapter} from "../../contracts/adapters/curve/src/CurveAdapter.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title AtriumRouter — end-to-end integration test
/// @notice Closes `human_left.md` #31 (Wave-EEEE finding): pre-Router the
///         Plinth → Coffer → adapter chain was unwired. PRD Verifier-Mode
///         Step 2 ("Open hedged position") had no working code path.
///
///         This suite exercises the four-step Router orchestration end-to-
///         end through a fake Coffer and fake Plinth, with the real
///         CurveAdapter. The fake stand-ins faithfully implement the
///         narrow interfaces the Router actually calls — adapter_pull,
///         open_position, getAccount. The CurveAdapter is real so the
///         migration from `onlyCoffer` → `onlyAuthorizedCaller` is
///         exercised against production code, not a mock.
contract AtriumRouterTest is Test {
    AtriumRouter internal router;
    FakeCoffer internal coffer;
    FakePlinth internal plinth;
    FakeRegistry internal registry;
    CurveAdapter internal curve;
    MockCurvePool internal pool;
    MockERC20 internal usdc;
    MockERC20 internal lpToken;

    address internal user;
    address internal praetor;
    address internal timelock;
    address internal hostile;

    bytes32 internal constant INSTRUMENT = keccak256("CURVE-3POOL-USDC");
    uint8 internal constant CURVE_VENUE_ID = 5;

    event PositionOpenedViaRouter(
        address indexed user,
        uint8 indexed venue_id,
        bytes32 indexed instrument_id,
        int256 notional_signed,
        uint256 plinth_position_id,
        uint256 venue_position_id
    );

    function setUp() public {
        user = makeAddr("user");
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        hostile = makeAddr("hostile");

        usdc = new MockERC20("USDC", 6);
        lpToken = new MockERC20("crv3pool", 18);
        pool = new MockCurvePool(address(usdc), address(lpToken));
        coffer = new FakeCoffer(address(usdc));
        plinth = new FakePlinth();
        registry = new FakeRegistry();

        curve = new CurveAdapter(
            address(pool),
            address(usdc),
            address(lpToken),
            int128(0),
            address(coffer),
            praetor,
            timelock,
            INSTRUMENT
        );

        router = new AtriumRouter(address(plinth), address(coffer), address(registry), praetor);

        // Wire the dependencies. Coffer needs Router on its approved-adapters
        // list (real Coffer's Praetor-controlled mapping). Registry needs to
        // know which adapter handles the Curve venue id. Curve adapter
        // needs the Router on its authorized-caller list.
        coffer.setApprovedAdapter(address(router), true);
        registry.setAdapter(CURVE_VENUE_ID, address(curve));
        vm.prank(praetor);
        curve.setAuthorizedCaller(address(router), true);

        // Fund: user owns shares in Coffer (= USDC claim), pool has USDC to
        // mint LP and to settle on close.
        coffer.creditShares(user, 10_000_000 * 10 ** 6);
        usdc.mint(address(coffer), 10_000_000 * 10 ** 6);
        usdc.mint(address(pool), 10_000_000 * 10 ** 6);
    }

    // ── End-to-end open path (the load-bearing test) ─────────────────

    function test_open_via_router_endToEnd_chainExecutes() public {
        bytes memory empty = hex"";

        vm.expectEmit(true, true, true, true, address(router));
        emit PositionOpenedViaRouter(user, CURVE_VENUE_ID, INSTRUMENT, int256(1_000e6), 1, 1);

        vm.prank(user);
        (uint256 plinthId, uint256 venueId) = router.open_position_via_adapter(
            CURVE_VENUE_ID,
            INSTRUMENT,
            int256(1_000e6),
            empty,
            empty,
            empty
        );

        assertEq(plinthId, 1, "plinth must return a position id");
        assertEq(venueId, 1, "adapter must return a venue position id");

        // Pre-Router these four assertions could not all be true at once:
        //   1. Plinth saw the open call.
        //   2. Coffer's adapter_pull moved USDC to the adapter.
        //   3. Curve adapter recorded the position.
        //   4. The originator on the Curve position is `user`, not the Router.
        assertTrue(plinth.openCalled(), "Plinth.open_position must be invoked");
        assertEq(coffer.lastAdapterPullAmount(), 1_000e6, "Coffer.adapter_pull must run");
        assertEq(coffer.lastAdapterPullTo(), address(curve), "USDC must route to the curve adapter");
        IPorticoAdapter.PositionView memory view_ = curve.get_position(venueId);
        assertEq(view_.owner, user, "originator must be user (G-5), not router");
    }

    function test_open_via_router_revertsIfAccountPaused() public {
        plinth.setPaused(user, true);
        bytes memory empty = hex"";

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AtriumRouter.AccountPaused.selector, user));
        router.open_position_via_adapter(CURVE_VENUE_ID, INSTRUMENT, int256(1_000e6), empty, empty, empty);
    }

    // ── FIRE76-1 fix (sub-agent finding HIGH) ────────────────────────
    //
    // Pre-fix, close_position_via_adapter had NO ownership check. User B
    // could pass user A's plinth_position_id and trigger an unconsented
    // unwind. The Router now reads plinth.get_position(id).owner and
    // reverts NotPositionOwner if it doesn't match msg.sender. This test
    // pins the rejection.

    function test_close_via_router_rejectsNonOwner_FIRE76_1() public {
        bytes memory empty = hex"";

        // User A opens a position.
        vm.prank(user, user); // (sender, tx.origin) — FakePlinth records origin
        (uint256 plinthId, uint256 venueId) =
            router.open_position_via_adapter(CURVE_VENUE_ID, INSTRUMENT, int256(1_000e6), empty, empty, empty);

        // Hostile tries to close user's position.
        vm.prank(hostile, hostile);
        vm.expectRevert(
            abi.encodeWithSelector(AtriumRouter.NotPositionOwner.selector, plinthId, hostile, user)
        );
        router.close_position_via_adapter(CURVE_VENUE_ID, plinthId, venueId, empty);
    }

    function test_open_via_router_revertsOnUnregisteredVenue() public {
        bytes memory empty = hex"";
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AtriumRouter.VenueNotRegistered.selector, uint8(99)));
        router.open_position_via_adapter(99, INSTRUMENT, int256(1_000e6), empty, empty, empty);
    }

    /// Iter 87: pin VenueNotRegistered on CLOSE path. Same revert exists
    /// at AtriumRouter.sol:245 (close_position_via_adapter) but only the
    /// open path had a test. Mirror of iter 53's FIRE78-COF2 partial-
    /// coverage: when an audit check lives on both open AND close, the
    /// test pair is the canonical proof both branches stay live.
    ///
    /// Setup: open a position normally on a registered venue, then
    /// deregister the adapter for that venue, then attempt close → must
    /// revert with VenueNotRegistered.
    /// Iter 94: pin "close on unknown plinth_position_id reverts as
    /// NotPositionOwner". Plinth returns owner=address(0) for unknown
    /// IDs; the FIRE76-1 check at AtriumRouter.sol:242 compares user vs
    /// address(0) → reverts NotPositionOwner(id, user, address(0)).
    /// Without this test, a future refactor switching to a "PositionNotFound"
    /// error class would silently change error semantics for callers.
    function test_close_via_router_unknownPositionId_revertsAsNotOwner_iter94() public {
        bytes memory empty = hex"";
        uint256 unknownId = 12345;

        vm.prank(user, user);
        vm.expectRevert(
            abi.encodeWithSelector(
                AtriumRouter.NotPositionOwner.selector,
                unknownId,
                user,
                address(0) // unknown id → owner returned as address(0)
            )
        );
        router.close_position_via_adapter(CURVE_VENUE_ID, unknownId, 999, empty);
    }

    /// Iter 91: pin PositionClosedViaRouter emit. The open-side event
    /// has been asserted since the iter-50-era happy-path test; the
    /// close-side emit was not. Subgraph indexes both — dropped close
    /// emit would silently desync the position-lifecycle dashboard.
    event PositionClosedViaRouter(
        address indexed user,
        uint8 indexed venue_id,
        uint256 indexed plinth_position_id,
        uint256 venue_position_id,
        int256 realized_pnl_signed
    );

    function test_close_via_router_emitsPositionClosedViaRouter_iter91() public {
        bytes memory empty = hex"";

        vm.prank(user, user);
        (uint256 plinthId, uint256 venueId) =
            router.open_position_via_adapter(CURVE_VENUE_ID, INSTRUMENT, int256(1_000e6), empty, empty, empty);

        // Mock curve adapter's close_position returns 0 PnL (no oracle yet).
        // Assert the close emit fires with the user + venue + plinthId
        // indexed topics + the venueId + zero pnl in data.
        vm.expectEmit(true, true, true, true, address(router));
        emit PositionClosedViaRouter(user, CURVE_VENUE_ID, plinthId, venueId, int256(0));

        vm.prank(user, user);
        router.close_position_via_adapter(CURVE_VENUE_ID, plinthId, venueId, empty);
    }

    function test_close_via_router_revertsOnUnregisteredVenue_iter87() public {
        bytes memory empty = hex"";

        // Open normally on the registered venue.
        vm.prank(user, user);
        (uint256 plinthId, uint256 venueId) =
            router.open_position_via_adapter(CURVE_VENUE_ID, INSTRUMENT, int256(1_000e6), empty, empty, empty);

        // Praetor deregisters the adapter (simulates emergency-deregister
        // or routine timelock-deregister landing between open and close).
        registry.setAdapter(CURVE_VENUE_ID, address(0));

        // Close now resolves adapter_addr == 0 → revert VenueNotRegistered.
        vm.prank(user, user);
        vm.expectRevert(
            abi.encodeWithSelector(AtriumRouter.VenueNotRegistered.selector, CURVE_VENUE_ID)
        );
        router.close_position_via_adapter(CURVE_VENUE_ID, plinthId, venueId, empty);
    }

    function test_curve_directCall_byUnauthorized_stillRejected() public {
        // The `onlyAuthorizedCaller` migration MUST keep the security
        // invariant: random callers can't open a position by reaching the
        // adapter directly. Only Coffer (immutable) + setAuthorizedCaller
        // adds (Router) get through. This regression test pins it.
        bytes memory payload = abi.encodePacked(user);
        vm.prank(hostile);
        vm.expectRevert(CurveAdapter.Unauthorized.selector);
        curve.open_position(INSTRUMENT, int256(1_000e6), payload);
    }

    function test_curve_directCall_byCoffer_stillWorks() public {
        // Backwards-compatible: existing call sites that route via Coffer
        // continue to function. Pre-migration tests passed this; this pin
        // documents that the migration didn't regress them.
        bytes memory payload = abi.encodePacked(user);
        vm.prank(address(coffer));
        uint256 id = curve.open_position(INSTRUMENT, int256(1_000e6), payload);
        assertEq(id, 1);
    }

    // ── setAuthorizedCaller gating ───────────────────────────────────

    function test_setAuthorizedCaller_onlyPraetor() public {
        vm.prank(hostile);
        vm.expectRevert(CurveAdapter.Unauthorized.selector);
        curve.setAuthorizedCaller(makeAddr("other-router"), true);

        // Even timelock can't set this — onlyPraetor (multisig) only, because
        // routing decisions are emergency-response level, not parameter-class.
        vm.prank(timelock);
        vm.expectRevert(CurveAdapter.Unauthorized.selector);
        curve.setAuthorizedCaller(makeAddr("other-router"), true);
    }

    function test_setAuthorizedCaller_emitsEvent() public {
        address newRouter = makeAddr("future-router");

        vm.expectEmit(true, false, false, true, address(curve));
        emit CurveAdapter.AuthorizedCallerUpdated(newRouter, true);

        vm.prank(praetor);
        curve.setAuthorizedCaller(newRouter, true);
        assertTrue(curve.is_authorized_caller(newRouter));

        vm.expectEmit(true, false, false, true, address(curve));
        emit CurveAdapter.AuthorizedCallerUpdated(newRouter, false);

        vm.prank(praetor);
        curve.setAuthorizedCaller(newRouter, false);
        assertFalse(curve.is_authorized_caller(newRouter));
    }

    // ── Constructor zero-checks on the Router itself ─────────────────

    function test_router_constructor_revertsOnZeroPlinth() public {
        vm.expectRevert(bytes("zero plinth"));
        new AtriumRouter(address(0), address(coffer), address(registry), praetor);
    }

    function test_router_constructor_revertsOnZeroCoffer() public {
        vm.expectRevert(bytes("zero coffer"));
        new AtriumRouter(address(plinth), address(0), address(registry), praetor);
    }

    function test_router_constructor_revertsOnZeroRegistry() public {
        vm.expectRevert(bytes("zero registry"));
        new AtriumRouter(address(plinth), address(coffer), address(0), praetor);
    }

    function test_router_constructor_revertsOnZeroPraetor() public {
        vm.expectRevert(bytes("zero praetor"));
        new AtriumRouter(address(plinth), address(coffer), address(registry), address(0));
    }

    // ── Audit iteration 50 lock: FIRE78-COF2 actually built now ───────
    //
    // Pre-fix the AtriumRouter docstring (lines 47-55) PROMISED that the
    // Router would refuse to route through an adapter that is also
    // independently on Coffer's approved-adapters list. The
    // ICofferApprovedQuery interface, AdapterAlsoApprovedAsOrchestrator
    // error, and the FIRE78-COF2 audit comment all existed — but the
    // actual `is_adapter_approved` call site didn't. The defense was
    // documented but unbuilt. Iteration 50 added the check at both open
    // + close paths.

    function test_open_via_router_rejectsAdapterAlsoApprovedAsOrchestrator_iter50() public {
        // Praetor multisig misconfiguration: the resolved adapter was
        // ALSO added to Coffer's approved-adapters list (alongside the
        // Router). Without the check, that adapter could call
        // `coffer.adapter_pull` directly, bypassing Router-level position
        // limits + ownership checks. With the check: refuse to route.
        address adapter = address(0xA0BE);
        registry.setAdapter(1, adapter);
        coffer.setApprovedAdapter(adapter, true);  // the misconfiguration

        vm.expectRevert(
            abi.encodeWithSelector(AtriumRouter.AdapterAlsoApprovedAsOrchestrator.selector, adapter)
        );
        router.open_position_via_adapter(
            1,
            keccak256("INST"),
            int256(1000e6),
            new bytes(0),
            new bytes(0),
            abi.encodePacked(address(this))
        );
    }

    function test_close_via_router_rejectsAdapterAlsoApprovedAsOrchestrator_iter53() public {
        // Symmetric to the open-path test above. Iter 50 added the FIRE78-COF2
        // check to BOTH open and close paths but only added the open-path
        // test — same partial-coverage shape as iter 18 multisig::execute
        // and iter 43 LanternAttestor.rotateSigningKey. The close path
        // matters too: a malicious sub-adapter could call coffer.adapter_pull
        // during close_position to drain more than the position's actual
        // redemption.
        bytes memory empty = hex"";

        // First open a position via curve to get a real plinth_position_id +
        // venue_position_id. The open path uses CURVE_VENUE_ID; curve is
        // NOT on Coffer's approved-adapters list (Router is, curve isn't),
        // so the open path's FIRE78-COF2 check passes for curve.
        vm.prank(user, user);
        (uint256 plinthId, uint256 venueId) =
            router.open_position_via_adapter(CURVE_VENUE_ID, INSTRUMENT, int256(1_000e6), empty, empty, empty);

        // NOW the Praetor multisig misconfiguration lands AFTER the position
        // opened: curve gets added to Coffer's approved-adapters list. On
        // close, the FIRE78-COF2 check should refuse to route through curve
        // even though it's the same adapter that opened the position.
        coffer.setApprovedAdapter(address(curve), true);

        vm.prank(user, user);
        vm.expectRevert(
            abi.encodeWithSelector(
                AtriumRouter.AdapterAlsoApprovedAsOrchestrator.selector,
                address(curve)
            )
        );
        router.close_position_via_adapter(CURVE_VENUE_ID, plinthId, venueId, empty);
    }

    /// Iter 58 audit fix: pin the FIRE76-2 margin-delta pull behavior.
    /// Pre-FIRE76-2, the Router asked Coffer for the full notional on
    /// every open, draining 10× what Plinth approved for leveraged
    /// positions. The fix at AtriumRouter.sol:159-213 reads
    /// `required_margin_wei` before and after `plinth.open_position`
    /// and pulls only the delta (the margin Plinth actually approved
    /// for this position).
    ///
    /// Without this test, the FakePlinth's `getAccount` returned
    /// required=0 unconditionally, so `required_after - required_before`
    /// was always 0 and the Router fell back to abs(notional). Every
    /// existing test exercised the FALLBACK path, leaving the
    /// load-bearing margin-delta read totally uncovered.
    ///
    /// Setup: 10× leverage = 100k notional / 10k margin. Without the
    /// fix, Coffer would be asked for 100k. With the fix, it's asked
    /// for 10k. A 90k delta is the user-funds-loss vector.
    function test_open_via_router_pullsMarginDeltaNotNotional_FIRE76_2_iter58() public {
        bytes memory empty = hex"";

        // Configure FakePlinth so opening this position raises
        // required_margin by 10k — i.e., a 10× leveraged 100k position.
        plinth.setMarginIncreasePerOpen(10_000e6);

        vm.prank(user, user);
        router.open_position_via_adapter(
            CURVE_VENUE_ID,
            INSTRUMENT,
            int256(100_000e6),  // 100k notional
            empty,
            empty,
            empty
        );

        // Load-bearing: Coffer was asked to move 10k (margin delta),
        // NOT 100k (raw notional). Pre-FIRE76-2 this would have been
        // 100_000e6 and the user would have been drained 10× the
        // approved margin.
        assertEq(
            coffer.lastAdapterPullAmount(),
            10_000e6,
            "FIRE76-2: Coffer.adapter_pull must move the margin delta, not the notional"
        );
        // Sanity: required_margin actually advanced on the user (proves
        // the FakePlinth wiring + Router delta-read coupled correctly).
        (, uint256 required_after,,) = plinth.getAccount(user);
        assertEq(required_after, 10_000e6, "iter58: FakePlinth required-margin tracker landed");
    }

    /// Iter 97: fuzz the FIRE76-2 margin-delta invariant — Coffer pull
    /// amount must EQUAL the margin delta (when non-zero), regardless of
    /// notional size. Pre-FIRE76-2 the Router pulled raw notional → fuzz
    /// across random (notional, margin_delta) pairs to catch any drift.
    function testFuzz_open_via_router_pullsExactMarginDelta_FIRE76_2_iter97(
        uint64 marginDelta,
        int64 notional
    ) public {
        vm.assume(marginDelta > 0 && marginDelta <= 10_000_000e6); // bounded
        vm.assume(notional != 0);
        if (notional < 0) notional = -int64(int128(int256(uint256(uint64(-notional)))));

        plinth.setMarginIncreasePerOpen(uint256(marginDelta));

        bytes memory empty = hex"";
        vm.prank(user, user);
        router.open_position_via_adapter(
            CURVE_VENUE_ID, INSTRUMENT, int256(notional), empty, empty, empty
        );

        // Invariant: Coffer was asked to pull exactly the margin delta,
        // NEVER the notional. Pre-FIRE76-2 this could differ by 10× or more.
        assertEq(coffer.lastAdapterPullAmount(), uint256(marginDelta),
            "FIRE76-2 invariant: pull = margin delta regardless of notional");
    }

    /// Iter 58 audit fix: pin the FIRE76-2 fallback path. When a
    /// zero-margin instrument (fully-collateralized binary outcome)
    /// triggers a 0 margin-delta, the Router falls back to abs(notional)
    /// at AtriumRouter.sol:210-212. The existing happy-path test
    /// (test_open_via_router_endToEnd_chainExecutes) already exercises
    /// this branch — this test names it explicitly so a future refactor
    /// removing the fallback can't be misread as "no path covered."
    function test_open_via_router_fallsBackToNotional_whenMarginDeltaZero_iter58() public {
        bytes memory empty = hex"";

        // marginIncreasePerOpen defaults to 0 — required_after = required_before = 0.
        vm.prank(user, user);
        router.open_position_via_adapter(
            CURVE_VENUE_ID,
            INSTRUMENT,
            int256(2_500e6),
            empty,
            empty,
            empty
        );

        assertEq(
            coffer.lastAdapterPullAmount(),
            2_500e6,
            "iter58 fallback: zero-margin instruments pull abs(notional)"
        );
    }
}

// ──────────────────────────────────────────────────────────────────────
// Fake dependencies — narrow implementations of the interfaces the Router
// actually calls. Real Plinth + Coffer are Stylus; locally building them
// is blocked on Windows MSVC (`human_left.md` #11). The fakes encode the
// behavior the Router contractually expects.
// ──────────────────────────────────────────────────────────────────────

contract FakePlinth {
    bool public openCalled;
    mapping(address => bool) internal pausedFlag;
    uint256 public nextPositionId;
    /// Iter 58 / FIRE76-2 test support: per-user required-margin tracker
    /// so getAccount returns a non-zero `required` second tuple entry.
    /// When marginIncreasePerOpen > 0, every open_position call
    /// increments requiredMarginByUser[tx.origin] by that amount — which
    /// is exactly what the Router's required_after - required_before
    /// delta-pull math reads to size the Coffer pull.
    mapping(address => uint256) public requiredMarginByUser;
    uint256 public marginIncreasePerOpen;
    // Audit FIRE76-1: track open positions so get_position can return the
    // real owner. Pre-fix the FakePlinth returned the same shape for any id,
    // hiding the ownership-check vulnerability from the test suite.
    mapping(uint256 => address) public positionOwner;
    mapping(uint256 => uint8) public positionVenue;
    mapping(uint256 => bytes32) public positionInstrument;
    mapping(uint256 => int256) public positionNotional;

    function setPaused(address u, bool v) external { pausedFlag[u] = v; }
    /// Iter 58 / FIRE76-2 test support: enable required-margin tracking.
    /// Default 0 preserves the existing tests' behavior where
    /// `required_after - required_before` is 0 and the Router falls back
    /// to abs(notional).
    function setMarginIncreasePerOpen(uint256 v) external { marginIncreasePerOpen = v; }

    // Renamed to match the Stylus camelCase ABI selector that
    // AtriumRouter calls after the 2026-05-24 C-3 selector fix.
    function openPosition(uint8 venue, bytes32 instrument, int256 notional, bytes calldata, bytes calldata)
        external
        returns (uint256 id)
    {
        openCalled = true;
        nextPositionId++;
        id = nextPositionId;
        // tx.origin is the user when the Router calls this; record it.
        positionOwner[id] = tx.origin;
        positionVenue[id] = venue;
        positionInstrument[id] = instrument;
        positionNotional[id] = notional;
        // Iter 58 / FIRE76-2 test support: bump required_margin so the
        // Router's before/after delta read on `getAccount` returns a real
        // margin amount.
        requiredMarginByUser[tx.origin] += marginIncreasePerOpen;
    }

    function closePosition(uint256) external pure returns (int256) {
        return int256(0);
    }

    function getPosition(uint256 position_id)
        external
        view
        returns (address owner, uint8 venue_id, bytes32 instrument_id, int256 notional, uint256 opened_at)
    {
        return (
            positionOwner[position_id],
            positionVenue[position_id],
            positionInstrument[position_id],
            positionNotional[position_id],
            0
        );
    }

    function getAccount(address u)
        external
        view
        returns (uint256, uint256, uint256, bool)
    {
        return (10_000_000e6, requiredMarginByUser[u], 0, pausedFlag[u]);
    }
}

contract FakeCoffer {
    MockERC20 public usdc;
    mapping(address => bool) public approvedAdapters;
    mapping(address => uint256) public shares;
    uint256 public lastAdapterPullAmount;
    address public lastAdapterPullTo;
    address public lastAdapterPullUser;

    constructor(address _usdc) {
        usdc = MockERC20(_usdc);
    }

    function setApprovedAdapter(address a, bool v) external { approvedAdapters[a] = v; }
    function creditShares(address u, uint256 amt) external { shares[u] += amt; }

    // Renamed to camelCase to match the Stylus auto-converted ABI
    // selectors that AtriumRouter calls after the 2026-05-24 C-3 fix
    // (snake_case stayed in Rust source, but Stylus exports camelCase
    // selectors; the Router interface now matches).
    function isAdapterApproved(address a) external view returns (bool) {
        return approvedAdapters[a];
    }

    function adapterPull(uint256 amount, address from_user, address to) external {
        require(approvedAdapters[msg.sender], "not approved adapter");
        require(shares[from_user] >= amount, "insufficient shares");
        shares[from_user] -= amount;
        usdc.transfer(to, amount);
        lastAdapterPullAmount = amount;
        lastAdapterPullTo = to;
        lastAdapterPullUser = from_user;
    }
}

contract FakeRegistry {
    mapping(uint8 => address) internal adapters;
    function setAdapter(uint8 venue_id, address adapter) external { adapters[venue_id] = adapter; }
    function getAdapter(uint8 venue_id) external view returns (address) { return adapters[venue_id]; }
    function isRegisteredAdapter(address) external pure returns (bool) { return true; }
}

contract MockCurvePool {
    address public usdc;
    address public lp_token;
    uint256 public virtualPrice = 1e18;
    uint256 public withdrawAmount;
    constructor(address _usdc, address _lp) { usdc = _usdc; lp_token = _lp; }
    function setWithdrawAmount(uint256 amt) external { withdrawAmount = amt; }
    function add_liquidity(uint256[2] calldata amounts, uint256) external returns (uint256) {
        uint256 total = amounts[0] + amounts[1];
        MockERC20(lp_token).mint(msg.sender, total);
        return total;
    }
    function remove_liquidity_one_coin(uint256 burnAmount, int128, uint256) external returns (uint256) {
        MockERC20(lp_token).burn(msg.sender, burnAmount);
        uint256 amt = withdrawAmount == 0 ? burnAmount : withdrawAmount;
        MockERC20(usdc).transfer(msg.sender, amt);
        return amt;
    }
    function get_virtual_price() external view returns (uint256) { return virtualPrice; }
}

contract MockERC20 {
    string public name;
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    constructor(string memory _name, uint8 _decimals) { name = _name; decimals = _decimals; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function burn(address from, uint256 amount) external {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
    }
    function approve(address sp, uint256 v) external returns (bool) { allowance[msg.sender][sp] = v; return true; }
    function transfer(address to, uint256 v) external returns (bool) {
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }
}
