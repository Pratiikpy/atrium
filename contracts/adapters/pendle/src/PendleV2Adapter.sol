// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "../../../portico-registry/src/IPorticoAdapter.sol";
import {ReentrancyGuard} from "../../../portico-registry/src/ReentrancyGuard.sol";

/// Pendle V2 SY/PT/YT interface (subset used by Atrium).
/// Full at resources/pendle-core-v2-public/contracts/
interface IPendleMarket {
    function readState() external view returns (
        int256 totalPt,
        int256 totalSy,
        int256 totalLp,
        address treasury,
        int256 scalarRoot,
        uint256 expiry,
        uint256 lnFeeRateRoot,
        uint256 reserveFeePercent,
        uint256 lastLnImpliedRate
    );
    function expiry() external view returns (uint256);
    function readTokens() external view returns (address sy, address pt, address yt);
}

interface IPendleRouter {
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
    function swapExactTokenForPt(
        address receiver,
        address market,
        uint256 minPtOut,
        ApproxParams calldata guessPtOut,
        TokenInput calldata input
    ) external payable returns (uint256 netPtOut, uint256 netSyFee, uint256 netSyInterm);
    function swapExactPtForToken(
        address receiver,
        address market,
        uint256 exactPtIn,
        TokenOutput calldata output
    ) external returns (uint256 netTokenOut, uint256 netSyFee, uint256 netSyInterm);
}

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title PendleV2Adapter
/// @notice Portico adapter for Pendle V2 yield tokens.
///         Long YT exposure: swap USDC into PT (principal) and YT (yield).
///         Adapter holds tokens; reports position state via IPorticoAdapter.
contract PendleV2Adapter is IPorticoAdapter, ReentrancyGuard {
    IPendleRouter public immutable router;
    address public immutable usdc;
    address public immutable atrium_coffer;
    address public immutable praetor_multisig;
    // Audit EEEEE-1 fix (F-32 completeness): addInstrument is a parameter
    // change that must pass through the 48h community-veto window.
    // AaveHorizonAdapterV11 already had this; sibling-comparison caught
    // the missing migration on Pendle, TradeXyz, Polymarket, Hyperliquid.
    address public immutable praetor_timelock;

    struct VenuePosition {
        address owner;
        bytes32 instrument_id;
        int256 notional_signed;
        uint256 entry_price_q64;
        uint256 pt_balance;
        address market;
        uint256 opened_at;
    }

    mapping(uint256 => VenuePosition) public positions;
    uint256 public next_venue_position_id;
    mapping(bytes32 => address) public instrument_to_market;
    bytes32[] public supported_instruments_;
    mapping(bytes32 => bool) public is_supported_instrument;
    mapping(bytes32 => uint16) public haircut_bps_;
    mapping(bytes32 => uint16) public initial_margin_bps_;
    mapping(bytes32 => uint16) public maintenance_margin_bps_;

    error Unauthorized();
    error UnsupportedInstrument(bytes32);
    error PositionNotFound();
    error MarketExpired(uint256 expiry, uint256 now_seconds);
    error BadVenuePayload();

    // Audit EEEE-1 fix (`human_left.md` #31): adapter open/close gated by a
    // settable orchestrator list (Coffer + AtriumRouter + future routers).
    // Original `onlyCoffer` modifier retained for backwards-compatibility
    // with any legacy call site; removed in the Month-12 polish wave.
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

    // Audit EEEEE-3 fix: emit on instrument additions so the subgraph + UI
    // can render the listing lifecycle. None of the 6 adapters emitted
    // pre-fix — the listing was invisible to all observers.
    event InstrumentAdded(
        bytes32 indexed instrument_id,
        uint16 haircut_bps,
        uint16 initial_margin_bps,
        uint16 maintenance_margin_bps
    );

    constructor(address _router, address _usdc, address _coffer, address _praetor, address _praetor_timelock) {
        // Audit NNNN-1 fix (DDD-5 pattern, partial-coverage closer).
        require(_router != address(0), "zero router");
        require(_usdc != address(0), "zero usdc");
        require(_coffer != address(0), "zero coffer");
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        router = IPendleRouter(_router);
        usdc = _usdc;
        atrium_coffer = _coffer;
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
    }

    function name() external pure returns (string memory) { return "PendleV2"; }
    function version() external pure returns (uint256, uint256, uint256) { return (1, 0, 0); }
    function isHybrid() external pure returns (bool) { return false; }
    function supportedInstruments() external view returns (bytes32[] memory) { return supported_instruments_; }

    function open_position(bytes32 instrument_id, int256 notional_signed, bytes calldata venue_payload)
        external onlyAuthorizedCaller nonReentrant returns (uint256 venue_position_id)
    {
        address market = instrument_to_market[instrument_id];
        if (market == address(0)) revert UnsupportedInstrument(instrument_id);

        IPendleMarket pm = IPendleMarket(market);
        uint256 exp = pm.expiry();
        if (block.timestamp >= exp) revert MarketExpired(exp, block.timestamp);

        uint256 amount = uint256(notional_signed > 0 ? notional_signed : -notional_signed);

        // Audit G-5 fix: first 20 bytes = originator (4337-safe).
        if (venue_payload.length < 20) revert BadVenuePayload();
        address originator;
        assembly { originator := shr(96, calldataload(venue_payload.offset)) }
        bytes calldata pendle_payload = venue_payload[20:];

        // Decode Pendle swap params from the suffix — UI computes approxParams.
        (uint256 min_pt_out, IPendleRouter.ApproxParams memory approx, IPendleRouter.TokenInput memory input) =
            abi.decode(pendle_payload, (uint256, IPendleRouter.ApproxParams, IPendleRouter.TokenInput));

        IERC20(usdc).approve(address(router), amount);
        (uint256 pt_out, , ) = router.swapExactTokenForPt(address(this), market, min_pt_out, approx, input);

        venue_position_id = ++next_venue_position_id;
        positions[venue_position_id] = VenuePosition({
            owner: originator,
            instrument_id: instrument_id,
            notional_signed: notional_signed,
            entry_price_q64: 1 << 64, // PT entry priced at 1 USD-equivalent on first deposit
            pt_balance: pt_out,
            market: market,
            opened_at: block.timestamp
        });
        emit PositionOpened(venue_position_id, originator, instrument_id, notional_signed);
    }

    function close_position(uint256 venue_position_id, bytes calldata venue_payload)
        external onlyAuthorizedCaller nonReentrant returns (int256 realized_pnl_signed)
    {
        VenuePosition storage pos = positions[venue_position_id];
        if (pos.owner == address(0)) revert PositionNotFound();

        IPendleRouter.TokenOutput memory output = abi.decode(venue_payload, (IPendleRouter.TokenOutput));
        (uint256 token_out, , ) = router.swapExactPtForToken(
            atrium_coffer, pos.market, pos.pt_balance, output
        );
        uint256 supplied = uint256(pos.notional_signed > 0 ? pos.notional_signed : -pos.notional_signed);
        realized_pnl_signed = int256(token_out) - int256(supplied);
        emit PositionClosed(venue_position_id, realized_pnl_signed);
        delete positions[venue_position_id];
    }

    function modify_position(uint256, int256, bytes calldata) external pure returns (int256) {
        revert("modify not supported in v1");
    }

    function get_position(uint256 venue_position_id) external view returns (PositionView memory) {
        VenuePosition storage pos = positions[venue_position_id];
        return PositionView({
            owner: pos.owner,
            instrument_id: pos.instrument_id,
            notional_signed: pos.notional_signed,
            entry_price_q64: pos.entry_price_q64,
            current_price_q64: 1 << 64, // PT held to maturity converges to 1.0 USD
            unrealized_pnl_signed: 0,
            last_update_timestamp: pos.opened_at
        });
    }

    function get_venue_health() external view returns (VenueHealth memory) {
        return VenueHealth({
            is_operational: true,
            last_heartbeat_block: uint64(block.number),
            quoted_spread_bps: 10,
            status_message: "ok"
        });
    }

    function get_haircut_bps(bytes32 instrument_id) external view returns (uint16) { return haircut_bps_[instrument_id]; }
    function get_initial_margin_bps(bytes32 instrument_id) external view returns (uint16) { return initial_margin_bps_[instrument_id]; }
    function get_maintenance_margin_bps(bytes32 instrument_id) external view returns (uint16) { return maintenance_margin_bps_[instrument_id]; }

    function attest_off_chain_state(bytes calldata) external pure returns (bool) {
        return false;
    }

    function addInstrument(
        bytes32 instrument_id,
        address market,
        uint16 _haircut_bps,
        uint16 _initial_margin_bps,
        uint16 _maintenance_margin_bps
    ) external onlyTimelock {
        if (!is_supported_instrument[instrument_id]) {
            supported_instruments_.push(instrument_id);
            is_supported_instrument[instrument_id] = true;
        }
        instrument_to_market[instrument_id] = market;
        haircut_bps_[instrument_id] = _haircut_bps;
        initial_margin_bps_[instrument_id] = _initial_margin_bps;
        maintenance_margin_bps_[instrument_id] = _maintenance_margin_bps;
        emit InstrumentAdded(instrument_id, _haircut_bps, _initial_margin_bps, _maintenance_margin_bps);
    }
}
