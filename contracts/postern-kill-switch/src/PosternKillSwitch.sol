// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PosternKillSwitch, one-tap revoke for all Sigil mandates + Postern session keys
/// @notice Postern (PRD §4.18 + TDD §7.4). Enables a user to revoke every active
///         delegation in a single batched UserOp. Required for trust UX: agents
///         and session keys are powerful, the kill switch makes them safe.

import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

interface ISigil {
    /// @notice Per Agent F audit MUST-FIX #2: the Kill Switch must revoke
    ///         mandates on behalf of the user, not by writing the kill switch
    ///         contract's own address into Sigil's revocation map. The
    ///         `revokeAllOnBehalfOf` entry-point binds the bump to `owner`.
    function revokeAllOnBehalfOf(address owner, address agent) external;
}

interface IPosternKeyRegistry {
    function getActiveKeys(address user) external view returns (address[] memory);
    function markAllRevoked(address user) external;
}

contract PosternKillSwitch {
    ISigil public immutable sigil;
    IEntryPoint public immutable entryPoint;
    IPosternKeyRegistry public immutable keyRegistry;

    event KillSwitchActivated(
        address indexed user,
        uint256 sigil_agents_revoked,
        uint256 session_keys_cancelled,
        uint256 timestamp
    );

    /// Audit MMM-6 fix: per-agent failure surface during a kill-switch run.
    /// Pre-fix, a single failing `sigil.revokeAllOnBehalfOf` reverted the
    /// whole activate() call and the user's session keys were NOT cancelled.
    /// The kill switch must always reach the registry step even if Sigil
    /// rejects individual agents.
    event SigilRevokeSkipped(address indexed user, address indexed agent, bytes reason);

    constructor(address _sigil, address _entryPoint, address _keyRegistry) {
        // Audit MMM-10 fix (DDD-5 pattern): all three deps must be non-zero.
        // Zero sigil → every per-agent try/catch in activate() catches the
        // extcodesize-zero revert + emits SigilRevokeSkipped → user thinks 0
        // mandates revoked because Sigil isn't wired (honest, but worth
        // failing at deploy time so this never reaches users). Zero
        // keyRegistry → markAllRevoked try/catch swallows the same → no
        // session-key revocation. Zero entryPoint → unused in activate but
        // breaks any future 4337 integration. Fail loud at deploy.
        require(_sigil != address(0), "zero sigil");
        require(_entryPoint != address(0), "zero entry point");
        require(_keyRegistry != address(0), "zero key registry");
        sigil = ISigil(_sigil);
        entryPoint = IEntryPoint(_entryPoint);
        keyRegistry = IPosternKeyRegistry(_keyRegistry);
    }

    /// @notice The single button on the UI. Caller revokes every active delegation
    ///         tied to their address in one tx.
    function activate(address[] calldata agents_to_revoke) external {
        address user = msg.sender;

        // Revoke every Sigil mandate the user has issued.
        // Audit fix (Agent F MUST-FIX #2): use revokeAllOnBehalfOf so the
        // revocation nonce bump is recorded against the user, not against the
        // Kill Switch contract's own address.
        //
        // Audit MMM-6 fix: wrap each per-agent revoke in try/catch. The kill
        // switch is the emergency button, a single agent that reverts (Sigil
        // paused / agent already revoked in a stale nonce / future Sigil
        // upgrade quirk) must NOT prevent the user from revoking their
        // session keys via the registry step below. Counting + emitting
        // SigilRevokeSkipped surfaces the partial failures for operators.
        uint256 agents_revoked = 0;
        for (uint256 i = 0; i < agents_to_revoke.length; i++) {
            try sigil.revokeAllOnBehalfOf(user, agents_to_revoke[i]) {
                agents_revoked++;
            } catch (bytes memory reason) {
                emit SigilRevokeSkipped(user, agents_to_revoke[i], reason);
            }
        }

        // Cancel every active Postern session key for this user.
        // Audit MMM-6: also guard the registry call. If markAllRevoked
        // reverts (e.g. unbounded loop OOG on a hostile-spam'd registry),
        // the user is still better off than reverting the whole activate -
        // at least their Sigil mandates landed.
        address[] memory keys = keyRegistry.getActiveKeys(user);
        uint256 keys_cancelled = keys.length;
        try keyRegistry.markAllRevoked(user) {
            // success, keys_cancelled is accurate
        } catch {
            keys_cancelled = 0;
        }

        emit KillSwitchActivated(user, agents_revoked, keys_cancelled, block.timestamp);
    }
}
