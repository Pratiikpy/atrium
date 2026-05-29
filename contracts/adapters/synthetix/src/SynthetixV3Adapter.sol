// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "../../../portico-registry/src/IPorticoAdapter.sol";
import {ReentrancyGuard} from "../../../portico-registry/src/ReentrancyGuard.sol";

/// Synthetix V3 perpetual markets — partial interface. Full set in
/// resources/synthetix-v3/markets/perps-market/contracts/.
interface ISynthetixV3PerpsMarket {
    /// Modify a position by a signed size delta. Returns the perp position id
    /// keyed by (account_id, market_id) on Synthetix's side.
    function modifyCollateral(uint128 accountId, uint128 synthMarketId, int256 amountDelta) external;
    function commitOrder(uint128 accountId, uint128 marketId, int128 sizeDelta, uint128 settlementStrategyId, uint256 acceptablePrice, bytes32 trackingCode, address referrer) external returns (uint256 commitmentId);
    function settleOrder(uint128 accountId, uint128 marketId) external returns (int256 realizedPnlUsd);
    function getOpenPosition(uint128 accountId, uint128 marketId) external view returns (int256 totalPnl, int256 accruedFunding, int128 positionSize);
}

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @title SynthetixV3Adapter
/// @notice Portico adapter for Synthetix V3 perpetual markets.
///
///         **Status:** Phase-2 conditional per PRD §17 / TDD §13 — Month-8 ship
///         contingent on the Stylus Sprint grant landing by Month 7. This scaffold
///         freezes the contract shape so deploy chain (PorticoRegistry → adapter
///         list → Verifier UI → subgraph) doesn't need changes when Phase-2
///         triggers. The Synthetix V3 commit-and-settle order flow,
///         account-id management, and `acceptablePrice` slippage handling
///         are filled in when the grant unlocks engineering bandwidth.
///
///         Audit-pattern coverage mirrored from GmxV2Adapter:
///         - DDD-5 / NNNN-1 constructor zero-checks
///         - F-32 / EEEEE-1 timelock-gated addInstrument
///         - F-11 nonReentrant via inheritance
///         - EEEE-1 / Fire 75 onlyAuthorizedCaller (Coffer + Router)
///         - G-5 originator from venue_payload[0..20]
contract SynthetixV3Adapter is IPorticoAdapter, ReentrancyGuard {
    ISynthetixV3PerpsMarket public immutable perps_market;
    address public immutable susd;
    address public immutable atrium_coffer;
    address public immutable praetor_multisig;
    address public immutable praetor_timelock;
    uint128 public immutable atrium_account_id;

    struct VenuePosition {
        address owner;
        bytes32 instrument_id;
        int256 notional_signed;
        uint128 synth_market_id;
        uint256 commitment_id;
        uint256 entry_price_q64;
        uint256 opened_at;
    }
    mapping(uint256 => VenuePosition) public positions;
    uint256 public next_venue_position_id;

    bytes32[] public supported_instruments_;
    mapping(bytes32 => bool) public is_supported_instrument;
    mapping(bytes32 => uint128) public instrument_to_synth_market;
    mapping(bytes32 => uint16) public haircut_bps_;
    mapping(bytes32 => uint16) public initial_margin_bps_;
    mapping(bytes32 => uint16) public maintenance_margin_bps_;

    mapping(address => bool) public is_authorized_caller;
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event InstrumentAdded(bytes32 indexed instrument_id, uint128 synth_market_id, uint16 haircut_bps, uint16 initial_margin_bps, uint16 maintenance_margin_bps);

    error Unauthorized();
    error UnsupportedInstrument(bytes32);
    error PositionNotFound();
    error BadVenuePayload();
    /// Phase theta-followup (2026-05-25): the scaffold can no longer accept
    /// open_position calls. Pre-fix, calling open via the Router would pull
    /// USDC from Coffer (per adapterPull) but the scaffold never deployed
    /// the USDC into Synthetix V3 — the funds would strand in the adapter.
    /// Block the entry until the real Synthetix open lands (Year-2).
    error ScaffoldNotImplemented();

    modifier onlyAuthorizedCaller() {
        if (msg.sender != atrium_coffer && !is_authorized_caller[msg.sender]) revert Unauthorized();
        _;
    }
    modifier onlyPraetor() { if (msg.sender != praetor_multisig) revert Unauthorized(); _; }
    modifier onlyTimelock() { if (msg.sender != praetor_timelock) revert Unauthorized(); _; }

    constructor(
        address _perps_market,
        address _susd,
        address _coffer,
        address _praetor,
        address _praetor_timelock,
        uint128 _atrium_account_id
    ) {
        require(_perps_market != address(0), "zero perps_market");
        require(_susd != address(0), "zero susd");
        require(_coffer != address(0), "zero coffer");
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        require(_atrium_account_id != 0, "zero account_id");
        perps_market = ISynthetixV3PerpsMarket(_perps_market);
        susd = _susd;
        atrium_coffer = _coffer;
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
        atrium_account_id = _atrium_account_id;
    }

    function name() external pure returns (string memory) { return "SynthetixV3"; }
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
        uint128 synth_market_id,
        uint16 _haircut_bps,
        uint16 _initial_margin_bps,
        uint16 _maintenance_margin_bps
    ) external onlyTimelock {
        if (!is_supported_instrument[instrument_id]) {
            supported_instruments_.push(instrument_id);
            is_supported_instrument[instrument_id] = true;
        }
        instrument_to_synth_market[instrument_id] = synth_market_id;
        haircut_bps_[instrument_id] = _haircut_bps;
        initial_margin_bps_[instrument_id] = _initial_margin_bps;
        maintenance_margin_bps_[instrument_id] = _maintenance_margin_bps;
        emit InstrumentAdded(instrument_id, synth_market_id, _haircut_bps, _initial_margin_bps, _maintenance_margin_bps);
    }

    function open_position(bytes32 instrument_id, int256 notional_signed, bytes calldata venue_payload)
        external onlyAuthorizedCaller nonReentrant returns (uint256 venue_position_id)
    {
        // Phase theta-followup (2026-05-25): scaffold blocks entry. Pre-fix
        // a call would pull USDC via Coffer.adapterPull, record position
        // metadata, and never deploy into Synthetix V3 — the USDC would
        // strand in the adapter and Coffer's share accounting would
        // permanently disagree with on-chain reality. Real Synthetix V3
        // commitOrder + sUSD-vs-USDC bridging lands Year-2.
        revert ScaffoldNotImplemented();
        // Unreachable; kept so the function signature compiles + audit
        // tooling can see what the eventual real impl will need.
        if (!is_supported_instrument[instrument_id]) revert UnsupportedInstrument(instrument_id);
        if (venue_payload.length < 20) revert BadVenuePayload();
        address originator;
        assembly { originator := shr(96, calldataload(venue_payload.offset)) }

        uint128 market_id = instrument_to_synth_market[instrument_id];
        uint256 amount = uint256(notional_signed > 0 ? notional_signed : -notional_signed);

        // Scaffold: real implementation will encode acceptablePrice, trackingCode,
        // and settlementStrategyId from venue_payload. v1 stub uses commit_id = 0.
        IERC20(susd).approve(address(perps_market), amount);

        venue_position_id = ++next_venue_position_id;
        positions[venue_position_id] = VenuePosition({
            owner: originator,
            instrument_id: instrument_id,
            notional_signed: notional_signed,
            synth_market_id: market_id,
            commitment_id: 0,
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
        // Scaffold pre-fix never returned USDC to Coffer; the matching
        // open_position fix below makes it impossible to enter this state
        // for new positions. Existing pre-fix positions can still close —
        // the venue side is a no-op (Synthetix never recorded them).
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
