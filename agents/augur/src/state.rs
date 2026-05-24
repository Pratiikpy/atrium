//! Augur on-disk state.

use std::path::PathBuf;

use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::strategy::Signal;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AgentState {
    /// Recent prices (most recent last). Capped at 200 entries.
    prices: Vec<f64>,
    /// Recent decisions for telemetry.
    decisions: Vec<DecisionLog>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DecisionLog {
    pub at_ts: i64,
    pub price: f64,
    pub signal: String,
}

impl AgentState {
    pub fn load_or_init(_args: &crate::Args) -> Result<Self> {
        let path = state_path();
        if path.exists() {
            let text = std::fs::read_to_string(&path)?;
            Ok(serde_json::from_str(&text)?)
        } else {
            Ok(Self::default())
        }
    }

    pub fn save(&self) -> Result<()> {
        let path = state_path();
        std::fs::create_dir_all(path.parent().unwrap_or_else(|| std::path::Path::new(".")))?;
        std::fs::write(&path, serde_json::to_string_pretty(self)?)?;
        Ok(())
    }

    pub fn price_history(&self) -> Vec<f64> {
        self.prices.clone()
    }

    pub fn record_decision(&mut self, price: f64, signal: Signal) {
        self.prices.push(price);
        if self.prices.len() > 200 {
            self.prices.drain(0..self.prices.len() - 200);
        }
        self.decisions.push(DecisionLog {
            at_ts: chrono::Utc::now().timestamp(),
            price,
            signal: format!("{signal:?}"),
        });
        if self.decisions.len() > 200 {
            self.decisions.drain(0..self.decisions.len() - 200);
        }
    }
}

fn state_path() -> PathBuf {
    std::env::var("AUGUR_STATE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("./augur-state.json"))
}
