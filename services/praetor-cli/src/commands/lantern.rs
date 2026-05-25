//! Praetor lantern ops - out-of-band attestation publish trigger.
//!
//! Phase zeta.6 (2026-05-25): wired to the Vercel-hosted lantern-attestor
//! cron endpoint via HTTP POST + Bearer auth. The cron endpoint at
//! `${LANTERN_CRON_URL}/api/cron` (Vercel serverless function) accepts
//! `Authorization: Bearer ${LANTERN_CRON_SECRET}` and runs one
//! publishOnce cycle: fetch Coffer balances, build Merkle tree, pin to
//! IPFS, sign + publish the root on-chain.
//!
//! Audit YYY-6 / human_left.md #30: pre-fix this was a stub that bailed
//! with an SSH workaround. The Vercel cron now serves as the trigger
//! interface; no new HTTP server inside the lantern-attestor service was
//! needed. The CLI just calls the same endpoint Vercel's scheduler calls.

use anyhow::{bail, Context, Result};
use serde::Deserialize;
use tracing::info;

use crate::LanternAction;

#[derive(Debug, Deserialize)]
struct CronResponse {
    /// Cron handlers vary; we accept any JSON-encoded body. The two fields
    /// the lantern-attestor returns are `root` + `tx`, both optional - on
    /// a no-op tick (zero Coffer balances) the body is `{"status":"skipped"}`.
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    root: Option<String>,
    #[serde(default)]
    tx: Option<String>,
}

pub async fn run(network: &str, action: LanternAction) -> Result<()> {
    match action {
        LanternAction::PublishNow {
            cron_url,
            cron_secret,
        } => {
            let url = cron_url
                .or_else(|| std::env::var("LANTERN_CRON_URL").ok())
                .ok_or_else(|| {
                    anyhow::anyhow!(
                        "LANTERN_CRON_URL not set and --cron-url flag absent. \
                         Expected the Vercel-hosted lantern-attestor /api/cron \
                         endpoint, e.g. https://lantern.atrium.fi/api/cron."
                    )
                })?;
            let secret = cron_secret
                .or_else(|| std::env::var("LANTERN_CRON_SECRET").ok())
                .ok_or_else(|| {
                    anyhow::anyhow!(
                        "LANTERN_CRON_SECRET not set and --cron-secret flag \
                         absent. The Vercel cron rejects unauthenticated \
                         requests; see ~/.atrium/lantern-cron-secret.txt for \
                         the live value."
                    )
                })?;

            info!(network, url = %url, "lantern publish-now triggering cron");

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .context("build reqwest client")?;

            let response = client
                .post(&url)
                .header("Authorization", format!("Bearer {}", secret))
                .header("Content-Type", "application/json")
                .body("{}")
                .send()
                .await
                .context("POST to lantern cron failed")?;

            let status = response.status();
            let body_text = response
                .text()
                .await
                .context("read cron response body")?;

            if !status.is_success() {
                bail!(
                    "lantern cron returned {}: {}",
                    status,
                    body_text.chars().take(500).collect::<String>()
                );
            }

            // Best-effort parse; the cron may emit a free-form body.
            let parsed: Result<CronResponse, _> = serde_json::from_str(&body_text);
            match parsed {
                Ok(r) => {
                    info!(
                        status = ?r.status,
                        root = ?r.root,
                        tx = ?r.tx,
                        "lantern cron completed"
                    );
                    if let Some(tx) = r.tx {
                        println!("Lantern attestation published. tx: {}", tx);
                        if let Some(root) = r.root {
                            println!("Merkle root:   {}", root);
                        }
                        println!(
                            "Arbiscan:      https://sepolia.arbiscan.io/tx/{}",
                            tx
                        );
                    } else {
                        println!(
                            "Lantern cron returned status={} (no tx). Body: {}",
                            r.status.unwrap_or_else(|| "<none>".into()),
                            body_text.chars().take(200).collect::<String>()
                        );
                    }
                }
                Err(_) => {
                    // Free-form body; print it raw.
                    println!("Lantern cron 200 OK. Body: {}", body_text);
                }
            }

            Ok(())
        }
    }
}
