//! Praetor emergency pause + resume.
//!
//! Per security.md §"Authentication and authorization": emergency pause is
//! multisig-only with NO timelock — pause-only (cannot upgrade). Resume is
//! also multisig-only (or, on subsystems that expose it, multisig-direct via
//! the subsystem's own `resume()`).
//!
//! Audit YYY-3 fix: pre-fix `run` and `resume` were no-op stubs that logged
//! "emergency pause" and returned Ok(()) without doing anything. A founder
//! running `praetor pause coffer` during an incident would think the
//! contract was paused — but the contract kept running. Real exploit damage
//! would continue while the incident-response dashboard showed "paused".
//! Now: same multisig-tx-blob pattern as `multisig.rs` — the CLI builds
//! the `cast calldata` blob and prints the Safe-submission payload. Real
//! signing happens in the founder Safe UI per `human_left.md` #2.

use std::process::Command;

use anyhow::{Context, Result};
use tracing::info;

pub async fn run(network: &str, contract: &str, reason: &str) -> Result<()> {
    info!(network, contract, reason, "building emergency-pause tx");
    let timelock = load_address(network, "praetor-timelock")?;
    let target = load_address(network, contract)?;
    let rpc = network_rpc(network)?;

    // PraetorTimelock.emergencyPause(target, reason) — multisig-only, no
    // timelock per security.md.
    let calldata_output = Command::new("cast")
        .args([
            "calldata",
            "emergencyPause(address,string)",
            &target,
            reason,
        ])
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
    println!("  to:     {timelock}");
    println!("  value:  0");
    println!("  data:   {calldata}");
    println!("  target: {target} ({contract})");
    println!("  reason: {reason}");
    println!("  rpc:    {rpc}");
    println!();
    println!("Emergency pause is multisig-only with NO timelock (per security.md).");
    println!("Once 3 of 5 signers approve, the contract pauses instantly.");
    println!();
    println!("Verify after execution: `cast call {target} 'is_paused()(bool)' --rpc-url {rpc}`");
    Ok(())
}

pub async fn resume(network: &str, contract: &str, action: Option<&str>) -> Result<()> {
    info!(network, contract, ?action, "building resume tx");
    let target = load_address(network, contract)?;
    let rpc = network_rpc(network)?;

    // Resume-selector dispatch. Pre-fix this hardcoded `resume()` for every
    // contract; a Safe submission against Coffer with `resume()` calldata
    // would land but revert on execution because Coffer exposes
    // `resume_deposits()` and `resume_withdrawals()` — no plain `resume()`.
    // Wrong-calldata Safe txs waste signer attention and burn submission
    // time in incidents. Now: route per-contract.
    //
    // Source of truth: grep `pub fn resume` / `function resume(` in
    // contracts/. As of 2026-05 the only split-path contract is Coffer.
    let selector = match contract {
        "coffer" => match action {
            Some("deposits") => "resume_deposits()",
            Some("withdrawals") => "resume_withdrawals()",
            Some(other) => anyhow::bail!(
                "unknown action '{other}' for coffer; use --action deposits or --action withdrawals"
            ),
            None => anyhow::bail!(
                "coffer requires --action deposits or --action withdrawals; \
                 there is no plain `resume()` selector on Coffer (it has split pause paths)"
            ),
        },
        _ => {
            if action.is_some() {
                anyhow::bail!(
                    "--action is only valid for split-path contracts (coffer); \
                     {contract} exposes `resume()` directly"
                );
            }
            "resume()"
        }
    };

    let calldata_output = Command::new("cast")
        .args(["calldata", selector])
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
    println!("  to:       {target} ({contract})");
    println!("  value:    0");
    println!("  data:     {calldata}");
    println!("  selector: {selector}");
    println!("  rpc:      {rpc}");
    println!();
    println!("Resume is a direct multisig call on the subsystem (no timelock).");
    println!("Verify after execution: depends on the contract; for Coffer, check");
    println!("`is_deposits_paused()(bool)` / `is_withdrawals_paused()(bool)`.");
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
