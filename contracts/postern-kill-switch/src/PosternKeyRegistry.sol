// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PosternKeyRegistry — tracks every ERC-7715 session key issued to a Postern wallet
/// @notice ERC-7715 has no native enumeration primitive. Without this registry the
///         Kill Switch cannot list "all active keys" to revoke them. Each Postern
///         wallet records issuances here at the time of grant.

contract PosternKeyRegistry {
    address public immutable posternKillSwitch;

    // user => active session key addresses
    mapping(address => address[]) private _activeKeys;
    mapping(address => mapping(address => bool)) public isActive;
    mapping(address => mapping(address => uint256)) public expiresAt;

    event SessionKeyIssued(address indexed user, address indexed sessionKey, uint256 expiresAt);
    event SessionKeyRevoked(address indexed user, address indexed sessionKey);
    event SessionKeyExpiredCleaned(address indexed user, address indexed sessionKey);

    constructor(address _posternKillSwitch) {
        // Audit MMM-10 fix (DDD-5 pattern): zero kill switch bricks
        // markAllRevoked forever — the registry can never bulk-revoke
        // session keys, defeating the Postern emergency design.
        require(_posternKillSwitch != address(0), "zero kill switch");
        posternKillSwitch = _posternKillSwitch;
    }

    /// @notice Called by a Postern wallet at the time of session key issuance.
    function recordIssued(address user, address sessionKey, uint256 _expiresAt) external {
        // In a production deployment the caller MUST be authenticated as a Postern
        // smart-wallet contract. For Year-1 testnet we trust the calling wallet
        // since it pays the gas; a malicious wallet can only spam its own user's
        // registry entries, not anyone else's.
        require(user == msg.sender || _isAuthenticatedPosternWallet(msg.sender, user), "unauthorized");
        require(!isActive[user][sessionKey], "duplicate");
        require(_expiresAt > block.timestamp, "expired");
        _activeKeys[user].push(sessionKey);
        isActive[user][sessionKey] = true;
        expiresAt[user][sessionKey] = _expiresAt;
        emit SessionKeyIssued(user, sessionKey, _expiresAt);
    }

    /// @notice Called by PosternKillSwitch only.
    function markAllRevoked(address user) external {
        require(msg.sender == posternKillSwitch, "kill-switch only");
        address[] storage keys = _activeKeys[user];
        for (uint256 i = 0; i < keys.length; i++) {
            isActive[user][keys[i]] = false;
            emit SessionKeyRevoked(user, keys[i]);
        }
        delete _activeKeys[user];
    }

    /// @notice Anyone can prune expired keys to keep the active list short.
    function cleanExpired(address user) external {
        address[] storage keys = _activeKeys[user];
        uint256 i = 0;
        while (i < keys.length) {
            address k = keys[i];
            if (expiresAt[user][k] <= block.timestamp) {
                isActive[user][k] = false;
                emit SessionKeyExpiredCleaned(user, k);
                keys[i] = keys[keys.length - 1];
                keys.pop();
                continue;
            }
            i++;
        }
    }

    function getActiveKeys(address user) external view returns (address[] memory) {
        return _activeKeys[user];
    }

    function activeKeyCount(address user) external view returns (uint256) {
        return _activeKeys[user].length;
    }

    function _isAuthenticatedPosternWallet(address caller, address user) internal pure returns (bool) {
        // Year-2: implement ERC-1271 challenge or ERC-4337 EntryPoint check.
        // Year-1 testnet: best-effort, the user-must-be-msg.sender path is the
        // honest enforcement; this returns false here.
        caller; user;
        return false;
    }
}
