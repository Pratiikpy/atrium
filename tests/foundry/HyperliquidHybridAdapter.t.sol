// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {HyperliquidHybridAdapter} from "../../contracts/adapters/hyperliquid/src/HyperliquidHybridAdapter.sol";
import {IPorticoAdapter} from "../../contracts/portico-registry/src/IPorticoAdapter.sol";

/// @title HyperliquidHybridAdapter foundry test suite
/// @notice Hyperliquid HIP-3 perps run on Hyperliquid L1 (Rust binary, non-EVM).
///         The Bridge2.sol on Arbitrum is the only on-chain handle; position
///         state comes back via validator-signed attestations.
///
///         Second hybrid adapter in foundry coverage (Polymarket was first).
///         Identical EIP-712 ECDSA attestation pattern but with the
///         Hyperliquid bridge (not Aqueduct) as the cross-chain deposit path
///         and an explicit `setOperational` venue-toggle.
contract HyperliquidHybridAdapterTest is Test {
    HyperliquidHybridAdapter internal adapter;
    MockHyperliquidBridge internal bridge;
    MockERC20 internal usdc;
    address internal coffer;
    address internal praetor;
    address internal timelock;
    address internal user;
    address internal hostile;

    uint256 internal validator1Pk = 0xA11CE;
    uint256 internal validator2Pk = 0xB0B;
    uint256 internal validator3Pk = 0xC0C0;
    address internal validator1;
    address internal validator2;
    address internal validator3;

    bytes32 internal constant BTC_PERP = keccak256("HL-BTC-USD-PERP");
    bytes32 internal constant ETH_PERP = keccak256("HL-ETH-USD-PERP");

    event PositionOpened(
        uint256 indexed venue_position_id,
        address indexed owner,
        bytes32 indexed instrument_id,
        int256 notional_signed
    );
    event PositionClosed(uint256 indexed venue_position_id, int256 realized_pnl_signed);
    event AttestationAccepted(bytes32 indexed attestation_hash, address indexed attestor);
    event VenueHealthChanged(bool is_operational, string status_message);

    function setUp() public {
        coffer = makeAddr("atrium-coffer");
        praetor = makeAddr("praetor-multisig");
        timelock = makeAddr("praetor-timelock");
        user = makeAddr("user");
        hostile = makeAddr("hostile");

        validator1 = vm.addr(validator1Pk);
        validator2 = vm.addr(validator2Pk);
        validator3 = vm.addr(validator3Pk);

        usdc = new MockERC20("USDC", 6);
        bridge = new MockHyperliquidBridge();
        adapter = new HyperliquidHybridAdapter(
            address(bridge),
            address(usdc),
            coffer,
            praetor,
            timelock,
            2 // 2-of-3 quorum
        );

        usdc.mint(address(adapter), 10_000_000 * 10 ** 6);

        // setValidators stays onlyPraetor; addInstrument is onlyTimelock per F-32.
        vm.startPrank(praetor);
        address[] memory v = new address[](3);
        v[0] = validator1;
        v[1] = validator2;
        v[2] = validator3;
        adapter.setValidators(v, 2);
        vm.stopPrank();
        vm.startPrank(timelock);
        adapter.addInstrument(BTC_PERP, 200, 1_000, 500);
        adapter.addInstrument(ETH_PERP, 200, 1_000, 500);
        vm.stopPrank();
    }

    // ── Metadata ─────────────────────────────────────────────────────

    function test_metadata_namePinned() public view {
        assertEq(adapter.name(), "Hyperliquid");
    }

    function test_metadata_isHybridTrue() public view {
        assertTrue(adapter.isHybrid());
    }

    function test_metadata_supportedInstruments() public view {
        bytes32[] memory inst = adapter.supportedInstruments();
        assertEq(inst.length, 2);
        assertEq(inst[0], BTC_PERP);
        assertEq(inst[1], ETH_PERP);
    }

    function test_metadata_version() public view {
        (uint256 major, uint256 minor, uint256 patch) = adapter.version();
        assertEq(major, 1);
        assertEq(minor, 0);
        assertEq(patch, 0);
    }

    // ── Praetor admin gating ─────────────────────────────────────────

    function test_addInstrument_rejectsHostile() public {
        vm.prank(hostile);
        vm.expectRevert(HyperliquidHybridAdapter.Unauthorized.selector);
        adapter.addInstrument(keccak256("OTHER"), 100, 200, 100);
    }

    function test_addInstrument_rejectsMultisig_EEEEE1() public {
        // Audit EEEEE-1: multisig CANNOT add instruments directly.
        vm.prank(praetor);
        vm.expectRevert(HyperliquidHybridAdapter.Unauthorized.selector);
        adapter.addInstrument(keccak256("OTHER"), 100, 200, 100);
    }

    /// Iter 93: pin InstrumentAdded emit (EEEEE-3).
    event InstrumentAdded(bytes32 indexed instrument_id, uint16 haircut_bps, uint16 initial_margin_bps, uint16 maintenance_margin_bps);
    function test_addInstrument_emitsInstrumentAdded_iter93() public {
        bytes32 newInst = keccak256("HL-SOL-iter93");
        vm.expectEmit(true, false, false, true, address(adapter));
        emit InstrumentAdded(newInst, 137, 911, 433);
        vm.prank(timelock);
        adapter.addInstrument(newInst, 137, 911, 433);
    }

    /// Iter 60 audit fix: pin setAuthorizedCaller auth + event. Mirror
    /// of iter 60 cross-adapter sweep, same observability invariant.
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    function test_setAuthorizedCaller_rejectsHostile_iter60() public {
        vm.prank(hostile);
        vm.expectRevert(HyperliquidHybridAdapter.Unauthorized.selector);
        adapter.setAuthorizedCaller(hostile, true);
    }
    function test_setAuthorizedCaller_succeedsFromPraetor_emitsEvent_iter60() public {
        address router_ = makeAddr("router-iter60");
        vm.expectEmit(true, false, false, true, address(adapter));
        emit AuthorizedCallerUpdated(router_, true);
        vm.prank(timelock);
        adapter.setAuthorizedCaller(router_, true);
        assertTrue(adapter.is_authorized_caller(router_));
    }

    function test_setValidators_onlyPraetor() public {
        address[] memory v = new address[](1);
        v[0] = hostile;
        vm.prank(hostile);
        vm.expectRevert(HyperliquidHybridAdapter.Unauthorized.selector);
        adapter.setValidators(v, 1);
    }

    function test_setValidators_rejectsZeroAddress() public {
        // Audit CCC-1 fix: defense-in-depth against the classic ecrecover
        // bypass where `address(0) == claimed` passes for malformed sigs.
        address[] memory v = new address[](2);
        v[0] = validator1;
        v[1] = address(0);
        vm.prank(praetor);
        vm.expectRevert("zero validator");
        adapter.setValidators(v, 1);
    }

    // ── Audit iteration 45: setValidators bounds on new_required ──────
    // Mirror of PolymarketAdapter iter-45. Same shape: unbounded new_required
    // pre-fix allowed quorum=0 (any attestation passes) or quorum > validators
    // (adapter bricked). Both catastrophic.

    function test_setValidators_rejectsZeroRequired_iter45() public {
        address[] memory v = new address[](2);
        v[0] = validator1;
        v[1] = validator2;
        vm.prank(praetor);
        vm.expectRevert("zero required signatures");
        adapter.setValidators(v, 0);
    }

    function test_setValidators_rejectsRequiredExceedingValidatorCount_iter45() public {
        address[] memory v = new address[](2);
        v[0] = validator1;
        v[1] = validator2;
        vm.prank(praetor);
        vm.expectRevert("required exceeds validator count");
        adapter.setValidators(v, 3);
    }

    function test_setValidators_rejectsEmptyValidatorSet_iter45() public {
        address[] memory v = new address[](0);
        vm.prank(praetor);
        vm.expectRevert("empty validator set");
        adapter.setValidators(v, 1);
    }

    function test_attest_rejectsZeroAddressClaimedSigner() public {
        // Defense-in-depth half: even if is_validator[address(0)] were true,
        // the ecrecover-side `recovered == address(0)` guard rejects the bypass.
        _openPosition(int256(1_000e6), user);
        bytes32 hash_ = keccak256("ccc-1-hl-bypass");

        bytes[] memory sigs = new bytes[](1);
        address[] memory signers = new address[](1);
        sigs[0] = new bytes(65);
        signers[0] = address(0);

        bytes memory att = abi.encode(
            uint256(1), uint256(50_000 << 64), int256(10e6), uint64(block.number), hash_, sigs, signers
        );
        vm.expectRevert(abi.encodeWithSelector(HyperliquidHybridAdapter.InsufficientSignatures.selector, 0, 2));
        adapter.attest_off_chain_state(att);
    }

    function test_setOperational_onlyPraetor() public {
        vm.prank(hostile);
        vm.expectRevert(HyperliquidHybridAdapter.Unauthorized.selector);
        adapter.setOperational(false, "test");
    }

    function test_setValidators_clearsOldSet() public {
        // Rotating the validator set must remove the old keys from is_validator,
        // not just add new ones. Otherwise the old keys still count for quorum.
        address oldKey = validator1;
        assertTrue(adapter.is_validator(oldKey), "validator1 starts in set");

        address[] memory newSet = new address[](1);
        newSet[0] = makeAddr("new-validator");
        vm.prank(praetor);
        adapter.setValidators(newSet, 1);

        assertFalse(adapter.is_validator(oldKey), "old key must be cleared from is_validator");
        assertTrue(adapter.is_validator(newSet[0]));
        assertEq(adapter.required_signatures(), 1);
    }

    // ── open_position ────────────────────────────────────────────────

    function test_open_onlyCoffer() public {
        bytes memory payload = _packPayloadWithOriginator(user, hex"deadbeef");
        vm.prank(hostile);
        vm.expectRevert(HyperliquidHybridAdapter.Unauthorized.selector);
        adapter.open_position(BTC_PERP, int256(1_000e6), payload);
    }

    // Audit fix (#65): open must revert against a codeless (deployer-EOA
    // placeholder) bridge so the Router cannot strand pulled USDC. The live
    // setUp bridge is a MockHyperliquidBridge (has code) so the lifecycle tests
    // above still pass; this deploys an adapter with an EOA bridge to prove the
    // strand guard fires.
    function test_open_revertsScaffoldOnCodelessBridge_65() public {
        HyperliquidHybridAdapter scaffold =
            new HyperliquidHybridAdapter(makeAddr("eoa-bridge"), address(usdc), coffer, praetor, timelock, 2);
        bytes memory payload = _packPayloadWithOriginator(user, hex"deadbeef");
        vm.prank(coffer);
        vm.expectRevert(HyperliquidHybridAdapter.ScaffoldNotImplemented.selector);
        scaffold.open_position(BTC_PERP, int256(1_000e6), payload);
    }

    function test_open_rejectsUnsupportedInstrument() public {
        bytes32 wrong = keccak256("NOT-LISTED");
        bytes memory payload = _packPayloadWithOriginator(user, hex"");
        vm.prank(coffer);
        vm.expectRevert(abi.encodeWithSelector(HyperliquidHybridAdapter.UnsupportedInstrument.selector, wrong));
        adapter.open_position(wrong, int256(1_000e6), payload);
    }

    function test_open_rejectsShortPayload() public {
        bytes memory payload = new bytes(19);
        vm.prank(coffer);
        vm.expectRevert(HyperliquidHybridAdapter.BadVenuePayload.selector);
        adapter.open_position(BTC_PERP, int256(1_000e6), payload);
    }

    function test_open_happyPath_depositsToBridgeAndStoresOriginator() public {
        bytes memory permitBlob = hex"01020304";
        bytes memory payload = _packPayloadWithOriginator(user, permitBlob);

        vm.expectEmit(true, true, true, true, address(adapter));
        emit PositionOpened(1, user, BTC_PERP, int256(1_000e6));

        vm.prank(coffer);
        uint256 id = adapter.open_position(BTC_PERP, int256(1_000e6), payload);
        assertEq(id, 1);

        // Bridge received the full venue_payload (originator prefix + permit blob).
        assertEq(bridge.lastDepositData(), payload, "bridge sees the full payload");

        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.owner, user, "originator must come from payload prefix");
        assertEq(view_.notional_signed, int256(1_000e6));
        assertTrue(adapter.next_venue_position_id() == 1);
        // Pre-attestation, entry/current price are zero, attestation sets them.
        assertEq(view_.entry_price_q64, 0);
        assertEq(view_.current_price_q64, 0);
        assertEq(view_.unrealized_pnl_signed, 0);
    }

    function test_open_shortPosition_absoluteNotional() public {
        bytes memory payload = _packPayloadWithOriginator(user, hex"");
        vm.prank(coffer);
        uint256 id = adapter.open_position(BTC_PERP, int256(-500e6), payload);

        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.notional_signed, int256(-500e6));
    }

    function test_open_multiplePositionsIncrementId() public {
        bytes memory payload = _packPayloadWithOriginator(user, hex"");
        vm.startPrank(coffer);
        uint256 a = adapter.open_position(BTC_PERP, int256(1_000e6), payload);
        uint256 b = adapter.open_position(ETH_PERP, int256(500e6), payload);
        uint256 c = adapter.open_position(BTC_PERP, int256(-250e6), payload);
        vm.stopPrank();
        assertEq(a, 1);
        assertEq(b, 2);
        assertEq(c, 3);
    }

    // ── close_position ───────────────────────────────────────────────

    function test_close_onlyCoffer() public {
        uint256 id = _openPosition(int256(1_000e6), user);

        vm.prank(hostile);
        vm.expectRevert(HyperliquidHybridAdapter.Unauthorized.selector);
        adapter.close_position(id, hex"");
    }

    function test_close_unknownPosition_revertsNotOpen() public {
        vm.prank(coffer);
        vm.expectRevert(HyperliquidHybridAdapter.PositionNotOpen.selector);
        adapter.close_position(7777, hex"");
    }

    function test_close_returnsLastAttestedPnl() public {
        uint256 id = _openPosition(int256(1_000e6), user);

        // Attest +120e6 PnL.
        bytes memory att = _buildAttestation(id, 50_000 << 64, int256(120e6), uint64(block.number), keccak256("a"), 2);
        adapter.attest_off_chain_state(att);

        vm.expectEmit(true, false, false, true, address(adapter));
        emit PositionClosed(id, int256(120e6));

        vm.prank(coffer);
        int256 pnl = adapter.close_position(id, hex"");
        assertEq(pnl, int256(120e6));
    }

    function test_close_doubleClose_revertsPositionNotOpen() public {
        uint256 id = _openPosition(int256(1_000e6), user);
        vm.prank(coffer);
        adapter.close_position(id, hex"");

        vm.prank(coffer);
        vm.expectRevert(HyperliquidHybridAdapter.PositionNotOpen.selector);
        adapter.close_position(id, hex"");
    }

    // ── attest_off_chain_state, security-critical hybrid surface ────

    function test_attest_revertsOnDuplicate() public {
        uint256 id = _openPosition(int256(1_000e6), user);

        bytes32 hash_ = keccak256("hl-att-1");
        bytes memory att = _buildAttestation(id, 50_000 << 64, int256(10e6), uint64(block.number), hash_, 2);

        adapter.attest_off_chain_state(att);
        vm.expectRevert(abi.encodeWithSelector(HyperliquidHybridAdapter.DuplicateAttestation.selector, hash_));
        adapter.attest_off_chain_state(att);
    }

    function test_attest_rejectsInsufficientSignatures() public {
        _openPosition(int256(1_000e6), user);

        bytes memory att = _buildAttestation(1, 50_000 << 64, int256(10e6), uint64(block.number), keccak256("a"), 1);
        vm.expectRevert(abi.encodeWithSelector(HyperliquidHybridAdapter.InsufficientSignatures.selector, 1, 2));
        adapter.attest_off_chain_state(att);
    }

    function test_attest_dedupesSameValidator() public {
        _openPosition(int256(1_000e6), user);

        bytes32 hash_ = keccak256("hl-dedupe");
        // FIRE76-4: sign over the FULL attestation fields, not just the hash.
        bytes32 digest = _digestForFullAttestation(1, 50_000 << 64, int256(10e6), uint64(block.number), hash_, address(adapter));

        bytes[] memory sigs = new bytes[](2);
        address[] memory signers = new address[](2);
        sigs[0] = _sign(validator1Pk, digest);
        signers[0] = validator1;
        sigs[1] = _sign(validator1Pk, digest);
        signers[1] = validator1;

        bytes memory att = abi.encode(
            uint256(1), uint256(50_000 << 64), int256(10e6), uint64(block.number), hash_, sigs, signers
        );

        vm.expectRevert(abi.encodeWithSelector(HyperliquidHybridAdapter.InsufficientSignatures.selector, 1, 2));
        adapter.attest_off_chain_state(att);
    }

    function test_attest_rejectsForgedSignerClaim() public {
        _openPosition(int256(1_000e6), user);

        bytes32 hash_ = keccak256("hl-forged");
        bytes32 digest = _digestForFullAttestation(1, 50_000 << 64, int256(10e6), uint64(block.number), hash_, address(adapter));

        bytes[] memory sigs = new bytes[](2);
        address[] memory signers = new address[](2);
        sigs[0] = _sign(validator1Pk, digest);
        signers[0] = validator1;
        // Claim validator2 but sign with validator1 → ecrecover != claimed.
        sigs[1] = _sign(validator1Pk, digest);
        signers[1] = validator2;

        bytes memory att = abi.encode(
            uint256(1), uint256(50_000 << 64), int256(10e6), uint64(block.number), hash_, sigs, signers
        );

        vm.expectRevert(abi.encodeWithSelector(HyperliquidHybridAdapter.InsufficientSignatures.selector, 1, 2));
        adapter.attest_off_chain_state(att);
    }

    function test_attest_happyPath_setsEntryPriceFirstTime() public {
        uint256 id = _openPosition(int256(1_000e6), user);
        uint256 priceQ64 = 50_000 << 64;
        int256 pnl = int256(25e6);
        bytes32 hash_ = keccak256("hl-first");

        vm.expectEmit(true, true, false, false, address(adapter));
        emit AttestationAccepted(hash_, address(this));

        bytes memory att = _buildAttestation(id, priceQ64, pnl, uint64(block.number), hash_, 2);
        assertTrue(adapter.attest_off_chain_state(att));

        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.entry_price_q64, priceQ64, "first attestation pins entry");
        assertEq(view_.current_price_q64, priceQ64);
        assertEq(view_.unrealized_pnl_signed, pnl);
    }

    function test_attest_subsequentDoesNotOverwriteEntry() public {
        uint256 id = _openPosition(int256(1_000e6), user);
        bytes memory first = _buildAttestation(id, 50_000 << 64, int256(0), uint64(block.number), keccak256("h1"), 2);
        adapter.attest_off_chain_state(first);

        bytes memory second = _buildAttestation(id, 55_000 << 64, int256(100e6), uint64(block.number + 50), keccak256("h2"), 2);
        adapter.attest_off_chain_state(second);

        IPorticoAdapter.PositionView memory view_ = adapter.get_position(id);
        assertEq(view_.entry_price_q64, 50_000 << 64, "entry must NOT be overwritten");
        assertEq(view_.current_price_q64, 55_000 << 64, "current must update");
        assertEq(view_.unrealized_pnl_signed, int256(100e6));
    }

    // ── modify_position v1 lock ──────────────────────────────────────

    function test_modify_position_revertsV1() public {
        vm.expectRevert(bytes("modify not supported in v1"));
        adapter.modify_position(1, int256(100), hex"");
    }

    // ── venue health ─────────────────────────────────────────────────

    function test_venueHealth_default_operational() public view {
        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertTrue(h.is_operational);
        assertEq(h.quoted_spread_bps, 5);
        assertEq(h.status_message, "ok");
    }

    function test_venueHealth_offline_afterSetOperationalFalse() public {
        vm.expectEmit(false, false, false, true, address(adapter));
        emit VenueHealthChanged(false, "L1 attestation lag");

        vm.prank(praetor);
        adapter.setOperational(false, "L1 attestation lag");

        IPorticoAdapter.VenueHealth memory h = adapter.get_venue_health();
        assertFalse(h.is_operational);
        assertEq(h.status_message, "L1 attestation lag");
    }

    /// Iter 58 audit fix: pin the FIRE76-3 intra-array dedup. setValidators
    /// must reject [A, A, B] so the `validators` array can't carry
    /// duplicates that corrupt quorum math (an off-chain observer reading
    /// the array would see [A, A] with required=1 and assume 2-of-2 when
    /// it's actually 1-of-1 against one real key). The check is at
    /// HyperliquidHybridAdapter.sol:378-380; zero tests by name before
    /// iter 58.
    function test_setValidators_rejectsDuplicate_FIRE76_3_iter58() public {
        address[] memory v = new address[](3);
        v[0] = validator1;
        v[1] = validator2;
        v[2] = validator1;  // duplicate at index 2
        vm.prank(praetor);
        vm.expectRevert(bytes("duplicate validator"));
        adapter.setValidators(v, 2);
    }

    /// Iter 56 audit fix: pin the addInstrument → get_*_bps storage
    /// routing. Same gap caught on MorphoBlue (iter 56 task #230); same
    /// silent-failure shape on every adapter that takes the three uint16
    /// bps params. Without this test, a refactor that swapped two of the
    /// argument-to-mapping writes would silently corrupt Plinth's margin
    /// math on every Hyperliquid position, no revert, no event-level
    /// signal, just wrong numbers.
    function test_addInstrument_routesBpsArgsCorrectly_iter56() public {
        bytes32 newInst = keccak256("HL-SOL-USD-PERP");
        uint16 expectedHaircut = 137;             // three distinct primes so any
        uint16 expectedInitialMargin = 911;       // pairwise swap fails an
        uint16 expectedMaintenanceMargin = 433;   // assertEq below.

        vm.prank(timelock);
        adapter.addInstrument(newInst, expectedHaircut, expectedInitialMargin, expectedMaintenanceMargin);

        assertEq(adapter.get_haircut_bps(newInst), expectedHaircut, "iter56: haircut routing");
        assertEq(adapter.get_initial_margin_bps(newInst), expectedInitialMargin, "iter56: initial-margin routing");
        assertEq(adapter.get_maintenance_margin_bps(newInst), expectedMaintenanceMargin, "iter56: maintenance-margin routing");
    }

    // ── Constructor zero-checks (audit NNNN-1) ───────────────────────
    // Audit TTTT-1: pin every revert branch added by NNNN-1.
    // required_signatures is a uint16, not an address, zero is a valid
    // (if unsafe) quorum value and is not constructor-checked.

    function test_constructor_revertsOnZeroBridge() public {
        vm.expectRevert(bytes("zero bridge"));
        new HyperliquidHybridAdapter(address(0), address(usdc), coffer, praetor, timelock, 2);
    }

    function test_constructor_revertsOnZeroUsdc() public {
        vm.expectRevert(bytes("zero usdc"));
        new HyperliquidHybridAdapter(address(bridge), address(0), coffer, praetor, timelock, 2);
    }

    function test_constructor_revertsOnZeroCoffer() public {
        vm.expectRevert(bytes("zero coffer"));
        new HyperliquidHybridAdapter(address(bridge), address(usdc), address(0), praetor, timelock, 2);
    }

    function test_constructor_revertsOnZeroPraetor() public {
        vm.expectRevert(bytes("zero praetor"));
        new HyperliquidHybridAdapter(address(bridge), address(usdc), coffer, address(0), timelock, 2);
    }

    // ── helpers ──────────────────────────────────────────────────────

    function _openPosition(int256 notional, address originator) internal returns (uint256 id) {
        bytes memory payload = _packPayloadWithOriginator(originator, hex"");
        vm.prank(coffer);
        id = adapter.open_position(BTC_PERP, notional, payload);
    }

    function _packPayloadWithOriginator(address originator, bytes memory tail) internal pure returns (bytes memory) {
        return abi.encodePacked(originator, tail);
    }

    function _buildAttestation(
        uint256 positionId,
        uint256 priceQ64,
        int256 pnl,
        uint64 hlBlock,
        bytes32 attHash,
        uint16 numSigs
    ) internal view returns (bytes memory) {
        // Audit FIRE76-4 fix: typehash binds every load-bearing field.
        bytes32 digest = _digestForFullAttestation(positionId, priceQ64, pnl, hlBlock, attHash, address(adapter));

        bytes[] memory sigs = new bytes[](numSigs);
        address[] memory signers = new address[](numSigs);
        uint256[3] memory keys = [validator1Pk, validator2Pk, validator3Pk];
        address[3] memory addrs = [validator1, validator2, validator3];
        for (uint256 i = 0; i < numSigs; i++) {
            sigs[i] = _sign(keys[i], digest);
            signers[i] = addrs[i];
        }
        return abi.encode(positionId, priceQ64, pnl, hlBlock, attHash, sigs, signers);
    }

    function _digestForAttHash(bytes32 attHash) internal view returns (bytes32) {
        return _digestForFullAttestation(1, 50_000 << 64, int256(120e6), uint64(block.number), attHash, address(adapter));
    }

    function _digestForFullAttestation(
        uint256 positionId,
        uint256 priceQ64,
        int256 pnl,
        uint64 hlBlock,
        bytes32 attHash,
        address adapterAddr
    ) internal view returns (bytes32) {
        bytes32 typeHash = keccak256(
            "AttestationDigest(uint256 venue_position_id,bytes32 instrument_id,uint256 price_q64,int256 pnl,uint64 hl_block,bytes32 attestation_hash)"
        );
        // HL PositionState field order: (owner, instrument_id, notional_signed, ...)
        (, bytes32 instrument_id, , , , , , ) = HyperliquidHybridAdapter(adapterAddr).positions(positionId);
        bytes32 structHash = keccak256(abi.encode(
            typeHash,
            positionId,
            instrument_id,
            priceQ64,
            pnl,
            hlBlock,
            attHash
        ));
        return keccak256(abi.encodePacked("\x19\x01", HyperliquidHybridAdapter(adapterAddr).DOMAIN_SEPARATOR(), structHash));
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ── Audit DDDDD-4 lock: setValidators emits rotation event ───────

    event ValidatorSetUpdated(address[] new_validators, uint16 new_required);

    function test_setValidators_emitsRotationEvent_DDDDD4() public {
        address[] memory rotated = new address[](2);
        rotated[0] = validator1;
        rotated[1] = validator3;

        vm.expectEmit(false, false, false, true, address(adapter));
        emit ValidatorSetUpdated(rotated, 2);

        vm.prank(praetor);
        adapter.setValidators(rotated, 2);
    }

    // ── Audit G-8 cross-chain / cross-contract replay rejection ──────
    //
    // The G-8 fix binds DOMAIN_SEPARATOR to (name, version, chainId,
    // verifyingContract). The chainId binding blocks replay across L1/L2
    // (mainnet validator sig can't fire on Sepolia). The verifyingContract
    // binding blocks replay across two separate deploys of the same
    // adapter on the same chain.
    //
    // Test strategy: deploy a SECOND adapter instance with the same
    // validators, then try to submit on adapterB an attestation signed
    // under adapterA's DOMAIN_SEPARATOR. The recovered signer addresses
    // won't match because adapterB's digest computation uses ITS OWN
    // DOMAIN_SEPARATOR. Result: InsufficientSignatures.

    function test_attest_rejectsReplayAcrossAdapterDeploys_G8() public {
        // Deploy adapterB: identical constructor args except for the
        // deploy address (different verifyingContract).
        HyperliquidHybridAdapter adapterB = new HyperliquidHybridAdapter(
            address(bridge), address(usdc), coffer, praetor, timelock, 2
        );
        vm.startPrank(praetor);
        address[] memory v = new address[](3);
        v[0] = validator1; v[1] = validator2; v[2] = validator3;
        adapterB.setValidators(v, 2);
        vm.stopPrank();
        vm.prank(timelock);
        adapterB.addInstrument(BTC_PERP, 200, 1_000, 500);

        // Sanity: the two adapters have DIFFERENT DOMAIN_SEPARATORs.
        assertTrue(
            adapter.DOMAIN_SEPARATOR() != adapterB.DOMAIN_SEPARATOR(),
            "G-8 sanity: same-construction adapters at different addresses must have different DOMAIN_SEPARATORs"
        );

        // Open a position on adapterB so the attestation has a valid id.
        bytes memory openPayload = _packPayloadWithOriginator(user, hex"");
        vm.prank(coffer);
        uint256 id = adapterB.open_position(BTC_PERP, int256(100e6), openPayload);

        // Build an attestation signed under adapterA's domain, the
        // helper _digestForAttHash uses `adapter` (adapterA).
        bytes32 attHash = keccak256("g8-cross-adapter-replay");
        bytes memory replayAtt = _buildAttestation(
            id, 50_000 << 64, int256(50e6), uint64(block.number), attHash, 2
        );

        // Submit on adapterB. AdapterB recomputes the digest using its own
        // DOMAIN_SEPARATOR, recovers a different address, signer claim
        // mismatch → all sigs invalid → quorum 0 vs 2 → InsufficientSignatures.
        vm.expectRevert(
            abi.encodeWithSelector(HyperliquidHybridAdapter.InsufficientSignatures.selector, uint16(0), uint16(2))
        );
        adapterB.attest_off_chain_state(replayAtt);
    }

    function test_attest_rejectsReplayAcrossChainIds_G8() public {
        // Deploy adapterB at a different chainId. Because DOMAIN_SEPARATOR
        // is immutable and computed in the constructor using `block.chainid`,
        // adapters constructed under different chainIds have different
        // digests for the same attestation hash.
        uint256 originalChainId = block.chainid;
        vm.chainId(99_999); // arbitrary fake chainId
        HyperliquidHybridAdapter adapterC = new HyperliquidHybridAdapter(
            address(bridge), address(usdc), coffer, praetor, timelock, 2
        );
        vm.startPrank(praetor);
        address[] memory v = new address[](3);
        v[0] = validator1; v[1] = validator2; v[2] = validator3;
        adapterC.setValidators(v, 2);
        vm.stopPrank();
        vm.prank(timelock);
        adapterC.addInstrument(BTC_PERP, 200, 1_000, 500);

        // Restore the original chainId so adapter (constructed at setUp's
        // chainId) and adapterC differ ONLY in chainId baked into their
        // DOMAIN_SEPARATORs.
        vm.chainId(originalChainId);

        assertTrue(
            adapter.DOMAIN_SEPARATOR() != adapterC.DOMAIN_SEPARATOR(),
            "G-8: different chainIds at construction must produce different DOMAIN_SEPARATORs"
        );

        // Open on adapterC so there's a valid position id.
        bytes memory openPayload = _packPayloadWithOriginator(user, hex"");
        vm.prank(coffer);
        uint256 id = adapterC.open_position(BTC_PERP, int256(100e6), openPayload);

        // Sign under adapter's (originalChainId) domain. Submit on adapterC
        // (fake-chainId domain). Must reject.
        bytes32 attHash = keccak256("g8-cross-chainid-replay");
        bytes memory replayAtt = _buildAttestation(
            id, 50_000 << 64, int256(50e6), uint64(block.number), attHash, 2
        );

        vm.expectRevert(
            abi.encodeWithSelector(HyperliquidHybridAdapter.InsufficientSignatures.selector, uint16(0), uint16(2))
        );
        adapterC.attest_off_chain_state(replayAtt);
    }
}

// ── mocks ─────────────────────────────────────────────────────────

contract MockHyperliquidBridge {
    bytes public lastDepositData;

    function batchedDepositWithPermit(bytes calldata depositData) external {
        lastDepositData = depositData;
    }

    function pendingWithdrawals(bytes32) external pure returns (uint64, uint64) {
        return (0, 0);
    }
}

contract MockERC20 {
    string public name;
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, uint8 _decimals) {
        name = _name;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address sp, uint256 v) external returns (bool) {
        allowance[msg.sender][sp] = v;
        return true;
    }

    // Phase theta.1 follow-up (2026-05-25): close_position now sweeps the
    // adapter's USDC balance to atrium_coffer per the funds-stranding fix.
    // Pre-fix tests pre-dated the sweep so the mock only needed approve;
    // now transfer must work too or close_position reverts.
    function transfer(address to, uint256 v) external returns (bool) {
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }
}
