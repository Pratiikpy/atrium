# Subgraph indexing follow-up — **ALL TIERS CLOSED 2026-05-19**

Started 2026-05-19 with the `scripts/check-event-indexing.mjs` CI gate surfacing 32 unindexed contract events. All three tiers closed within the same /loop session:

- **Tier 1** (5 ops-alert events) → unified `AlertEvent` entity
- **Tier 2** (6 defensive-observability events) → unified `SubsystemDiagnosticEvent` entity
- **Tier 3** (7 Rostrum copy-trade events) → 5 domain entities (`RostrumFollow`, `RostrumMirrorTrade`, `RostrumLeaderDeboost`, `RostrumAgentAction`, `RostrumReputation`)

Final gate state: **66 indexed + 35 ignored = 101 events accounted for; UNINDEXED: 0**.

This doc remains the audit trail of what was indexed and why, so the next person modifying a contract knows where to wire new events.

## Tier 1 — ops alerts (high signal, low effort) — **CLOSED 2026-05-19**

All 5 Tier-1 events now feed the unified `AlertEvent` entity. Verify-app ops timeline queries `alertEvents(orderBy: timestamp, orderDirection: desc, first: 50)` for the consolidated feed; PagerDuty / Discord webhooks can drive off the same source.

| Event | Status |
|---|---|
| `Plinth.OracleDisagreement` | ✅ indexed (AlertEvent kind: `oracle_disagreement`) |
| `Plinth.VigilQueueFailed` | ✅ indexed (AlertEvent kind: `vigil_queue_failed`) |
| `Aqueduct.LinkBalanceLow` | ✅ indexed (AlertEvent kind: `link_balance_low`) |
| `Coffer.UsdcPausedDetected` | ✅ indexed (AlertEvent kind: `usdc_paused`) |
| `PorticoRegistry.AdapterEmergencyDeregistered` | ✅ indexed (AlertEvent kind: `adapter_emergency_deregistered` — dual-write also lands in AdapterEvent for the per-venue timeline) |

**Design note on the dedup gap:** `Aqueduct.LinkBalanceLow` fires on every send while balance < threshold, not just on the threshold-crossing edge. The verify-app deduplicates client-side by collapsing alerts within the same hour. A future contract iteration could move the edge-only emit into Solidity, but that's a separate change; the current shape is operationally fine because the alert volume is naturally bounded by send frequency.

## Tier 2 — defensive observability (medium signal) — **CLOSED 2026-05-19**

All 6 Tier-2 events now feed the unified `SubsystemDiagnosticEvent` entity. Verify-app dashboards each query the slice they need (`kind`-filtered) without scanning per-contract entities.

| Event | Status |
|---|---|
| `Coffer.HaircutApplied` | ✅ indexed (kind: `haircut_applied`) |
| `Coffer.AdapterCapHit` | ✅ indexed (kind: `adapter_cap_hit`) |
| `Vigil.KeeperRewarded` | ✅ indexed (kind: `keeper_rewarded` + cumulative aggregate in Keeper.totalRewardsWei) |
| `Vigil.StaleJobRejected` | ✅ indexed (kind: `keeper_stale_job_rejected`) |
| `Sigil.SigilOpenNotionalDecremented` | ✅ indexed (kind: `sigil_open_notional_decremented`) |
| `PosternKillSwitch.SigilRevokeSkipped` | ✅ indexed (kind: `sigil_revoke_skipped`) — closes the partial-failure visibility gap |

## Tier 3 — Rostrum copy-trade — **CLOSED 2026-05-19**

The "Rostrum is Month-9 deferred" assumption from the earlier triage was wrong. Rostrum.sol is fully shipped; all 7 events emit from real code paths (verified via `grep -r 'emit FollowStarted'` etc.). The only gap was subgraph wiring. Added Rostrum data source + 5 domain entities + 7 handlers in one iteration.

| Event | Status |
|---|---|
| `FollowStarted` | ✅ creates / resets RostrumFollow (state: active) |
| `FollowEnded` | ✅ flips RostrumFollow state → ended with reason |
| `MirrorTradeFilled` | ✅ RostrumMirrorTrade (state: filled, followerNotionalSigned set) |
| `MirrorTradeFailed` | ✅ RostrumMirrorTrade (state: failed, reason set) |
| `LeaderDeboosted` | ✅ RostrumLeaderDeboost incident log |
| `ActionRecorded` | ✅ RostrumAgentAction per-agent log |
| `ReputationUpdated` | ✅ RostrumReputation with previous/current/delta tracked |

## Tier 4 — Postern + Agents detail panels — **OPEN**

These two entities are referenced by `/app/agents` panels (Session keys, Action log) which currently render an honest "indexing pending" state. Once added, the panels switch to live rows.

| Entity | Why | Used by |
|---|---|---|
| `PosternSessionKey` (active state + scope + expiry, lifecycle events) | Postern ERC-7715 session keys need per-key visibility for revoke flows; the existing `agents/summary.activeSessionKeys` field stays null until this lands. | `apps/verify/src/components/agents/session-keys-panel.tsx`, agents/summary aggregate |
| `AgentAction` (per-action row: agent, owner, kind, venue, instrument, size, outcome, tx, timestamp) | Today Scribe only has `Agent.totalActionsCount` (aggregate). The action-log tab cannot render a meaningful timeline without per-action rows. | `apps/verify/src/components/agents/action-log-panel.tsx`, future `/api/agents/actions` route |

Once both ship, the verify-app gets:
- `/api/agents/session-keys` route — `{ keys: SessionKey[], source: 'scribe' }`
- `/api/agents/actions` route — `{ actions: AgentAction[], source: 'scribe' }`
- Removes the two "indexing pending" honest-empty panels from the agents view.

## When a new contract event lands

1. Add a handler to `subgraph/src/<contract>.ts` (mirror existing handlers in the same file).
2. If a new entity is needed, add it to `subgraph/schema.graphql`.
3. Add the `event:` line under the matching data source in `subgraph/subgraph.yaml`.
4. Run `node scripts/check-event-indexing.mjs` — exit 0 means it's done.

If the event genuinely should NOT be indexed (admin action duplicated by `PraetorTimelock.Executed`, destination-chain event needing a separate subgraph, pure-math sentinel), add an entry to `INDEXING_IGNORE` in `scripts/check-event-indexing.mjs` with a one-line reason.

## How NOT to close an item

Do not add events to `INDEXING_IGNORE` without a real reason. The allow-list is the audit surface for the next reviewer; treating it as a snooze button defeats the gate.
