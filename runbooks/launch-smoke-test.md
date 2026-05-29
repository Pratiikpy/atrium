# Launch smoke test

Manual pre-launch checklist. Run through each item on the day of launch.

## Public routes — confirm 200 + valid metadata

| Route | Expected title | Expected status |
|-------|---------------|-----------------|
| `/` | Atrium · verify | 200 |
| `/app` | Atrium · App | 200 (redirects to /app/portfolio if authed) |
| `/brand` | Atrium · Brand | 200 |
| `/changelog` | Atrium · Changelog | 200 |
| `/docs` | Atrium · Docs | 200 |
| `/docs/honesty` | Atrium · Honest disclosures | 200 |
| `/docs/api` | Atrium · Codex API | 200 |
| `/team` | Atrium · Team | 200 |
| `/press` | Atrium · Press | 200 |
| `/security` | Atrium · Security | 200 |
| `/security/bounty` | Atrium · Bug bounty | 200 |
| `/security/hall-of-fame` | Atrium · Hall of fame | 200 |
| `/legal/terms` | Atrium · Terms | 200 |
| `/legal/privacy` | Atrium · Privacy | 200 |
| `/accessibility` | Atrium · Accessibility | 200 |
| `/manifesto` | Atrium · Manifesto | 200 |
| `/lantern` | Atrium · Lantern | 200 |
| `/chaos` | Atrium · Chaos Mode | 200 |
| `/sla` | Atrium · SLA | 200 |
| `/learn` | Atrium · Learn | 200 |
| `/benchmarks` | Atrium · Benchmarks | 200 |
| `/rostrum` | Atrium · Rostrum | 200 |

## Auth-protected routes — confirm 401 without session

| Route | Expected |
|-------|----------|
| `/api/settings` | 401 |
| `/api/notifications` | 401 |
| `/api/portfolio` | 401 |
| `/api/agents` | 401 |

## Wallet flow (Arbitrum Sepolia)

1. Connect wallet via WalletConnect or injected provider
2. Deposit USDC via faucet (confirm tx hash appears)
3. Open a position on any adapter (confirm Plinth margin calculation visible)
4. Verify Lantern attestation updates within 10 minutes
5. Trigger kill switch from /app/settings → confirm revocation tx

## Mobile flow

- [ ] iOS Safari: landing page renders, wallet connect works, app navigation smooth
- [ ] Android Chrome: same as above
- [ ] PWA install prompt appears on second visit
- [ ] Installed PWA opens in standalone mode

## Performance

- [ ] Lighthouse Performance ≥ 90 (mobile)
- [ ] Lighthouse Accessibility ≥ 90
- [ ] Lighthouse Best Practices ≥ 90
- [ ] Lighthouse SEO ≥ 90
- [ ] axe-core reports 0 critical/serious violations

## Infrastructure

- [ ] Status page (Upptime) reports all services green
- [ ] Lantern attestor last-publish < 10 minutes ago
- [ ] Vigil keeper heartbeat < 5 minutes ago
- [ ] Subgraph synced to latest block (< 30 seconds behind)
- [ ] Codex API responds to health check

## Security

- [ ] `/.well-known/security.txt` accessible and valid
- [ ] CSP headers present on all HTML responses
- [ ] No secrets in client-side bundle (check Network tab)
- [ ] Rate limiting active on `/api/faucet` (confirm 429 after threshold)

## Final sign-off

- [ ] All items above green
- [ ] Screenshot evidence saved to `.scratch/launch-smoke/`
- [ ] Team Slack/Discord confirmation posted
