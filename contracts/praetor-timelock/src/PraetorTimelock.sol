// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PraetorTimelock
/// @notice 48-hour timelock between schedule and execute. Emergency pause
///         is instant (no timelock) but pause-only. Per PRD §7.10 and TDD §13.4.
///
/// @dev    Designed to sit behind a Gnosis Safe 3-of-5 multisig. The Safe
///         calls `schedule`, waits 48h, then calls `execute`. No single key
///         path anywhere.
interface IPausable {
    /// Audit-fix 2026-05-24 (Auditor A C-5): was `pause(string)`.
    /// Coffer + Plinth (Stylus) export `pause(bytes32)`. The mismatching
    /// selectors meant emergencyPause silently passed selector `0x6da66355`
    /// while Stylus contracts dispatched on `0xed56531a`, so every
    /// emergency-pause attempt reverted at the target. Sigil and Vigil now
    /// also expose `pause(bytes32)` after the same audit (see
    /// `contracts/{sigil,vigil}/src/lib.rs`). The reason argument is the
    /// keccak256 of a human-readable code; off-chain decoders map the
    /// digest back to the message.
    function pause(bytes32 reason) external;
}

contract PraetorTimelock {
    address public immutable multisig;
    uint64 public constant TIMELOCK_DURATION = 48 hours;

    mapping(bytes32 => uint64) public scheduledAt;
    mapping(bytes32 => bool) public executed;

    event Scheduled(bytes32 indexed id, address indexed target, bytes data, uint64 scheduled_at);
    event Executed(bytes32 indexed id, address indexed target, bytes data);
    event Cancelled(bytes32 indexed id);
    event EmergencyPaused(address indexed target, string reason);

    error Unauthorized();
    error AlreadyScheduled(bytes32 id);
    error NotScheduled(bytes32 id);
    error AlreadyExecuted(bytes32 id);
    error TimelockNotExpired(uint64 ready_at, uint64 now_seconds);
    error CallFailed(bytes return_data);
    /// Audit LLL-4 / LLL-5 fix: low-level `target.call(...)` and interface
    /// calls to EOA targets succeed silently with empty returndata. A
    /// multisig typo pointing at a founder wallet would otherwise mark
    /// the operation `executed=true` and emit the success event without
    /// any state change. Revert when the target has no bytecode.
    error TargetNotAContract(address target);

    modifier onlyMultisig() {
        if (msg.sender != multisig) revert Unauthorized();
        _;
    }

    constructor(address _multisig) {
        // Audit DDD-5 fix: zero-address multisig would brick the timelock —
        // no onlyMultisig call could ever succeed. Deploy-script-typo guard.
        require(_multisig != address(0), "zero multisig");
        multisig = _multisig;
    }

    function schedule(address target, bytes calldata data) external onlyMultisig returns (bytes32 id) {
        id = keccak256(abi.encode(target, data, block.timestamp));
        if (scheduledAt[id] != 0) revert AlreadyScheduled(id);
        scheduledAt[id] = uint64(block.timestamp);
        emit Scheduled(id, target, data, uint64(block.timestamp));
    }

    function execute(address target, bytes calldata data, uint64 scheduled_timestamp)
        external
        onlyMultisig
        returns (bytes memory return_data)
    {
        bytes32 id = keccak256(abi.encode(target, data, uint256(scheduled_timestamp)));
        if (scheduledAt[id] == 0) revert NotScheduled(id);
        if (executed[id]) revert AlreadyExecuted(id);
        uint64 ready_at = scheduled_timestamp + TIMELOCK_DURATION;
        if (block.timestamp < ready_at) revert TimelockNotExpired(ready_at, uint64(block.timestamp));

        // Audit LLL-4 fix: low-level call on EOA returns (true, "") — without
        // this check, a typo'd target would emit Executed and flip executed[]
        // without changing any state.
        if (target.code.length == 0) revert TargetNotAContract(target);
        executed[id] = true;
        (bool ok, bytes memory ret) = target.call(data);
        if (!ok) revert CallFailed(ret);
        emit Executed(id, target, data);
        return ret;
    }

    function cancel(bytes32 id) external onlyMultisig {
        if (scheduledAt[id] == 0) revert NotScheduled(id);
        // Audit FIRE77-PT2 fix (sub-agent MEDIUM): post-execute cancel was
        // silently accepted, leaving a misleading audit trail with both
        // `Executed` and `Cancelled` events on the same id. Reject the
        // post-execute case explicitly.
        if (executed[id]) revert AlreadyExecuted(id);
        delete scheduledAt[id];
        emit Cancelled(id);
    }

    /// @notice Instant pause. No timelock. Pause-only, cannot upgrade or change state.
    /// @param reason Free-text reason from the multisig. Hashed to bytes32 to match
    ///        the Stylus contracts' `pause(bytes32)` selector. Off-chain decoders
    ///        match the digest against a published reason-code catalog.
    function emergencyPause(address target, string calldata reason) external onlyMultisig {
        // Audit LLL-5 fix: void interface call to EOA returns (true, "")
        // without revert. Without this check a typo'd target would emit the
        // EmergencyPaused event suggesting the subsystem is paused when it is
        // not. Operators acting on the event would miss a real incident.
        if (target.code.length == 0) revert TargetNotAContract(target);
        IPausable(target).pause(keccak256(bytes(reason)));
        emit EmergencyPaused(target, reason);
    }
}
