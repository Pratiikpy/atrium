//! `praetor seed`, seed the local Sepolia fork with demo state.
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

    // Phase zeta.6 pre-flight: confirm Coffer.set_adapter is wired before
    // seeding. The seed script opens a position via AtriumRouter, which
    // calls Coffer.adapterPull, which reverts UnauthorizedCaller until
    // the timelock batch executes (2026-05-26T15:43Z for sepolia).
    // Skipped on local fork where the state is fresh and the seed script
    // sets adapters inline.
    if network == "arbitrum_sepolia" {
        if let Err(e) = preflight_coffer_wired(&rpc_url).await {
            return Err(anyhow!(
                "seed pre-flight failed: {}\n\
                 Coffer.setAdapter has not been executed yet. The timelock \
                 batch scheduled 2026-05-24 executes at 2026-05-26T15:43Z. \
                 Wait for execute or seed against a local fork instead \
                 (`praetor seed --network local`).",
                e
            ));
        }
    }

    // Resolve the seed script path from the workspace root. The CLI may run
    // from `services/praetor-cli/` so we walk up if needed.
    let script_path = find_workspace_relative("scripts/seed.s.sol")
        .context("scripts/seed.s.sol not found, run `make install` from the repo root first")?;

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
        .context("failed to invoke `forge script`, is foundry installed?")?;

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

async fn preflight_coffer_wired(rpc_url: &str) -> Result<()> {
    // Check Coffer.isAdapterApproved(adapter-curve) via eth_call. The Curve
    // adapter is the first venue the seed script opens against (gas-cheap +
    // doesn't need validator signatures). If true, the timelock batch
    // executed and the seed script will succeed; if false, bail.
    use serde_json::json;
    const COFFER: &str = "0xd169554caf920f1fbcffbafcff3068a84892b0d8";
    const CURVE_ADAPTER: &str = "0xf3da25f3ff8bdddc093e34c2f2b117cdb7505682";
    // ABI selector for isAdapterApproved(address) -> 0x96749b21
    let calldata = format!("0x96749b21{:0>64}", &CURVE_ADAPTER[2..].to_lowercase());
    let body = json!({
        "jsonrpc": "2.0",
        "method": "eth_call",
        "params": [
            { "to": COFFER, "data": calldata },
            "latest"
        ],
        "id": 1,
    });
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    let r = client
        .post(rpc_url)
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .context("RPC unreachable for pre-flight")?;
    let body_text = r.text().await.context("read pre-flight response")?;
    // True = 0x...01; False = 0x...00 or absent.
    if !body_text.contains("0x0000000000000000000000000000000000000000000000000000000000000001") {
        return Err(anyhow!(
            "Coffer.isAdapterApproved(curve-adapter) returned false: {}",
            body_text.chars().take(200).collect::<String>()
        ));
    }
    info!("pre-flight: Coffer.setAdapter(curve) confirmed");
    Ok(())
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
