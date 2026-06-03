# On-call rotation

Three founders rotate weekly. Pager goes through Discord `@oncall`
mention (Year-1 free tier; PagerDuty free tier at 5 users is the
Year-2 upgrade path).

## Rotation schedule

| Week starting | Primary | Secondary | Tertiary |
|---|---|---|---|
| 2026-W22 (May 25) | F1 | F2 | F3 |
| 2026-W23 (Jun 01) | F2 | F3 | F1 |
| 2026-W24 (Jun 08) | F3 | F1 | F2 |
| 2026-W25 (Jun 15) | F1 | F2 | F3 |

Rotate weekly on Monday at 00:00 UTC. Buildathon week (2026-W23) F3
covers demo rehearsals; F1 covers infra; F2 covers comms.

## Page sources

- **Better Stack uptime**  any monitor red for 60 seconds
- **Sentry**  any unresolved issue spike (more than 10 events in 5 min)
- **Discord `#alerts` channel**  user-reported issue with screenshot
- **GitHub Actions failure on main**  CI workflow red on push

## Response SLAs

| Severity | Acknowledge | First update | Resolved |
|---|---|---|---|
| SEV-0 (funds at risk OR false claim shipped) | 5 min | 15 min | 1 h |
| SEV-1 (core flow down) | 15 min | 30 min | 4 h |
| SEV-2 (degraded) | 1 h | 4 h | 24 h |
| SEV-3 (cosmetic) | next business day | next business day | next sprint |

## During an incident

1. Acknowledge in Discord `#alerts` with the incident ID + SEV.
2. Pull the relevant runbook from `runbooks/incident-*.md`.
3. Status update every 30 min until resolution.
4. After resolution: file `/incidents/<date>-<slug>.md` within 7 days.
5. Add regression test or alert tuning before closing.

## Escalation

- If primary is unreachable for 15 min, secondary takes over
- If secondary is unreachable for 15 min, tertiary takes over
- All three unreachable: SEV-0 pause every contract via Praetor
  emergency-pause (instant, multisig-only). Resume after the rotation
  recovers.

## Founder contacts

- F1: f1@useatrium.me . Discord: @F1 . Phone: in 1Password
- F2: TBD per cohort founder lineup
- F3: TBD per cohort founder lineup

Phone numbers + emergency contacts live in the founder 1Password
vault, NOT in this repo.
