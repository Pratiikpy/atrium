// Integration tests for Plinth using stylus-sdk::testing::TestVM
//
// These exercise the public ABI in isolation (mocked oracles, mocked
// Vigil/Coffer/Sigil/PorticoRegistry). End-to-end tests against real
// contracts on Sepolia live in tests/foundry/ and tests/e2e/.

#![cfg(test)]

use super::*;

// Placeholder for stylus-sdk::testing API — exact module path is verified
// against stylus-sdk-rs 0.6+ before Wave-1 dev. Open question in TDD §24.3.
//
// Pattern (per stylus-sdk-rs/examples/erc20/src/erc20.rs):
//
//   use stylus_sdk::testing::*;
//   let vm = TestVM::default();
//   let mut plinth = Plinth::from(&vm);
//   plinth.initialize(...);
//   assert!(plinth.open_position(...).is_ok());

#[test]
fn placeholder_smoke() {
    // Real tests land Week 0 — F1 verifies the TestVM API and writes
    // unit coverage matching the §14 testing pyramid.
    //
    // Required tests (per TDD §14.1):
    //  - open_position happy path
    //  - open_position with TooManyPositions error at cap
    //  - open_position with OracleStale error
    //  - update_margin caller authorization (4 cases)
    //  - update_margin reentrancy guard
    //  - close_position from owner, from Vigil, from stranger (error)
    //  - margin_version bumps on every update
    //  - pause/resume Praetor-only
    //  - set_instrument_risk Praetor-only
    assert!(true);
}
