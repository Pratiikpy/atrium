// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {AaveHorizonAdapterV11} from "../../contracts/adapters/aave-horizon/src/AaveHorizonAdapterV11.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title AaveHorizonAdapterV11 foundry test suite
/// @notice The audit B-10 patch: takes `originator` as an explicit first
///         parameter instead of parsing it from `venue_payload[0..20]` or
///         falling back to `tx.origin`. The v1.0 entry points must refuse
///         with the dedicated `V10NotSupported` error so integrators are
///         forced to migrate cleanly.
///
///         Also: `addInstrument` moved from `onlyPraetor` to `onlyTimelock`
///         (F-32 fix — risk-param changes go through 48h objection window).
contract AaveHorizonAdapterV11Test is Test {
    AaveHorizonAdapterV11 internal adapter;
    MockAavePoolV11 internal pool;
    MockERC20 internal usdc;
    address internal coffer;
    address internal praetor;
    address internal timelock;
    address internal user;
    address internal stranger;
    address internal hostile;

    bytes32 internal constant TBILL_3M = keccak256("AAVE-HORIZON-V11-TBILL-3M");

    event PositionOpened(
        uint256 indexed venue_position_id,
        address indexed owner,
        bytes32 indexed instrument_id,
        int256 notional_signed
    );
    event PositionClosed(uint256 indexed venue_position_id, int256 realized_pnl_signed);

    function setUp() public {
        coffer = makeAddr("atrium-coffer");
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        user = makeAddr("user");
        stranger = makeAddr("stranger");
        hostile = makeAddr("hostile");

        usdc = new MockERC20("USDC", 6);
        pool = new MockAavePoolV11(address(usdc));
        adapter = new AaveHorizonAdapterV11(address(pool), address(usdc), coffer, praetor, timelock);

        usdc.mint(address(adapter), 10_000_000 * 10 ** 6);

        // v1.1: addInstrument now goes through TIMELOCK, not the multisig.
        // F-32 fix locked in.
        vm.prank(timelock);
        adapter.addInstrument(TBILL_3M, 100, 500, 200);
    }

    // ── Metadata ─────────────────────────────────────────────────────

    function test_metadata_versionIs_1_1_0() public view {
        // v1.1 — the explicit-originator variant.
        (uint256 major, uint256 minor, uint256 patch) = adapter.version();
        assertEq(major, 1);
        assertEq(minor, 1);
        assertEq(patch, 0);
    }

    function test_metadata_namePinned() public view {
        assertEq(adapter.name(), "AaveHorizon");
    }

    function test_metadata_isHybridFalse() public view {
        assertFalse(adapter.isHybrid());
    }

    // ── v1.0 legacy entry points must refuse ─────────────────────────

    function test_v10_open_position_revertsV10NotSupported() public {
        // Critical migration gate: any caller still on v1.0 selectors must
        // get a clear error, not a silent partial behavior.
        vm.expectRevert(AaveHorizonAdapterV11.V10NotSupported.selector);
        adapter.open_position(TBILL_3M, int256(1_000e6), hex"");
    }

    function test_v10_close_position_revertsV10NotSupported() public {
        vm.expectRevert(AaveHorizonAdapterV11.V10NotSupported.selector);
        adapter.close_position(1, hex"");
    }

    function test_v10_modify_position_revertsV10NotSupported() public {
        vm.expectRevert(AaveHorizonAdapterV11.V10NotSupported.selector);
        adapter.modify_position(1, int256(100), hex"");
    }

    // ── addInstrument (timelock-only, F-32) ──────────────────────────

    function test_addInstrument_rejectsMultisig() public {
        // Praetor multisig must NOT be able to add — it's a parameter change,
        // belongs behind the 48h timelock per F-32.
        vm.prank(praetor);
        vm.expectRevert(AaveHorizonAdapterV11.Unauthorized.selector);
        adapter.addInstrument(keccak256("OTHER"), 100, 200, 100);
    }

    /// Iter 60 audit fix: pin setAuthorizedCaller auth + event. Mirror
    /// of iter 60 cross-adapter sweep.
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    function test_setAuthorizedCaller_rejectsHostile_iter60() public {
        vm.prank(hostile);
        vm.expectRevert(AaveHorizonAdapterV11.Unauthorized.selector);
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

    function test_addInstrument_rejectsHostile() public {
        vm.prank(hostile);
        vm.expectRevert(AaveHorizonAdapterV11.Unauthorized.selector);
        adapter.addInstrument(keccak256("OTHER"), 100, 200, 100);
    }

    function test_addInstrument_timelock_happyPath() public {
        bytes32 newInst = keccak256("AAVE-HORIZON-V11-TBILL-6M");
        vm.prank(timelock);
        adapter.addInstrument(newInst, 150, 750, 300);

        assertEq(adapter.get_haircut_bps(newInst), 150);
        bytes32[] memory inst = adapter.supportedInstruments();
        assertEq(inst.length, 2);
    }

    function test_addInstrument_idempotentReadds() public {
        vm.prank(timelock);
        adapter.addInstrument(TBILL_3M, 200, 1_000, 500);
        assertEq(adapter.supportedInstruments().length, 1, "no duplicate row");
        assertEq(adapter.get_haircut_bps(TBILL_3M), 200, "params updated");
    }

    // ── open_position_v11 — explicit originator ──────────────────────

    function test_openV11_onlyCoffer() public {
        vm.prank(hostile);
        vm.expectRevert(AaveHorizonAdapterV11.Unauthorized.selector);
        adapter.open_position_v11(user, TBILL_3M, int256(1_000e6), hex"");
    }

    function test_openV11_rejectsUnsupportedInstrument() public {
        bytes32 wrong = keccak256("not-listed");
        vm.prank(coffer);
        vm.expectRevert(abi.encodeWithSelector(AaveHorizonAdapterV11.UnsupportedInstrument.selector, wrong));
        adapter.open_position_v11(user, wrong, int256(1_000e6), hex"");
    }

    function test_openV11_rejectsZeroNotional() public {
        vm.prank(coffer);
        vm.expectRevert(AaveHorizonAdapterV11.ZeroNotional.selector);
        adapter.open_position_v11(user, TBILL_3M, int256(0), hex"");
    }

    function test_openV11_storesExplicitOriginator() public {
        // The audit B-10 fix: originator comes from the function arg, not
        // tx.origin nor venue_payload[0..20]. Verify the position is owned
        // by the explicit address.
        vm.expectEmit(true, true, true, true, address(adapter));
        emit PositionOpened(1, user, TBILL_3M, int256(1_000e6));

        vm.prank(coffer);
        uint256 id = adapter.open_position_v11(user, TBILL_3M, int256(1_000e6), hex"");
        assertEq(id, 1);

        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.owner, user);
        assertEq(view_.notional_signed, int256(1_000e6));

        // Aave received the supply on behalf of the adapter (it holds aToken).
        assertEq(pool.suppliedAmount(), 1_000e6);
        assertEq(pool.suppliedOnBehalfOf(), address(adapter));
    }

    function test_openV11_emptyPayloadIsAccepted() public {
        // v1.1 doesn't parse payload — Aave Horizon takes no off-chain args.
        // An empty payload must NOT trigger a BadVenuePayload-style revert.
        vm.prank(coffer);
        uint256 id = adapter.open_position_v11(user, TBILL_3M, int256(500e6), hex"");
        assertGt(id, 0);
    }

    // ── close_position_v11 — originator-bound ────────────────────────

    function test_closeV11_onlyCoffer() public {
        vm.prank(coffer);
        uint256 id = adapter.open_position_v11(user, TBILL_3M, int256(1_000e6), hex"");

        vm.prank(hostile);
        vm.expectRevert(AaveHorizonAdapterV11.Unauthorized.selector);
        adapter.close_position_v11(user, id, hex"");
    }

    function test_closeV11_rejectsWrongOriginator() public {
        // The most security-critical v1.1 invariant: closing requires the
        // SAME originator that opened. A stranger cannot close someone else's
        // position even if Coffer is tricked into calling.
        vm.prank(coffer);
        uint256 id = adapter.open_position_v11(user, TBILL_3M, int256(1_000e6), hex"");

        vm.prank(coffer);
        vm.expectRevert(AaveHorizonAdapterV11.PositionNotOwned.selector);
        adapter.close_position_v11(stranger, id, hex"");
    }

    function test_closeV11_unknownPosition_reverts() public {
        // Zero-address owner equals our query → PositionNotOwned fires.
        vm.prank(coffer);
        vm.expectRevert(AaveHorizonAdapterV11.PositionNotOwned.selector);
        adapter.close_position_v11(user, 9_999, hex"");
    }

    function test_closeV11_yieldPath_positivePnl() public {
        vm.prank(coffer);
        uint256 id = adapter.open_position_v11(user, TBILL_3M, int256(1_000e6), hex"");

        pool.setWithdrawReturn(1_050e6);

        vm.expectEmit(true, false, false, true, address(adapter));
        emit PositionClosed(id, int256(50e6));

        vm.prank(coffer);
        int256 pnl = adapter.close_position_v11(user, id, hex"");
        assertEq(pnl, int256(50e6));

        // Position cleared.
        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.owner, address(0));
    }

    function test_closeV11_lossPath_revertsOnShortfall() public {
        vm.prank(coffer);
        uint256 id = adapter.open_position_v11(user, TBILL_3M, int256(1_000e6), hex"");

        pool.setWithdrawReturn(995e6);

        vm.prank(coffer);
        vm.expectRevert(AaveHorizonAdapterV11.InsufficientAaveLiquidity.selector);
        adapter.close_position_v11(user, id, hex"");
    }

    function test_closeV11_withdrawsToCoffer() public {
        vm.prank(coffer);
        uint256 id = adapter.open_position_v11(user, TBILL_3M, int256(1_000e6), hex"");

        pool.setWithdrawReturn(1_010e6);
        vm.prank(coffer);
        adapter.close_position_v11(user, id, hex"");

        assertEq(pool.withdrawnTo(), coffer, "redeemed USDC must route to Coffer");
    }

    // ── venue health ─────────────────────────────────────────────────

    function test_venueHealth_operational() public view {
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertTrue(h.is_operational);
        assertEq(h.quoted_spread_bps, 0);
    }

    function test_venueHealth_offlineWhenLiquidityIndexZero() public {
        pool.setLiquidityIndex(0);
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertFalse(h.is_operational);
        assertEq(h.status_message, "reserve_unavailable");
    }

    // ── Audit JJJ-8 lock: V11 close_position withdraws the supplied
    //                       amount, NOT type(uint256).max ─────────────
    //
    // Mirror of the V10 JJJ-8 test in AaveHorizonAdapter.t.sol. V11 is
    // the production-deployed contract; V10 is revert-gated. Both
    // contracts contain the same fix and both warrant the pin.

    function test_closeV11_passesSuppliedAmountNotMax_JJJ8() public {
        vm.prank(coffer);
        uint256 id = adapter.open_position_v11(user, TBILL_3M, int256(1_000e6), hex"");

        vm.prank(coffer);
        adapter.close_position_v11(user, id, hex"");

        assertEq(pool.lastWithdrawAmount(), 1_000e6, "JJJ-8 V11 fix: withdraw amount must be the supplied principal");
        assertTrue(pool.lastWithdrawAmount() != type(uint256).max, "JJJ-8 V11 regression: uint256.max would drain other users");
    }
}

// ── mocks ─────────────────────────────────────────────────────────

contract MockAavePoolV11 {
    address public usdc;
    uint256 public suppliedAmount;
    address public suppliedOnBehalfOf;
    uint256 internal _withdrawReturn;
    address public withdrawnTo;
    uint128 internal _liquidityIndex = 1e27;

    constructor(address _usdc) {
        usdc = _usdc;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        require(asset == usdc, "asset");
        suppliedAmount = amount;
        suppliedOnBehalfOf = onBehalfOf;
        MockERC20(usdc).transferFrom(msg.sender, address(this), amount);
    }

    // Audit VVVV-2: capture the amount arg so JJJ-8 fix has an asserting
    // test on the V11 contract.
    uint256 public lastWithdrawAmount;

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        require(asset == usdc, "asset");
        lastWithdrawAmount = amount;
        uint256 out = _withdrawReturn == 0 ? suppliedAmount : _withdrawReturn;
        withdrawnTo = to;
        MockERC20(usdc).mint(to, out);
        return out;
    }

    function setWithdrawReturn(uint256 amount) external {
        _withdrawReturn = amount;
    }

    function setLiquidityIndex(uint128 idx) external {
        _liquidityIndex = idx;
    }

    function getReserveData(address)
        external
        view
        returns (
            uint256, uint128, uint128, uint128, uint128, uint128, uint40,
            uint16, address, address, address, address, uint128, uint128, uint128
        )
    {
        return (0, _liquidityIndex, 0, 0, 0, 0, 0, 0, address(0), address(0), address(0), address(0), 0, 0, 0);
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

    function transferFrom(address f, address to, uint256 v) external returns (bool) {
        require(allowance[f][msg.sender] >= v, "allowance");
        require(balanceOf[f] >= v, "balance");
        allowance[f][msg.sender] -= v;
        balanceOf[f] -= v;
        balanceOf[to] += v;
        return true;
    }
}
