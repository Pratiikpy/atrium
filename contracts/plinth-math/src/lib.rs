// PlinthMath, SPAN margin compute, extracted from Plinth.
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

// =============================================================================
// Errors, Phase 2a: replace silent U256::ZERO returns with typed reverts
// =============================================================================
sol! {
    error ArrayLengthMismatch();
    error PriceOutOfRange();
}

#[derive(SolidityError)]
pub enum PlinthMathError {
    ArrayLengthMismatch(ArrayLengthMismatch),
    PriceOutOfRange(PriceOutOfRange),
}

sol_storage! {
    #[entrypoint]
    pub struct PlinthMath {}
}

// =============================================================================
// Constants, must match the off-chain risk model
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

/// Phase 2a fix: upper bound for entry_price_q64. Prices are Q64.64 fixed-point;
/// values above 2^128 indicate a corrupted or malicious input.
const MAX_ENTRY_PRICE_Q64: U256 = U256::from_limbs([0, 0, 1, 0]); // 2^128

// =============================================================================
// Public ABI, Plinth calls this via staticcall
// =============================================================================
#[public]
impl PlinthMath {
    /// Compute required margin across all positions using SPAN scenario matrix.
    ///
    /// All position arrays must be the same length. Returns required margin
    /// in the same scale as `notionals` (Q64.64 fixed-point absorbed inside).
    pub fn required_margin(
        &self,
        notionals: Vec<I256>,
        entry_prices_q64: Vec<U256>,
        current_prices_q64: Vec<U256>,
        haircuts_bps: Vec<u16>,
        correlation_classes: Vec<u16>,
        min_initial_margin_bps: u16,
        maint_margin_buffer_bps: u16,
    ) -> Result<U256, PlinthMathError> {
        let n = notionals.len();
        // Phase 2a fix #1: revert on array length mismatch instead of returning 0.
        if n == 0
            || entry_prices_q64.len() != n
            || current_prices_q64.len() != n
            || haircuts_bps.len() != n
            || correlation_classes.len() != n
        {
            return Err(PlinthMathError::ArrayLengthMismatch(ArrayLengthMismatch {}));
        }

        // Phase 2a fix #4: revert if any entry_price_q64 exceeds sane upper bound.
        for i in 0..n {
            if entry_prices_q64[i] > MAX_ENTRY_PRICE_Q64 {
                return Err(PlinthMathError::PriceOutOfRange(PriceOutOfRange {}));
            }
        }

        let mut class_worst_loss: [U256; MAX_CORRELATION_CLASSES] =
            [U256::ZERO; MAX_CORRELATION_CLASSES];

        for class_idx in 0..MAX_CORRELATION_CLASSES {
            let mut worst_loss = U256::ZERO;
            // Phase 2a fix #2: track max haircut in this class for amplification.
            let mut max_haircut_in_class_bps: u16 = 0;

            for (direction, mag_bps) in SCENARIOS_BPS.iter() {
                let mut net_loss = I256::ZERO;
                for i in 0..n {
                    // Phase 2a fix #5: correlation_class == 0 means each position
                    // is its own class. We handle this by only matching positions
                    // whose class equals class_idx AND class_idx > 0. Class-0
                    // positions are handled in a separate pass below.
                    if correlation_classes[i] == 0 {
                        continue; // handled individually below
                    }
                    if correlation_classes[i] as usize != class_idx {
                        continue;
                    }
                    if haircuts_bps[i] > max_haircut_in_class_bps {
                        max_haircut_in_class_bps = haircuts_bps[i];
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

            // Phase 2a fix #2: haircuts amplify worst-case loss.
            // Rationale: haircuts represent illiquidity/concentration risk that
            // makes the worst-case scenario MORE expensive to unwind. The SPAN
            // worst-loss is the theoretical mark-to-market loss; the haircut
            // captures the additional slippage/market-impact cost of actually
            // closing the position under stress.
            // Formula: worst_loss *= (10000 + max_haircut_bps) / 10000
            if max_haircut_in_class_bps > 0 && !worst_loss.is_zero() {
                worst_loss = worst_loss
                    .saturating_mul(U256::from(10_000u64 + max_haircut_in_class_bps as u64))
                    / U256::from(10_000u64);
            }

            class_worst_loss[class_idx] = worst_loss;
        }

        // Phase 2a fix #5: handle correlation_class == 0 positions individually.
        // Each class-0 position is treated as its own independent class, no
        // netting across positions. This prevents the "all class-0 positions net
        // together" bug where unrelated instruments cancel each other's risk.
        //
        // DEPENDENCY NOTE: Plinth.set_instrument_risk validates correlation_class > 0
        // for new instruments. Class 0 is reserved for "uncorrelated / standalone"
        // semantics. If an instrument somehow has class 0, it gets maximum margin
        // treatment (no netting benefit).
        let mut class_zero_total = U256::ZERO;
        for i in 0..n {
            if correlation_classes[i] != 0 {
                continue;
            }
            let mut worst_loss_this_pos = U256::ZERO;
            for (direction, mag_bps) in SCENARIOS_BPS.iter() {
                let shocked = apply_shock_q64(current_prices_q64[i], *direction, *mag_bps);
                let pnl = position_pnl_under_price(notionals[i], entry_prices_q64[i], shocked);
                let neg_pnl = I256::ZERO.saturating_sub(pnl);
                if neg_pnl.is_positive() {
                    let loss_u = U256::try_from(neg_pnl).unwrap_or(U256::ZERO);
                    if loss_u > worst_loss_this_pos {
                        worst_loss_this_pos = loss_u;
                    }
                }
            }
            // Apply per-position haircut amplification
            if haircuts_bps[i] > 0 && !worst_loss_this_pos.is_zero() {
                worst_loss_this_pos = worst_loss_this_pos
                    .saturating_mul(U256::from(10_000u64 + haircuts_bps[i] as u64))
                    / U256::from(10_000u64);
            }
            class_zero_total = class_zero_total.saturating_add(worst_loss_this_pos);
        }

        let mut total: U256 = class_zero_total;
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

        Ok(core::cmp::max(with_buffer, floor))
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

/// Phase 2a fix #3: floor-divide signed PnL toward negative infinity.
/// Standard Rust integer division truncates toward zero; for margin calculations
/// we need floor division so that negative PnL is never under-estimated.
///
/// floor_div(7, 2) = 3, floor_div(-7, 2) = -4 (not -3).
fn signed_floor_div(numerator: I256, denominator: I256) -> I256 {
    if denominator.is_zero() {
        return I256::ZERO; // defensive: avoid div-by-zero panic
    }
    let q = numerator / denominator;
    let r = numerator % denominator;
    // If remainder is non-zero and signs of numerator and denominator differ,
    // the truncated quotient is above the floor, subtract 1.
    if !r.is_zero() && ((numerator ^ denominator).is_negative()) {
        q - I256::try_from(1i64).unwrap_or(I256::ZERO)
    } else {
        q
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
    // Phase 2a fix #3: use floor division for signed PnL so negative values
    // are never under-estimated (rounded toward zero would under-count losses).
    signed_floor_div(notional_signed.saturating_mul(delta), entry)
}
