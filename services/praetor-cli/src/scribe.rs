//! Scribe (The Graph) query helper.
//!
//! Centralizes the HTTP-status + GraphQL-errors + missing-data checks that
//! were duplicated across `multisig::list` and `keepers::list`. The earlier
//! versions of those callers swallowed Scribe errors and printed `null` to
//! the operator, exactly when, e.g., a stalled subgraph would mask a
//! still-pending incident-response timelock.
//!
//! Single read path: `query(graphql, "field_name")` returns the JSON value
//! at `data.field_name` or bails with a precise error message. All four
//! failure modes (env-missing, HTTP non-2xx, GraphQL errors, missing data
//! key) are explicit bails, none silently coerce to `null`.

use anyhow::{bail, Context, Result};
use serde_json::Value;

const SCRIBE_ENV: &str = "SCRIBE_URL";

/// POST a GraphQL query to Scribe. `data_field` is the top-level field name
/// to extract from the response (e.g. "keepers", "timelockSchedules").
/// Returns the JSON value at `data.<data_field>`, typically an array.
///
/// Bails on any of:
///   - SCRIBE_URL env var unset
///   - reqwest send error (network)
///   - HTTP status != 2xx (also bails with the body for ops triage)
///   - JSON parse failure
///   - GraphQL `errors` array present and non-empty
///   - `data.<data_field>` is missing or null (schema drift / wrong field name)
pub async fn query(graphql: &str, data_field: &str) -> Result<Value> {
    let scribe_url = std::env::var(SCRIBE_ENV).context("SCRIBE_URL must be set")?;
    let body = serde_json::json!({ "query": graphql });
    let client = reqwest::Client::new();
    let http_resp = client
        .post(&scribe_url)
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .context("scribe http request failed")?;

    if !http_resp.status().is_success() {
        bail!(
            "scribe http {}: {}",
            http_resp.status(),
            http_resp.text().await.unwrap_or_default()
        );
    }

    let resp: Value = http_resp.json().await.context("scribe json parse failed")?;

    if let Some(errors) = resp.get("errors").and_then(|e| e.as_array()) {
        if !errors.is_empty() {
            bail!("scribe returned errors: {}", serde_json::to_string(errors)?);
        }
    }

    let data = resp.get("data").and_then(|d| d.get(data_field));
    match data {
        Some(v) if !v.is_null() => Ok(v.clone()),
        _ => bail!(
            "scribe response missing data.{data_field}, \
             either the subgraph isn't deployed, the schema changed, or the field name is wrong: {}",
            serde_json::to_string(&resp)?
        ),
    }
}
