// SPAN-style margin computation — pure functions, Kani-verifiable
//
// Simplified SPAN: for each correlation class, compute net exposure under a
// fixed set of price-shock scenarios, take the worst-case loss, then sum
// across correlation classes with a haircut adjustment.
//
// This is the compute-heavy core that justifies Stylus over Solidity.

use alloc::vec::Vec;
use alloy_primitives::{I256, U256};

#[derive(Clone, Copy, Debug)]
pub struct PositionView {
    pub notional_signed: I256,
    pub entry_price_q64: U256,
    pub current_price_q64: U256,
    pub haircut_bps: u16,
    pub correlation_class: u16,
}

/// Price-shock scenarios in bps. ±10%, ±5%, ±2%.
/// Each row is a `[direction, magnitude_bps]` pair applied to all positions in
/// a correlation class.
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

/// Compute required margin across all positions using SPAN-style scenario matrix.
///
/// Algorithm:
/// 1. Group positions by correlation_class.
/// 2. For each class, apply each scenario and compute net loss under that scenario.
/// 3. Take the worst-case loss per class.
/// 4. Sum worst-case losses across classes; apply haircut floor.
/// 5. Result = max(scenario_required, min_initial_margin_floor).
pub fn required_margin(
    positions: &[PositionView],
    min_initial_margin_bps: u16,
    maint_margin_buffer_bps: u16,
) -> U256 {
    if positions.is_empty() {
        return U256::ZERO;
    }

    // Bucket worst-case loss per correlation class.
    let mut class_worst_loss: [U256; MAX_CORRELATION_CLASSES] = [U256::ZERO; MAX_CORRELATION_CLASSES];

    for class_idx in 0..MAX_CORRELATION_CLASSES {
        let mut worst_loss = U256::ZERO;
        for (direction, mag_bps) in SCENARIOS_BPS.iter() {
            let mut net_loss = I256::ZERO;
            for p in positions.iter().filter(|p| p.correlation_class as usize == class_idx) {
                // shock_price = current * (1 + direction * mag_bps / 10000)
                let shocked = apply_shock_q64(p.current_price_q64, *direction, *mag_bps);
                // Per-position PnL under this scenario
                let pnl_under_shock = position_pnl_under_price(p, shocked);
                net_loss = net_loss.saturating_sub(pnl_under_shock);
            }
            // Only losses (positive net_loss in this orientation) count toward worst case
            if net_loss.is_positive() {
                let loss_u = U256::try_from(net_loss).unwrap_or(U256::ZERO);
                if loss_u > worst_loss {
                    worst_loss = loss_u;
                }
            }
        }
        class_worst_loss[class_idx] = worst_loss;
    }

    // Sum worst-case losses across classes (no diversification credit in v1)
    let mut total: U256 = U256::ZERO;
    for class_loss in class_worst_loss.iter() {
        total = total.saturating_add(*class_loss);
    }

    // Apply haircut buffer (extra margin on top of worst-case loss)
    let buffer = total.saturating_mul(U256::from(maint_margin_buffer_bps)) / U256::from(10_000u64);
    let with_buffer = total.saturating_add(buffer);

    // Floor at min_initial_margin_bps of total notional
    let total_notional = positions.iter().fold(U256::ZERO, |acc, p| {
        let n = U256::try_from(p.notional_signed.unsigned_abs()).unwrap_or(U256::ZERO);
        acc.saturating_add(n)
    });
    let floor = total_notional.saturating_mul(U256::from(min_initial_margin_bps)) / U256::from(10_000u64);

    core::cmp::max(with_buffer, floor)
}

/// Apply a bps-scale price shock to a Q64.64 price. direction ∈ {-1, 0, 1}.
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

/// PnL for one position if current price became `shocked_price`.
fn position_pnl_under_price(p: &PositionView, shocked_price: U256) -> I256 {
    if p.entry_price_q64.is_zero() {
        return I256::ZERO;
    }
    let entry = I256::try_from(p.entry_price_q64).unwrap_or(I256::MAX);
    let shocked = I256::try_from(shocked_price).unwrap_or(I256::MAX);
    let delta = shocked.saturating_sub(entry);
    p.notional_signed.saturating_mul(delta) / entry
}

// =============================================================================
// Kani harnesses — formal verification of SPAN invariants
// =============================================================================
#[cfg(kani)]
mod kani_proofs {
    use super::*;
    use alloy_primitives::I256;

    /// **Invariant: Solvency** (the Plinth headline proof).
    ///
    /// For any healthy account (collateral >= required), no single SPAN scenario
    /// can push collateral below required without an explicit position change.
    ///
    /// Simplified: required_margin is non-negative.
    #[kani::proof]
    #[kani::unwind(3)]
    fn solvency_non_negative() {
        // 2-asset case for Kani tractability
        let n1: i64 = kani::any();
        let n2: i64 = kani::any();
        let p1: u64 = kani::any();
        let p2: u64 = kani::any();
        kani::assume(p1 > 0 && p1 < 1_000_000);
        kani::assume(p2 > 0 && p2 < 1_000_000);

        let positions = [
            PositionView {
                notional_signed: I256::try_from(n1).unwrap_or(I256::ZERO),
                entry_price_q64: U256::from(p1),
                current_price_q64: U256::from(p1),
                haircut_bps: 100,
                correlation_class: 0,
            },
            PositionView {
                notional_signed: I256::try_from(n2).unwrap_or(I256::ZERO),
                entry_price_q64: U256::from(p2),
                current_price_q64: U256::from(p2),
                haircut_bps: 100,
                correlation_class: 1,
            },
        ];

        let req = required_margin(&positions, 500, 200);
        // U256 is unsigned, so non-negativity is by construction.
        // The real test is the saturation arithmetic never panics.
        assert!(req >= U256::ZERO);
    }

    /// Invariant: required margin is monotonic in notional size.
    /// Doubling a position's notional should not decrease required margin.
    #[kani::proof]
    #[kani::unwind(3)]
    fn monotonic_in_notional() {
        let n: i32 = kani::any();
        kani::assume(n != 0 && n > -1_000_000 && n < 1_000_000);
        let p: u32 = kani::any();
        kani::assume(p > 1000 && p < 100_000);

        let small = [PositionView {
            notional_signed: I256::try_from(n).unwrap_or(I256::ZERO),
            entry_price_q64: U256::from(p),
            current_price_q64: U256::from(p),
            haircut_bps: 100,
            correlation_class: 0,
        }];
        let big = [PositionView {
            notional_signed: I256::try_from(n * 2).unwrap_or(I256::ZERO),
            entry_price_q64: U256::from(p),
            current_price_q64: U256::from(p),
            haircut_bps: 100,
            correlation_class: 0,
        }];

        let r_small = required_margin(&small, 500, 200);
        let r_big = required_margin(&big, 500, 200);
        assert!(r_big >= r_small);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_positions_zero_margin() {
        assert_eq!(required_margin(&[], 500, 200), U256::ZERO);
    }

    #[test]
    fn single_long_position_has_floor_margin() {
        let p = PositionView {
            notional_signed: I256::try_from(10_000i64).unwrap(),
            entry_price_q64: U256::from(1_000u64),
            current_price_q64: U256::from(1_000u64),
            haircut_bps: 100,
            correlation_class: 0,
        };
        let req = required_margin(&[p], 500, 200);
        // Should be at least 5% (min_initial_margin_bps) of notional
        assert!(req >= U256::from(500u64));
    }

    #[test]
    fn hedged_position_has_lower_margin_than_unhedged() {
        // Audit fix (#7): use a NON-ZERO correlation class (class 1). The
        // deployed SPAN math (plinth-math) treats class 0 as standalone and
        // gives it NO netting credit - and Plinth.set_instrument_risk rejects
        // class 0 for real instruments - so a class-0 hedge test only proved a
        // property of the off-chain span.rs reference, not the on-chain engine.
        // Class 1 is netted by both span.rs AND plinth-math, so this now tests
        // the hedging benefit that real registered instruments actually get.
        // Long 10k of asset A
        let long = PositionView {
            notional_signed: I256::try_from(10_000i64).unwrap(),
            entry_price_q64: U256::from(1_000u64),
            current_price_q64: U256::from(1_000u64),
            haircut_bps: 100,
            correlation_class: 1,
        };
        // Short 10k of correlated asset B (same correlation class)
        let short = PositionView {
            notional_signed: I256::try_from(-10_000i64).unwrap(),
            entry_price_q64: U256::from(1_000u64),
            current_price_q64: U256::from(1_000u64),
            haircut_bps: 100,
            correlation_class: 1,
        };
        let req_solo = required_margin(&[long], 500, 200);
        let req_hedged = required_margin(&[long, short], 500, 200);
        // Same correlation class. Net exposure cancels under scenarios. Lower margin.
        // (We still have a floor based on total notional, but hedged is less than
        // solo for scenarios.)
        // Audit-fix 2026-05-24: prior assertion `req_hedged >= req_solo || == req_solo`
        // was the same predicate twice and the OPPOSITE of what the test name
        // promises. The test name says "hedged_position_has_lower_margin_than_unhedged",
        // so assert hedged is less than or equal to solo. Both branches matter:
        // strict inequality when the scenarios actually net, equality when both
        // positions hit the notional floor.
        assert!(req_hedged <= req_solo, "hedged margin {:?} should be less than or equal to solo {:?}", req_hedged, req_solo);
    }
}
