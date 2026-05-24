# Dress rehearsal template

Use this for every demo dry run. Acceptance: at least 9 of 10 must complete in ≤ 6 minutes with no judge-noticeable issue.

## Run metadata

- Date: YYYY-MM-DD
- Run number: N of 10
- Founder driving demo: F1 / F2 / F3
- Fault injected (random by non-driving founder): oracle_drift | keeper_offline | partial_fill | gas_spike | indexer_stall | wifi_drop | none

## Timed beats

| Beat | Target | Actual |
|---|---|---|
| 0:00 — Jamie hook | Speaker hits the $2M vs $900K number | |
| 0:30 — Verifier opens | URL loads in ≤ 1.5s | |
| 1:00 — Deposit step | Tx hash visible | |
| 1:30 — Open hedged | Two parallel tx hashes visible | |
| 2:00 — Margin saving | Number rendered live from Plinth | |
| 2:30 — Chaos Mode | Random fault injected; UI shows graceful degradation | |
| 3:00 — Liquidation drill | Vigil executes; Lantern updates | |
| 3:30 — Reserves proof | User verifies inclusion via Lantern | |
| 4:00 — Kill Switch | One tap; batched-tx revoke confirmed | |
| 4:30 — Closing slide | Three asks delivered | |
| 5:00 — Q&A starts | | |

## Observed issues

| Issue | Severity | Action |
|---|---|---|
| | | |

## Outcome

- Total wall-clock: __:__
- Recovery wall-clock for injected fault: __ seconds
- Judge-noticeable issues: yes / no
- Pass / fail this run: __

## Backlog items uncovered

(Append to `MONTH_12_AUDIT.md` for fixing before final submission.)
