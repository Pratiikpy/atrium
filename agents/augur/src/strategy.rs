//! Augur strategy module — pure functions, no I/O.

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Signal {
    EnterLong,
    EnterShort,
    Close,
    Hold,
}

#[derive(Debug, Clone, Copy)]
pub struct Bands {
    pub mean: f64,
    pub sigma: f64,
}

impl Bands {
    /// Compute mean and standard deviation over the last `window` prices.
    pub fn compute(prices: &[f64], window: usize) -> Self {
        if prices.is_empty() || window == 0 {
            return Self {
                mean: 0.0,
                sigma: 0.0,
            };
        }
        let start = prices.len().saturating_sub(window);
        let slice = &prices[start..];
        let mean = slice.iter().sum::<f64>() / slice.len() as f64;
        let variance = slice.iter().map(|p| (p - mean).powi(2)).sum::<f64>() / slice.len() as f64;
        Self {
            mean,
            sigma: variance.sqrt(),
        }
    }

    pub fn signal_for(&self, price: f64) -> Signal {
        if self.sigma == 0.0 {
            return Signal::Hold;
        }
        let zscore = (price - self.mean) / self.sigma;
        if zscore < -2.0 {
            Signal::EnterLong
        } else if zscore > 2.0 {
            Signal::EnterShort
        } else if zscore.abs() < 1.0 {
            Signal::Close
        } else {
            Signal::Hold
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_prices_hold() {
        let b = Bands::compute(&[], 20);
        assert_eq!(b.signal_for(100.0), Signal::Hold);
    }

    #[test]
    fn long_when_oversold() {
        // mean=100, sigma=10, price=70 → z = -3 → EnterLong
        let prices: Vec<f64> = (0..20).map(|i| 100.0 + (i as f64) * 0.1).collect();
        let b = Bands::compute(&prices, 20);
        assert_eq!(
            b.signal_for(b.mean - 3.0 * b.sigma.max(1.0)),
            Signal::EnterLong
        );
    }

    // ── Iter 77: cover remaining branches ──────────────────────────────

    #[test]
    fn short_when_overbought() {
        let prices: Vec<f64> = (0..20).map(|i| 100.0 + (i as f64) * 0.1).collect();
        let b = Bands::compute(&prices, 20);
        // z = +3 → EnterShort
        assert_eq!(
            b.signal_for(b.mean + 3.0 * b.sigma.max(1.0)),
            Signal::EnterShort
        );
    }

    #[test]
    fn close_when_near_mean() {
        let prices: Vec<f64> = (0..20).map(|i| 100.0 + (i as f64) * 0.1).collect();
        let b = Bands::compute(&prices, 20);
        // price = mean → z = 0 → Close (|z| < 1)
        assert_eq!(b.signal_for(b.mean), Signal::Close);
    }

    #[test]
    fn hold_in_middle_band() {
        let prices: Vec<f64> = (0..20).map(|i| 100.0 + (i as f64) * 0.1).collect();
        let b = Bands::compute(&prices, 20);
        // z = 1.5 → between Close (|z|<1) and EnterShort (z>2) → Hold.
        // Use raw sigma (NOT .max(1.0)) so z is exactly 1.5 not amplified.
        assert!(b.sigma > 0.0, "test precondition: non-zero sigma");
        let price = b.mean + 1.5 * b.sigma;
        assert_eq!(b.signal_for(price), Signal::Hold);
    }

    #[test]
    fn zero_sigma_holds() {
        // All-same prices → sigma = 0 → division-by-zero guard returns Hold.
        let prices: Vec<f64> = vec![100.0; 20];
        let b = Bands::compute(&prices, 20);
        assert_eq!(b.sigma, 0.0);
        assert_eq!(b.signal_for(50.0), Signal::Hold);
        assert_eq!(b.signal_for(200.0), Signal::Hold);
    }

    #[test]
    fn window_larger_than_prices_uses_what_is_available() {
        // saturating_sub keeps the slice non-negative when window > len.
        let prices: Vec<f64> = vec![100.0, 110.0, 90.0];
        let b = Bands::compute(&prices, 100);
        // Should average all 3 prices: mean = 100.
        assert_eq!(b.mean, 100.0);
        assert!(b.sigma > 0.0);
    }

    #[test]
    fn window_zero_returns_zero_bands() {
        // Early-return guard for window == 0.
        let prices: Vec<f64> = vec![100.0, 110.0, 90.0];
        let b = Bands::compute(&prices, 0);
        assert_eq!(b.mean, 0.0);
        assert_eq!(b.sigma, 0.0);
    }
}
