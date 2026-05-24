use std::process::Command;

use anyhow::{Context, Result};
use tracing::info;

pub async fn run(network: &str, contract: &str) -> Result<()> {
    info!(network, contract, "verify on explorer");
    let api_key = std::env::var("ARBISCAN_API_KEY").context("ARBISCAN_API_KEY must be set")?;
    let registry_path = format!("deployments/{network}.json");
    let registry: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&registry_path)
            .with_context(|| format!("registry not found: {registry_path}"))?,
    )?;
    let address = registry["contracts"][contract]["address"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("contract {contract} not in registry"))?;

    let chain_id = match network {
        "arbitrum_sepolia" => "421614",
        "ethereum_sepolia" => "11155111",
        "polygon_amoy" => "80002",
        _ => anyhow::bail!("unknown network for explorer verification: {network}"),
    };

    let status = Command::new("forge")
        .args([
            "verify-contract",
            "--chain-id",
            chain_id,
            address,
            contract,
            "--etherscan-api-key",
            &api_key,
            "--watch",
        ])
        .status()
        .context("forge verify-contract failed to invoke")?;
    if !status.success() {
        anyhow::bail!("forge verify-contract returned non-zero");
    }
    info!(contract, address, "verified");
    Ok(())
}
