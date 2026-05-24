// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Edict
/// @notice Jurisdiction tier registry. Plinth + Coffer gate sensitive actions
///         behind a minimum tier. Tier assignment comes from a Sumsub sandbox
///         webhook (testnet) or the Praetor multisig (manual override).
///
/// Tier ladder:
///   Tier1 — default for any wallet, no KYC. Read-only + Verifier Mode.
///   Tier2 — email verified. Deposit + simple positions.
///   Tier3 — identity verified. All derivatives, all adapters.
///   Tier4 — institutional KYC. Reserved for venue partner integrations.
contract Edict {
    enum UserTier { Tier1, Tier2, Tier3, Tier4 }

    address public immutable praetor_multisig;
    address public immutable praetor_timelock;  // F-32 fix
    address public sumsubVerifier;

    mapping(address => UserTier) private _tier;
    mapping(address => uint64) public assigned_at;
    mapping(bytes32 => bool) private _processed_proofs;

    event TierAssigned(address indexed user, UserTier tier, uint64 timestamp, address indexed assigned_by);
    event SumsubVerifierUpdated(address indexed previous, address indexed next);

    error Unauthorized();
    error InvalidProof(bytes32 proof_hash);
    error ProofReplay(bytes32 proof_hash);
    error TierTooLow(UserTier required, UserTier actual);
    // Audit iteration 44: mirrors LanternAttestor.rotateSigningKey iter-43.
    // Constructor's LLL-1 fix already checks `_sumsubVerifier != address(0)`;
    // the setter had the same risk without the same guard.
    error ZeroAddressVerifier();
    error NoOpVerifierRotation();

    modifier onlyPraetor() {
        if (msg.sender != praetor_multisig) revert Unauthorized();
        _;
    }

    modifier onlyTimelock() {
        if (msg.sender != praetor_timelock) revert Unauthorized();
        _;
    }

    constructor(address _praetor, address _praetor_timelock, address _sumsubVerifier) {
        // Audit LLL-1 fix (DDD-5 pattern): zero-praetor → Unauthorized path
        // is always-taken so manual tier overrides are bricked; zero-timelock
        // → setSumsubVerifier is bricked so the sumsub key can never rotate;
        // zero-sumsub combined with either of the above leaves the registry
        // unable to assign tiers at all.
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        require(_sumsubVerifier != address(0), "zero sumsub verifier");
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
        sumsubVerifier = _sumsubVerifier;
    }

    function tierOf(address user) external view returns (UserTier) {
        return _tier[user];
    }

    function requireTier(address user, UserTier required) external view {
        if (uint8(_tier[user]) < uint8(required)) revert TierTooLow(required, _tier[user]);
    }

    /// @notice Assign a tier. Callable by Sumsub verifier or Praetor.
    /// @param proof Off-chain Sumsub verification result hash (single-use).
    function assignTier(address user, UserTier tier, bytes32 proof) external {
        if (msg.sender != sumsubVerifier && msg.sender != praetor_multisig) revert Unauthorized();
        // Sumsub-attested proofs must not be replayed; manual Praetor calls use proof=0 by convention.
        if (msg.sender == sumsubVerifier) {
            if (proof == bytes32(0)) revert InvalidProof(proof);
            if (_processed_proofs[proof]) revert ProofReplay(proof);
            _processed_proofs[proof] = true;
        }
        _tier[user] = tier;
        assigned_at[user] = uint64(block.timestamp);
        emit TierAssigned(user, tier, uint64(block.timestamp), msg.sender);
    }

    /// Parameter change → timelock-only (F-32 fix).
    ///
    /// Audit iteration 44 fix: mirrors LanternAttestor.rotateSigningKey
    /// iter-43. Constructor's LLL-1 check (line 49-51) explicitly guards
    /// `_sumsubVerifier != address(0)` because zero would disable the
    /// sumsub callback path in `assignTier` — `msg.sender == sumsubVerifier`
    /// becomes structurally impossible since msg.sender can never be
    /// address(0) on EVM. Pre-fix the setter accepted any address
    /// including zero, so a Praetor multisig accidentally scheduling a
    /// timelock to zero would: (1) wait 48h, (2) execute, (3) brick the
    /// sumsub path, (4) require another 48h timelock to recover. The
    /// recovery is by `praetor_multisig` (which is fine since that path
    /// stays open via the `||` in assignTier line 68), but during the
    /// 48h window every Sumsub callback would revert.
    function setSumsubVerifier(address next) external onlyTimelock {
        if (next == address(0)) revert ZeroAddressVerifier();
        // Same no-op-rotation lesson as iter-43: refuse to emit a
        // misleading event for a same-value assignment.
        if (next == sumsubVerifier) revert NoOpVerifierRotation();
        emit SumsubVerifierUpdated(sumsubVerifier, next);
        sumsubVerifier = next;
    }
}
