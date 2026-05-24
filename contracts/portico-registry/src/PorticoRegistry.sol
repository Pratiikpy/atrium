// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "./IPorticoAdapter.sol";

/// @title PorticoRegistry — whitelist + version pinning for IPorticoAdapter implementations
/// @notice Adapter bytecode is checked against an immutable expected hash at
///         whitelist time. Upgrade = re-whitelist with 3-reviewer Curator approval.
contract PorticoRegistry {
    /// `praetor_multisig` is intentionally read-only via the auto-generated
    /// `public` getter: UI dashboards (verify.atrium.fi) query it directly to
    /// display the current Praetor identity. All admin paths inside this
    /// contract go through `praetor_timelock`, never the multisig.
    address public immutable praetor_multisig;
    address public immutable praetor_timelock;  // F-32 fix

    struct AdapterRecord {
        address adapter;
        uint8 venue_id;
        bytes32 expected_bytecode_hash;
        uint256 major_version;
        bool is_active;
        uint64 whitelisted_at;
    }

    mapping(uint8 => AdapterRecord) public adapters_by_venue;
    mapping(address => bool) public is_registered;
    mapping(uint8 => bool) public venue_seen;
    uint8[] public active_venue_ids;

    event AdapterRegistered(uint8 indexed venue_id, address indexed adapter, uint256 major_version);
    event AdapterDeregistered(uint8 indexed venue_id, address indexed adapter);

    error Unauthorized();
    error BytecodeMismatch(bytes32 expected, bytes32 actual);
    error VersionMismatch(uint256 expected, uint256 actual);
    error VenueAlreadyRegistered(uint8 venue_id);

    constructor(address _praetor, address _praetor_timelock) {
        // Audit DDD-5 fix: both addresses non-zero or the registry can never
        // register/deregister adapters again.
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
    }

    /// Adapter registration is a parameter change → timelock-only (F-32 fix).
    /// 3-reviewer Curator approval still happens off-chain before the
    /// multisig schedules; the timelock then enforces the 48h community veto.
    function registerAdapter(
        uint8 venue_id,
        address adapter,
        bytes32 expected_bytecode_hash,
        uint256 expected_major_version
    ) external {
        if (msg.sender != praetor_timelock) revert Unauthorized();

        // Verify bytecode matches the hash approved by Curator review
        bytes32 actual_bytecode_hash = adapter.codehash;
        if (actual_bytecode_hash != expected_bytecode_hash) {
            revert BytecodeMismatch(expected_bytecode_hash, actual_bytecode_hash);
        }

        // Verify the adapter reports the expected major version
        (uint256 major, , ) = IPorticoAdapter(adapter).version();
        if (major != expected_major_version) {
            revert VersionMismatch(expected_major_version, major);
        }

        if (venue_seen[venue_id] && adapters_by_venue[venue_id].is_active) {
            revert VenueAlreadyRegistered(venue_id);
        }

        adapters_by_venue[venue_id] = AdapterRecord({
            adapter: adapter,
            venue_id: venue_id,
            expected_bytecode_hash: expected_bytecode_hash,
            major_version: expected_major_version,
            is_active: true,
            whitelisted_at: uint64(block.timestamp)
        });
        is_registered[adapter] = true;
        if (!venue_seen[venue_id]) {
            venue_seen[venue_id] = true;
            active_venue_ids.push(venue_id);
        }
        emit AdapterRegistered(venue_id, adapter, expected_major_version);
    }

    /// Deregistration is also a parameter change → timelock-only.
    function deregisterAdapter(uint8 venue_id) external {
        if (msg.sender != praetor_timelock) revert Unauthorized();
        AdapterRecord storage rec = adapters_by_venue[venue_id];
        rec.is_active = false;
        is_registered[rec.adapter] = false;
        emit AdapterDeregistered(venue_id, rec.adapter);
    }

    /// Audit FIRE77-PR5 fix (sub-agent HIGH): emergency-deregister path.
    /// Pre-fix, deregistering a known-vulnerable adapter required the 48h
    /// timelock window, during which Coffer's 1%-per-block notional cap
    /// (`security.md`) was the only defense. For a live exploit this is
    /// too slow. Praetor multisig can now deregister in one tx — no upgrade
    /// power, just delisting. The path emits a distinct event so operators
    /// + the subgraph can flag emergency actions vs routine timelock ones.
    /// Mirror of the emergency-pause pattern in `Aqueduct.pause`.
    event AdapterEmergencyDeregistered(uint8 indexed venue_id, address indexed adapter, string reason);

    function emergencyDeregisterAdapter(uint8 venue_id, string calldata reason) external {
        if (msg.sender != praetor_multisig) revert Unauthorized();
        AdapterRecord storage rec = adapters_by_venue[venue_id];
        rec.is_active = false;
        is_registered[rec.adapter] = false;
        emit AdapterEmergencyDeregistered(venue_id, rec.adapter, reason);
    }

    function isRegisteredAdapter(address adapter) external view returns (bool) {
        return is_registered[adapter];
    }

    function getAdapter(uint8 venue_id) external view returns (address) {
        return adapters_by_venue[venue_id].adapter;
    }

    function listActiveVenues() external view returns (uint8[] memory) {
        return active_venue_ids;
    }
}
