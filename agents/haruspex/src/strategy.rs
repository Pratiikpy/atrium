//! Haruspex strategy, RSI momentum on a single HIP-3 stock perp.

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Signal {
    EnterLong,
    EnterShort,
    Close,
    Hold,
}

/// Relative strength index over the last `period` candles.
pub fn rsi(prices: &[f64], period: usize) -> Option<f64> {
    if prices.len() < period + 1 {
        return None;
    }
    let start = prices.len().saturating_sub(period + 1);
    let slice = &prices[start..];
    let mut gains = 0.0;
    let mut losses = 0.0;
    for w in slice.windows(2) {
        let delta = w[1] - w[0];
        if delta >= 0.0 {
            gains += delta;
        } else {
            losses -= delta;
        }
    }
    if losses == 0.0 {
        return Some(100.0);
    }
    let rs = (gains / period as f64) / (losses / period as f64);
    Some(100.0 - 100.0 / (1.0 + rs))
}

pub fn signal_from_rsi(value: Option<f64>) -> Signal {
    let Some(v) = value else { return Signal::Hold };
    if v > 70.0 {
        Signal::EnterLong
    } else if v < 30.0 {
        Signal::EnterShort
    } else if (40.0..=60.0).contains(&v) {
        Signal::Close
    } else {
        Signal::Hold
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rsi_needs_period_plus_one() {
        let prices: Vec<f64> = (0..9).map(|i| 100.0 + i as f64).collect();
        assert!(rsi(&prices, 10).is_none());
    }

    #[test]
    fn strong_uptrend_high_rsi() {
        let prices: Vec<f64> = (0..15).map(|i| 100.0 + i as f64).collect();
        let v = rsi(&prices, 10);
        assert!(v.is_some());
        assert!(v.unwrap() > 70.0);
    }

    // ── Iter 77: cover remaining branches ──────────────────────────────

    #[test]
    fn strong_downtrend_low_rsi() {
        let prices: Vec<f64> = (0..15).map(|i| 100.0 - i as f64).collect();
        let v = rsi(&prices, 10);
        assert!(v.is_some());
        assert!(v.unwrap() < 30.0);
    }

    #[test]
    fn flat_prices_zero_losses_returns_100() {
        // All gains, zero losses → early-return 100.0 (avoids the
        // gains/losses divide-by-zero on flat or only-rising data).
        let prices: Vec<f64> = (0..15).map(|i| 100.0 + i as f64).collect();
        let v = rsi(&prices, 10);
        assert_eq!(v, Some(100.0));
    }

    #[test]
    fn signal_from_rsi_none_holds() {
        // Insufficient history → don't blindly trade.
        assert_eq!(signal_from_rsi(None), Signal::Hold);
    }

    #[test]
    fn signal_from_rsi_overbought_enters_long() {
        assert_eq!(signal_from_rsi(Some(75.0)), Signal::EnterLong);
        assert_eq!(signal_from_rsi(Some(100.0)), Signal::EnterLong);
    }

    #[test]
    fn signal_from_rsi_oversold_enters_short() {
        assert_eq!(signal_from_rsi(Some(20.0)), Signal::EnterShort);
        assert_eq!(signal_from_rsi(Some(5.0)), Signal::EnterShort);
    }

    #[test]
    fn signal_from_rsi_neutral_band_closes() {
        assert_eq!(signal_from_rsi(Some(50.0)), Signal::Close);
        assert_eq!(signal_from_rsi(Some(40.0)), Signal::Close);
        assert_eq!(signal_from_rsi(Some(60.0)), Signal::Close);
    }

    #[test]
    fn signal_from_rsi_transition_band_holds() {
        assert_eq!(signal_from_rsi(Some(35.0)), Signal::Hold);
        assert_eq!(signal_from_rsi(Some(65.0)), Signal::Hold);
    }

    #[test]
    fn signal_from_rsi_boundary_at_70_holds() {
        assert_eq!(signal_from_rsi(Some(70.0)), Signal::Hold);
    }

    #[test]
    fn signal_from_rsi_boundary_at_30_holds() {
        assert_eq!(signal_from_rsi(Some(30.0)), Signal::Hold);
    }
}
