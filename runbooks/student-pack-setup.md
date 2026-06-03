# Runbook, GitHub Student Pack tool activation

Priority-ordered checklist for activating Student Pack tools.
Complete in order, later tools depend on earlier ones (Doppler stores all tokens).

---

## 1. Doppler (secrets management), FIRST

- **Activation URL:** https://education.github.com/pack → search "Doppler" → claim
- **What to grab:** Organization auth token + per-project service tokens
- **Setup:**
  1. Create org `atrium`
  2. Create 3 projects: `atrium-dev`, `atrium-staging`, `atrium-prod`
  3. Create 8 configs in each (verify-app, notifier, vigil-keeper, lantern-attestor, tablet, codex, agents, praetor-cli)
  4. Generate a CLI service token for local dev
  5. Generate a CI service token for GHA (store as `DOPPLER_TOKEN` repo secret)
- **Doppler config:** N/A (this IS Doppler)

---

## 2. Sentry (error tracking)

- **Activation URL:** https://education.github.com/pack → search "Sentry" → claim Student tier
- **What to grab:** DSN (already exists, verify Student tier quota bump: 50K errors/100K txns)
- **Setup:** Confirm org is on Student plan. Check DSN matches `apps/verify/sentry.client.config.ts`.
- **Doppler config:** `verify-app` → `SENTRY_DSN`

---

## 3. DigitalOcean ($200 credit)

- **Activation URL:** https://education.github.com/pack → search "DigitalOcean" → claim
- **What to grab:** API token (Personal Access Token with read+write)
- **Setup:** Create project `atrium`. Provision 1 droplet for daemon hosting (notifier + vigil-keeper + lantern-attestor).
- **Doppler config:** `praetor-cli` → `DO_API_TOKEN`

---

## 4. New Relic (APM + uptime)

- **Activation URL:** https://education.github.com/pack → search "New Relic" → claim Student ($300/mo equivalent)
- **What to grab:** License key (ingest key) + Account ID
- **Setup:** Create `atrium` account. Install browser agent snippet for verify-app. Configure APM for Node.js services.
- **Doppler config:** `verify-app` → `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_ACCOUNT_ID`

---

## 5. Honeybadger (cron monitoring)

- **Activation URL:** https://education.github.com/pack → search "Honeybadger" → claim Small plan (1 year)
- **What to grab:** API key + per-check-in tokens
- **Setup:** Create project `atrium`. Add check-ins for: notifier tick, lantern attestation, vigil-keeper sweep, agent cron.
- **Doppler config:** `notifier` → `HONEYBADGER_CHECKIN_NOTIFIER`; `lantern-attestor` → `HONEYBADGER_CHECKIN_LANTERN`; `vigil-keeper` → `HONEYBADGER_CHECKIN_KEEPER`; `agents` → `HONEYBADGER_CHECKIN_AGENTS`

---

## 6. SimpleAnalytics (privacy-friendly analytics)

- **Activation URL:** https://education.github.com/pack → search "SimpleAnalytics" → claim Starter (1 year)
- **What to grab:** Site script tag (no token needed, script is public)
- **Setup:** Add `<script src="https://scripts.simpleanalyticscdn.com/latest.js">` to verify-app layout. Configure custom domain if desired.
- **Doppler config:** N/A (public script, no secret)

---

## 7. Namecheap (domains + SSL)

- **Activation URL:** https://education.github.com/pack → search "Namecheap" → claim .me domain + PositiveSSL
- **What to grab:** Domain control panel access, SSL cert files
- **Setup:** Register `status.atrium.me` (or use existing `.fi`). Point A record to GitHub Pages IPs for Upptime. Install PositiveSSL on status subdomain.
- **Doppler config:** N/A (DNS, not a runtime secret)

---

## 8. BrowserStack (cross-browser testing)

- **Activation URL:** https://education.github.com/pack → search "BrowserStack" → claim (1 year)
- **What to grab:** Username + Access Key
- **Setup:** Add to GHA CI for Playwright cross-browser matrix.
- **Doppler config:** `verify-app` → `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY`

---

## 9. LambdaTest (mobile device testing)

- **Activation URL:** https://education.github.com/pack → search "LambdaTest" → claim (1 year)
- **What to grab:** Username + Access Key
- **Setup:** Configure for real iOS/Android device testing of 5 mobile flows.
- **Doppler config:** `verify-app` → `LAMBDATEST_USERNAME`, `LAMBDATEST_ACCESS_KEY`

---

## 10. DevCycle (feature flags)

- **Activation URL:** https://education.github.com/pack → search "DevCycle" → claim Starter (1 year)
- **What to grab:** SDK key (client-side) + server-side key
- **Setup:** Create project `atrium`. Add flags for gradual rollout (new mandates UI, chaos mode, etc.).
- **Doppler config:** `verify-app` → `NEXT_PUBLIC_DEVCYCLE_CLIENT_KEY`, `DEVCYCLE_SERVER_KEY`

---

## 11. AstraSecurity (WAF)

- **Activation URL:** https://education.github.com/pack → search "Astra" → claim (6 months)
- **What to grab:** Site key / integration token
- **Setup:** Point at `verify.useatrium.me` Vercel domain. Enable bot mitigation + malware scan.
- **Doppler config:** N/A (configured in Astra dashboard, not runtime)

---

## 12. 1Password (team vault)

- **Activation URL:** https://education.github.com/pack → search "1Password" → claim Team Developer (1 year)
- **What to grab:** Team invite link
- **Setup:** Create vault `atrium-tools`. Store non-secret team creds (dashboard logins, API console URLs). NOT for runtime secrets (those go in Doppler).
- **Doppler config:** N/A

---

## 13. Codecov (code coverage)

- **Activation URL:** Already wired. Verify private-repo access via Student Pack.
- **What to grab:** Upload token (may already be in GHA)
- **Setup:** Confirm all CI jobs upload coverage. Check token is in GHA repo secrets.
- **Doppler config:** N/A (GHA secret only)

---

## 14. CodeScene + DeepScan (code quality)

- **Activation URL:** https://education.github.com/pack → search "CodeScene" / "DeepScan" → claim
- **What to grab:** GitHub App installation (no token needed)
- **Setup:** Install GitHub Apps on the atrium repo. Configure PR checks.
- **Doppler config:** N/A (GitHub App, no runtime secret)

---

## 15. GitHub Copilot (AI pair programming)

- **Activation URL:** https://education.github.com/pack → Copilot Student → claim
- **What to grab:** N/A (IDE extension, no token)
- **Setup:** Enable in VS Code / JetBrains for all team members.
- **Doppler config:** N/A

---

## Completion criteria

- [ ] Every tool above is activated and accessible
- [ ] All runtime tokens stored in appropriate Doppler config
- [ ] Team members have 1Password vault access
- [ ] `doppler run -- make demo` works with no `.env` file on disk
