# Sentry Integrations

Phase 12, Discord + Slack webhook setup for Sentry critical error alerts.

## Discord Integration

Sentry doesn't support config-as-code for integrations. Manual setup required.

### Steps

1. **Create Discord webhook** in `#ops-alerts` channel:
   - Server Settings → Integrations → Webhooks → New Webhook
   - Name: `Sentry Alerts`
   - Copy webhook URL

2. **Configure in Sentry**:
   - Go to Settings → Integrations → Discord (or Webhooks)
   - If using native Discord integration: connect the bot, select `#ops-alerts`
   - If using generic webhook:
     - Settings → Integrations → Internal Integrations → Create
     - Add Alert Rule Action: "Send notification via webhook"
     - URL: the Discord webhook URL
     - Payload format: Discord-compatible embed

3. **Create Alert Rule**:
   - Alerts → Create Alert Rule
   - Conditions:
     - Event frequency: >5 events in 5 minutes
     - OR: First seen issue
   - Filter: `level:error OR level:fatal`
   - Action: Send to Discord webhook
   - Rate limit: 1 notification per 10 minutes per issue

### Payload Format (for generic webhook)

```json
{
  "content": "🚨 Sentry Alert",
  "embeds": [{
    "title": "{{title}}",
    "url": "{{link}}",
    "color": 15158332,
    "fields": [
      { "name": "Project", "value": "{{project}}", "inline": true },
      { "name": "Level", "value": "{{level}}", "inline": true },
      { "name": "Times Seen", "value": "{{times_seen}}", "inline": true }
    ]
  }]
}
```

## Slack Integration (Optional)

If the team uses Slack alongside Discord:

1. Install Sentry Slack app from Sentry → Integrations → Slack
2. Select workspace and channel
3. Configure alert rules to also notify Slack for P0/P1 issues

## Maintenance

- Review alert rules quarterly
- Ensure webhook URLs remain valid after Discord channel restructuring
- Test by triggering a manual error: `Sentry.captureException(new Error('test-alert'))`
