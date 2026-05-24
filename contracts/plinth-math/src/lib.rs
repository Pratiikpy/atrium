// PlinthMath — SPAN margin compute, extracted from Plinth.
//
// This contract is the stateless compute side of the Plinth split that was
// forced by the EIP-170 24 KB code-size cap. Plinth (the storage contract)
// calls `required_margin` via staticcall whenever it needs to recompute a
// user's margin requirement. The SPAN scenario matrix lives here so the
// hot path's monomorphized loop bodies don't bloat Plinth's wasm.

#![cfg_attr(not(any(feature = "export-abi", test)), no_main)]
#![cfg_attr(not(any(feature = "export-abi", test)), no_std)]

extern crate alloc;

use alloc::{vec, vec::Vec};
use alloy_primitives::{I256, U256};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;

sol_storage! {
    #[entrypoint]
    pub struct PlinthMath {}
}

// =============================================================================
// Constants — must match the off-chain risk model
// =============================================================================
const SCENARIOS_BPS: [(i32, u16); 7] = [
    (1, 1_000),
    (-1, 1_000),
    (1, 500),
    (-1, 500),
    (1, 200),
    (-1, 200),
    (0, 0),
];
const MAX_CORRELATION_CLASSES: usize = 16;

// =============================================================================
// Public ABI — Plinth calls this via staticcall
// =============================================================================
#[public]
impl PlinthMath {
    /// Compute required margin across all positions using SPAN scenario matrix.
    ///
    /// All position arrays must be the same length. Returns required margin
    /// in the same scale as `notionals` (Q64.64 fixed-point absorbed inside).
    ///
    /// Arrays-of-parallel-fields chosen over a struct array so the sol
    /// interface stays portable and the encoder/decoder stays small on
    /// both sides of the staticcall.
    pub fn required_margin(
        &self,
        notionals: Vec<I256>,
        entry_prices_q64: Vec<U256>,
        current_prices_q64: Vec<U256>,
        haircuts_bps: Vec<u16>,
        correlation_classes: Vec<u16>,
        min_initial_margin_bps: u16,
        maint_margin_buffer_bps: u16,
    ) -> U256 {
        let n = notionals.len();
        // Defensive: any length mismatch returns 0. Plinth must validate
        // shape before calling; this is a belt-and-braces guard.
        if n == 0
            || entry_prices_q64.len() != n
            || current_prices_q64.len() != n
            || haircuts_bps.len() != n
            || correlation_classes.len() != n
        {
            return U256::ZERO;
        }

        let mut class_worst_loss: [U256; MAX_CORRELATION_CLASSES] =
            [U256::ZERO; MAX_CORRELATION_CLASSES];

        for class_idx in 0..MAX_CORRELATION_CLASSES {
            let mut worst_loss = U256::ZERO;
            for (direction, mag_bps) in SCENARIOS_BPS.iter() {
                let mut net_loss = I256::ZERO;
                for i in 0..n {
                    if correlation_classes[i] as usize != class_idx {
                        continue;
                    }
                    let shocked =
                        apply_shock_q64(current_prices_q64[i], *direction, *mag_bps);
                    let pnl = position_pnl_under_price(
                        notionals[i],
                        entry_prices_q64[i],
                        shocked,
                    );
                    net_loss = net_loss.saturating_sub(pnl);
                }
                if net_loss.is_positive() {
                    let loss_u = U256::try_from(net_loss).unwrap_or(U256::ZERO);
                    if loss_u > worst_loss {
                        worst_loss = loss_u;
                    }
                }
            }
            class_worst_loss[class_idx] = worst_loss;
        }

        let mut total: U256 = U256::ZERO;
        for class_loss in class_worst_loss.iter() {
            total = total.saturating_add(*class_loss);
        }

        let buffer =
            total.saturating_mul(U256::from(maint_margin_buffer_bps)) / U256::from(10_000u64);
        let with_buffer = total.saturating_add(buffer);

        let mut total_notional = U256::ZERO;
        for nn in notionals.iter() {
            let abs_n = U256::try_from(nn.unsigned_abs()).unwrap_or(U256::ZERO);
            total_notional = total_notional.saturating_add(abs_n);
        }
        let floor = total_notional.saturating_mul(U256::from(min_initial_margin_bps))
            / U256::from(10_000u64);

        // Silence unused-var: haircuts_bps reserved for v2 instrument-level
        // haircut weighting; SPAN floor currently absorbs it.
        let _ = haircuts_bps;
        core::cmp::max(with_buffer, floor)
    }
}

// =============================================================================
// Pure helpers
// =============================================================================
fn apply_shock_q64(price_q64: U256, direction: i32, mag_bps: u16) -> U256 {
    if direction == 0 || mag_bps == 0 {
        return price_q64;
    }
    let delta = price_q64.saturating_mul(U256::from(mag_bps)) / U256::from(10_000u64);
    if direction > 0 {
        price_q64.saturating_add(delta)
    } else {
        price_q64.saturating_sub(delta)
    }
}

fn position_pnl_under_price(
    notional_signed: I256,
    entry_price_q64: U256,
    shocked_price: U256,
) -> I256 {
    if entry_price_q64.is_zero() {
        return I256::ZERO;
    }
    let entry = I256::try_from(entry_price_q64).unwrap_or(I256::MAX);
    let shocked = I256::try_from(shocked_price).unwrap_or(I256::MAX);
    let delta = shocked.saturating_sub(entry);
    notional_signed.saturating_mul(delta) / entry
}
