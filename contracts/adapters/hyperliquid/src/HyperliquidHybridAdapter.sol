// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "../../../portico-registry/src/IPorticoAdapter.sol";
import {ReentrancyGuard} from "../../../portico-registry/src/ReentrancyGuard.sol";

/// @title HyperliquidHybridAdapter
/// @notice Hybrid Portico adapter for Hyperliquid HIP-3 / HIP-4.
///
/// HIP-3 perps run on Hyperliquid's L1 (Rust binary), not as EVM contracts.
/// Bridge2.sol on Arbitrum (verified at resources/hyperliquid-contracts/Bridge2.sol)
/// is the only on-chain surface. Position state lives on L1 and is brought
/// back via validator-signed attestations.
///
/// Architecture per TDD §28.1 patch 7 and §7.6 hybrid adapter pattern:
///
///   1. open_position pulls USDC from Coffer and deposits into the HL bridge
///   2. Off-chain agent submits the actual order to HL L1 via HL API
///   3. Validators sign the position state and submit via attest_off_chain_state
///   4. Position view + PnL computed from the latest signed attestation
///   5. close_position withdraws the position via validator-signed quorum
interface IHyperliquidBridge {
    /// @dev Bridge2.sol exposes `batchedDepositWithPermit` and `batchedRequestWithdrawals`.
    /// The exact interface lives in resources/hyperliquid-contracts/Bridge2.sol.
    /// Year-1 testnet wires the minimum needed for deposits + withdrawals.
    function batchedDepositWithPermit(
        bytes calldata depositData
    ) external;

    function pendingWithdrawals(bytes32 messageDigest) external view returns (uint64, uint64);
}

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract HyperliquidHybridAdapter is IPorticoAdapter, ReentrancyGuard {
    IHyperliquidBridge public immutable bridge;
    address public immutable usdc;
    address public immutable atrium_coffer;
    address public immutable praetor_multisig;
    // Audit EEEEE-1 fix (F-32 completeness): addInstrument is timelock-gated.
    address public immutable praetor_timelock;

    // Validator set whose signatures we accept on attestations.
    // Updated by Praetor on Hyperliquid validator-set changes.
    mapping(address => bool) public is_validator;
    address[] public validators;
    uint16 public required_signatures;

    struct PositionState {
        address owner;
        bytes32 instrument_id;
        int256 notional_signed;
        uint256 entry_price_q64;
        uint256 last_attested_price_q64;
        int256 last_attested_unrealized_pnl;
        uint64 last_attestation_block;
        bool is_open;
    }

    mapping(uint256 => PositionState) public positions;
    uint256 public next_venue_position_id;
    bytes32[] public supported_instruments_;
    mapping(bytes32 => bool) public is_supported_instrument;
    mapping(bytes32 => uint16) public haircut_bps_;
    mapping(bytes32 => uint16) public initial_margin_bps_;
    mapping(bytes32 => uint16) public maintenance_margin_bps_;
    mapping(bytes32 => bool) public seen_attestations;

    bool public is_venue_operational = true;

    // Audit G-8 fix: EIP-712 domain binding so a validator signature for
    // mainnet cannot replay on Sepolia (and vice-versa). The domain pins
    // chainId + this contract address at construction.
    bytes32 public immutable DOMAIN_SEPARATOR;
    // Audit FIRE76-4 fix (sub-agent HIGH, mirror of Polymarket): bind every
    // load-bearing field in the typehash so a validator signature for
    // position A cannot be replayed against position B.
    bytes32 private constant ATTESTATION_TYPEHASH = keccak256(
        "AttestationDigest(uint256 venue_position_id,bytes32 instrument_id,uint256 price_q64,int256 pnl,uint64 hl_block,bytes32 attestation_hash)"
    );

    error Unauthorized();
    error UnsupportedInstrument(bytes32 instrument_id);
    error PositionNotOpen();
    error BadVenuePayload();
    error InsufficientSignatures(uint16 got, uint16 need);
    error DuplicateAttestation(bytes32 attestation_hash);

    // Audit DDDDD-4 fix: validator-set rotation must be observable. Pre-fix
    // the rotation flipped storage silently — subgraph + ops dashboards
    // couldn't track validator-quorum changes.
    event ValidatorSetUpdated(address[] new_validators, uint16 new_required);
    // Audit EEEEE-3 fix: emit on instrument additions.
    event InstrumentAdded(
        bytes32 indexed instrument_id,
        uint16 haircut_bps,
        uint16 initial_margin_bps,
        uint16 maintenance_margin_bps
    );

    modifier onlyPraetor() {
        if (msg.sender != praetor_multisig) revert Unauthorized();
        _;
    }
    modifier onlyCoffer() {
        if (msg.sender != atrium_coffer) revert Unauthorized();
        _;
    }
    modifier onlyTimelock() {
        if (msg.sender != praetor_timelock) revert Unauthorized();
        _;
    }

    // Audit EEEE-1 fix (`human_left.md` #31): orchestrator-list pattern.
    mapping(address => bool) public is_authorized_caller;
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    modifier onlyAuthorizedCaller() {
        if (msg.sender != atrium_coffer && !is_authorized_caller[msg.sender]) revert Unauthorized();
        _;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyPraetor {
        is_authorized_caller[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    constructor(address _bridge, address _usdc, address _coffer, address _praetor, address _praetor_timelock, uint16 _required) {
        // Audit NNNN-1 fix (DDD-5 pattern, partial-coverage closer).
        require(_bridge != address(0), "zero bridge");
        require(_usdc != address(0), "zero usdc");
        require(_coffer != address(0), "zero coffer");
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        bridge = IHyperliquidBridge(_bridge);
        usdc = _usdc;
        atrium_coffer = _coffer;
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("AtriumHyperliquidAdapter")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
        required_signatures = _required;
    }

    function name() external pure returns (string memory) { return "Hyperliquid"; }
    function version() external pure returns (uint256, uint256, uint256) { return (1, 0, 0); }
    function isHybrid() external pure returns (bool) { return true; }

    function supportedInstruments() external view returns (bytes32[] memory) {
        return supported_instruments_;
    }

    function open_position(bytes32 instrument_id, int256 notional_signed, bytes calldata venue_payload)
        external
        onlyAuthorizedCaller
        nonReentrant
        returns (uint256 venue_position_id)
    {
        if (!is_supported_instrument[instrument_id]) revert UnsupportedInstrument(instrument_id);

        uint256 amount = uint256(notional_signed > 0 ? notional_signed : -notional_signed);
        IERC20(usdc).approve(address(bridge), amount);
        bridge.batchedDepositWithPermit(venue_payload); // deposit data prepared off-chain

        // Audit B-10 fix: read the owner from a structured leading prefix in
        // venue_payload (first 20 bytes) instead of tx.origin. Coffer's
        // adapter_pull caller is responsible for packing the originator
        // address ahead of the venue-specific deposit data.
        address originator;
        if (venue_payload.length >= 20) {
            assembly {
                originator := shr(96, calldataload(venue_payload.offset))
            }
        } else {
            revert BadVenuePayload(); // refuse rather than fall back to tx.origin
        }

        venue_position_id = ++next_venue_position_id;
        positions[venue_position_id] = PositionState({
            owner: originator,
            instrument_id: instrument_id,
            notional_signed: notional_signed,
            entry_price_q64: 0, // Set on first attestation
            last_attested_price_q64: 0,
            last_attested_unrealized_pnl: 0,
            last_attestation_block: 0,
            is_open: true
        });
        emit PositionOpened(venue_position_id, originator, instrument_id, notional_signed);
    }

    function close_position(uint256 venue_position_id, bytes calldata venue_payload)
        external
        onlyAuthorizedCaller
        nonReentrant
        returns (int256 realized_pnl_signed)
    {
        PositionState storage pos = positions[venue_position_id];
        if (!pos.is_open) revert PositionNotOpen();

        // Realized PnL = last attested unrealized PnL at the time of close.
        // Bridge withdrawal happens in a follow-up tx after validators sign
        // the withdrawal — Atrium tracks the withdrawal id off-chain and the
        // Aqueduct claim-back mechanism handles disputes.
        realized_pnl_signed = pos.last_attested_unrealized_pnl;
        pos.is_open = false;
        emit PositionClosed(venue_position_id, realized_pnl_signed);
        venue_payload;
    }

    function modify_position(uint256, int256, bytes calldata) external pure returns (int256) {
        revert("modify not supported in v1");
    }

    function get_position(uint256 venue_position_id) external view returns (PositionView memory) {
        PositionState storage pos = positions[venue_position_id];
        return PositionView({
            owner: pos.owner,
            instrument_id: pos.instrument_id,
            notional_signed: pos.notional_signed,
            entry_price_q64: pos.entry_price_q64,
            current_price_q64: pos.last_attested_price_q64,
            unrealized_pnl_signed: pos.last_attested_unrealized_pnl,
            last_update_timestamp: pos.last_attestation_block
        });
    }

    function get_venue_health() external view returns (VenueHealth memory) {
        return VenueHealth({
            is_operational: is_venue_operational,
            last_heartbeat_block: uint64(block.number),
            quoted_spread_bps: 5, // HIP-3 typical
            status_message: is_venue_operational ? "ok" : "L1 attestation lag"
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

    /// @notice Hybrid extension: accept a validator-signed attestation of HL L1 position state.
    /// @dev    `signed_attestation` ABI: (uint256 venue_position_id, uint256 price_q64, int256 unrealized_pnl,
    ///                                    uint64 hl_block, bytes32 attestation_hash, bytes[] signatures, address[] signers)
    function attest_off_chain_state(bytes calldata signed_attestation) external returns (bool) {
        (
            uint256 venue_position_id,
            uint256 price_q64,
            int256 unrealized_pnl,
            uint64 hl_block,
            bytes32 attestation_hash,
            bytes[] memory signatures,
            address[] memory signers
        ) = abi.decode(signed_attestation, (uint256, uint256, int256, uint64, bytes32, bytes[], address[]));

        if (seen_attestations[attestation_hash]) revert DuplicateAttestation(attestation_hash);
        seen_attestations[attestation_hash] = true;

        // Audit FIRE76-4 fix: typehash binds every load-bearing field.
        bytes32 structHash = keccak256(abi.encode(
            ATTESTATION_TYPEHASH,
            venue_position_id,
            positions[venue_position_id].instrument_id,
            price_q64,
            unrealized_pnl,
            hl_block,
            attestation_hash
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        // Audit B-1 fix: actually recover ECDSA. Each signature is a 65-byte
        // (r, s, v) tuple. Verify the recovered address matches the claimed
        // signer AND that signer is in the validator set. Dedupe by tracking
        // signers seen this loop so one validator can't fill the quorum N times.
        uint16 valid_sigs = 0;
        address[] memory seen_in_loop = new address[](signers.length);
        for (uint256 i = 0; i < signers.length; i++) {
            address claimed = signers[i];
            if (!is_validator[claimed]) continue;
            if (i >= signatures.length) continue;
            bytes memory s = signatures[i];
            if (s.length != 65) continue;
            bytes32 r; bytes32 ss; uint8 v;
            assembly {
                r := mload(add(s, 32))
                ss := mload(add(s, 64))
                v := byte(0, mload(add(s, 96)))
            }
            address recovered = ecrecover(digest, v, r, ss);
            // Audit CCC-1 fix: classic ECDSA pitfall. `ecrecover` returns
            // `address(0)` on a malformed signature. Without the explicit
            // zero-check, if `address(0)` ever ends up in `is_validator`
            // (via a setValidators with zero in the array), an attacker
            // could submit any 65-byte garbage with `claimed = address(0)`
            // and pass the validator check: address(0) == address(0).
            // Defense in depth — both this site AND setValidators below
            // reject the zero address.
            if (recovered == address(0) || recovered != claimed) continue;
            // Deduplicate
            bool already_seen = false;
            for (uint256 j = 0; j < i; j++) {
                if (seen_in_loop[j] == claimed) { already_seen = true; break; }
            }
            if (already_seen) continue;
            seen_in_loop[i] = claimed;
            valid_sigs++;
        }
        // Audit iteration 45 fix (mirror of PolymarketAdapter): defensive
        // bail when required_signatures is still at the deploy-default
        // zero. Pre-fix the bootstrap window (deploy → 1st setValidators
        // multisig) left `valid_sigs < 0` always-false → any attestation
        // passed. Defense in depth alongside the setValidators bounds.
        require(required_signatures > 0 && validators.length > 0, "validators not configured");
        if (valid_sigs < required_signatures) revert InsufficientSignatures(valid_sigs, required_signatures);

        PositionState storage pos = positions[venue_position_id];
        if (pos.entry_price_q64 == 0) {
            pos.entry_price_q64 = price_q64;
        }
        pos.last_attested_price_q64 = price_q64;
        pos.last_attested_unrealized_pnl = unrealized_pnl;
        pos.last_attestation_block = hl_block;
        emit AttestationAccepted(attestation_hash, msg.sender);
        return true;
    }

    // ===== Praetor admin =====
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

    function setValidators(address[] calldata new_validators, uint16 new_required) external onlyPraetor {
        // Audit iteration 45 fix (critical, mirror of PolymarketAdapter):
        // bound new_required so a multisig typo can't degrade quorum.
        // Pre-fix `new_required = 0` made `valid < 0` always false →
        // any attestation passes with zero valid signatures → attacker
        // forges Hyperliquid settlement state. Must satisfy
        // `1 <= new_required <= len(new_validators)`.
        require(new_validators.length > 0, "empty validator set");
        require(new_required > 0, "zero required signatures");
        require(new_required <= new_validators.length, "required exceeds validator count");
        // Audit CCC-1 fix (defense in depth): reject address(0) at input
        // time as well as at the ecrecover comparison. Either layer alone
        // would close the bypass; both layers makes it structurally impossible
        // to introduce a zero-address validator via Praetor multisig typo.
        for (uint256 i = 0; i < new_validators.length; i++) {
            require(new_validators[i] != address(0), "zero validator");
            // Audit FIRE76-3 fix (sub-agent MEDIUM, mirror of Polymarket): intra-
            // array dedup. Prevents multisig signing-error duplicates that
            // would corrupt the `validators` array + quorum math.
            for (uint256 j = 0; j < i; j++) {
                require(new_validators[i] != new_validators[j], "duplicate validator");
            }
        }
        // Clear old
        for (uint256 i = 0; i < validators.length; i++) {
            is_validator[validators[i]] = false;
        }
        delete validators;
        // Set new
        for (uint256 i = 0; i < new_validators.length; i++) {
            is_validator[new_validators[i]] = true;
            validators.push(new_validators[i]);
        }
        required_signatures = new_required;
        emit ValidatorSetUpdated(new_validators, new_required);
    }

    function setOperational(bool operational, string calldata status_msg) external onlyPraetor {
        is_venue_operational = operational;
        emit VenueHealthChanged(operational, status_msg);
    }
}
