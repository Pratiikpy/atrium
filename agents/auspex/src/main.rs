//! Auspex, basis-trade reference agent.
//!
//! Strategy: long Pendle YT vs short equivalent Aave Horizon T-bill yield.
//! Audit C-17 fix: now wired through the shared harness.
//! Cadence: daily. Per-action cap: 50 USDC. Total allocation: $500.

use anyhow::{Context, Result};
use atrium_agent_template::{run_loop, AgentConfig, Signal, Strategy};

mod strategy;

struct AuspexStrategy;

impl Strategy for AuspexStrategy {
    fn name(&self) -> &'static str {
        "auspex"
    }

    fn decide(&self, _prices: &[f64], _current_position_notional: f64) -> Signal {
        // Real signals come from comparing Pendle implied APY vs Aave T-bill APY.
        // Codex /v1/risk/snapshot needs to be extended to surface both rates
        // (Month 4 W2). Until then, hold.
        Signal::Hold
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();
    // Silent-failure guard, mirrors Haruspex. See haruspex/main.rs comment
    //, an empty instrument_id would silently produce a no-op agent that
    // never errors but never trades. Refuse to start instead.
    let instrument_id = std::env::var("AUSPEX_INSTRUMENT_ID")
        .context("AUSPEX_INSTRUMENT_ID must be set to a non-empty Plinth instrument id")?;
    if instrument_id.is_empty() {
        anyhow::bail!("AUSPEX_INSTRUMENT_ID must not be empty");
    }
    let config = AgentConfig {
        codex_url: std::env::var("CODEX_URL")
            .unwrap_or_else(|_| "https://codex.atrium.fi".to_string()),
        instrument_id,
        venue_id: 3,
        interval_seconds: 24 * 3600,
        max_notional_per_action_usdc: 50,
        max_total_open_notional_usdc: 500,
        max_actions_per_24h: 2,
    };
    run_loop(AuspexStrategy, config).await
}
