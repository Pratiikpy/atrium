# Fault-injection checklist

PRD §22.5 + §26.2. F2 randomly picks one fault per dress run. Goal:
prove the UI degrades gracefully under every documented failure.

## Each rehearsal injects exactly one fault

Random pick by F2 — roll a d6, repeat the roll until covered. After
10 runs all 6 should be hit at least once.

| Roll | Fault | Inject via | Expected UI response | Recovery |
|---|---|---|---|---|
| 1 | `oracle_drift` | `POST /api/chaos/inject {"fault":"oracle_drift"}` from F2's side terminal | Plinth tile shows amber "paused — oracle drift". Tx submissions queue. | `POST /api/chaos/restore {"fault":"oracle_drift"}`. UI shows "resume pending 48h timelock". |
| 2 | `keeper_offline` | `POST /api/chaos/inject {"fault":"keeper_offline"}` | Vigil tile shows "keeper missed window 1/3". | Auto — next successful tick resets. |
| 3 | `partial_fill` | `POST /api/chaos/inject {"fault":"partial_fill"}` | Coffer tile shows "deposits paused". | `POST /api/chaos/restore {"fault":"partial_fill"}`. Instant. |
| 4 | `gas_spike` | `POST /api/chaos/inject {"fault":"gas_spike"}` | Annotation in tx-confirmation UI: "gas 5x normal — slow path". | None needed; simulated. |
| 5 | `indexer_stall` | `POST /api/chaos/inject {"fault":"indexer_stall"}` | Live-data tiles flip to "Scribe slow · refreshing". | Auto — 3-5 sec. |
| 6 | `wifi_drop` | F2 yanks the venue ethernet for 5s | App should show offline banner; tx submitted should still mine. | F2 plugs cable back. |

## Pre-flight (before run)

- [ ] `CHAOS_PRIVATE_KEY` set on Vercel project + matches the chaos
  signer EOA with multisig privs on Plinth/Coffer/Vigil
- [ ] `Origin` allowlist on `/api/chaos/*` includes the rehearsal host
  (verify.atrium.fi + dev + .vercel.app preview)
- [ ] Rate limit cleared (30s window) — F2 does NOT re-inject during
  the same drill
- [ ] F2 has a side terminal open with `curl` aliased to the right
  POST + Origin header set so the chaos route accepts the call:
  ```sh
  alias chaos-inject='curl -s -X POST -H "Content-Type: application/json" -H "Origin: https://verify.atrium.fi" https://verify.atrium.fi/api/chaos/inject -d'
  alias chaos-restore='curl -s -X POST -H "Content-Type: application/json" -H "Origin: https://verify.atrium.fi" https://verify.atrium.fi/api/chaos/restore -d'
  ```

## What "graceful degradation" looks like

For each fault the demo MUST show:

1. The UI surface acknowledges the fault within 30 seconds. No silent
   slip — the tile literally changes colour + says what broke.
2. Other surfaces stay live. Coffer paused does NOT crash the
   portfolio dashboard.
3. F1 narrates the fault. No silent reaction. Judges see Atrium
   designed for this.
4. Recovery path runs cleanly. If `oracle_drift` recovery says
   "timelock 48h", that's correct — don't try to fake an instant
   restore.

## What "failed degradation" looks like (do NOT ship)

- White-screen / 500 error
- Tile shows stale data with no "Scribe slow" indicator
- Tx submission button stays clickable but every click reverts
- The Kani badge silently flips to "unknown"

If any rehearsal hits one of these, that's a P0 bug — fix before
submission day.

## Per-run notes

Append observations to `rehearsals/dress-runs/<NN>-<date>.md`:

- Which fault rolled
- Actual UI response time (acknowledgement, recovery)
- Anything F1 had to explain that wasn't in `judge-runbook.md`
- Anything that surprised a judge in Q&A
