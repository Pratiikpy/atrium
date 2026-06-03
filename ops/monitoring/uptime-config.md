# Uptime monitoring config

Better Stack free tier supports 10 monitors. Atrium uses 8 of them
for the public surfaces; 2 reserved for the cohort partner endpoints
once they sign on.

## Monitor list

| # | Name | URL | Interval | Region | Alert channel |
|---|---|---|---|---|---|
| 1 | verify.useatrium.me | https://verify.useatrium.me | 1 min | global | Discord `#alerts` |
| 2 | codex.useatrium.me | https://codex.useatrium.me/health | 1 min | global | Discord `#alerts` |
| 3 | useatrium.me | https://useatrium.me | 1 min | global | Discord `#alerts` |
| 4 | /api/protocol/metrics | https://verify.useatrium.me/api/protocol/metrics | 5 min | global | Discord `#alerts` |
| 5 | /api/lantern/latest | https://verify.useatrium.me/api/lantern/latest | 5 min | global | Discord `#alerts` |
| 6 | /api/deployments/status | https://verify.useatrium.me/api/deployments/status | 5 min | global | Discord `#alerts` |
| 7 | Arbitrum Sepolia RPC | https://arbitrum-sepolia.publicnode.com | 5 min | global | Discord `#warning` |
| 8 | Scribe (subgraph) | (Graph Studio query URL) | 5 min | global | Discord `#warning` |

## Setup

1. Founder creates Better Stack account (free tier) at https://uptime.betterstack.com
2. Add each monitor above with the URL + interval
3. Set status threshold: 30s response time max; HTTP 200 expected
4. Set Discord integration: paste the `#alerts` channel webhook URL
   in Better Stack integrations
5. Embed the public Better Stack status page in
   `apps/verify/src/app/sla/page.tsx`

## Discord channel structure

- `#alerts`  SEV-0 and SEV-1 incidents, all monitor downs
- `#warning`  flaky monitors (RPC + subgraph that have known transient
  failures), CI failures, Sentry issue volume spikes
- `#oncall`  on-call rotation handoffs, weekly check-ins

## Free-tier limits

- Better Stack: 10 monitors, 3-minute minimum interval on free tier.
  Atrium 1-minute monitors below need the paid tier ($25/mo) eventually
  but free tier covers Year-1 testnet.
- Sentry: 5K events per month free. At Codex's expected x402 traffic
  this is comfortable for Year-1.
- Discord webhooks: unlimited.
