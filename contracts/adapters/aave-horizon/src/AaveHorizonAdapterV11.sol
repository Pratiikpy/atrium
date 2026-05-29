// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "../../../portico-registry/src/IPorticoAdapter.sol";
import {IPorticoAdapterV11} from "../../../portico-registry/src/IPorticoAdapterV11.sol";
import {ReentrancyGuard} from "../../../portico-registry/src/ReentrancyGuard.sol";

/// @title AaveHorizonAdapterV11
/// @notice Audit B-10 fix: extends AaveHorizonAdapter to use an explicit
///         `originator` parameter instead of `tx.origin`. v1.1 of the
///         IPorticoAdapter standard. Existing v1.0 functions remain for
///         backward compatibility while integrators migrate.
///
///         Coffer's adapter_pull-flow passes `from_user` directly to
///         open_position_v11; v1.0 open_position is deprecated.
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function getReserveData(address asset) external view returns (
        uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16,
        address, address, address, address, uint128, uint128, uint128
    );
}

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract AaveHorizonAdapterV11 is IPorticoAdapterV11, ReentrancyGuard {
    IAavePool public immutable pool;
    address public immutable usdc;
    address public immutable atrium_coffer;
    address public immutable praetor_multisig;
    address public immutable praetor_timelock;

    struct VenuePosition {
        address owner;
        bytes32 instrument_id;
        int256 notional_signed;
        uint256 entry_price_q64;
        uint256 supplied_amount;
        uint256 opened_at;
    }

    mapping(uint256 => VenuePosition) public positions;
    uint256 public next_venue_position_id;
    bytes32[] public supported_instruments_;
    mapping(bytes32 => bool) public is_supported_instrument;
    mapping(bytes32 => uint16) public haircut_bps_;
    mapping(bytes32 => uint16) public initial_margin_bps_;
    mapping(bytes32 => uint16) public maintenance_margin_bps_;

    error Unauthorized();
    error UnsupportedInstrument(bytes32);
    error ZeroNotional();
    error PositionNotOwned();
    error V10NotSupported();

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

    function setAuthorizedCaller(address caller, bool authorized) external onlyTimelock {
        is_authorized_caller[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function deauthorizeCaller(address caller) external onlyPraetor {
        is_authorized_caller[caller] = false;
        emit AuthorizedCallerUpdated(caller, false);
    }

    constructor(address _pool, address _usdc, address _coffer, address _praetor, address _timelock) {
        pool = IAavePool(_pool);
        usdc = _usdc;
        atrium_coffer = _coffer;
        praetor_multisig = _praetor;
        praetor_timelock = _timelock;
    }

    function name() external pure returns (string memory) { return "AaveHorizon"; }
    function version() external pure returns (uint256, uint256, uint256) { return (1, 1, 0); }
    function isHybrid() external pure returns (bool) { return false; }
    function supportedInstruments() external view returns (bytes32[] memory) { return supported_instruments_; }

    /// v1.0 legacy entry point — refuses with a clear error so callers
    /// must migrate to v1.1. Removes the `tx.origin` audit-B-10 vulnerability.
    function open_position(bytes32, int256, bytes calldata) external pure returns (uint256) {
        revert V10NotSupported();
    }
    function close_position(uint256, bytes calldata) external pure returns (int256) {
        revert V10NotSupported();
    }
    function modify_position(uint256, int256, bytes calldata) external pure returns (int256) {
        revert V10NotSupported();
    }

    /// v1.1 entry point — takes explicit `originator` from Coffer.
    function open_position_v11(
        address originator,
        bytes32 instrument_id,
        int256 notional_signed,
        bytes calldata venue_payload
    ) external onlyAuthorizedCaller nonReentrant returns (uint256 venue_position_id) {
        if (!is_supported_instrument[instrument_id]) revert UnsupportedInstrument(instrument_id);
        if (notional_signed == 0) revert ZeroNotional();

        uint256 amount = uint256(notional_signed > 0 ? notional_signed : -notional_signed);
        IERC20(usdc).approve(address(pool), amount);
        pool.supply(usdc, amount, address(this), 0);

        venue_position_id = ++next_venue_position_id;
        positions[venue_position_id] = VenuePosition({
            owner: originator,
            instrument_id: instrument_id,
            notional_signed: notional_signed,
            entry_price_q64: 1 << 64,
            supplied_amount: amount,
            opened_at: block.timestamp
        });
        emit PositionOpened(venue_position_id, originator, instrument_id, notional_signed);
        venue_payload;
    }

    error InsufficientAaveLiquidity();

    function close_position_v11(
        address originator,
        uint256 venue_position_id,
        bytes calldata venue_payload
    ) external onlyAuthorizedCaller nonReentrant returns (int256 realized_pnl_signed) {
        VenuePosition storage pos = positions[venue_position_id];
        if (pos.owner != originator) revert PositionNotOwned();
        // Audit JJJ-8 fix: pre-fix this passed `type(uint256).max` which per
        // Aave V3 IPool semantics withdraws the ENTIRE aToken balance of the
        // adapter — across all open positions. A close from one user drained
        // the principal of every other user supplied through this adapter,
        // and the realized_pnl calculation reported that delta as the closer's
        // profit. Cross-position fund-drain via Plinth margin accounting.
        //
        // Now: withdraw exactly the principal this position supplied. We lose
        // pro-rata interest accrual — that's a known testnet trade. The
        // proper fix (pro-rata aToken-balance share) needs aToken-interface
        // tracking + totalSupplied state and is deferred Year-2.
        uint256 withdrawn = pool.withdraw(usdc, pos.supplied_amount, atrium_coffer);
        if (withdrawn < pos.supplied_amount) revert InsufficientAaveLiquidity();
        realized_pnl_signed = int256(withdrawn) - int256(pos.supplied_amount);
        emit PositionClosed(venue_position_id, realized_pnl_signed);
        delete positions[venue_position_id];
        venue_payload;
    }

    function get_position(uint256 venue_position_id) external view returns (PositionView memory) {
        VenuePosition storage pos = positions[venue_position_id];
        return PositionView({
            owner: pos.owner,
            instrument_id: pos.instrument_id,
            notional_signed: pos.notional_signed,
            entry_price_q64: pos.entry_price_q64,
            current_price_q64: 1 << 64,
            unrealized_pnl_signed: 0,
            last_update_timestamp: pos.opened_at
        });
    }

    function get_venue_health() external view returns (VenueHealth memory) {
        (, uint128 liquidity_index, , , , , , , , , , , , , ) = pool.getReserveData(usdc);
        bool operational = liquidity_index > 0;
        return VenueHealth({
            is_operational: operational,
            last_heartbeat_block: uint64(block.number),
            quoted_spread_bps: 0,
            status_message: operational ? "ok" : "reserve_unavailable"
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
    }
}
