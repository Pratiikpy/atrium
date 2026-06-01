# Discord Alerting Topology

Phase 12, consolidated alerting routes to `#ops-alerts`.

## Channel: `#ops-alerts`

All production alerts route to this single channel. Team members with on-call role have notifications enabled.

## Alert Sources

| Source | Trigger | Format |
|--------|---------|--------|
| Honeybadger | Missed heartbeat (daemon down) | Webhook embed |
| Sentry | Critical error rate-limited (>5 in 5min) | Sentry Discord bot |
| New Relic | Threshold breach (p95, error rate, lag) | Webhook embed |
| GitHub Actions | Workflow failure on `master` | GHA Discord webhook (Phase 3) |
| Subgraph cron | Block lag >200 for 30min | Custom webhook (Phase 4) |
| Vigil-keeper | Liquidation executed (informational) | Custom webhook |
| Lantern | Publish completed (informational) | Custom webhook |

## Example Payloads

### Honeybadger Missed Heartbeat
```json
{
  "content": "⚠️ **Honeybadger**: `notifier` missed heartbeat",
  "embeds": [{
    "title": "Check-In Missed: notifier",
    "description": "No ping received in 60s (expected every 30s)",
    "color": 16776960,
    "timestamp": "2026-05-28T14:00:00Z"
  }]
}
```

### New Relic Threshold Alert
```json
{
  "content": "🚨 **New Relic**: p95 latency > 3s for 10 min",
  "embeds": [{
    "title": "CRITICAL: p95 latency > 3s for 10 min",
    "description": "atrium-verify p95 response time exceeded 3s threshold",
    "color": 15158332,
    "fields": [
      { "name": "Current Value", "value": "4.2s", "inline": true },
      { "name": "Threshold", "value": "3s", "inline": true },
      { "name": "Duration", "value": "12 min", "inline": true }
    ]
  }]
}
```

### Sentry Critical Error
```json
{
  "content": "🐛 **Sentry**: New critical error in atrium-verify",
  "embeds": [{
    "title": "TypeError: Cannot read properties of undefined",
    "url": "https://atrium.sentry.io/issues/12345",
    "color": 15158332,
    "fields": [
      { "name": "Level", "value": "error", "inline": true },
      { "name": "Events", "value": "12", "inline": true }
    ]
  }]
}
```

### Subgraph Staleness
```json
{
  "content": "📊 **Scribe**: Block lag exceeded threshold",
  "embeds": [{
    "title": "Subgraph lag > 200 blocks for 30 min",
    "description": "Current lag: 247 blocks. Investigate indexer health.",
    "color": 16776960
  }]
}
```

### GHA Workflow Failure
```json
{
  "content": "❌ **GitHub Actions**: `ci.yml` failed on `master`",
  "embeds": [{
    "title": "CI Pipeline Failed",
    "url": "https://github.com/atrium-protocol/atrium/actions/runs/12345",
    "color": 15158332
  }]
}
```

## Informational (low-priority, no @mention)

### Vigil-Keeper Liquidation
```json
{
  "content": "⚡ Vigil-keeper executed liquidation for account `0x1a2b...`, margin ratio 0.92"
}
```

### Lantern Publish
```json
{
  "content": "✅ Lantern published attestation #142, 3 leaves, root `0xabc1...`"
}
```

## Routing Rules

- **P0/P1 alerts** (Honeybadger miss, NR critical, Sentry fatal): `@on-call` mention
- **Informational** (liquidations, publishes): no mention, logged for audit trail
- **Rate limiting**: Sentry limited to 1 alert per issue per 10 min; NR limited by condition duration
