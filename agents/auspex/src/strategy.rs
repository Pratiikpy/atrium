//! Auspex basis-trade strategy — pure functions.

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Signal {
    EnterBasis, // long Pendle YT + short Aave equivalent
    Close,      // gap converged
    Hold,
}

/// Decide based on the spread between Pendle implied APY and Aave T-bill APY.
pub fn signal(
    pendle_implied_apy_bps: i32,
    aave_apy_bps: i32,
    enter_threshold_bps: i32,
    exit_threshold_bps: i32,
) -> Signal {
    let spread = pendle_implied_apy_bps - aave_apy_bps;
    if spread > enter_threshold_bps {
        Signal::EnterBasis
    } else if spread.abs() < exit_threshold_bps {
        Signal::Close
    } else {
        Signal::Hold
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wide_spread_enters() {
        assert_eq!(signal(600, 500, 50, 10), Signal::EnterBasis);
    }

    #[test]
    fn converged_closes() {
        assert_eq!(signal(505, 500, 50, 10), Signal::Close);
    }

    #[test]
    fn neutral_holds() {
        assert_eq!(signal(530, 500, 50, 10), Signal::Hold);
    }

    // ── Iter 77: boundary + sign coverage ──────────────────────────────

    #[test]
    fn negative_spread_within_exit_threshold_closes() {
        // pendle=495, aave=500 → spread=-5; |spread|<10 → Close.
        assert_eq!(signal(495, 500, 50, 10), Signal::Close);
    }

    #[test]
    fn negative_spread_outside_exit_threshold_holds() {
        // spread=-20; outside exit_threshold, below enter_threshold → Hold.
        assert_eq!(signal(480, 500, 50, 10), Signal::Hold);
    }

    #[test]
    fn spread_at_exact_enter_threshold_holds() {
        // spread = enter_threshold → NOT strictly greater → Hold.
        assert_eq!(signal(550, 500, 50, 10), Signal::Hold);
    }

    #[test]
    fn spread_one_above_enter_threshold_enters() {
        assert_eq!(signal(551, 500, 50, 10), Signal::EnterBasis);
    }

    #[test]
    fn spread_at_exact_exit_threshold_holds() {
        // |spread| = exit_threshold → NOT strictly less → Hold (not Close).
        assert_eq!(signal(510, 500, 50, 10), Signal::Hold);
    }
}
