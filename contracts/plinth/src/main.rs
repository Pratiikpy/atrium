// cargo-stylus 0.5.x runs `cargo run --features=export-abi` during deploy
// to validate ABI export. main.rs is the conventional binary entry point.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]

#[cfg(not(any(test, feature = "export-abi")))]
#[unsafe(no_mangle)]
pub extern "C" fn main() {}

#[cfg(feature = "export-abi")]
fn main() {
    atrium_plinth::print_from_args();
}
