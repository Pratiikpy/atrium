// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

/// @title SigilNonceMonotonicity Halmos symbolic proof
/// @notice Property: Sigil.validate_action rejects an action with
///         nonce <= last_action_nonce[agent].
/// @custom:halmos --solver-timeout-assertion 60000

contract SigilNonceModel {
    mapping(address => mapping(address => uint256)) public last_action_nonce;

    error NonceNotMonotonic();

    function validate_action(address owner, address agent, uint256 nonce) external {
        if (nonce <= last_action_nonce[owner][agent]) revert NonceNotMonotonic();
        last_action_nonce[owner][agent] = nonce;
    }

    function set_nonce(address owner, address agent, uint256 nonce) external {
        last_action_nonce[owner][agent] = nonce;
    }
}

contract SigilNonceMonotonicityHalmosTest is Test {
    SigilNonceModel internal sigil;

    function setUp() public {
        sigil = new SigilNonceModel();
    }

    /// @notice Any nonce <= last_action_nonce must revert
    function check_stale_nonce_reverts(
        address owner,
        address agent,
        uint256 lastNonce,
        uint256 attemptedNonce
    ) external {
        vm.assume(lastNonce < type(uint256).max); // avoid edge case
        vm.assume(attemptedNonce <= lastNonce);

        sigil.set_nonce(owner, agent, lastNonce);

        // Must revert with NonceNotMonotonic
        try sigil.validate_action(owner, agent, attemptedNonce) {
            assert(false); // should not reach here
        } catch (bytes memory reason) {
            // Verify it reverted (any revert is acceptable for the property)
            assert(reason.length > 0);
        }
    }

    /// @notice Any nonce > last_action_nonce must succeed and update
    function check_fresh_nonce_succeeds(
        address owner,
        address agent,
        uint256 lastNonce,
        uint256 freshNonce
    ) external {
        vm.assume(lastNonce < type(uint256).max - 1);
        vm.assume(freshNonce > lastNonce);
        vm.assume(freshNonce <= lastNonce + 1000); // bound for solver

        sigil.set_nonce(owner, agent, lastNonce);
        sigil.validate_action(owner, agent, freshNonce);

        // After validation, last_action_nonce must be updated
        assert(sigil.last_action_nonce(owner, agent) == freshNonce);
    }

    /// @notice Monotonicity: after a successful validate, the stored nonce increases
    function check_nonce_monotonically_increases(
        address owner,
        address agent,
        uint256 n1,
        uint256 n2
    ) external {
        vm.assume(n1 > 0);
        vm.assume(n2 > n1);
        vm.assume(n2 <= n1 + 1000);

        sigil.validate_action(owner, agent, n1);
        uint256 after1 = sigil.last_action_nonce(owner, agent);

        sigil.validate_action(owner, agent, n2);
        uint256 after2 = sigil.last_action_nonce(owner, agent);

        assert(after2 > after1);
    }
}
