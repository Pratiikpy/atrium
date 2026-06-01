// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {MorphoBlueAdapter, IMorpho} from "../../contracts/adapters/morpho/src/MorphoBlueAdapter.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title MorphoBlueAdapter Phase-2 scaffold test suite
/// @notice Same audit-pattern matrix as SynthetixV3AdapterTest. Additionally
///         locks the Morpho-specific market-id keccak: Morpho keys positions
///         by `keccak256(abi.encode(MarketParams))`. The test pins that
///         derivation so a future refactor that changes the encoding fails
///         loudly instead of silently routing to a different market.
contract MorphoBlueAdapterTest is Test {
    MorphoBlueAdapter internal adapter;
    MockMorpho internal morpho;
    MockERC20 internal usdc;
    MockERC20 internal weth;
    address internal coffer;
    address internal praetor;
    address internal timelock;
    address internal user;
    address internal hostile;
    bytes32 internal constant INSTRUMENT = keccak256("MORPHO-WETH-USDC-86");

    event PositionOpened(uint256 indexed venue_position_id, address indexed owner, bytes32 indexed instrument_id, int256 notional_signed);
    event PositionClosed(uint256 indexed venue_position_id, int256 realized_pnl_signed);

    function setUp() public {
        coffer = makeAddr("atrium-coffer");
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        user = makeAddr("user");
        hostile = makeAddr("hostile");
        usdc = new MockERC20("USDC", 6);
        weth = new MockERC20("WETH", 18);
        morpho = new MockMorpho();
        adapter = new MorphoBlueAdapter(address(morpho), coffer, praetor, timelock);
        usdc.mint(address(adapter), 10_000_000 * 1e6);
        weth.mint(address(adapter), 10_000 ether);
    }

    // ── Constructor zero-checks ─────────────────────────────────────

    function test_constructor_revertsOnZeroMorpho() public {
        vm.expectRevert(bytes("zero morpho"));
        new MorphoBlueAdapter(address(0), coffer, praetor, timelock);
    }

    function test_constructor_revertsOnZeroCoffer() public {
        vm.expectRevert(bytes("zero coffer"));
        new MorphoBlueAdapter(address(morpho), address(0), praetor, timelock);
    }

    function test_constructor_revertsOnZeroPraetor() public {
        vm.expectRevert(bytes("zero praetor"));
        new MorphoBlueAdapter(address(morpho), coffer, address(0), timelock);
    }

    function test_constructor_revertsOnZeroTimelock() public {
        vm.expectRevert(bytes("zero timelock"));
        new MorphoBlueAdapter(address(morpho), coffer, praetor, address(0));
    }

    // ── Metadata ────────────────────────────────────────────────────

    function test_metadata_namePinned() public view {
        assertEq(adapter.name(), "MorphoBlue");
    }

    function test_metadata_isHybridFalse() public view {
        assertFalse(adapter.isHybrid());
    }

    function test_metadata_versionV1() public view {
        (uint256 major, uint256 minor, uint256 patch) = adapter.version();
        assertEq(major, 1);
        assertEq(minor, 0);
        assertEq(patch, 0);
    }

    // ── Morpho-specific: market-id encoding pin ────────────────────

    function test_addInstrument_derivesMarketIdViaKeccak() public {
        IMorpho.MarketParams memory mp = _params();
        bytes32 expected = keccak256(abi.encode(mp));
        vm.prank(timelock);
        adapter.addInstrument(INSTRUMENT, mp, 100, 800, 500);
        assertEq(adapter.instrument_to_morpho_market_id(INSTRUMENT), expected);
    }

    // ── Authorization ────────────────────────────────────────────────

    function test_addInstrument_revertsForNonTimelock() public {
        vm.expectRevert(MorphoBlueAdapter.Unauthorized.selector);
        adapter.addInstrument(INSTRUMENT, _params(), 100, 800, 500);
    }

    function test_setAuthorizedCaller_revertsForNonPraetor() public {
        vm.expectRevert(MorphoBlueAdapter.Unauthorized.selector);
        adapter.setAuthorizedCaller(hostile, true);
    }

    function test_setAuthorizedCaller_succeedsFromPraetor() public {
        vm.prank(timelock);
        adapter.setAuthorizedCaller(makeAddr("router"), true);
        assertTrue(adapter.is_authorized_caller(makeAddr("router")));
    }

    /// Iter 60 audit fix: pin AuthorizedCallerUpdated event. Scribe
    /// subgraph reads this for ops-dashboard adapter-orchestrator
    /// rotation tracking. Mirror of iter 60 Synthetix add.
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    /// Iter 93: pin InstrumentAdded emit (EEEEE-3). MorphoBlue's
    /// signature includes the derived morpho_market_id as the 2nd arg.
    event InstrumentAdded(bytes32 indexed instrument_id, bytes32 morpho_market_id, uint16 haircut_bps, uint16 initial_margin_bps, uint16 maintenance_margin_bps);
    function test_addInstrument_emitsInstrumentAdded_iter93() public {
        bytes32 newInst = keccak256("MORPHO-iter93");
        IMorpho.MarketParams memory mp = _params();
        bytes32 expectedMarketId = keccak256(abi.encode(mp));
        vm.expectEmit(true, false, false, true, address(adapter));
        emit InstrumentAdded(newInst, expectedMarketId, 137, 911, 433);
        vm.prank(timelock);
        adapter.addInstrument(newInst, mp, 137, 911, 433);
    }

    function test_setAuthorizedCaller_emitsAuthorizedCallerUpdated_iter60() public {
        address router_ = makeAddr("router-iter60");
        vm.expectEmit(true, false, false, true, address(adapter));
        emit AuthorizedCallerUpdated(router_, true);
        vm.prank(timelock);
        adapter.setAuthorizedCaller(router_, true);
    }

    function test_openPosition_revertsForHostileCaller() public {
        _registerInstrument();
        vm.expectRevert(MorphoBlueAdapter.Unauthorized.selector);
        vm.prank(hostile);
        adapter.open_position(INSTRUMENT, 1 ether, abi.encodePacked(user));
    }

    // ── Lifecycle ────────────────────────────────────────────────────
    //
    // Phase theta-followup (2026-05-25): Morpho open_position now reverts
    // ScaffoldNotImplemented before any other validation. Pre-fix the call
    // would silently accept the USDC pulled by Coffer.adapterPull, record
    // position metadata, never deploy into Morpho → fund-strand. The
    // tests below previously asserted on UnsupportedInstrument /
    // BadVenuePayload / event-emit; they now assert on the lockdown revert.

    function test_openPosition_revertsScaffoldNotImplemented() public {
        _registerInstrument();
        vm.expectRevert(MorphoBlueAdapter.ScaffoldNotImplemented.selector);
        vm.prank(coffer);
        adapter.open_position(INSTRUMENT, 1_000 ether, abi.encodePacked(user));
    }

    function test_openPosition_revertsScaffold_evenOnUnsupportedInstrument() public {
        bytes32 bad = keccak256("NOT-REGISTERED");
        vm.expectRevert(MorphoBlueAdapter.ScaffoldNotImplemented.selector);
        vm.prank(coffer);
        adapter.open_position(bad, 1 ether, abi.encodePacked(user));
    }

    function test_openPosition_revertsScaffold_evenOnBadPayload() public {
        _registerInstrument();
        vm.expectRevert(MorphoBlueAdapter.ScaffoldNotImplemented.selector);
        vm.prank(coffer);
        adapter.open_position(INSTRUMENT, 1 ether, hex"00");
    }

    function test_closePosition_revertsOnNotFound() public {
        vm.expectRevert(MorphoBlueAdapter.PositionNotFound.selector);
        vm.prank(coffer);
        adapter.close_position(999, "");
    }

    function test_modifyPosition_revertsV1Locked() public {
        vm.expectRevert(bytes("v1"));
        adapter.modify_position(1, 1 ether, "");
    }

    function test_attestOffChainState_returnsFalse() public view {
        assertFalse(adapter.attest_off_chain_state(""));
    }

    function test_getVenueHealth_signalsScaffold() public view {
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertFalse(h.is_operational);
        assertEq(h.status_message, "phase-2-scaffold");
    }

    /// Iter 56 audit fix: get_haircut_bps / get_initial_margin_bps /
    /// get_maintenance_margin_bps are the three views Plinth uses for
    /// margin math (per IPorticoAdapter). addInstrument writes to three
    /// SEPARATE storage mappings; the wiring at MorphoBlueAdapter.sol:
    /// 139-141 routes (_haircut_bps → haircut_bps_, _initial_margin_bps
    /// → initial_margin_bps_, _maintenance_margin_bps →
    /// maintenance_margin_bps_).
    ///
    /// Without this test, a refactor that accidentally swapped two of
    /// those three mapping writes (or the three function-arg names) would
    /// pass every existing test, addInstrument's emit + market-id keccak
    /// still hold. But every margin calc Plinth makes on this venue
    /// would silently use the wrong values: e.g., haircut=800 instead of
    /// 100, initial=100 instead of 800. No revert, no event-level
    /// signal, just under-margined positions.
    ///
    /// This test passes three distinct prime-ish values so any pairwise
    /// swap shows up as a failed assertEq.
    function test_get_bps_views_pinAddInstrumentRouting_iter56() public {
        uint16 expectedHaircut = 137;            // distinct from the others
        uint16 expectedInitialMargin = 911;
        uint16 expectedMaintenanceMargin = 433;

        vm.prank(timelock);
        adapter.addInstrument(
            INSTRUMENT,
            _params(),
            expectedHaircut,
            expectedInitialMargin,
            expectedMaintenanceMargin
        );

        // Load-bearing assertions: if any pair of storage writes were
        // ever swapped, exactly one of these assertEq calls fails with
        // a value that matches one of the OTHER three values.
        assertEq(
            adapter.get_haircut_bps(INSTRUMENT),
            expectedHaircut,
            "iter56: get_haircut_bps must return the haircut arg"
        );
        assertEq(
            adapter.get_initial_margin_bps(INSTRUMENT),
            expectedInitialMargin,
            "iter56: get_initial_margin_bps must return the initial-margin arg"
        );
        assertEq(
            adapter.get_maintenance_margin_bps(INSTRUMENT),
            expectedMaintenanceMargin,
            "iter56: get_maintenance_margin_bps must return the maintenance-margin arg"
        );

        // Defense-in-depth: unregistered instrument must return zero from
        // all three views. Plinth's margin calc layers a sanity check on
        // top of these views, but the views themselves must not return
        // stale data from a previous instrument.
        bytes32 unregistered = keccak256("MORPHO-NOT-A-MARKET");
        assertEq(adapter.get_haircut_bps(unregistered), 0);
        assertEq(adapter.get_initial_margin_bps(unregistered), 0);
        assertEq(adapter.get_maintenance_margin_bps(unregistered), 0);
    }

    function _params() internal returns (IMorpho.MarketParams memory) {
        return IMorpho.MarketParams({
            loanToken: address(usdc),
            collateralToken: address(weth),
            oracle: makeAddr("morpho-oracle"),
            irm: makeAddr("morpho-irm"),
            lltv: 86e16
        });
    }

    function _registerInstrument() internal {
        vm.prank(timelock);
        adapter.addInstrument(INSTRUMENT, _params(), 100, 800, 500);
    }
}

contract MockMorpho {
    function supplyCollateral(IMorpho.MarketParams memory, uint256, address, bytes calldata) external pure {}
    function borrow(IMorpho.MarketParams memory, uint256, uint256, address, address) external pure returns (uint256, uint256) { return (0, 0); }
    function repay(IMorpho.MarketParams memory, uint256, uint256, address, bytes calldata) external pure returns (uint256, uint256) { return (0, 0); }
    function withdrawCollateral(IMorpho.MarketParams memory, uint256, address, address) external pure {}
    function position(bytes32, address) external pure returns (uint256, uint128, uint128) { return (0, 0, 0); }
}

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    constructor(string memory _name, uint8 _decimals) { name = _name; symbol = _name; decimals = _decimals; }
    function mint(address to, uint256 amt) external { balanceOf[to] += amt; }
    function approve(address sp, uint256 v) external returns (bool) { allowance[msg.sender][sp] = v; return true; }
    function transfer(address to, uint256 v) external returns (bool) { balanceOf[msg.sender] -= v; balanceOf[to] += v; return true; }
    function transferFrom(address from, address to, uint256 v) external returns (bool) {
        allowance[from][msg.sender] -= v; balanceOf[from] -= v; balanceOf[to] += v; return true;
    }
}
