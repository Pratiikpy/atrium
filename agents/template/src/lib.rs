//! Atrium agent template — the shared harness every reference agent uses.
//!
//! A Curator-grant community agent fills in three things:
//!   1. `Strategy::decide` — pure function returning a `Signal`
//!   2. `AgentConfig` — instrument + allocation + cadence
//!   3. `main.rs` — wires the strategy into the harness `run_loop`
//!
//! Everything else (Codex reads, Sigil ActionSigil signing, Postern UserOp
//! submission, Rostrum recordAction, state persistence) is in the template.

#![deny(unsafe_code)]

use std::time::Duration;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

pub mod codex;
pub mod sigil;
pub mod state;

/// Discrete trading decision a strategy can produce on each tick.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Signal {
    EnterLong,
    EnterShort,
    Close,
    Hold,
}

/// Implemented by every community agent.
pub trait Strategy: Send + Sync {
    /// Pure function: given recent prices + current open position, return a Signal.
    fn decide(&self, prices: &[f64], current_position_notional: f64) -> Signal;

    /// Strategy name — appears on Rostrum leaderboard.
    fn name(&self) -> &'static str;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub codex_url: String,
    pub instrument_id: String,
    pub venue_id: u8,
    pub interval_seconds: u64,
    pub max_notional_per_action_usdc: u64,
    pub max_total_open_notional_usdc: u64,
    pub max_actions_per_24h: u32,
}

pub async fn run_loop<S: Strategy>(strategy: S, config: AgentConfig) -> Result<()> {
    let mut state = state::AgentState::load_or_init(strategy.name()).context("load state")?;
    let interval = Duration::from_secs(config.interval_seconds);
    let client = reqwest::Client::builder().build()?;

    loop {
        if let Err(err) = tick(&strategy, &config, &client, &mut state).await {
            warn!(?err, agent = strategy.name(), "tick failed; continuing");
        }
        tokio::time::sleep(interval).await;
    }
}

async fn tick<S: Strategy>(
    strategy: &S,
    config: &AgentConfig,
    client: &reqwest::Client,
    state: &mut state::AgentState,
) -> Result<()> {
    // 1. Fetch venue health — bail early
    let health = codex::fetch_venue_health(client, &config.codex_url, config.venue_id).await?;
    if !health.is_operational {
        info!(venue = config.venue_id, "venue offline; skip");
        return Ok(());
    }

    // 2. Fetch recent prices + current position
    let prices = codex::fetch_prices(client, &config.codex_url, &config.instrument_id).await?;
    let current_position =
        codex::fetch_open_position(client, &config.codex_url, strategy.name()).await?;

    // Silent-failure guard: fetch_prices is currently a stub returning [].
    // Strategies invariably return Hold on empty prices (RSI=NaN, Bollinger
    // bands undefined, etc.), so without this check every agent run would
    // log "decision: Hold" forever — operator never knows the prices
    // endpoint isn't wired. Fail loud (skip this tick with a warn log) so
    // the gap is visible in the agent's stdout. When the /v1/prices
    // endpoint lands (codex roadmap), this check naturally goes quiet.
    if prices.is_empty() {
        warn!(
            agent = strategy.name(),
            instrument = config.instrument_id,
            "prices empty — Codex /v1/prices endpoint not wired yet; skipping tick"
        );
        return Ok(());
    }

    // 3. Decide
    let signal = strategy.decide(&prices, current_position.notional_signed);
    info!(
        agent = strategy.name(),
        ?signal,
        current = current_position.notional_signed,
        "decision"
    );

    // 4. Act
    match signal {
        Signal::Hold => {}
        Signal::EnterLong | Signal::EnterShort | Signal::Close => {
            sigil::submit_action_sigil(client, config, strategy.name(), signal, &current_position)
                .await?;
        }
    }

    state.record_decision(prices.last().copied().unwrap_or(0.0), signal);
    state.save()?;
    Ok(())
}
