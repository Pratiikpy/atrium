# Founder runbook — the steps only you can run

Everything in this file needs a key, an account, or money — so it can't be
done from the code agent. Each step is copy-pasteable. Written 2026-05-29
after the full-angle readiness audit.

The code for all three is already correct and committed; these are the
broadcast / account actions that finish the job.

---

## 1. Make trading work — execute the corrected timelock batch

**Status: SCHEDULED 2026-05-29. Execute on/after 2026-05-31T02:20:26Z.**

The corrected 24-action batch is scheduled on-chain (Coffer.setAdapter with the
right 3-arg selector `0x4de27bea` approving the Router once + 10 adapter
`setAuthorizedCaller(Router)` + 10 `PorticoRegistry.registerAdapter` + 3
Aqueduct wiring). Each action's real on-chain `block.timestamp` is recorded in
`.forge-cache/phase-b3-schedule-corrected.json` (the PraetorTimelock derives
its operation id from that timestamp, so execute needs it). The 48h timer is
running.

> Note: the deployer EOA is shared with the Lantern attestor cron, so a cron
> tick can bump the nonce mid-run. Both scripts now retry on `nonce too low`.
> A first attempt partially scheduled before the retry logic existed, leaving
> a handful of duplicate scheduled ops on-chain (different timestamps) — they
> are harmless (idempotent setters) and execute uses the authoritative JSON.

**Remaining step — run once the window opens (needs the deployer/praetor key):**

```bash
# Key lives encrypted at $ATRIUM_KEYDIR (default C:/Users/prate/.atrium).
cd "C:/Users/prate/Downloads/arb builder"
# On or after 2026-05-31T02:20:26Z — executes every scheduled action. Reads the
# schedule JSON, re-derives each timestamp from chain, skips already-executed,
# retries through nonce clashes. Safe to re-run.
node scripts/execute-phase-b3.mjs
```

(Ask the code agent to run this when the window opens, or run it yourself.)

**Verify it worked (read-only, do these after execute):**

```bash
CAST=C:/Users/prate/.foundry/bin/cast.exe
COFFER=0xD169554cAF920f1fbcFfBAFCff3068a84892b0D8
ROUTER=0xF134127Cc2762d3Ebc5645abA6c99cD5a8b82717

# Router must be an approved Coffer orchestrator:
"$CAST" call $COFFER "isAdapterApproved(address)(bool)" $ROUTER --rpc-url "$ARBITRUM_SEPOLIA_RPC"
#   expect: true

# Then open a 1-USDC test position end-to-end via /app/trade and confirm it
# does NOT revert UnauthorizedCaller.
```

**Do NOT** execute the OLD scheduled job from before the fix — its
`Coffer.setAdapter` calldata uses the wrong 2-arg selector `0x332f6465`
and will revert `CallFailed`. Re-running step 1 above schedules the
corrected job; ignore/let-expire the stale one.

---

## 2. Subgraph — DONE (deployed v0.0.7, 2026-05-29)

**Status: deployed + indexing.** The current subgraph (with the `Counter`
schema the routes read: `totalTvlWei`, `openPositionsCount`,
`activeAgentsCount`) was built on Linux (WSL, because the Windows graph-cli
optimizer crashes) and deployed to Graph Studio:

- Query URL: `https://api.studio.thegraph.com/query/1753863/atrium-arbitrum-sepolia/v0.0.7`
- Schema verified live (HTTP 200, no field errors, `hasIndexingErrors: false`).
- Still syncing from block ~270.4M toward chain head; metric tiles fill in
  from "pending" to real values as it catches up + as on-chain activity lands.

The committed defaults (`services/agents/vercel.json`, `services/codex/vercel.json`,
`services/codex/wrangler.toml`) + a local `apps/verify/.env.local` now pin the
explicit `/v0.0.7` URL. **Note on `version/latest`:** the Studio "latest" alias
still serves the OLD schema (it hadn't switched to v0.0.7 at deploy time), which
is why we pin the explicit version instead.

**Residual founder steps (one-time dashboard env sets):**

1. **verify app (Vercel):** set `NEXT_PUBLIC_SCRIBE_URL` =
   `https://api.studio.thegraph.com/query/1753863/atrium-arbitrum-sepolia/v0.0.7`
   in the project env, then redeploy. (Local dev already uses `.env.local`.)
2. **Codex worker:** the live worker still has the old `SCRIBE_URL` baked in.
   `cd services/codex && pnpm exec wrangler deploy` (after `wrangler login`)
   picks up the updated `wrangler.toml`. Only needed for Codex's `/v1` data
   routes; the agents' `/health` probe is unaffected.
3. **Tablet / Lantern (if their Vercel envs still point at an old version):**
   set their `SCRIBE_URL` to the same `/v0.0.7` URL.

When a future subgraph version ships, bump the `v0.0.x` label in those same
spots (or repoint to `version/latest` once Studio promotes the new version to
the latest alias).

---

## 3. Publish for the judges — flip Vercel public

**Why:** the Vercel deploy currently returns 403 (deployment protection /
auth wall). For a judge to use it, it must be reachable. You said: build
phase now, publish at demo time — so this is the demo-time checklist.

**Steps (at demo time):**

1. Vercel project → **Settings → Deployment Protection** → turn **off**
   (or set to "Only Preview Deployments").
2. Set project env var `ATRIUM_AUTH_HOST` to the public host you serve on
   (e.g. the `*.vercel.app` domain, or a real domain once acquired). This
   binds SIWE login to that host (commit d81bc13) so sign-in works on the
   live origin.
3. Confirm the live URL loads `/` and `/app` without a login wall, then run
   one end-to-end pass: connect wallet → deposit test USDC → open a position
   (requires step 1 above done first).

**Domain note:** `atrium.fi` is parked/for-sale, so don't point anything at
it until you own it. Until then the `*.vercel.app` URL is the canonical live
link — the README + judge runbook should use it (being cleaned up in the
honesty pass). You said the domain is a small, change-anytime thing — agreed,
it's purely a find-and-replace once you own one.

---

## 4. Reference agents' Codex feed — DONE (deployed + wired 2026-05-29)

**Status: live.** The Codex worker is already deployed on Cloudflare at
`https://atrium-codex.prtk8899.workers.dev` (D1 database bound, serving with
0 errors). `GET /health` returns `200 {"ok":true}`. `services/agents/vercel.json`
`CODEX_URL` is now set to that URL, so the 3 reference agents (Augur, Haruspex,
Auspex) read `codex.health=ok` each tick instead of skipping on a dead feed.

**One residual founder step:** if the **agents** Vercel project was deployed
before this change, set `CODEX_URL=https://atrium-codex.prtk8899.workers.dev`
in that project's dashboard (Settings → Environment Variables) and redeploy,
so the live cron picks it up. The committed `vercel.json` default is already
correct for any fresh deploy.

To push the latest Codex code (optional — the deployed version is serving
fine): `cd services/codex && pnpm exec wrangler deploy` after `wrangler login`.

**Heads-up — agents still log decisions, don't submit on-chain yet.** Even
with Codex live, Augur/Haruspex/Auspex currently log `would-act-on: <hash>`
rather than submitting a real `ActionSigil` through AtriumRouter. That last
mile (session-key signer per agent + real `openPosition` call) needs each
agent's own EOA key and on-chain testing, so it's deliberately left as a
documented honest scaffold rather than shipped untested. It's tracked in
`human_left.md`. The loop is honest end-to-end today (probe → pull mandates
→ decide → record); only the final on-chain submit is stubbed.
