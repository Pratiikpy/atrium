// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {AtriumRouter} from "../../contracts/atrium-router/src/AtriumRouter.sol";
import {AaveHorizonAdapterV11} from "../../contracts/adapters/aave-horizon/src/AaveHorizonAdapterV11.sol";
import {MockAavePool} from "../../contracts/mocks/MockAavePool.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title RouterAaveFillE2E, the REAL Aave fill path through the REAL Router
/// @notice Closes the one trade-fill verification gap that was buildable
///         locally with zero timelock wait. On-chain, venue 2 (Aave Horizon)
///         is the ONLY registry-active venue (its v1.1.1 adapter 0x826dc4FE is
///         backed by MockAavePool 0x2e1360fa, registered 2026-05-30 via tx
///         0xa339d747), so a real on-chain fill, when the 48h Coffer→Router
///         timelock (#337) lands, routes through THIS adapter. Yet before this
///         file the Aave adapter was only ever tested in ISOLATION
///         (AaveHorizonAdapterV11.t.sol calls open_position_v11 directly as the
///         Coffer), never chained through AtriumRouter. The existing
///         AtriumRouter.t.sol proves the end-to-end chain only for CurveAdapter.
///
///         This suite proves the four-step Router orchestration end to end for
///         the Aave leg with the REAL AtriumRouter + REAL AaveHorizonAdapterV11
///         + REAL MockAavePool (the same testnet pool stub deployed on Arb
///         Sepolia). Plinth + Coffer are necessarily Solidity fakes: the real
///         Plinth/Coffer/Sigil are Stylus (Rust→WASM) and emit no EVM bytecode,
///         so `forge` cannot instantiate them (human_left.md #11). The fakes
///         implement exactly the narrow interfaces the Router calls
///         (openPosition / getAccount / getPosition / adapterPull /
///         isAdapterApproved); the Aave adapter, the pool, and the Router are
///         all production code.
///
///         What this DOES prove: the Router resolves the Aave adapter from the
///         registry, dispatches to the v1.1 entry point (version()==(1,1,0)),
///         Coffer delivers the margin USDC to the adapter, the adapter supplies
///         it into the Aave pool, the venue position is owned by the USER (not
///         the Router, the B-10/G-5 originator fix), and the close path
///         withdraws the principal back to Coffer.
///         What this does NOT prove (still gated, documented in
///         project_audit_build_gaps_status memory + task #429): the real Stylus
///         Plinth SPAN margin math, the real Sigil EIP-712 owner resolution,
///         and the dual-oracle price read, those require the live Stylus
///         deployment + the 48h timelock ops + a per-trade Pyth push.
contract RouterAaveFillE2E is Test {
    AtriumRouter internal router;
    FakeCoffer internal coffer;
    FakePlinth internal plinth;
    FakeRegistry internal registry;
    AaveHorizonAdapterV11 internal aave;
    MockAavePool internal pool;
    MockERC20 internal usdc;

    address internal user;
    address internal praetor;
    address internal timelock;
    address internal hostile;

    // venue 2 = Aave Horizon per apps/verify/src/lib/venues.ts + the on-chain
    // PorticoRegistry registration. Instrument matches use-open-position.ts
    // SYMBOL_BY_VENUE['aave-horizon'] = 'USDC-LEND'.
    uint8 internal constant AAVE_VENUE_ID = 2;
    bytes32 internal constant INSTRUMENT = keccak256("USDC-LEND");

    // Aave-side instrument risk params (cash-equivalent USDC lend). Mirror the
    // venues.ts haircutBps=100 (1%); IM/MM are adapter-local demo values.
    uint16 internal constant HAIRCUT_BPS = 100;
    uint16 internal constant INITIAL_MARGIN_BPS = 500;
    uint16 internal constant MAINT_MARGIN_BPS = 200;

    event PositionOpenedViaRouter(
        address indexed user,
        uint8 indexed venue_id,
        bytes32 indexed instrument_id,
        int256 notional_signed,
        uint256 plinth_position_id,
        uint256 venue_position_id
    );

    event PositionClosedViaRouter(
        address indexed user,
        uint8 indexed venue_id,
        uint256 indexed plinth_position_id,
        uint256 venue_position_id,
        int256 realized_pnl_signed
    );

    function setUp() public {
        user = makeAddr("user");
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        hostile = makeAddr("hostile");

        usdc = new MockERC20("USDC", 6);
        pool = new MockAavePool();
        coffer = new FakeCoffer(address(usdc));
        plinth = new FakePlinth();
        registry = new FakeRegistry();

        aave = new AaveHorizonAdapterV11(
            address(pool),
            address(usdc),
            address(coffer), // atrium_coffer (immutable authorized caller)
            praetor,
            timelock
        );

        router = new AtriumRouter(address(plinth), address(coffer), address(registry), praetor, timelock);

        // Wire: Coffer approves the Router as an orchestrator (real Coffer's
        // timelock-set approved_adapters mapping). Registry resolves venue 2 →
        // Aave adapter. Adapter authorizes the Router as a caller (the on-chain
        // setAuthorizedCaller(Router) executed 2026-05-30 mirrors this).
        coffer.setApprovedAdapter(address(router), true);
        registry.setAdapter(AAVE_VENUE_ID, address(aave));
        vm.prank(timelock);
        aave.setAuthorizedCaller(address(router), true);

        // The adapter only opens positions on supported instruments
        // (addInstrument is onlyTimelock, the on-chain equivalent gates a
        // venue's instrument list the same way).
        vm.prank(timelock);
        aave.addInstrument(INSTRUMENT, HAIRCUT_BPS, INITIAL_MARGIN_BPS, MAINT_MARGIN_BPS);

        // Fund: the user owns Coffer shares (a USDC claim); Coffer holds the
        // USDC that adapter_pull moves to the adapter.
        coffer.creditShares(user, 10_000_000 * 10 ** 6);
        usdc.mint(address(coffer), 10_000_000 * 10 ** 6);
    }

    // ── The load-bearing end-to-end open through the REAL Aave adapter ──────

    function test_open_via_router_aave_fullChainSuppliesIntoPool() public {
        bytes memory empty = hex"";
        int256 notional = int256(1_000e6);

        vm.expectEmit(true, true, true, true, address(router));
        emit PositionOpenedViaRouter(user, AAVE_VENUE_ID, INSTRUMENT, notional, 1, 1);

        vm.prank(user, user);
        (uint256 plinthId, uint256 venueId) =
            router.open_position_via_adapter(AAVE_VENUE_ID, INSTRUMENT, notional, empty, empty, empty);

        assertEq(plinthId, 1, "Plinth must return a position id");
        assertEq(venueId, 1, "Aave adapter must return a venue position id");

        // 1. Plinth saw the open.
        assertTrue(plinth.openCalled(), "Plinth.openPosition must be invoked");
        // 2. Coffer.adapterPull delivered the margin USDC to the Aave adapter.
        assertEq(coffer.lastAdapterPullAmount(), 1_000e6, "Coffer.adapterPull must run for the margin");
        assertEq(coffer.lastAdapterPullTo(), address(aave), "USDC must route to the Aave adapter");
        // 3. The adapter supplied the USDC into the Aave pool (real supply()).
        assertEq(pool.supplied(address(usdc), address(aave)), 1_000e6, "adapter must supply into the pool");
        assertEq(usdc.balanceOf(address(pool)), 1_000e6, "USDC must physically sit in the pool");
        assertEq(usdc.balanceOf(address(aave)), 0, "adapter must not retain USDC after supply");
        // 4. The venue position is owned by the USER, not the Router (B-10/G-5).
        IPorticoAdapter.PositionView memory v = aave.get_position(venueId);
        assertEq(v.owner, user, "originator must be user, not the Router");
        assertEq(v.instrument_id, INSTRUMENT, "instrument recorded");
        assertEq(v.notional_signed, notional, "notional recorded");
    }

    // ── The close path: withdraw principal back to Coffer ───────────────────

    function test_close_via_router_aave_withdrawsPrincipalToCoffer() public {
        bytes memory empty = hex"";
        int256 notional = int256(1_000e6);

        vm.prank(user, user);
        (uint256 plinthId, uint256 venueId) =
            router.open_position_via_adapter(AAVE_VENUE_ID, INSTRUMENT, notional, empty, empty, empty);

        uint256 cofferUsdcAfterOpen = usdc.balanceOf(address(coffer));

        vm.expectEmit(true, true, true, true, address(router));
        emit PositionClosedViaRouter(user, AAVE_VENUE_ID, plinthId, venueId, int256(0));

        vm.prank(user, user);
        int256 pnl = router.close_position_via_adapter(AAVE_VENUE_ID, plinthId, venueId, empty);

        // 1:1 testnet pool → zero realized PnL on close.
        assertEq(pnl, int256(0), "MockAavePool round-trips 1:1, pnl == 0");
        // Principal flushed out of the pool and back to Coffer (JJJ-9 pattern).
        assertEq(pool.supplied(address(usdc), address(aave)), 0, "supplied must zero out on close");
        assertEq(
            usdc.balanceOf(address(coffer)),
            cofferUsdcAfterOpen + 1_000e6,
            "withdrawn principal must return to Coffer, not the Router or adapter"
        );
        // Position cleared on the adapter.
        IPorticoAdapter.PositionView memory v = aave.get_position(venueId);
        assertEq(v.owner, address(0), "venue position must be deleted on close");
    }

    // ── Router dispatches to the v1.1 entry point (version probe) ───────────

    function test_router_dispatchesV11_notV10_forAaveAdapter() public {
        // The Aave adapter's v1.0 open_position reverts V10NotSupported. If the
        // Router mis-dispatched to v1.0 the open would revert. A successful open
        // therefore proves the _isAdapterV11 version() probe routed to v1.1.
        bytes memory empty = hex"";
        vm.prank(user, user);
        (, uint256 venueId) =
            router.open_position_via_adapter(AAVE_VENUE_ID, INSTRUMENT, int256(500e6), empty, empty, empty);
        assertEq(venueId, 1, "v1.1 dispatch succeeded");

        // Direct v1.0 call always reverts, pins that the adapter has no live
        // v1.0 path the Router could fall back to.
        vm.prank(address(coffer));
        vm.expectRevert(AaveHorizonAdapterV11.V10NotSupported.selector);
        aave.open_position(INSTRUMENT, int256(500e6), abi.encodePacked(user));
    }

    // ── Auth: only the authorized Router (or Coffer) can drive the adapter ──

    function test_aave_open_v11_rejectsUnauthorizedDirectCaller() public {
        vm.prank(hostile);
        vm.expectRevert(AaveHorizonAdapterV11.Unauthorized.selector);
        aave.open_position_v11(user, INSTRUMENT, int256(1_000e6), hex"");
    }

    function test_aave_setAuthorizedCaller_onlyTimelock() public {
        vm.prank(hostile);
        vm.expectRevert(AaveHorizonAdapterV11.Unauthorized.selector);
        aave.setAuthorizedCaller(makeAddr("x"), true);

        // Praetor multisig cannot either, authorization is a parameter-class
        // change requiring the 48h timelock veto window.
        vm.prank(praetor);
        vm.expectRevert(AaveHorizonAdapterV11.Unauthorized.selector);
        aave.setAuthorizedCaller(makeAddr("x"), true);
    }

    // ── Unsupported instrument is rejected at the adapter ───────────────────

    function test_aave_open_rejectsUnsupportedInstrument() public {
        bytes memory empty = hex"";
        bytes32 unknown = keccak256("NOT-LISTED");
        vm.prank(user, user);
        vm.expectRevert(
            abi.encodeWithSelector(AaveHorizonAdapterV11.UnsupportedInstrument.selector, unknown)
        );
        router.open_position_via_adapter(AAVE_VENUE_ID, unknown, int256(1_000e6), empty, empty, empty);
    }

    // ── FIRE78-COF2 still holds for the Aave adapter ────────────────────────

    function test_open_via_router_aave_rejectsAdapterAlsoApprovedAsOrchestrator() public {
        // If the Aave adapter were ALSO on Coffer's approved-orchestrators list
        // (a misconfiguration), it could call adapter_pull directly, bypassing
        // Router-level limits. The Router must refuse to route.
        coffer.setApprovedAdapter(address(aave), true);
        bytes memory empty = hex"";
        vm.prank(user, user);
        vm.expectRevert(
            abi.encodeWithSelector(AtriumRouter.AdapterAlsoApprovedAsOrchestrator.selector, address(aave))
        );
        router.open_position_via_adapter(AAVE_VENUE_ID, INSTRUMENT, int256(1_000e6), empty, empty, empty);
    }

    // ── Margin-delta read path funds the Aave adapter exactly ──────────────
    //
    // Aave Horizon is a CASH-EQUIVALENT supply venue: there is no venue-side
    // leverage, so the margin Plinth approves equals the USDC the adapter
    // supplies (notional == collateral). This drives the Router's
    // required_after - required_before DELTA read (not the abs(notional)
    // fallback the happy-path test exercises) and proves the adapter is funded
    // with exactly what it supplies.
    //
    // NOTE (surfaced finding, not a fix): the Router pulls the margin DELTA to
    // the adapter, but every v1.1 adapter supplies abs(notional). For a
    // cash-equivalent venue these are equal (this test). For a LEVERAGED venue
    // (Hyperliquid/GMX), margin delta < abs(notional) and the adapter would be
    // under-funded by the leverage factor, that adapter-funding seam is a real
    // production-design question tracked separately, not papered over here.
    function test_open_via_router_aave_marginDeltaPathFundsAdapterExactly() public {
        bytes memory empty = hex"";
        int256 notional = int256(2_500e6);
        // Cash-equivalent: required margin == notional (1×, no leverage).
        plinth.setMarginIncreasePerOpen(2_500e6);

        vm.prank(user, user);
        router.open_position_via_adapter(AAVE_VENUE_ID, INSTRUMENT, notional, empty, empty, empty);

        // Pull came through the DELTA read (2_500e6 != 0 → not the fallback),
        // and the adapter supplied exactly that into the pool.
        assertEq(coffer.lastAdapterPullAmount(), 2_500e6, "pull == margin delta via the delta-read path");
        assertEq(pool.supplied(address(usdc), address(aave)), 2_500e6, "adapter supplied exactly the delta");
        (, uint256 requiredAfter,,) = plinth.getAccount(user);
        assertEq(requiredAfter, 2_500e6, "Plinth required-margin advanced (delta-read coupled)");
    }

    /// 032-SC11 (#430): a LEVERAGED open must not revert at pool.supply. Plinth
    /// approves only a fraction of notional as margin; pre-fix the adapter
    /// supplied abs(notional) while funded with only the margin delta, so
    /// pool.supply reverted (adapter under-funded) on every leveraged open.
    /// Now the adapter supplies exactly what the Router delivered.
    function test_open_via_router_aave_leveraged_suppliesFundedAmountNotNotional_032SC11() public {
        bytes memory empty = hex"";
        int256 notional = int256(1_000e6);
        // 20x leverage: 50 USDC margin delta for a 1,000 USDC notional.
        plinth.setMarginIncreasePerOpen(50e6);

        vm.prank(user, user);
        (uint256 plinthId, uint256 venueId) =
            router.open_position_via_adapter(AAVE_VENUE_ID, INSTRUMENT, notional, empty, empty, empty);

        // The open SUCCEEDS (pre-fix it reverted under-funded at pool.supply),
        // and the adapter supplied exactly the funded margin, not abs(notional).
        assertEq(coffer.lastAdapterPullAmount(), 50e6, "pull == margin delta");
        assertEq(pool.supplied(address(usdc), address(aave)), 50e6, "supply == funded margin, not abs(notional)");
        assertEq(usdc.balanceOf(address(aave)), 0, "adapter retains no USDC after supply");
        // The full notional is still recorded for Plinth's margin accounting.
        IPorticoAdapter.PositionView memory v = aave.get_position(venueId);
        assertEq(v.notional_signed, notional, "notional recorded for margin accounting");

        // Close withdraws exactly the supplied principal back to Coffer.
        uint256 cofferAfterOpen = usdc.balanceOf(address(coffer));
        vm.prank(user, user);
        router.close_position_via_adapter(AAVE_VENUE_ID, plinthId, venueId, empty);
        assertEq(usdc.balanceOf(address(coffer)), cofferAfterOpen + 50e6, "supplied principal returns to Coffer");
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Fakes, narrow Solidity stand-ins for the Stylus Plinth/Coffer/Registry the
// Router calls. The Aave adapter + pool + Router are REAL production code.
// Mirrors the convention in tests/foundry/AtriumRouter.t.sol.
// ──────────────────────────────────────────────────────────────────────────

contract FakePlinth {
    bool public openCalled;
    mapping(address => bool) internal pausedFlag;
    uint256 public nextPositionId;
    mapping(address => uint256) public requiredMarginByUser;
    uint256 public marginIncreasePerOpen;
    mapping(uint256 => address) public positionOwner;

    function setPaused(address u, bool v) external { pausedFlag[u] = v; }
    function setMarginIncreasePerOpen(uint256 v) external { marginIncreasePerOpen = v; }

    function _openFor(address owner)
        internal
        returns (uint256 id)
    {
        openCalled = true;
        nextPositionId++;
        id = nextPositionId;
        positionOwner[id] = owner;
        requiredMarginByUser[owner] += marginIncreasePerOpen;
    }

    function openPosition(uint8, bytes32, int256, bytes calldata, bytes calldata)
        external
        returns (uint256 id)
    {
        return _openFor(tx.origin);
    }

    function openPositionFor(address owner, uint8, bytes32, int256, bytes calldata, bytes calldata)
        external
        returns (uint256 id)
    {
        return _openFor(owner);
    }

    function closePosition(uint256) external pure returns (int256) { return int256(0); }

    function getPosition(uint256 position_id)
        external
        view
        returns (address owner, uint8 venue_id, bytes32 instrument_id, int256 notional, uint256 opened_at)
    {
        return (positionOwner[position_id], 0, bytes32(0), int256(0), 0);
    }

    function getAccount(address u) external view returns (uint256, uint256, uint256, bool) {
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

    constructor(address _usdc) { usdc = MockERC20(_usdc); }

    function setApprovedAdapter(address a, bool v) external { approvedAdapters[a] = v; }
    function creditShares(address u, uint256 amt) external { shares[u] += amt; }
    function isAdapterApproved(address a) external view returns (bool) { return approvedAdapters[a]; }

    function adapterPull(uint256 amount, address from_user, address to) external {
        require(approvedAdapters[msg.sender], "not approved adapter");
        require(shares[from_user] >= amount, "insufficient shares");
        shares[from_user] -= amount;
        require(usdc.transfer(to, amount), "usdc transfer failed");
        lastAdapterPullAmount = amount;
        lastAdapterPullTo = to;
        lastAdapterPullUser = from_user;
    }

    // 027-SC6: re-credit shares for collateral returned on close.
    function asset() external view returns (address) { return address(usdc); }
    function adapterReturn(uint256 amount, address to_user) external returns (uint256) {
        require(approvedAdapters[msg.sender], "not approved adapter");
        shares[to_user] += amount;
        return amount;
    }
}

contract FakeRegistry {
    mapping(uint8 => address) internal adapters;
    function setAdapter(uint8 venue_id, address adapter) external { adapters[venue_id] = adapter; }
    function getAdapter(uint8 venue_id) external view returns (address) { return adapters[venue_id]; }
    function isRegisteredAdapter(address) external pure returns (bool) { return true; }
}

/// Full ERC-20 with allowance-enforcing transferFrom. MockAavePool.supply does
/// transferFrom(adapter, pool, amount) after the adapter approves the pool, so
/// (unlike the trimmed MockERC20 in AtriumRouter.t.sol) this mock MUST enforce
/// allowance + balances faithfully, or the supply() leg would pass vacuously.
contract MockERC20 {
    string public name;
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, uint8 _decimals) { name = _name; decimals = _decimals; }

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

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

    function transferFrom(address from, address to, uint256 v) external returns (bool) {
        require(balanceOf[from] >= v, "balance");
        uint256 a = allowance[from][msg.sender];
        require(a >= v, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - v;
        balanceOf[from] -= v;
        balanceOf[to] += v;
        return true;
    }
}
