// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ResearchAttestation
/// @notice On-chain commitment of off-chain backtest results. Per PRD §22.2
///         patch 6 and PRD §28.1 patch 4: numbers come from the actual
///         notebook output, never invented. Frontend reads via Scribe and
///         renders verbatim.
///
///         Audit F-32 fix: `publish` is a state-changing parameter-style call
///         gated by PraetorTimelock so the published number passes the 48h
///         community-veto window.
contract ResearchAttestation {
    address public immutable praetor_timelock;

    event BacktestPublished(
        bytes32 indexed ipfs_hash,
        uint256 trades_count,
        int256 collateral_delta_bps,
        uint256 timestamp_seconds,
        string notebook_url
    );

    error Unauthorized();
    error InvalidIpfsHash();

    constructor(address _praetor_timelock) {
        // Audit DDD-5 fix: zero timelock bricks the contract, only the
        // timelock can publish backtests; no attestation could ever land.
        require(_praetor_timelock != address(0), "zero timelock");
        praetor_timelock = _praetor_timelock;
    }

    function publish(
        bytes32 ipfs_hash,
        uint256 trades_count,
        int256 collateral_delta_bps,
        string calldata notebook_url
    ) external {
        if (msg.sender != praetor_timelock) revert Unauthorized();
        if (ipfs_hash == bytes32(0)) revert InvalidIpfsHash();
        emit BacktestPublished(ipfs_hash, trades_count, collateral_delta_bps, block.timestamp, notebook_url);
    }
}
