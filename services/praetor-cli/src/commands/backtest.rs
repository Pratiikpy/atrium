//! Praetor backtest publication.
//!
//! Audit YYY-5 fix: pre-fix `publish` was a no-op stub. `praetor backtest
//! publish` claimed to publish an attestation on-chain but did nothing.
//! `ResearchAttestation.publish` is timelock-gated, so the right shape is
//! a `multisig schedule` + 48h wait + `multisig execute`, print both
//! halves so the operator runs them in order.

use std::process::Command;

use anyhow::{Context, Result};
use tracing::info;

use crate::BacktestAction;

pub async fn run(network: &str, action: BacktestAction) -> Result<()> {
    match action {
        BacktestAction::Publish {
            notebook,
            ipfs_cid,
            json_path,
        } => publish(network, &notebook, &ipfs_cid, json_path.as_deref()).await,
    }
}

/// Honor the `is_publishable` flag from span_backtest.py's v2 JSON output.
/// If json_path is provided, parse + check. Synthetic results (data_mode
/// = synthetic-pairs, is_publishable = false) must NOT reach the on-chain
/// ResearchAttestation, see span_backtest.py docstring + the iteration-28
/// audit fix that introduced the flag.
fn check_publishable(json_path: &str) -> Result<()> {
    let text = std::fs::read_to_string(json_path)
        .with_context(|| format!("could not read backtest JSON: {json_path}"))?;
    let parsed: serde_json::Value = serde_json::from_str(&text)
        .with_context(|| format!("backtest JSON is not valid JSON: {json_path}"))?;
    // schema_version 2+ carries is_publishable. v1 omits it, treat that as
    // pre-fix output that operators must NOT publish (the v1 era is when
    // synthetic-pairs were silently published).
    let schema_version = parsed
        .get("schema_version")
        .and_then(|v| v.as_u64())
        .unwrap_or(1);
    if schema_version < 2 {
        anyhow::bail!(
            "backtest JSON {} is schema v{} (pre-honesty-pass). Regenerate \
             with span_backtest.py --data-mode real-trades and re-pin to IPFS \
             before publishing.",
            json_path,
            schema_version
        );
    }
    let is_publishable = parsed.get("is_publishable").and_then(|v| v.as_bool());
    let data_mode = parsed
        .get("data_mode")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    match is_publishable {
        Some(true) => Ok(()),
        Some(false) => anyhow::bail!(
            "backtest JSON {} has is_publishable=false (data_mode={}). \
             Synthetic results must not reach on-chain ResearchAttestation. \
             Use --data-mode real-trades to generate publishable output.",
            json_path,
            data_mode
        ),
        None => anyhow::bail!(
            "backtest JSON {} is missing is_publishable field (data_mode={}). \
             Probably a hand-edited or partially-written file; refusing to publish.",
            json_path,
            data_mode
        ),
    }
}

async fn publish(
    network: &str,
    notebook: &str,
    ipfs_cid: &str,
    json_path: Option<&str>,
) -> Result<()> {
    info!(
        network,
        notebook, ipfs_cid, json_path, "building research-attestation publish tx"
    );

    // Iteration 29 audit fix: honor the is_publishable flag from
    // span_backtest.py's v2 JSON output. Without this gate, the CLI would
    // happily build a Safe payload for synthetic-pairs backtests, the
    // operator would paste it into the multisig and synthetic numbers
    // would land on-chain as a real research attestation.
    match json_path {
        Some(path) => check_publishable(path)?,
        None => {
            // Allow override but make it loud. The verify-app side gate
            // (Wave-1) will be the second layer; for the CLI an operator
            // can choose to bypass, but they have to make the choice
            // consciously, not by default.
            eprintln!(
                "WARN: --json-path not provided. The is_publishable gate from \
                 span_backtest.py's v2 JSON is the recommended honesty check. \
                 Re-run with --json-path <path> to enforce, OR confirm you've \
                 manually verified the backtest is real (not synthetic-pairs)."
            );
        }
    }

    let attestation = load_address(network, "research-attestation")?;
    let timelock = load_address(network, "praetor-timelock")?;
    let rpc = network_rpc(network)?;

    // The operator must parse the notebook + ship the trades_count +
    // collateral_delta_bps separately. Year-1: read them from env so the
    // CLI doesn't have to embed a notebook parser.
    let trades_count = std::env::var("TRADES_COUNT").context("TRADES_COUNT must be set")?;
    let delta_bps =
        std::env::var("COLLATERAL_DELTA_BPS").context("COLLATERAL_DELTA_BPS must be set")?;

    // ResearchAttestation.publish(bytes32 ipfs_hash, uint256 trades_count,
    // int256 collateral_delta_bps, string notebook_url), timelock-only.
    let publish_calldata = Command::new("cast")
        .args([
            "calldata",
            "publish(bytes32,uint256,int256,string)",
            ipfs_cid,
            &trades_count,
            &delta_bps,
            notebook,
        ])
        .output()
        .context("cast calldata failed")?;
    if !publish_calldata.status.success() {
        anyhow::bail!(
            "cast calldata failed: {}",
            String::from_utf8_lossy(&publish_calldata.stderr)
        );
    }
    let publish_data = String::from_utf8(publish_calldata.stdout)?
        .trim()
        .to_string();

    // Wrap in PraetorTimelock.schedule(target, data).
    let schedule_calldata = Command::new("cast")
        .args([
            "calldata",
            "schedule(address,bytes)",
            &attestation,
            &publish_data,
        ])
        .output()
        .context("cast calldata failed")?;
    // Audit fix (iteration 25): symmetric to the inner check on line 47-52
    // and the multisig::execute fix from iteration 23. A malformed
    // publish_data (truncated hex, missing 0x prefix from upstream) would
    // make `cast calldata` exit non-zero with the real error on stderr and
    // empty stdout, operator would paste empty schedule_data into the
    // Safe and discover the no-op 48h later.
    if !schedule_calldata.status.success() {
        anyhow::bail!(
            "cast calldata (schedule wrap) failed: {}",
            String::from_utf8_lossy(&schedule_calldata.stderr)
        );
    }
    let schedule_data = String::from_utf8(schedule_calldata.stdout)?
        .trim()
        .to_string();
    if schedule_data.is_empty() {
        anyhow::bail!(
            "cast calldata (schedule wrap) produced empty output; refusing to ship empty Safe data"
        );
    }

    println!("Step 1, submit to the Gnosis Safe (Praetor multisig) NOW:");
    println!("  to:    {timelock}");
    println!("  value: 0");
    println!("  data:  {schedule_data}");
    println!();
    println!("Step 2, wait 48 hours (PraetorTimelock window).");
    println!();
    println!("Step 3, after 48h, run `praetor multisig execute --id <id>` with these env vars:");
    println!("  EXEC_TARGET={attestation}");
    println!("  EXEC_DATA={publish_data}");
    println!("  EXEC_SCHEDULED_AT=<schedule timestamp>");
    println!();
    println!("Target:   {attestation} (ResearchAttestation)");
    println!("Notebook: {notebook}");
    println!("IPFS CID: {ipfs_cid}");
    println!("Trades:   {trades_count}");
    println!("ΔBps:     {delta_bps}");
    println!("RPC:      {rpc}");
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

#[cfg(test)]
mod tests {
    //! Honesty-gate tests for `check_publishable`.
    //!
    //! Mirror of `apps/verify/src/app/api/research-attestation/latest/route.test.ts`
    //! at the praetor-cli boundary, the same five scenarios pin the same
    //! invariant in Rust. Together they form the cross-language test of
    //! `is_publishable: false MUST bail at every layer that could publish`.
    use super::check_publishable;
    use std::sync::atomic::{AtomicU64, Ordering};

    // Unique-per-test temp path so parallel tests don't clobber each other.
    // pid + monotonic counter is collision-free across the suite and across
    // parallel cargo-test runs on the same host.
    static SEQ: AtomicU64 = AtomicU64::new(0);
    fn unique_path(label: &str) -> std::path::PathBuf {
        let n = SEQ.fetch_add(1, Ordering::SeqCst);
        let pid = std::process::id();
        std::env::temp_dir().join(format!("atrium-backtest-test-{pid}-{n}-{label}.json"))
    }

    fn write_fixture(label: &str, body: &str) -> std::path::PathBuf {
        let path = unique_path(label);
        std::fs::write(&path, body).expect("failed to write test fixture");
        path
    }

    #[test]
    fn passes_on_real_trades_publishable() {
        let path = write_fixture(
            "real_publishable",
            r#"{
                "schema_version": 2,
                "data_mode": "real-trades",
                "is_publishable": true,
                "trades_count": 25000
            }"#,
        );
        let result = check_publishable(path.to_str().unwrap());
        assert!(
            result.is_ok(),
            "expected Ok for real-trades publishable, got {result:?}"
        );
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn bails_on_synthetic_pairs() {
        let path = write_fixture(
            "synthetic",
            r#"{
                "schema_version": 2,
                "data_mode": "synthetic-pairs",
                "is_publishable": false,
                "trades_count": 500
            }"#,
        );
        let result = check_publishable(path.to_str().unwrap());
        let err = result
            .expect_err("expected Err for synthetic-pairs")
            .to_string();
        assert!(
            err.contains("is_publishable=false"),
            "err missing flag mention: {err}"
        );
        assert!(
            err.contains("synthetic-pairs"),
            "err missing data_mode: {err}"
        );
        assert!(
            err.contains("real-trades"),
            "err should name the unblock action: {err}"
        );
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn bails_on_schema_v1_pre_honesty_pass() {
        // Pre-iteration-28 output. Missing schema_version (defaults to 1)
        // and is_publishable, must NOT be publishable since the v1 era
        // is when synthetic-pairs were silently published.
        let path = write_fixture(
            "schema_v1",
            r#"{
                "trades_count": 1000,
                "average_saving_bps": 4700
            }"#,
        );
        let result = check_publishable(path.to_str().unwrap());
        let err = result.expect_err("expected Err for schema v1").to_string();
        assert!(
            err.contains("schema v1"),
            "err missing schema version: {err}"
        );
        assert!(
            err.contains("pre-honesty-pass"),
            "err should name the era: {err}"
        );
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn bails_on_missing_is_publishable_field() {
        // v2 schema but the flag itself is missing, partially-written or
        // hand-edited file. Refuse rather than infer permissive.
        let path = write_fixture(
            "missing_flag",
            r#"{
                "schema_version": 2,
                "data_mode": "real-trades",
                "trades_count": 1000
            }"#,
        );
        let result = check_publishable(path.to_str().unwrap());
        let err = result
            .expect_err("expected Err for missing flag")
            .to_string();
        assert!(
            err.contains("missing is_publishable"),
            "err should name the missing field: {err}"
        );
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn bails_on_unreadable_json() {
        // Non-existent path. Refuse loudly (the caller is publishing a
        // financial attestation; "file not found" is not an OK state).
        let result = check_publishable("/nonexistent/path/atrium-backtest-9999.json");
        let err = result
            .expect_err("expected Err for missing file")
            .to_string();
        assert!(
            err.contains("could not read"),
            "err should name the file-read failure: {err}"
        );
    }

    #[test]
    fn bails_on_malformed_json() {
        let path = write_fixture("malformed", "not actually json {{{");
        let result = check_publishable(path.to_str().unwrap());
        let err = result
            .expect_err("expected Err for malformed JSON")
            .to_string();
        assert!(
            err.contains("not valid JSON"),
            "err should name the parse failure: {err}"
        );
        let _ = std::fs::remove_file(&path);
    }

    // ── Iter 75: network_rpc tests ──────────────────────────────────────
    //
    // network_rpc is duplicated across 5 command modules (DRY violation;
    // see iter-75 observation that deploy.rs's copy carries an extra
    // polygon_amoy case the others lack). The backtest.rs copy supports
    // arbitrum_sepolia / ethereum_sepolia / local. Tests pin those
    // exactly so a future refactor that "cleans up" the match arms
    // can't quietly drop a network without CI noticing.

    use super::network_rpc;

    #[test]
    fn network_rpc_returns_local_url_for_local() {
        let url = network_rpc("local").expect("local always resolves");
        assert_eq!(url, "http://127.0.0.1:8545");
    }

    #[test]
    fn network_rpc_returns_arbitrum_sepolia_default_when_env_unset() {
        // SAFETY: this test mutates a process-level env var. Other backtest
        // tests don't read ARBITRUM_SEPOLIA_RPC_URL so we don't race them.
        // We restore the previous value to be a good citizen.
        let prev = std::env::var("ARBITRUM_SEPOLIA_RPC_URL").ok();
        std::env::remove_var("ARBITRUM_SEPOLIA_RPC_URL");
        let url = network_rpc("arbitrum_sepolia").expect("arbitrum_sepolia default");
        assert_eq!(url, "https://arbitrum-sepolia.publicnode.com");
        if let Some(v) = prev {
            std::env::set_var("ARBITRUM_SEPOLIA_RPC_URL", v);
        }
    }

    #[test]
    fn network_rpc_returns_ethereum_sepolia_default_when_env_unset() {
        let prev = std::env::var("ETHEREUM_SEPOLIA_RPC_URL").ok();
        std::env::remove_var("ETHEREUM_SEPOLIA_RPC_URL");
        let url = network_rpc("ethereum_sepolia").expect("ethereum_sepolia default");
        assert_eq!(url, "https://ethereum-sepolia.publicnode.com");
        if let Some(v) = prev {
            std::env::set_var("ETHEREUM_SEPOLIA_RPC_URL", v);
        }
    }

    #[test]
    fn network_rpc_respects_env_override() {
        std::env::set_var(
            "ARBITRUM_SEPOLIA_RPC_URL",
            "https://my-private-rpc.example.com",
        );
        let url = network_rpc("arbitrum_sepolia").expect("arbitrum_sepolia env override");
        assert_eq!(url, "https://my-private-rpc.example.com");
        std::env::remove_var("ARBITRUM_SEPOLIA_RPC_URL");
    }

    #[test]
    fn network_rpc_bails_on_unknown_network() {
        let err = network_rpc("mainnet").expect_err("mainnet not supported on praetor-cli");
        assert!(
            err.to_string().contains("unknown network"),
            "err should name the unknown-network failure: {err}"
        );
    }

    #[test]
    fn network_rpc_bails_on_empty_network() {
        let err = network_rpc("").expect_err("empty network bails");
        assert!(err.to_string().contains("unknown network"));
    }

    // ── Iter 75: load_address tests ─────────────────────────────────────
    //
    // load_address reads `deployments/<network>.json` and extracts
    // contracts[name].address. Tests pin the path shape + the error
    // shape when the file or field is missing.

    use super::load_address;
    use std::io::Write as _;

    fn write_deployments_fixture(network: &str, body: &str) -> std::path::PathBuf {
        // load_address reads `deployments/<network>.json` relative to CWD.
        // Use a unique network name per test to avoid stomping real files.
        let dir = std::env::current_dir().expect("cwd").join("deployments");
        std::fs::create_dir_all(&dir).expect("mkdir deployments");
        let path = dir.join(format!("{network}.json"));
        let mut f = std::fs::File::create(&path).expect("create fixture");
        f.write_all(body.as_bytes()).expect("write fixture");
        path
    }

    #[test]
    fn load_address_returns_contract_address_for_valid_registry() {
        let net = format!("test_iter75_load_addr_{}", std::process::id());
        let path = write_deployments_fixture(
            &net,
            r#"{ "contracts": { "coffer": { "address": "0xCAFEBABE" } } }"#,
        );
        let addr = load_address(&net, "coffer").expect("address resolves");
        assert_eq!(addr, "0xCAFEBABE");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn load_address_bails_on_missing_registry_file() {
        let result = load_address("nonexistent_network_iter75", "coffer");
        let err = result.expect_err("missing file bails").to_string();
        assert!(
            err.contains("registry not found"),
            "err should name the missing-registry failure: {err}"
        );
    }

    #[test]
    fn load_address_bails_when_contract_absent_from_registry() {
        let net = format!("test_iter75_missing_contract_{}", std::process::id());
        let path = write_deployments_fixture(
            &net,
            r#"{ "contracts": { "plinth": { "address": "0xPL" } } }"#,
        );
        let result = load_address(&net, "coffer");
        let err = result.expect_err("absent contract bails").to_string();
        assert!(
            err.contains("coffer not in"),
            "err should name the missing-contract failure: {err}"
        );
        let _ = std::fs::remove_file(&path);
    }
}
