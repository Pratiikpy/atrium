//! Codex API client used by the agent harness.

use anyhow::{Context, Result};
use serde::Deserialize;

#[derive(Debug, Deserialize, Default)]
pub struct VenueHealth {
    pub is_operational: bool,
    pub quoted_spread_bps: u16,
}

#[derive(Debug, Deserialize, Default)]
pub struct OpenPosition {
    pub notional_signed: f64,
    pub entry_price: f64,
}

pub async fn fetch_venue_health(
    client: &reqwest::Client,
    codex_url: &str,
    venue_id: u8,
) -> Result<VenueHealth> {
    let url = format!("{codex_url}/v1/venues/health");
    let resp = client.get(&url).send().await.context("venues health")?;
    let body: serde_json::Value = resp.json().await?;
    let venues = body
        .get("venues")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    for v in venues {
        if v.get("id").and_then(|i| i.as_u64()) == Some(venue_id as u64) {
            let h = v.get("health").cloned().unwrap_or_default();
            return Ok(serde_json::from_value(h).unwrap_or_default());
        }
    }
    Ok(VenueHealth::default())
}

pub async fn fetch_prices(
    client: &reqwest::Client,
    codex_url: &str,
    _instrument_id: &str,
) -> Result<Vec<f64>> {
    // Production: a /v1/prices/{instrument_id}?candles=N endpoint serves the
    // last N closes. Until that endpoint lands (Month 4 Week 2 per ROADMAP),
    // the template returns an empty Vec. The harness's `tick()` checks
    // `prices.is_empty()` and warn-skips the iteration so the gap surfaces
    // visibly in the agent's stdout. Once the endpoint lands, the loud-
    // failure check naturally goes quiet (real data fills the Vec).
    let _ = (client, codex_url);
    Ok(vec![])
}

pub async fn fetch_open_position(
    client: &reqwest::Client,
    codex_url: &str,
    _agent: &str,
) -> Result<OpenPosition> {
    // Silent-failure guard, mirroring fetch_prices: pre-fix this returned
    // OpenPosition::default() (notional 0, entry_price 0) which strategies
    // would read as "no open position" — leading to over-opening positions
    // if/when submission ever works. The default values are stub semantics,
    // NOT real "no open position" semantics (a real "no position" response
    // would also be Ok(default()), making the two states indistinguishable).
    //
    // Fail loud so the gap surfaces: bail with a clear message naming the
    // missing endpoint. Harness catches via tick's `?` and warn-logs per
    // tick. When the Codex /v1/positions/aggregated/{agent} endpoint
    // is wired (same waypoint as fetch_prices — Month 4 W2), replace bail
    // with the real call.
    let _ = (client, codex_url);
    anyhow::bail!(
        "fetch_open_position stub: Codex /v1/positions/aggregated/{{agent}} endpoint not wired yet. \
         Returning OpenPosition::default() would silently misreport agent state as 'no position' \
         and risk over-opening once submission lands."
    )
}

#[cfg(test)]
mod tests {
    //! Iter 82 audit fix: pin the anti-silent-failure semantics on the
    //! two unwired Codex endpoints. fetch_prices returns Ok(empty) per
    //! its documented "harness loud-failure" convention; fetch_open_position
    //! BAILS instead of returning Ok(default()) to prevent the "agent
    //! over-opens because it thinks position is 0" failure mode. Both
    //! anti-patterns mirror sigil.rs K-10 (iter 78) — when the upstream
    //! endpoints land, these tests transition to assert real-data paths.
    use super::*;

    #[test]
    fn fetch_prices_returns_empty_vec_until_endpoint_wired() {
        // Documented behavior: until /v1/prices/{instrument}?candles=N
        // lands, fetch_prices returns Ok(vec![]). The harness's tick()
        // checks `prices.is_empty()` and warn-skips, so the gap is loud
        // in operator stdout but doesn't crash the agent.
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let client = reqwest::Client::new();
            let result = fetch_prices(&client, "http://localhost", "0xinstrument").await;
            assert!(result.is_ok(), "fetch_prices stub should return Ok");
            let prices = result.unwrap();
            assert!(
                prices.is_empty(),
                "stub returns empty Vec until endpoint wired"
            );
        });
    }

    #[test]
    fn fetch_open_position_bails_until_endpoint_wired() {
        // Critical anti-silent-failure: pre-fix this returned Ok(default()).
        // Strategy code that interprets default() (notional=0) as "no
        // position" would then over-open. Post-fix: bail loudly.
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let client = reqwest::Client::new();
            let result = fetch_open_position(&client, "http://localhost", "agent-x").await;
            assert!(
                result.is_err(),
                "fetch_open_position MUST bail until endpoint wired"
            );
            let err = result.unwrap_err().to_string();
            assert!(
                err.contains("not wired") || err.contains("stub"),
                "err message must name the unwired state: {err}"
            );
            // Defensive: error message must NOT pretend a position was found.
            assert!(
                !err.contains("notional_signed:"),
                "err must not look like a successful position response"
            );
        });
    }

    #[test]
    fn venue_health_default_is_not_operational_zero_spread() {
        // VenueHealth::default() is what fetch_venue_health returns when
        // a venue is not in the response. Strategy code consumes
        // is_operational to skip pre-trade checks — the default MUST be
        // is_operational=false so missing-data is treated as "venue down"
        // (loud), not "venue up with 0bps spread" (silent + dangerous).
        let h = VenueHealth::default();
        assert_eq!(h.is_operational, false);
        assert_eq!(h.quoted_spread_bps, 0);
    }

    #[test]
    fn open_position_default_is_zero_zero() {
        let p = OpenPosition::default();
        assert_eq!(p.notional_signed, 0.0);
        assert_eq!(p.entry_price, 0.0);
        // The fact that default() returns "no position"-looking values is
        // EXACTLY the silent-failure risk that fetch_open_position's bail
        // guards against. This test documents that risk: if a future
        // refactor relaxes the bail to Ok(default()), a strategy reading
        // notional_signed == 0 would conclude "no position" and over-open.
    }
}
