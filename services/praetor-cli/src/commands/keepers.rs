//! Praetor keeper ops — list, stake, slash.
//!
//! Audit YYY-4 fix: pre-fix all 3 actions were no-op stubs that logged and
//! returned Ok(()). `praetor keepers slash <keeper> --reason "..."` is the
//! incident-response tool when a keeper misbehaves; running the stub left
//! the keeper operating while the operator believed they'd slashed it.
//! Now: list reads from Scribe via the same pattern as `multisig list`;
//! stake/slash build the cast calldata blob for Safe submission.

use std::process::Command;

use anyhow::{Context, Result};
use tracing::info;

use crate::KeeperAction;

pub async fn run(network: &str, action: KeeperAction) -> Result<()> {
    match action {
        KeeperAction::List => list(network).await,
        KeeperAction::Stake { keeper, amount } => stake(network, &keeper, &amount).await,
        KeeperAction::Slash { keeper, reason } => slash(network, &keeper, &reason).await,
    }
}

async fn list(network: &str) -> Result<()> {
    info!(network, "list keepers");
    // Audit fix (iteration 24): same Scribe-error-swallow bug as
    // multisig::list, both now routed through `crate::scribe::query` so the
    // four failure modes (env-missing, HTTP non-2xx, GraphQL errors, missing
    // data field) all surface uniformly.
    let graphql = r#"{
        keepers(where: { isActive: true }, orderBy: stakeWei, orderDirection: desc) {
            id
            stakeWei
            missedWindows24h
            totalLiquidationsExecuted
            totalRewardsWei
            totalSlashedWei
            lastActionTimestamp
        }
    }"#;
    let keepers = crate::scribe::query(graphql, "keepers").await?;
    let count = keepers.as_array().map(Vec::len).unwrap_or(0);
    println!("Active Vigil keepers: {count} found");
    println!("{}", serde_json::to_string_pretty(&keepers)?);
    Ok(())
}

async fn stake(network: &str, keeper: &str, amount: &str) -> Result<()> {
    info!(network, keeper, amount, "building stake_keeper tx");
    let vigil = load_address(network, "vigil")?;
    let rpc = network_rpc(network)?;

    // Vigil.stake_keeper() is payable — value carries the stake amount.
    let calldata_output = Command::new("cast")
        .args(["calldata", "stake_keeper()"])
        .output()
        .context("cast calldata failed")?;
    if !calldata_output.status.success() {
        anyhow::bail!(
            "cast calldata failed: {}",
            String::from_utf8_lossy(&calldata_output.stderr)
        );
    }
    let calldata = String::from_utf8(calldata_output.stdout)?
        .trim()
        .to_string();

    println!("Submit this as keeper {keeper}:");
    println!("  to:    {vigil}");
    println!("  value: {amount} (wei)");
    println!("  data:  {calldata}");
    println!("  rpc:   {rpc}");
    println!();
    println!("`stake_keeper` is payable + open to any caller — no multisig needed.");
    println!("The keeper account itself signs; this CLI just prints the tx shape.");
    Ok(())
}

async fn slash(network: &str, keeper: &str, reason: &str) -> Result<()> {
    info!(network, keeper, reason, "building slash_keeper tx");
    let vigil = load_address(network, "vigil")?;
    let rpc = network_rpc(network)?;

    // Vigil.slash_keeper(keeper, reason) — onlyPraetor (multisig) per vigil/lib.rs.
    // Per A-8 fix: also requires keeper's missed_windows >= max_misses (on-chain check).
    let calldata_output = Command::new("cast")
        .args(["calldata", "slash_keeper(address,string)", keeper, reason])
        .output()
        .context("cast calldata failed")?;
    if !calldata_output.status.success() {
        anyhow::bail!(
            "cast calldata failed: {}",
            String::from_utf8_lossy(&calldata_output.stderr)
        );
    }
    let calldata = String::from_utf8(calldata_output.stdout)?
        .trim()
        .to_string();

    println!("Submit this to the Gnosis Safe (Praetor multisig):");
    println!("  to:     {vigil}");
    println!("  value:  0");
    println!("  data:   {calldata}");
    println!("  keeper: {keeper}");
    println!("  reason: {reason}");
    println!("  rpc:    {rpc}");
    println!();
    println!("`slash_keeper` is multisig-gated (NOT timelocked — operational call).");
    println!("Vigil also enforces on-chain that the keeper has missed enough windows;");
    println!("if not, the call reverts with NotEnoughMisses(misses). Run `praetor keepers list`");
    println!("first to confirm missedWindows24h >= max_misses_per_window (default 3).");
    println!(
        "(Iter 48 rename: this error was previously named TooManyMisses — inverted semantic.)"
    );
    Ok(())
}

fn load_address(network: &str, contract: &str) -> Result<String> {
    let path = format!("deployments/{network}.json");
    let registry: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&path).with_context(|| format!("registry not found: {path}"))?,
    )?;
    registry["contracts"][contract]["address"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| anyhow::anyhow!("contract {contract} not in {path}"))
}

fn network_rpc(network: &str) -> Result<String> {
    match network {
        "arbitrum_sepolia" => Ok(std::env::var("ARBITRUM_SEPOLIA_RPC_URL")
            .unwrap_or_else(|_| "https://arbitrum-sepolia.publicnode.com".to_string())),
        "ethereum_sepolia" => Ok(std::env::var("ETHEREUM_SEPOLIA_RPC_URL")
            .unwrap_or_else(|_| "https://ethereum-sepolia.publicnode.com".to_string())),
        "local" => Ok("http://127.0.0.1:8545".to_string()),
        _ => anyhow::bail!("unknown network: {network}"),
    }
}
