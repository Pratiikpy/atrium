//! Praetor multisig schedule + execute + list.
//!
//! Builds PraetorTimelock.schedule(target, data) calldata and prints the
//! Gnosis Safe transaction blob. Signing itself happens in the founder Safe
//! UI per `human_left.md` #2 (hardware-wallet sigs).

use std::process::Command;

use anyhow::{Context, Result};
use tracing::info;

use crate::MultisigAction;

pub async fn run(network: &str, action: MultisigAction) -> Result<()> {
    match action {
        MultisigAction::Schedule { target, call } => schedule(network, &target, &call).await,
        MultisigAction::Execute { id } => execute(network, &id).await,
        MultisigAction::List => list(network).await,
    }
}

async fn schedule(network: &str, target: &str, call: &str) -> Result<()> {
    info!(network, target, call, "building schedule tx");
    let timelock = load_address(network, "praetor-timelock")?;
    let rpc = network_rpc(network)?;

    let calldata_output = Command::new("cast")
        .args(["calldata", "schedule(address,bytes)", target, call])
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
    println!("  to:    {timelock}");
    println!("  value: 0");
    println!("  data:  {calldata}");
    println!("  rpc:   {rpc}");
    println!();
    println!(
        "Once 3 of 5 signers approve and execute, the schedule_at timestamp is recorded on-chain."
    );
    println!("Run `praetor multisig list` to see pending schedules.");
    Ok(())
}

async fn execute(network: &str, id: &str) -> Result<()> {
    info!(network, id, "execute pending schedule");
    let timelock = load_address(network, "praetor-timelock")?;
    let rpc = network_rpc(network)?;
    let target = std::env::var("EXEC_TARGET").context("EXEC_TARGET must be set")?;
    let data = std::env::var("EXEC_DATA").context("EXEC_DATA must be set")?;
    let scheduled_at =
        std::env::var("EXEC_SCHEDULED_AT").context("EXEC_SCHEDULED_AT must be set")?;

    let exec_calldata = Command::new("cast")
        .args([
            "calldata",
            "execute(address,bytes,uint64)",
            &target,
            &data,
            &scheduled_at,
        ])
        .output()
        .context("cast calldata failed")?;
    // Audit fix (iteration 23): pre-fix this skipped the exit-status check
    // that schedule() has on line 31-36. A `cast calldata` failure (e.g.
    // malformed EXEC_TARGET, wrong type encoding) returns non-zero with the
    // real error on stderr and empty stdout. Without the check we'd print
    // `data: ` (empty) to the Safe-submission output; the founder would
    // paste empty calldata into the Safe and the execute call would land
    // on-chain as a no-op against PraetorTimelock — a 12-hour wait to
    // discover the timelock didn't fire. Bail loud so the founder fixes
    // the EXEC_* env vars before pasting.
    if !exec_calldata.status.success() {
        anyhow::bail!(
            "cast calldata failed: {}",
            String::from_utf8_lossy(&exec_calldata.stderr)
        );
    }
    let calldata = String::from_utf8(exec_calldata.stdout)?.trim().to_string();
    if calldata.is_empty() {
        anyhow::bail!("cast calldata produced empty output; refusing to ship empty Safe data");
    }

    println!("Submit this to the Gnosis Safe (Praetor multisig):");
    println!("  to:    {timelock}");
    println!("  value: 0");
    println!("  data:  {calldata}");
    println!("  rpc:   {rpc}");
    println!();
    println!("Schedule id: {id}");
    Ok(())
}

async fn list(network: &str) -> Result<()> {
    info!(network, "list pending multisig items");
    // Audit fix (iteration 23): pre-fix this swallowed Scribe errors and
    // printed "Pending Praetor timelock schedules: null" to the operator.
    // Iteration 24 extracted the HTTP-status + GraphQL-errors + missing-data
    // checks into `crate::scribe::query` so the same fix applies uniformly
    // across every Scribe-querying command.
    let graphql = r#"{
        timelockSchedules(where: { executedAt: null, cancelledAt: null }, orderBy: scheduledAt, orderDirection: desc) {
            id
            target
            data
            scheduledAt
        }
    }"#;
    let schedules = crate::scribe::query(graphql, "timelockSchedules").await?;
    let count = schedules.as_array().map(Vec::len).unwrap_or(0);
    println!("Pending Praetor timelock schedules: {count} found");
    println!("{}", serde_json::to_string_pretty(&schedules)?);
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
