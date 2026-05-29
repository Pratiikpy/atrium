# New Relic Setup

Phase 12 observability — APM + RUM for all Atrium services.

## Prerequisites

- New Relic account (Student tier via GitHub Student Pack, see `runbooks/student-pack-setup.md`)
- Doppler access for env var management

## Steps

### 1. Activate New Relic

1. Go to [New Relic Student signup](https://newrelic.com/students) or activate via GitHub Student Pack.
2. Create an account under the `atrium-protocol` org.
3. Note the **License Key** (ingest key) from Account Settings → API Keys.

### 2. Create Application IDs

Create separate APM applications for:
- `atrium-verify` (Next.js frontend + API routes)
- `atrium-codex` (x402 API)
- `atrium-tablet` (tax service)
- `atrium-notifier` (notification daemon)
- `atrium-vigil-keeper` (liquidation daemon)
- `atrium-lantern-attestor` (proof-of-reserves cron)
- `atrium-agents` (reference agents)

Note each Application ID from the New Relic UI.

### 3. Add to Doppler

```bash
doppler secrets set NEW_RELIC_LICENSE_KEY="<key>"
doppler secrets set NEXT_PUBLIC_NEW_RELIC_LICENSE_KEY="<key>"
doppler secrets set NEXT_PUBLIC_NEW_RELIC_APP_ID="<verify-app-id>"
doppler secrets set NEW_RELIC_APP_NAME="atrium-verify"
```

Repeat for each service in its respective Doppler config.

### 4. Vercel Integration

Vercel reads from Doppler (wired in Phase 3). The browser agent loads via `apps/verify/src/lib/new-relic.ts` using `NEXT_PUBLIC_*` env vars. No additional Vercel config needed.

### 5. Daemon Install (DO Droplet)

For each daemon on the DigitalOcean droplet:

```bash
# In the service directory
npm install newrelic
```

Create `newrelic.js` at the service root:
```js
'use strict';
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: { level: 'info' },
  distributed_tracing: { enabled: true },
};
```

Add `-r newrelic` to the Node.js start command in `ecosystem.config.cjs`:
```js
script: 'node',
args: '-r newrelic --import tsx ./src/index.ts',
```

### 6. Import Dashboards

Import dashboard JSON files from `ops/new-relic/dashboards/` via NerdGraph:

```graphql
mutation {
  dashboardCreate(accountId: <ACCOUNT_ID>, dashboard: $dashboardJson) {
    entityResult { guid }
  }
}
```

Or copy-paste the NRQL queries into the New Relic UI manually.

### 7. Import Alerts

See `ops/new-relic/alerts.yml`. Create via NerdGraph mutations or manually in the Alerts UI.

### 8. Verify

1. Deploy verify-app to Vercel.
2. Visit `verify.atrium.fi`, accept analytics consent.
3. Check New Relic → Browser → atrium-verify for page views.
4. Check New Relic → APM → atrium-verify for server transactions.
5. Confirm dashboards show data within 5 minutes.
