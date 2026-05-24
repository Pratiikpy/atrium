// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IPorticoAdapter v1.0.0
/// @notice The open standard for Atrium venue adapters. Anyone can implement
///         this against any onchain venue and submit for Curator review.
///
///         Stable interface from Day 30. Major version bump (v2.0) breaks
///         compatibility and requires re-whitelisting per PRD §22.2 patch 6.
///
/// @dev    Hybrid adapters (Hyperliquid HIP-3 / HIP-4) extend with
///         `attest_off_chain_state` for venues whose state lives on a
///         non-EVM L1. See TDD §28.1 patch 7 for the architecture rationale.
interface IPorticoAdapter {
    // -------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------

    function name() external view returns (string memory);
    function version() external pure returns (uint256 major, uint256 minor, uint256 patch);
    function supportedInstruments() external view returns (bytes32[] memory);
    function isHybrid() external pure returns (bool);

    // -------------------------------------------------------------------
    // Position lifecycle
    // -------------------------------------------------------------------

    /// @notice Open a position on the underlying venue.
    /// @param instrument_id  keccak256 of the instrument symbol (e.g. "AAPL-USD-PERP")
    /// @param notional_signed  positive = long, negative = short, in venue's collateral units
    /// @param venue_payload  opaque blob the adapter forwards to the venue
    /// @return venue_position_id  the venue-side handle for this position
    function open_position(bytes32 instrument_id, int256 notional_signed, bytes calldata venue_payload)
        external
        returns (uint256 venue_position_id);

    function close_position(uint256 venue_position_id, bytes calldata venue_payload)
        external
        returns (int256 realized_pnl_signed);

    function modify_position(
        uint256 venue_position_id,
        int256 notional_delta_signed,
        bytes calldata venue_payload
    ) external returns (int256 realized_pnl_signed);

    // -------------------------------------------------------------------
    // Read venue state
    // -------------------------------------------------------------------

    struct PositionView {
        address owner;
        bytes32 instrument_id;
        int256 notional_signed;
        uint256 entry_price_q64;
        uint256 current_price_q64;
        int256 unrealized_pnl_signed;
        uint256 last_update_timestamp;
    }

    struct VenueHealth {
        bool is_operational;
        uint64 last_heartbeat_block;
        uint16 quoted_spread_bps;
        string status_message;
    }

    function get_position(uint256 venue_position_id) external view returns (PositionView memory);
    function get_venue_health() external view returns (VenueHealth memory);

    // -------------------------------------------------------------------
    // Risk parameters consumed by Plinth
    // -------------------------------------------------------------------

    function get_haircut_bps(bytes32 instrument_id) external view returns (uint16);
    function get_initial_margin_bps(bytes32 instrument_id) external view returns (uint16);
    function get_maintenance_margin_bps(bytes32 instrument_id) external view returns (uint16);

    // -------------------------------------------------------------------
    // Hybrid adapter extension (off-chain venue attestation)
    // -------------------------------------------------------------------

    /// @notice Submit a signed attestation of off-chain venue state.
    /// @dev Only hybrid adapters (`isHybrid() == true`) must implement non-trivially.
    /// @param signed_attestation  validator-signed blob per the venue's protocol
    /// @return valid  true if the attestation is accepted
    function attest_off_chain_state(bytes calldata signed_attestation) external returns (bool valid);

    // -------------------------------------------------------------------
    // Events emitted by every adapter
    // -------------------------------------------------------------------

    event PositionOpened(
        uint256 indexed venue_position_id,
        address indexed owner,
        bytes32 indexed instrument_id,
        int256 notional_signed
    );

    event PositionClosed(uint256 indexed venue_position_id, int256 realized_pnl_signed);

    event PositionModified(
        uint256 indexed venue_position_id,
        int256 notional_delta_signed,
        int256 realized_pnl_signed
    );

    event VenueHealthChanged(bool is_operational, string status_message);

    event AttestationAccepted(bytes32 indexed attestation_hash, address indexed attestor);
}
