# Incident runbook: Aqueduct CCIP delivery failure

Aqueduct is the cross-chain collateral bridge (Arbitrum Sepolia ⇄
Polygon Amoy via Chainlink CCIP). When CCIP messages stall, users see
either pending CrossChainCredit forever, or — worse — a double-spend
window per the claim-then-ack race (TDD §7.6).

## Severity

- **SEV-3** if a single message stalls < 12 hours
- **SEV-2** if multiple messages stall OR LinkBalanceLow event fires
- **SEV-1** if a double-spend is observed (a CCIP credit landed AFTER
  a successful claim-back for the same message_id)
- **SEV-0** if Aqueduct LINK balance hits zero on either chain (the
  bridge fully stops; new cross-chain collateral cannot move)

## Signals

- Subgraph `AqueductPauseState.isPaused = true` (visible on /lantern)
- `LinkBalanceLow(balance, last_month_usage)` event fires when balance
  drops below 10× the rolling 30-day burn
- User reports: `send_collateral` tx succeeded on source but no credit
  on destination after 12 hours
- Sentry events tagged `service: aqueduct` (via the Codex `/venues`
  health-probe endpoint)

## Triage (20 min target)

1. CCIP Explorer (https://ccip.chain.link) — paste the `message_id`
   from the source-side `CrossChainCredit` event. Confirm whether the
   message is `committed`, `blessed`, or stuck at `pending`.
2. Check Aqueduct LINK balance on BOTH chains:
   `cast call $AQUEDUCT_ADDR "linkBalance()(uint256)"`
3. Check `seen_messages` map on the destination Aqueduct for the
   message_id; if true, the delivery already happened — UI is stale.
4. Check `ExpiresAtTooSoon` patterns: a user trying to claim-back
   before the minimum-window has elapsed.

## Mitigations

| Symptom | Fix | Rollback safe? |
|---|---|---|
| LINK low | Praetor multisig transfers LINK from treasury reserve | yes |
| CCIP message stuck > 24h | Open CCIP support ticket; advise user to wait or claim-back after `expires_at` | yes |
| Replay-guard misfire (false positive) | Investigate `seen_messages` state; root-cause in code; do NOT manually clear the mapping | yes |
| Double-spend window observed | Praetor multisig emergencyPause Aqueduct on BOTH chains immediately; quantify exposure | yes |
| Reorg-induced ack lost | Wait for finality + retry — handler is idempotent per the ack-registry fix (B-12) | yes |

## Resolution checklist

- [ ] All pending CCIP messages either delivered or claim-backed
- [ ] LINK balance > 10× last-month burn on both chains
- [ ] AqueductPauseState.isPaused = false (resume only after root cause
      confirmed)
- [ ] No double-spend events on chain
- [ ] Post-mortem in `/incidents/` mandatory for SEV ≤ 2

## Escalation contacts

- On-call contract owner per `runbooks/on-call-rotation.md`
- Chainlink CCIP support: https://chain.link/support
- Curator multisig (Praetor) for emergency-pause execution
