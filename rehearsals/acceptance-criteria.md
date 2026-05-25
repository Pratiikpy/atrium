# Demo-day acceptance criteria

Per PRD §26.2. Atrium is judge-ready when ALL of these are true.
Anything red = do not submit; fix first.

## Hard gates

| # | Gate | How to verify | Owner |
|---|---|---|---|
| 1 | ≥ 9 of 10 rehearsals completed in ≤ 6 minutes wall-clock | Count entries in `dress-runs/` where Outcome = pass | F1 |
| 2 | All 5 documented faults exercised at least once across the 10 runs | Cross-check `rehearsals/dress-runs/*.md` fault column | F2 |
| 3 | No judge-facing surprise in any passing run | "Judge-noticeable issues: no" on every passing run | F1 |
| 4 | Loom backup uploaded + matches current contract state | Visit Loom URL → cross-check addresses against `deployments/arbitrum_sepolia.json` | F3 |
| 5 | Kani CI badge is green at submission time | `https://verify.atrium.fi/kani-status.json` returns `{ "status": "green" }` | Auto |
| 6 | Verifier mode all 7 steps walk end-to-end on real Sepolia | Manual click-through with a fresh wallet ≤ 15 minutes before demo | F1 |
| 7 | Demo wallet has ≥ 100 USDC + 0.05 ETH on Arbitrum Sepolia | `cast balance` against the demo wallet | F1 |
| 8 | Kill switch revokes every active Sigil mandate for the demo wallet in one tx | Manual: issue 2 mandates pre-demo, run kill-switch, check Scribe for revocation events | F3 |
| 9 | `verify.atrium.fi` resolves + serves the verifier page | `curl -fI https://verify.atrium.fi/verify/1` returns 200 | Auto |
| 10 | No `Co-authored-by: Claude` lines in any commit on master | `git log --grep="Co-authored-by: Claude"` returns 0 entries | Auto |

## Soft gates (improve if time permits)

- Lighthouse mobile ≥ 90 on `verify.atrium.fi/verify/1`
- Page time-to-interactive ≤ 1.5s on broadband (matches PRD §27 budget)
- All 7 Verifier steps render the Arbiscan tx link as a clickable anchor
- The Lantern dashboard shows a non-stale attestation (latest publish ≤ 130 min ago)
- The Scribe subgraph indexes the demo wallet's deposit + hedged-open + kill-switch within 30s

## Stop-ship triggers

If any of these happens during the final rehearsal, STOP — fix
before submission, even if it means missing the deadline:

- A demo tx reverts mid-rehearsal with no clear cause
- The Kani badge flips red
- The deployer EOA tries to sign a non-trivial tx (should be the
  chaos signer / agent signer / multisig)
- Chaos restore takes longer than the inject (asymmetry is the
  feature; if it's reversed there's a bug)
- A judge in a mock-judge rehearsal says "I don't understand what
  just happened" about any beat

## What "shipped" looks like

- `LAUNCH_READY.md` headline: `Demo-day ready · 2026-05-XX`
- `rehearsals/dress-runs/` contains 10 markdown logs
- `audits/2026-05-XX-rehearsal-summary.md` exists with median + p95
  wall-clocks + the slowest recovery time
- `tripwires/2026-05-XX-demo-shipped.md` exists if any acceptance
  criterion was knowingly missed (write the gap honestly per
  `.claude/rules/writing.md`)
- A QR card printed + carried by F3
- The Loom URL committed to public docs (`/loom-backup`)
