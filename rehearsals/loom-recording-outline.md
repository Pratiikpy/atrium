# Loom backup recording — what to record + how to use it

PRD §26.1 backup path. The Loom is what judges watch when
`verify.atrium.fi` 404s on demo day.

## Why the Loom matters

The Verifier-mode demo is the moment Atrium is judged on. If the prod
URL is down, the network at the venue is bad, or the cohort wifi
hiccups, the Loom is the difference between "they couldn't show it"
and "they showed it anyway".

The Loom must capture the SAME 5-minute flow as `judge-runbook.md`
beat-for-beat, with the same wallet on the same Arbitrum Sepolia,
recorded under the same conditions as the live demo.

## Recording setup

- Use Loom (or OBS → Loom upload) at 1080p, system audio + mic on
- F1 records from a fresh Chrome profile with no extensions
- F2 stays off the recording surface; chaos injection runs from
  F2's terminal but the terminal stays off-camera
- Record at least 3 takes; keep the cleanest one

## What the Loom must contain (mirrors `judge-runbook.md`)

| Beat | Content |
|---|---|
| 0:00–0:30 | F1 says the Jamie hook over the landing page |
| 0:30–1:00 | Verifier mode opens, Kani badge visible |
| 1:00–1:30 | Deposit tx — real signature, real Arbiscan link |
| 1:30–2:30 | Hedged open, margin number changes live |
| 2:30–3:30 | Chaos: oracle_drift inject + restore narration |
| 3:30–4:00 | Lantern reserves proof — real Merkle path |
| 4:00–4:30 | Kill switch — real revoke tx |
| 4:30–5:00 | Closing slide with three asks + QR code |

## What the Loom must NOT contain

- Any wallet seed phrase or private key on screen (even briefly)
- The Praetor multisig key or any deployer-flow secret
- Cohort partner names without consent (Wintermute, Selini, etc.)
- A fake number — every number on screen must be sourced from chain
- A skipped beat. If a beat fails on the cleanest take, re-record.

## Hosting

Upload to Loom; private link controlled by F1's atrium.fi account.
Mirror to `/public/loom-backup-2026-05-XX.mp4` on the production
deploy so a same-origin video element can fall back to it when
verify.atrium.fi serves the demo page.

## QR card

Print a wallet-sized card with:
- The Loom URL
- A QR code resolving to the same URL
- The line "Verifier mode backup" in 8pt mono

F3 carries 10 of these in a pocket. Hand one to each judge if the
live demo can't run.

## Re-record cadence

The Loom is only useful if it matches CURRENT state of the testnet
deployment. Re-record whenever:

- A contract address changes in `deployments/arbitrum_sepolia.json`
- The Verifier-mode UI flow changes a beat
- The Kani CI badge flips state
- The Lantern attestor cron schedule changes

Stale Loom = bigger lie than no Loom.

## Pre-day checklist

- [ ] Loom URL works from a brand-new browser session (no cookies)
- [ ] QR card resolves on a fresh phone (no autofill, no app prompts)
- [ ] Loom audio is audible at venue volume on a backup speaker
- [ ] Loom plays without buffering on a representative venue wifi
