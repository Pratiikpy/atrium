// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "../../../portico-registry/src/IPorticoAdapter.sol";
import {ReentrancyGuard} from "../../../portico-registry/src/ReentrancyGuard.sol";

/// GMX V2 perpetual market — partial interface used by Atrium adapter.
/// Full at resources/gmx-synthetics/contracts/.
interface IGmxRouter {
    function createPosition(
        address market,
        address collateralToken,
        uint256 sizeUsd,
        uint256 collateralAmount,
        bool isLong
    ) external returns (bytes32 positionKey);

    function closePosition(bytes32 positionKey) external returns (int256 realizedPnlUsd);
}

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title GmxV2Adapter
/// @notice Portico adapter for GMX V2 perpetuals on Arbitrum Sepolia.
///
///         **Status:** Phase-2 conditional per PRD §17 — ships only if the
///         Trailblazer AI / Stylus Sprint grants land by Month 7. This
///         scaffold establishes the contract shape so the deploy chain
///         (PorticoRegistry → adapter list → Verifier UI) doesn't need
///         changes when Phase-2 triggers. The actual GMX V2 routing logic
///         (position-key derivation, swap-paths, fee accounting) lands
///         when the grant unlocks engineering bandwidth.
///
///         Same audit-pattern coverage as the 6 shipped adapters:
///         - DDD-5 / NNNN-1 constructor zero-checks
///         - F-32 / EEEEE-1 timelock-gated addInstrument
///         - F-11 nonReentrant via inheritance
///         - EEEE-1 / Fire 75 onlyAuthorizedCaller (Coffer + Router)
///         - G-5 originator from venue_payload[0..20]
contract GmxV2Adapter is IPorticoAdapter, ReentrancyGuard {
    IGmxRouter public immutable gmx_router;
    address public immutable usdc;
    address public immutable atrium_coffer;
    address public immutable praetor_multisig;
    address public immutable praetor_timelock;

    struct VenuePosition {
        address owner;
        bytes32 instrument_id;
        int256 notional_signed;
        bytes32 gmx_position_key;
        uint256 entry_price_q64;
        uint256 opened_at;
    }
    mapping(uint256 => VenuePosition) public positions;
    uint256 public next_venue_position_id;
    bytes32[] public supported_instruments_;
    mapping(bytes32 => bool) public is_supported_instrument;
    mapping(bytes32 => address) public instrument_to_gmx_market;
    mapping(bytes32 => uint16) public haircut_bps_;
    mapping(bytes32 => uint16) public initial_margin_bps_;
    mapping(bytes32 => uint16) public maintenance_margin_bps_;

    mapping(address => bool) public is_authorized_caller;
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event InstrumentAdded(bytes32 indexed instrument_id, uint16 haircut_bps, uint16 initial_margin_bps, uint16 maintenance_margin_bps);

    error Unauthorized();
    error UnsupportedInstrument(bytes32);
    error PositionNotFound();
    error BadVenuePayload();
    error UsdcTransferFailed(address to, uint256 amount);
    // Audit fix (contracts-sol #9): GMX is a Phase-2 scaffold (IGmxRouter is a
    // stub; the venue placeholder is the deployer EOA). Its Morpho/Synthetix
    // siblings revert ScaffoldNotImplemented on open; GMX did not, so the moment
    // any benign mock/partial router is pointed at the venue slot, the Router
    // pulls USDC into this adapter (Coffer.adapterPull) before calling open and
    // the funds strand. Block entry until a real GMX router is wired.
    error ScaffoldNotImplemented();

    modifier onlyAuthorizedCaller() {
        if (msg.sender != atrium_coffer && !is_authorized_caller[msg.sender]) revert Unauthorized();
        _;
    }
    modifier onlyPraetor() { if (msg.sender != praetor_multisig) revert Unauthorized(); _; }
    modifier onlyTimelock() { if (msg.sender != praetor_timelock) revert Unauthorized(); _; }

    constructor(address _router, address _usdc, address _coffer, address _praetor, address _praetor_timelock) {
        require(_router != address(0), "zero router");
        require(_usdc != address(0), "zero usdc");
        require(_coffer != address(0), "zero coffer");
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        gmx_router = IGmxRouter(_router);
        usdc = _usdc;
        atrium_coffer = _coffer;
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
    }

    function name() external pure returns (string memory) { return "GmxV2"; }
    function version() external pure returns (uint256, uint256, uint256) { return (1, 0, 0); }
    function isHybrid() external pure returns (bool) { return false; }
    function supportedInstruments() external view returns (bytes32[] memory) { return supported_instruments_; }

    function setAuthorizedCaller(address caller, bool authorized) external onlyTimelock {
        is_authorized_caller[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function deauthorizeCaller(address caller) external onlyPraetor {
        is_authorized_caller[caller] = false;
        emit AuthorizedCallerUpdated(caller, false);
    }

    function addInstrument(
        bytes32 instrument_id,
        address gmx_market,
        uint16 _haircut_bps,
        uint16 _initial_margin_bps,
        uint16 _maintenance_margin_bps
    ) external onlyTimelock {
        if (!is_supported_instrument[instrument_id]) {
            supported_instruments_.push(instrument_id);
            is_supported_instrument[instrument_id] = true;
        }
        instrument_to_gmx_market[instrument_id] = gmx_market;
        haircut_bps_[instrument_id] = _haircut_bps;
        initial_margin_bps_[instrument_id] = _initial_margin_bps;
        maintenance_margin_bps_[instrument_id] = _maintenance_margin_bps;
        emit InstrumentAdded(instrument_id, _haircut_bps, _initial_margin_bps, _maintenance_margin_bps);
    }

    function open_position(bytes32 instrument_id, int256 notional_signed, bytes calldata venue_payload)
        external onlyAuthorizedCaller nonReentrant returns (uint256 venue_position_id)
    {
        // Scaffold guard (audit #9): no real GMX router is wired. Revert before
        // any state/USDC movement so the Router cannot strand pulled collateral
        // in this adapter. Remove when a real gmx_router is deployed + set.
        revert ScaffoldNotImplemented();
        if (!is_supported_instrument[instrument_id]) revert UnsupportedInstrument(instrument_id);
        if (venue_payload.length < 20) revert BadVenuePayload();
        address originator;
        assembly { originator := shr(96, calldataload(venue_payload.offset)) }

        uint256 amount = uint256(notional_signed > 0 ? notional_signed : -notional_signed);
        address market = instrument_to_gmx_market[instrument_id];

        IERC20(usdc).approve(address(gmx_router), amount);
        bytes32 gmx_key = gmx_router.createPosition(market, usdc, amount, amount, notional_signed > 0);

        venue_position_id = ++next_venue_position_id;
        positions[venue_position_id] = VenuePosition({
            owner: originator,
            instrument_id: instrument_id,
            notional_signed: notional_signed,
            gmx_position_key: gmx_key,
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

        // Phase theta.1 funds-stranding fix: pre-fix the realized PnL was
        // returned to Coffer but the underlying USDC collateral stayed in
        // the adapter forever (per audit Round-1). Pattern: snapshot the
        // adapter's USDC balance, call the venue close, then forward any
        // net inflow to Coffer. Real GMX V2 settles closePosition into the
        // adapter's balance synchronously (or asynchronously via a separate
        // withdrawal queue when wired); the scaffold gmx_router stub
        // settles 0. Both cases handled correctly  scaffold transfers 0,
        // real GMX transfers the settled amount (collateral + signed PnL).
        // PnL accounting still flows via the realized_pnl_signed return.
        uint256 balanceBefore = IERC20(usdc).balanceOf(address(this));
        realized_pnl_signed = gmx_router.closePosition(pos.gmx_position_key);
        uint256 balanceAfter = IERC20(usdc).balanceOf(address(this));
        if (balanceAfter > balanceBefore) {
            uint256 settled = balanceAfter - balanceBefore;
            bool ok = IERC20(usdc).transfer(atrium_coffer, settled);
            if (!ok) revert UsdcTransferFailed(atrium_coffer, settled);
        }

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
        return VenueHealth({ is_operational: true, last_heartbeat_block: 0, quoted_spread_bps: 10, status_message: "ok" });
    }

    function get_haircut_bps(bytes32 i) external view returns (uint16) { return haircut_bps_[i]; }
    function get_initial_margin_bps(bytes32 i) external view returns (uint16) { return initial_margin_bps_[i]; }
    function get_maintenance_margin_bps(bytes32 i) external view returns (uint16) { return maintenance_margin_bps_[i]; }
    function attest_off_chain_state(bytes calldata) external pure returns (bool) { return false; }
}
