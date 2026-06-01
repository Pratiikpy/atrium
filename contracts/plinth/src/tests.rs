// Host unit tests for Plinth using stylus-sdk's native TestVM mock host.
//
// These exercise the public ABI in isolation. Cross-contract reads
// (PlinthOracle.safePrice, PlinthMath.requiredMargin, Coffer.balanceOf,
// PorticoRegistry.isRegisteredAdapter) and writes (Sigil.validateAction /
// recordClose, Vigil.queueLiquidation) are stubbed via vm.mock_static_call /
// vm.mock_call. End-to-end tests against deployed contracts live in
// tests/foundry/ and tests/e2e/.
//
// Mock keying (verified against stylus-test 0.10.7 src/vm.rs + state.rs):
//  - view interface methods use Call::new() -> static_call -> mock_static_call,
//    keyed by (to, calldata).
//  - mutating interface methods use Call::new_mutating(self) -> call ->
//    mock_call, keyed by (to, calldata, value=ZERO).
//  - calldata == 4-byte selector ++ abi_encode_params(args), which is exactly
//    what alloy's SolCall::abi_encode() produces (src/macros/sol_interface.rs
//    line 145-147). We rebuild it with matching sol! call structs.

#![cfg(test)]

use super::*;
use alloy_sol_types::{SolCall, SolValue};
use stylus_sdk::testing::TestVM;

// PlinthError intentionally has no Debug impl (it's a thin on-chain error).
// These helpers let tests assert success / failure / specific code without
// requiring Debug on the Ok or Err arms.
fn unwrap_ok<T>(r: Result<T, PlinthError>) -> T {
    match r {
        Ok(v) => v,
        Err(_) => panic!("expected Ok, got PlinthError"),
    }
}

fn expect_err_code<T>(r: Result<T, PlinthError>, want: u16) {
    match r {
        Ok(_) => panic!("expected PlinthError code {want}, got Ok"),
        Err(PlinthError::Err(e)) => assert_eq!(e.code, want, "wrong error code"),
    }
}

fn is_ok<T>(r: &Result<T, PlinthError>) -> bool {
    matches!(r, Ok(_))
}

// --- Re-declared call types, byte-identical to the contract's sol_interface!
// signatures. Used only to reproduce the exact calldata the contract sends so
// mock keys match. Names/types must stay in lockstep with the interfaces in
// lib.rs or the selector (keccak of canonical sig) drifts and the mock misses.
sol! {
    function safePrice(
        address pyth_oracle,
        address chainlink_feed,
        bytes32 pyth_feed_id,
        uint64 freshness_seconds,
        uint16 tolerance_bps
    ) external view returns (uint256);

    function requiredMargin(
        int256[] notionals,
        uint256[] entry_prices_q64,
        uint256[] current_prices_q64,
        uint16[] haircuts_bps,
        uint16[] correlation_classes,
        uint16 min_initial_margin_bps,
        uint16 maint_margin_buffer_bps
    ) external view returns (uint256);

    function balanceOf(address user) external view returns (uint256);

    function isRegisteredAdapter(address adapter) external view returns (bool);
}

// --- Fixed test addresses. Distinct bytes so equality checks are meaningful.
fn praetor() -> Address { Address::from([0x11u8; 20]) }
fn timelock() -> Address { Address::from([0x22u8; 20]) }
fn coffer() -> Address { Address::from([0x33u8; 20]) }
fn vigil() -> Address { Address::from([0x44u8; 20]) }
fn sigil() -> Address { Address::from([0x55u8; 20]) }
fn registry() -> Address { Address::from([0x66u8; 20]) }
fn chainlink() -> Address { Address::from([0x77u8; 20]) }
fn pyth() -> Address { Address::from([0x88u8; 20]) }
fn math() -> Address { Address::from([0x99u8; 20]) }
fn oracle() -> Address { Address::from([0xAAu8; 20]) }
fn user() -> Address { Address::from([0xBBu8; 20]) }
fn stranger() -> Address { Address::from([0xCCu8; 20]) }

fn instrument() -> FixedBytes<32> { FixedBytes::<32>::from([0xDEu8; 32]) }
fn pyth_feed() -> FixedBytes<32> { FixedBytes::<32>::from([0xEFu8; 32]) }
const VENUE: u8 = 3;
const HAIRCUT_BPS: u16 = 1_000;
const CORR_CLASS: u16 = 1;

/// Construct + run the Stylus constructor with our fixed wiring.
fn deploy() -> (TestVM, Plinth) {
    let vm = TestVM::new();
    let mut c = Plinth::from(&vm);
    c.constructor(
        coffer(),
        vigil(),
        sigil(),
        registry(),
        chainlink(),
        pyth(),
        praetor(),
        timelock(),
        math(),
        oracle(),
    );
    (vm, c)
}

/// Register a live instrument as the timelock so open_position can proceed.
fn register_instrument(vm: &TestVM, c: &mut Plinth) {
    vm.set_sender(timelock());
    unwrap_ok(c.set_instrument_risk(
        VENUE,
        instrument(),
        HAIRCUT_BPS,
        CORR_CLASS,
        pyth_feed(),
        chainlink(),
        true,
    ));
}

/// Mock the oracle.safePrice static call for our single instrument so it
/// returns `price`. Calldata mirrors get_safe_price exactly: pyth addr +
/// instrument's chainlink feed + pyth feed id + freshness(60) + tolerance(50).
fn mock_oracle(vm: &TestVM, price: U256) {
    let calldata = safePriceCall {
        pyth_oracle: pyth(),
        chainlink_feed: chainlink(),
        pyth_feed_id: pyth_feed(),
        freshness_seconds: 60u64,
        tolerance_bps: 50u16,
    }
    .abi_encode();
    let ret = price.abi_encode();
    vm.mock_static_call(oracle(), calldata, Ok(ret));
}

/// Mock the Coffer.balanceOf static call for `who` -> `bal`.
fn mock_coffer(vm: &TestVM, who: Address, bal: U256) {
    let calldata = balanceOfCall { user: who }.abi_encode();
    vm.mock_static_call(coffer(), calldata, Ok(bal.abi_encode()));
}

/// Mock the PlinthMath.requiredMargin static call for a single-position vector.
fn mock_math_single(vm: &TestVM, notional: I256, price: U256, required: U256) {
    let calldata = requiredMarginCall {
        notionals: vec![notional],
        entry_prices_q64: vec![price],
        current_prices_q64: vec![price],
        haircuts_bps: vec![HAIRCUT_BPS],
        correlation_classes: vec![CORR_CLASS],
        min_initial_margin_bps: 500u16,
        maint_margin_buffer_bps: 200u16,
    }
    .abi_encode();
    vm.mock_static_call(math(), calldata, Ok(required.abi_encode()));
}

/// Mock PorticoRegistry.isRegisteredAdapter(who) -> result.
fn mock_registry(vm: &TestVM, who: Address, result: bool) {
    let calldata = isRegisteredAdapterCall { adapter: who }.abi_encode();
    vm.mock_static_call(registry(), calldata, Ok(result.abi_encode()));
}

fn empty_bytes() -> stylus_sdk::abi::Bytes {
    stylus_sdk::abi::Bytes::from(Vec::<u8>::new())
}

/// The single value every cross-contract READ resolves to within one tx.
///
/// TestVM (stylus-test 0.10.7) has ONE global `return_data` buffer that every
/// `mock_*` registration overwrites, and `read_return_data(0, None)` always
/// returns the whole buffer (src/vm.rs:367, src/call/raw.rs:215). The matched
/// mock only sets `outs_len`, not the bytes the SDK reads back. So inside a
/// single contract call, the oracle price, PlinthMath.requiredMargin, and
/// Coffer.balanceOf all decode the SAME bytes, they must share one numeric
/// value. The control-flow consequence is exploited deliberately below:
///   - maintenance recompute: collateral == required  -> healthy (not paused)
///   - open recompute:        required * 1.5 > collateral -> auto-paused
/// (documented in `gaps`; the alternative would be patching the SDK's mock).
const V: u64 = 1_000;

/// Register oracle + math + coffer mocks that all return `value`. Order is
/// chosen so a 32-byte value mock is registered LAST (sets the shared buffer);
/// any mutating call returning nothing tolerates that buffer.
fn mock_reads(vm: &TestVM, owner: Address, notional: I256, value: u64) {
    mock_math_single(vm, notional, U256::from(value), U256::from(value));
    mock_oracle(vm, U256::from(value));
    mock_coffer(vm, owner, U256::from(value));
}

/// Open one position for `owner` (owner-direct path, empty sigils). Because of
/// the single-buffer constraint, the open-time 1.5x multiplier necessarily
/// auto-pauses the account (required*1.5 > collateral==required). We mock
/// Vigil.queueLiquidation so the queue succeeds; open returns Ok regardless.
fn open_one(vm: &TestVM, c: &mut Plinth, owner: Address, notional: I256) -> U256 {
    // Vigil queue is mutating (Call::new_mutating -> mock_call, value ZERO).
    // version becomes 1 after the open recompute. Registered BEFORE the value
    // mocks so it never claims the shared buffer (its return decodes as ()).
    mock_vigil_queue(vm, owner, U256::from(1));
    mock_reads(vm, owner, notional, V);
    vm.set_sender(owner);
    unwrap_ok(c.open_position(VENUE, instrument(), notional, empty_bytes(), empty_bytes()))
}

/// Mock Vigil.queueLiquidation(user, version) -> () . Mutating call: keyed by
/// (to, calldata, value=ZERO).
fn mock_vigil_queue(vm: &TestVM, who: Address, version: U256) {
    let sel = &alloy_primitives::keccak256("queueLiquidation(address,uint256)")[..4];
    let mut calldata = sel.to_vec();
    calldata.extend((who, version).abi_encode_params());
    vm.mock_call(vigil(), calldata, U256::ZERO, Ok(Vec::new()));
}

// =============================================================================
// open_position
// =============================================================================

#[test]
fn open_position_happy_path_persists_and_bumps_version() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);

    let notional = I256::try_from(5_000i64).unwrap();
    let pid = open_one(&vm, &mut c, user(), notional);
    assert_eq!(pid, U256::from(1), "first position id is 1");

    // Position persisted with our owner / venue / instrument / notional, and
    // the entry price snapshotted from the mocked oracle.
    let (owner, venue, instr, n, entry) = c.get_position(pid);
    assert_eq!(owner, user());
    assert_eq!(venue, VENUE);
    assert_eq!(instr, instrument());
    assert_eq!(n, notional);
    assert_eq!(entry, U256::from(V), "entry price = mocked oracle price");

    // User list tracks the new id.
    assert_eq!(c.get_user_positions(user()), vec![U256::from(1)]);

    // margin_version bumped to 1 by the open-time recompute.
    assert_eq!(c.get_margin_version(user()), U256::from(1));

    // The open-time recompute ran: collateral, required, version persisted.
    // required = math(V) * 1.5 (INITIAL_MARGIN_MULTIPLIER_BPS / 10_000).
    let (collat, req, ver, paused) = c.get_account(user());
    assert_eq!(collat, U256::from(V));
    assert_eq!(req, U256::from(V) * U256::from(15_000u64) / U256::from(10_000u64));
    assert_eq!(ver, U256::from(1));
    // Under the single-buffer constraint, required*1.5 > collateral, so the
    // open-time initial-margin multiplier auto-pauses the fresh account and
    // queues Vigil. A clean "healthy / not paused" case is asserted in
    // update_margin_keeps_healthy_account_unpaused below.
    assert!(paused, "open-time 1.5x initial margin trips the under-collateral guard");
}

#[test]
fn update_margin_keeps_healthy_account_unpaused() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    let notional = I256::try_from(5_000i64).unwrap();
    open_one(&vm, &mut c, user(), notional); // paused at open (1.5x)

    // Maintenance recompute: no 1.5x. collateral == required (== V) so the
    // account is healthy and the auto-heal clears the earlier pause.
    mock_reads(&vm, user(), notional, V);
    vm.set_sender(user());
    let req = unwrap_ok(c.update_margin(user()));
    assert_eq!(req, U256::from(V), "maintenance required = mocked math, no 1.5x");

    let (_collat, _req, _ver, paused) = c.get_account(user());
    assert!(!paused, "healthy account (collateral >= required) must auto-unpause");
}

#[test]
fn open_position_rejects_when_over_max_positions() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);

    // Pre-load the user's position-id list to the cap (100) directly via the
    // contract's own storage so we don't have to open 100 real positions.
    {
        let mut list = c.user_position_ids.setter(user());
        for i in 0..100u64 {
            list.push(U256::from(i + 1));
        }
    }

    // The position-count cap is checked before any oracle/math/coffer call,
    // so no read mocks are needed here.
    let notional = I256::try_from(5_000i64).unwrap();
    vm.set_sender(user());
    let r = c.open_position(VENUE, instrument(), notional, empty_bytes(), empty_bytes());
    expect_err_code(r, ERR_TOO_MANY_POSITIONS);
}

#[test]
fn open_position_rejects_stale_oracle() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);

    // Mock the oracle to REVERT (stale price). Plinth maps any oracle failure
    // to ERR_ORACLE_STALE.
    let calldata = safePriceCall {
        pyth_oracle: pyth(),
        chainlink_feed: chainlink(),
        pyth_feed_id: pyth_feed(),
        freshness_seconds: 60u64,
        tolerance_bps: 50u16,
    }
    .abi_encode();
    vm.mock_static_call(oracle(), calldata, Err(vec![0xde, 0xad]));

    let notional = I256::try_from(5_000i64).unwrap();
    vm.set_sender(user());
    let r = c.open_position(VENUE, instrument(), notional, empty_bytes(), empty_bytes());
    expect_err_code(r, ERR_ORACLE_STALE);
}

#[test]
fn open_position_rejects_unknown_instrument() {
    let (vm, mut c) = deploy();
    // No register_instrument -> instrument is not active.
    let notional = I256::try_from(5_000i64).unwrap();
    vm.set_sender(user());
    let r = c.open_position(VENUE, instrument(), notional, empty_bytes(), empty_bytes());
    expect_err_code(r, ERR_UNKNOWN_VENUE);
}

#[test]
fn open_position_rejects_when_globally_paused() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    vm.set_sender(praetor());
    unwrap_ok(c.pause(B256::ZERO));

    let notional = I256::try_from(5_000i64).unwrap();
    vm.set_sender(user());
    let r = c.open_position(VENUE, instrument(), notional, empty_bytes(), empty_bytes());
    expect_err_code(r, ERR_GLOBALLY_PAUSED);
}

// =============================================================================
// update_margin authorization + reentrancy + version bump
// =============================================================================

#[test]
fn update_margin_owner_authorized() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    let notional = I256::try_from(5_000i64).unwrap();
    open_one(&vm, &mut c, user(), notional);

    // Maintenance recompute (no 1.5x). All reads resolve to V.
    mock_reads(&vm, user(), notional, V);

    vm.set_sender(user());
    let req = unwrap_ok(c.update_margin(user()));
    assert_eq!(req, U256::from(V), "maintenance required = mocked math (no 1.5x)");
    // version bumped from 1 (open) to 2.
    assert_eq!(c.get_margin_version(user()), U256::from(2));
}

#[test]
fn update_margin_vigil_authorized() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    let notional = I256::try_from(5_000i64).unwrap();
    open_one(&vm, &mut c, user(), notional);

    mock_reads(&vm, user(), notional, V);

    vm.set_sender(vigil());
    assert!(is_ok(&c.update_margin(user())), "vigil keeper may recompute");
}

#[test]
fn update_margin_adapter_authorized() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    let notional = I256::try_from(5_000i64).unwrap();
    open_one(&vm, &mut c, user(), notional);

    // update_margin checks is_registered_adapter(caller) FIRST (before the
    // recompute), so register the registry bool LAST: it claims the shared
    // buffer (true == 1), which the subsequent oracle/math/coffer reads also
    // decode as 1 (price==required==collateral==1 -> healthy).
    mock_reads(&vm, user(), notional, V);
    mock_registry(&vm, stranger(), true);

    vm.set_sender(stranger());
    assert!(
        is_ok(&c.update_margin(user())),
        "registered adapter may recompute on a user's behalf"
    );
}

#[test]
fn update_margin_stranger_rejected() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    open_one(&vm, &mut c, user(), I256::try_from(5_000i64).unwrap());

    // stranger is NOT the owner, NOT vigil, NOT praetor, and registry returns
    // false for them.
    mock_registry(&vm, stranger(), false);
    vm.set_sender(stranger());
    expect_err_code(c.update_margin(user()), ERR_UNAUTHORIZED);
}

#[test]
fn update_margin_reentrancy_guard_rejects() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    open_one(&vm, &mut c, user(), I256::try_from(5_000i64).unwrap());

    // Simulate being mid-update: arm the guard, then a re-entrant call must
    // revert REENTRANT regardless of authorization.
    c.is_updating.set(true);
    vm.set_sender(user());
    expect_err_code(c.update_margin(user()), ERR_REENTRANT);
}

#[test]
fn margin_version_bumps_on_every_update() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    let notional = I256::try_from(5_000i64).unwrap();
    open_one(&vm, &mut c, user(), notional); // version -> 1

    mock_reads(&vm, user(), notional, V);

    vm.set_sender(user());
    unwrap_ok(c.update_margin(user()));
    assert_eq!(c.get_margin_version(user()), U256::from(2));
    unwrap_ok(c.update_margin(user()));
    assert_eq!(c.get_margin_version(user()), U256::from(3));
}

#[test]
fn update_margin_underwater_pauses_and_queues_vigil() {
    // The open-time recompute is the underwater path under the single-buffer
    // constraint: required = math(V)*1.5 > collateral = V. We assert it paused
    // the account, persisted the inflated required, AND that Vigil.queue
    // succeeded (no VigilQueueFailed event was emitted, the contract only
    // emits that on an Err from queue_liquidation).
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    let notional = I256::try_from(5_000i64).unwrap();
    let _pid = open_one(&vm, &mut c, user(), notional);

    let (collat, req, ver, paused) = c.get_account(user());
    assert!(paused, "underwater account must be auto-paused");
    assert_eq!(ver, U256::from(1));
    assert_eq!(collat, U256::from(V));
    assert_eq!(req, U256::from(V) * U256::from(15_000u64) / U256::from(10_000u64));
    assert!(req > collat, "required (1.5x) must exceed collateral");

    // AccountPaused(address,bytes32) must have been emitted; VigilQueueFailed
    // (address,uint256) must NOT (we mocked the queue to succeed).
    let paused_topic = alloy_primitives::keccak256("AccountPaused(address,bytes32)");
    let failed_topic = alloy_primitives::keccak256("VigilQueueFailed(address,uint256)");
    let logs = vm.get_emitted_logs();
    let saw_paused = logs.iter().any(|(topics, _)| topics.first() == Some(&paused_topic));
    let saw_failed = logs.iter().any(|(topics, _)| topics.first() == Some(&failed_topic));
    assert!(saw_paused, "expected an AccountPaused log on the underwater path");
    assert!(!saw_failed, "Vigil queue was mocked to succeed; no VigilQueueFailed");
}

// =============================================================================
// close_position authorization
// =============================================================================

#[test]
fn close_position_owner_authorized() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    let notional = I256::try_from(5_000i64).unwrap();
    let pid = open_one(&vm, &mut c, user(), notional);

    // close needs the current price (oracle) + the post-close update_margin
    // recompute. After removing the only position the list is empty, so
    // do_update_margin skips the math staticcall (notionals empty) but still
    // reads coffer.balanceOf. Both reads resolve to the same buffer value V.
    mock_oracle(&vm, U256::from(V));
    mock_coffer(&vm, user(), U256::from(V));

    vm.set_sender(user());
    unwrap_ok(c.close_position(pid));
    // Position cleared.
    let (owner, _v, _i, n, _e) = c.get_position(pid);
    assert_eq!(owner, Address::ZERO);
    assert_eq!(n, I256::ZERO);
    assert!(c.get_user_positions(user()).is_empty());
}

#[test]
fn close_position_vigil_authorized() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    let notional = I256::try_from(5_000i64).unwrap();
    let pid = open_one(&vm, &mut c, user(), notional);

    mock_oracle(&vm, U256::from(V));
    mock_coffer(&vm, user(), U256::from(V));

    vm.set_sender(vigil());
    unwrap_ok(c.close_position(pid));
}

#[test]
fn close_position_stranger_rejected() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    let notional = I256::try_from(5_000i64).unwrap();
    let pid = open_one(&vm, &mut c, user(), notional);

    vm.set_sender(stranger());
    expect_err_code(c.close_position(pid), ERR_UNAUTHORIZED);
    // Position untouched.
    let (owner, _v, _i, n, _e) = c.get_position(pid);
    assert_eq!(owner, user());
    assert_eq!(n, notional);
}

#[test]
fn close_position_reentrancy_guard_rejects() {
    let (vm, mut c) = deploy();
    register_instrument(&vm, &mut c);
    let pid = open_one(&vm, &mut c, user(), I256::try_from(5_000i64).unwrap());

    c.is_updating.set(true);
    vm.set_sender(user());
    expect_err_code(c.close_position(pid), ERR_REENTRANT);
}

// =============================================================================
// pause / resume authorization
// =============================================================================

#[test]
fn pause_allows_multisig_and_timelock() {
    // multisig path
    let (vm, mut c) = deploy();
    vm.set_sender(praetor());
    unwrap_ok(c.pause(B256::ZERO));
    // resume to clear (timelock only).
    vm.set_sender(timelock());
    unwrap_ok(c.resume());

    // timelock path (forwarded emergencyPause)
    vm.set_sender(timelock());
    unwrap_ok(c.pause(B256::ZERO));
}

#[test]
fn pause_rejects_stranger() {
    let (vm, mut c) = deploy();
    vm.set_sender(stranger());
    expect_err_code(c.pause(B256::ZERO), ERR_UNAUTHORIZED);
}

#[test]
fn resume_rejects_multisig_and_stranger() {
    let (vm, mut c) = deploy();
    // Pause first (multisig allowed).
    vm.set_sender(praetor());
    unwrap_ok(c.pause(B256::ZERO));

    // Multisig may NOT resume (timelock-only).
    vm.set_sender(praetor());
    expect_err_code(c.resume(), ERR_UNAUTHORIZED);
    // Stranger may NOT resume.
    vm.set_sender(stranger());
    expect_err_code(c.resume(), ERR_UNAUTHORIZED);
    // Timelock can.
    vm.set_sender(timelock());
    unwrap_ok(c.resume());
}

// =============================================================================
// set_instrument_risk authorization + correlation-class guard
// =============================================================================

#[test]
fn set_instrument_risk_timelock_only() {
    let (vm, mut c) = deploy();

    // Multisig (not timelock) is rejected: parameter changes are 48h-gated.
    vm.set_sender(praetor());
    expect_err_code(
        c.set_instrument_risk(VENUE, instrument(), HAIRCUT_BPS, CORR_CLASS, pyth_feed(), chainlink(), true),
        ERR_UNAUTHORIZED,
    );

    // Stranger rejected too.
    vm.set_sender(stranger());
    expect_err_code(
        c.set_instrument_risk(VENUE, instrument(), HAIRCUT_BPS, CORR_CLASS, pyth_feed(), chainlink(), true),
        ERR_UNAUTHORIZED,
    );

    // Timelock succeeds.
    vm.set_sender(timelock());
    unwrap_ok(c.set_instrument_risk(VENUE, instrument(), HAIRCUT_BPS, CORR_CLASS, pyth_feed(), chainlink(), true));
}

#[test]
fn set_instrument_risk_rejects_correlation_class_zero() {
    let (vm, mut c) = deploy();
    vm.set_sender(timelock());
    // class 0 is reserved (no-netting sentinel) and must be rejected.
    expect_err_code(
        c.set_instrument_risk(VENUE, instrument(), HAIRCUT_BPS, 0, pyth_feed(), chainlink(), true),
        ERR_CORRELATION_CLASS_OOR,
    );
}

#[test]
fn set_instrument_risk_rejects_correlation_class_at_or_above_max() {
    let (vm, mut c) = deploy();
    vm.set_sender(timelock());
    // max_correlation_classes default is 16; class 16 is out of range.
    expect_err_code(
        c.set_instrument_risk(VENUE, instrument(), HAIRCUT_BPS, 16, pyth_feed(), chainlink(), true),
        ERR_CORRELATION_CLASS_OOR,
    );
}

// =============================================================================
// constructor wiring sanity (init-state getters used by deployment-status API)
// =============================================================================

#[test]
fn constructor_wires_admin_addresses() {
    let (_vm, c) = deploy();
    assert_eq!(c.praetor_multisig(), praetor());
    assert_eq!(c.praetor_timelock(), timelock());
    assert_eq!(c.coffer_address(), coffer());
    assert_eq!(c.vigil_address(), vigil());
    assert_eq!(c.sigil_address(), sigil());
}
