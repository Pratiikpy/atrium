// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {SynthetixV3Adapter} from "../../contracts/adapters/synthetix/src/SynthetixV3Adapter.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title SynthetixV3Adapter Phase-2 scaffold test suite
/// @notice Locks the contract shape so the Phase-2 ship doesn't break the
///         deploy chain. Mirrors CurveAdapter.t.sol audit-pattern coverage:
///         constructor zero-checks, onlyAuthorizedCaller gate, timelock
///         addInstrument, originator extraction, modify_position revert,
///         get_venue_health scaffold sentinel.
contract SynthetixV3AdapterTest is Test {
    SynthetixV3Adapter internal adapter;
    MockSynthetixPerps internal perps;
    MockERC20 internal susd;
    address internal coffer;
    address internal praetor;
    address internal timelock;
    address internal user;
    address internal hostile;
    uint128 internal constant ATRIUM_ACCOUNT_ID = 1234;
    bytes32 internal constant INSTRUMENT = keccak256("SYN-V3-ETH-PERP");
    uint128 internal constant SYN_MARKET_ID = 100;

    event PositionOpened(uint256 indexed venue_position_id, address indexed owner, bytes32 indexed instrument_id, int256 notional_signed);
    event PositionClosed(uint256 indexed venue_position_id, int256 realized_pnl_signed);

    function setUp() public {
        coffer = makeAddr("atrium-coffer");
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        user = makeAddr("user");
        hostile = makeAddr("hostile");
        susd = new MockERC20("sUSD", 18);
        perps = new MockSynthetixPerps();
        adapter = new SynthetixV3Adapter(address(perps), address(susd), coffer, praetor, timelock, ATRIUM_ACCOUNT_ID);
        susd.mint(address(adapter), 10_000_000 ether);
    }

    // ── Constructor zero-checks (DDD-5 / NNNN-1) ────────────────────

    function test_constructor_revertsOnZeroPerpsMarket() public {
        vm.expectRevert(bytes("zero perps_market"));
        new SynthetixV3Adapter(address(0), address(susd), coffer, praetor, timelock, ATRIUM_ACCOUNT_ID);
    }

    function test_constructor_revertsOnZeroSusd() public {
        vm.expectRevert(bytes("zero susd"));
        new SynthetixV3Adapter(address(perps), address(0), coffer, praetor, timelock, ATRIUM_ACCOUNT_ID);
    }

    function test_constructor_revertsOnZeroCoffer() public {
        vm.expectRevert(bytes("zero coffer"));
        new SynthetixV3Adapter(address(perps), address(susd), address(0), praetor, timelock, ATRIUM_ACCOUNT_ID);
    }

    function test_constructor_revertsOnZeroPraetor() public {
        vm.expectRevert(bytes("zero praetor"));
        new SynthetixV3Adapter(address(perps), address(susd), coffer, address(0), timelock, ATRIUM_ACCOUNT_ID);
    }

    function test_constructor_revertsOnZeroTimelock() public {
        vm.expectRevert(bytes("zero timelock"));
        new SynthetixV3Adapter(address(perps), address(susd), coffer, praetor, address(0), ATRIUM_ACCOUNT_ID);
    }

    function test_constructor_revertsOnZeroAccountId() public {
        vm.expectRevert(bytes("zero account_id"));
        new SynthetixV3Adapter(address(perps), address(susd), coffer, praetor, timelock, 0);
    }

    // ── Metadata ────────────────────────────────────────────────────

    function test_metadata_namePinned() public view {
        assertEq(adapter.name(), "SynthetixV3");
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

    // ── Authorization (F-32 / EEEEE-1 / EEEE-1) ─────────────────────

    function test_addInstrument_revertsForNonTimelock() public {
        vm.expectRevert(SynthetixV3Adapter.Unauthorized.selector);
        adapter.addInstrument(INSTRUMENT, SYN_MARKET_ID, 50, 500, 300);
    }

    function test_addInstrument_succeedsFromTimelock() public {
        vm.prank(timelock);
        adapter.addInstrument(INSTRUMENT, SYN_MARKET_ID, 50, 500, 300);
        assertTrue(adapter.is_supported_instrument(INSTRUMENT));
        assertEq(adapter.instrument_to_synth_market(INSTRUMENT), SYN_MARKET_ID);
        assertEq(adapter.get_haircut_bps(INSTRUMENT), 50);
        assertEq(adapter.get_initial_margin_bps(INSTRUMENT), 500);
        assertEq(adapter.get_maintenance_margin_bps(INSTRUMENT), 300);
    }

    function test_setAuthorizedCaller_revertsForNonPraetor() public {
        vm.expectRevert(SynthetixV3Adapter.Unauthorized.selector);
        adapter.setAuthorizedCaller(hostile, true);
    }

    function test_setAuthorizedCaller_succeedsFromPraetor() public {
        vm.prank(timelock);
        adapter.setAuthorizedCaller(makeAddr("router"), true);
        assertTrue(adapter.is_authorized_caller(makeAddr("router")));
    }

    /// Iter 60 audit fix: pin the AuthorizedCallerUpdated event emission.
    /// Across 9 adapters this event existed in code but no test asserted
    /// on it — a dropped emit would silently desync the Scribe subgraph
    /// (which reads this channel to track adapter-orchestrator rotations
    /// for ops dashboards). Same cross-contract gap shape as iter 56
    /// get_*_bps routing: declaration without assertion is invisible to
    /// CI even though it's a load-bearing observability invariant.
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    /// Iter 93: pin InstrumentAdded emit (EEEEE-3). Synthetix signature
    /// includes synth_market_id as the 2nd arg.
    event InstrumentAdded(bytes32 indexed instrument_id, uint128 synth_market_id, uint16 haircut_bps, uint16 initial_margin_bps, uint16 maintenance_margin_bps);
    function test_addInstrument_emitsInstrumentAdded_iter93() public {
        bytes32 newInst = keccak256("SNX-SOL-iter93");
        uint128 synthMarketId = 999;
        vm.expectEmit(true, false, false, true, address(adapter));
        emit InstrumentAdded(newInst, synthMarketId, 137, 911, 433);
        vm.prank(timelock);
        adapter.addInstrument(newInst, synthMarketId, 137, 911, 433);
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
        vm.expectRevert(SynthetixV3Adapter.Unauthorized.selector);
        vm.prank(hostile);
        adapter.open_position(INSTRUMENT, 1_000 ether, abi.encodePacked(user));
    }

    // ── Lifecycle ────────────────────────────────────────────────────

    // Phase theta-followup (2026-05-25): Synthetix open_position now reverts
    // ScaffoldNotImplemented before any other validation. Pre-fix a call
    // would silently accept USDC pulled by Coffer.adapterPull, record
    // position metadata, never deploy into Synthetix → fund-strand. The
    // tests below previously asserted on UnsupportedInstrument /
    // BadVenuePayload / event-emit; they now assert on the lockdown revert.
    // The downstream argument-validation paths remain in the source as
    // unreachable code so the eventual real impl can reactivate them.

    function test_openPosition_revertsScaffoldNotImplemented() public {
        _registerInstrument();
        vm.expectRevert(SynthetixV3Adapter.ScaffoldNotImplemented.selector);
        vm.prank(coffer);
        adapter.open_position(INSTRUMENT, 1_000 ether, abi.encodePacked(user));
    }

    function test_openPosition_revertsScaffold_evenOnUnsupportedInstrument() public {
        // Lockdown fires BEFORE the unsupported-instrument check (front guard).
        bytes32 bad = keccak256("NOT-REGISTERED");
        vm.expectRevert(SynthetixV3Adapter.ScaffoldNotImplemented.selector);
        vm.prank(coffer);
        adapter.open_position(bad, 1 ether, abi.encodePacked(user));
    }

    function test_openPosition_revertsScaffold_evenOnBadPayload() public {
        _registerInstrument();
        vm.expectRevert(SynthetixV3Adapter.ScaffoldNotImplemented.selector);
        vm.prank(coffer);
        adapter.open_position(INSTRUMENT, 1 ether, hex"00");
    }

    function test_closePosition_revertsOnNotFound() public {
        vm.expectRevert(SynthetixV3Adapter.PositionNotFound.selector);
        vm.prank(coffer);
        adapter.close_position(999, "");
    }

    // The close_position path is still callable for legacy pre-lockdown
    // positions (none exist on mainnet/testnet; this is defensive). With
    // open_position now blocked, exercising close requires direct storage
    // manipulation. Skipping the emit test until real impl lands.

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

    function _registerInstrument() internal {
        vm.prank(timelock);
        adapter.addInstrument(INSTRUMENT, SYN_MARKET_ID, 50, 500, 300);
    }
}

contract MockSynthetixPerps {
    function modifyCollateral(uint128, uint128, int256) external pure {}
    function commitOrder(uint128, uint128, int128, uint128, uint256, bytes32, address) external pure returns (uint256) {
        return 1;
    }
    function settleOrder(uint128, uint128) external pure returns (int256) { return 0; }
    function getOpenPosition(uint128, uint128) external pure returns (int256, int256, int128) {
        return (0, 0, 0);
    }
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
