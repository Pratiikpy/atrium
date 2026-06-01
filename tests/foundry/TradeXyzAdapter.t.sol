// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {TradeXyzAdapter} from "../../contracts/adapters/trade-xyz/src/TradeXyzAdapter.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title TradeXyzAdapter foundry test suite
/// @notice trade.xyz is the Hyperliquid HIP-3 tokenized-equity issuer that holds
///         ~90% of HIP-3 open interest (PRD §3 backed claim). This adapter is
///         the path users take to get equity exposure inside Atrium. The Verifier
///         Mode demo touches this path directly.
///
///         Differences from CurveAdapter: dynamic instrument list via
///         `addInstrument` (instead of a single immutable instrument), and a
///         live `isOperational` health check that gates `open_position`.
contract TradeXyzAdapterTest is Test {
    TradeXyzAdapter internal adapter;
    MockClearinghouse internal clearinghouse;
    MockERC20 internal usdc;
    address internal coffer;
    address internal praetor;
    address internal user;
    address internal hostile;

    bytes32 internal constant AAPL_PERP = keccak256("AAPL-USD-PERP");
    bytes32 internal constant TSLA_PERP = keccak256("TSLA-USD-PERP");

    event PositionOpened(
        uint256 indexed venue_position_id,
        address indexed owner,
        bytes32 indexed instrument_id,
        int256 notional_signed
    );
    event PositionClosed(uint256 indexed venue_position_id, int256 realized_pnl_signed);

    address internal timelock;

    function setUp() public {
        coffer = makeAddr("atrium-coffer");
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        user = makeAddr("user");
        hostile = makeAddr("hostile");
        usdc = new MockERC20("USDC", 6);
        clearinghouse = new MockClearinghouse();
        adapter = new TradeXyzAdapter(
            address(clearinghouse),
            address(usdc),
            coffer,
            praetor,
            timelock
        );

        usdc.mint(address(adapter), 10_000_000 * 10 ** 6);

        // Audit EEEEE-1 fix: addInstrument now onlyTimelock per F-32.
        vm.startPrank(timelock);
        adapter.addInstrument(AAPL_PERP, 200, 1_000, 500); // 2% haircut, 10% IM, 5% MM
        adapter.addInstrument(TSLA_PERP, 300, 1_500, 750);
        vm.stopPrank();
    }

    // ── Metadata ─────────────────────────────────────────────────────

    function test_metadata_namePinned() public view {
        assertEq(adapter.name(), "TradeXyz");
    }

    function test_metadata_versionV1() public view {
        (uint256 major, uint256 minor, uint256 patch) = adapter.version();
        assertEq(major, 1);
        assertEq(minor, 0);
        assertEq(patch, 0);
    }

    function test_metadata_isHybridFalse() public view {
        // Despite trade.xyz running on Hyperliquid, this adapter is non-hybrid -
        // it goes through the on-chain HIP-3 clearinghouse contract, not an
        // off-chain attestation. attest_off_chain_state must therefore return false.
        assertFalse(adapter.isHybrid());
        assertFalse(adapter.attest_off_chain_state(hex"deadbeef"));
    }

    function test_metadata_supportedInstruments_listsAddedOnes() public view {
        bytes32[] memory inst = adapter.supportedInstruments();
        assertEq(inst.length, 2);
        assertEq(inst[0], AAPL_PERP);
        assertEq(inst[1], TSLA_PERP);
    }

    // ── addInstrument(), timelock-only per F-32 (audit EEEEE-1) ─────

    function test_addInstrument_rejectsHostileAndCoffer() public {
        vm.prank(hostile);
        vm.expectRevert(TradeXyzAdapter.Unauthorized.selector);
        adapter.addInstrument(keccak256("NVDA-USD-PERP"), 200, 1_000, 500);

        vm.prank(coffer);
        vm.expectRevert(TradeXyzAdapter.Unauthorized.selector);
        adapter.addInstrument(keccak256("NVDA-USD-PERP"), 200, 1_000, 500);
    }

    /// Iter 93: pin InstrumentAdded emit (EEEEE-3).
    event InstrumentAdded(bytes32 indexed instrument_id, uint16 haircut_bps, uint16 initial_margin_bps, uint16 maintenance_margin_bps);
    function test_addInstrument_emitsInstrumentAdded_iter93() public {
        bytes32 newInst = keccak256("TX-NVDA-iter93");
        vm.expectEmit(true, false, false, true, address(adapter));
        emit InstrumentAdded(newInst, 137, 911, 433);
        vm.prank(timelock);
        adapter.addInstrument(newInst, 137, 911, 433);
    }

    /// Iter 60 audit fix: pin setAuthorizedCaller auth + event. Pre-iter-60
    /// the function had zero tests across 6 of 9 adapters. Same shape as
    /// the iter 56 cross-adapter routing sweep.
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    function test_setAuthorizedCaller_rejectsHostile_iter60() public {
        vm.prank(hostile);
        vm.expectRevert(TradeXyzAdapter.Unauthorized.selector);
        adapter.setAuthorizedCaller(hostile, true);
    }
    function test_setAuthorizedCaller_succeedsFromPraetor_emitsEvent_iter60() public {
        address router_ = makeAddr("router-iter60");
        vm.expectEmit(true, false, false, true, address(adapter));
        emit AuthorizedCallerUpdated(router_, true);
        vm.prank(timelock);
        adapter.setAuthorizedCaller(router_, true);
        assertTrue(adapter.is_authorized_caller(router_));
    }

    function test_addInstrument_rejectsMultisig_EEEEE1() public {
        // Audit EEEEE-1: multisig CANNOT add instruments directly.
        vm.prank(praetor);
        vm.expectRevert(TradeXyzAdapter.Unauthorized.selector);
        adapter.addInstrument(keccak256("NVDA-USD-PERP"), 200, 1_000, 500);
    }

    function test_addInstrument_idempotentReadds_updateRiskParams() public {
        // Re-adding an existing instrument must NOT duplicate it in the array,
        // but must update its risk params (Praetor adjusting margins).
        uint256 lenBefore = adapter.supportedInstruments().length;

        vm.prank(timelock);
        adapter.addInstrument(AAPL_PERP, 400, 2_000, 1_000);

        uint256 lenAfter = adapter.supportedInstruments().length;
        assertEq(lenBefore, lenAfter, "re-add must not grow the list");
        assertEq(adapter.get_haircut_bps(AAPL_PERP), 400, "params must update");
        assertEq(adapter.get_initial_margin_bps(AAPL_PERP), 2_000);
        assertEq(adapter.get_maintenance_margin_bps(AAPL_PERP), 1_000);
    }

    function test_riskParams_returnedCorrectly() public view {
        assertEq(adapter.get_haircut_bps(AAPL_PERP), 200);
        assertEq(adapter.get_initial_margin_bps(AAPL_PERP), 1_000);
        assertEq(adapter.get_maintenance_margin_bps(AAPL_PERP), 500);
    }

    // ── open_position gating ─────────────────────────────────────────

    function test_open_onlyCoffer() public {
        bytes memory payload = abi.encodePacked(user);
        vm.prank(hostile);
        vm.expectRevert(TradeXyzAdapter.Unauthorized.selector);
        adapter.open_position(AAPL_PERP, int256(1_000e6), payload);
    }

    function test_open_rejectsUnsupportedInstrument() public {
        bytes32 unsupported = keccak256("XYZ-PERP");
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        vm.expectRevert(abi.encodeWithSelector(TradeXyzAdapter.UnsupportedInstrument.selector, unsupported));
        adapter.open_position(unsupported, int256(1_000e6), payload);
    }

    function test_open_revertsWhenVenueOffline() public {
        // The clearinghouse may be paused (e.g. trade.xyz cuts a session); the
        // adapter must refuse new positions and surface VenueOffline so Plinth
        // can route the user elsewhere.
        clearinghouse.setOperational(false);

        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        vm.expectRevert(TradeXyzAdapter.VenueOffline.selector);
        adapter.open_position(AAPL_PERP, int256(1_000e6), payload);
    }

    function test_open_rejectsTooShortPayload() public {
        bytes memory payload = new bytes(19);
        vm.prank(coffer);
        vm.expectRevert(TradeXyzAdapter.BadVenuePayload.selector);
        adapter.open_position(AAPL_PERP, int256(1_000e6), payload);
    }

    function test_open_happyPath_extractsOriginatorAndDeposits() public {
        // Verify the full flow:
        //   1. originator (user) extracted from venue_payload[0..20]
        //   2. clearinghouse.depositCollateral(user, 1000e6) called
        //   3. clearinghouse.openPosition(user, AAPL_PERP, +1000e6) called
        //   4. PositionOpened event with the right indexed args
        //   5. Position stored with user as owner, not coffer
        bytes memory payload = abi.encodePacked(user);

        vm.expectEmit(true, true, true, true, address(adapter));
        emit PositionOpened(1, user, AAPL_PERP, int256(1_000e6));

        vm.prank(coffer);
        uint256 id = adapter.open_position(AAPL_PERP, int256(1_000e6), payload);
        assertEq(id, 1);

        // Clearinghouse received the deposit on behalf of user (not coffer).
        assertEq(clearinghouse.depositOf(user), 1_000e6);
        assertEq(clearinghouse.depositOf(coffer), 0);

        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.owner, user);
        assertEq(view_.notional_signed, int256(1_000e6));
        assertEq(view_.last_update_timestamp, block.timestamp);
    }

    function test_open_shortPosition_negativeNotional() public {
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(AAPL_PERP, int256(-500e6), payload);

        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.notional_signed, int256(-500e6));
        // Deposit is abs(notional) per the contract, even a short position
        // requires collateral upstream.
        assertEq(clearinghouse.depositOf(user), 500e6);
    }

    // ── close_position ───────────────────────────────────────────────

    function test_close_onlyCoffer() public {
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(AAPL_PERP, int256(1_000e6), payload);

        vm.prank(hostile);
        vm.expectRevert(TradeXyzAdapter.Unauthorized.selector);
        adapter.close_position(id, hex"");
    }

    function test_close_unknownPosition_reverts() public {
        vm.prank(coffer);
        vm.expectRevert(TradeXyzAdapter.PositionNotFound.selector);
        adapter.close_position(7777, hex"");
    }

    function test_close_emitsPnlEmittedFromClearinghouse() public {
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(AAPL_PERP, int256(1_000e6), payload);

        // Clearinghouse will return +120e6 PnL.
        clearinghouse.setClosePnl(120e6);

        vm.expectEmit(true, false, false, true, address(adapter));
        emit PositionClosed(id, int256(120e6));

        vm.prank(coffer);
        int256 pnl = adapter.close_position(id, hex"");
        assertEq(pnl, int256(120e6));

        // Audit JJJ-12 fix: pre-fix the adapter withdrew only abs(notional)
        // and discarded pnl, the user's profit stayed stranded in the
        // clearinghouse forever. Now the withdraw is `supplied + pnl`, so a
        // +120e6 pnl on a 1_000e6 notional should withdraw 1_120e6.
        assertEq(clearinghouse.lastWithdrawAmount(), 1_120e6);

        // Position cleared.
        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.owner, address(0));
    }

    function test_close_lossPath() public {
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(AAPL_PERP, int256(1_000e6), payload);

        clearinghouse.setClosePnl(-80e6); // -8% loss

        vm.prank(coffer);
        int256 pnl = adapter.close_position(id, hex"");
        assertEq(pnl, int256(-80e6));
        // Audit JJJ-12 fix: -80e6 pnl on 1_000e6 supplied → withdraw 920e6.
        assertEq(clearinghouse.lastWithdrawAmount(), 920e6);
    }

    // ── modify_position v1 lock ──────────────────────────────────────

    function test_modify_position_revertsV1() public {
        vm.expectRevert(bytes("v1"));
        adapter.modify_position(1, int256(100), hex"");
    }

    // ── get_venue_health ─────────────────────────────────────────────

    function test_venueHealth_operational_ok() public view {
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertTrue(h.is_operational);
        assertEq(h.quoted_spread_bps, 5);
        assertEq(h.status_message, "ok");
    }

    function test_venueHealth_offline() public {
        clearinghouse.setOperational(false);
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertFalse(h.is_operational);
        assertEq(h.quoted_spread_bps, 0);
        assertEq(h.status_message, "offline");
    }

    // ── Constructor zero-checks (audit NNNN-1) ───────────────────────
    // Audit TTTT-1: pin every revert branch added by NNNN-1.

    function test_constructor_revertsOnZeroClearinghouse() public {
        vm.expectRevert(bytes("zero clearinghouse"));
        new TradeXyzAdapter(address(0), address(usdc), coffer, praetor, timelock);
    }

    function test_constructor_revertsOnZeroUsdc() public {
        vm.expectRevert(bytes("zero usdc"));
        new TradeXyzAdapter(address(clearinghouse), address(0), coffer, praetor, timelock);
    }

    function test_constructor_revertsOnZeroCoffer() public {
        vm.expectRevert(bytes("zero coffer"));
        new TradeXyzAdapter(address(clearinghouse), address(usdc), address(0), praetor, timelock);
    }

    function test_constructor_revertsOnZeroPraetor() public {
        vm.expectRevert(bytes("zero praetor"));
        new TradeXyzAdapter(address(clearinghouse), address(usdc), coffer, address(0), timelock);
    }
}

// ── mocks ─────────────────────────────────────────────────────────

contract MockClearinghouse {
    mapping(address => uint256) public depositOf;
    uint256 public nextPositionId;
    bool internal _operational = true;
    int256 internal _nextClosePnl;
    uint256 public lastWithdrawAmount;
    mapping(uint256 => bytes32) public posInstrument;
    mapping(uint256 => int256) public posNotional;

    function isOperational() external view returns (bool) {
        return _operational;
    }

    function setOperational(bool ok) external {
        _operational = ok;
    }

    function setClosePnl(int256 pnl) external {
        _nextClosePnl = pnl;
    }

    function quotedSpreadBps(bytes32) external pure returns (uint16) {
        return 5;
    }

    function depositCollateral(address user, uint256 amount) external {
        depositOf[user] += amount;
    }

    function withdrawCollateral(address user, uint256 amount) external returns (uint256) {
        require(depositOf[user] >= amount, "balance");
        depositOf[user] -= amount;
        lastWithdrawAmount = amount;
        return amount;
    }

    function openPosition(address, bytes32 instrument_id, int256 notional_signed)
        external
        returns (uint256 venuePositionId, uint256 entryPriceQ64)
    {
        venuePositionId = ++nextPositionId;
        entryPriceQ64 = 100 << 64; // arbitrary entry price
        posInstrument[venuePositionId] = instrument_id;
        posNotional[venuePositionId] = notional_signed;
    }

    function closePosition(address user, uint256) external returns (int256 realized_pnl) {
        // Audit JJJ-12 fix: real clearinghouse settles pnl into the user's
        // depositOf balance on close. Mock was previously `view` and skipped
        // this step, fine when the adapter (incorrectly) withdrew only
        // `abs(notional)`, but breaks now that the adapter (correctly)
        // withdraws `(supplied + pnl)`. Credit/debit + clamp at zero.
        realized_pnl = _nextClosePnl;
        if (realized_pnl >= 0) {
            depositOf[user] += uint256(realized_pnl);
        } else {
            uint256 loss = uint256(-realized_pnl);
            depositOf[user] = depositOf[user] >= loss ? depositOf[user] - loss : 0;
        }
    }

    function getPosition(uint256 venuePositionId)
        external
        view
        returns (address, bytes32, int256, uint256, uint256)
    {
        return (address(0), posInstrument[venuePositionId], posNotional[venuePositionId], 0, 101 << 64);
    }
}

contract MockERC20 {
    string public name;
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, uint8 _decimals) {
        name = _name;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address sp, uint256 v) external returns (bool) {
        allowance[msg.sender][sp] = v;
        return true;
    }

    function transfer(address to, uint256 v) external returns (bool) {
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }
}
