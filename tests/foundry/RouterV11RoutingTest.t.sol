// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {AtriumRouter} from "../../contracts/atrium-router/src/AtriumRouter.sol";

/// @title AtriumRouter, v1.0 vs v1.1 adapter ABI auto-detection
/// @notice Phase theta.1 fix verification. Pre-fix the Router unconditionally
///         called the IPorticoAdapter (v1.0) selectors. AaveHorizonAdapterV11,
///         the only v1.1-only adapter deployed today, refused the v1.0
///         selectors with `V10NotSupported` and was therefore unreachable
///         through the Router.
///
///         The Router now probes `version()` and dispatches to the v1.1
///         entry when `major == 1 && minor >= 1`. A low-level staticcall is
///         used rather than blind try/catch so legitimate downstream reverts
///         (no-margin, paused, etc.) propagate untouched.
///
///         This suite covers three branches:
///           1. v1.1 adapter → Router calls open_position_v11 + close_position_v11
///           2. v1.0 adapter → Router calls open_position + close_position
///           3. Adapter missing version()  Router reverts AdapterMissingVersion
contract RouterV11RoutingTest is Test {
    AtriumRouter internal router;
    FakePlinth internal plinth;
    FakeCoffer internal coffer;
    FakeRegistry internal registry;
    MockERC20 internal usdc;
    FakeAdapterV11 internal v11;
    FakeAdapterV10 internal v10;

    address internal user;
    address internal praetor;
    address internal timelock;

    uint8 internal constant V11_VENUE = 1;
    uint8 internal constant V10_VENUE = 2;
    uint8 internal constant NO_VERSION_VENUE = 3;
    bytes32 internal constant INSTRUMENT = keccak256("V11-PROBE");

    function setUp() public {
        user = makeAddr("user");
        praetor = makeAddr("praetor");
        timelock = makeAddr("timelock");

        usdc = new MockERC20("USDC", 6);
        plinth = new FakePlinth();
        coffer = new FakeCoffer(address(usdc));
        registry = new FakeRegistry();

        v11 = new FakeAdapterV11();
        v10 = new FakeAdapterV10();

        router = new AtriumRouter(address(plinth), address(coffer), address(registry), praetor, timelock);

        coffer.setApprovedAdapter(address(router), true);
        registry.setAdapter(V11_VENUE, address(v11));
        registry.setAdapter(V10_VENUE, address(v10));

        // Pre-fund: user has shares; coffer has USDC to forward.
        coffer.creditShares(user, 10_000_000e6);
        usdc.mint(address(coffer), 10_000_000e6);
    }

    // ── Branch 1: v1.1 adapter dispatches to v1.1 entry ──────────────

    function test_open_routesV11_whenAdapterIsV11() public {
        vm.prank(user, user);
        (, uint256 venueId) = router.open_position_via_adapter(
            V11_VENUE, INSTRUMENT, int256(1_000e6), hex"", hex"", hex"deadbeef"
        );

        assertEq(venueId, 1, "v11 adapter must return position id");
        assertEq(v11.lastV11Originator(), user, "originator delivered via explicit param");
        assertEq(v11.lastV11Notional(), int256(1_000e6));
        assertEq(v11.v10OpenCallCount(), 0, "v1.0 selector must NOT be called");
        assertEq(v11.v11OpenCallCount(), 1);
    }

    function test_close_routesV11_whenAdapterIsV11() public {
        // (sender, tx.origin) so FakePlinth records `user` as the owner -
        // matches AtriumRouter.t.sol FIRE76-1 pattern. Without the second
        // arg tx.origin is the test contract, and the Router's ownership
        // check at close_position_via_adapter would revert NotPositionOwner.
        vm.prank(user, user);
        (uint256 plinthId, uint256 venueId) = router.open_position_via_adapter(
            V11_VENUE, INSTRUMENT, int256(1_000e6), hex"", hex"", hex""
        );

        vm.prank(user, user);
        router.close_position_via_adapter(V11_VENUE, plinthId, venueId, hex"cafe");

        assertEq(v11.v11CloseCallCount(), 1, "close must take v1.1 path");
        assertEq(v11.v10CloseCallCount(), 0, "v1.0 close MUST NOT be called");
        assertEq(v11.lastV11CloseOriginator(), user);
    }

    // ── Branch 2: v1.0 adapter dispatches to v1.0 entry ──────────────

    function test_open_routesV10_whenAdapterIsV10() public {
        vm.prank(user, user);
        (, uint256 venueId) = router.open_position_via_adapter(
            V10_VENUE, INSTRUMENT, int256(1_000e6), hex"", hex"", hex""
        );

        assertEq(venueId, 1);
        assertEq(v10.openCallCount(), 1);
        // v1.0 packs the originator into the first 20 bytes of payload.
        assertEq(v10.lastOriginatorFromPayload(), user, "v1.0 payload prefix must encode user");
    }

    // ── Branch 3: adapter missing version() → loud revert ────────────

    function test_open_revertsWhenAdapterMissingVersion() public {
        address misshapen = address(new NoVersionAdapter());
        registry.setAdapter(NO_VERSION_VENUE, misshapen);

        vm.prank(user, user);
        vm.expectRevert(
            abi.encodeWithSelector(AtriumRouter.AdapterMissingVersion.selector, misshapen)
        );
        router.open_position_via_adapter(
            NO_VERSION_VENUE, INSTRUMENT, int256(1_000e6), hex"", hex"", hex""
        );
    }
}

// ── v1.1 fake adapter ────────────────────────────────────────────────────

contract FakeAdapterV11 {
    uint256 public v11OpenCallCount;
    uint256 public v10OpenCallCount;
    uint256 public v11CloseCallCount;
    uint256 public v10CloseCallCount;
    address public lastV11Originator;
    address public lastV11CloseOriginator;
    int256 public lastV11Notional;
    uint256 internal nextId;

    error V10NotSupported();

    function version() external pure returns (uint256, uint256, uint256) {
        return (1, 1, 0);
    }

    // v1.0 entries: MUST refuse so the fake mirrors AaveHorizonAdapterV11.
    function open_position(bytes32, int256, bytes calldata) external returns (uint256) {
        v10OpenCallCount++;
        revert V10NotSupported();
    }

    function close_position(uint256, bytes calldata) external returns (int256) {
        v10CloseCallCount++;
        revert V10NotSupported();
    }

    // v1.1 entries: explicit `originator`.
    function open_position_v11(
        address originator,
        bytes32,
        int256 notional_signed,
        bytes calldata
    ) external returns (uint256 venue_position_id) {
        v11OpenCallCount++;
        lastV11Originator = originator;
        lastV11Notional = notional_signed;
        nextId++;
        return nextId;
    }

    function close_position_v11(
        address originator,
        uint256,
        bytes calldata
    ) external returns (int256) {
        v11CloseCallCount++;
        lastV11CloseOriginator = originator;
        return int256(0);
    }
}

// ── v1.0 fake adapter ────────────────────────────────────────────────────

contract FakeAdapterV10 {
    uint256 public openCallCount;
    address public lastOriginatorFromPayload;
    uint256 internal nextId;

    function version() external pure returns (uint256, uint256, uint256) {
        return (1, 0, 0);
    }

    function open_position(bytes32, int256, bytes calldata payload) external returns (uint256) {
        openCallCount++;
        // v1.0 ABI per audit G-5: first 20 bytes of payload is the originator.
        require(payload.length >= 20, "v10 payload must carry originator");
        lastOriginatorFromPayload = address(bytes20(payload[0:20]));
        nextId++;
        return nextId;
    }

    function close_position(uint256, bytes calldata) external pure returns (int256) {
        return int256(0);
    }
}

// ── Adapter missing version(), for the AdapterMissingVersion branch ──

contract NoVersionAdapter {
    function open_position(bytes32, int256, bytes calldata) external pure returns (uint256) {
        return 1;
    }
}

// ── Fakes mirrored from AtriumRouter.t.sol ─────────────────────────────

contract FakePlinth {
    uint256 internal nextPositionId;
    mapping(uint256 => address) public positionOwner;

    function openPosition(uint8, bytes32, int256, bytes calldata, bytes calldata)
        external
        returns (uint256 id)
    {
        nextPositionId++;
        id = nextPositionId;
        positionOwner[id] = tx.origin;
    }

    function closePosition(uint256) external pure returns (int256) { return int256(0); }

    function getPosition(uint256 position_id)
        external
        view
        returns (address, uint8, bytes32, int256, uint256)
    {
        return (positionOwner[position_id], 0, bytes32(0), int256(0), 0);
    }

    function getAccount(address)
        external
        pure
        returns (uint256, uint256, uint256, bool)
    {
        return (10_000_000e6, 0, 0, false);
    }
}

contract FakeCoffer {
    address public usdc;
    mapping(address => bool) public approvedAdapters;
    mapping(address => uint256) public shares;

    constructor(address _usdc) { usdc = _usdc; }
    function setApprovedAdapter(address a, bool v) external { approvedAdapters[a] = v; }
    function creditShares(address u, uint256 amt) external { shares[u] += amt; }
    function isAdapterApproved(address a) external view returns (bool) { return approvedAdapters[a]; }

    function adapterPull(uint256 amount, address from_user, address to) external {
        require(approvedAdapters[msg.sender], "not approved adapter");
        require(shares[from_user] >= amount, "insufficient shares");
        shares[from_user] -= amount;
        MockERC20(usdc).transfer(to, amount);
    }

    // 027-SC6: re-credit shares for collateral returned on close.
    function asset() external view returns (address) { return usdc; }
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
}
