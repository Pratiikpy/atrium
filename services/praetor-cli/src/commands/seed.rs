//! `praetor seed` — seed the local Sepolia fork with demo state.
//!
//! Closes `human_left.md` #30 (YYY-7). The `make demo` golden path
//! (PRD §26.2 + TDD Tenet 8: ≤90s from clone to running stack) routes
//! through this command.
//!
//! Seed steps:
//!   1. Fund 3 test wallets with 100K mock-USDC each
//!   2. Stake 3 keeper bots (1 ETH each as the Vigil min-stake)
//!   3. Open 1 example hedged position via AtriumRouter
//!   4. Publish 1 placeholder backtest attestation via ResearchAttestation
//!
//! Implementation strategy: shell out to a Forge script
//! (`scripts/seed.s.sol`) that knows the cast invocations. The Rust CLI is
//! the thin wrapper that picks the right RPC URL + private keys per network.

use std::path::PathBuf;
use std::process::Command;

use anyhow::{anyhow, Context, Result};
use tracing::{info, warn};

const ANVIL_DEFAULT_PRIVATE_KEY: &str =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

pub async fn run(network: &str) -> Result<()> {
    info!(network, "seeding demo state");

    let rpc_url = rpc_url_for_network(network)?;
    let private_key = seed_key_for_network(network)?;

    // Resolve the seed script path from the workspace root. The CLI may run
    // from `services/praetor-cli/` so we walk up if needed.
    let script_path = find_workspace_relative("scripts/seed.s.sol")
        .context("scripts/seed.s.sol not found — run `make install` from the repo root first")?;

    info!(rpc_url, "running forge script seed");
    let status = Command::new("forge")
        .args([
            "script",
            script_path.to_str().unwrap(),
            "--rpc-url",
            &rpc_url,
            "--private-key",
            &private_key,
            "--broadcast",
            "--slow",
        ])
        .status()
        .context("failed to invoke `forge script` — is foundry installed?")?;

    if !status.success() {
        warn!("forge script exited non-zero; check the demo state by hand");
        return Err(anyhow!("seed failed (exit code {:?})", status.code()));
    }

    info!("demo seed complete");
    Ok(())
}

fn rpc_url_for_network(network: &str) -> Result<String> {
    match network {
        "local" => {
            Ok(std::env::var("ANVIL_RPC_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:8545".to_string()))
        }
        "arbitrum_sepolia" => std::env::var("ARBITRUM_SEPOLIA_RPC_URL")
            .map_err(|_| anyhow!("ARBITRUM_SEPOLIA_RPC_URL env var required for sepolia seed")),
        other => Err(anyhow!("unknown network: {other}")),
    }
}

fn seed_key_for_network(network: &str) -> Result<String> {
    match network {
        "local" => Ok(std::env::var("ANVIL_DEPLOYER_KEY")
            .unwrap_or_else(|_| ANVIL_DEFAULT_PRIVATE_KEY.to_string())),
        "arbitrum_sepolia" => std::env::var("SEPOLIA_DEPLOYER_KEY")
            .map_err(|_| anyhow!("SEPOLIA_DEPLOYER_KEY env var required for sepolia seed")),
        other => Err(anyhow!("unknown network: {other}")),
    }
}

fn find_workspace_relative(rel: &str) -> Result<PathBuf> {
    let mut here = std::env::current_dir()?;
    for _ in 0..5 {
        let candidate = here.join(rel);
        if candidate.exists() {
            return Ok(candidate);
        }
        if !here.pop() {
            break;
        }
    }
    Err(anyhow!("could not locate {rel} from any parent of CWD"))
}
