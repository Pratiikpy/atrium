// PlinthOracle — dual-oracle price reader extracted from Plinth.
//
// The caller (Plinth) passes in the feed addresses + tolerance + freshness;
// this contract reads Chainlink Data Streams + Pyth, applies all the same
// hardening (negative-price refusal, decimals-read failure surfacing, freshness
// window, 50 bps disagreement tolerance), and returns the median price in Q64.64.
//
// All checks match the original Plinth `get_safe_price` exactly. Error codes
// are returned via uint16 in the revert payload so the caller can map them
// back to its own typed errors.

#![cfg_attr(not(any(feature = "export-abi", test)), no_main)]
#![cfg_attr(not(any(feature = "export-abi", test)), no_std)]

extern crate alloc;

use alloc::{vec, vec::Vec};
use alloy_primitives::{Address, FixedBytes, U256};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;

sol_storage! {
    #[entrypoint]
    pub struct PlinthOracle {}
}

// =============================================================================
// External interfaces
// =============================================================================
sol_interface! {
    interface IChainlinkAggregator {
        function latestRoundData() external view returns (
            uint80 round_id,
            int256 answer,
            uint256 started_at,
            uint256 updated_at,
            uint80 answered_in_round
        );
        function decimals() external view returns (uint8);
    }
    interface IPyth {
        function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (
            int64 price,
            uint64 conf,
            int32 expo,
            uint256 publish_time
        );
    }
}

// =============================================================================
// Errors — caller maps to its own typed enum
// =============================================================================
sol! {
    error OracleErr(uint16 code);
    // Phase 2a: stale round error when answeredInRound < roundId
    error StaleRound();
}

#[derive(SolidityError)]
pub enum OracleError {
    Err(OracleErr),
    StaleRound(StaleRound),
}

impl OracleError {
    #[inline]
    fn code(c: u16) -> Self {
        Self::Err(OracleErr { code: c })
    }
}

pub const ERR_STALE: u16 = 3;
pub const ERR_DISAGREEMENT: u16 = 4;
pub const ERR_DECIMALS_UNREADABLE: u16 = 11;
pub const ERR_NEGATIVE_PRICE: u16 = 12;
pub const ERR_PYTH_NEGATIVE_PRICE: u16 = 15;

// =============================================================================
// Public ABI
// =============================================================================
#[public]
impl PlinthOracle {
    /// Return the dual-oracle median price for `(chainlink_feed, pyth_feed_id)`.
    ///
    /// Reverts with OracleErr(code) on any of:
    ///   3  = stale (either feed older than freshness)
    ///   4  = chainlink/pyth disagree by more than tolerance_bps
    ///   11 = chainlink.decimals() unreadable
    ///   12 = chainlink answer negative
    ///   15 = pyth price negative
    pub fn safe_price(
        &self,
        pyth_oracle: Address,
        chainlink_feed: Address,
        pyth_feed_id: FixedBytes<32>,
        freshness_seconds: u64,
        tolerance_bps: u16,
    ) -> Result<U256, OracleError> {
        let now = self.vm().block_timestamp();

        // Chainlink
        let chainlink = IChainlinkAggregator::new(chainlink_feed);
        let (cl_round_id, cl_answer, _, cl_updated, cl_answered_in_round) = chainlink
            .latest_round_data(self.vm(), Call::new())
            .map_err(|_| OracleError::code(ERR_STALE))?;
        // Phase 2a: validate answeredInRound >= roundId. If the oracle hasn't
        // answered the current round yet, the price data is stale/incomplete.
        if cl_answered_in_round < cl_round_id {
            return Err(OracleError::StaleRound(StaleRound {}));
        }
        if now.saturating_sub(cl_updated.to::<u64>()) > freshness_seconds {
            return Err(OracleError::code(ERR_STALE));
        }
        if cl_answer.is_negative() {
            return Err(OracleError::code(ERR_NEGATIVE_PRICE));
        }
        let cl_decimals = chainlink
            .decimals(self.vm(), Call::new())
            .map_err(|_| OracleError::code(ERR_DECIMALS_UNREADABLE))?;
        let cl_price = normalize_to_q64(U256::from(cl_answer.unsigned_abs()), cl_decimals);

        // Pyth
        let pyth = IPyth::new(pyth_oracle);
        let (pyth_price_i64, _, pyth_expo, pyth_publish) = pyth
            .get_price_no_older_than(
                self.vm(),
                Call::new(),
                pyth_feed_id,
                U256::from(freshness_seconds),
            )
            .map_err(|_| OracleError::code(ERR_STALE))?;
        if now.saturating_sub(pyth_publish.to::<u64>()) > freshness_seconds {
            return Err(OracleError::code(ERR_STALE));
        }
        if pyth_price_i64 < 0 {
            return Err(OracleError::code(ERR_PYTH_NEGATIVE_PRICE));
        }
        let pyth_price = normalize_pyth(pyth_price_i64, pyth_expo);

        // Tolerance check
        if abs_diff_bps(cl_price, pyth_price) > tolerance_bps {
            return Err(OracleError::code(ERR_DISAGREEMENT));
        }

        Ok(median(cl_price, pyth_price))
    }
}

// =============================================================================
// Pure helpers — copied verbatim from plinth::math so the oracle service is
// fully self-contained. (Plinth keeps a separate copy for its other math needs.)
// =============================================================================
const Q64_SCALE: U256 = U256::from_limbs([0, 1, 0, 0]); // 2^64

fn normalize_to_q64(price: U256, decimals: u8) -> U256 {
    if decimals == 0 {
        return price.saturating_mul(Q64_SCALE);
    }
    let ten = U256::from(10u64);
    let divisor = ten.pow(U256::from(decimals));
    price.saturating_mul(Q64_SCALE) / divisor
}

fn normalize_pyth(price_i64: i64, expo_i32: i32) -> U256 {
    let mag = U256::from(price_i64.unsigned_abs());
    if expo_i32 >= 0 {
        let scale = U256::from(10u64).pow(U256::from(expo_i32 as u32));
        mag.saturating_mul(scale).saturating_mul(Q64_SCALE)
    } else {
        let scale = U256::from(10u64).pow(U256::from((-expo_i32) as u32));
        mag.saturating_mul(Q64_SCALE) / scale
    }
}

/// Phase 2a fix: symmetric abs_diff_bps. Divides by max(a, b) instead of just `a`
/// so that abs_diff_bps(a, b) == abs_diff_bps(b, a). Previously dividing by `a`
/// meant the tolerance check was asymmetric — a 5% difference measured from the
/// lower price is larger than 5% measured from the higher price.
fn abs_diff_bps(a: U256, b: U256) -> u16 {
    let max_val = if a > b { a } else { b };
    if max_val.is_zero() {
        return u16::MAX;
    }
    let diff = if a > b { a - b } else { b - a };
    let bps = diff.saturating_mul(U256::from(10_000u64)) / max_val;
    if bps > U256::from(u16::MAX as u64) {
        u16::MAX
    } else {
        bps.to::<u16>()
    }
}

fn median(a: U256, b: U256) -> U256 {
    if a < b {
        a + (b - a) / U256::from(2u64)
    } else {
        b + (a - b) / U256::from(2u64)
    }
}
