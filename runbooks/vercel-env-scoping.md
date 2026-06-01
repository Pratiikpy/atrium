# Vercel Environment Variable Scoping

## Purpose

Prevent sensitive secrets from leaking into Vercel Preview deployments. Preview
deploys are accessible to anyone with the URL and run untrusted PR code.

## Action Required

In the Vercel project settings for `atrium-verify`, scope every sensitive
environment variable to **Production only**. Preview deploys should see dummy
placeholder values (or no value at all).

## Variables to scope to Production only

| Variable | Reason |
|---|---|
| `DEPLOYER_PRIVATE_KEY` | EOA with multisig privileges; leaked = protocol drain |
| `CHAOS_PRIVATE_KEY` | Can pause/unpause contracts |
| `KEEPER_PRIVATE_KEY` | Vigil keeper EOA; leaked = griefing liquidations |
| `ATRIUM_INTERNAL_KEY` | Service-to-service auth for Tablet, Notifier, Codex |
| `SUMSUB_WEBHOOK_SECRET` | KYC callback HMAC; leaked = forged verifications |
| `ATRIUM_SESSION_SECRET` | iron-session cookie encryption key |
| `UPSTASH_REDIS_REST_URL` | Rate-limit store; preview shouldn't share prod quota |
| `UPSTASH_REDIS_REST_TOKEN` | Auth token for the above |
| `DISCORD_OPS_WEBHOOK` | Ops alert channel; preview shouldn't spam it |

## Steps

1. Go to [Vercel Dashboard → atrium-verify → Settings → Environment Variables](https://vercel.com/dashboard)
2. For each variable listed above:
   - Click the variable row
   - Under "Environments", uncheck **Preview** and **Development**
   - Keep only **Production** checked
   - Save
3. For Preview deployments that need a value to avoid crashes, add a separate
   entry scoped to Preview with a dummy value:
   ```
   ATRIUM_SESSION_SECRET=preview-dummy-not-real-32chars!!
   UPSTASH_REDIS_REST_URL=https://placeholder.upstash.io
   UPSTASH_REDIS_REST_TOKEN=preview-dummy
   ```

## Verification

After scoping, trigger a Preview deploy from a PR branch and confirm:
- The app boots without crashing (dummy values don't cause unhandled errors)
- Auth routes return 503 or graceful errors (not real sessions)
- Chaos routes return 503 (no CHAOS_PRIVATE_KEY)
- Rate limiting falls back to in-memory (no Upstash connection)

## References

- Phase 3 security hardening spec
- `apps/verify/src/lib/rate-limit.ts`, graceful fallback when Upstash unavailable
- `apps/verify/src/lib/auth-session.ts`, requires ATRIUM_SESSION_SECRET
