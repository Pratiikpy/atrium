# Incident runbook: Notifier service silent

The notifier fans out alerts from Scribe to Telegram / Discord / email /
custom-webhook channels per user preferences. When silent, on-chain
events still happen but users are not paged.

## Severity

- **SEV-3** if a single channel kind is down (e.g. Telegram only)
- **SEV-2** if the notifier service has not ticked in 10 minutes
- **SEV-1** if alerts for tier-1 events (`Plinth.pause`, `LiquidationTriggered`,
  `EmergencyPaused`) are missed entirely

## Signals

- Better Stack monitor on the notifier GHA workflow run history.
- Discord ops webhook fires on `if: failure()` of `.github/workflows/notifier-cron.yml`.
- Sentry events tagged `service: notifier`.
- User report: "I didn't get the alert about X."

## Triage (10 min target)

1. Open `.github/workflows/notifier-cron.yml` Actions tab, confirm the
   1-minute cron is firing. A halted cron means GHA throttled (rare;
   Atrium is well within free-tier minutes).
2. Inspect the latest tick log for: scribe-fetch errors, KV cursor
   stalls, `fetchPrefs` returning null (auth header missing).
3. Test the prefs API directly:
   `curl -H "Authorization: Bearer $ATRIUM_INTERNAL_KEY" "$PREFS_API_URL?user=0xYourWallet"`
4. Verify Vercel KV is reachable: `curl -H "Authorization: Bearer $ATRIUM_KV_REST_TOKEN" $ATRIUM_KV_REST_URL/get/notifier:lastBlock`.

## Mitigations

| Symptom | Fix | Rollback safe? |
|---|---|---|
| Cron not firing | Re-enable workflow in GitHub Actions; trigger `workflow_dispatch` once | yes |
| `fetchPrefs` 401s | Confirm `ATRIUM_INTERNAL_KEY` matches between notifier + verify-app deploys | yes |
| KV cursor frozen | Manually reset: `SET notifier:lastBlock <recent-block>` via Upstash UI | yes |
| Telegram bot blocked | Rotate `TELEGRAM_BOT_TOKEN`; users re-`/start` the bot | yes |
| Resend rate limit | Drop email cadence to once-per-event-class; document in the internal ops log | yes |
| Scribe down | Wait, notifier resumes on next tick once Scribe returns | yes |

## Resolution checklist

- [ ] Notifier tick log shows successful event ingestion
- [ ] Test alert (force-trigger a non-prod event) reaches every wired channel
- [ ] Sentry events stop firing
- [ ] Better Stack monitor returns to green
- [ ] Post-mortem in `/incidents/` if SEV ≤ 2

## Escalation contacts

- On-call frontend (notifier service owner) per `runbooks/on-call-rotation.md`
- Vercel KV support if KV REST API returns 5xx
- Telegram / Discord / Resend support per the failing channel
