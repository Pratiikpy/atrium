// cargo-stylus 0.5.x runs `cargo run --features=export-abi` during deploy to
// validate the contract's ABI export. The cdylib export from lib.rs is what
// actually runs on chain; this main.rs is required so that `cargo run` has
// a binary target. Mirrors the pattern used by stylus-sdk-rs examples.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]

#[cfg(not(any(test, feature = "export-abi")))]
#[unsafe(no_mangle)]
pub extern "C" fn main() {}

#[cfg(feature = "export-abi")]
fn main() {
    atrium_coffer::print_from_args();
}
