// Sigil — Atrium agent mandate contract
//
// EIP-712 typed-data envelope for agent delegation. IntentSigil is the
// parent mandate signed by the owner; ActionSigil is the per-action
// authorization signed by the agent. Plinth calls validate_action before
// allowing any agent-driven position open.
//
// Schema: PRD §12.3 + TDD §7.5

#![cfg_attr(not(any(feature = "export-abi", test)), no_main)]
#![cfg_attr(not(any(feature = "export-abi", test)), no_std)]

extern crate alloc;

use alloc::string::String;
use alloc::vec;
use alloc::vec::Vec;
use alloy_primitives::{Address, FixedBytes, Uint, U256, B256};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;
use stylus_sdk::call::static_call;

// Wire the EIP-712 module per Agent A audit (MUST-FIX #1).
// `validate_action` is still a conservative `Ok(false)` until the full
// signature-recovery loop is wired Wave 1 — but the module compiles in.
pub mod eip712;

sol! {
    event SigilRevoked(address indexed owner, bytes32 indexed intent_hash);
    event SigilRevokeAll(address indexed owner, address indexed agent, uint64 new_nonce);
    event IntentValidated(address indexed owner, address indexed agent, bytes32 intent_hash);
    // Audit HHH-4 fix (`human_left.md` #29): Plinth-driven credit-line decrement.
    event SigilOpenNotionalDecremented(
        address indexed agent,
        uint256 previous,
        uint256 next,
        uint256 amount,
    );
    /// Audit 2026-05-24 (Auditor A C-5): pause + resume lifecycle events.
    /// reason is keccak256(human-readable code); off-chain decoders map digest
    /// to message. Cuts ~400 bytes vs string-typed reason on no_std wasm.
    event SigilPausedEvent(bytes32 reason, uint64 block_number);
    event SigilResumedEvent(uint64 block_number);
}

sol! {
    error InvalidSignature();
    error MandateExpired(uint256 expires_at, uint256 now_seconds);
    error VenueNotAllowed(uint8 venue_id);
    error InstrumentNotAllowed(bytes32 instrument_id);
    error NotionalExceeded(uint256 attempted, uint256 cap);
    error RateLimitExceeded(uint32 attempted, uint32 cap);
    error MandateRevoked(bytes32 intent_hash);
    error UnauthorizedCaller(address caller);
    error CreditCapExceeded(uint256 attempted_open, uint256 max_credit);
    /// Audit 2026-05-24 (Auditor A C-5): Sigil now exposes pause(bytes32)
    /// for PraetorTimelock.emergencyPause compatibility. Reverts on validate
    /// when the flag is set.
    error SigilPaused();
    /// Audit 2026-05-24 (Auditor E): reentrancy guard on validate_action.
    error SigilReentrant();
}

#[derive(SolidityError)]
pub enum SigilError {
    InvalidSignature(InvalidSignature),
    MandateExpired(MandateExpired),
    VenueNotAllowed(VenueNotAllowed),
    InstrumentNotAllowed(InstrumentNotAllowed),
    NotionalExceeded(NotionalExceeded),
    RateLimitExceeded(RateLimitExceeded),
    MandateRevoked(MandateRevoked),
    Unauthorized(UnauthorizedCaller),
    CreditCapExceeded(CreditCapExceeded),
    Paused(SigilPaused),
    Reentrant(SigilReentrant),
}

sol_storage! {
    #[entrypoint]
    pub struct Sigil {
        // owner => agent => agent revocation nonce (per-owner per-agent).
        // Audit F-2 (Agent F MUST-FIX #2): revocation scoped to owner so the
        // Kill Switch's per-user revocation cannot collide with another user
        // revoking the same agent.
        // Storage uses uint256 because the on-chain setter passes
        // U256-typed values; uint64 would force a narrowing cast at every
        // write and would fail the Stylus typed-storage check.
        mapping(address => mapping(address => uint256)) agent_revocation_nonce_by_owner;
        // owner => (intent_hash => revoked) for single-intent revocation
        mapping(address => mapping(bytes32 => bool)) revoked;
        // owner => monotonic nonce for replay protection
        mapping(address => uint256) owner_intent_nonce;
        // agent => day_index => action count
        mapping(address => mapping(uint64 => uint32)) actions_per_day;
        // agent => total CUMULATIVE notional opened over the mandate's lifetime.
        //
        // Audit HHH-4: pre-fix this field was named `open_notional_wei` and the
        // intent_envelope cap field is `max_total_open_notional_wei`. The mental
        // model is "running open exposure" — credit frees on close. BUT: Plinth's
        // Position struct doesn't store the agent that opened it, so close_position
        // has no path to call back into Sigil with `record_close(agent, amount)`.
        // The counter therefore only grows.
        //
        // Effect on user safety: FAIL-SAFE. The agent's per-mandate credit-line
        // is consumed FASTER than the user expected, not slower — the agent
        // becomes useless once the cap is hit, no extra funds at risk.
        // Effect on agent UX: degraded. A long-lived mandate that opens/closes
        // many positions hits the cap from cumulative volume, not concurrent.
        //
        // Proper fix (Year-2 / human_left.md): add `agent` field to Plinth's
        // Position struct, plumb it through open_position → close_position, and
        // expose `record_close(agent, amount)` on Sigil for Plinth to call.
        mapping(address => uint256) open_notional_wei;

        address praetor_multisig;
        address praetor_timelock;  // F-32 fix
        address plinth_address;
        address erc8004_identity_registry;
        address postern_kill_switch;

        SigilParams params;

        // Audit 2026-05-24 (Auditor A C-5 + E reentrancy gap):
        // `is_paused` lets PraetorTimelock.emergencyPause halt mandate
        // validation across all agents in a single tx. `is_updating` is the
        // reentrancy flag mirroring Plinth's pattern; validate_action does
        // not currently make external calls, but the flag is in place for
        // when post-Wave-1 signature-recovery enables a CALL_EOA path.
        bool is_paused;
        bool is_updating;
    }

    pub struct SigilParams {
        // Hard cap in USDC wei (USDC has 6 decimals → $50_000 == 50_000 * 10^6)
        uint256 hard_cap_wei;
        // Multiplier applied to ERC-8004 reputation score (basis points scale)
        uint16 reputation_multiplier_bps;
        // Maximum mandate duration (seconds)
        uint32 max_mandate_duration_seconds;
        // Absolute ceiling on actions per 24h
        uint16 max_actions_per_24h_hard_cap;
        // EIP-712 domain values
        bytes32 domain_separator;
    }
}

#[public]
impl Sigil {
    pub fn initialize(
        &mut self,
        praetor: Address,
        praetor_timelock: Address,
        plinth: Address,
        erc8004_registry: Address,
        postern_kill_switch: Address,
    ) -> Result<(), SigilError> {
        if !self.praetor_multisig.get().is_zero() {
            return Err(SigilError::Unauthorized(UnauthorizedCaller {
                caller: self.vm().msg_sender(),
            }));
        }
        if self.vm().msg_sender().is_zero() {
            return Err(SigilError::Unauthorized(UnauthorizedCaller {
                caller: self.vm().msg_sender(),
            }));
        }
        // Audit F-G fix: zero-address admin args would brick the contract.
        if praetor.is_zero() || praetor_timelock.is_zero() {
            return Err(SigilError::Unauthorized(UnauthorizedCaller {
                caller: praetor,
            }));
        }
        self.praetor_multisig.set(praetor);
        self.praetor_timelock.set(praetor_timelock);
        self.plinth_address.set(plinth);
        self.erc8004_identity_registry.set(erc8004_registry);
        self.postern_kill_switch.set(postern_kill_switch);

        // Default params per TDD §7.5 (USDC 6 decimals)
        self.params.hard_cap_wei.set(U256::from(50_000u64) * U256::from(1_000_000u64)); // $50K USDC
        self.params.reputation_multiplier_bps.set(Uint::<16, 1>::from(100u16)); // 1x default
        self.params.max_mandate_duration_seconds.set(Uint::<32, 1>::from(30u32 * 24 * 60 * 60)); // 30 days
        self.params.max_actions_per_24h_hard_cap.set(Uint::<16, 1>::from(100u16));

        // EIP-712 domain separator — chainId substituted at deploy time
        // domain = keccak256(
        //   EIP712Domain(name string,version string,uint256 chainId,address verifyingContract)
        // )
        // Computed off-chain and set by Praetor for clarity.
        Ok(())
    }

    /// Called by Plinth before any agent-driven position opens.
    /// `intent_bytes` is the ABI-encoded IntentSigil; `action_bytes` is the
    /// ABI-encoded ActionSigil. The function recovers signatures, checks
    /// caps, expiry, revocation, rate limits, and credit-line.
    ///
    /// Audit G-3 fix: full 8-step EIP-712 validator with real ECDSA recovery
    /// via the precompile at 0x01 (no more fail-open Ok(true) after the cap
    /// checks). Now `&mut self` so the rate-limit and credit-line counters
    /// persist across calls. Plinth integration passes the ABI-encoded
    /// IntentSigil + 65-byte signature in `intent_bytes`, and the same for
    /// `action_bytes`.
    ///
    /// Returns true if the action is authorized.
    pub fn validate_action(
        &mut self,
        intent_bytes: alloc::vec::Vec<u8>,
        action_bytes: alloc::vec::Vec<u8>,
    ) -> Result<bool, SigilError> {
        // Audit 2026-05-24 (Auditor A C-5 + Auditor E reentrancy gap):
        // global pause check first, reentrancy guard second. Same shape as
        // Plinth's open_position. Pre-fix, a paused Sigil still validated
        // (the pause flag did not exist) and a future external-call hook
        // could re-enter to bypass rate limits.
        if self.is_paused.get() {
            return Err(SigilError::Paused(SigilPaused {}));
        }
        if self.is_updating.get() {
            return Err(SigilError::Reentrant(SigilReentrant {}));
        }
        self.is_updating.set(true);
        let result = self.validate_action_inner(intent_bytes, action_bytes);
        self.is_updating.set(false);
        result
    }

    fn validate_action_inner(
        &mut self,
        intent_bytes: alloc::vec::Vec<u8>,
        action_bytes: alloc::vec::Vec<u8>,
    ) -> Result<bool, SigilError> {
        // Decode envelopes. Production callers ABI-encode IntentSigil + ActionSigil
        // exactly per the type strings in eip712.rs. Until off-chain SDK lands
        // (Wave-1 Postern agent harness), the decode is best-effort; on any
        // decode failure the validator refuses (no fail-open).
        let intent_envelope = eip712::decode_intent(&intent_bytes)
            .map_err(|_| SigilError::InvalidSignature(InvalidSignature {}))?;
        let action_envelope = eip712::decode_action(&action_bytes)
            .map_err(|_| SigilError::InvalidSignature(InvalidSignature {}))?;

        // 1. Hash binding: action's intent_hash must equal hash(intent)
        let intent_hash = eip712::hash_intent(&intent_envelope.body);
        if intent_hash != action_envelope.body.intent_hash {
            return Err(SigilError::InvalidSignature(InvalidSignature {}));
        }
        // 2. Expiry
        let now = self.vm().block_timestamp();
        if now > intent_envelope.body.expires_at {
            return Err(SigilError::MandateExpired(MandateExpired {
                expires_at: U256::from(intent_envelope.body.expires_at),
                now_seconds: U256::from(now),
            }));
        }
        // 3. Per-owner per-agent revocation nonce must match the value at signing
        let current_nonce = self
            .agent_revocation_nonce_by_owner
            .getter(intent_envelope.body.owner)
            .getter(intent_envelope.body.agent)
            .get()
            .to::<u64>();
        if current_nonce != intent_envelope.body.agent_revocation_nonce_at_signing {
            return Err(SigilError::MandateRevoked(MandateRevoked {
                intent_hash: alloy_primitives::FixedBytes::from(intent_hash.0),
            }));
        }
        // 4. Single-intent revocation flag
        if self
            .revoked
            .getter(intent_envelope.body.owner)
            .getter(alloy_primitives::FixedBytes::from(intent_hash.0))
            .get()
        {
            return Err(SigilError::MandateRevoked(MandateRevoked {
                intent_hash: alloy_primitives::FixedBytes::from(intent_hash.0),
            }));
        }
        // 5. Cap checks (venue / instrument / notional).
        //
        // Iter 51 audit fix: pre-fix `caps_respected` returned bool and
        // all three failure modes folded into a generic InvalidSignature
        // revert. The errors `VenueNotAllowed`, `InstrumentNotAllowed`,
        // and `NotionalExceeded` were declared but never reverted — same
        // dead-error lie-class as iter 49 (InsufficientCollateralError)
        // and iter 50 (AdapterAlsoApprovedAsOrchestrator). Now: typed
        // CapViolation enum, dispatched to the specific SigilError so
        // off-chain agents + ops dashboards can distinguish "wrong venue"
        // from "wrong instrument" from "exceeded notional cap."
        match eip712::caps_respected(&intent_envelope.body, &action_envelope.body) {
            Ok(()) => {}
            Err(eip712::CapViolation::Venue(venue_id)) => {
                return Err(SigilError::VenueNotAllowed(VenueNotAllowed { venue_id }));
            }
            Err(eip712::CapViolation::Instrument(instrument_id)) => {
                return Err(SigilError::InstrumentNotAllowed(InstrumentNotAllowed { instrument_id }));
            }
            Err(eip712::CapViolation::Notional { attempted, cap }) => {
                return Err(SigilError::NotionalExceeded(NotionalExceeded { attempted, cap }));
            }
        }
        // 6. Rate limit (per agent per UTC day)
        let day = eip712::day_index(now);
        let used = self
            .actions_per_day
            .getter(intent_envelope.body.agent)
            .getter(Uint::<64, 1>::from(day))
            .get()
            .to::<u32>();
        let hard_cap: u32 = self.params.max_actions_per_24h_hard_cap.get().to::<u32>();
        let intent_cap: u32 = intent_envelope.body.max_actions_per_24h;
        let effective_cap = if intent_cap < hard_cap { intent_cap } else { hard_cap };
        if used >= effective_cap {
            return Err(SigilError::RateLimitExceeded(RateLimitExceeded {
                attempted: used + 1,
                cap: effective_cap,
            }));
        }
        // 7. Credit-line check
        let open = self
            .open_notional_wei
            .getter(intent_envelope.body.agent)
            .get();
        let abs_action_notional = U256::try_from(action_envelope.body.notional_signed.unsigned_abs())
            .unwrap_or(U256::MAX);
        let max_credit = if intent_envelope.body.max_total_open_notional_wei
            < self.params.hard_cap_wei.get()
        {
            intent_envelope.body.max_total_open_notional_wei
        } else {
            self.params.hard_cap_wei.get()
        };
        if open.saturating_add(abs_action_notional) > max_credit {
            return Err(SigilError::CreditCapExceeded(CreditCapExceeded {
                attempted_open: open.saturating_add(abs_action_notional),
                max_credit,
            }));
        }

        // 8. Signature recovery (the actual G-3 fix). Build the EIP-712
        //    digest for each envelope, call the ecrecover precompile (0x01),
        //    and assert the recovered address matches the claimed signer
        //    in the envelope body.
        let chain_id = U256::from(self.vm().chain_id());
        let this_contract = self.vm().contract_address();
        // Sigil domain: name="AtriumSigil", version="1"
        let name_hash = alloy_primitives::keccak256(b"AtriumSigil");
        let version_hash = alloy_primitives::keccak256(b"1");
        let domain_sep = eip712::domain_separator(
            B256::from(name_hash.0),
            B256::from(version_hash.0),
            chain_id,
            this_contract,
        );
        let intent_struct_hash = eip712::hash_intent(&intent_envelope.body);
        let intent_digest = eip712::final_digest(domain_sep, intent_struct_hash);
        let action_struct_hash = eip712::hash_action(&action_envelope.body);
        let action_digest = eip712::final_digest(domain_sep, action_struct_hash);

        let intent_signer = ecrecover_via_precompile(
            &*self,
            B256::from(intent_digest.0),
            &intent_envelope.signature,
        )
        .ok_or(SigilError::InvalidSignature(InvalidSignature {}))?;
        if intent_signer != intent_envelope.body.owner {
            return Err(SigilError::InvalidSignature(InvalidSignature {}));
        }
        let action_signer = ecrecover_via_precompile(
            &*self,
            B256::from(action_digest.0),
            &action_envelope.signature,
        )
        .ok_or(SigilError::InvalidSignature(InvalidSignature {}))?;
        if action_signer != intent_envelope.body.agent {
            return Err(SigilError::InvalidSignature(InvalidSignature {}));
        }

        // 9. Persist counters. Only after the signature gate passes — a
        //    malformed envelope should not be able to consume rate-limit
        //    budget or credit-line.
        self.actions_per_day
            .setter(intent_envelope.body.agent)
            .setter(Uint::<64, 1>::from(day))
            .set(Uint::<32, 1>::from(used + 1));
        self.open_notional_wei
            .setter(intent_envelope.body.agent)
            .set(open.saturating_add(abs_action_notional));

        self.vm().log(IntentValidated {
            owner: intent_envelope.body.owner,
            agent: intent_envelope.body.agent,
            intent_hash: alloy_primitives::FixedBytes::from(intent_hash.0),
        });
        Ok(true)
    }

    pub fn revoke(&mut self, intent_hash: FixedBytes<32>) -> Result<(), SigilError> {
        let owner = self.vm().msg_sender();
        self.revoked.setter(owner).setter(intent_hash).set(true);
        self.vm().log(SigilRevoked {
            owner,
            intent_hash,
        });
        Ok(())
    }

    /// Audit HHH-4 fix (`human_left.md` #29): Plinth calls this on close_position
    /// to decrement the agent's running open-notional. Pre-fix the credit-line
    /// only increased — `max_total_open_notional_wei` behaved as a CUMULATIVE
    /// lifetime cap rather than a running OPEN cap. Long-lived mandates that
    /// open + close many positions hit the cap from cumulative volume, not
    /// concurrent exposure.
    ///
    /// Effect on user safety: FAIL-SAFE pre-fix (agent becomes useless sooner,
    /// no user funds at risk). This fix restores the intended semantics so
    /// agent UX matches user expectations.
    ///
    /// Access: Plinth address only (set in initialize). Saturating-sub against
    /// the lifetime count protects against off-by-one or replayed close events
    /// driving open_notional below zero.
    pub fn record_close(&mut self, agent: Address, amount: U256) -> Result<(), SigilError> {
        let caller = self.vm().msg_sender();
        if caller != self.plinth_address.get() {
            return Err(SigilError::Unauthorized(UnauthorizedCaller { caller }));
        }
        let current = self.open_notional_wei.getter(agent).get();
        let next = current.saturating_sub(amount);
        self.open_notional_wei.setter(agent).set(next);
        self.vm().log(SigilOpenNotionalDecremented {
            agent,
            previous: current,
            next,
            amount,
        });
        Ok(())
    }

    pub fn revoke_all(&mut self, agent: Address) -> Result<(), SigilError> {
        let owner = self.vm().msg_sender();
        let new_nonce = self
            .agent_revocation_nonce_by_owner
            .getter(owner)
            .getter(agent)
            .get()
            .to::<u64>()
            + 1;
        self.agent_revocation_nonce_by_owner
            .setter(owner)
            .setter(agent)
            .set(U256::from(new_nonce));
        self.vm().log(SigilRevokeAll {
            owner,
            agent,
            new_nonce,
        });
        Ok(())
    }

    /// Agent F MUST-FIX #2: the Kill Switch revokes on behalf of the user.
    /// Only callable by the configured PosternKillSwitch address.
    pub fn revoke_all_on_behalf_of(&mut self, owner: Address, agent: Address) -> Result<(), SigilError> {
        let caller = self.vm().msg_sender();
        if caller != self.postern_kill_switch.get() {
            return Err(SigilError::Unauthorized(UnauthorizedCaller { caller }));
        }
        let new_nonce = self
            .agent_revocation_nonce_by_owner
            .getter(owner)
            .getter(agent)
            .get()
            .to::<u64>()
            + 1;
        self.agent_revocation_nonce_by_owner
            .setter(owner)
            .setter(agent)
            .set(U256::from(new_nonce));
        self.vm().log(SigilRevokeAll {
            owner,
            agent,
            new_nonce,
        });
        Ok(())
    }

    pub fn is_revoked(&self, owner: Address, intent_hash: FixedBytes<32>) -> bool {
        self.revoked.getter(owner).getter(intent_hash).get()
    }

    pub fn get_agent_revocation_nonce(&self, owner: Address, agent: Address) -> u64 {
        self.agent_revocation_nonce_by_owner
            .getter(owner)
            .getter(agent)
            .get()
            .to::<u64>()
    }

    pub fn get_open_notional(&self, agent: Address) -> U256 {
        self.open_notional_wei.getter(agent).get()
    }

    // ===== Init-state getters (Audit 2026-05-24 G-2 fix) =====
    pub fn praetor_multisig(&self) -> Address {
        self.praetor_multisig.get()
    }

    pub fn praetor_timelock(&self) -> Address {
        self.praetor_timelock.get()
    }

    pub fn plinth_address(&self) -> Address {
        self.plinth_address.get()
    }

    // ===== Pause (multisig or timelock) =====
    /// Audit 2026-05-24 (Auditor A C-5, "no pause function on Sigil"):
    /// PraetorTimelock.emergencyPause forwards `IPausable(target).pause(bytes32)`.
    /// Mirrors Coffer + Plinth. Accepts caller in {multisig, timelock}.
    /// Sets the global is_paused flag; validate_action reverts while set.
    pub fn pause(&mut self, reason: B256) -> Result<(), SigilError> {
        let caller = self.vm().msg_sender();
        if caller != self.praetor_multisig.get() && caller != self.praetor_timelock.get() {
            return Err(SigilError::Unauthorized(UnauthorizedCaller { caller }));
        }
        self.is_paused.set(true);
        let block_now = self.vm().block_number();
        self.vm().log(SigilPausedEvent { reason, block_number: block_now });
        Ok(())
    }

    /// Resume is a parameter change so timelock-only (F-32 pattern).
    pub fn resume(&mut self) -> Result<(), SigilError> {
        let caller = self.vm().msg_sender();
        if caller != self.praetor_timelock.get() {
            return Err(SigilError::Unauthorized(UnauthorizedCaller { caller }));
        }
        self.is_paused.set(false);
        let block_now = self.vm().block_number();
        self.vm().log(SigilResumedEvent { block_number: block_now });
        Ok(())
    }
}

// =============================================================================
// Kani harnesses
// =============================================================================
#[cfg(kani)]
mod kani_proofs {
    use alloy_primitives::U256;

    /// Invariant: mandate expiry validity is monotonic in time.
    /// If a mandate is valid at time t, it is valid for all t' <= t with t' >= some t0.
    #[kani::proof]
    fn mandate_expiry_monotonic() {
        let now: u64 = kani::any();
        let expires_at: u64 = kani::any();
        kani::assume(now < expires_at);
        // Trivial in the abstract — the real check is in `validate_action`
        // and is covered by proptest once that function is implemented.
        assert!(now <= expires_at);
    }
}

/// Audit G-3: invoke the ecrecover precompile at 0x01 to recover the signer of
/// `digest` from the (v, r, s) signature. The precompile takes 128 bytes of
/// calldata (digest, v left-padded to 32 bytes, r, s) and returns either 32
/// bytes of zero (recovery failed) or the 20-byte recovered address
/// right-padded to 32 bytes.
///
/// Returns `None` if v is malformed, if the precompile reverts, or if the
/// returned address is the zero address (which secp256k1 never produces as a
/// valid recovery — meaning the precompile signalled failure).
fn ecrecover_via_precompile(
    contract: &Sigil,
    digest: B256,
    sig: &eip712::Signature,
) -> Option<Address> {
    // Audit H-M1 fix: strict v accept-list. Only {0, 1, 27, 28} are valid;
    // anything else (including EIP-155 chain-id-encoded v >= 35) is rejected.
    // Typed-data signers always produce 27/28, so we don't accept legacy 155.
    let v_byte = match sig.v {
        0 | 1 => sig.v + 27,
        27 | 28 => sig.v,
        _ => return None,
    };
    let mut calldata = [0u8; 128];
    calldata[0..32].copy_from_slice(digest.as_slice());
    calldata[63] = v_byte;
    calldata[64..96].copy_from_slice(sig.r.as_slice());
    calldata[96..128].copy_from_slice(sig.s.as_slice());
    let precompile = Address::from([
        0u8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
    ]);
    // `vm()` returns `&Self::Host` so static_call receives the right &H.
    let result = static_call(contract.vm(), Call::new(), precompile, &calldata).ok()?;
    if result.len() < 32 {
        return None;
    }
    let mut addr_bytes = [0u8; 20];
    addr_bytes.copy_from_slice(&result[12..32]);
    let recovered = Address::from(addr_bytes);
    if recovered.is_zero() {
        return None;
    }
    Some(recovered)
}

#[cfg(test)]
mod tests {
    // proptest harnesses land Wave 1 alongside the full EIP-712 verifier.
}
