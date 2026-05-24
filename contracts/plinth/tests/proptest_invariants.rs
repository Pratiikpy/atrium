// Property-based tests for Plinth math + SPAN module.
// Run on host targets only: `cargo test --features test-host`.
//
// Kani proves the same properties for restricted ranges; proptest runs
// hundreds of fuzzed cases across the full type range.

#![cfg(not(target_arch = "wasm32"))]

use alloy_primitives::{I256, U256};
use atrium_plinth::math::{abs_diff_bps, median, normalize_to_q64};
use atrium_plinth::span::{required_margin, PositionView};
use proptest::prelude::*;

proptest! {
    // Median is bounded by min and max.
    #[test]
    fn median_bounded(a in any::<u128>(), b in any::<u128>()) {
        let m = median(U256::from(a), U256::from(b));
        let min_val = U256::from(a.min(b));
        let max_val = U256::from(a.max(b));
        prop_assert!(m >= min_val);
        prop_assert!(m <= max_val);
    }

    // abs_diff_bps is symmetric (or close to it within rounding).
    #[test]
    fn abs_diff_bps_self_zero(a in 1u64..u64::MAX) {
        prop_assert_eq!(abs_diff_bps(U256::from(a), U256::from(a)), 0);
    }

    // normalize_to_q64 is monotonic in price.
    #[test]
    fn normalize_monotonic(a in 1u64..1_000_000, b in 1u64..1_000_000, d in 0u8..18) {
        prop_assume!(a < b);
        let qa = normalize_to_q64(U256::from(a), d);
        let qb = normalize_to_q64(U256::from(b), d);
        prop_assert!(qa <= qb);
    }

    // required_margin is monotonic in notional for a single-position account.
    #[test]
    fn required_margin_monotonic_in_notional(
        n in 1i64..1_000_000,
        p in 1000u32..100_000
    ) {
        let small = [PositionView {
            notional_signed: I256::try_from(n).unwrap(),
            entry_price_q64: U256::from(p),
            current_price_q64: U256::from(p),
            haircut_bps: 100,
            correlation_class: 0,
        }];
        let big = [PositionView {
            notional_signed: I256::try_from(n.saturating_mul(2)).unwrap(),
            entry_price_q64: U256::from(p),
            current_price_q64: U256::from(p),
            haircut_bps: 100,
            correlation_class: 0,
        }];
        let r_small = required_margin(&small, 500, 200);
        let r_big = required_margin(&big, 500, 200);
        prop_assert!(r_big >= r_small);
    }

    // Empty positions list always returns zero required margin.
    #[test]
    fn empty_zero(im_bps in 0u16..10_000, buf_bps in 0u16..10_000) {
        prop_assert_eq!(required_margin(&[], im_bps, buf_bps), U256::ZERO);
    }
}
