// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "../../../portico-registry/src/IPorticoAdapter.sol";
import {ReentrancyGuard} from "../../../portico-registry/src/ReentrancyGuard.sol";

/// Morpho Blue — partial interface used by Atrium adapter. Full at
/// resources/morpho-blue/src/Morpho.sol.
/// Morpho Blue keys lending markets by `MarketParams` (collateral + loan
/// token + LLTV + oracle + IRM). Atrium pre-registers approved markets and
/// keys by Morpho's market id (keccak256 of the params struct).
interface IMorpho {
    struct MarketParams {
        address loanToken;
        address collateralToken;
        address oracle;
        address irm;
        uint256 lltv;
    }
    function supplyCollateral(MarketParams memory marketParams, uint256 assets, address onBehalf, bytes calldata data) external;
    function borrow(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256);
    function repay(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, bytes calldata data) external returns (uint256, uint256);
    function withdrawCollateral(MarketParams memory marketParams, uint256 assets, address onBehalf, address receiver) external;
    function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral);
}

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title MorphoBlueAdapter
/// @notice Portico adapter for Morpho Blue isolated lending markets.
///
///         **Status:** Phase-2 conditional per PRD §17 / TDD §13 — Month-9 ship
///         contingent on the Stylus Sprint grant landing by Month 7. This scaffold
///         freezes the contract shape; the real implementation maps the
///         IPorticoAdapter `open_position(notional_signed > 0)` semantics to
///         "deposit collateral + borrow loanToken" and `notional_signed < 0` to
///         "repay + withdraw collateral".
///
///         The signed convention:
///         - `notional_signed > 0` → leverage long: borrow loanToken against deposited USDC.
///         - `notional_signed < 0` → unwind: repay and withdraw collateral.
///         - `entry_price_q64` is the Morpho oracle price snapshot at open.
///
///         Audit-pattern coverage mirrored from GmxV2Adapter:
///         - DDD-5 / NNNN-1 constructor zero-checks
///         - F-32 / EEEEE-1 timelock-gated addInstrument
///         - F-11 nonReentrant via inheritance
///         - EEEE-1 / Fire 75 onlyAuthorizedCaller (Coffer + Router)
///         - G-5 originator from venue_payload[0..20]
contract MorphoBlueAdapter is IPorticoAdapter, ReentrancyGuard {
    IMorpho public immutable morpho;
    address public immutable atrium_coffer;
    address public immutable praetor_multisig;
    address public immutable praetor_timelock;

    struct VenuePosition {
        address owner;
        bytes32 instrument_id;
        int256 notional_signed;
        bytes32 morpho_market_id;
        uint256 collateral_supplied;
        uint256 borrowed_assets;
        uint256 entry_price_q64;
        uint256 opened_at;
    }
    mapping(uint256 => VenuePosition) public positions;
    uint256 public next_venue_position_id;

    bytes32[] public supported_instruments_;
    mapping(bytes32 => bool) public is_supported_instrument;
    mapping(bytes32 => IMorpho.MarketParams) public instrument_to_market_params;
    mapping(bytes32 => bytes32) public instrument_to_morpho_market_id;
    mapping(bytes32 => uint16) public haircut_bps_;
    mapping(bytes32 => uint16) public initial_margin_bps_;
    mapping(bytes32 => uint16) public maintenance_margin_bps_;

    mapping(address => bool) public is_authorized_caller;
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event InstrumentAdded(bytes32 indexed instrument_id, bytes32 morpho_market_id, uint16 haircut_bps, uint16 initial_margin_bps, uint16 maintenance_margin_bps);

    error Unauthorized();
    error UnsupportedInstrument(bytes32);
    error PositionNotFound();
    error BadVenuePayload();

    modifier onlyAuthorizedCaller() {
        if (msg.sender != atrium_coffer && !is_authorized_caller[msg.sender]) revert Unauthorized();
        _;
    }
    modifier onlyPraetor() { if (msg.sender != praetor_multisig) revert Unauthorized(); _; }
    modifier onlyTimelock() { if (msg.sender != praetor_timelock) revert Unauthorized(); _; }

    constructor(
        address _morpho,
        address _coffer,
        address _praetor,
        address _praetor_timelock
    ) {
        require(_morpho != address(0), "zero morpho");
        require(_coffer != address(0), "zero coffer");
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        morpho = IMorpho(_morpho);
        atrium_coffer = _coffer;
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
    }

    function name() external pure returns (string memory) { return "MorphoBlue"; }
    function version() external pure returns (uint256, uint256, uint256) { return (1, 0, 0); }
    function isHybrid() external pure returns (bool) { return false; }
    function supportedInstruments() external view returns (bytes32[] memory) { return supported_instruments_; }

    function setAuthorizedCaller(address caller, bool authorized) external onlyPraetor {
        is_authorized_caller[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function addInstrument(
        bytes32 instrument_id,
        IMorpho.MarketParams calldata market_params,
        uint16 _haircut_bps,
        uint16 _initial_margin_bps,
        uint16 _maintenance_margin_bps
    ) external onlyTimelock {
        if (!is_supported_instrument[instrument_id]) {
            supported_instruments_.push(instrument_id);
            is_supported_instrument[instrument_id] = true;
        }
        instrument_to_market_params[instrument_id] = market_params;
        // Morpho's market id is keccak256(abi.encode(MarketParams)).
        bytes32 market_id = keccak256(abi.encode(market_params));
        instrument_to_morpho_market_id[instrument_id] = market_id;
        haircut_bps_[instrument_id] = _haircut_bps;
        initial_margin_bps_[instrument_id] = _initial_margin_bps;
        maintenance_margin_bps_[instrument_id] = _maintenance_margin_bps;
        emit InstrumentAdded(instrument_id, market_id, _haircut_bps, _initial_margin_bps, _maintenance_margin_bps);
    }

    function open_position(bytes32 instrument_id, int256 notional_signed, bytes calldata venue_payload)
        external onlyAuthorizedCaller nonReentrant returns (uint256 venue_position_id)
    {
        if (!is_supported_instrument[instrument_id]) revert UnsupportedInstrument(instrument_id);
        if (venue_payload.length < 20) revert BadVenuePayload();
        address originator;
        assembly { originator := shr(96, calldataload(venue_payload.offset)) }

        IMorpho.MarketParams memory mp = instrument_to_market_params[instrument_id];
        uint256 amount = uint256(notional_signed > 0 ? notional_signed : -notional_signed);

        // Scaffold: real impl will compute collateral_supplied vs borrowed split
        // from LLTV + initial_margin_bps + the Morpho oracle price snapshot.
        // For now record intent.
        IERC20(mp.collateralToken).approve(address(morpho), amount);

        venue_position_id = ++next_venue_position_id;
        positions[venue_position_id] = VenuePosition({
            owner: originator,
            instrument_id: instrument_id,
            notional_signed: notional_signed,
            morpho_market_id: instrument_to_morpho_market_id[instrument_id],
            collateral_supplied: 0,
            borrowed_assets: 0,
            entry_price_q64: 0,
            opened_at: block.timestamp
        });
        emit PositionOpened(venue_position_id, originator, instrument_id, notional_signed);
    }

    function close_position(uint256 venue_position_id, bytes calldata)
        external onlyAuthorizedCaller nonReentrant returns (int256 realized_pnl_signed)
    {
        VenuePosition storage pos = positions[venue_position_id];
        if (pos.owner == address(0)) revert PositionNotFound();
        // Scaffold: real impl will repay borrowed_assets and withdraw collateral,
        // pnl = (current_collateral_value - entry_collateral_value) - interest_accrued.
        realized_pnl_signed = 0;
        emit PositionClosed(venue_position_id, realized_pnl_signed);
        delete positions[venue_position_id];
    }

    function modify_position(uint256, int256, bytes calldata) external pure returns (int256) {
        revert("v1");
    }

    function get_position(uint256 venue_position_id) external view returns (PositionView memory) {
        VenuePosition storage pos = positions[venue_position_id];
        return PositionView({
            owner: pos.owner,
            instrument_id: pos.instrument_id,
            notional_signed: pos.notional_signed,
            entry_price_q64: pos.entry_price_q64,
            current_price_q64: pos.entry_price_q64,
            unrealized_pnl_signed: 0,
            last_update_timestamp: pos.opened_at
        });
    }

    function get_venue_health() external pure returns (VenueHealth memory) {
        return VenueHealth({ is_operational: false, last_heartbeat_block: 0, quoted_spread_bps: 0, status_message: "phase-2-scaffold" });
    }

    function get_haircut_bps(bytes32 i) external view returns (uint16) { return haircut_bps_[i]; }
    function get_initial_margin_bps(bytes32 i) external view returns (uint16) { return initial_margin_bps_[i]; }
    function get_maintenance_margin_bps(bytes32 i) external view returns (uint16) { return maintenance_margin_bps_[i]; }
    function attest_off_chain_state(bytes calldata) external pure returns (bool) { return false; }
}
