// Host-level unit tests for Sigil using stylus-sdk's `stylus-test` TestVM.
//
// The crate is crate-type=["lib","cdylib"]; under a plain native `cargo test`
// the WasmVM host does not link. The `stylus-sdk/stylus-test` dev-dep swaps in
// a native TestVM mock host so these run on the dev box. End-to-end tests
// against the deployed contract on Sepolia live in tests/foundry/.
//
// These tests exercise the REAL contract surface as deployed by
// `scripts/redeploy-stylus.mjs` (deploy with no constructor args, then call
// `initialize(address,address,address,address,address)`). They deliberately do
// NOT assume a `#[constructor]` entry, an `action_nonce` replay guard, or an
// EIP-2 upper-s rejection — none of those exist on the canonical contract.
//
// Coverage:
//  - initialize() sets the admin slots + re-init / zero-arg guards
//  - validate_action happy path (real k256 sig, precompile mocked to the
//    address k256 recovers) -> Ok(true)
//  - signature recovery rejects a forged owner sig and a forged agent sig
//  - caps: unauthorized venue / oversize per-action notional revert with the
//    specific typed error
//  - rate-limit enforcement once the per-day count hits the effective cap
//  - credit-line CUMULATIVE-only accounting (open_notional only grows on
//    validate; record_close decrements; Plinth-only auth on record_close)
//  - revoke / revoke_all / revoke_all_on_behalf_of mark intent/nonce revoked
//  - pause/resume auth + paused validate_action reverts
//  - EIP-712 domain separator stability for fixed inputs

#![cfg(test)]

use super::*;
use crate::eip712::{self, ActionSigil, IntentSigil, Signature};
use alloy_primitives::{address, hex, keccak256, Address, FixedBytes, I256, U256, B256};
use stylus_sdk::testing::TestVM;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRAETOR: Address = address!("00000000000000000000000000000000000000A1");
const TIMELOCK: Address = address!("00000000000000000000000000000000000000A2");
const PLINTH: Address = address!("00000000000000000000000000000000000000A3");
const REGISTRY: Address = address!("00000000000000000000000000000000000000A4");
const KILL_SWITCH: Address = address!("00000000000000000000000000000000000000A5");

// secp256k1 private keys (arbitrary non-zero scalars, < n). Used to make REAL
// signatures so the recovery path is exercised end-to-end (the precompile is
// then mocked to return exactly what k256 recovers — a faithful 0x01 stub).
const OWNER_PK: [u8; 32] = [
    0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11,
    0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11,
];
const AGENT_PK: [u8; 32] = [
    0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22,
    0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22,
];
const STRANGER_PK: [u8; 32] = [
    0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33,
    0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33,
];

const TEST_CHAIN_ID: u64 = 421614; // Arbitrum Sepolia
const SIGIL_CONTRACT: Address = address!("00000000000000000000000000000000000000C1");
const ECRECOVER_PRECOMPILE: Address = address!("0000000000000000000000000000000000000001");

/// `SigilError` deliberately does not derive `Debug`/`PartialEq` on the
/// production type (keeps the on-chain error codegen minimal). These test-only
/// helpers give readable assertions without touching the contract type.
fn err_name(e: &SigilError) -> &'static str {
    match e {
        SigilError::InvalidSignature(_) => "InvalidSignature",
        SigilError::MandateExpired(_) => "MandateExpired",
        SigilError::VenueNotAllowed(_) => "VenueNotAllowed",
        SigilError::InstrumentNotAllowed(_) => "InstrumentNotAllowed",
        SigilError::NotionalExceeded(_) => "NotionalExceeded",
        SigilError::RateLimitExceeded(_) => "RateLimitExceeded",
        SigilError::MandateRevoked(_) => "MandateRevoked",
        SigilError::Unauthorized(_) => "Unauthorized",
        SigilError::CreditCapExceeded(_) => "CreditCapExceeded",
        SigilError::Paused(_) => "Paused",
        SigilError::Reentrant(_) => "Reentrant",
    }
}

#[track_caller]
fn assert_ok_true(res: Result<bool, SigilError>) {
    match res {
        Ok(true) => {}
        Ok(false) => panic!("expected Ok(true), got Ok(false)"),
        Err(e) => panic!("expected Ok(true), got Err({})", err_name(&e)),
    }
}

/// Derive the Ethereum address for a secp256k1 private key (uncompressed
/// pubkey -> keccak -> low 20 bytes).
fn addr_for_pk(pk: &[u8; 32]) -> Address {
    use k256::ecdsa::{SigningKey, VerifyingKey};
    let signing = SigningKey::from_slice(pk).expect("valid sk");
    let verifying: VerifyingKey = *signing.verifying_key();
    let encoded = verifying.to_encoded_point(false);
    let pub_bytes = encoded.as_bytes();
    let hash = keccak256(&pub_bytes[1..]);
    let mut a = [0u8; 20];
    a.copy_from_slice(&hash[12..32]);
    Address::from(a)
}

/// Sign a 32-byte digest with secp256k1, returning a Signature with v in
/// {27,28}. k256 normalises s low by default, which is what the contract's
/// `ecrecover_via_precompile` accept-list ({0,1,27,28}) and the off-chain
/// signer both produce.
fn sign_digest(pk: &[u8; 32], digest: &B256) -> Signature {
    use k256::ecdsa::{RecoveryId, SigningKey};
    let signing = SigningKey::from_slice(pk).expect("valid sk");
    let (sig, rec_id): (k256::ecdsa::Signature, RecoveryId) = signing
        .sign_prehash_recoverable(digest.as_slice())
        .expect("sign");
    let bytes = sig.to_bytes(); // 64 bytes r||s, already low-s
    let mut r = [0u8; 32];
    let mut s = [0u8; 32];
    r.copy_from_slice(&bytes[0..32]);
    s.copy_from_slice(&bytes[32..64]);
    Signature {
        r: FixedBytes::<32>::from(r),
        s: FixedBytes::<32>::from(s),
        v: rec_id.to_byte() + 27,
    }
}

/// The exact 128-byte calldata the contract builds for the 0x01 precompile,
/// given a digest + signature. We replicate it so we can register a mock that
/// returns the address k256 recovers — a faithful stand-in for the real
/// precompile (TestVM does not execute precompiles natively).
fn ecrecover_calldata(digest: &B256, sig: &Signature) -> Vec<u8> {
    let mut calldata = [0u8; 128];
    calldata[0..32].copy_from_slice(digest.as_slice());
    // v normalization mirrors ecrecover_via_precompile: {0,1}->+27, {27,28} as-is
    let v_byte = match sig.v {
        0 | 1 => sig.v + 27,
        other => other,
    };
    calldata[63] = v_byte;
    calldata[64..96].copy_from_slice(sig.r.as_slice());
    calldata[96..128].copy_from_slice(sig.s.as_slice());
    calldata.to_vec()
}

/// Address right-padded into a 32-byte word the way the precompile returns it.
fn precompile_return(addr: Address) -> Vec<u8> {
    let mut out = [0u8; 32];
    out[12..32].copy_from_slice(addr.as_slice());
    out.to_vec()
}

/// The Sigil EIP-712 domain separator for the test fixture (name="AtriumSigil",
/// version="1"), matching what validate_action computes internally.
fn fixture_domain_sep() -> B256 {
    let name_hash = keccak256(b"AtriumSigil");
    let version_hash = keccak256(b"1");
    eip712::domain_separator(
        B256::from(name_hash.0),
        B256::from(version_hash.0),
        U256::from(TEST_CHAIN_ID),
        SIGIL_CONTRACT,
    )
}

// ---- envelope encoders (flat format per eip712::decode_intent/decode_action) ----

fn encode_intent(body: &IntentSigil, sig: &Signature) -> Vec<u8> {
    let mut buf = Vec::new();
    // [0..32) owner (right-aligned)
    let mut word = [0u8; 32];
    word[12..32].copy_from_slice(body.owner.as_slice());
    buf.extend_from_slice(&word);
    // [32..64) agent
    let mut word = [0u8; 32];
    word[12..32].copy_from_slice(body.agent.as_slice());
    buf.extend_from_slice(&word);
    // [64..96) max_notional_per_action_wei
    buf.extend_from_slice(&body.max_notional_per_action_wei.to_be_bytes::<32>());
    // [96..128) max_total_open_notional_wei
    buf.extend_from_slice(&body.max_total_open_notional_wei.to_be_bytes::<32>());
    // [128..160) max_actions_per_24h (right-aligned u32 in last 4 bytes)
    let mut word = [0u8; 32];
    word[28..32].copy_from_slice(&body.max_actions_per_24h.to_be_bytes());
    buf.extend_from_slice(&word);
    // [160..192) expires_at (right-aligned u64)
    let mut word = [0u8; 32];
    word[24..32].copy_from_slice(&body.expires_at.to_be_bytes());
    buf.extend_from_slice(&word);
    // [192..224) nonce
    buf.extend_from_slice(&body.nonce.to_be_bytes::<32>());
    // [224..256) agent_revocation_nonce_at_signing (right-aligned u64)
    let mut word = [0u8; 32];
    word[24..32].copy_from_slice(&body.agent_revocation_nonce_at_signing.to_be_bytes());
    buf.extend_from_slice(&word);
    // venues_count + venues
    buf.extend_from_slice(&U256::from(body.venues_allowed.len()).to_be_bytes::<32>());
    for &v in &body.venues_allowed {
        let mut word = [0u8; 32];
        word[31] = v;
        buf.extend_from_slice(&word);
    }
    // instruments_count + instruments
    buf.extend_from_slice(&U256::from(body.instruments_allowed.len()).to_be_bytes::<32>());
    for inst in &body.instruments_allowed {
        buf.extend_from_slice(inst.as_slice());
    }
    // trailing 65-byte signature r||s||v
    buf.extend_from_slice(sig.r.as_slice());
    buf.extend_from_slice(sig.s.as_slice());
    buf.push(sig.v);
    buf
}

fn encode_action(body: &ActionSigil, sig: &Signature) -> Vec<u8> {
    let mut buf = Vec::new();
    // [0..32) intent_hash
    buf.extend_from_slice(body.intent_hash.as_slice());
    // [32..64) venue_id (byte at offset 63)
    let mut word = [0u8; 32];
    word[31] = body.venue_id;
    buf.extend_from_slice(&word);
    // [64..96) instrument_id
    buf.extend_from_slice(body.instrument_id.as_slice());
    // [96..128) notional_signed (two's complement big-endian)
    buf.extend_from_slice(&body.notional_signed.to_be_bytes::<32>());
    // [128..160) submitted_at (right-aligned u64 -> byte 152..160)
    let mut word = [0u8; 32];
    word[24..32].copy_from_slice(&body.submitted_at.to_be_bytes());
    buf.extend_from_slice(&word);
    // [160..192) action_nonce
    buf.extend_from_slice(&body.action_nonce.to_be_bytes::<32>());
    // trailing 65-byte signature
    buf.extend_from_slice(sig.r.as_slice());
    buf.extend_from_slice(sig.s.as_slice());
    buf.push(sig.v);
    buf
}

/// Build a default valid IntentSigil for the owner/agent fixtures.
fn default_intent(owner: Address, agent: Address) -> IntentSigil {
    IntentSigil {
        owner,
        agent,
        venues_allowed: vec![1, 2, 3],
        instruments_allowed: vec![FixedBytes::<32>::from([0x07u8; 32])],
        max_notional_per_action_wei: U256::from(10_000u64) * U256::from(1_000_000u64), // $10k
        max_total_open_notional_wei: U256::from(40_000u64) * U256::from(1_000_000u64), // $40k
        max_actions_per_24h: 5,
        expires_at: 4_000_000_000, // far future
        nonce: U256::ZERO,
        agent_revocation_nonce_at_signing: 0,
    }
}

/// Happy-path intent where the owner runs their own agent key:
/// owner == agent == addr_for_pk(OWNER_PK). Required by `valid_envelopes` so
/// both precompile recoveries return the same address through TestVM's single
/// `return_data` slot (see the doc-comment on `valid_envelopes`).
fn happy_intent() -> IntentSigil {
    let signer = addr_for_pk(&OWNER_PK);
    default_intent(signer, signer)
}

fn default_action(intent_hash: B256, notional: i64, action_nonce: u64) -> ActionSigil {
    ActionSigil {
        intent_hash: FixedBytes::<32>::from(intent_hash.0),
        venue_id: 1,
        instrument_id: FixedBytes::<32>::from([0x07u8; 32]),
        notional_signed: I256::try_from(notional).unwrap(),
        submitted_at: 1_000_000,
        action_nonce: U256::from(action_nonce),
    }
}

/// Spin up a Sigil bound to a TestVM with the fixture admins and chain/contract
/// context, initialized through the REAL `initialize(...)` entry point that
/// `scripts/redeploy-stylus.mjs` calls post-deploy. block_timestamp is set
/// inside the mandate window.
fn setup() -> (TestVM, Sigil) {
    let vm = TestVM::new();
    vm.set_chain_id(TEST_CHAIN_ID);
    vm.set_contract_address(SIGIL_CONTRACT);
    vm.set_block_number(100);
    vm.set_block_timestamp(1_000_000); // day 11 (1_000_000 / 86400)
    let mut sigil = Sigil::from(&vm);
    vm.set_sender(PRAETOR);
    // SigilError intentionally has no Debug derive (minimal on-chain codegen),
    // so assert on is_ok() rather than .expect().
    assert!(
        sigil
            .initialize(PRAETOR, TIMELOCK, PLINTH, REGISTRY, KILL_SWITCH)
            .is_ok(),
        "initialize must succeed for a fresh contract"
    );
    (vm, sigil)
}

/// Wire up a fully-valid intent+action pair with REAL k256 signatures, then
/// mock the 0x01 ecrecover precompile to return exactly what k256 recovers.
///
/// TestVM CONSTRAINT (verified against stylus-test 0.10.7 src/vm.rs): the mock
/// host serves precompile return bytes from a single `state.return_data` slot
/// that is overwritten at mock-REGISTRATION time and is NOT updated per-key by
/// `perform_mocked_static_call`. validate_action makes TWO precompile calls
/// (owner sig, then agent sig) and reads `return_data` after each — so both
/// reads see the SAME bytes. The only way both the owner-check and the
/// agent-check can pass in one invocation is for both recovered addresses to be
/// identical. We therefore use a single signer for the happy path: the owner
/// runs their own agent key (intent.owner == intent.agent == addr_for_pk(pk)).
/// This still exercises the real recovery path end-to-end (digest build,
/// precompile call, recovered == claimed comparison) for BOTH envelopes.
/// Forged-signature tests below deliberately use distinct keys and assert the
/// FIRST mismatch reverts, which the single-slot model serves fine.
fn valid_envelopes(
    vm: &TestVM,
    intent: &IntentSigil,
    action_notional: i64,
    action_nonce: u64,
) -> (Vec<u8>, Vec<u8>, B256) {
    // The happy-path intent fixtures set owner == agent == addr_for_pk(OWNER_PK),
    // so a single key signs both envelopes and the single return_data slot
    // serves both recoveries.
    assert_eq!(
        intent.owner, intent.agent,
        "valid_envelopes requires owner == agent (TestVM single return_data slot)"
    );
    let signer_addr = intent.owner;
    let domain_sep = fixture_domain_sep();

    let intent_struct_hash = eip712::hash_intent(intent);
    let intent_digest = eip712::final_digest(domain_sep, intent_struct_hash);
    let owner_sig = sign_digest(&OWNER_PK, &intent_digest);

    let action = default_action(intent_struct_hash, action_notional, action_nonce);
    let action_struct_hash = eip712::hash_action(&action);
    let action_digest = eip712::final_digest(domain_sep, action_struct_hash);
    let agent_sig = sign_digest(&OWNER_PK, &action_digest);

    // Both keys map to signer_addr; register both calldata keys returning it.
    // Registration order is irrelevant since both return the same bytes.
    vm.mock_static_call(
        ECRECOVER_PRECOMPILE,
        ecrecover_calldata(&intent_digest, &owner_sig),
        Ok(precompile_return(signer_addr)),
    );
    vm.mock_static_call(
        ECRECOVER_PRECOMPILE,
        ecrecover_calldata(&action_digest, &agent_sig),
        Ok(precompile_return(signer_addr)),
    );

    let intent_bytes = encode_intent(intent, &owner_sig);
    let action_bytes = encode_action(&action, &agent_sig);
    (intent_bytes, action_bytes, intent_struct_hash)
}

// ---------------------------------------------------------------------------
// Sanity: fixture keys + address derivation are internally consistent
// ---------------------------------------------------------------------------

#[test]
fn fixture_keys_recover_to_expected_addresses() {
    // The module's own k256 software recovery path must round-trip a sig made
    // with our helper. This guards the precompile-mock fidelity: if k256 ever
    // recovered a different address than addr_for_pk, the happy-path mock would
    // be lying. Lock the two together.
    let owner = addr_for_pk(&OWNER_PK);
    let agent = addr_for_pk(&AGENT_PK);
    assert_ne!(owner, agent);

    let digest = B256::from([0xABu8; 32]);
    let sig = sign_digest(&OWNER_PK, &digest);
    let recovered = eip712::recover_signer(&digest, &sig).expect("recover");
    assert_eq!(recovered, owner, "k256 recovery must match addr_for_pk");
}

// ---------------------------------------------------------------------------
// initialize() — admin wiring + guards (the slots the deploy script sets)
// ---------------------------------------------------------------------------

#[test]
fn initialize_sets_admin_slots() {
    let (_vm, sigil) = setup();
    assert_eq!(sigil.praetor_multisig(), PRAETOR);
    assert_eq!(sigil.praetor_timelock(), TIMELOCK);
    assert_eq!(sigil.plinth_address(), PLINTH);
}

#[test]
fn initialize_is_one_shot() {
    // Audit F-G + re-init guard: once praetor_multisig is set, a second
    // initialize must revert. This is the guard that the manual-initialize
    // pattern needs (a `#[constructor]` would get this implicitly; this
    // contract does not use one — see scripts/redeploy-stylus.mjs).
    let (vm, mut sigil) = setup();
    vm.set_sender(PRAETOR);
    let res = sigil.initialize(PRAETOR, TIMELOCK, PLINTH, REGISTRY, KILL_SWITCH);
    assert!(
        matches!(res, Err(SigilError::Unauthorized(_))),
        "second initialize must revert Unauthorized, got {}",
        res.as_ref().err().map(err_name).unwrap_or("Ok")
    );
}

#[test]
fn initialize_rejects_zero_admin_args() {
    // Zero praetor or timelock would brick the contract (no one could pause /
    // resume / govern). initialize must refuse.
    let vm = TestVM::new();
    vm.set_chain_id(TEST_CHAIN_ID);
    vm.set_contract_address(SIGIL_CONTRACT);
    let mut sigil = Sigil::from(&vm);
    vm.set_sender(PRAETOR);
    let res = sigil.initialize(Address::ZERO, TIMELOCK, PLINTH, REGISTRY, KILL_SWITCH);
    assert!(
        matches!(res, Err(SigilError::Unauthorized(_))),
        "zero praetor must revert, got {}",
        res.as_ref().err().map(err_name).unwrap_or("Ok")
    );
    // And the contract is still uninitialized (slot stayed zero), so a proper
    // initialize can still run afterwards.
    assert!(sigil.praetor_multisig().is_zero());
}

// ---------------------------------------------------------------------------
// validate_action — happy path + signature recovery
// ---------------------------------------------------------------------------

#[test]
fn validate_action_happy_path_returns_true() {
    let (vm, mut sigil) = setup();
    let intent = happy_intent();
    let agent = intent.agent;
    let (intent_bytes, action_bytes, _h) = valid_envelopes(&vm, &intent, 1_000_000, 1);

    vm.set_sender(PLINTH); // Plinth drives validate_action
    assert_ok_true(sigil.validate_action(intent_bytes, action_bytes));

    // The credit-line counter advanced by the action's notional.
    assert_eq!(
        sigil.get_open_notional(agent),
        U256::from(1_000_000u64),
        "open_notional must record the opened size"
    );
}

#[test]
fn validate_action_rejects_forged_owner_signature() {
    let (vm, mut sigil) = setup();
    let owner = addr_for_pk(&OWNER_PK);
    let agent = addr_for_pk(&AGENT_PK);
    let intent = default_intent(owner, agent);
    let domain_sep = fixture_domain_sep();

    // Owner envelope signed by the STRANGER, not the owner. The precompile
    // mock faithfully returns the stranger's address -> recovery != owner.
    let intent_struct_hash = eip712::hash_intent(&intent);
    let intent_digest = eip712::final_digest(domain_sep, intent_struct_hash);
    let forged = sign_digest(&STRANGER_PK, &intent_digest);
    vm.mock_static_call(
        ECRECOVER_PRECOMPILE,
        ecrecover_calldata(&intent_digest, &forged),
        Ok(precompile_return(addr_for_pk(&STRANGER_PK))),
    );

    // Action is properly signed by the agent so we isolate the owner-sig check.
    let action = default_action(intent_struct_hash, 1_000_000, 1);
    let action_struct_hash = eip712::hash_action(&action);
    let action_digest = eip712::final_digest(domain_sep, action_struct_hash);
    let agent_sig = sign_digest(&AGENT_PK, &action_digest);
    vm.mock_static_call(
        ECRECOVER_PRECOMPILE,
        ecrecover_calldata(&action_digest, &agent_sig),
        Ok(precompile_return(agent)),
    );

    let intent_bytes = encode_intent(&intent, &forged);
    let action_bytes = encode_action(&action, &agent_sig);

    vm.set_sender(PLINTH);
    let res = sigil.validate_action(intent_bytes, action_bytes);
    assert!(
        matches!(res, Err(SigilError::InvalidSignature(_))),
        "forged owner sig must revert InvalidSignature, got {}",
        res.as_ref().err().map(err_name).unwrap_or("Ok")
    );
    // No counters should have advanced.
    assert_eq!(sigil.get_open_notional(agent), U256::ZERO);
}

#[test]
fn validate_action_rejects_forged_agent_signature() {
    let (vm, mut sigil) = setup();
    let owner = addr_for_pk(&OWNER_PK);
    let agent = addr_for_pk(&AGENT_PK);
    let intent = default_intent(owner, agent);
    let domain_sep = fixture_domain_sep();

    // Owner sig is valid.
    let intent_struct_hash = eip712::hash_intent(&intent);
    let intent_digest = eip712::final_digest(domain_sep, intent_struct_hash);
    let owner_sig = sign_digest(&OWNER_PK, &intent_digest);
    vm.mock_static_call(
        ECRECOVER_PRECOMPILE,
        ecrecover_calldata(&intent_digest, &owner_sig),
        Ok(precompile_return(owner)),
    );

    // Action signed by the STRANGER, not the agent -> recovery != agent.
    let action = default_action(intent_struct_hash, 1_000_000, 1);
    let action_struct_hash = eip712::hash_action(&action);
    let action_digest = eip712::final_digest(domain_sep, action_struct_hash);
    let forged = sign_digest(&STRANGER_PK, &action_digest);
    vm.mock_static_call(
        ECRECOVER_PRECOMPILE,
        ecrecover_calldata(&action_digest, &forged),
        Ok(precompile_return(addr_for_pk(&STRANGER_PK))),
    );

    let intent_bytes = encode_intent(&intent, &owner_sig);
    let action_bytes = encode_action(&action, &forged);

    vm.set_sender(PLINTH);
    let res = sigil.validate_action(intent_bytes, action_bytes);
    assert!(
        matches!(res, Err(SigilError::InvalidSignature(_))),
        "forged agent sig must revert InvalidSignature, got {}",
        res.as_ref().err().map(err_name).unwrap_or("Ok")
    );
}

// ---------------------------------------------------------------------------
// Caps — venue / notional (host-level, full validate path)
// ---------------------------------------------------------------------------

#[test]
fn validate_action_rejects_unauthorized_venue() {
    let (vm, mut sigil) = setup();
    let owner = addr_for_pk(&OWNER_PK);
    let agent = addr_for_pk(&AGENT_PK);
    let intent = default_intent(owner, agent);
    let domain_sep = fixture_domain_sep();

    let intent_struct_hash = eip712::hash_intent(&intent);
    let intent_digest = eip712::final_digest(domain_sep, intent_struct_hash);
    let owner_sig = sign_digest(&OWNER_PK, &intent_digest);
    vm.mock_static_call(
        ECRECOVER_PRECOMPILE,
        ecrecover_calldata(&intent_digest, &owner_sig),
        Ok(precompile_return(owner)),
    );

    // venue 99 is not in venues_allowed [1,2,3].
    let mut action = default_action(intent_struct_hash, 1_000_000, 1);
    action.venue_id = 99;
    let action_struct_hash = eip712::hash_action(&action);
    let action_digest = eip712::final_digest(domain_sep, action_struct_hash);
    let agent_sig = sign_digest(&AGENT_PK, &action_digest);
    vm.mock_static_call(
        ECRECOVER_PRECOMPILE,
        ecrecover_calldata(&action_digest, &agent_sig),
        Ok(precompile_return(agent)),
    );

    let intent_bytes = encode_intent(&intent, &owner_sig);
    let action_bytes = encode_action(&action, &agent_sig);

    vm.set_sender(PLINTH);
    let res = sigil.validate_action(intent_bytes, action_bytes);
    match res {
        Err(SigilError::VenueNotAllowed(e)) => assert_eq!(e.venue_id, 99),
        Err(e) => panic!("expected VenueNotAllowed(99), got Err({})", err_name(&e)),
        Ok(v) => panic!("expected VenueNotAllowed(99), got Ok({v})"),
    }
}

#[test]
fn validate_action_rejects_oversize_notional() {
    let (vm, mut sigil) = setup();
    let owner = addr_for_pk(&OWNER_PK);
    let agent = addr_for_pk(&AGENT_PK);
    let intent = default_intent(owner, agent); // per-action cap = $10k * 1e6
    let domain_sep = fixture_domain_sep();

    let intent_struct_hash = eip712::hash_intent(&intent);
    let intent_digest = eip712::final_digest(domain_sep, intent_struct_hash);
    let owner_sig = sign_digest(&OWNER_PK, &intent_digest);
    vm.mock_static_call(
        ECRECOVER_PRECOMPILE,
        ecrecover_calldata(&intent_digest, &owner_sig),
        Ok(precompile_return(owner)),
    );

    // 20_000 * 1e6 > per-action cap of 10_000 * 1e6.
    let over = 20_000i64 * 1_000_000i64;
    let action = default_action(intent_struct_hash, over, 1);
    let action_struct_hash = eip712::hash_action(&action);
    let action_digest = eip712::final_digest(domain_sep, action_struct_hash);
    let agent_sig = sign_digest(&AGENT_PK, &action_digest);
    vm.mock_static_call(
        ECRECOVER_PRECOMPILE,
        ecrecover_calldata(&action_digest, &agent_sig),
        Ok(precompile_return(agent)),
    );

    let intent_bytes = encode_intent(&intent, &owner_sig);
    let action_bytes = encode_action(&action, &agent_sig);

    vm.set_sender(PLINTH);
    let res = sigil.validate_action(intent_bytes, action_bytes);
    match res {
        Err(SigilError::NotionalExceeded(e)) => {
            assert_eq!(e.attempted, U256::from(over as u64));
            assert_eq!(e.cap, intent.max_notional_per_action_wei);
        }
        Err(e) => panic!("expected NotionalExceeded, got Err({})", err_name(&e)),
        Ok(v) => panic!("expected NotionalExceeded, got Ok({v})"),
    }
}

// ---------------------------------------------------------------------------
// Rate limit — per agent per UTC day
// ---------------------------------------------------------------------------

#[test]
fn validate_action_enforces_per_day_rate_limit() {
    let (vm, mut sigil) = setup();
    // Tight effective cap: intent cap 2 < hard cap 100.
    let mut intent = happy_intent();
    intent.max_actions_per_24h = 2;

    vm.set_sender(PLINTH);

    // First two actions (distinct action nonces, sub-cap notional) succeed.
    for nonce in 1u64..=2 {
        let (ib, ab, _) = valid_envelopes(&vm, &intent, 100_000, nonce);
        assert_ok_true(sigil.validate_action(ib, ab));
    }

    // Third action in the same day hits the rate limit.
    let (ib, ab, _) = valid_envelopes(&vm, &intent, 100_000, 3);
    match sigil.validate_action(ib, ab) {
        Err(SigilError::RateLimitExceeded(e)) => {
            assert_eq!(e.cap, 2, "effective cap is the tighter intent cap");
            assert_eq!(e.attempted, 3);
        }
        Err(e) => panic!("expected RateLimitExceeded, got Err({})", err_name(&e)),
        Ok(v) => panic!("expected RateLimitExceeded, got Ok({v})"),
    }
}

// ---------------------------------------------------------------------------
// Credit line — CUMULATIVE-only accounting + record_close decrement
// ---------------------------------------------------------------------------

#[test]
fn credit_line_is_cumulative_and_caps() {
    let (vm, mut sigil) = setup();
    // max_total_open = $40k*1e6, per-action = $10k*1e6, 5 actions/day allowed.
    let intent = happy_intent();
    let agent = intent.agent;

    vm.set_sender(PLINTH);

    // Four $10k opens consume the full $40k credit line cumulatively.
    let chunk = 10_000i64 * 1_000_000i64;
    for nonce in 1u64..=4 {
        let (ib, ab, _) = valid_envelopes(&vm, &intent, chunk, nonce);
        assert_ok_true(sigil.validate_action(ib, ab));
    }
    assert_eq!(
        sigil.get_open_notional(agent),
        U256::from(40_000u64) * U256::from(1_000_000u64),
        "open_notional accumulates across opens"
    );

    // Fifth $10k open would push cumulative to $50k > $40k credit cap -> reject.
    let (ib, ab, _) = valid_envelopes(&vm, &intent, chunk, 5);
    match sigil.validate_action(ib, ab) {
        Err(SigilError::CreditCapExceeded(e)) => {
            assert_eq!(e.max_credit, intent.max_total_open_notional_wei);
            assert_eq!(
                e.attempted_open,
                U256::from(50_000u64) * U256::from(1_000_000u64)
            );
        }
        Err(e) => panic!("expected CreditCapExceeded, got Err({})", err_name(&e)),
        Ok(v) => panic!("expected CreditCapExceeded, got Ok({v})"),
    }
    // Cumulative counter did NOT advance on the rejected open.
    assert_eq!(
        sigil.get_open_notional(agent),
        U256::from(40_000u64) * U256::from(1_000_000u64)
    );
}

#[test]
fn record_close_decrements_open_notional_plinth_only() {
    let (vm, mut sigil) = setup();
    let intent = happy_intent();
    let agent = intent.agent;

    // Open $10k via the happy path so open_notional = 10_000*1e6.
    vm.set_sender(PLINTH);
    let chunk = 10_000i64 * 1_000_000i64;
    let (ib, ab, _) = valid_envelopes(&vm, &intent, chunk, 1);
    assert_ok_true(sigil.validate_action(ib, ab));
    let opened = U256::from(10_000u64) * U256::from(1_000_000u64);
    assert_eq!(sigil.get_open_notional(agent), opened);

    // A stranger cannot call record_close.
    vm.set_sender(address!("000000000000000000000000000000000000dEaD"));
    let res = sigil.record_close(agent, U256::from(1u64));
    assert!(
        matches!(res, Err(SigilError::Unauthorized(_))),
        "record_close must be Plinth-only"
    );
    assert_eq!(sigil.get_open_notional(agent), opened, "no change on unauthorized");

    // Plinth decrements by the closed size.
    vm.set_sender(PLINTH);
    let half = U256::from(5_000u64) * U256::from(1_000_000u64);
    assert!(sigil.record_close(agent, half).is_ok());
    assert_eq!(sigil.get_open_notional(agent), opened - half);

    // Saturating: closing more than open clamps to zero, never underflows.
    assert!(sigil.record_close(agent, opened).is_ok());
    assert_eq!(sigil.get_open_notional(agent), U256::ZERO);
}

// ---------------------------------------------------------------------------
// Revocation — single-intent, per-agent nonce, kill-switch
// ---------------------------------------------------------------------------

#[test]
fn revoke_marks_intent_and_blocks_validation() {
    let (vm, mut sigil) = setup();
    let intent = happy_intent();
    let owner = intent.owner;
    let intent_hash = eip712::hash_intent(&intent);
    let hash_fb = FixedBytes::<32>::from(intent_hash.0);

    // Owner revokes this specific intent.
    vm.set_sender(owner);
    assert!(sigil.revoke(hash_fb).is_ok());
    assert!(sigil.is_revoked(owner, hash_fb), "intent must read as revoked");

    // A validate_action for that intent now reverts MandateRevoked even with a
    // fully-valid sig set.
    let (ib, ab, _) = valid_envelopes(&vm, &intent, 100_000, 1);
    vm.set_sender(PLINTH);
    assert!(
        matches!(sigil.validate_action(ib, ab), Err(SigilError::MandateRevoked(_))),
        "revoked intent must not validate"
    );
}

#[test]
fn revoke_all_bumps_per_owner_per_agent_nonce() {
    let (vm, mut sigil) = setup();
    let intent = happy_intent(); // owner == agent, signed-at nonce = 0
    let owner = intent.owner;
    let agent = intent.agent;

    assert_eq!(sigil.get_agent_revocation_nonce(owner, agent), 0);
    vm.set_sender(owner);
    assert!(sigil.revoke_all(agent).is_ok());
    assert_eq!(
        sigil.get_agent_revocation_nonce(owner, agent),
        1,
        "revoke_all increments the per-owner per-agent nonce"
    );

    // The intent was signed at nonce 0 and is now stale (mandate revoked)
    // because the on-chain nonce moved to 1.
    let (ib, ab, _) = valid_envelopes(&vm, &intent, 100_000, 1);
    vm.set_sender(PLINTH);
    assert!(
        matches!(sigil.validate_action(ib, ab), Err(SigilError::MandateRevoked(_))),
        "stale revocation nonce must reject"
    );
}

#[test]
fn revoke_all_on_behalf_of_is_kill_switch_only() {
    let (vm, mut sigil) = setup();
    let owner = addr_for_pk(&OWNER_PK);
    let agent = addr_for_pk(&AGENT_PK);

    // A stranger (not the kill switch) cannot revoke on behalf.
    vm.set_sender(address!("000000000000000000000000000000000000dEaD"));
    assert!(
        matches!(
            sigil.revoke_all_on_behalf_of(owner, agent),
            Err(SigilError::Unauthorized(_))
        ),
        "only the configured PosternKillSwitch may revoke on behalf"
    );
    assert_eq!(sigil.get_agent_revocation_nonce(owner, agent), 0);

    // The kill switch can.
    vm.set_sender(KILL_SWITCH);
    assert!(sigil.revoke_all_on_behalf_of(owner, agent).is_ok());
    assert_eq!(sigil.get_agent_revocation_nonce(owner, agent), 1);
}

// ---------------------------------------------------------------------------
// Pause / resume lifecycle + auth
// ---------------------------------------------------------------------------

#[test]
fn pause_blocks_validation_and_resume_restores() {
    let (vm, mut sigil) = setup();
    let intent = happy_intent();

    // Stranger cannot pause.
    vm.set_sender(address!("000000000000000000000000000000000000dEaD"));
    assert!(matches!(
        sigil.pause(B256::ZERO),
        Err(SigilError::Unauthorized(_))
    ));

    // Multisig pauses.
    vm.set_sender(PRAETOR);
    assert!(sigil.pause(B256::from([0x01u8; 32])).is_ok());

    // validate_action now reverts Paused before any other check.
    let (ib, ab, _) = valid_envelopes(&vm, &intent, 100_000, 1);
    vm.set_sender(PLINTH);
    assert!(matches!(
        sigil.validate_action(ib, ab),
        Err(SigilError::Paused(_))
    ));

    // Resume is timelock-only: multisig cannot resume.
    vm.set_sender(PRAETOR);
    assert!(matches!(
        sigil.resume(),
        Err(SigilError::Unauthorized(_))
    ));

    // Timelock resumes; validation flows again.
    vm.set_sender(TIMELOCK);
    assert!(sigil.resume().is_ok());
    let (ib, ab, _) = valid_envelopes(&vm, &intent, 100_000, 1);
    vm.set_sender(PLINTH);
    assert_ok_true(sigil.validate_action(ib, ab));
}

// ---------------------------------------------------------------------------
// EIP-712 domain separator stability (golden hash for fixed inputs)
// ---------------------------------------------------------------------------

#[test]
fn domain_separator_is_stable_for_fixed_inputs() {
    // Fixed inputs -> a fixed digest. If the EIP-712 domain encoding ever drifts
    // (typehash bytes, field order, padding) this golden value changes and the
    // test fails, catching silent signature-breaking changes.
    let name_hash = keccak256(b"AtriumSigil");
    let version_hash = keccak256(b"1");
    let ds = eip712::domain_separator(
        B256::from(name_hash.0),
        B256::from(version_hash.0),
        U256::from(421614u64),
        SIGIL_CONTRACT,
    );

    // Recompute independently here the way an off-chain signer (viem/ethers)
    // would, to assert the on-chain encoding matches the spec layout:
    // keccak( typehash || nameHash || versionHash || chainId || verifyingContract )
    let mut buf = [0u8; 32 * 5];
    buf[0..32].copy_from_slice(eip712::DOMAIN_TYPEHASH.as_slice());
    buf[32..64].copy_from_slice(name_hash.as_slice());
    buf[64..96].copy_from_slice(version_hash.as_slice());
    buf[96..128].copy_from_slice(&U256::from(421614u64).to_be_bytes::<32>());
    let mut vc = [0u8; 32];
    vc[12..32].copy_from_slice(SIGIL_CONTRACT.as_slice());
    buf[128..160].copy_from_slice(&vc);
    let expected = keccak256(&buf);

    assert_eq!(ds, expected, "domain separator must follow EIP-712 layout");

    // And the typehash itself is the keccak of the canonical domain type string,
    // independent of keccak_const, so a drift in the const machinery is caught.
    let typehash_runtime = keccak256(eip712::DOMAIN_TYPE_STRING);
    assert_eq!(
        eip712::DOMAIN_TYPEHASH,
        B256::from(typehash_runtime.0),
        "compile-time DOMAIN_TYPEHASH must equal runtime keccak of the type string"
    );

    // Guard the exact byte string so a rename of the domain (name/version) is
    // caught as a wire-incompatible change.
    assert_eq!(
        eip712::DOMAIN_TYPE_STRING,
        b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    let _ = hex::encode(ds); // exercise the import; value asserted above
}
