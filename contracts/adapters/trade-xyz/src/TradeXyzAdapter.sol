// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "../../../portico-registry/src/IPorticoAdapter.sol";
import {ReentrancyGuard} from "../../../portico-registry/src/ReentrancyGuard.sol";

interface ITradeXyzClearinghouse {
    function depositCollateral(address user, uint256 amount) external;
    function withdrawCollateral(address user, uint256 amount) external returns (uint256);
    function openPosition(address user, bytes32 instrument_id, int256 notional_signed)
        external
        returns (uint256 venue_position_id, uint256 entry_price_q64);
    function closePosition(address user, uint256 venue_position_id)
        external
        returns (int256 realized_pnl);
    function getPosition(uint256 venue_position_id)
        external
        view
        returns (address owner, bytes32 instrument_id, int256 notional, uint256 entry_price_q64, uint256 current_price_q64);
    function isOperational() external view returns (bool);
    function quotedSpreadBps(bytes32 instrument_id) external view returns (uint16);
}

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title TradeXyzAdapter
/// @notice Portico adapter for trade.xyz. trade.xyz is a Hyperliquid HIP-3
///         tokenized-equity issuer with ~90% of HIP-3 OI per public data.
///         This adapter mirrors the Aave-style on-chain deposit pattern.
contract TradeXyzAdapter is IPorticoAdapter, ReentrancyGuard {
    ITradeXyzClearinghouse public immutable clearinghouse;
    address public immutable usdc;
    address public immutable atrium_coffer;
    address public immutable praetor_multisig;
    // Audit EEEEE-1 fix (F-32 completeness): addInstrument is a parameter
    // change that must pass through the 48h timelock veto window.
    address public immutable praetor_timelock;

    bytes32[] public supported_instruments_;
    mapping(bytes32 => bool) public is_supported_instrument;
    mapping(bytes32 => uint16) public haircut_bps_;
    mapping(bytes32 => uint16) public initial_margin_bps_;
    mapping(bytes32 => uint16) public maintenance_margin_bps_;

    struct VenuePosition {
        address owner;
        bytes32 instrument_id;
        int256 notional_signed;
        uint256 entry_price_q64;
        uint256 opened_at;
    }
    mapping(uint256 => VenuePosition) public positions;

    error Unauthorized();
    error UnsupportedInstrument(bytes32);
    error PositionNotFound();
    error VenueOffline();
    error BadVenuePayload();
    error WithdrawShortfall(uint256 expected, uint256 actual);
    error UsdcTransferFailed(address to, uint256 amount);

    // Audit EEEE-1 fix (`human_left.md` #31): orchestrator-list pattern.
    mapping(address => bool) public is_authorized_caller;
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    modifier onlyAuthorizedCaller() {
        if (msg.sender != atrium_coffer && !is_authorized_caller[msg.sender]) revert Unauthorized();
        _;
    }
    modifier onlyCoffer() { if (msg.sender != atrium_coffer) revert Unauthorized(); _; }
    modifier onlyPraetor() { if (msg.sender != praetor_multisig) revert Unauthorized(); _; }
    modifier onlyTimelock() { if (msg.sender != praetor_timelock) revert Unauthorized(); _; }

    function setAuthorizedCaller(address caller, bool authorized) external onlyPraetor {
        is_authorized_caller[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    event InstrumentAdded(
        bytes32 indexed instrument_id,
        uint16 haircut_bps,
        uint16 initial_margin_bps,
        uint16 maintenance_margin_bps
    );

    constructor(address _clearinghouse, address _usdc, address _coffer, address _praetor, address _praetor_timelock) {
        // Audit NNNN-1 fix (DDD-5 pattern, partial-coverage closer): zero on
        // any of these bricks the adapter. Zero coffer → onlyCoffer modifier
        // becomes dead → no one can call open_position. Zero praetor → admin
        // setters bricked. Zero usdc → token reads/writes fail. Zero
        // clearinghouse → all venue calls revert. Deploy-typo footgun.
        require(_clearinghouse != address(0), "zero clearinghouse");
        require(_usdc != address(0), "zero usdc");
        require(_coffer != address(0), "zero coffer");
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        clearinghouse = ITradeXyzClearinghouse(_clearinghouse);
        usdc = _usdc;
        atrium_coffer = _coffer;
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
    }

    function name() external pure returns (string memory) { return "TradeXyz"; }
    function version() external pure returns (uint256, uint256, uint256) { return (1, 0, 0); }
    function isHybrid() external pure returns (bool) { return false; }
    function supportedInstruments() external view returns (bytes32[] memory) { return supported_instruments_; }

    function open_position(bytes32 instrument_id, int256 notional_signed, bytes calldata venue_payload)
        external onlyAuthorizedCaller nonReentrant returns (uint256 venue_position_id)
    {
        if (!is_supported_instrument[instrument_id]) revert UnsupportedInstrument(instrument_id);
        if (!clearinghouse.isOperational()) revert VenueOffline();

        // Audit G-5 fix: originator from venue_payload[0..20], not tx.origin.
        if (venue_payload.length < 20) revert BadVenuePayload();
        address originator;
        assembly { originator := shr(96, calldataload(venue_payload.offset)) }

        uint256 amount = uint256(notional_signed > 0 ? notional_signed : -notional_signed);
        IERC20(usdc).approve(address(clearinghouse), amount);
        clearinghouse.depositCollateral(originator, amount);
        uint256 entry_price_q64;
        (venue_position_id, entry_price_q64) = clearinghouse.openPosition(originator, instrument_id, notional_signed);

        positions[venue_position_id] = VenuePosition({
            owner: originator,
            instrument_id: instrument_id,
            notional_signed: notional_signed,
            entry_price_q64: entry_price_q64,
            opened_at: block.timestamp
        });
        emit PositionOpened(venue_position_id, originator, instrument_id, notional_signed);
    }

    function close_position(uint256 venue_position_id, bytes calldata) external onlyAuthorizedCaller nonReentrant returns (int256 pnl) {
        VenuePosition storage pos = positions[venue_position_id];
        if (pos.owner == address(0)) revert PositionNotFound();
        pnl = clearinghouse.closePosition(pos.owner, venue_position_id);
        // Audit JJJ-12 fix: pre-fix withdrew exactly `abs(notional)` and
        // discarded pnl. If pnl > 0 the user's profit stayed stranded in the
        // clearinghouse forever; if pnl < 0 the withdraw asked for more than
        // the clearinghouse held  revert  position state half-closed
        // (closePosition ran but no settlement). Withdraw (supplied + pnl),
        // clamped at 0 if user lost more than their stake.
        uint256 supplied = uint256(pos.notional_signed > 0 ? pos.notional_signed : -pos.notional_signed);
        int256 settle_signed = int256(supplied) + pnl;
        uint256 to_withdraw = settle_signed > 0 ? uint256(settle_signed) : 0;
        if (to_withdraw > 0) {
            // Phase theta.1 fix: pre-fix the return value of withdrawCollateral
            // was discarded (audit Round 1). Capture it; if the clearinghouse
            // returns less than requested (partial settlement, e.g. insurance-
            // pool shortfall), revert loudly with the gap so Coffer accounting
            // does not silently disagree with on-chain reality. msg.sender
            // (this adapter) receives the USDC; forward to atrium_coffer so
            // share accounting can resolve. Previously the recipient was
            // pos.owner directly, which bypassed Coffer's share ledger.
            uint256 actual = clearinghouse.withdrawCollateral(pos.owner, to_withdraw);
            if (actual < to_withdraw) revert WithdrawShortfall(to_withdraw, actual);
            if (actual > 0) {
                bool ok = IERC20(usdc).transfer(atrium_coffer, actual);
                if (!ok) revert UsdcTransferFailed(atrium_coffer, actual);
            }
        }
        emit PositionClosed(venue_position_id, pnl);
        delete positions[venue_position_id];
    }

    function modify_position(uint256, int256, bytes calldata) external pure returns (int256) { revert("v1"); }

    function get_position(uint256 venue_position_id) external view returns (PositionView memory) {
        VenuePosition storage pos = positions[venue_position_id];
        (, , , , uint256 current_price_q64) = clearinghouse.getPosition(venue_position_id);
        return PositionView({
            owner: pos.owner,
            instrument_id: pos.instrument_id,
            notional_signed: pos.notional_signed,
            entry_price_q64: pos.entry_price_q64,
            current_price_q64: current_price_q64,
            unrealized_pnl_signed: 0, // realized at close; live PnL via Plinth recompute
            last_update_timestamp: pos.opened_at
        });
    }

    function get_venue_health() external view returns (VenueHealth memory) {
        bool ok = clearinghouse.isOperational();
        return VenueHealth({
            is_operational: ok,
            last_heartbeat_block: uint64(block.number),
            quoted_spread_bps: ok ? 5 : 0,
            status_message: ok ? "ok" : "offline"
        });
    }

    function get_haircut_bps(bytes32 i) external view returns (uint16) { return haircut_bps_[i]; }
    function get_initial_margin_bps(bytes32 i) external view returns (uint16) { return initial_margin_bps_[i]; }
    function get_maintenance_margin_bps(bytes32 i) external view returns (uint16) { return maintenance_margin_bps_[i]; }
    function attest_off_chain_state(bytes calldata) external pure returns (bool) { return false; }

    function addInstrument(
        bytes32 instrument_id,
        uint16 _haircut_bps,
        uint16 _initial_margin_bps,
        uint16 _maintenance_margin_bps
    ) external onlyTimelock {
        if (!is_supported_instrument[instrument_id]) {
            supported_instruments_.push(instrument_id);
            is_supported_instrument[instrument_id] = true;
        }
        haircut_bps_[instrument_id] = _haircut_bps;
        initial_margin_bps_[instrument_id] = _initial_margin_bps;
        maintenance_margin_bps_[instrument_id] = _maintenance_margin_bps;
        emit InstrumentAdded(instrument_id, _haircut_bps, _initial_margin_bps, _maintenance_margin_bps);
    }
}
