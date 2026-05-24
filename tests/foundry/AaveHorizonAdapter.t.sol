// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {AaveHorizonAdapter} from "../../contracts/adapters/aave-horizon/src/AaveHorizonAdapter.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title AaveHorizonAdapter foundry test suite
/// @notice Aave Horizon is RWA T-bill exposure via Aave V3. Supply USDC → receive
///         aUSDC representing fixed-income yield. The Atrium adapter holds aUSDC
///         on behalf of users and reports a stable ~1.0 price (T-bills held to
///         maturity).
///
///         This is the first non-derivative adapter test. Key differences from
///         CurveAdapter and TradeXyzAdapter:
///           - Supply-only (no short side)
///           - Withdraws via `type(uint256).max` to capture accrued yield
///           - PnL = withdrawn − supplied (zero-cost-basis yield surfaces here)
///           - VenueHealth keys on Aave reserve `liquidityIndex > 0`
contract AaveHorizonAdapterTest is Test {
    AaveHorizonAdapter internal adapter;
    MockAavePool internal pool;
    MockERC20 internal usdc;
    address internal coffer;
    address internal praetor;
    address internal user;
    address internal hostile;

    bytes32 internal constant TBILL_3M = keccak256("AAVE-HORIZON-TBILL-3M");

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
        user = makeAddr("user");
        hostile = makeAddr("hostile");

        usdc = new MockERC20("USDC", 6);
        pool = new MockAavePool(address(usdc));

        adapter = new AaveHorizonAdapter(address(pool), address(usdc), coffer, praetor);

        // Fund the adapter so it can `supply` to the mock pool.
        usdc.mint(address(adapter), 10_000_000 * 10 ** 6);

        // Praetor whitelists the T-bill instrument.
        vm.prank(praetor);
        adapter.addInstrument(TBILL_3M, 100, 500, 200); // 1% haircut, 5% IM, 2% MM
    }

    // ── Metadata ─────────────────────────────────────────────────────

    function test_metadata_namePinned() public view {
        assertEq(adapter.name(), "AaveHorizon");
    }

    function test_metadata_version() public view {
        (uint256 major, uint256 minor, uint256 patch) = adapter.version();
        assertEq(major, 1);
        assertEq(minor, 0);
        assertEq(patch, 0);
    }

    function test_metadata_isHybridFalse_andAttestReturnsFalse() public {
        // AaveHorizonAdapter.attest_off_chain_state isn't marked view/pure
        // (unlike CurveAdapter/TradeXyzAdapter) so this test cannot be `view`.
        // Worth noting as a CurveAdapter/AaveHorizonAdapter interface drift
        // we should normalize in v2 — see follow-up X-1 in audit register.
        assertFalse(adapter.isHybrid());
        assertFalse(adapter.attest_off_chain_state(hex""));
    }

    function test_metadata_supportedInstruments() public view {
        bytes32[] memory inst = adapter.supportedInstruments();
        assertEq(inst.length, 1);
        assertEq(inst[0], TBILL_3M);
    }

    // ── addInstrument() ──────────────────────────────────────────────

    function test_addInstrument_onlyPraetor() public {
        vm.prank(hostile);
        vm.expectRevert(AaveHorizonAdapter.Unauthorized.selector);
        adapter.addInstrument(keccak256("OTHER"), 50, 250, 100);
    }

    function test_addInstrument_idempotent() public {
        uint256 before_ = adapter.supportedInstruments().length;
        vm.prank(praetor);
        adapter.addInstrument(TBILL_3M, 200, 1_000, 500);
        assertEq(adapter.supportedInstruments().length, before_, "no duplicate row");
        assertEq(adapter.get_haircut_bps(TBILL_3M), 200);
        assertEq(adapter.get_initial_margin_bps(TBILL_3M), 1_000);
        assertEq(adapter.get_maintenance_margin_bps(TBILL_3M), 500);
    }

    // ── open_position ────────────────────────────────────────────────

    function test_open_onlyCoffer() public {
        bytes memory payload = abi.encodePacked(user);
        vm.prank(hostile);
        vm.expectRevert(AaveHorizonAdapter.Unauthorized.selector);
        adapter.open_position(TBILL_3M, int256(1_000e6), payload);
    }

    function test_open_rejectsUnsupportedInstrument() public {
        bytes32 wrong = keccak256("not-supported");
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        vm.expectRevert(abi.encodeWithSelector(AaveHorizonAdapter.UnsupportedInstrument.selector, wrong));
        adapter.open_position(wrong, int256(1_000e6), payload);
    }

    function test_open_rejectsZeroNotional() public {
        // Aave Horizon doesn't make sense at zero — explicit revert per audit.
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        vm.expectRevert(AaveHorizonAdapter.ZeroNotional.selector);
        adapter.open_position(TBILL_3M, int256(0), payload);
    }

    function test_open_rejectsShortPayload() public {
        bytes memory payload = new bytes(19);
        vm.prank(coffer);
        vm.expectRevert(AaveHorizonAdapter.BadVenuePayload.selector);
        adapter.open_position(TBILL_3M, int256(1_000e6), payload);
    }

    function test_open_happyPath_suppliedToAave() public {
        bytes memory payload = abi.encodePacked(user);

        vm.expectEmit(true, true, true, true, address(adapter));
        emit PositionOpened(1, user, TBILL_3M, int256(1_000e6));

        vm.prank(coffer);
        uint256 id = adapter.open_position(TBILL_3M, int256(1_000e6), payload);
        assertEq(id, 1);

        // Pool received 1_000e6 supplied on behalf of the adapter (the
        // adapter holds the aToken). User is the originator owner.
        assertEq(pool.suppliedAmount(), 1_000e6);
        assertEq(pool.suppliedOnBehalfOf(), address(adapter), "adapter holds aToken");

        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.owner, user, "originator must be the user not coffer");
        assertEq(view_.entry_price_q64, 1 << 64, "T-bill entry pinned at 1.0");
    }

    function test_open_negativeNotional_alsoSupplies() public {
        // The contract takes abs(notional) and supplies — a negative input
        // doesn't switch to a borrow path in v1. Verify the absolute value
        // pattern so a future v2 short-path doesn't quietly change behavior.
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        adapter.open_position(TBILL_3M, int256(-500e6), payload);
        assertEq(pool.suppliedAmount(), 500e6);
    }

    // ── close_position ───────────────────────────────────────────────

    function test_close_onlyCoffer() public {
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(TBILL_3M, int256(1_000e6), payload);

        vm.prank(hostile);
        vm.expectRevert(AaveHorizonAdapter.Unauthorized.selector);
        adapter.close_position(id, hex"");
    }

    function test_close_unknownPosition_reverts() public {
        vm.prank(coffer);
        vm.expectRevert(AaveHorizonAdapter.PositionNotOwned.selector);
        adapter.close_position(9_999, hex"");
    }

    function test_close_yieldPath_positivePnl() public {
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(TBILL_3M, int256(1_000e6), payload);

        // Aave pays out 1050 USDC (5% yield) on withdraw.
        pool.setWithdrawReturn(1_050e6);

        vm.expectEmit(true, false, false, true, address(adapter));
        emit PositionClosed(id, int256(50e6));

        vm.prank(coffer);
        int256 pnl = adapter.close_position(id, hex"");
        assertEq(pnl, int256(50e6), "yield must surface as positive PnL");

        // Position deleted.
        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.owner, address(0));
    }

    function test_close_lossPath_negativePnl_unusualButPossible() public {
        // Aave Horizon CAN have a loss path if early withdrawal trims yield
        // below principal, or if the underlying T-bill mark-to-market dips.
        // The adapter must surface this honestly as a negative PnL.
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(TBILL_3M, int256(1_000e6), payload);

        pool.setWithdrawReturn(995e6); // -0.5% slippage on early exit

        vm.prank(coffer);
        int256 pnl = adapter.close_position(id, hex"");
        assertEq(pnl, int256(-5e6));
    }

    function test_close_withdrawsToCoffer() public {
        // Aave's withdraw `to` must be the Atrium Coffer (not the adapter
        // itself), so the redeemed USDC immediately joins the shared vault.
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(TBILL_3M, int256(1_000e6), payload);

        pool.setWithdrawReturn(1_020e6);
        vm.prank(coffer);
        adapter.close_position(id, hex"");

        assertEq(pool.withdrawnTo(), coffer, "withdraw destination must be Coffer");
    }

    // ── modify_position v1 lock ──────────────────────────────────────

    function test_modify_position_onlyCoffer() public {
        vm.prank(hostile);
        vm.expectRevert(AaveHorizonAdapter.Unauthorized.selector);
        adapter.modify_position(1, int256(100), hex"");
    }

    function test_modify_position_revertsForV1() public {
        vm.prank(coffer);
        vm.expectRevert(bytes("modify not supported in v1"));
        adapter.modify_position(1, int256(100), hex"");
    }

    // ── get_venue_health ─────────────────────────────────────────────

    function test_venueHealth_operationalWhenLiquidityIndexNonzero() public view {
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertTrue(h.is_operational, "default mock has liq index > 0");
        assertEq(h.quoted_spread_bps, 0, "T-bills have no spread");
        assertEq(h.status_message, "ok");
    }

    function test_venueHealth_offlineWhenLiquidityIndexZero() public {
        pool.setLiquidityIndex(0);
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertFalse(h.is_operational);
        assertEq(h.status_message, "reserve_unavailable");
    }

    // ── Audit JJJ-8 lock: close_position withdraws exactly the supplied
    //                       amount, NOT type(uint256).max ─────────────
    //
    // Pre-JJJ-8, AaveHorizonAdapter.close_position passed type(uint256).max
    // as the withdraw amount. Aave V3 interprets that as "withdraw entire
    // aToken balance of the adapter" — across every open position. One
    // user's close drained every other user's principal, reporting it as
    // the closer's PnL.
    //
    // The mock previously ignored the amount arg (commented `/*amount*/`)
    // which made the fix's pre/post behavior invisible to CI. VVVV-2 added
    // `lastWithdrawAmount` capture so this test can pin the value.

    function test_close_passesSuppliedAmountNotMax_JJJ8() public {
        // Open a 1000 USDC position.
        bytes memory payload = abi.encodePacked(user);
        vm.prank(coffer);
        uint256 id = adapter.open_position(TBILL_3M, int256(1_000e6), payload);

        // Close it — assert the withdraw call used the supplied amount,
        // NOT type(uint256).max. Pre-fix this assertion fails immediately
        // (value would be type(uint256).max ≈ 1.16e77).
        vm.prank(coffer);
        adapter.close_position(id, hex"");

        assertEq(pool.lastWithdrawAmount(), 1_000e6, "JJJ-8 fix: withdraw amount must be the supplied principal, not uint256.max");
        // Defense: ensure we're testing the post-fix behavior, not just any
        // value below uint256.max. Compare against the type max explicitly.
        assertTrue(pool.lastWithdrawAmount() != type(uint256).max, "JJJ-8 regression: uint256.max would drain other users");
    }

    // ── Constructor zero-checks (audit NNNN-1) ───────────────────────
    // Audit TTTT-1: pin every revert branch added by NNNN-1.

    function test_constructor_revertsOnZeroPool() public {
        vm.expectRevert(bytes("zero pool"));
        new AaveHorizonAdapter(address(0), address(usdc), coffer, praetor);
    }

    function test_constructor_revertsOnZeroUsdc() public {
        vm.expectRevert(bytes("zero usdc"));
        new AaveHorizonAdapter(address(pool), address(0), coffer, praetor);
    }

    function test_constructor_revertsOnZeroCoffer() public {
        vm.expectRevert(bytes("zero coffer"));
        new AaveHorizonAdapter(address(pool), address(usdc), address(0), praetor);
    }

    function test_constructor_revertsOnZeroPraetor() public {
        vm.expectRevert(bytes("zero praetor"));
        new AaveHorizonAdapter(address(pool), address(usdc), coffer, address(0));
    }
}

// ── mocks ─────────────────────────────────────────────────────────

contract MockAavePool {
    address public usdc;
    uint256 public suppliedAmount;
    address public suppliedOnBehalfOf;
    uint256 internal _withdrawReturn;
    address public withdrawnTo;
    // Audit VVVV-2: capture the amount arg so the JJJ-8 fix can be pinned
    // against a real assertion. Pre-fix the adapter passed type(uint256).max
    // which Aave V3 treats as "withdraw entire aToken balance". Mock now
    // records the value so the test fails if the fix is reverted.
    uint256 public lastWithdrawAmount;
    uint128 internal _liquidityIndex = 1e27; // ray, mimics Aave V3 init

    constructor(address _usdc) {
        usdc = _usdc;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        require(asset == usdc, "asset");
        suppliedAmount = amount;
        suppliedOnBehalfOf = onBehalfOf;
        MockERC20(usdc).transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        require(asset == usdc, "asset");
        lastWithdrawAmount = amount;
        uint256 out = _withdrawReturn == 0 ? suppliedAmount : _withdrawReturn;
        withdrawnTo = to;
        // Tx the redeemed amount to the destination.
        MockERC20(usdc).mint(to, out);
        return out;
    }

    function setWithdrawReturn(uint256 amount) external {
        _withdrawReturn = amount;
    }

    function setLiquidityIndex(uint128 idx) external {
        _liquidityIndex = idx;
    }

    function borrow(address, uint256, uint256, uint16, address) external pure {
        revert("not-impl");
    }

    function repay(address, uint256, uint256, address) external pure returns (uint256) {
        revert("not-impl");
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
