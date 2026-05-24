//! Real deploy command — invokes forge create + cargo-stylus deploy, records
//! addresses in `deployments/{network}.json`. Audit C-16 fix: no more stub.

use std::path::PathBuf;
use std::process::Command;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

/// Wave-by-wave deploy per TDD §15.2.
const WAVE_1: &[(&str, &str)] = &[
    ("praetor-timelock", "contracts/praetor-timelock/src/PraetorTimelock.sol:PraetorTimelock"),
    ("coffer", "stylus:contracts/coffer"),
    ("portico-registry", "contracts/portico-registry/src/PorticoRegistry.sol:PorticoRegistry"),
    ("sigil", "stylus:contracts/sigil"),
    ("edict", "contracts/edict/src/Edict.sol:Edict"),
];

const WAVE_2: &[(&str, &str)] = &[
    ("plinth", "stylus:contracts/plinth"),
    ("vigil", "stylus:contracts/vigil"),
    ("postern-key-registry", "contracts/postern-kill-switch/src/PosternKeyRegistry.sol:PosternKeyRegistry"),
    ("postern-kill-switch", "contracts/postern-kill-switch/src/PosternKillSwitch.sol:PosternKillSwitch"),
    ("research-attestation", "contracts/research-attestation/src/ResearchAttestation.sol:ResearchAttestation"),
    ("lantern-attestor", "contracts/lantern-attestor/src/LanternAttestor.sol:LanternAttestor"),
    ("rostrum", "contracts/rostrum/src/Rostrum.sol:Rostrum"),
];

const WAVE_3: &[(&str, &str)] = &[
    ("aqueduct", "contracts/aqueduct/src/Aqueduct.sol:Aqueduct"),
    ("aqueduct-receiver", "contracts/aqueduct/src/AqueductReceiver.sol:AqueductReceiver"),
    ("aqueduct-claimback", "contracts/aqueduct/src/AqueductClaimback.sol:AqueductClaimback"),
    ("adapter-aave-horizon", "contracts/adapters/aave-horizon/src/AaveHorizonAdapterV11.sol:AaveHorizonAdapterV11"),
    ("adapter-hyperliquid", "contracts/adapters/hyperliquid/src/HyperliquidHybridAdapter.sol:HyperliquidHybridAdapter"),
    ("adapter-pendle", "contracts/adapters/pendle/src/PendleV2Adapter.sol:PendleV2Adapter"),
    ("adapter-trade-xyz", "contracts/adapters/trade-xyz/src/TradeXyzAdapter.sol:TradeXyzAdapter"),
    ("adapter-curve", "contracts/adapters/curve/src/CurveAdapter.sol:CurveAdapter"),
    ("adapter-polymarket", "contracts/adapters/polymarket/src/PolymarketAdapter.sol:PolymarketAdapter"),
];

/// Wave 4 — orchestration (audit EEEE-1 + Fire 74). Must run AFTER all 6
/// adapters + Plinth + Coffer + PorticoRegistry. AtriumRouter's constructor
/// takes those four addresses as args. Post-deploy, the Praetor multisig
/// still has to call `coffer.set_adapter(router, approved=true)` plus
/// `adapter.setAuthorizedCaller(router, true)` on every adapter to wire the
/// orchestrator path. The verify command checks this wiring.
const WAVE_4: &[(&str, &str)] = &[
    ("atrium-router", "contracts/atrium-router/src/AtriumRouter.sol:AtriumRouter"),
];

/// Wave 5 — Phase-2 conditional contracts. Ship only when the gating grant
/// lands (Trailblazer AI for Stoa, Stylus Sprint for the Phase-2 adapters)
/// AND PorticoRegistry's curator multisig has formally approved each
/// adapter's bytecode hash. Per PRD §17, default `deploy --all` skips this
/// wave; the user opts in with `--phase2`.
const WAVE_5_PHASE2: &[(&str, &str)] = &[
    ("adapter-gmx", "contracts/adapters/gmx/src/GmxV2Adapter.sol:GmxV2Adapter"),
    ("adapter-synthetix", "contracts/adapters/synthetix/src/SynthetixV3Adapter.sol:SynthetixV3Adapter"),
    ("adapter-morpho", "contracts/adapters/morpho/src/MorphoBlueAdapter.sol:MorphoBlueAdapter"),
    ("stoa-black-scholes", "contracts/stoa/src/StoaBlackScholes.sol:StoaBlackScholes"),
];

#[derive(Serialize, Deserialize, Default)]
struct DeploymentRegistry {
    network: String,
    contracts: std::collections::BTreeMap<String, ContractRecord>,
}

#[derive(Serialize, Deserialize)]
struct ContractRecord {
    address: String,
    deployed_at: i64,
}

pub async fn run(network: &str, all: bool, contract: Option<String>, phase2: bool) -> Result<()> {
    info!(network, all, phase2, ?contract, "deploy starting");

    let mut registry = load_registry(network)?;

    if all {
        deploy_set(WAVE_1, network, &mut registry)?;
        deploy_set(WAVE_2, network, &mut registry)?;
        deploy_set(WAVE_3, network, &mut registry)?;
        deploy_set(WAVE_4, network, &mut registry)?;
        if phase2 {
            warn!("--phase2 set: deploying Wave 5 scaffolds. Curator multisig must whitelist each before PorticoRegistry.registerAdapter calls.");
            deploy_set(WAVE_5_PHASE2, network, &mut registry)?;
        }
    } else if let Some(name) = contract {
        let target = WAVE_1
            .iter()
            .chain(WAVE_2.iter())
            .chain(WAVE_3.iter())
            .chain(WAVE_4.iter())
            .chain(WAVE_5_PHASE2.iter())
            .find(|(n, _)| *n == name);
        if let Some((n, path)) = target {
            deploy_one(n, path, network, &mut registry)?;
        } else {
            anyhow::bail!("unknown contract: {name}");
        }
    } else {
        anyhow::bail!("specify --all or --contract NAME");
    }

    save_registry(&registry)?;
    info!("deploy complete; registry written");
    Ok(())
}

fn deploy_set(set: &[(&str, &str)], network: &str, registry: &mut DeploymentRegistry) -> Result<()> {
    for (name, path) in set {
        deploy_one(name, path, network, registry)?;
    }
    Ok(())
}

fn deploy_one(
    name: &str,
    path: &str,
    network: &str,
    registry: &mut DeploymentRegistry,
) -> Result<()> {
    if registry.contracts.contains_key(name) {
        info!(name, "already deployed, skipping");
        return Ok(());
    }
    let address = if let Some(stylus_dir) = path.strip_prefix("stylus:") {
        cargo_stylus_deploy(name, stylus_dir, network)?
    } else if path.contains(".sol") {
        forge_create(name, path, network)?
    } else {
        warn!(name, "unknown deploy target type — skipping");
        return Ok(());
    };

    registry.contracts.insert(
        name.to_string(),
        ContractRecord {
            address: address.clone(),
            deployed_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0),
        },
    );
    info!(name, address, "deployed");
    Ok(())
}

fn forge_create(name: &str, path: &str, network: &str) -> Result<String> {
    let rpc = network_rpc(network)?;
    // Audit I-5 partial-mitigation: prefer keystore path over raw key in argv.
    // If DEPLOYER_KEYSTORE is set, use that + DEPLOYER_KEYSTORE_PASSWORD env.
    // Fallback to DEPLOYER_PRIVATE_KEY in argv is acceptable for Year-1
    // testnet (test wallets, no real funds) — see `human_left.md` #12. For
    // mainnet, the keystore path is mandatory.
    let mut cmd = Command::new("forge");
    cmd.args(["create", path, "--rpc-url", &rpc, "--broadcast"]);
    if let Ok(keystore) = std::env::var("DEPLOYER_KEYSTORE") {
        let password = std::env::var("DEPLOYER_KEYSTORE_PASSWORD").context(
            "DEPLOYER_KEYSTORE set but DEPLOYER_KEYSTORE_PASSWORD missing",
        )?;
        cmd.args(["--keystore", &keystore, "--password", &password]);
    } else {
        let key = std::env::var("DEPLOYER_PRIVATE_KEY").context(
            "Set DEPLOYER_KEYSTORE+DEPLOYER_KEYSTORE_PASSWORD (preferred) or DEPLOYER_PRIVATE_KEY",
        )?;
        cmd.args(["--private-key", &key]);
    }
    let output = cmd.output().context("forge create failed to invoke")?;
    if !output.status.success() {
        anyhow::bail!(
            "forge create {name} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let addr = stdout
        .lines()
        .find_map(|l| l.strip_prefix("Deployed to: "))
        .map(str::trim)
        .ok_or_else(|| anyhow::anyhow!("could not parse deployed address from forge output"))?;
    Ok(addr.to_string())
}

fn cargo_stylus_deploy(name: &str, dir: &str, network: &str) -> Result<String> {
    let rpc = network_rpc(network)?;
    // Audit I-5 partial-mitigation: prefer key-path (cargo-stylus reads the
    // hex key from a file path with --private-key-path FLAG, no argv exposure).
    let dir_path = PathBuf::from(dir);
    let mut cmd = Command::new("cargo");
    cmd.args(["stylus", "deploy", "--endpoint", &rpc, "--no-verify"]);
    if let Ok(key_path) = std::env::var("DEPLOYER_PRIVATE_KEY_PATH") {
        cmd.args(["--private-key-path", &key_path]);
    } else {
        let key = std::env::var("DEPLOYER_PRIVATE_KEY").context(
            "Set DEPLOYER_PRIVATE_KEY_PATH (preferred) or DEPLOYER_PRIVATE_KEY",
        )?;
        cmd.args(["--private-key", &key]);
    }
    let output = cmd
        .current_dir(&dir_path)
        .output()
        .context("cargo stylus deploy failed to invoke")?;
    if !output.status.success() {
        anyhow::bail!(
            "cargo stylus deploy {name} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let addr = stdout
        .lines()
        .find_map(|l| {
            let t = l.trim();
            if t.contains("deployed code at address") || t.contains("Contract deployed at") {
                t.split_whitespace().last().map(str::to_string)
            } else {
                None
            }
        })
        .ok_or_else(|| anyhow::anyhow!("could not parse stylus deploy address"))?;
    Ok(addr)
}

fn network_rpc(network: &str) -> Result<String> {
    match network {
        "arbitrum_sepolia" => Ok(std::env::var("ARBITRUM_SEPOLIA_RPC_URL")
            .unwrap_or_else(|_| "https://arbitrum-sepolia.publicnode.com".to_string())),
        "ethereum_sepolia" => Ok(std::env::var("ETHEREUM_SEPOLIA_RPC_URL")
            .unwrap_or_else(|_| "https://ethereum-sepolia.publicnode.com".to_string())),
        "polygon_amoy" => Ok(std::env::var("POLYGON_AMOY_RPC_URL")
            .unwrap_or_else(|_| "https://polygon-amoy.publicnode.com".to_string())),
        "local" => Ok("http://127.0.0.1:8545".to_string()),
        _ => anyhow::bail!("unknown network: {network}"),
    }
}

fn registry_path(network: &str) -> PathBuf {
    PathBuf::from(format!("deployments/{network}.json"))
}

fn load_registry(network: &str) -> Result<DeploymentRegistry> {
    let path = registry_path(network);
    if path.exists() {
        let text = std::fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&text)?)
    } else {
        Ok(DeploymentRegistry {
            network: network.to_string(),
            contracts: Default::default(),
        })
    }
}

fn save_registry(reg: &DeploymentRegistry) -> Result<()> {
    // Audit I-10 fix: atomic write so a crash between truncate-and-write
    // never leaves a partial deployments/{network}.json. The next deploy
    // would otherwise fail to parse and require manual reconstruction.
    let path = registry_path(&reg.network);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp_path = path.with_extension("json.tmp");
    {
        use std::io::Write as _;
        let mut f = std::fs::File::create(&tmp_path)?;
        f.write_all(serde_json::to_string_pretty(reg)?.as_bytes())?;
        f.sync_all()?;
    }
    std::fs::rename(&tmp_path, &path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    //! Iter 75 audit fix: pin deploy.rs's divergent network_rpc copy.
    //!
    //! All 5 praetor-cli command modules carry a copy of `network_rpc`.
    //! Four (backtest, keepers, multisig, pause) are identical. The
    //! deploy.rs copy is the SOLE owner of the `polygon_amoy` arm
    //! because Polymarket deposits originate from the Polygon side via
    //! CCIP. A future contributor "DRY-ing up" by extracting a shared
    //! helper that uses only the 4-network shape would silently break
    //! the deploy flow's ability to find the Polygon Amoy RPC.
    //!
    //! Also pins I-10 atomic-write on save_registry: the path.tmp is
    //! never left behind after a successful write.
    use super::{load_registry, network_rpc, save_registry, registry_path, DeploymentRegistry, ContractRecord};
    use std::sync::atomic::{AtomicU64, Ordering};

    static SEQ: AtomicU64 = AtomicU64::new(0);
    fn unique_network(label: &str) -> String {
        let n = SEQ.fetch_add(1, Ordering::SeqCst);
        let pid = std::process::id();
        format!("test_iter75_deploy_{label}_{pid}_{n}")
    }

    #[test]
    fn network_rpc_supports_polygon_amoy_unique_to_deploy() {
        // The load-bearing invariant: deploy.rs has polygon_amoy. The
        // other 4 copies DO NOT — see iter-75 grep. If this fails, a
        // refactor accidentally dropped Polymarket's deploy-side RPC.
        let prev = std::env::var("POLYGON_AMOY_RPC_URL").ok();
        std::env::remove_var("POLYGON_AMOY_RPC_URL");
        let url = network_rpc("polygon_amoy").expect("polygon_amoy must resolve in deploy");
        assert_eq!(url, "https://polygon-amoy.publicnode.com");
        if let Some(v) = prev {
            std::env::set_var("POLYGON_AMOY_RPC_URL", v);
        }
    }

    #[test]
    fn network_rpc_polygon_amoy_respects_env_override() {
        std::env::set_var("POLYGON_AMOY_RPC_URL", "https://my-amoy-rpc.example.com");
        let url = network_rpc("polygon_amoy").expect("env override");
        assert_eq!(url, "https://my-amoy-rpc.example.com");
        std::env::remove_var("POLYGON_AMOY_RPC_URL");
    }

    #[test]
    fn network_rpc_local_arb_eth_supported() {
        // Spot-check the four shared arms behave consistently with the
        // other modules' copies. If this drifts here, deploy diverges
        // from the rest of the CLI.
        let prev_a = std::env::var("ARBITRUM_SEPOLIA_RPC_URL").ok();
        let prev_e = std::env::var("ETHEREUM_SEPOLIA_RPC_URL").ok();
        std::env::remove_var("ARBITRUM_SEPOLIA_RPC_URL");
        std::env::remove_var("ETHEREUM_SEPOLIA_RPC_URL");
        assert_eq!(network_rpc("local").unwrap(), "http://127.0.0.1:8545");
        assert_eq!(network_rpc("arbitrum_sepolia").unwrap(), "https://arbitrum-sepolia.publicnode.com");
        assert_eq!(network_rpc("ethereum_sepolia").unwrap(), "https://ethereum-sepolia.publicnode.com");
        if let Some(v) = prev_a { std::env::set_var("ARBITRUM_SEPOLIA_RPC_URL", v); }
        if let Some(v) = prev_e { std::env::set_var("ETHEREUM_SEPOLIA_RPC_URL", v); }
    }

    #[test]
    fn network_rpc_bails_on_unknown() {
        let err = network_rpc("solana_devnet").expect_err("unknown network bails");
        assert!(err.to_string().contains("unknown network"));
    }

    // ── I-10: atomic save_registry ──────────────────────────────────

    #[test]
    fn save_registry_writes_and_load_registry_round_trips() {
        let net = unique_network("roundtrip");
        let mut reg = DeploymentRegistry {
            network: net.clone(),
            contracts: Default::default(),
        };
        save_registry(&reg).expect("save");
        let loaded = load_registry(&net).expect("load");
        assert_eq!(loaded.network, net);
        // Modify and re-save — the atomic-rename approach must not leave
        // stale state from the first write.
        reg.contracts.insert(
            "coffer".to_string(),
            ContractRecord {
                address: "0xCAFE".to_string(),
                deployed_at: 1_700_000_000,
            },
        );
        save_registry(&reg).expect("save 2");
        let loaded2 = load_registry(&net).expect("load 2");
        assert_eq!(loaded2.contracts.get("coffer").map(|c| c.address.as_str()), Some("0xCAFE"));
        // Cleanup.
        let _ = std::fs::remove_file(registry_path(&net));
    }

    #[test]
    fn save_registry_leaves_no_tmp_file_after_success() {
        let net = unique_network("no_tmp");
        let reg = DeploymentRegistry {
            network: net.clone(),
            contracts: Default::default(),
        };
        save_registry(&reg).expect("save");
        let tmp_path = registry_path(&net).with_extension("json.tmp");
        assert!(
            !tmp_path.exists(),
            "I-10: atomic rename must leave NO .tmp file behind after successful write (found {tmp_path:?})"
        );
        let _ = std::fs::remove_file(registry_path(&net));
    }

    #[test]
    fn load_registry_returns_empty_when_file_absent() {
        let net = unique_network("absent");
        // No save call → file doesn't exist → load returns an empty registry
        // (not an error). This is the load-bearing "first-deploy" path.
        let loaded = load_registry(&net).expect("absent file returns empty registry");
        assert_eq!(loaded.network, net);
        assert!(loaded.contracts.is_empty());
    }

    #[test]
    fn registry_path_uses_deployments_dir() {
        let p = registry_path("arbitrum_sepolia");
        let s = p.to_string_lossy();
        assert!(s.contains("deployments"));
        assert!(s.ends_with("arbitrum_sepolia.json"));
    }
}
