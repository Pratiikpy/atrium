# Demo rehearsals — Phase η.11

Closes task #380. Founder-only operational runbook: 10 dress rehearsals
of the 5-minute judge pitch with random fault injection.

## Why this is the founder's job, not code

A demo rehearsal is a meatspace activity. The objective is to time a
founder talking + clicking through a real testnet flow + recovering
from an injected fault, all in under 6 minutes. The agents can write
the script and the runbook (this document) but cannot rehearse the
delivery. The 10 runs are physical events.

## What the agents already did

- `rehearsals/dress-run-template.md` — record per-run timings + faults
- `rehearsals/judge-runbook.md` — the demo script, beat by beat
- `rehearsals/fault-injection-checklist.md` — which fault to inject
  per run + how to inject it + expected UI response
- `rehearsals/loom-recording-outline.md` — pre-recorded Loom backup
  for the case where `verify.atrium.fi` 404s on judge day
- `rehearsals/acceptance-criteria.md` — pass/fail bar per PRD §26.2

## What the founder still needs to do

1. Stage a fully-funded test wallet on Arbitrum Sepolia
2. Open `verify.atrium.fi/verify/1` in a clean browser
3. Run the demo script (`judge-runbook.md`) timed against a stopwatch
4. Have a non-driving teammate randomly inject one fault per run
5. Log each run in a fresh `dress-runs/<NN>-<date>.md` from the template
6. Repeat until 9 of 10 complete in ≤ 6 minutes with no judge-noticeable issue

## Where the artefacts live

```
rehearsals/
├── README.md                       ← this file
├── dress-run-template.md           ← per-run log template (existing)
├── judge-runbook.md                ← the demo script (new)
├── fault-injection-checklist.md    ← chaos catalog + inject method (new)
├── loom-recording-outline.md       ← backup video script (new)
├── acceptance-criteria.md          ← what passes per PRD §26.2 (new)
└── dress-runs/                     ← per-run logs, gitignored by default
    ├── 01-2026-05-26.md
    ├── 02-2026-05-26.md
    └── ...
```

## Output the demo day expects

By the time judges are watching, you should have:

- A `dress-runs/` folder with at least 9 passing runs
- A Loom recording matching the runbook (cued up + uploaded)
- `audits/2026-05-XX-rehearsal-summary.md` — one-pager: which faults you
  tested, the median wall-clock, the slowest recovery time, anything
  the runbook still papers over
- A QR code printed on a backup card pointing to the Loom

If any of those are missing on judge day, that's the failure mode
PRD §26.1 warns about. Don't ship without all four.
