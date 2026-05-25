// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title LanternAttestor
/// @notice Hourly Merkle root publisher for Atrium proof-of-reserves.
///         The Lantern off-chain service signs and submits. Anyone can verify
///         their own balance via an inclusion proof from the IPFS-pinned tree.
contract LanternAttestor {
    address public signing_key;
    address public immutable praetor_multisig;
    address public immutable praetor_timelock;
    uint64 public latest_block;
    bytes32 public latest_root;

    /// @dev Audit TT-17 fix (Phase zeta.1, 2026-05-25): the prior event
    /// shape was (root, block_number, timestamp) only. The verify-app's
    /// inclusion-proof flow at /api/lantern/verify-inclusion needs to
    /// know which IPFS CID pins the corresponding Merkle tree, and the
    /// /api/lantern/latest dashboard needs the leaf count. Both fields
    /// are now carried in the event so the subgraph can index them
    /// without an extra Lantern-side service. Indexed root + leafCount;
    /// ipfsCid is not indexed (variable-length string would only store
    /// the keccak hash if indexed).
    event AttestationPublished(
        bytes32 indexed root,
        uint256 block_number,
        uint256 timestamp,
        uint256 indexed leafCount,
        string ipfsCid
    );
    event SigningKeyRotated(address indexed previous, address indexed next);

    error Unauthorized();
    error StaleAttestation(uint64 latest, uint64 attempted);

    constructor(address _signing_key, address _praetor, address _praetor_timelock) {
        // Audit BBBBB-1 fix (DDD-5 pattern, partial-coverage closer found by
        // the test-coverage sweep). Without these guards:
        // - _signing_key == 0 → publish() bricked until timelock rotates the
        //   key. Recoverable but a deploy-time foot-gun: the attestor service
        //   can't post a proof until governance acts.
        // - _praetor_timelock == 0 → rotateSigningKey() permanently bricked.
        //   The only path to update signing_key is through the timelock; if
        //   that's zero, msg.sender == address(0) is structurally impossible.
        //   This branch IS unrecoverable; fail loud at deploy.
        // - _praetor == 0 → multisig getter shows zero (UI-only impact) but
        //   still worth a deploy-time pin to catch the typo class.
        require(_signing_key != address(0), "zero signing key");
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        signing_key = _signing_key;
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
    }

    /// @notice Publish a new Merkle root. The signing_key sender is the
    ///         Lantern attestor service. The signature is verified off-chain
    ///         by validators reading the same root from the underlying
    ///         Scribe-indexed data.
    function publish(
        bytes32 root,
        uint256 block_number,
        uint256 leafCount,
        string calldata ipfsCid,
        bytes calldata /*signature*/
    ) external {
        if (msg.sender != signing_key) revert Unauthorized();
        if (uint64(block_number) <= latest_block) revert StaleAttestation(latest_block, uint64(block_number));
        latest_root = root;
        latest_block = uint64(block_number);
        emit AttestationPublished(root, block_number, block.timestamp, leafCount, ipfsCid);
    }

    /// @notice Rotate the signing key. Audit F-32 fix: key rotation is a
    /// parameter change → timelock-only.
    ///
    /// Audit iteration 43 fix: pre-fix this setter accepted any `next`
    /// address including `address(0)`. The constructor's BBBBB-1 guard
    /// explicitly checks `_signing_key != address(0)` (lines 22-39) and
    /// the comment names the recovery cost: "publish() bricked until
    /// timelock rotates the key" — but the rotate setter had the SAME
    /// risk without the SAME guard. A Praetor multisig scheduling a typo
    /// rotation to zero (and 3-of-5 signers approving without catching
    /// it) would land 48h later, brick publish() — `msg.sender` can never
    /// equal `address(0)` on EVM — and require another 48h timelock to
    /// recover. During that 96h window the attestor publishes nothing.
    /// Defense in depth: reject zero at the setter boundary too.
    error ZeroAddressKey();
    error NoOpRotation();
    function rotateSigningKey(address next) external {
        if (msg.sender != praetor_timelock) revert Unauthorized();
        if (next == address(0)) revert ZeroAddressKey();
        // No-op rotation wastes a timelock slot and a multisig signing
        // round. Reject so an operator who accidentally schedules a
        // rotation to the current key sees a loud error at execution
        // time instead of a silent successful no-op event.
        if (next == signing_key) revert NoOpRotation();
        emit SigningKeyRotated(signing_key, next);
        signing_key = next;
    }

    /// @notice Verify a Merkle inclusion proof against the latest root.
    /// @dev    Sorted-pair hashing per OpenZeppelin MerkleProof convention.
    ///
    /// Audit FIRE77-L1 fix (sub-agent HIGH — second-preimage attack):
    /// pre-fix, the verifier hashed the supplied `leaf` indistinguishably
    /// from an interior node. An attacker could submit a 32-byte interior-
    /// node hash as `leaf` plus the remaining ancestors as `proof`, and the
    /// verification would succeed against the same `latest_root` — letting
    /// them claim a balance they don't own. The OZ MerkleProof convention
    /// (`resources/openzeppelin-contracts/.../MerkleProof.sol:27-29`) requires
    /// leaves be **double-hashed** at the leaf-vs-node boundary so they
    /// cannot be confused with interior nodes. Domain-separate the leaf.
    function verifyInclusion(
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool) {
        // Double-hash the leaf to domain-separate from interior nodes.
        // The off-chain `services/lantern-attestor/src/merkle.ts` tree
        // builder must apply the same double-hash convention; without that
        // matching change a legitimate inclusion proof will not verify.
        bytes32 computed = keccak256(bytes.concat(leaf));
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 sibling = proof[i];
            if (computed < sibling) {
                computed = keccak256(abi.encodePacked(computed, sibling));
            } else {
                computed = keccak256(abi.encodePacked(sibling, computed));
            }
        }
        return computed == latest_root;
    }
}
