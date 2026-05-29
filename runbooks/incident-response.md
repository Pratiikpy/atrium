# Incident Response Procedure

Phase 12 — general incident response for Atrium production.

Referenced from `SECURITY.md`.

## Severity Definitions

| Level | Definition | Examples | Response Time |
|-------|-----------|----------|---------------|
| P0 | Fund loss or unauthorized admin action | Exploit, key compromise, unauthorized pause | Immediate |
| P1 | Service down or data integrity issue | UI unreachable, incorrect balances shown | < 1 hour |
| P2 | Performance degradation | p95 > 5s, partial feature broken | < 24 hours |
| P3 | Cosmetic or non-blocking | Typo, minor UI glitch | Next sprint |

## Procedure

### 1. Triage

- Identify severity using definitions above
- Assign incident commander (on-call, see `runbooks/on-call-rotation.md`)
- Create incident channel in Discord: `#incident-YYYY-MM-DD-<slug>`

### 2. Communicate

| Severity | Internal | External |
|----------|----------|----------|
| P0 | Discord `#ops-alerts` + `#incident-*` | Twitter status update |
| P1 | Discord `#ops-alerts` + `#incident-*` | Twitter if >30min downtime |
| P2 | Discord `#ops-alerts` | None |
| P3 | GitHub issue | None |

### 3. Mitigate

**P0 — Fund safety:**
```bash
# Emergency pause via Praetor multisig
cast send $PRAETOR_TIMELOCK "pause()" --private-key $MULTISIG_KEY_1
# Requires 2/3 multisig confirmation within 48h timelock
# For immediate action: use PosternKillSwitch
cast send $POSTERN_KILL_SWITCH "revokeAll(address)" $COMPROMISED_ACCOUNT
```

**P1 — Service restoration:**
```bash
# Hotfix branch
git checkout -b hotfix/incident-YYYY-MM-DD
# Fix, test, push
git push -u origin hotfix/incident-YYYY-MM-DD
# Vercel auto-deploys preview; promote to production via Vercel UI
```

**P2/P3 — Ticket:**
- Create GitHub issue with `incident` label
- Link to incident channel
- Schedule for next sprint

### 4. Postmortem

Required for P0 and P1 within 48 hours.

Template: `incidents/YYYY-MM-DD-<slug>.md`

```markdown
# Incident: <title>

**Date:** YYYY-MM-DD
**Severity:** P0/P1
**Duration:** X hours
**Impact:** <what users experienced>

## Timeline

- HH:MM — Alert fired
- HH:MM — Incident commander assigned
- HH:MM — Root cause identified
- HH:MM — Mitigation applied
- HH:MM — Service restored

## Root Cause (5 Whys)

1. Why did X happen? Because Y.
2. Why did Y happen? Because Z.
...

## Action Items

- [ ] <action> — owner — due date
- [ ] <action> — owner — due date

## Lessons Learned

<what we'll do differently>
```

### 5. Follow-Up

- Action items tracked in `docs/plan-tracker.md`
- Postmortem published to `incidents/`
- Alert rules updated if detection was slow
- Runbooks updated if response was unclear
