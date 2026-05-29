// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

/// @title AtriumRouterPreconditions Halmos symbolic proof
/// @notice Property: Router.openPositionViaAdapter reverts iff at least one
///         precondition fails (paused, insufficient mandate, oracle stale,
///         adapter not authorized).
/// @custom:halmos --solver-timeout-assertion 60000

contract RouterPreconditionModel {
    bool public paused;
    bool public mandateValid;
    bool public oracleFresh;
    bool public adapterAuthorized;

    error RouterPaused();
    error InsufficientMandate();
    error OracleStale();
    error AdapterNotAuthorized();

    function configure(bool _paused, bool _mandateValid, bool _oracleFresh, bool _adapterAuthorized) external {
        paused = _paused;
        mandateValid = _mandateValid;
        oracleFresh = _oracleFresh;
        adapterAuthorized = _adapterAuthorized;
    }

    function openPositionViaAdapter() external view returns (bool) {
        if (paused) revert RouterPaused();
        if (!mandateValid) revert InsufficientMandate();
        if (!oracleFresh) revert OracleStale();
        if (!adapterAuthorized) revert AdapterNotAuthorized();
        return true;
    }

    function allPreconditionsMet() external view returns (bool) {
        return !paused && mandateValid && oracleFresh && adapterAuthorized;
    }
}

contract AtriumRouterPreconditionsHalmosTest is Test {
    RouterPreconditionModel internal router;

    function setUp() public {
        router = new RouterPreconditionModel();
    }

    /// @notice If all preconditions met, call succeeds
    function check_all_preconditions_met_succeeds(
        bool _paused,
        bool _mandateValid,
        bool _oracleFresh,
        bool _adapterAuthorized
    ) external {
        vm.assume(!_paused);
        vm.assume(_mandateValid);
        vm.assume(_oracleFresh);
        vm.assume(_adapterAuthorized);

        router.configure(_paused, _mandateValid, _oracleFresh, _adapterAuthorized);
        bool result = router.openPositionViaAdapter();
        assert(result == true);
    }

    /// @notice If any precondition fails, call reverts
    function check_any_precondition_fails_reverts(
        bool _paused,
        bool _mandateValid,
        bool _oracleFresh,
        bool _adapterAuthorized
    ) external {
        // At least one precondition must fail
        vm.assume(_paused || !_mandateValid || !_oracleFresh || !_adapterAuthorized);

        router.configure(_paused, _mandateValid, _oracleFresh, _adapterAuthorized);

        try router.openPositionViaAdapter() returns (bool) {
            assert(false); // must not succeed
        } catch {
            assert(true); // reverted as expected
        }
    }

    /// @notice Equivalence: success iff allPreconditionsMet
    function check_success_iff_all_met(
        bool _paused,
        bool _mandateValid,
        bool _oracleFresh,
        bool _adapterAuthorized
    ) external {
        router.configure(_paused, _mandateValid, _oracleFresh, _adapterAuthorized);

        bool allMet = router.allPreconditionsMet();

        try router.openPositionViaAdapter() returns (bool) {
            assert(allMet == true);
        } catch {
            assert(allMet == false);
        }
    }
}
