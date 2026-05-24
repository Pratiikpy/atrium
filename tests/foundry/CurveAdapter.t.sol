// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {CurveAdapter} from "../../contracts/adapters/curve/src/CurveAdapter.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title CurveAdapter foundry test suite
/// @notice Reference Portico adapter — Curve stableswap LP. CurveAdapter is the
///         simplest of the seven adapters (no off-chain attestation, single
///         instrument, no leverage). The test patterns here transfer to every
///         other adapter so this also doubles as the adapter-compliance template.
///
///         Pins:
///           1. Metadata: name, version, isHybrid=false, supportedInstruments
///           2. onlyCoffer gate on open/close
///           3. Originator extraction from venue_payload (audit G-5 fix)
///           4. Position lifecycle: open → state → close emits PnL event
///           5. modify_position reverts ("v1") — locked v1 behavior
///           6. setRiskParams onlyPraetor
///           7. attest_off_chain_state returns false (non-hybrid)
contract CurveAdapterTest is Test {
    CurveAdapter internal adapter;
    MockCurvePool internal pool;
    MockERC20 internal usdc;
    MockERC20 internal lpToken;
    address internal coffer;
    address internal praetor;
    address internal user;
    address internal hostile;

    bytes32 internal constant INSTRUMENT = keccak256("CURVE-3POOL-USDC");

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
        lpToken = new MockERC20("crv3pool", 18);
        pool = new MockCurvePool(address(usdc), address(lpToken));

        adapter = new CurveAdapter(
            address(pool),
            address(usdc),
            address(lpToken),
            int128(0), // usdc_index in the pool's coin array
            coffer,
            praetor,
            timelock,
            INSTRUMENT
        );

        // Fund the adapter with USDC for deposits; pool with USDC for withdrawals.
        usdc.mint(address(adapter), 10_000_000 * 10 ** 6);
        usdc.mint(address(pool), 10_000_000 * 10 ** 6);
    }

    // ── Metadata ─────────────────────────────────────────────────────

    function test_metadata_namePinned() public view {
        assertEq(adapter.name(), "Curve");
    }

    function test_metadata_versionV1() public view {
        // Pure functions still require a deployed instance for the dispatch
        // path — calling `CurveAdapter(address(0)).version()` does a CALL
        // to empty code and reverts. Call through the real instance.
        (uint256 major, uint256 minor, uint256 patch) = adapter.version();
        assertEq(major, 1);
        assertEq(minor, 0);
        assertEq(patch, 0);
    }

    function test_metadata_isHybridFalse() public view {
        assertFalse(adapter.isHybrid());
    }

    function test_metadata_supportedInstruments() public view {
        bytes32[] memory inst = adapter.supportedInstruments();
        assertEq(inst.length, 1);
        assertEq(inst[0], INSTRUMENT);
    }

    // ── open_position gating ─────────────────────────────────────────

    function test_open_onlyCoffer() public {
        bytes memory payload = abi.encodePacked(user);
        vm.prank(hostile);
        vm.expectRevert(CurveAdapter.Unauthorized.selector);
        adapter.open_position(INSTRUMENT, int256(1_000e6), payload);
    }

    function test_open_rejectsUnsupportedInstrument() public {
        bytes32 wrong = keccak256("not-this-pool");
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        vm.expectRevert(abi.encodeWithSelector(CurveAdapter.UnsupportedInstrument.selector, wrong));
        adapter.open_position(wrong, int256(1_000e6), payload);
    }

    function test_open_rejectsTooShortPayload() public {
        // venue_payload must be ≥ 20 bytes (address). 19 bytes triggers BadVenuePayload.
        bytes memory payload = new bytes(19);
        vm.prank(coffer);
        vm.expectRevert(CurveAdapter.BadVenuePayload.selector);
        adapter.open_position(INSTRUMENT, int256(1_000e6), payload);
    }

    function test_open_happyPath_extractsOriginator() public {
        // The originator address is the first 20 bytes of venue_payload (audit
        // G-5 fix — explicit originator, not tx.origin). Verify the position is
        // owned by that address even when msg.sender is the Coffer.
        bytes memory payload = abi.encodePacked(user);

        vm.expectEmit(true, true, true, true, address(adapter));
        emit PositionOpened(1, user, INSTRUMENT, int256(1_000e6));

        vm.prank(coffer);
        uint256 id = adapter.open_position(INSTRUMENT, int256(1_000e6), payload);
        assertEq(id, 1);

        IPorticoAdapter.PositionView memory view_ = adapter.get_position(1);
        assertEq(view_.owner, user, "originator must come from payload");
        assertEq(view_.notional_signed, int256(1_000e6));
        assertEq(view_.last_update_timestamp, block.timestamp);
    }

    function test_open_incrementsPositionId() public {
        bytes memory payload = abi.encodePacked(user);
        vm.startPrank(coffer);
        uint256 id1 = adapter.open_position(INSTRUMENT, int256(1_000e6), payload);
        uint256 id2 = adapter.open_position(INSTRUMENT, int256(2_000e6), payload);
        vm.stopPrank();
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(adapter.next_venue_position_id(), 2);
    }

    // ── close_position ───────────────────────────────────────────────

    function test_close_onlyCoffer() public {
        // First open a position so close has something to find.
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(INSTRUMENT, int256(1_000e6), payload);

        vm.prank(hostile);
        vm.expectRevert(CurveAdapter.Unauthorized.selector);
        adapter.close_position(id, hex"");
    }

    function test_close_unknownPositionId_reverts() public {
        vm.prank(coffer);
        vm.expectRevert(CurveAdapter.PositionNotFound.selector);
        adapter.close_position(9_999, hex"");
    }

    function test_close_emitsPnlAndDeletesPosition() public {
        // Open a 1000 USDC position. MockCurvePool's remove_liquidity_one_coin
        // returns 1050 USDC (5% yield) so realized_pnl = +50e6.
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(INSTRUMENT, int256(1_000e6), payload);

        pool.setWithdrawAmount(1_050e6);

        vm.expectEmit(true, false, false, true, address(adapter));
        emit PositionClosed(id, int256(50e6));

        vm.prank(coffer);
        int256 pnl = adapter.close_position(id, hex"");
        assertEq(pnl, int256(50e6));

        // Position must be deleted.
        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.owner, address(0), "position storage must be cleared");
    }

    function test_close_lossPath_negativePnl() public {
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(INSTRUMENT, int256(1_000e6), payload);

        pool.setWithdrawAmount(900e6); // 10% impermanent loss

        vm.prank(coffer);
        int256 pnl = adapter.close_position(id, hex"");
        assertEq(pnl, int256(-100e6), "loss must surface as negative PnL");
    }

    // ── modify_position locked in v1 ─────────────────────────────────

    function test_modify_position_revertsV1() public {
        // v1 of the adapter doesn't support modify — must revert "v1".
        // Locks the version-1 behavior so a future v2 implementation has a
        // clear breaking-change marker.
        vm.expectRevert(bytes("v1"));
        adapter.modify_position(1, int256(100), hex"");
    }

    // ── Risk params (timelock-only per F-32, audit EEEEE-1) ──────────

    function test_setRiskParams_rejectsHostile() public {
        vm.prank(hostile);
        vm.expectRevert(CurveAdapter.Unauthorized.selector);
        adapter.setRiskParams(INSTRUMENT, 500, 2_000, 1_000);

        vm.prank(coffer);
        vm.expectRevert(CurveAdapter.Unauthorized.selector);
        adapter.setRiskParams(INSTRUMENT, 500, 2_000, 1_000);
    }

    function test_setRiskParams_rejectsMultisig_EEEEE1() public {
        // Audit EEEEE-1: multisig CANNOT change risk params directly.
        vm.prank(praetor);
        vm.expectRevert(CurveAdapter.Unauthorized.selector);
        adapter.setRiskParams(INSTRUMENT, 500, 2_000, 1_000);
    }

    /// Iter 93: pin RiskParamsUpdated emit. Curve uses setRiskParams
    /// (not addInstrument like other adapters); event has same shape.
    event RiskParamsUpdated(bytes32 indexed instrument_id, uint16 haircut_bps, uint16 initial_margin_bps, uint16 maintenance_margin_bps);
    function test_setRiskParams_emitsRiskParamsUpdated_iter93() public {
        vm.expectEmit(true, false, false, true, address(adapter));
        emit RiskParamsUpdated(INSTRUMENT, 137, 911, 433);
        vm.prank(timelock);
        adapter.setRiskParams(INSTRUMENT, 137, 911, 433);
    }

    /// Iter 60 audit fix: pin setAuthorizedCaller auth + event. Mirror
    /// of iter 60 cross-adapter sweep.
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    function test_setAuthorizedCaller_rejectsHostile_iter60() public {
        vm.prank(hostile);
        vm.expectRevert(CurveAdapter.Unauthorized.selector);
        adapter.setAuthorizedCaller(hostile, true);
    }
    function test_setAuthorizedCaller_succeedsFromPraetor_emitsEvent_iter60() public {
        address router_ = makeAddr("router-iter60");
        vm.expectEmit(true, false, false, true, address(adapter));
        emit AuthorizedCallerUpdated(router_, true);
        vm.prank(praetor);
        adapter.setAuthorizedCaller(router_, true);
        assertTrue(adapter.is_authorized_caller(router_));
    }

    function test_setRiskParams_timelock_happyPath() public {
        vm.prank(timelock);
        adapter.setRiskParams(INSTRUMENT, 500, 2_000, 1_000);

        assertEq(adapter.get_haircut_bps(INSTRUMENT), 500);
        assertEq(adapter.get_initial_margin_bps(INSTRUMENT), 2_000);
        assertEq(adapter.get_maintenance_margin_bps(INSTRUMENT), 1_000);
    }

    function test_riskParams_defaultZero() public view {
        // Before any setRiskParams call, all three queries return zero — the
        // Curator review is the gate that publishes real numbers.
        assertEq(adapter.get_haircut_bps(INSTRUMENT), 0);
        assertEq(adapter.get_initial_margin_bps(INSTRUMENT), 0);
        assertEq(adapter.get_maintenance_margin_bps(INSTRUMENT), 0);
    }

    // ── Hybrid attestation must be inert ─────────────────────────────

    function test_attestOffChainState_returnsFalse() public {
        // Non-hybrid adapters: the attestation path is a no-op that returns
        // false. Verifies Plinth never grants margin based on a Curve-style
        // adapter's "attestation".
        assertFalse(adapter.attest_off_chain_state(hex"deadbeef"));
    }

    // ── get_venue_health ─────────────────────────────────────────────

    function test_getVenueHealth_alwaysOperational() public view {
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertTrue(h.is_operational);
        assertEq(h.quoted_spread_bps, 1);
        // status_message is a string; just verify it's non-empty.
        assertGt(bytes(h.status_message).length, 0);
    }

    // ── JJJ-9 transfer-return-false revert path (audit UUUU-1) ────────
    // The JJJ-9 fix was to capture the `IERC20.transfer` return value at
    // close_position and revert with UsdcTransferFailed when it returns
    // false. Pre-UUUU this revert branch had ZERO asserting tests — the
    // mock always returned true. Pin the revert + verify state is NOT
    // mutated (position must NOT be deleted, PnL must NOT be emitted).

    function test_close_revertsOnTransferReturnsFalse() public {
        // Open a position so close has something to find.
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(INSTRUMENT, int256(1_000e6), payload);

        // Flip the mock into Tether-style silent-fail mode.
        usdc.setTransferReturnsFalse(true);
        pool.setWithdrawAmount(1_050e6);

        vm.prank(coffer);
        vm.expectRevert(
            abi.encodeWithSelector(CurveAdapter.UsdcTransferFailed.selector, coffer, uint256(1_050e6))
        );
        adapter.close_position(id, hex"");

        // Position must still exist — the revert rolls back the storage
        // delete + the PositionClosed emit. Pre-JJJ-9 the position was
        // deleted before the transfer line, so USDC was stranded in the
        // adapter with no record of the position. This is the load-bearing
        // assertion for JJJ-9.
        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.owner, user, "position must persist when transfer returns false");
        assertEq(view_.notional_signed, int256(1_000e6));
    }

    // ── Constructor zero-checks (audit NNNN-1) ───────────────────────
    // Audit TTTT-1: NNNN-1 added five `require(_X != address(0))` guards
    // to the constructor. Every existing test used the happy-path setUp
    // and never asserted the revert path — a partial-coverage drift the
    // SSSS-1 test-coverage-gap lens flagged. These five pins close it.

    function test_constructor_revertsOnZeroPool() public {
        vm.expectRevert(bytes("zero pool"));
        new CurveAdapter(address(0), address(usdc), address(lpToken), int128(0), coffer, praetor, timelock, INSTRUMENT);
    }

    function test_constructor_revertsOnZeroUsdc() public {
        vm.expectRevert(bytes("zero usdc"));
        new CurveAdapter(address(pool), address(0), address(lpToken), int128(0), coffer, praetor, timelock, INSTRUMENT);
    }

    function test_constructor_revertsOnZeroLpToken() public {
        vm.expectRevert(bytes("zero lp_token"));
        new CurveAdapter(address(pool), address(usdc), address(0), int128(0), coffer, praetor, timelock, INSTRUMENT);
    }

    function test_constructor_revertsOnZeroCoffer() public {
        vm.expectRevert(bytes("zero coffer"));
        new CurveAdapter(address(pool), address(usdc), address(lpToken), int128(0), address(0), praetor, timelock, INSTRUMENT);
    }

    function test_constructor_revertsOnZeroPraetor() public {
        vm.expectRevert(bytes("zero praetor"));
        new CurveAdapter(address(pool), address(usdc), address(lpToken), int128(0), coffer, address(0), timelock, INSTRUMENT);
    }

    function test_constructor_revertsOnZeroTimelock_EEEEE1() public {
        vm.expectRevert(bytes("zero timelock"));
        new CurveAdapter(address(pool), address(usdc), address(lpToken), int128(0), coffer, praetor, address(0), INSTRUMENT);
    }
}

// ── mocks ─────────────────────────────────────────────────────────

contract MockCurvePool {
    address public usdc;
    address public lp_token;
    uint256 public virtualPrice = 1e18;
    uint256 public withdrawAmount;

    constructor(address _usdc, address _lp) {
        usdc = _usdc;
        lp_token = _lp;
    }

    function setWithdrawAmount(uint256 amt) external {
        withdrawAmount = amt;
    }

    function add_liquidity(uint256[2] calldata amounts, uint256) external returns (uint256 lpMinted) {
        // 1:1 lp mint for the test
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

    function get_virtual_price() external view returns (uint256) {
        return virtualPrice;
    }
}

contract MockERC20 {
    string public name;
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    // Audit UUUU-1: USDT/Tether-style tokens return false on insufficient
    // allowance or paused state instead of reverting. JJJ-9 added a
    // mandatory return-value check in CurveAdapter.close_position so a
    // false return surfaces UsdcTransferFailed instead of silently
    // stranding USDC in the adapter. Toggle to exercise that branch.
    bool public transferReturnsFalse;

    constructor(string memory _name, uint8 _decimals) {
        name = _name;
        decimals = _decimals;
    }

    function setTransferReturnsFalse(bool v) external {
        transferReturnsFalse = v;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function burn(address from, uint256 amount) external {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
    }

    function approve(address sp, uint256 v) external returns (bool) {
        allowance[msg.sender][sp] = v;
        return true;
    }

    function transfer(address to, uint256 v) external returns (bool) {
        if (transferReturnsFalse) {
            // Don't move balance — mimic USDT's silent-fail return.
            return false;
        }
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }
}
