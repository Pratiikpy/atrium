# Vercel Deployment Protection Migration

Toggle production from auth-walled to public when ready for testnet launch.

## Prerequisites (Phase 11 sign-off)

All must be true before toggling:
- [ ] All P0/P1 audit findings closed
- [ ] All 5 mobile flows tested on real devices
- [ ] Lighthouse score ≥ 90 (performance, accessibility, best practices, SEO)
- [ ] All backend health checks green (`/healthz` on codex, tablet)
- [ ] Upptime status page shows 100% for 24h

## Steps (Dashboard)

1. Open [Vercel Dashboard](https://vercel.com) → Project: `atrium-verify`.
2. **Settings → Deployment Protection**.
3. Change from "Standard Protection" to **"Only Preview Deployments"**.
4. Click **Save**.

## Steps (CLI alternative)

```bash
vercel project add atrium-verify --prod-only-protection
```

## Verification

1. Open `https://verify.atrium.fi` in an incognito/private browser window.
2. Page should load without any Vercel auth challenge.
3. Check all critical routes:
   - `/` (landing)
   - `/app` (main app)
   - `/app/trade` (trade flow)

## Rollback

If any issue is discovered post-toggle:

1. Settings → Deployment Protection → select **"Standard Protection"**.
2. Save immediately.
3. Investigate in `#ops-alerts`.

## Related

- `runbooks/vercel-env-scoping.md`, environment variable configuration
- `runbooks/dns-provisioning.md`, custom domain setup
