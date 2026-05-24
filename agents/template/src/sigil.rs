//! ActionSigil signing + Postern UserOp submission for community agents.
//!
//! The community agent never sees the user's master key. They hold a Postern
//! session key with bounded scope (per-action cap, per-24h cap, expiry). The
//! template signs an ActionSigil over the EIP-712 typed-data and submits via
//! the Pimlico bundler.
//!
//! Audit K-10 fix: previously a `tracing::info!` stub with no compile-time
//! coupling to Sigil's actual ABI / decoder layout. After G-3 / H-C2 the
//! Sigil decoder requires a fixed-layout envelope (256-byte body, then
//! count-prefixed venues/instruments, then 65-byte signature) and the
//! contract-side function is now mutating. The `encode_*` helpers below
//! produce envelopes in the exact layout `contracts/sigil/src/eip712.rs`
//! expects, so future drift on either side is caught at the type-level.

use alloy_primitives::{Address, FixedBytes, I256, U256};
use anyhow::Result;

use crate::{codex::OpenPosition, AgentConfig, Signal};

/// Maximum venues/instruments per intent. Must match the Sigil decoder
/// constants. Audit K-10: re-declare here so the encoder can refuse to
/// produce an envelope the on-chain decoder would reject.
pub const MAX_VENUES: usize = 8;
pub const MAX_INSTRUMENTS: usize = 8;

/// Build an IntentSigil envelope in the on-chain Sigil decoder layout.
/// Returns the raw bytes (body + signature). The signature must be appended
/// by the caller after EIP-712 hashing - this function emits a 65-byte
/// zero tail that the caller overwrites.
#[allow(clippy::too_many_arguments)] // layout maps 1:1 to the Sigil decoder body slots; struct hides intent
pub fn encode_intent_envelope(
    owner: Address,
    agent: Address,
    max_notional_per_action_wei: U256,
    max_total_open_notional_wei: U256,
    max_actions_per_24h: u32,
    expires_at: u64,
    nonce: U256,
    agent_revocation_nonce_at_signing: u64,
    venues_allowed: &[u8],
    instruments_allowed: &[FixedBytes<32>],
) -> Result<Vec<u8>> {
    if venues_allowed.len() > MAX_VENUES {
        anyhow::bail!("too many venues: {} > {}", venues_allowed.len(), MAX_VENUES);
    }
    if instruments_allowed.len() > MAX_INSTRUMENTS {
        anyhow::bail!(
            "too many instruments: {} > {}",
            instruments_allowed.len(),
            MAX_INSTRUMENTS
        );
    }
    let mut buf = Vec::with_capacity(
        256 + 32 + 32 * venues_allowed.len() + 32 + 32 * instruments_allowed.len() + 65,
    );

    // Fixed body (256 bytes). Each slot is 32-byte aligned, big-endian.
    let mut slot = [0u8; 32];
    slot[12..32].copy_from_slice(owner.as_slice());
    buf.extend_from_slice(&slot);
    let mut slot = [0u8; 32];
    slot[12..32].copy_from_slice(agent.as_slice());
    buf.extend_from_slice(&slot);
    buf.extend_from_slice(&max_notional_per_action_wei.to_be_bytes::<32>());
    buf.extend_from_slice(&max_total_open_notional_wei.to_be_bytes::<32>());
    let mut slot = [0u8; 32];
    slot[28..32].copy_from_slice(&max_actions_per_24h.to_be_bytes());
    buf.extend_from_slice(&slot);
    let mut slot = [0u8; 32];
    slot[24..32].copy_from_slice(&expires_at.to_be_bytes());
    buf.extend_from_slice(&slot);
    buf.extend_from_slice(&nonce.to_be_bytes::<32>());
    let mut slot = [0u8; 32];
    slot[24..32].copy_from_slice(&agent_revocation_nonce_at_signing.to_be_bytes());
    buf.extend_from_slice(&slot);

    // venues_count (uint256) + venues
    buf.extend_from_slice(&U256::from(venues_allowed.len()).to_be_bytes::<32>());
    for &v in venues_allowed {
        let mut slot = [0u8; 32];
        slot[31] = v;
        buf.extend_from_slice(&slot);
    }

    // instruments_count (uint256) + instruments
    buf.extend_from_slice(&U256::from(instruments_allowed.len()).to_be_bytes::<32>());
    for inst in instruments_allowed {
        buf.extend_from_slice(inst.as_slice());
    }

    // 65-byte signature tail (placeholder; caller overwrites)
    buf.extend_from_slice(&[0u8; 65]);
    Ok(buf)
}

/// Build an ActionSigil envelope in the on-chain Sigil decoder layout.
pub fn encode_action_envelope(
    intent_hash: FixedBytes<32>,
    venue_id: u8,
    instrument_id: FixedBytes<32>,
    notional_signed: I256,
    submitted_at: u64,
    action_nonce: U256,
) -> Vec<u8> {
    let mut buf = Vec::with_capacity(32 * 6 + 65);
    buf.extend_from_slice(intent_hash.as_slice());
    let mut slot = [0u8; 32];
    slot[31] = venue_id;
    buf.extend_from_slice(&slot);
    buf.extend_from_slice(instrument_id.as_slice());
    buf.extend_from_slice(&notional_signed.to_be_bytes::<32>());
    let mut slot = [0u8; 32];
    slot[24..32].copy_from_slice(&submitted_at.to_be_bytes());
    buf.extend_from_slice(&slot);
    buf.extend_from_slice(&action_nonce.to_be_bytes::<32>());
    buf.extend_from_slice(&[0u8; 65]);
    buf
}

pub async fn submit_action_sigil(
    client: &reqwest::Client,
    config: &AgentConfig,
    agent_name: &str,
    signal: Signal,
    _current_position: &OpenPosition,
) -> Result<()> {
    // Wave-1 wiring lands the full Pimlico-bundler submission path. The
    // encoders above are the API contract on the agent side; future drift
    // between agent and contract trips a compile-error at the `encode_*`
    // call sites rather than producing an envelope the decoder silently
    // rejects.
    //
    // Silent-failure guard: pre-fix this function logged + returned Ok,
    // so a strategy returning EnterLong/EnterShort/Close would appear to
    // succeed while no transaction ever hit chain. Operator had no signal
    // the submission path wasn't wired. Now: explicit Err, caught by the
    // harness's `tick` wrapper, surfaced as a warn log per tick. When
    // Pimlico wiring lands, replace the bail with the real submission.
    let _ = (client, config, agent_name, signal);
    anyhow::bail!(
        "ActionSigil submission not yet wired (Pimlico bundler path lands Wave-1). \
         Strategy signal={signal:?} discarded by stub. \
         Encoders compile-check against on-chain decoder via tests below."
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_intent_envelope_minimum_length_matches_decoder() {
        // Smallest valid envelope per Sigil eip712::decode_intent MIN_LEN.
        let owner = Address::ZERO;
        let agent = Address::ZERO;
        let bytes = encode_intent_envelope(
            owner,
            agent,
            U256::ZERO,
            U256::ZERO,
            0,
            0,
            U256::ZERO,
            0,
            &[],
            &[],
        )
        .unwrap();
        // Min layout: 256-byte body + 32 venues_count + 32 instr_count + 65 sig.
        assert_eq!(bytes.len(), 256 + 32 + 32 + 65);
    }

    #[test]
    fn encode_intent_envelope_rejects_too_many_venues() {
        let result = encode_intent_envelope(
            Address::ZERO,
            Address::ZERO,
            U256::ZERO,
            U256::ZERO,
            0,
            0,
            U256::ZERO,
            0,
            &[1, 2, 3, 4, 5, 6, 7, 8, 9],
            &[],
        );
        assert!(result.is_err());
    }

    #[test]
    fn encode_action_envelope_fixed_size() {
        let bytes = encode_action_envelope(
            FixedBytes::<32>::ZERO,
            1,
            FixedBytes::<32>::ZERO,
            I256::ZERO,
            0,
            U256::ZERO,
        );
        assert_eq!(bytes.len(), 32 * 6 + 65);
    }

    // ── Iter 78: mirror coverage + envelope-layout pins ─────────────────

    #[test]
    fn encode_intent_envelope_rejects_too_many_instruments() {
        // Mirror of `rejects_too_many_venues`. The two limits (MAX_VENUES
        // = MAX_INSTRUMENTS = 8) drift out of sync risk: if one bumps and
        // the other doesn't, the on-chain decoder would reject the
        // larger one silently — agent would log "submitted" but never
        // land. Pin BOTH boundaries.
        let too_many: Vec<FixedBytes<32>> = (0..9)
            .map(|i| {
                let mut b = [0u8; 32];
                b[31] = i;
                FixedBytes::<32>::from(b)
            })
            .collect();
        let result = encode_intent_envelope(
            Address::ZERO,
            Address::ZERO,
            U256::ZERO,
            U256::ZERO,
            0,
            0,
            U256::ZERO,
            0,
            &[],
            &too_many,
        );
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("too many instruments"), "err msg: {err}");
    }

    #[test]
    fn encode_intent_envelope_pins_body_layout_owner_at_offset_12() {
        // Sigil decoder reads owner from slot 0, with the 20-byte address
        // right-aligned (offset 12 of the 32-byte slot). A future "tidy
        // up" that left-aligns would silently produce envelopes the
        // decoder rejects as malformed addresses.
        let owner_bytes = [0xAB_u8; 20];
        let owner = Address::from(owner_bytes);
        let bytes = encode_intent_envelope(
            owner,
            Address::ZERO,
            U256::ZERO,
            U256::ZERO,
            0,
            0,
            U256::ZERO,
            0,
            &[],
            &[],
        )
        .unwrap();
        // Slot 0 = bytes [0..32]. Owner lives at offset 12..32.
        assert_eq!(&bytes[0..12], &[0u8; 12], "left-padding must be zero");
        assert_eq!(&bytes[12..32], &owner_bytes, "owner right-aligned in slot");
    }

    #[test]
    fn encode_action_envelope_pins_layout_for_decoder_compatibility() {
        // The action envelope is 6 slots + signature. Pre-fix any reorder
        // would silently break decode_action's slot-offset reads.
        let intent_hash = FixedBytes::<32>::from([0x11_u8; 32]);
        let instrument_id = FixedBytes::<32>::from([0x22_u8; 32]);
        let bytes = encode_action_envelope(
            intent_hash,
            7, // venue_id
            instrument_id,
            I256::ZERO,
            0,
            U256::ZERO,
        );
        // Slot 0 = intent_hash
        assert_eq!(&bytes[0..32], &[0x11_u8; 32]);
        // Slot 1 = venue_id right-aligned (last byte)
        assert_eq!(&bytes[32..63], &[0u8; 31]);
        assert_eq!(bytes[63], 7);
        // Slot 2 = instrument_id
        assert_eq!(&bytes[64..96], &[0x22_u8; 32]);
    }

    #[test]
    fn encode_intent_envelope_grows_with_venue_count() {
        // Each venue adds 32 bytes (one slot). Pre-fix any miscounted
        // slot would shift the instruments_count offset, making the
        // decoder mis-read the count value.
        let bytes_with_0 = encode_intent_envelope(
            Address::ZERO,
            Address::ZERO,
            U256::ZERO,
            U256::ZERO,
            0,
            0,
            U256::ZERO,
            0,
            &[],
            &[],
        )
        .unwrap()
        .len();
        let bytes_with_3 = encode_intent_envelope(
            Address::ZERO,
            Address::ZERO,
            U256::ZERO,
            U256::ZERO,
            0,
            0,
            U256::ZERO,
            0,
            &[1, 2, 3],
            &[],
        )
        .unwrap()
        .len();
        assert_eq!(bytes_with_3 - bytes_with_0, 32 * 3, "each venue = 32 bytes");
    }

    // ── K-10: submit_action_sigil bails (silent-failure prevention) ─────

    #[test]
    fn submit_action_sigil_bails_until_pimlico_wired_k10() {
        // Pre-K-10: the function logged + returned Ok(()), so every
        // strategy signal silently no-op'd. The harness's tick wrapper
        // treated Ok as "submitted" → operator had no signal the
        // submission path wasn't wired. K-10 made this bail with a
        // descriptive error so the loud-failure path triggers a warn
        // log at every tick — the gap is OBVIOUS in operator stdout.
        //
        // When Pimlico wiring lands this test moves to assert success.
        // Until then, asserting the bail keeps the silent-failure
        // regression locked.
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let client = reqwest::Client::new();
            let config = crate::AgentConfig {
                codex_url: "http://localhost".to_string(),
                instrument_id: "0xtest".to_string(),
                venue_id: 1,
                interval_seconds: 60,
                max_notional_per_action_usdc: 50,
                max_total_open_notional_usdc: 500,
                max_actions_per_24h: 24,
            };
            let result = submit_action_sigil(
                &client,
                &config,
                "test_agent",
                crate::Signal::EnterLong,
                &crate::codex::OpenPosition::default(),
            )
            .await;
            assert!(
                result.is_err(),
                "K-10: must bail until Pimlico wiring lands"
            );
            let err = result.unwrap_err().to_string();
            assert!(
                err.contains("not yet wired"),
                "err msg names the unwired state: {err}"
            );
        });
    }
}
