// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "../../../portico-registry/src/IPorticoAdapter.sol";
import {ReentrancyGuard} from "../../../portico-registry/src/ReentrancyGuard.sol";

/// Aave V3 Pool interface, the subset Atrium needs.
/// Full interface at resources/aave-v3-core/contracts/interfaces/IPool.sol
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

    function withdraw(address asset, uint256 amount, address to) external returns (uint256);

    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;

    function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf)
        external
        returns (uint256);

    function getReserveData(address asset) external view returns (
        uint256 configuration,
        uint128 liquidityIndex,
        uint128 currentLiquidityRate,
        uint128 variableBorrowIndex,
        uint128 currentVariableBorrowRate,
        uint128 currentStableBorrowRate,
        uint40 lastUpdateTimestamp,
        uint16 id,
        address aTokenAddress,
        address stableDebtTokenAddress,
        address variableDebtTokenAddress,
        address interestRateStrategyAddress,
        uint128 accruedToTreasury,
        uint128 unbacked,
        uint128 isolationModeTotalDebt
    );
}

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @title AaveHorizonAdapter
/// @notice Portico adapter for Aave V3 Horizon (RWA T-bill yield).
///
/// Aave Horizon is built on Aave V3 with the RWA permission set. Supply USDC,
/// receive aUSDC representing T-bill exposure. Adapter holds aUSDC on behalf
/// of users and reports position state via IPorticoAdapter.
contract AaveHorizonAdapter is IPorticoAdapter, ReentrancyGuard {
    IAavePool public immutable pool;
    address public immutable usdc;
    address public immutable atrium_coffer;
    address public immutable praetor_multisig;

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

    // Per-instrument risk params, set by Praetor
    mapping(bytes32 => uint16) public haircut_bps_;
    mapping(bytes32 => uint16) public initial_margin_bps_;
    mapping(bytes32 => uint16) public maintenance_margin_bps_;

    error Unauthorized();
    error UnsupportedInstrument(bytes32 instrument_id);
    error ZeroNotional();
    error VenueOffline();
    error PositionNotOwned();
    error BadVenuePayload();

    modifier onlyPraetor() {
        if (msg.sender != praetor_multisig) revert Unauthorized();
        _;
    }

    modifier onlyCoffer() {
        if (msg.sender != atrium_coffer) revert Unauthorized();
        _;
    }

    constructor(address _pool, address _usdc, address _coffer, address _praetor) {
        // Audit NNNN-1 fix (DDD-5 pattern, partial-coverage closer).
        require(_pool != address(0), "zero pool");
        require(_usdc != address(0), "zero usdc");
        require(_coffer != address(0), "zero coffer");
        require(_praetor != address(0), "zero praetor");
        pool = IAavePool(_pool);
        usdc = _usdc;
        atrium_coffer = _coffer;
        praetor_multisig = _praetor;
    }

    function name() external pure returns (string memory) {
        return "AaveHorizon";
    }

    function version() external pure returns (uint256 major, uint256 minor, uint256 patch) {
        return (1, 0, 0);
    }

    function isHybrid() external pure returns (bool) {
        return false;
    }

    function supportedInstruments() external view returns (bytes32[] memory) {
        return supported_instruments_;
    }

    function open_position(bytes32 instrument_id, int256 notional_signed, bytes calldata venue_payload)
        external
        onlyCoffer
        nonReentrant
        returns (uint256 venue_position_id)
    {
        if (!is_supported_instrument[instrument_id]) revert UnsupportedInstrument(instrument_id);
        if (notional_signed == 0) revert ZeroNotional();

        // Aave Horizon T-bill is supply-only (long = positive notional, short = negative is not supported here)
        uint256 amount = uint256(notional_signed > 0 ? notional_signed : -notional_signed);

        // Pull USDC from Coffer (Coffer already approved this adapter via adapter_pull)
        IERC20(usdc).approve(address(pool), amount);
        pool.supply(usdc, amount, address(this), 0);

        // Audit G-5 fix: originator parsed from venue_payload[0..20] rather
        // than tx.origin, which gives wrong data under ERC-4337 smart wallets
        // (tx.origin is the bundler) and under any router that holds user txs.
        // Coffer prepends the originator before forwarding venue_payload.
        if (venue_payload.length < 20) revert BadVenuePayload();
        address originator;
        assembly { originator := shr(96, calldataload(venue_payload.offset)) }

        venue_position_id = ++next_venue_position_id;
        positions[venue_position_id] = VenuePosition({
            owner: originator,
            instrument_id: instrument_id,
            notional_signed: notional_signed,
            entry_price_q64: 1 << 64, // T-bill prices in stables = ~1.0
            supplied_amount: amount,
            opened_at: block.timestamp
        });

        emit PositionOpened(venue_position_id, originator, instrument_id, notional_signed);
    }

    function close_position(uint256 venue_position_id, bytes calldata venue_payload)
        external
        onlyCoffer
        nonReentrant
        returns (int256 realized_pnl_signed)
    {
        VenuePosition storage pos = positions[venue_position_id];
        if (pos.owner == address(0)) revert PositionNotOwned();

        // Audit JJJ-8 fix: pre-fix this passed `type(uint256).max` which per
        // Aave V3 IPool semantics withdraws the ENTIRE aToken balance of the
        // adapter, across all open positions. One close drained every other
        // user's principal and reported it as the closer's profit. Note: v1.0
        // is also revert-gated by V10NotSupported in the v1.1 contract (the
        // only deploy target), so this v1.0 fix is defense-in-depth in case
        // an older codepath ever reactivates.
        uint256 withdrawn = pool.withdraw(usdc, pos.supplied_amount, atrium_coffer);
        realized_pnl_signed = int256(withdrawn) - int256(pos.supplied_amount);

        emit PositionClosed(venue_position_id, realized_pnl_signed);
        delete positions[venue_position_id];
        venue_payload;
    }

    function modify_position(uint256 venue_position_id, int256 notional_delta_signed, bytes calldata venue_payload)
        external
        onlyCoffer
        returns (int256 realized_pnl_signed)
    {
        // v1: not implemented, close + reopen for modifications
        venue_position_id;
        notional_delta_signed;
        venue_payload;
        revert("modify not supported in v1");
    }

    function get_position(uint256 venue_position_id) external view returns (PositionView memory) {
        VenuePosition storage pos = positions[venue_position_id];
        return PositionView({
            owner: pos.owner,
            instrument_id: pos.instrument_id,
            notional_signed: pos.notional_signed,
            entry_price_q64: pos.entry_price_q64,
            current_price_q64: 1 << 64, // T-bill held to maturity ~ 1.0
            unrealized_pnl_signed: 0, // Realized only at close in Aave Horizon
            last_update_timestamp: pos.opened_at
        });
    }

    function get_venue_health() external view returns (VenueHealth memory) {
        // Aave V3 health: read reserve data; if liquidity index is non-zero, operational
        (, uint128 liquidity_index, , , , , , , , , , , , , ) = pool.getReserveData(usdc);
        bool operational = liquidity_index > 0;
        return VenueHealth({
            is_operational: operational,
            last_heartbeat_block: uint64(block.number),
            quoted_spread_bps: 0, // T-bills don't have a spread
            status_message: operational ? "ok" : "reserve_unavailable"
        });
    }

    function get_haircut_bps(bytes32 instrument_id) external view returns (uint16) {
        return haircut_bps_[instrument_id];
    }

    function get_initial_margin_bps(bytes32 instrument_id) external view returns (uint16) {
        return initial_margin_bps_[instrument_id];
    }

    function get_maintenance_margin_bps(bytes32 instrument_id) external view returns (uint16) {
        return maintenance_margin_bps_[instrument_id];
    }

    function attest_off_chain_state(bytes calldata signed_attestation) external returns (bool) {
        // Not hybrid, always returns false to signal "no off-chain attestation needed"
        signed_attestation;
        return false;
    }

    // -------------------------------------------------------------------
    // Praetor admin
    // -------------------------------------------------------------------

    function addInstrument(
        bytes32 instrument_id,
        uint16 _haircut_bps,
        uint16 _initial_margin_bps,
        uint16 _maintenance_margin_bps
    ) external onlyPraetor {
        if (!is_supported_instrument[instrument_id]) {
            supported_instruments_.push(instrument_id);
            is_supported_instrument[instrument_id] = true;
        }
        haircut_bps_[instrument_id] = _haircut_bps;
        initial_margin_bps_[instrument_id] = _initial_margin_bps;
        maintenance_margin_bps_[instrument_id] = _maintenance_margin_bps;
    }
}
