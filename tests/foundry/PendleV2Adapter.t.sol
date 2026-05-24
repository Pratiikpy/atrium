// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {PendleV2Adapter} from "../../contracts/adapters/pendle/src/PendleV2Adapter.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

interface IPendleRouterShape {
    struct ApproxParams {
        uint256 guessMin;
        uint256 guessMax;
        uint256 guessOffchain;
        uint256 maxIteration;
        uint256 eps;
    }
    struct TokenInput {
        address tokenIn;
        uint256 netTokenIn;
        address tokenMintSy;
        address pendleSwap;
        bytes swapData;
    }
    struct TokenOutput {
        address tokenOut;
        uint256 minTokenOut;
        address tokenRedeemSy;
        address pendleSwap;
        bytes swapData;
    }
}

/// @title PendleV2Adapter foundry test suite
/// @notice Pendle's principal-token (PT) yield-stripping path. Adapter holds
///         PT tokens on behalf of the user; PnL realized at close as
///         (token_out − supplied). Market expiry is a hard gate — once a
///         Pendle market matures the adapter must refuse new opens.
contract PendleV2AdapterTest is Test {
    PendleV2Adapter internal adapter;
    MockPendleRouter internal router;
    MockPendleMarket internal market;
    MockERC20 internal usdc;
    address internal coffer;
    address internal praetor;
    address internal user;
    address internal hostile;

    bytes32 internal constant USDE_PT_DEC = keccak256("PENDLE-USDe-PT-DEC2026");

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
        router = new MockPendleRouter();
        market = new MockPendleMarket(block.timestamp + 365 days);

        adapter = new PendleV2Adapter(address(router), address(usdc), coffer, praetor, timelock);

        usdc.mint(address(adapter), 10_000_000 * 10 ** 6);

        // Audit EEEEE-1 fix: addInstrument is now onlyTimelock per F-32.
        vm.prank(timelock);
        adapter.addInstrument(USDE_PT_DEC, address(market), 300, 1_500, 750);
    }

    // ── Metadata ─────────────────────────────────────────────────────

    function test_metadata_namePinned() public view {
        assertEq(adapter.name(), "PendleV2");
    }

    function test_metadata_version() public view {
        (uint256 major, uint256 minor, uint256 patch) = adapter.version();
        assertEq(major, 1);
        assertEq(minor, 0);
        assertEq(patch, 0);
    }

    function test_metadata_isHybridFalse_andAttestIsPure() public view {
        assertFalse(adapter.isHybrid());
        assertFalse(adapter.attest_off_chain_state(hex""));
    }

    function test_metadata_supportedInstruments() public view {
        bytes32[] memory inst = adapter.supportedInstruments();
        assertEq(inst.length, 1);
        assertEq(inst[0], USDE_PT_DEC);
        assertEq(adapter.instrument_to_market(USDE_PT_DEC), address(market));
    }

    // ── addInstrument (timelock-only, audit EEEEE-1 + F-32) ──────────

    function test_addInstrument_rejectsHostile_EEEEE1() public {
        vm.prank(hostile);
        vm.expectRevert(PendleV2Adapter.Unauthorized.selector);
        adapter.addInstrument(keccak256("OTHER"), address(market), 100, 200, 100);
    }

    /// Iter 60 audit fix: setAuthorizedCaller had zero tests on Pendle
    /// — neither auth gating, state effect, nor event emission was
    /// pinned. The function gates which Router contracts can pull
    /// USDC from the adapter (open_position / close_position), so a
    /// refactor breaking it would silently allow any caller to drain.
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    function test_setAuthorizedCaller_rejectsHostile_iter60() public {
        vm.prank(hostile);
        vm.expectRevert(PendleV2Adapter.Unauthorized.selector);
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

    function test_addInstrument_rejectsMultisig_EEEEE1() public {
        // Audit EEEEE-1 load-bearing: the multisig CANNOT add instruments
        // directly. Pre-fix this was the only auth path — Praetor could
        // list a hostile instrument with no 48h community-veto window.
        vm.prank(praetor);
        vm.expectRevert(PendleV2Adapter.Unauthorized.selector);
        adapter.addInstrument(keccak256("OTHER"), address(market), 100, 200, 100);
    }

    function test_addInstrument_idempotentReadds_updateParamsAndMarket() public {
        // Re-adding must update market + risk params without duplicating list.
        MockPendleMarket newMarket = new MockPendleMarket(block.timestamp + 200 days);
        vm.prank(timelock);
        adapter.addInstrument(USDE_PT_DEC, address(newMarket), 400, 2_000, 1_000);

        bytes32[] memory inst = adapter.supportedInstruments();
        assertEq(inst.length, 1, "no duplicate entry");
        assertEq(adapter.instrument_to_market(USDE_PT_DEC), address(newMarket), "market updated");
        // Iter 57 audit fix: pre-iter-57 this only asserted get_haircut_bps.
        // The re-add path also writes the other two views, and a refactor
        // that wired them wrong would slip past this test silently.
        assertEq(adapter.get_haircut_bps(USDE_PT_DEC), 400);
        assertEq(adapter.get_initial_margin_bps(USDE_PT_DEC), 2_000);
        assertEq(adapter.get_maintenance_margin_bps(USDE_PT_DEC), 1_000);
    }

    /// Iter 57 audit fix: pin the addInstrument → get_*_bps storage
    /// routing on Pendle. Last of the 9 adapters with the (haircut,
    /// initial, maintenance) param triplet to get its dedicated routing
    /// test — see iter 56 task #230/#231 for the cross-adapter sweep.
    /// Three distinct prime values so any pairwise swap of the
    /// argument-to-mapping writes fails exactly one assertEq.
    function test_addInstrument_routesBpsArgsCorrectly_iter57() public {
        bytes32 newInst = keccak256("PENDLE-ETH-PT-MAR2027");
        MockPendleMarket newMarket = new MockPendleMarket(block.timestamp + 365 days);
        uint16 expectedHaircut = 137;
        uint16 expectedInitialMargin = 911;
        uint16 expectedMaintenanceMargin = 433;

        vm.prank(timelock);
        adapter.addInstrument(
            newInst,
            address(newMarket),
            expectedHaircut,
            expectedInitialMargin,
            expectedMaintenanceMargin
        );

        assertEq(adapter.get_haircut_bps(newInst), expectedHaircut, "iter57: haircut routing");
        assertEq(adapter.get_initial_margin_bps(newInst), expectedInitialMargin, "iter57: initial-margin routing");
        assertEq(adapter.get_maintenance_margin_bps(newInst), expectedMaintenanceMargin, "iter57: maintenance-margin routing");
    }

    // ── EEEEE-3: addInstrument emits InstrumentAdded ─────────────────

    event InstrumentAdded(
        bytes32 indexed instrument_id,
        uint16 haircut_bps,
        uint16 initial_margin_bps,
        uint16 maintenance_margin_bps
    );

    function test_addInstrument_emitsInstrumentAdded_EEEEE3() public {
        bytes32 newInst = keccak256("NEW-PT");
        MockPendleMarket newMarket = new MockPendleMarket(block.timestamp + 100 days);

        vm.expectEmit(true, false, false, true, address(adapter));
        emit InstrumentAdded(newInst, 250, 1_200, 600);

        vm.prank(timelock);
        adapter.addInstrument(newInst, address(newMarket), 250, 1_200, 600);
    }

    // ── open_position ────────────────────────────────────────────────

    function test_open_onlyCoffer() public {
        bytes memory payload = _buildOpenPayload(user, 900e6);
        vm.prank(hostile);
        vm.expectRevert(PendleV2Adapter.Unauthorized.selector);
        adapter.open_position(USDE_PT_DEC, int256(1_000e6), payload);
    }

    function test_open_rejectsUnsupportedInstrument() public {
        bytes32 wrong = keccak256("NOT-LISTED");
        bytes memory payload = _buildOpenPayload(user, 900e6);
        vm.prank(coffer);
        vm.expectRevert(abi.encodeWithSelector(PendleV2Adapter.UnsupportedInstrument.selector, wrong));
        adapter.open_position(wrong, int256(1_000e6), payload);
    }

    function test_open_rejectsMaturedMarket() public {
        // Warp past the market's expiry — open must revert.
        //
        // Audit Y-1 (caught running this suite): an inline `market.expiry()`
        // inside the expectRevert encoding is a STATICCALL that consumes the
        // `vm.prank(coffer)` set just before. Result: the *open_position*
        // call ran with msg.sender = the test contract, fired Unauthorized
        // before MarketExpired, and the test reported the wrong selector.
        // Fix: snapshot expiry BEFORE the prank.
        uint256 expiry = market.expiry();
        vm.warp(expiry + 1);
        bytes memory payload = _buildOpenPayload(user, 900e6);
        uint256 nowTs = block.timestamp;
        vm.prank(coffer);
        vm.expectRevert(abi.encodeWithSelector(PendleV2Adapter.MarketExpired.selector, expiry, nowTs));
        adapter.open_position(USDE_PT_DEC, int256(1_000e6), payload);
    }

    function test_open_rejectsShortPayload() public {
        bytes memory payload = new bytes(19);
        vm.prank(coffer);
        vm.expectRevert(PendleV2Adapter.BadVenuePayload.selector);
        adapter.open_position(USDE_PT_DEC, int256(1_000e6), payload);
    }

    function test_open_happyPath_storesPtBalanceAndOriginator() public {
        // Router will return 1_050e18 PT for 1_000e6 USDC (5% upfront-yield).
        router.setPtOut(1_050e18);
        bytes memory payload = _buildOpenPayload(user, 1_040e18); // min_pt_out

        vm.expectEmit(true, true, true, true, address(adapter));
        emit PositionOpened(1, user, USDE_PT_DEC, int256(1_000e6));

        vm.prank(coffer);
        uint256 id = adapter.open_position(USDE_PT_DEC, int256(1_000e6), payload);
        assertEq(id, 1);
        assertEq(router.lastSwapMarket(), address(market));
        assertEq(router.lastSwapReceiver(), address(adapter), "adapter holds PT");

        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.owner, user);
        assertEq(view_.notional_signed, int256(1_000e6));
        assertEq(view_.entry_price_q64, 1 << 64, "PT entry pinned at 1.0");
    }

    function test_open_negativeNotional_treatsAsAbsoluteSupply() public {
        // Pendle is supply-only; negative notional uses abs() for the supply
        // amount. Verify the contract behavior — locks the v1 pattern.
        router.setPtOut(500e18);
        bytes memory payload = _buildOpenPayload(user, 490e18);

        vm.prank(coffer);
        uint256 id = adapter.open_position(USDE_PT_DEC, int256(-500e6), payload);

        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.notional_signed, int256(-500e6));
    }

    // ── close_position ───────────────────────────────────────────────

    function test_close_onlyCoffer() public {
        router.setPtOut(1_050e18);
        bytes memory payload = _buildOpenPayload(user, 1_040e18);
        vm.prank(coffer);
        uint256 id = adapter.open_position(USDE_PT_DEC, int256(1_000e6), payload);

        vm.prank(hostile);
        vm.expectRevert(PendleV2Adapter.Unauthorized.selector);
        adapter.close_position(id, _buildClosePayload(990e6));
    }

    function test_close_unknownPosition_reverts() public {
        vm.prank(coffer);
        vm.expectRevert(PendleV2Adapter.PositionNotFound.selector);
        adapter.close_position(9_999, _buildClosePayload(900e6));
    }

    function test_close_yieldPath_positivePnl() public {
        router.setPtOut(1_050e18);
        bytes memory payload = _buildOpenPayload(user, 1_040e18);
        vm.prank(coffer);
        uint256 id = adapter.open_position(USDE_PT_DEC, int256(1_000e6), payload);

        // PT swaps back to 1_060e6 USDC (6% return on principal).
        router.setTokenOut(1_060e6);

        vm.expectEmit(true, false, false, true, address(adapter));
        emit PositionClosed(id, int256(60e6));

        vm.prank(coffer);
        int256 pnl = adapter.close_position(id, _buildClosePayload(950e6));
        assertEq(pnl, int256(60e6));

        // Position deleted, USDC sent to coffer.
        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.owner, address(0));
        assertEq(router.lastSwapPtReceiver(), coffer, "USDC routes to coffer");
    }

    function test_close_lossPath() public {
        router.setPtOut(1_050e18);
        bytes memory payload = _buildOpenPayload(user, 1_040e18);
        vm.prank(coffer);
        uint256 id = adapter.open_position(USDE_PT_DEC, int256(1_000e6), payload);

        // Early-exit price impact → 940 USDC out for 1000 USDC supplied.
        router.setTokenOut(940e6);

        vm.prank(coffer);
        int256 pnl = adapter.close_position(id, _buildClosePayload(900e6));
        assertEq(pnl, int256(-60e6));
    }

    // ── modify_position v1 lock ──────────────────────────────────────

    function test_modify_position_revertsV1() public {
        vm.expectRevert(bytes("modify not supported in v1"));
        adapter.modify_position(1, int256(100), hex"");
    }

    // ── venue health ─────────────────────────────────────────────────

    function test_venueHealth_alwaysOk() public view {
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertTrue(h.is_operational);
        assertEq(h.quoted_spread_bps, 10);
    }

    // ── Mock-arg-capture pins (audit WWWW-1) ─────────────────────────
    //
    // Pre-WWWW the MockPendleRouter dropped `minPtOut`, `market_` (close),
    // and `exactPtIn` via `/*...*/` strip-comments. A future bug that
    // passed the WRONG value to any of these would have stayed CI-green.
    // WWWW-1 captures every arg; these tests pin them.

    function test_open_passesMinPtOutToRouter_WWWW1() public {
        // _buildOpenPayload(user, 1_040e18) sets min_pt_out = 1_040e18 in
        // the encoded payload; the adapter passes it straight to the router.
        router.setPtOut(1_050e18);
        bytes memory payload = _buildOpenPayload(user, 1_040e18);

        vm.prank(coffer);
        adapter.open_position(USDE_PT_DEC, int256(1_000e6), payload);

        assertEq(router.lastMinPtOut(), 1_040e18, "WWWW-1: minPtOut must reach the router unchanged");
    }

    function test_close_passesPositionPtBalanceToRouter_WWWW1() public {
        // Open with 1_050e18 PT, then close. The adapter must pass the
        // position's pt_balance (1_050e18) as exactPtIn, NOT any other
        // value (notional in different units, etc).
        router.setPtOut(1_050e18);
        bytes memory openPayload = _buildOpenPayload(user, 1_040e18);
        vm.prank(coffer);
        uint256 id = adapter.open_position(USDE_PT_DEC, int256(1_000e6), openPayload);

        router.setTokenOut(1_060e6);
        bytes memory closePayload = _buildClosePayload(950e6);
        vm.prank(coffer);
        adapter.close_position(id, closePayload);

        assertEq(router.lastClosePtAmount(), 1_050e18, "WWWW-1: close must pass the position's PT balance exactly");
        assertEq(router.lastClosePtMarket(), address(market), "WWWW-1: close must pass the position's market addr");
    }

    // ── Constructor zero-checks (audit NNNN-1) ───────────────────────
    // Audit TTTT-1: NNNN-1 added four `require(_X != address(0))` guards
    // to the constructor. Pinning the revert path closes the
    // test-coverage drift SSSS-1 flagged for the NNNN-1 closer.

    function test_constructor_revertsOnZeroRouter() public {
        vm.expectRevert(bytes("zero router"));
        new PendleV2Adapter(address(0), address(usdc), coffer, praetor, timelock);
    }

    function test_constructor_revertsOnZeroUsdc() public {
        vm.expectRevert(bytes("zero usdc"));
        new PendleV2Adapter(address(router), address(0), coffer, praetor, timelock);
    }

    function test_constructor_revertsOnZeroCoffer() public {
        vm.expectRevert(bytes("zero coffer"));
        new PendleV2Adapter(address(router), address(usdc), address(0), praetor, timelock);
    }

    function test_constructor_revertsOnZeroPraetor() public {
        vm.expectRevert(bytes("zero praetor"));
        new PendleV2Adapter(address(router), address(usdc), coffer, address(0), timelock);
    }

    function test_constructor_revertsOnZeroTimelock_EEEEE1() public {
        vm.expectRevert(bytes("zero timelock"));
        new PendleV2Adapter(address(router), address(usdc), coffer, praetor, address(0));
    }

    // ── helpers ──────────────────────────────────────────────────────

    function _buildOpenPayload(address originator, uint256 minPtOut) internal view returns (bytes memory) {
        IPendleRouterShape.ApproxParams memory approx = IPendleRouterShape.ApproxParams({
            guessMin: 0, guessMax: type(uint256).max, guessOffchain: 0, maxIteration: 256, eps: 1e15
        });
        IPendleRouterShape.TokenInput memory input = IPendleRouterShape.TokenInput({
            tokenIn: address(usdc),
            netTokenIn: 1_000e6,
            tokenMintSy: address(usdc),
            pendleSwap: address(0),
            swapData: hex""
        });
        bytes memory pendleSuffix = abi.encode(minPtOut, approx, input);
        return abi.encodePacked(originator, pendleSuffix);
    }

    function _buildClosePayload(uint256 minTokenOut) internal view returns (bytes memory) {
        IPendleRouterShape.TokenOutput memory output = IPendleRouterShape.TokenOutput({
            tokenOut: address(usdc),
            minTokenOut: minTokenOut,
            tokenRedeemSy: address(usdc),
            pendleSwap: address(0),
            swapData: hex""
        });
        return abi.encode(output);
    }
}

// ── mocks ─────────────────────────────────────────────────────────

contract MockPendleMarket {
    uint256 internal _expiry;

    constructor(uint256 _exp) {
        _expiry = _exp;
    }

    function expiry() external view returns (uint256) {
        return _expiry;
    }

    function readTokens() external pure returns (address, address, address) {
        return (address(0), address(0), address(0));
    }

    function readState() external pure returns (int256, int256, int256, address, int256, uint256, uint256, uint256, uint256) {
        return (0, 0, 0, address(0), 0, 0, 0, 0, 0);
    }
}

contract MockPendleRouter {
    uint256 internal _ptOut;
    uint256 internal _tokenOut;
    address public lastSwapMarket;
    address public lastSwapReceiver;
    address public lastSwapPtReceiver;
    // Audit WWWW-1: capture every arg the contract passes so future bugs
    // that change a value (rather than removing a behavior) get caught.
    // Same lesson as JJJ-8 mock-level drift.
    uint256 public lastMinPtOut;
    address public lastClosePtMarket;
    uint256 public lastClosePtAmount;

    function setPtOut(uint256 amt) external {
        _ptOut = amt;
    }

    function setTokenOut(uint256 amt) external {
        _tokenOut = amt;
    }

    function swapExactTokenForPt(
        address receiver,
        address market_,
        uint256 minPtOut,
        IPendleRouterShape.ApproxParams calldata,
        IPendleRouterShape.TokenInput calldata
    ) external returns (uint256, uint256, uint256) {
        lastSwapMarket = market_;
        lastSwapReceiver = receiver;
        lastMinPtOut = minPtOut;
        return (_ptOut, 0, 0);
    }

    function swapExactPtForToken(
        address receiver,
        address market_,
        uint256 exactPtIn,
        IPendleRouterShape.TokenOutput calldata
    ) external returns (uint256, uint256, uint256) {
        lastSwapPtReceiver = receiver;
        lastClosePtMarket = market_;
        lastClosePtAmount = exactPtIn;
        return (_tokenOut, 0, 0);
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
