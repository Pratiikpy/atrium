//! Persistent state for a community agent.

use std::path::PathBuf;

use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::Signal;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AgentState {
    name: String,
    pub prices: Vec<f64>,
    pub decisions: Vec<DecisionLog>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DecisionLog {
    pub at_ts: i64,
    pub price: f64,
    pub signal: String,
}

impl AgentState {
    pub fn load_or_init(name: &str) -> Result<Self> {
        let path = state_path(name);
        if path.exists() {
            let text = std::fs::read_to_string(&path)?;
            Ok(serde_json::from_str(&text)?)
        } else {
            Ok(Self {
                name: name.to_string(),
                ..Default::default()
            })
        }
    }

    pub fn save(&self) -> Result<()> {
        // Audit OOOO-1 fix: atomic write pattern matching deploy.rs I-10.
        // Pre-fix `std::fs::write` was non-atomic — a crash mid-write would
        // leave a partial JSON file that fails to parse on next load_or_init,
        // forcing the agent to re-init from empty (losing price history +
        // decision log). Same partial-coverage drift as MMMM-1/NNNN-1 — the
        // atomic-write fix landed in one place but not another. Tmp-file +
        // rename is atomic on POSIX (and effectively atomic on Windows for
        // small files).
        let path = state_path(&self.name);
        std::fs::create_dir_all(path.parent().unwrap_or_else(|| std::path::Path::new(".")))?;
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_string_pretty(self)?)?;
        std::fs::rename(&tmp, &path)?;
        Ok(())
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

fn state_path(name: &str) -> PathBuf {
    std::env::var("AGENT_STATE_DIR")
        .map(|d| PathBuf::from(d).join(format!("{name}.json")))
        .unwrap_or_else(|_| PathBuf::from(format!("./{name}-state.json")))
}

#[cfg(test)]
mod tests {
    //! Iter 78 audit fix: pins the OOOO-1 atomic-write contract on
    //! AgentState::save + the load_or_init round-trip + the 200-row
    //! cap on prices/decisions (prevents unbounded state growth).
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static SEQ: AtomicU64 = AtomicU64::new(0);
    fn unique_name(label: &str) -> String {
        let n = SEQ.fetch_add(1, Ordering::SeqCst);
        let pid = std::process::id();
        format!("test_iter78_state_{label}_{pid}_{n}")
    }

    fn use_temp_state_dir() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("atrium-agent-state-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("mkdir tmp state dir");
        std::env::set_var("AGENT_STATE_DIR", &dir);
        dir
    }

    #[test]
    fn save_then_load_round_trips_data() {
        use_temp_state_dir();
        let name = unique_name("roundtrip");
        let mut s = AgentState::load_or_init(&name).expect("init");
        s.record_decision(100.5, Signal::EnterLong);
        s.record_decision(101.0, Signal::Hold);
        s.save().expect("save");

        let loaded = AgentState::load_or_init(&name).expect("reload");
        assert_eq!(loaded.prices, vec![100.5, 101.0]);
        assert_eq!(loaded.decisions.len(), 2);
        let _ = std::fs::remove_file(state_path(&name));
    }

    #[test]
    fn save_leaves_no_tmp_file_after_success_oooo1() {
        use_temp_state_dir();
        let name = unique_name("no_tmp");
        let s = AgentState::load_or_init(&name).expect("init");
        s.save().expect("save");
        let tmp = state_path(&name).with_extension("json.tmp");
        assert!(
            !tmp.exists(),
            "OOOO-1: atomic rename must leave no .tmp file behind (found {tmp:?})"
        );
        let _ = std::fs::remove_file(state_path(&name));
    }

    #[test]
    fn load_or_init_returns_empty_when_file_absent() {
        use_temp_state_dir();
        let name = unique_name("absent");
        let s = AgentState::load_or_init(&name).expect("absent → empty");
        assert!(s.prices.is_empty());
        assert!(s.decisions.is_empty());
    }

    #[test]
    fn record_decision_caps_prices_at_200() {
        use_temp_state_dir();
        let name = unique_name("price_cap");
        let mut s = AgentState::load_or_init(&name).expect("init");
        for i in 0..250 {
            s.record_decision(i as f64, Signal::Hold);
        }
        // Cap = 200. The newest 200 prices remain; oldest 50 drained.
        assert_eq!(s.prices.len(), 200);
        assert_eq!(s.prices[0], 50.0);
        assert_eq!(s.prices[199], 249.0);
    }

    #[test]
    fn record_decision_caps_decisions_at_200() {
        use_temp_state_dir();
        let name = unique_name("decision_cap");
        let mut s = AgentState::load_or_init(&name).expect("init");
        for _ in 0..250 {
            s.record_decision(100.0, Signal::Hold);
        }
        assert_eq!(s.decisions.len(), 200);
    }

    #[test]
    fn save_then_modify_then_resave_preserves_state() {
        // The atomic-rename approach must not leave stale state from
        // the first write that contaminates the second.
        use_temp_state_dir();
        let name = unique_name("modify_resave");
        let mut s = AgentState::load_or_init(&name).expect("init");
        s.record_decision(1.0, Signal::EnterLong);
        s.save().expect("save 1");
        s.record_decision(2.0, Signal::Close);
        s.save().expect("save 2");

        let loaded = AgentState::load_or_init(&name).expect("reload");
        assert_eq!(loaded.prices, vec![1.0, 2.0]);
        assert_eq!(loaded.decisions.len(), 2);
        let _ = std::fs::remove_file(state_path(&name));
    }
}
