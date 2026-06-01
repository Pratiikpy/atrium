// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {TradeXyzAdapter} from "../../contracts/adapters/trade-xyz/src/TradeXyzAdapter.sol";

/// @title Adapter close_position → atrium_coffer transfer regression
/// @notice Phase theta.1 fix verification. Four adapters (GMX, Hyperliquid,
///         Polymarket, TradeXyz) silently stranded user collateral in the
///         adapter after close_position, the venue settled USDC back to
///         msg.sender (the adapter), but the adapter never forwarded it to
///         Coffer. Coffer's share accounting then disagreed with on-chain
///         reality and depositors who tried to redeem after a peer's close
///         would be told they had insufficient shares.
///
///         All four adapters now sweep the settled USDC to atrium_coffer on
///         close. This file pins the canonical TradeXyz path (return-value
///         capture + WithdrawShortfall + UsdcTransferFailed). Per-adapter
///         coverage for the other three lives in their existing test files;
///         this file is the cross-cutting regression that future audits
///         grep for.
contract AdapterCloseTransferTest is Test {
    TradeXyzAdapter internal adapter;
    MockClearinghouse internal clearinghouse;
    MockERC20 internal usdc;
    address internal coffer;
    address internal praetor;
    address internal timelock;
    address internal user;

    bytes32 internal constant AAPL_PERP = keccak256("AAPL-USD-PERP");

    function setUp() public {
        coffer = makeAddr("atrium-coffer");
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        user = makeAddr("user");

        usdc = new MockERC20("USDC", 6);
        clearinghouse = new MockClearinghouse();
        adapter = new TradeXyzAdapter(
            address(clearinghouse),
            address(usdc),
            coffer,
            praetor,
            timelock
        );

        // Pre-fund adapter and clearinghouse so deposit + withdraw both clear.
        usdc.mint(address(adapter), 10_000_000e6);
        usdc.mint(address(clearinghouse), 10_000_000e6);

        vm.prank(timelock);
        adapter.addInstrument(AAPL_PERP, 200, 1_000, 500);

        // Authorize caller used in the open path (defaults to onlyCoffer +
        // additional setAuthorizedCaller adds via Timelock).
        vm.prank(timelock);
        adapter.setAuthorizedCaller(address(this), true);
    }

    /// The load-bearing test. Pre-fix the adapter's close_position discarded
    /// the return value of withdrawCollateral and sent USDC to pos.owner
    /// (bypassing Coffer share accounting). Post-fix it captures the return
    /// value, reverts on shortfall, and routes the USDC to atrium_coffer.
    function test_close_sweepsUsdcToCoffer() public {
        bytes memory payload = abi.encodePacked(user);
        uint256 notional = 1_000e6;

        uint256 venueId = adapter.open_position(AAPL_PERP, int256(notional), payload);

        clearinghouse.setClosePnl(int256(0)); // break-even
        uint256 coffer_before = usdc.balanceOf(coffer);
        uint256 owner_before  = usdc.balanceOf(user);

        adapter.close_position(venueId, hex"");

        // settlement = supplied + pnl = 1_000e6
        uint256 expected = notional;
        assertEq(usdc.balanceOf(coffer) - coffer_before, expected, "USDC must land at atrium_coffer");
        assertEq(usdc.balanceOf(user) - owner_before, 0, "USDC MUST NOT land at pos.owner");
    }

    /// Profit case: close_position must forward (supplied + pnl) to coffer
    /// when the clearinghouse settles the position at a gain.
    function test_close_withPositivePnl_forwardsFullSettlement() public {
        bytes memory payload = abi.encodePacked(user);
        uint256 notional = 1_000e6;
        int256 pnl = int256(250e6);

        uint256 venueId = adapter.open_position(AAPL_PERP, int256(notional), payload);
        clearinghouse.setClosePnl(pnl);

        uint256 coffer_before = usdc.balanceOf(coffer);
        adapter.close_position(venueId, hex"");

        assertEq(usdc.balanceOf(coffer) - coffer_before, notional + uint256(pnl));
    }

    /// Shortfall guard: clearinghouse returns less than the adapter asked
    /// for (insurance-fund deficit, partial settlement). Pre-fix the adapter
    /// silently accepted the partial amount; post-fix it reverts loud so
    /// the calling Router tx unwinds cleanly.
    function test_close_revertsOnWithdrawShortfall() public {
        bytes memory payload = abi.encodePacked(user);
        uint256 notional = 1_000e6;

        uint256 venueId = adapter.open_position(AAPL_PERP, int256(notional), payload);

        // Configure the clearinghouse to return only 80% of the requested
        // withdrawCollateral amount. Production = insurance-fund deficit.
        clearinghouse.setShortfallBps(2_000);
        clearinghouse.setClosePnl(int256(0));

        vm.expectRevert(
            abi.encodeWithSelector(
                TradeXyzAdapter.WithdrawShortfall.selector,
                notional,        // expected
                notional * 80 / 100  // actual (80%)
            )
        );
        adapter.close_position(venueId, hex"");
    }

    /// Transfer-failure guard: if the USDC token's transfer() returns false
    /// (sanctions list, paused module, anything non-revert), revert with
    /// the audit-required typed error rather than letting the close commit
    /// against a no-op transfer.
    function test_close_revertsOnUsdcTransferFalse() public {
        bytes memory payload = abi.encodePacked(user);
        uint256 notional = 1_000e6;

        uint256 venueId = adapter.open_position(AAPL_PERP, int256(notional), payload);
        clearinghouse.setClosePnl(int256(0));
        // Fail every transfer to atrium_coffer; the upstream clearinghouse→
        // adapter transfer continues to succeed, isolating the regression.
        usdc.setFailTransferTo(coffer);

        vm.expectRevert(
            abi.encodeWithSelector(TradeXyzAdapter.UsdcTransferFailed.selector, coffer, notional)
        );
        adapter.close_position(venueId, hex"");
    }
}

// ── Test doubles ────────────────────────────────────────────────────────

contract MockClearinghouse {
    mapping(address => uint256) public depositOf;
    uint256 public nextPositionId;
    int256 internal _nextClosePnl;
    uint16 internal _shortfallBps;
    mapping(uint256 => bytes32) public posInstrument;
    mapping(uint256 => int256) public posNotional;

    function isOperational() external pure returns (bool) { return true; }
    function setClosePnl(int256 pnl) external { _nextClosePnl = pnl; }
    function setShortfallBps(uint16 bps) external { _shortfallBps = bps; }
    function quotedSpreadBps(bytes32) external pure returns (uint16) { return 5; }

    function depositCollateral(address u, uint256 amount) external {
        depositOf[u] += amount;
    }

    function withdrawCollateral(address u, uint256 amount) external returns (uint256 actual) {
        require(depositOf[u] >= amount, "balance");
        depositOf[u] -= amount;
        actual = _shortfallBps == 0 ? amount : amount * (10_000 - _shortfallBps) / 10_000;
        // Send the actual amount to msg.sender (the adapter).
        MockERC20(_usdcOf(msg.sender)).transfer(msg.sender, actual);
    }

    function openPosition(address, bytes32 instrument_id, int256 notional_signed)
        external
        returns (uint256 venuePositionId, uint256 entryPriceQ64)
    {
        venuePositionId = ++nextPositionId;
        entryPriceQ64 = 100 << 64;
        posInstrument[venuePositionId] = instrument_id;
        posNotional[venuePositionId] = notional_signed;
    }

    function closePosition(address u, uint256) external returns (int256 realized_pnl) {
        realized_pnl = _nextClosePnl;
        if (realized_pnl >= 0) {
            depositOf[u] += uint256(realized_pnl);
        } else {
            uint256 loss = uint256(-realized_pnl);
            depositOf[u] = depositOf[u] >= loss ? depositOf[u] - loss : 0;
        }
    }

    function getPosition(uint256 venuePositionId)
        external
        view
        returns (address, bytes32, int256, uint256, uint256)
    {
        return (address(0), posInstrument[venuePositionId], posNotional[venuePositionId], 0, 101 << 64);
    }

    /// Resolve the adapter's USDC pointer (the MockClearinghouse doesn't
    /// know it directly; the adapter holds the canonical USDC address).
    /// The test seeds both adapter + clearinghouse against the same token
    /// instance via setUp; this getter exists so the close-path settlement
    /// can pull from the clearinghouse-side reserve and ship to the adapter
    /// in a single call.
    function _usdcOf(address adapter) internal view returns (address) {
        return TradeXyzAdapter(adapter).usdc();
    }
}

contract MockERC20 {
    string public name;
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    /// Target-based failure: transfer() returns false only when the
    /// recipient matches `failTransferTo`. Avoids ambiguity where a
    /// single-shot flag is consumed by an upstream clearinghouse
    /// settlement and never reaches the adapter→coffer transfer.
    address internal failTransferTo;

    constructor(string memory _name, uint8 _decimals) { name = _name; decimals = _decimals; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function setFailTransferTo(address to) external { failTransferTo = to; }

    function approve(address sp, uint256 v) external returns (bool) {
        allowance[msg.sender][sp] = v;
        return true;
    }

    function transfer(address to, uint256 v) external returns (bool) {
        if (failTransferTo != address(0) && to == failTransferTo) {
            return false;
        }
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }

    function transferFrom(address from, address to, uint256 v) external returns (bool) {
        require(allowance[from][msg.sender] >= v, "allowance");
        require(balanceOf[from] >= v, "balance");
        allowance[from][msg.sender] -= v;
        balanceOf[from] -= v;
        balanceOf[to] += v;
        return true;
    }
}
