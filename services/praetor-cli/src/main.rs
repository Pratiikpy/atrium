//! Praetor, single-binary ops CLI for Atrium.
//!
//! Commands:
//!   praetor deploy --network <sepolia|local> [--all | --contract <name>]
//!   praetor verify --contract <name> --network <net>
//!   praetor migrate <contract> --from-version <vN> --to-version <vM>
//!   praetor multisig schedule --target <addr> --call <hex>
//!   praetor multisig execute --id <hex>
//!   praetor keepers list
//!   praetor keepers stake --keeper <addr> --amount <wei>
//!   praetor lantern publish-now
//!   praetor pause <contract>
//!   praetor resume <contract>
//!   praetor backtest publish --notebook <path> --ipfs-cid <cid>
//!
//! Every state-changing command routes through the PraetorTimelock multisig.

use anyhow::Result;
use clap::{Parser, Subcommand};

mod commands;
mod scribe;

#[derive(Parser, Debug)]
#[command(name = "praetor", version, about = "Atrium ops CLI")]
struct Cli {
    /// Network: arbitrum_sepolia | local
    #[arg(long, global = true, default_value = "arbitrum_sepolia")]
    network: String,

    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    /// Deploy contracts to a network
    Deploy {
        #[arg(long)]
        all: bool,
        #[arg(long)]
        contract: Option<String>,
        /// Include Wave-5 Phase-2 scaffolds (GMX, Synthetix V3, Morpho Blue, Stoa).
        /// Default false. Curator multisig must whitelist each bytecode hash
        /// before PorticoRegistry.registerAdapter accepts them.
        #[arg(long, default_value_t = false)]
        phase2: bool,
    },
    /// Verify a contract on the block explorer
    Verify {
        #[arg(long)]
        contract: String,
    },
    /// Schedule + execute multisig actions
    Multisig {
        #[command(subcommand)]
        action: MultisigAction,
    },
    /// Keeper management
    Keepers {
        #[command(subcommand)]
        action: KeeperAction,
    },
    /// Publish Lantern attestation immediately (out-of-band)
    Lantern {
        #[command(subcommand)]
        action: LanternAction,
    },
    /// Emergency pause a contract
    Pause {
        contract: String,
        #[arg(long)]
        reason: String,
    },
    /// Resume a paused contract.
    ///
    /// Most contracts expose a single `resume()` selector. Coffer has split
    /// paths (`resume_deposits` and `resume_withdrawals`) and REQUIRES
    /// `--action` to be set. Running without --action on a split-path
    /// contract is an explicit error rather than a wrong-calldata Safe
    /// submission.
    Resume {
        contract: String,
        /// For contracts with split resume paths (Coffer): `deposits` or `withdrawals`.
        #[arg(long)]
        action: Option<String>,
    },
    /// Publish a backtest attestation on-chain
    Backtest {
        #[command(subcommand)]
        action: BacktestAction,
    },
    /// Seed local Sepolia fork with demo data
    Seed,
}

#[derive(Subcommand, Debug)]
enum MultisigAction {
    Schedule {
        #[arg(long)]
        target: String,
        #[arg(long)]
        call: String,
    },
    Execute {
        #[arg(long)]
        id: String,
    },
    List,
}

#[derive(Subcommand, Debug)]
enum KeeperAction {
    List,
    Stake {
        #[arg(long)]
        keeper: String,
        #[arg(long)]
        amount: String,
    },
    Slash {
        #[arg(long)]
        keeper: String,
        #[arg(long)]
        reason: String,
    },
}

#[derive(Subcommand, Debug)]
enum LanternAction {
    /// Trigger the Lantern cron one-shot via HTTP. Reads LANTERN_CRON_URL
    /// + LANTERN_CRON_SECRET from env; falls back to --cron-url + --cron-secret.
    PublishNow {
        /// URL of the Vercel-hosted Lantern cron endpoint, e.g.
        /// https://lantern.useatrium.me/api/cron. Overrides LANTERN_CRON_URL.
        #[arg(long)]
        cron_url: Option<String>,
        /// Bearer secret for the cron endpoint. Overrides LANTERN_CRON_SECRET.
        #[arg(long)]
        cron_secret: Option<String>,
    },
}

#[derive(Subcommand, Debug)]
enum BacktestAction {
    Publish {
        #[arg(long)]
        notebook: String,
        #[arg(long)]
        ipfs_cid: String,
        /// Path to the local span_backtest.py JSON output. When set, the CLI
        /// reads `is_publishable` and refuses to build a Safe payload for
        /// synthetic results. Strongly recommended; optional for backwards
        /// compatibility with pre-v2-schema pipelines.
        #[arg(long)]
        json_path: Option<String>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Deploy {
            all,
            contract,
            phase2,
        } => commands::deploy::run(&cli.network, all, contract, phase2).await,
        Cmd::Verify { contract } => commands::verify::run(&cli.network, &contract).await,
        Cmd::Multisig { action } => commands::multisig::run(&cli.network, action).await,
        Cmd::Keepers { action } => commands::keepers::run(&cli.network, action).await,
        Cmd::Lantern { action } => commands::lantern::run(&cli.network, action).await,
        Cmd::Pause { contract, reason } => {
            commands::pause::run(&cli.network, &contract, &reason).await
        }
        Cmd::Resume { contract, action } => {
            commands::pause::resume(&cli.network, &contract, action.as_deref()).await
        }
        Cmd::Backtest { action } => commands::backtest::run(&cli.network, action).await,
        Cmd::Seed => commands::seed::run(&cli.network).await,
    }
}
