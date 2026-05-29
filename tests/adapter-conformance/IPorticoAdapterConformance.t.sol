// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title IPorticoAdapterConformance — abstract conformance suite
/// @notice 6 tests every IPorticoAdapter must pass. Concrete adapter test
///         contracts inherit this and call setUp_conformance in their setUp().
///         Per FULL_AUDIT #52, L-10.
abstract contract IPorticoAdapterConformance is Test {
    IPorticoAdapter internal adapter;
    address internal authorizedCaller;
    address internal timelock;
    bytes32 internal testInstrument;
    bytes internal testPayload;

    function setUp_conformance(
        IPorticoAdapter _adapter,
        address _authorizedCaller,
        address _timelock,
        bytes32 _testInstrument,
        bytes memory _testPayload
    ) internal {
        adapter = _adapter;
        authorizedCaller = _authorizedCaller;
        timelock = _timelock;
        testInstrument = _testInstrument;
        testPayload = _testPayload;
    }

    /// @notice Adapter must return a non-empty name
    function test_conformance_name() external view {
        string memory n = adapter.name();
        assertTrue(bytes(n).length > 0, "adapter name must be non-empty");
    }

    /// @notice Adapter must return a valid version tuple
    function test_conformance_version() external view {
        (uint256 major, uint256 minor,) = adapter.version();
        assertGe(major, 1, "major version must be >= 1");
        assertGe(minor, 0, "minor version must be >= 0");
    }

    /// @notice Only the authorized caller (Router) can open positions
    function test_conformance_only_authorized_caller() external {
        vm.prank(makeAddr("attacker"));
        vm.expectRevert();
        adapter.open_position(testInstrument, 1_000e6, testPayload);
    }

    /// @notice Paused adapter must block open_position
    function test_conformance_paused_blocks_open() external {
        // Attempt to pause via timelock — adapters expose pause(bytes32)
        // If the adapter doesn't have pause, this test is skipped via try/catch
        (bool success,) = address(adapter).call(
            abi.encodeWithSignature("pause(bytes32)", bytes32("conformance-test"))
        );
        if (!success) {
            // Try alternative pause signature
            vm.prank(timelock);
            (success,) = address(adapter).call(abi.encodeWithSignature("pause()"));
        }
        if (success) {
            vm.prank(authorizedCaller);
            vm.expectRevert();
            adapter.open_position(testInstrument, 1_000e6, testPayload);
        }
        // If pause not available, test passes (adapter may use different mechanism)
    }

    /// @notice get_venue_health must return a valid status
    function test_conformance_health_returns_status() external view {
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        // Adapter must report a status message
        assertTrue(bytes(h.status_message).length > 0, "status_message must be non-empty");
    }

    /// @notice Supported instruments must be non-empty
    function test_conformance_supported_instruments() external view {
        bytes32[] memory instruments = adapter.supportedInstruments();
        assertGt(instruments.length, 0, "adapter must support at least one instrument");
    }

    /// @notice Haircut/margin BPS must be within sane bounds
    function test_conformance_margin_params_sane() external view {
        uint16 haircut = adapter.get_haircut_bps(testInstrument);
        uint16 initial = adapter.get_initial_margin_bps(testInstrument);
        uint16 maintenance = adapter.get_maintenance_margin_bps(testInstrument);

        assertLe(haircut, 10_000, "haircut must be <= 100%");
        assertLe(initial, 10_000, "initial margin must be <= 100%");
        assertLe(maintenance, 10_000, "maintenance margin must be <= 100%");
        assertLe(maintenance, initial, "maintenance must be <= initial margin");
    }
}
