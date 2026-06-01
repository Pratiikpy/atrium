# BrowserStack Setup for Atrium E2E

## Overview

Atrium uses BrowserStack Automate with Playwright's CDP connector for cross-browser E2E testing. This supplements the local Chromium + mobile-safari projects.

## Prerequisites

- BrowserStack Automate plan (free tier: 100 min/month)
- `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` from [browserstack.com/accounts/settings](https://www.browserstack.com/accounts/settings)

## Local setup

```bash
export BROWSERSTACK_USERNAME=your_username
export BROWSERSTACK_ACCESS_KEY=your_key
pnpm --filter @atrium/verify test:e2e --project=browserstack
```

## CI setup (GitHub Actions)

Add secrets to the repository:

1. Go to Settings → Secrets and variables → Actions
2. Add `BROWSERSTACK_USERNAME` (repository secret)
3. Add `BROWSERSTACK_ACCESS_KEY` (repository secret)

The `e2e.yml` workflow automatically picks up the `browserstack` project when these secrets are present.

## Configuration

The BrowserStack project is defined in `apps/verify/playwright.config.ts`. It uses the CDP WebSocket endpoint with capabilities encoded in the URL query string.

Default capabilities:
- Browser: Chrome latest
- OS: Windows 11
- Project name: "Atrium Verify"
- Build: CI run ID or "local"

## LambdaTest (alternative)

If LambdaTest is preferred, replace the `wsEndpoint` with:

```
wss://cdp.lambdatest.com/playwright?capabilities=${encodeURIComponent(JSON.stringify({
  browserName: 'Chrome',
  browserVersion: 'latest',
  'LT:Options': {
    platform: 'Windows 11',
    user: process.env.LT_USERNAME,
    accessKey: process.env.LT_ACCESS_KEY,
    project: 'Atrium Verify',
  },
}))}
```

## Troubleshooting

| Issue | Fix |
|---|---|
| `wsEndpoint` timeout | Check BrowserStack status page; ensure credentials are valid |
| Tests pass locally but fail on BS | Add `{ timeout: 60_000 }` to assertions, network latency is higher |
| Missing browser | Update `browser_version` in config caps |

## Cost management

- Run BrowserStack project only on `main` merges or nightly, not on every PR
- Use `--project=chromium-desktop` for PR checks (free, local)
- BrowserStack free tier: 100 parallel minutes/month
