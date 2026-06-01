//! Haruspex, momentum reference agent.
//!
//! Strategy: 10-period RSI on HIP-3 stock perps. Enter long on overbought
//! breakout. Exit when RSI back in neutral band. Audit C-17 fix: now wired
//! through the shared `atrium-agent-template` harness; no more empty loop.
//!
//! Per-action cap: 50 USDC. Total allocation: $500. Cadence: hourly.

use anyhow::{Context, Result};
use atrium_agent_template::{run_loop, AgentConfig, Signal, Strategy};

mod strategy;

struct HaruspexStrategy;

impl Strategy for HaruspexStrategy {
    fn name(&self) -> &'static str {
        "haruspex"
    }

    fn decide(&self, prices: &[f64], current_position_notional: f64) -> Signal {
        let rsi_value = strategy::rsi(prices, 10);
        let signal = strategy::signal_from_rsi(rsi_value);
        match signal {
            strategy::Signal::EnterLong => {
                if current_position_notional > 0.0 {
                    Signal::Hold
                } else {
                    Signal::EnterLong
                }
            }
            strategy::Signal::EnterShort => {
                if current_position_notional < 0.0 {
                    Signal::Hold
                } else {
                    Signal::EnterShort
                }
            }
            strategy::Signal::Close => {
                if current_position_notional == 0.0 {
                    Signal::Hold
                } else {
                    Signal::Close
                }
            }
            strategy::Signal::Hold => Signal::Hold,
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();
    // Silent-failure guard: instrument_id is the fundamental identifier the
    // agent operates on. Pre-fix, an unset HARUSPEX_INSTRUMENT_ID would default
    // to "" and the agent would run silently, fetching empty prices, never
    // taking an action, hitting allocation caps after 24h of no-ops. The
    // operator would think everything was fine. Now we refuse to start.
    let instrument_id = std::env::var("HARUSPEX_INSTRUMENT_ID")
        .context("HARUSPEX_INSTRUMENT_ID must be set to a non-empty Plinth instrument id")?;
    if instrument_id.is_empty() {
        anyhow::bail!("HARUSPEX_INSTRUMENT_ID must not be empty");
    }
    let config = AgentConfig {
        codex_url: std::env::var("CODEX_URL")
            .unwrap_or_else(|_| "https://codex.atrium.fi".to_string()),
        instrument_id,
        venue_id: 1,
        interval_seconds: 3600,
        max_notional_per_action_usdc: 50,
        max_total_open_notional_usdc: 500,
        max_actions_per_24h: 24,
    };
    run_loop(HaruspexStrategy, config).await
}
