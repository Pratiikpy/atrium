// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "../../../portico-registry/src/IPorticoAdapter.sol";
import {ReentrancyGuard} from "../../../portico-registry/src/ReentrancyGuard.sol";

/// @title PolymarketAdapter
/// @notice Cross-chain Portico adapter for Polymarket binary outcome markets on Polygon Amoy.
///
/// Polymarket runs on Polygon, not Ethereum. Position opens go through Aqueduct
/// CCIP: this adapter on Arbitrum locks USDC into the Aqueduct outbound queue;
/// the destination AqueductReceiver on Polygon Amoy then mints into the
/// Polymarket conditional-token vault on behalf of the user.
///
/// Year-1 testnet: this is a thin queueing layer. Real fill confirmation comes
/// back via a validator-style attestation (same hybrid pattern as Hyperliquid).
interface IAqueduct {
    function send_collateral(uint64 destSelector, address dest_user, uint256 amount_wei, uint256 expires_at)
        external
        returns (bytes32 messageId);
}

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PolymarketAdapter is IPorticoAdapter, ReentrancyGuard {
    IAqueduct public immutable aqueduct;
    address public immutable usdc;
    address public immutable atrium_coffer;
    address public immutable praetor_multisig;
    // Audit EEEEE-1 fix (F-32 completeness): addInstrument is timelock-gated.
    address public immutable praetor_timelock;
    uint64 public immutable polygon_amoy_selector;
    /// Polymarket adapter (or receiver proxy) on Polygon Amoy
    address public polymarket_on_dest;

    struct VenuePosition {
        address owner;
        bytes32 instrument_id;
        int256 notional_signed;
        bytes32 ccip_message_id;
        uint256 entry_price_q64;
        int256 last_attested_pnl;
        uint64 last_attestation_block;
        uint64 opened_at;
        bool is_open;
    }

    mapping(uint256 => VenuePosition) public positions;
    uint256 public next_venue_position_id;
    mapping(bytes32 => bool) public is_supported_instrument;
    bytes32[] public supported_instruments_;
    mapping(bytes32 => uint16) public haircut_bps_;
    mapping(bytes32 => uint16) public initial_margin_bps_;
    mapping(bytes32 => uint16) public maintenance_margin_bps_;
    mapping(address => bool) public is_validator;
    // Audit DDDDD-1 fix: track the current validator set in an array so
    // `setValidators` can clear the OLD set before flipping the new one.
    // Pre-fix the function only ORed in the new addresses, leaving
    // rotated-out validators with `is_validator = true` indefinitely —
    // a compromised key remained valid after Praetor "rotated" it.
    // Mirror of HyperliquidHybridAdapter's pattern (which already
    // clears properly).
    address[] public validators;
    uint16 public required_signatures;
    mapping(bytes32 => bool) public seen_attestations;

    // Audit G-8 fix: EIP-712 domain binding (chain-id + this contract) so a
    // validator signature can't replay across networks.
    bytes32 public immutable DOMAIN_SEPARATOR;
    // Audit FIRE76-4 fix (sub-agent HIGH): pre-fix the typehash wrapped only
    // a caller-supplied opaque `bytes32 attestation_hash`, so a validator
    // signature for position 7's attestation hash could be replayed against
    // position 99 (different fields, same `attestation_hash` value). Now
    // the typehash binds every load-bearing field — venue_position_id,
    // instrument_id, price_q64, pnl, block_no — so the digest changes if
    // any of them change. Off-chain validators must update their signing
    // payload to match this struct definition.
    bytes32 private constant ATTESTATION_TYPEHASH = keccak256(
        "AttestationDigest(uint256 venue_position_id,bytes32 instrument_id,uint256 price_q64,int256 pnl,uint64 block_no,bytes32 attestation_hash)"
    );

    error Unauthorized();
    error UnsupportedInstrument(bytes32);
    error PositionNotFound();
    error InsufficientSignatures(uint16 got, uint16 need);
    error DuplicateAttestation(bytes32);
    error BadVenuePayload();
    error UsdcTransferFailed(address to, uint256 amount);

    // Audit DDDDD-2 + DDDDD-3 fix: emit rotation events on validator-set
    // and destination changes so observers (subgraph, ops dashboards) can
    // track the security-critical config lifecycle.
    event ValidatorSetUpdated(address[] new_validators, uint16 new_required);
    event DestinationUpdated(address indexed previous, address indexed next);
    // Audit EEEEE-3 fix: emit on instrument additions.
    event InstrumentAdded(
        bytes32 indexed instrument_id,
        uint16 haircut_bps,
        uint16 initial_margin_bps,
        uint16 maintenance_margin_bps
    );

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

    constructor(
        address _aqueduct,
        address _usdc,
        address _coffer,
        address _praetor,
        address _praetor_timelock,
        uint64 _polygon_amoy_selector
    ) {
        // Audit NNNN-1 fix (DDD-5 pattern, partial-coverage closer).
        require(_aqueduct != address(0), "zero aqueduct");
        require(_usdc != address(0), "zero usdc");
        require(_coffer != address(0), "zero coffer");
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        aqueduct = IAqueduct(_aqueduct);
        usdc = _usdc;
        atrium_coffer = _coffer;
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
        polygon_amoy_selector = _polygon_amoy_selector;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("AtriumPolymarketAdapter")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

    function name() external pure returns (string memory) { return "Polymarket"; }
    function version() external pure returns (uint256, uint256, uint256) { return (1, 0, 0); }
    function isHybrid() external pure returns (bool) { return true; }
    function supportedInstruments() external view returns (bytes32[] memory) { return supported_instruments_; }

    function open_position(bytes32 instrument_id, int256 notional_signed, bytes calldata venue_payload)
        external onlyAuthorizedCaller nonReentrant returns (uint256 venue_position_id)
    {
        if (!is_supported_instrument[instrument_id]) revert UnsupportedInstrument(instrument_id);
        if (polymarket_on_dest == address(0)) revert Unauthorized();

        uint256 amount = uint256(notional_signed > 0 ? notional_signed : -notional_signed);

        // Audit G-5 fix: first 20 bytes = originator (4337-safe).
        if (venue_payload.length < 20) revert BadVenuePayload();
        address originator;
        assembly { originator := shr(96, calldataload(venue_payload.offset)) }
        bytes calldata polymarket_payload = venue_payload[20:];

        // Decode the suffix: (uint256 expires_at_seconds)
        uint256 expires_at = abi.decode(polymarket_payload, (uint256));

        // Approve Aqueduct to pull USDC + queue cross-chain send
        IERC20(usdc).approve(address(aqueduct), amount);
        bytes32 messageId = aqueduct.send_collateral(
            polygon_amoy_selector,
            polymarket_on_dest,
            amount,
            expires_at
        );

        venue_position_id = ++next_venue_position_id;
        positions[venue_position_id] = VenuePosition({
            owner: originator,
            instrument_id: instrument_id,
            notional_signed: notional_signed,
            ccip_message_id: messageId,
            entry_price_q64: 0,
            last_attested_pnl: 0,
            last_attestation_block: 0,
            opened_at: uint64(block.timestamp),
            is_open: true
        });
        emit PositionOpened(venue_position_id, originator, instrument_id, notional_signed);
    }

    function close_position(uint256 venue_position_id, bytes calldata) external onlyAuthorizedCaller nonReentrant returns (int256) {
        VenuePosition storage pos = positions[venue_position_id];
        if (!pos.is_open) revert PositionNotFound();
        pos.is_open = false;
        int256 realized = pos.last_attested_pnl;

        // Phase theta.1 funds-stranding fix: pre-fix the adapter held the
        // user's collateral indefinitely after close. Polymarket payout
        // returns to the adapter via Aqueduct CCIP from Polygon Amoy; once
        // settled it lands in the adapter's USDC balance. Sweep any
        // adapter-held USDC to Coffer on close so Coffer's share accounting
        // can resolve. For testnet scaffold the CCIP receiver stub settles
        // 0 and this is a no-op; realized PnL return is still authoritative.
        uint256 settled = IERC20(usdc).balanceOf(address(this));
        if (settled > 0) {
            bool ok = IERC20(usdc).transfer(atrium_coffer, settled);
            if (!ok) revert UsdcTransferFailed(atrium_coffer, settled);
        }

        emit PositionClosed(venue_position_id, realized);
        return realized;
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
            current_price_q64: pos.entry_price_q64, // Updated via attestation
            unrealized_pnl_signed: pos.last_attested_pnl,
            last_update_timestamp: pos.last_attestation_block
        });
    }

    function get_venue_health() external view returns (VenueHealth memory) {
        return VenueHealth({
            is_operational: polymarket_on_dest != address(0),
            last_heartbeat_block: uint64(block.number),
            quoted_spread_bps: 50, // Binary markets often have wider spreads
            status_message: polymarket_on_dest != address(0) ? "ok" : "no_dest_set"
        });
    }

    function get_haircut_bps(bytes32 i) external view returns (uint16) { return haircut_bps_[i]; }
    function get_initial_margin_bps(bytes32 i) external view returns (uint16) { return initial_margin_bps_[i]; }
    function get_maintenance_margin_bps(bytes32 i) external view returns (uint16) { return maintenance_margin_bps_[i]; }

    function attest_off_chain_state(bytes calldata signed_attestation) external returns (bool) {
        (
            uint256 venue_position_id,
            uint256 price_q64,
            int256 pnl,
            uint64 block_no,
            bytes32 attestation_hash,
            bytes[] memory sigs,
            address[] memory signers
        ) = abi.decode(signed_attestation, (uint256, uint256, int256, uint64, bytes32, bytes[], address[]));

        if (seen_attestations[attestation_hash]) revert DuplicateAttestation(attestation_hash);
        seen_attestations[attestation_hash] = true;

        // Audit FIRE76-4 fix: typehash now binds every load-bearing field.
        // Pre-fix, a signed attestation for position A with hash H could be
        // replayed against position B by the caller because the on-chain
        // digest only depended on H. Now the digest reflects the full
        // attestation contents — replay against any other position changes
        // every field and produces a different digest the validators
        // didn't sign.
        bytes32 structHash = keccak256(abi.encode(
            ATTESTATION_TYPEHASH,
            venue_position_id,
            positions[venue_position_id].instrument_id,
            price_q64,
            pnl,
            block_no,
            attestation_hash
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        // Audit G-4 fix: previously only checked is_validator on the address
        // array — a caller could pass any list of validators and clear quorum
        // without holding their keys. Now we recover each signature and
        // dedupe so a single validator can't double-vote, mirroring the
        // Hyperliquid pattern.
        if (sigs.length != signers.length) revert InsufficientSignatures(uint16(sigs.length), uint16(signers.length));
        uint16 valid = 0;
        address[] memory seen = new address[](signers.length);
        for (uint256 i = 0; i < signers.length; i++) {
            address claimed = signers[i];
            if (!is_validator[claimed]) continue;
            bytes memory sig = sigs[i];
            if (sig.length != 65) continue;
            bytes32 r; bytes32 s; uint8 v;
            assembly {
                r := mload(add(sig, 32))
                s := mload(add(sig, 64))
                v := byte(0, mload(add(sig, 96)))
            }
            address recovered = ecrecover(digest, v, r, s);
            // Audit CCC-1 fix: ecrecover returns address(0) on a malformed
            // signature. Same `address(0) == claimed` bypass as in
            // HyperliquidHybridAdapter. Explicit zero-check + the
            // setValidators zero-address guard below close both halves.
            if (recovered == address(0) || recovered != claimed) continue;
            bool dup = false;
            for (uint256 j = 0; j < i; j++) {
                if (seen[j] == claimed) { dup = true; break; }
            }
            if (dup) continue;
            seen[i] = claimed;
            valid++;
        }
        // Audit iteration 45 fix (defense in depth): the setValidators
        // bounds check makes `required_signatures == 0` unreachable via
        // Praetor action, but the CONSTRUCTOR leaves it at the default
        // uint16 zero until setValidators runs the first time. During
        // that bootstrap window (deploy → Praetor multisig sigs → 1st
        // setValidators), `valid < 0` is always false and any attestation
        // passes. Defensive bail: if no validator set is configured yet,
        // refuse every attestation.
        require(required_signatures > 0 && validators.length > 0, "validators not configured");
        if (valid < required_signatures) revert InsufficientSignatures(valid, required_signatures);

        VenuePosition storage pos = positions[venue_position_id];
        if (pos.entry_price_q64 == 0) pos.entry_price_q64 = price_q64;
        pos.last_attested_pnl = pnl;
        pos.last_attestation_block = block_no;
        emit AttestationAccepted(attestation_hash, msg.sender);
        return true;
    }

    function setDestination(address _polymarket_on_dest) external onlyPraetor {
        // Audit DDDDD-3 fix: emit the rotation event. The destination address
        // is where USDC ends up after CCIP delivery, so the change must be
        // observable on chain for ops dashboards.
        address previous = polymarket_on_dest;
        polymarket_on_dest = _polymarket_on_dest;
        emit DestinationUpdated(previous, _polymarket_on_dest);
    }

    function setValidators(address[] calldata new_validators, uint16 new_required) external onlyPraetor {
        // Audit iteration 45 fix (critical): bound new_required so a
        // multisig typo can't degrade quorum. Pre-fix:
        //   - new_required = 0 → `valid < 0` is always false (uint16) →
        //     ANY attestation passes with zero valid signatures →
        //     attacker forges Polymarket settlements freely.
        //   - new_required > new_validators.length → quorum impossible,
        //     adapter bricked, all open positions stuck.
        // Now: must satisfy `1 <= new_required <= len(new_validators)`.
        // The reject-at-input-time pattern mirrors CCC-1 / FIRE76-3.
        require(new_validators.length > 0, "empty validator set");
        require(new_required > 0, "zero required signatures");
        require(new_required <= new_validators.length, "required exceeds validator count");
        // Audit CCC-1 fix (defense in depth): reject address(0) at input
        // time. Combined with the explicit zero-check at the ecrecover site
        // in attest_off_chain_state, this closes the malformed-signature
        // bypass that pre-fix code allowed if address(0) ever made it into
        // is_validator via a Praetor multisig typo.
        for (uint256 i = 0; i < new_validators.length; i++) {
            require(new_validators[i] != address(0), "zero validator");
            // Audit FIRE76-3 fix (sub-agent MEDIUM): intra-array dedup. If
            // new_validators = [A, A, B] is submitted by a multisig signing
            // error, the `validators` array would store duplicates, and an
            // off-chain observer reading the array would mis-compute quorum
            // (e.g. seeing [A, A] with required=1 and assuming 2-of-2 when
            // it's actually 1-of-1 against one real key). Reject early.
            for (uint256 j = 0; j < i; j++) {
                require(new_validators[i] != new_validators[j], "duplicate validator");
            }
        }
        // Audit DDDDD-1 fix: clear the OLD validator set before flipping
        // the new one. Pre-fix only the new set was ORed in, so rotating
        // away a compromised validator left them with is_validator = true.
        // Mirror of HyperliquidHybridAdapter's setValidators pattern.
        for (uint256 i = 0; i < validators.length; i++) {
            is_validator[validators[i]] = false;
        }
        delete validators;
        for (uint256 i = 0; i < new_validators.length; i++) {
            is_validator[new_validators[i]] = true;
            validators.push(new_validators[i]);
        }
        required_signatures = new_required;
        // Audit DDDDD-2 fix: emit the rotation event so observers can
        // track the validator quorum lifecycle.
        emit ValidatorSetUpdated(new_validators, new_required);
    }

    function addInstrument(
        bytes32 instrument_id,
        uint16 _haircut_bps,
        uint16 _initial_margin_bps,
        uint16 _maintenance_margin_bps
    ) external onlyTimelock {
        if (!is_supported_instrument[instrument_id]) {
            is_supported_instrument[instrument_id] = true;
            supported_instruments_.push(instrument_id);
        }
        haircut_bps_[instrument_id] = _haircut_bps;
        initial_margin_bps_[instrument_id] = _initial_margin_bps;
        maintenance_margin_bps_[instrument_id] = _maintenance_margin_bps;
        emit InstrumentAdded(instrument_id, _haircut_bps, _initial_margin_bps, _maintenance_margin_bps);
    }
}
