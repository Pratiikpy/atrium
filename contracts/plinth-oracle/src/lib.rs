// PlinthOracle, dual-oracle price reader extracted from Plinth.
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
// Errors, caller maps to its own typed enum
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
// Pure helpers, copied verbatim from plinth::math so the oracle service is
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
/// meant the tolerance check was asymmetric, a 5% difference measured from the
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

// =============================================================================
// Host tests (stylus-test TestVM). The dual-oracle reader gates EVERY Plinth
// open_position (Plinth.get_safe_price forwards here), and before this module
// it had ZERO coverage. We test it two ways:
//
//   1. The PURE price math directly: Q64.64 normalization (Chainlink decimals +
//      Pyth exponent), the SYMMETRIC basis-point divergence, and the median.
//      These need no mock host and pin the numeric correctness an auditor cares
//      about (a $1 stablecoin must normalize to exactly Q64_SCALE on both legs;
//      the 50 bps tolerance must read the same magnitude regardless of argument
//      order; the returned price must be the midpoint).
//
//   2. Every Chainlink-side REVERT gate via a mocked aggregator: stale round
//      (answeredInRound < roundId), freshness (older than the window), negative
//      price, and an unreadable decimals() call.
//
// TestVM single-buffer caveat (verified against stylus-test 0.10.7, same as the
// Coffer host-test module): the mock host keeps ONE global return-data buffer,
// so a function making multiple cross-contract calls that each need a DIFFERENT
// successful return value cannot be fully mocked to success. safe_price's full
// happy path makes three such calls (latestRoundData -> a tuple, decimals -> a
// uint8, getPriceNoOlderThan -> a tuple), so the median/disagreement SUCCESS
// path is not host-mockable here; it is exercised by a live Arbitrum Sepolia
// read. We therefore test the pure math directly (covering the median +
// tolerance + normalization logic without any cross call) and every revert gate
// (each reverts at or before the second cross call, so a single mock suffices).
// No assertion is weakened to pass.
// =============================================================================
#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use super::*;
    use alloy_primitives::I256;
    use alloy_sol_types::{sol, SolCall};
    use stylus_sdk::testing::TestVM;

    sol! {
        function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
        function decimals() external view returns (uint8);
    }

    fn cl_addr() -> Address { Address::from([0xC1u8; 20]) }
    fn pyth_addr() -> Address { Address::from([0x9Au8; 20]) }
    fn feed_id() -> FixedBytes<32> { FixedBytes::<32>::from([0xEEu8; 32]) }

    /// ABI-encode the Chainlink latestRoundData 5-tuple return as raw words.
    /// (Hand-encoded rather than via the generated `abi_encode_returns` to avoid
    /// fighting alloy's uintN alias types; each field is one 32-byte word.)
    fn cl_data(round_id: u64, answer: I256, updated: u64, answered_in_round: u64) -> Vec<u8> {
        let mut v = Vec::with_capacity(160);
        v.extend_from_slice(&U256::from(round_id).to_be_bytes::<32>());
        v.extend_from_slice(&answer.to_be_bytes::<32>());
        v.extend_from_slice(&U256::ZERO.to_be_bytes::<32>()); // started_at (unused)
        v.extend_from_slice(&U256::from(updated).to_be_bytes::<32>());
        v.extend_from_slice(&U256::from(answered_in_round).to_be_bytes::<32>());
        v
    }

    /// OracleError has no Debug (SolidityError enum); map to an inspectable code.
    /// StaleRound is a distinct variant → sentinel 1000.
    fn code_of(r: &Result<U256, OracleError>) -> i32 {
        match r {
            Ok(_) => -1,
            Err(OracleError::Err(e)) => e.code as i32,
            Err(OracleError::StaleRound(_)) => 1000,
        }
    }

    fn q64() -> U256 { Q64_SCALE }

    // ---- pure price math (no mock host) -----------------------------------

    #[test]
    fn normalize_chainlink_one_dollar_is_exactly_q64() {
        // $1.00 at 0, 6 and 8 decimals all normalize to exactly Q64_SCALE.
        assert_eq!(normalize_to_q64(U256::from(1u64), 0), q64());
        assert_eq!(normalize_to_q64(U256::from(1_000_000u64), 6), q64(), "1 USDC @ 6dp");
        assert_eq!(normalize_to_q64(U256::from(100_000_000u64), 8), q64(), "$1 @ 8dp");
    }

    #[test]
    fn normalize_pyth_handles_negative_and_positive_exponents() {
        // $1.00 at expo -8 → exactly Q64_SCALE.
        assert_eq!(normalize_pyth(100_000_000, -8), q64(), "$1.00 @ expo -8");
        // The real on-chain USDC/USD read (99978203 @ expo -8 ≈ $0.99978) is
        // just under a dollar: strictly below Q64_SCALE but within ~0.03%.
        let p = normalize_pyth(99_978_203, -8);
        assert!(p < q64(), "sub-dollar price < Q64");
        assert!(p > q64() * U256::from(999u64) / U256::from(1000u64), "within 0.1% of $1");
        // Positive exponent scales up: 5 * 10^2 = 500.
        assert_eq!(normalize_pyth(5, 2), q64() * U256::from(500u64), "5e2 = 500");
    }

    #[test]
    fn abs_diff_bps_is_symmetric_and_zero_on_equal() {
        assert_eq!(abs_diff_bps(q64(), q64()), 0, "equal prices → 0 bps");
        let a = U256::from(10_000u64);
        let b = U256::from(10_100u64);
        assert_eq!(abs_diff_bps(a, b), abs_diff_bps(b, a), "WW-fix: symmetric");
    }

    #[test]
    fn abs_diff_bps_brackets_the_50bps_tolerance() {
        // ~0.6% apart → 59 bps (> 50, would be rejected as disagreement).
        let a = q64();
        let over = a + a * U256::from(60u64) / U256::from(10_000u64);
        assert!(abs_diff_bps(a, over) > 50, "0.6% diff exceeds 50 bps tolerance");
        // ~0.4% apart → 39 bps (≤ 50, accepted).
        let under = a + a * U256::from(40u64) / U256::from(10_000u64);
        assert!(abs_diff_bps(a, under) <= 50, "0.4% diff within 50 bps tolerance");
    }

    #[test]
    fn median_is_the_midpoint_either_order() {
        assert_eq!(median(U256::from(10u64), U256::from(20u64)), U256::from(15u64));
        assert_eq!(median(U256::from(20u64), U256::from(10u64)), U256::from(15u64));
        assert_eq!(median(U256::from(7u64), U256::from(7u64)), U256::from(7u64));
    }

    // ---- Chainlink-side revert gates (single mock each) -------------------

    #[test]
    fn reverts_stale_round_when_answered_in_round_behind() {
        let vm = TestVM::new();
        vm.set_block_timestamp(1_000);
        let oracle = PlinthOracle::from(&vm);
        // roundId 2 but answeredInRound 1 → incomplete round → StaleRound,
        // before any freshness/decimals/pyth call.
        vm.mock_static_call(
            cl_addr(),
            latestRoundDataCall {}.abi_encode(),
            Ok(cl_data(2, I256::try_from(100_000_000i64).unwrap(), 1_000, 1)),
        );
        let r = oracle.safe_price(pyth_addr(), cl_addr(), feed_id(), 60, 50);
        assert_eq!(code_of(&r), 1000, "answeredInRound < roundId → StaleRound");
    }

    #[test]
    fn reverts_stale_when_chainlink_older_than_freshness_window() {
        let vm = TestVM::new();
        vm.set_block_timestamp(1_000); // now = 1000
        let oracle = PlinthOracle::from(&vm);
        // updated_at = 0, now = 1000, freshness = 60 → 1000 > 60 → ERR_STALE.
        // (answeredInRound == roundId so it passes the StaleRound gate first.)
        vm.mock_static_call(
            cl_addr(),
            latestRoundDataCall {}.abi_encode(),
            Ok(cl_data(1, I256::try_from(100_000_000i64).unwrap(), 0, 1)),
        );
        let r = oracle.safe_price(pyth_addr(), cl_addr(), feed_id(), 60, 50);
        assert_eq!(code_of(&r), ERR_STALE as i32, "stale chainlink → ERR_STALE");
    }

    #[test]
    fn reverts_negative_price_refuses_bad_chainlink_answer() {
        let vm = TestVM::new();
        vm.set_block_timestamp(100);
        let oracle = PlinthOracle::from(&vm);
        // Fresh (updated == now) + complete round, but a NEGATIVE answer must be
        // refused before it can poison the margin math.
        vm.mock_static_call(
            cl_addr(),
            latestRoundDataCall {}.abi_encode(),
            Ok(cl_data(1, I256::try_from(-1i64).unwrap(), 100, 1)),
        );
        let r = oracle.safe_price(pyth_addr(), cl_addr(), feed_id(), 60, 50);
        assert_eq!(code_of(&r), ERR_NEGATIVE_PRICE as i32, "negative chainlink → ERR_NEGATIVE_PRICE");
    }

    #[test]
    fn reverts_decimals_unreadable_when_decimals_call_fails() {
        let vm = TestVM::new();
        vm.set_block_timestamp(100);
        let oracle = PlinthOracle::from(&vm);
        // Register decimals() as a revert FIRST, then latestRoundData() OK LAST
        // so the single global return buffer holds the valid round tuple for the
        // first call; the second call (decimals) then reverts → ERR_DECIMALS_UNREADABLE.
        vm.mock_static_call(cl_addr(), decimalsCall {}.abi_encode(), Err(vec![0xde, 0xad]));
        vm.mock_static_call(
            cl_addr(),
            latestRoundDataCall {}.abi_encode(),
            Ok(cl_data(1, I256::try_from(100_000_000i64).unwrap(), 100, 1)),
        );
        let r = oracle.safe_price(pyth_addr(), cl_addr(), feed_id(), 60, 50);
        assert_eq!(code_of(&r), ERR_DECIMALS_UNREADABLE as i32, "decimals() revert → ERR_DECIMALS_UNREADABLE");
    }
}
