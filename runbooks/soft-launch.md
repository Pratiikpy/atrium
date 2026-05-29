# Soft-Launch Runbook

Phase 12 — go-live procedure for Atrium beta.

## Pre-Flight Checklist

- [ ] `runbooks/launch-smoke-test.md` all green
- [ ] All daemons running on DO droplet (`pm2 status` shows online)
- [ ] Honeybadger heartbeats all green
- [ ] New Relic dashboards showing data
- [ ] Sentry receiving events (test with manual error)
- [ ] `status.atrium.fi` shows all services UP

## Launch Steps

### 1. Remove Deployment Protection

Per `runbooks/vercel-deployment-protection.md`:
- Vercel → Project Settings → Deployment Protection → Disable password
- Confirm `verify.atrium.fi` loads in incognito browser

### 2. Verify Production

- [ ] `verify.atrium.fi` loads, wallet connect works
- [ ] `/api/scribe/health` returns `{ blockLag: <number> }`
- [ ] `/api/portfolio/summary` returns data for test wallet
- [ ] `status.atrium.fi` shows all green

### 3. Beta Tester Recruitment

- Post in Discord `#announcements`: "Beta is live. 10 spots. DM for access."
- Direct-invite 10 testers from the waitlist
- Share `verify.atrium.fi/beta` link

### 4. Monitor (48h)

- Watch New Relic dashboard for:
  - p95 latency staying under 2s
  - Error rate under 0.5%
  - No Honeybadger misses
- Check Discord `#ops-alerts` for any firing alerts
- Review Sentry for new issue clusters

### 5. Soft Launch Announcement

After 48h stable:
- [ ] Tweet from `@AtriumProtocol`: "Atrium Verifier Mode is live on Arbitrum Sepolia. Try it: verify.atrium.fi"
- [ ] Discord `#announcements` post
- [ ] GitHub Release with link to CHANGELOG

### 6. Scale Check

If New Relic shows sustained load:
- Check DO droplet CPU/memory (`htop`)
- Scale daemon instances via PM2 if needed: `pm2 scale notifier 2`
- Consider Vercel Pro if edge function limits hit

## Incident Response (During Launch)

| Severity | Definition | Action |
|----------|-----------|--------|
| P0 | Fund loss / unauthorized admin action | Immediate kill-switch via Praetor multisig `pause()`. Post in Discord. |
| P1 | UI broken / data incorrect | Hotfix branch → immediate Vercel redeploy. |
| P2 | Performance regression | Investigate within 24h. Scale if needed. |
| P3 | Cosmetic / non-blocking | Ticket for next sprint. |

## Rollback

If critical issues found during soft launch:
1. Re-enable Vercel deployment protection (password gate)
2. Post in Discord: "Temporarily pausing beta access for maintenance"
3. Fix, re-test via smoke test, re-launch
