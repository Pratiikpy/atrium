//! Augur — Atrium mean-reversion reference agent.
//!
//! Strategy: Bollinger band mean-reversion on a single HIP-3 stock perp.
//! - 20-period rolling mean and standard deviation on hourly closes.
//! - Enter long when price < mean - 2σ; enter short when price > mean + 2σ.
//! - Exit when price returns to within 1σ of the mean.
//! - Per-action cap: 50 USDC notional.
//! - Total allocation: $500 testnet USDC.
//!
//! Cadence: hourly cron. Uses Sigil IntentSigil + ActionSigil via Postern
//! session key. Reads Codex for current portfolio state.
//!
//! Honesty: this is reference scaffolding, not alpha. Real strategies come
//! from the community Curator grants.

use std::time::Duration;

use anyhow::{Context, Result};
use clap::Parser;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

mod strategy;
mod state;

use strategy::{Bands, Signal};

#[derive(Parser, Debug)]
#[command(name = "augur", about = "Atrium mean-reversion reference agent")]
struct Args {
    /// Codex API base URL
    #[arg(long, env = "CODEX_URL", default_value = "https://codex.atrium.fi")]
    codex_url: String,

    /// Instrument id (keccak256 of the symbol)
    #[arg(long, env = "AUGUR_INSTRUMENT_ID")]
    instrument_id: String,

    /// Plinth contract address
    #[arg(long, env = "PLINTH_ADDRESS")]
    plinth_address: String,

    /// Postern session key (hex private key, encrypted at rest)
    #[arg(long, env = "POSTERN_SESSION_KEY")]
    session_key: String,

    /// Hours between rebalance ticks
    #[arg(long, default_value_t = 1)]
    interval_hours: u64,
}

#[derive(Debug, Deserialize)]
struct VenueHealth {
    is_operational: bool,
    quoted_spread_bps: u16,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();
    let args = Args::parse();
    info!(?args.instrument_id, "augur starting");

    let mut state = state::AgentState::load_or_init(&args).context("load state")?;
    let interval = Duration::from_secs(args.interval_hours * 3600);
    let client = reqwest::Client::builder().build()?;

    loop {
        if let Err(err) = tick(&args, &client, &mut state).await {
            warn!(?err, "tick failed; continuing");
        }
        tokio::time::sleep(interval).await;
    }
}

async fn tick(args: &Args, client: &reqwest::Client, state: &mut state::AgentState) -> Result<()> {
    // 1. Fetch venue health — bail early if instrument is offline
    let health: Vec<VenueHealth> = client
        .get(format!("{}/v1/venues/health", args.codex_url))
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?
        .get("venues")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();
    if health.iter().all(|h| !h.is_operational) {
        info!("no venue operational; skip");
        return Ok(());
    }

    // 2. Pull recent prices (Codex backtest endpoint serves the price series in v1)
    let prices = state.price_history();
    let bands = Bands::compute(&prices, 20);

    // 3. Pull current price (last price from same series)
    let Some(&current) = prices.last() else {
        info!("no price yet; skip");
        return Ok(());
    };

    let signal = bands.signal_for(current);
    info!(price = current, ?bands, ?signal, "decision");

    // 4. Act on signal — build + sign ActionSigil, submit to Plinth via Postern
    match signal {
        Signal::Hold => {}
        Signal::EnterLong | Signal::EnterShort | Signal::Close => {
            // Real impl: build ActionSigil from IntentSigil, sign with session key,
            // call EntryPoint via Pimlico bundler. Year-1 scaffold logs the intent.
            info!(?signal, "would submit ActionSigil — wire to Pimlico in production");
        }
    }

    state.record_decision(current, signal);
    state.save()?;
    Ok(())
}
