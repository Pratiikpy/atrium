// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {GmxV2Adapter} from "../../contracts/adapters/gmx/src/GmxV2Adapter.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title GmxV2Adapter Phase-2 scaffold test suite
/// @notice Locks the scaffold's contract shape so the Phase-2 wave doesn't
///         break the deploy chain. Same audit-pattern matrix as the
///         Synthetix V3 / Morpho Blue scaffolds, plus an end-to-end
///         lifecycle that round-trips through a MockGmxRouter.
contract GmxV2AdapterTest is Test {
    GmxV2Adapter internal adapter;
    MockGmxRouter internal gmx;
    MockERC20 internal usdc;
    address internal coffer;
    address internal praetor;
    address internal timelock;
    address internal user;
    address internal hostile;
    bytes32 internal constant INSTRUMENT = keccak256("GMX-V2-ETH-USD");
    address internal market = makeAddr("gmx-eth-usd-market");

    event PositionOpened(uint256 indexed venue_position_id, address indexed owner, bytes32 indexed instrument_id, int256 notional_signed);
    event PositionClosed(uint256 indexed venue_position_id, int256 realized_pnl_signed);

    function setUp() public {
        coffer = makeAddr("atrium-coffer");
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        user = makeAddr("user");
        hostile = makeAddr("hostile");
        usdc = new MockERC20("USDC", 6);
        gmx = new MockGmxRouter();
        adapter = new GmxV2Adapter(address(gmx), address(usdc), coffer, praetor, timelock);
        usdc.mint(address(adapter), 10_000_000 * 1e6);
    }

    // ── Constructor zero-checks ─────────────────────────────────────

    function test_constructor_revertsOnZeroRouter() public {
        vm.expectRevert(bytes("zero router"));
        new GmxV2Adapter(address(0), address(usdc), coffer, praetor, timelock);
    }

    function test_constructor_revertsOnZeroUsdc() public {
        vm.expectRevert(bytes("zero usdc"));
        new GmxV2Adapter(address(gmx), address(0), coffer, praetor, timelock);
    }

    function test_constructor_revertsOnZeroCoffer() public {
        vm.expectRevert(bytes("zero coffer"));
        new GmxV2Adapter(address(gmx), address(usdc), address(0), praetor, timelock);
    }

    function test_constructor_revertsOnZeroPraetor() public {
        vm.expectRevert(bytes("zero praetor"));
        new GmxV2Adapter(address(gmx), address(usdc), coffer, address(0), timelock);
    }

    function test_constructor_revertsOnZeroTimelock() public {
        vm.expectRevert(bytes("zero timelock"));
        new GmxV2Adapter(address(gmx), address(usdc), coffer, praetor, address(0));
    }

    // ── Metadata ────────────────────────────────────────────────────

    function test_metadata_namePinned() public view {
        assertEq(adapter.name(), "GmxV2");
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

    // ── Authorization ────────────────────────────────────────────────

    function test_addInstrument_revertsForNonTimelock() public {
        vm.expectRevert(GmxV2Adapter.Unauthorized.selector);
        adapter.addInstrument(INSTRUMENT, market, 75, 700, 400);
    }

    function test_addInstrument_succeedsFromTimelock() public {
        vm.prank(timelock);
        adapter.addInstrument(INSTRUMENT, market, 75, 700, 400);
        assertTrue(adapter.is_supported_instrument(INSTRUMENT));
        assertEq(adapter.instrument_to_gmx_market(INSTRUMENT), market);
        assertEq(adapter.get_haircut_bps(INSTRUMENT), 75);
        assertEq(adapter.get_initial_margin_bps(INSTRUMENT), 700);
        assertEq(adapter.get_maintenance_margin_bps(INSTRUMENT), 400);
    }

    function test_setAuthorizedCaller_revertsForNonPraetor() public {
        vm.expectRevert(GmxV2Adapter.Unauthorized.selector);
        adapter.setAuthorizedCaller(hostile, true);
    }

    function test_setAuthorizedCaller_succeedsFromPraetor() public {
        vm.prank(timelock);
        adapter.setAuthorizedCaller(makeAddr("router"), true);
        assertTrue(adapter.is_authorized_caller(makeAddr("router")));
    }

    /// Iter 93: pin InstrumentAdded emit (EEEEE-3 audit fix). Subgraph
    /// indexes this for "supported instruments" dashboard tile.
    event InstrumentAdded(bytes32 indexed instrument_id, uint16 haircut_bps, uint16 initial_margin_bps, uint16 maintenance_margin_bps);
    function test_addInstrument_emitsInstrumentAdded_iter93() public {
        bytes32 newInst = keccak256("GMX-SOL-USD-iter93");
        vm.expectEmit(true, false, false, true, address(adapter));
        emit InstrumentAdded(newInst, 137, 911, 433);
        vm.prank(timelock);
        adapter.addInstrument(newInst, makeAddr("gmx-market-iter93"), 137, 911, 433);
    }

    /// Iter 60 audit fix: pin AuthorizedCallerUpdated event. Mirror of
    /// iter 60 Synthetix add — same subgraph-observability invariant.
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    function test_setAuthorizedCaller_emitsAuthorizedCallerUpdated_iter60() public {
        address router_ = makeAddr("router-iter60");
        vm.expectEmit(true, false, false, true, address(adapter));
        emit AuthorizedCallerUpdated(router_, true);
        vm.prank(timelock);
        adapter.setAuthorizedCaller(router_, true);
    }

    function test_openPosition_revertsForHostileCaller() public {
        _registerInstrument();
        vm.expectRevert(GmxV2Adapter.Unauthorized.selector);
        vm.prank(hostile);
        adapter.open_position(INSTRUMENT, 1_000e6, abi.encodePacked(user));
    }

    // ── Lifecycle ────────────────────────────────────────────────────
    //
    // Audit fix (#9): GmxV2Adapter.open_position now reverts
    // ScaffoldNotImplemented as its first statement, matching the Morpho Blue
    // and Synthetix V3 sibling scaffolds. Pre-fix, GMX was the one Phase-2
    // scaffold WITHOUT the guard: a call would accept the USDC pulled by
    // Coffer.adapterPull, record phantom position metadata, and never deploy
    // into a real GMX router -> fund-strand. These tests previously asserted
    // the GMX create-position call path + event emit; they now assert the
    // lockdown revert (same matrix as MorphoBlueAdapter.t.sol /
    // SynthetixV3Adapter.t.sol). The happy-path GMX round-trip returns when a
    // real router is wired (Phase 2).

    function test_openPosition_revertsScaffoldNotImplemented() public {
        _registerInstrument();
        vm.expectRevert(GmxV2Adapter.ScaffoldNotImplemented.selector);
        vm.prank(coffer);
        adapter.open_position(INSTRUMENT, 1_000e6, abi.encodePacked(user));
    }

    function test_openPosition_revertsScaffold_evenOnUnsupportedInstrument() public {
        bytes32 bad = keccak256("NOT-REGISTERED");
        vm.expectRevert(GmxV2Adapter.ScaffoldNotImplemented.selector);
        vm.prank(coffer);
        adapter.open_position(bad, 1e6, abi.encodePacked(user));
    }

    function test_openPosition_revertsScaffold_evenOnBadPayload() public {
        _registerInstrument();
        vm.expectRevert(GmxV2Adapter.ScaffoldNotImplemented.selector);
        vm.prank(coffer);
        adapter.open_position(INSTRUMENT, 1e6, hex"00");
    }

    function test_closePosition_revertsOnNotFound() public {
        vm.expectRevert(GmxV2Adapter.PositionNotFound.selector);
        vm.prank(coffer);
        adapter.close_position(999, "");
    }

    function test_modifyPosition_revertsV1Locked() public {
        vm.expectRevert(bytes("v1"));
        adapter.modify_position(1, 1e6, "");
    }

    function test_attestOffChainState_returnsFalse() public view {
        assertFalse(adapter.attest_off_chain_state(""));
    }

    function test_getVenueHealth_alwaysOk_inScaffold() public view {
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertTrue(h.is_operational);
        assertEq(h.status_message, "ok");
    }

    function _registerInstrument() internal {
        vm.prank(timelock);
        adapter.addInstrument(INSTRUMENT, market, 75, 700, 400);
    }
}

/// Mock GMX router with a single position-store. Captures the last call so
/// tests can assert on argument forwarding (not just absence of revert).
contract MockGmxRouter {
    address public lastCreatedMarket;
    address public lastCreatedCollateralToken;
    uint256 public lastCreatedSizeUsd;
    uint256 public lastCreatedCollateralAmount;
    bool public lastCreatedIsLong;
    bytes32 public lastClosedKey;
    int256 public nextClosePnl;
    uint256 public nextKey;

    function setNextClosePnl(int256 pnl) external {
        nextClosePnl = pnl;
    }

    function createPosition(
        address marketAddr,
        address collateralToken,
        uint256 sizeUsd,
        uint256 collateralAmount,
        bool isLong
    ) external returns (bytes32 positionKey) {
        lastCreatedMarket = marketAddr;
        lastCreatedCollateralToken = collateralToken;
        lastCreatedSizeUsd = sizeUsd;
        lastCreatedCollateralAmount = collateralAmount;
        lastCreatedIsLong = isLong;
        nextKey++;
        return bytes32(nextKey);
    }

    function closePosition(bytes32 positionKey) external returns (int256 realizedPnlUsd) {
        lastClosedKey = positionKey;
        return nextClosePnl;
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
