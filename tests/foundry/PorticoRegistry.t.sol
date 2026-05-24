// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {PorticoRegistry} from "../../contracts/portico-registry/src/PorticoRegistry.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title PorticoRegistry foundry test suite
/// @notice Verifies that adapter whitelist is timelock-gated (audit F-32),
///         bytecode-hash pinned, and venue-conflict-rejecting.
contract PorticoRegistryTest is Test {
    PorticoRegistry internal registry;
    address internal praetor;
    address internal timelock;
    address internal hostile;
    MockAdapter internal adapter;

    function setUp() public {
        praetor = makeAddr("praetor");
        timelock = makeAddr("timelock");
        hostile = makeAddr("hostile");
        registry = new PorticoRegistry(praetor, timelock);
        adapter = new MockAdapter();
    }

    function test_registerAdapter_rejectsNonTimelock() public {
        bytes32 codehash = address(adapter).codehash;
        vm.prank(praetor);
        vm.expectRevert(PorticoRegistry.Unauthorized.selector);
        registry.registerAdapter(1, address(adapter), codehash, 1);

        vm.prank(hostile);
        vm.expectRevert(PorticoRegistry.Unauthorized.selector);
        registry.registerAdapter(1, address(adapter), codehash, 1);
    }

    function test_registerAdapter_happyPath() public {
        bytes32 codehash = address(adapter).codehash;
        vm.prank(timelock);
        registry.registerAdapter(1, address(adapter), codehash, 1);

        assertEq(registry.getAdapter(1), address(adapter));
        assertTrue(registry.isRegisteredAdapter(address(adapter)));
    }

    function test_registerAdapter_revertsOnBytecodeMismatch() public {
        bytes32 wrongHash = keccak256("not the real bytecode");
        vm.prank(timelock);
        vm.expectRevert(
            abi.encodeWithSelector(
                PorticoRegistry.BytecodeMismatch.selector,
                wrongHash,
                address(adapter).codehash
            )
        );
        registry.registerAdapter(1, address(adapter), wrongHash, 1);
    }

    function test_registerAdapter_revertsOnVersionMismatch() public {
        bytes32 codehash = address(adapter).codehash;
        vm.prank(timelock);
        vm.expectRevert(
            abi.encodeWithSelector(PorticoRegistry.VersionMismatch.selector, uint256(2), uint256(1))
        );
        registry.registerAdapter(1, address(adapter), codehash, 2);
    }

    function test_registerAdapter_revertsOnVenueCollision() public {
        bytes32 codehash = address(adapter).codehash;
        MockAdapter adapter2 = new MockAdapter();
        bytes32 codehash2 = address(adapter2).codehash;

        vm.prank(timelock);
        registry.registerAdapter(1, address(adapter), codehash, 1);

        vm.prank(timelock);
        vm.expectRevert(abi.encodeWithSelector(PorticoRegistry.VenueAlreadyRegistered.selector, uint8(1)));
        registry.registerAdapter(1, address(adapter2), codehash2, 1);
    }

    function test_deregisterAdapter_onlyTimelock() public {
        bytes32 codehash = address(adapter).codehash;
        vm.prank(timelock);
        registry.registerAdapter(1, address(adapter), codehash, 1);

        vm.prank(praetor);
        vm.expectRevert(PorticoRegistry.Unauthorized.selector);
        registry.deregisterAdapter(1);

        vm.prank(timelock);
        registry.deregisterAdapter(1);
        // After deregister the slot's adapter address should still be readable;
        // is_active flips to false. Verify via isRegisteredAdapter mapping.
        assertFalse(registry.isRegisteredAdapter(address(adapter)));
    }

    /// Iter 88: pin AdapterDeregistered event emission on the routine
    /// deregister path. Subgraph mappings read this event for ops
    /// dashboards (per `subgraph/src/portico_registry.ts`); a dropped
    /// emit would silently desync. The emergencyDeregister event was
    /// pinned in iter 55; this is the symmetric routine-deregister test.
    event AdapterDeregistered(uint8 indexed venue_id, address indexed adapter);

    function test_deregisterAdapter_emitsEvent_iter88() public {
        bytes32 codehash = address(adapter).codehash;
        vm.prank(timelock);
        registry.registerAdapter(1, address(adapter), codehash, 1);

        vm.expectEmit(true, true, false, false, address(registry));
        emit AdapterDeregistered(1, address(adapter));

        vm.prank(timelock);
        registry.deregisterAdapter(1);
    }

    /// Iter 88: pin the documented no-op behavior of deregistering an
    /// unregistered venue. The function reads default-init record (zero
    /// adapter), flips already-false flags, and emits with
    /// adapter=address(0). The subgraph treats a zero-adapter
    /// deregister event as a no-op, but pinning the behavior here
    /// forces a deliberate refactor — if a future contributor adds a
    /// "must be registered first" guard, this test fails and they
    /// must update the subgraph mapping in lockstep.
    function test_deregisterAdapter_neverRegisteredVenue_isNoOp_iter88() public {
        // Venue 42 was never registered. Deregister should:
        //  - NOT revert (current spec)
        //  - Emit AdapterDeregistered(42, address(0))
        //  - Leave isRegisteredAdapter(address(0)) as-is (false)
        vm.expectEmit(true, true, false, false, address(registry));
        emit AdapterDeregistered(42, address(0));

        vm.prank(timelock);
        registry.deregisterAdapter(42);
        assertFalse(registry.isRegisteredAdapter(address(0)));
    }

    function test_listActiveVenues_returnsRegisteredVenues() public {
        bytes32 codehash = address(adapter).codehash;
        MockAdapter adapter2 = new MockAdapter();
        bytes32 codehash2 = address(adapter2).codehash;

        vm.prank(timelock);
        registry.registerAdapter(1, address(adapter), codehash, 1);

        vm.prank(timelock);
        registry.registerAdapter(2, address(adapter2), codehash2, 1);

        uint8[] memory venues = registry.listActiveVenues();
        assertEq(venues.length, 2);
    }

    // ── Audit DDD-5 lock: constructor zero-checks ────────────────────
    //
    // Per DDD-5: both addresses non-zero or the registry can never be
    // controlled — onlyTimelock setters revert forever, onlyPraetor
    // emergency-deregister path bricked.

    function test_constructor_revertsOnZeroPraetor_DDD5() public {
        vm.expectRevert(bytes("zero praetor"));
        new PorticoRegistry(address(0), timelock);
    }

    function test_constructor_revertsOnZeroTimelock_DDD5() public {
        vm.expectRevert(bytes("zero timelock"));
        new PorticoRegistry(praetor, address(0));
    }

    // ── State-machine: re-register after deregister ──────────────────
    //
    // Pin the upgrade-via-redeploy path described in the contract header
    // ("Adapter bytecode is checked against an immutable expected hash at
    // whitelist time. Upgrade = re-whitelist with 3-reviewer Curator
    // approval."). The flow: register v1 → deregister → register v2 at the
    // same venue_id with new bytecode. The `is_active` flag flips false on
    // deregister, so the VenueAlreadyRegistered guard does NOT trigger.

    // ── Audit FIRE77-PR5 lock: emergency-deregister path (iter 55) ─────
    //
    // Per FIRE77-PR5, the registry has a SEPARATE delist path that bypasses
    // the 48h timelock. The motivation: when a live exploit is found in an
    // adapter, waiting 48h is too slow — Coffer's 1%-per-block notional cap
    // is the only defense in the interim. Praetor multisig can deregister
    // in one tx via `emergencyDeregisterAdapter`. The function had zero
    // tests before iter 55 even though it can be invoked under the most
    // adverse conditions (live exploit, 3-of-5 keys signing in haste).
    //
    // Coverage required:
    // - Praetor-only auth (timelock + random caller both rejected)
    // - Happy path: emits AdapterEmergencyDeregistered with the reason
    //   string, flips is_active false, clears is_registered mapping.
    // - Distinct event channel from routine deregisterAdapter so the
    //   subgraph + ops dashboards can flag emergency actions.
    // - State recovery: after emergency deregister, the venue_id can be
    //   re-registered through the normal timelock flow.

    event AdapterEmergencyDeregistered(uint8 indexed venue_id, address indexed adapter, string reason);

    function test_emergencyDeregisterAdapter_rejectsTimelock_iter55() public {
        bytes32 codehash = address(adapter).codehash;
        vm.prank(timelock);
        registry.registerAdapter(1, address(adapter), codehash, 1);

        // Timelock is rejected — emergency path is praetor-only. This is
        // intentional asymmetry from `deregisterAdapter`: the timelock CAN
        // routine-deregister but CANNOT emergency-deregister, because the
        // emergency path's premise is that the timelock is too slow.
        vm.prank(timelock);
        vm.expectRevert(PorticoRegistry.Unauthorized.selector);
        registry.emergencyDeregisterAdapter(1, "fake-emergency");
    }

    function test_emergencyDeregisterAdapter_rejectsHostile_iter55() public {
        bytes32 codehash = address(adapter).codehash;
        vm.prank(timelock);
        registry.registerAdapter(1, address(adapter), codehash, 1);

        vm.prank(hostile);
        vm.expectRevert(PorticoRegistry.Unauthorized.selector);
        registry.emergencyDeregisterAdapter(1, "totally-legit");
    }

    function test_emergencyDeregisterAdapter_happyPath_emitsAndDelists_iter55() public {
        bytes32 codehash = address(adapter).codehash;
        vm.prank(timelock);
        registry.registerAdapter(1, address(adapter), codehash, 1);

        // Pre-state sanity.
        assertTrue(registry.isRegisteredAdapter(address(adapter)), "pre: adapter must be registered");

        // The distinct event channel is the load-bearing piece. The subgraph
        // listens for AdapterEmergencyDeregistered separately from
        // AdapterDeregistered so the ops dashboard can flag emergencies.
        vm.expectEmit(true, true, false, true, address(registry));
        emit AdapterEmergencyDeregistered(1, address(adapter), "exploit-discovered");

        vm.prank(praetor);
        registry.emergencyDeregisterAdapter(1, "exploit-discovered");

        // Both state flags flip — Coffer's `is_registered` check now refuses
        // routes through this adapter even before the next block.
        assertFalse(
            registry.isRegisteredAdapter(address(adapter)),
            "iter55: emergency deregister must clear is_registered"
        );
    }

    function test_emergencyDeregisterAdapter_allowsReRegisterAtSameVenue_iter55() public {
        // Recovery path after emergency: same venue_id can be re-registered
        // through the normal timelock flow with a NEW adapter. Without this,
        // an emergency deregister would permanently brick the venue slot.
        bytes32 codehash = address(adapter).codehash;
        vm.prank(timelock);
        registry.registerAdapter(1, address(adapter), codehash, 1);

        vm.prank(praetor);
        registry.emergencyDeregisterAdapter(1, "vulnerable-adapter");

        // Patched adapter: fresh deploy = new address + new codehash.
        MockAdapter adapterPatched = new MockAdapter();
        bytes32 codehashPatched = address(adapterPatched).codehash;

        vm.prank(timelock);
        registry.registerAdapter(1, address(adapterPatched), codehashPatched, 1);

        assertEq(
            registry.getAdapter(1),
            address(adapterPatched),
            "iter55: venue must re-register cleanly after emergency deregister"
        );
        assertTrue(registry.isRegisteredAdapter(address(adapterPatched)));
        assertFalse(registry.isRegisteredAdapter(address(adapter)), "vulnerable adapter stays delisted");
    }

    function test_registerAdapter_reusesVenueIdAfterDeregister() public {
        bytes32 codehashV1 = address(adapter).codehash;
        vm.prank(timelock);
        registry.registerAdapter(1, address(adapter), codehashV1, 1);

        // Deregister v1.
        vm.prank(timelock);
        registry.deregisterAdapter(1);
        assertFalse(registry.isRegisteredAdapter(address(adapter)));

        // Deploy v2 with different bytecode (MockAdapter has the same code
        // for a fresh deploy, but a new instance has a different address
        // and may have a different codehash if CREATE2 salt differs — for
        // this test, simulate an upgrade by deploying a fresh adapter.
        // Real upgrade: new contract with new bytecode, e.g. MockAdapter v2.
        MockAdapter adapterV2 = new MockAdapter();
        bytes32 codehashV2 = address(adapterV2).codehash;

        vm.prank(timelock);
        registry.registerAdapter(1, address(adapterV2), codehashV2, 1);

        // The new adapter is now the active one for venue 1.
        assertEq(registry.getAdapter(1), address(adapterV2), "venue 1 must point to v2 after re-registration");
        assertTrue(registry.isRegisteredAdapter(address(adapterV2)));
        // Old adapter remains deregistered.
        assertFalse(registry.isRegisteredAdapter(address(adapter)), "v1 must remain deregistered");

        // The active_venue_ids list must NOT have grown (venue_seen[1] was
        // already true so the second register doesn't push again). Without
        // this guard the list would grow unboundedly on each upgrade.
        uint8[] memory venues = registry.listActiveVenues();
        assertEq(venues.length, 1, "active_venue_ids must not duplicate venue 1 after re-register");
    }
}

/// Minimal IPorticoAdapter implementation. Audit U-10 fix: implements every
/// method on the IPorticoAdapter interface (name/version/isHybrid/
/// supportedInstruments/open/close/modify/get_position/get_venue_health/
/// haircut+margin getters/attest_off_chain_state). The previous version was
/// missing get_venue_health and the margin getters, so Solidity required
/// `abstract` and the build refused to compile.
contract MockAdapter is IPorticoAdapter {
    function name() external pure returns (string memory) { return "Mock"; }
    function version() external pure returns (uint256, uint256, uint256) { return (1, 0, 0); }
    function isHybrid() external pure returns (bool) { return false; }
    function supportedInstruments() external pure returns (bytes32[] memory) {
        return new bytes32[](0);
    }
    function open_position(bytes32, int256, bytes calldata) external pure returns (uint256) { return 0; }
    function close_position(uint256, bytes calldata) external pure returns (int256) { return 0; }
    function modify_position(uint256, int256, bytes calldata) external pure returns (int256) { return 0; }
    function attest_off_chain_state(bytes calldata) external pure returns (bool) { return false; }

    function get_position(uint256) external pure returns (IPorticoAdapter.PositionView memory pv) {
        return pv; // default-initialised struct
    }
    function get_venue_health() external pure returns (IPorticoAdapter.VenueHealth memory vh) {
        vh.is_operational = true;
        return vh;
    }
    function get_haircut_bps(bytes32) external pure returns (uint16) { return 1000; }
    function get_initial_margin_bps(bytes32) external pure returns (uint16) { return 1000; }
    function get_maintenance_margin_bps(bytes32) external pure returns (uint16) { return 800; }
}
