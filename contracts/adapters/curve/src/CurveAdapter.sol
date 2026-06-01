// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "../../../portico-registry/src/IPorticoAdapter.sol";
import {ReentrancyGuard} from "../../../portico-registry/src/ReentrancyGuard.sol";

interface ICurvePool {
    function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount) external returns (uint256);
    function remove_liquidity_one_coin(uint256 burn_amount, int128 i, uint256 min_received) external returns (uint256);
    function get_virtual_price() external view returns (uint256);
}

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title CurveAdapter
/// @notice Portico adapter for Curve stableswap liquidity positions.
///         Long = supply USDC into a stable pool to earn trading fees + yield.
contract CurveAdapter is IPorticoAdapter, ReentrancyGuard {
    ICurvePool public immutable pool;
    address public immutable usdc;
    address public immutable lp_token;
    int128 public immutable usdc_index;
    address public immutable atrium_coffer;
    address public immutable praetor_multisig;
    // Audit EEEEE-1 fix (F-32 completeness): setRiskParams is a parameter
    // change that must pass through the 48h timelock veto window.
    address public immutable praetor_timelock;
    // Audit EEEE-1 fix (`human_left.md` #31): the original `onlyCoffer`
    // gate was too narrow, it precluded any orchestrator (e.g. AtriumRouter)
    // from reaching the adapter. The Router was added so that Plinth →
    // Coffer.adapter_pull → adapter.open_position could be a single atomic
    // path. This mapping replaces the single-address gate.
    mapping(address => bool) public is_authorized_caller;

    struct VenuePosition {
        address owner;
        bytes32 instrument_id;
        int256 notional_signed;
        uint256 entry_price_q64;
        uint256 lp_balance;
        uint256 opened_at;
    }
    mapping(uint256 => VenuePosition) public positions;
    uint256 public next_venue_position_id;
    bytes32 public immutable supported_instrument;
    mapping(bytes32 => uint16) public haircut_bps_;
    mapping(bytes32 => uint16) public initial_margin_bps_;
    mapping(bytes32 => uint16) public maintenance_margin_bps_;

    error Unauthorized();
    error UnsupportedInstrument(bytes32);
    error PositionNotFound();
    error BadVenuePayload();
    /// Audit JJJ-9 fix: surface real revert when USDC.transfer to Coffer
    /// returns false. Pre-fix, a false return on close would delete the
    /// position storage + emit PositionClosed while the redeemed USDC
    /// stayed stranded in the adapter.
    error UsdcTransferFailed(address to, uint256 amount);

    /// @notice Open/close-position auth. Coffer is authorized at deploy
    /// (immutable seed of the set). AtriumRouter is added by Praetor via
    /// `setAuthorizedCaller`. Future orchestrators slot in without
    /// adapter redeploys.
    modifier onlyAuthorizedCaller() {
        if (msg.sender != atrium_coffer && !is_authorized_caller[msg.sender]) revert Unauthorized();
        _;
    }
    /// @notice Backwards-compatible alias retained so existing call sites
    /// (Coffer-side direct calls + legacy tests) keep working. Removed in
    /// the Month-12 polish wave.
    modifier onlyCoffer() { if (msg.sender != atrium_coffer) revert Unauthorized(); _; }
    modifier onlyPraetor() { if (msg.sender != praetor_multisig) revert Unauthorized(); _; }
    modifier onlyTimelock() { if (msg.sender != praetor_timelock) revert Unauthorized(); _; }

    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    function setAuthorizedCaller(address caller, bool authorized) external onlyTimelock {
        is_authorized_caller[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function deauthorizeCaller(address caller) external onlyPraetor {
        is_authorized_caller[caller] = false;
        emit AuthorizedCallerUpdated(caller, false);
    }

    // Audit EEEEE-3 fix: emit on risk param changes.
    event RiskParamsUpdated(
        bytes32 indexed instrument_id,
        uint16 haircut_bps,
        uint16 initial_margin_bps,
        uint16 maintenance_margin_bps
    );

    constructor(
        address _pool,
        address _usdc,
        address _lp_token,
        int128 _usdc_index,
        address _coffer,
        address _praetor,
        address _praetor_timelock,
        bytes32 _instrument
    ) {
        // Audit NNNN-1 fix (DDD-5 pattern, partial-coverage closer).
        require(_pool != address(0), "zero pool");
        require(_usdc != address(0), "zero usdc");
        require(_lp_token != address(0), "zero lp_token");
        require(_coffer != address(0), "zero coffer");
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        pool = ICurvePool(_pool);
        usdc = _usdc;
        lp_token = _lp_token;
        usdc_index = _usdc_index;
        atrium_coffer = _coffer;
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
        supported_instrument = _instrument;
    }

    function name() external pure returns (string memory) { return "Curve"; }
    function version() external pure returns (uint256, uint256, uint256) { return (1, 0, 0); }
    function isHybrid() external pure returns (bool) { return false; }
    function supportedInstruments() external view returns (bytes32[] memory) {
        bytes32[] memory arr = new bytes32[](1);
        arr[0] = supported_instrument;
        return arr;
    }

    function open_position(bytes32 instrument_id, int256 notional_signed, bytes calldata venue_payload)
        external onlyAuthorizedCaller nonReentrant returns (uint256 venue_position_id)
    {
        if (instrument_id != supported_instrument) revert UnsupportedInstrument(instrument_id);
        uint256 amount = uint256(notional_signed > 0 ? notional_signed : -notional_signed);

        // Audit G-5 fix: explicit originator instead of tx.origin (4337-safe).
        if (venue_payload.length < 20) revert BadVenuePayload();
        address originator;
        assembly { originator := shr(96, calldataload(venue_payload.offset)) }

        uint256[2] memory amounts;
        amounts[uint256(int256(usdc_index))] = amount;
        IERC20(usdc).approve(address(pool), amount);
        uint256 lp_minted = pool.add_liquidity(amounts, 0);

        venue_position_id = ++next_venue_position_id;
        positions[venue_position_id] = VenuePosition({
            owner: originator,
            instrument_id: instrument_id,
            notional_signed: notional_signed,
            entry_price_q64: pool.get_virtual_price() * (1 << 32), // scale to Q64.64
            lp_balance: lp_minted,
            opened_at: block.timestamp
        });
        emit PositionOpened(venue_position_id, originator, instrument_id, notional_signed);
    }

    function close_position(uint256 venue_position_id, bytes calldata) external onlyAuthorizedCaller nonReentrant returns (int256) {
        VenuePosition storage pos = positions[venue_position_id];
        if (pos.owner == address(0)) revert PositionNotFound();

        uint256 received = pool.remove_liquidity_one_coin(pos.lp_balance, usdc_index, 0);
        uint256 supplied = uint256(pos.notional_signed > 0 ? pos.notional_signed : -pos.notional_signed);
        int256 pnl = int256(received) - int256(supplied);
        // Audit JJJ-9 fix: capture transfer return + revert on false.
        // Audit JJJ-10 (deferred): the `0` passed as min_received above and as
        // min_mint_amount in open_position is an MEV slippage hole. Fixing
        // requires reading `pool.calc_withdraw_one_coin` + slippage tolerance
        // at quote time. Tracked Year-2; on Sepolia mempool MEV risk is low.
        bool ok = IERC20(usdc).transfer(atrium_coffer, received);
        if (!ok) revert UsdcTransferFailed(atrium_coffer, received);
        emit PositionClosed(venue_position_id, pnl);
        delete positions[venue_position_id];
        return pnl;
    }

    function modify_position(uint256, int256, bytes calldata) external pure returns (int256) { revert("v1"); }

    function get_position(uint256 venue_position_id) external view returns (PositionView memory) {
        VenuePosition storage pos = positions[venue_position_id];
        return PositionView({
            owner: pos.owner,
            instrument_id: pos.instrument_id,
            notional_signed: pos.notional_signed,
            entry_price_q64: pos.entry_price_q64,
            current_price_q64: pool.get_virtual_price() * (1 << 32),
            unrealized_pnl_signed: 0,
            last_update_timestamp: pos.opened_at
        });
    }

    function get_venue_health() external pure returns (VenueHealth memory) {
        return VenueHealth({
            is_operational: true,
            last_heartbeat_block: 0,
            quoted_spread_bps: 1,
            status_message: "ok"
        });
    }

    function get_haircut_bps(bytes32 i) external view returns (uint16) { return haircut_bps_[i]; }
    function get_initial_margin_bps(bytes32 i) external view returns (uint16) { return initial_margin_bps_[i]; }
    function get_maintenance_margin_bps(bytes32 i) external view returns (uint16) { return maintenance_margin_bps_[i]; }
    function attest_off_chain_state(bytes calldata) external pure returns (bool) { return false; }

    function setRiskParams(bytes32 i, uint16 h, uint16 im, uint16 mm) external onlyTimelock {
        haircut_bps_[i] = h;
        initial_margin_bps_[i] = im;
        maintenance_margin_bps_[i] = mm;
        emit RiskParamsUpdated(i, h, im, mm);
    }
}
