# Honeybadger Setup

Phase 12 observability, heartbeat monitoring for all Atrium daemons.

## Prerequisites

- Honeybadger account (Small plan via GitHub Student Pack, see `runbooks/student-pack-setup.md`)
- Doppler access

## Steps

### 1. Activate Honeybadger

1. Sign up at [honeybadger.io](https://www.honeybadger.io) or activate via Student Pack.
2. Create project `atrium-daemons`.

### 2. Create Heartbeat Check-Ins

Create a check-in for each daemon:

| Daemon | Expected Interval | Grace Period |
|--------|-------------------|--------------|
| `notifier` | 30 seconds | 60 seconds |
| `vigil-keeper` | 5 minutes | 10 minutes |
| `lantern-attestor` | 10 minutes | 20 minutes |

For each, note the check-in URL (format: `https://api.honeybadger.io/v1/check_in/<TOKEN>`).

### 3. Add to Doppler

The heartbeat helper uses a single env var with a `<NAME>` placeholder:

```bash
# Template URL, each daemon replaces <NAME> at runtime
doppler secrets set HONEYBADGER_HEARTBEAT_URL="https://api.honeybadger.io/v1/check_in/<TOKEN_FOR_NAME>"
```

Alternatively, use per-daemon URLs:
```bash
doppler secrets set HONEYBADGER_HEARTBEAT_URL_NOTIFIER="https://api.honeybadger.io/v1/check_in/<notifier-token>"
doppler secrets set HONEYBADGER_HEARTBEAT_URL_VIGIL="https://api.honeybadger.io/v1/check_in/<vigil-token>"
doppler secrets set HONEYBADGER_HEARTBEAT_URL_LANTERN="https://api.honeybadger.io/v1/check_in/<lantern-token>"
```

If using per-daemon URLs, update `heartbeat.ts` in each service to read the specific var.

### 4. Configure Miss Alerts

In Honeybadger UI → Check-Ins → each check-in:
- Alert if no ping received in **2× expected interval**
- Notification: Discord webhook (add in Honeybadger → Integrations → Webhook)

### 5. Verify

1. Start each daemon locally with the env var set.
2. Confirm pings appear in Honeybadger → Check-Ins within one interval.
3. Stop a daemon; confirm alert fires after grace period.
