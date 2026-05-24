//! Praetor lantern ops — out-of-band attestation publish trigger.
//!
//! Audit YYY-6 / `human_left.md` #30 fix: pre-fix this was a no-op stub
//! (logged + returned Ok). An operator running `praetor lantern publish-now`
//! during an incident — say, the verify-app dashboard shows a stale Merkle
//! root and stakeholders need a fresh attestation immediately — would think
//! the trigger fired but the lantern-attestor service would keep running
//! its hourly cron unchanged.
//!
//! Implementation note: the lantern-attestor service (Node, TS) currently
//! runs a `setTimeout(HOUR_MS)` loop with no out-of-band trigger interface
//! (no HTTP server, no signal handler). Wiring a real trigger means either
//! (a) adding an HTTP endpoint to the service, or (b) shipping a one-shot
//! companion binary that invokes the `publishOnce` flow directly. Both are
//! engineering work for Wave-1.
//!
//! Until either lands, this command refuses to claim success. The bail
//! message names the manual workaround so an operator has a path forward.

use anyhow::{bail, Result};
use tracing::info;

use crate::LanternAction;

pub async fn run(network: &str, action: LanternAction) -> Result<()> {
    match action {
        LanternAction::PublishNow => {
            info!(network, "lantern publish-now requested");
            bail!(
                "lantern publish-now not yet wired (audit YYY-6). \
                 Manual workaround: SSH into the lantern-attestor host and \
                 run `pnpm --filter @atrium/lantern-attestor start --once`, \
                 OR restart the systemd service to force the loop to fire \
                 immediately. Wave-1 will add an HTTP trigger endpoint."
            );
        }
    }
}
