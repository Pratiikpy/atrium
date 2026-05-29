# Founder runbook — the steps only you can run

Everything in this file needs a key, an account, or money — so it can't be
done from the code agent. Each step is copy-pasteable. Written 2026-05-29
after the full-angle readiness audit.

The code for all three is already correct and committed; these are the
broadcast / account actions that finish the job.

---

## 1. Make trading work — execute the corrected timelock batch

**Why:** `openPosition()` reverts `UnauthorizedCaller` today. The Router is
not yet on Coffer's approved-orchestrator list, and the venue adapters have
not authorized the Router. The batch that fixes this was scheduled once with
a wrong `setAdapter` selector (would revert on execute), so it must be
re-scheduled with the corrected script, then executed after the 48h timelock.

The calldata bug is already fixed in `scripts/reschedule-phase-b3.mjs`
(commit 696af49): `Coffer.setAdapter(AtriumRouter, true, cap)` with the
correct 3-arg selector `0x4de27bea`, approving the Router exactly once.

**Run it (needs the deployer/praetor key):**

```bash
# Key lives encrypted at $ATRIUM_KEYDIR (default C:/Users/prate/.atrium).
# The script decrypts lantern-key-deployer.json with lantern-passphrase.txt.
cd "C:/Users/prate/Downloads/arb builder"

# Step 1 — schedule the corrected 23-action batch on-chain.
node scripts/reschedule-phase-b3.mjs
#   writes .forge-cache/phase-b3-schedule-corrected.json with real tx hashes.

# Step 2 — wait 48h (the PraetorTimelock delay). The script prints the
#   earliest-executable timestamp.

# Step 3 — execute every scheduled job after the window:
node scripts/execute-phase-b3.mjs        # if present; else use the Foundry
#   path below for the Coffer.setAdapter job specifically:
forge script script/SetCofferAdapterExecute.s.sol --broadcast \
  --rpc-url "$ARBITRUM_SEPOLIA_RPC"
```

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

## 2. Get SCRIBE_URL — deploy the subgraph to Graph Studio

**Why:** `SCRIBE_URL` is pinned to a frozen old subgraph (v0.0.3), so live
metrics (TVL, agents, queries) never show current data. We currently render
honest "not indexed yet" empty states. To light them up, publish the current
subgraph and give me the query URL.

**Steps:**

1. Go to https://thegraph.com/studio/ and sign in with your wallet.
2. Click **Create a Subgraph**, name it `atrium-sepolia`. Studio shows you a
   **deploy key**.
3. Build + publish from the repo:
   ```bash
   cd "C:/Users/prate/Downloads/arb builder"
   pnpm subgraph:build
   # authenticate once with the deploy key Studio gave you:
   pnpm --filter @atrium/subgraph exec graph auth <DEPLOY_KEY>
   pnpm subgraph:deploy        # deploys to your Studio subgraph
   ```
4. Studio shows a **Query URL** like
   `https://api.studio.thegraph.com/query/<id>/atrium-sepolia/<version>`.
   **Paste that URL to me** (or set it yourself as `SCRIBE_URL` in
   `apps/verify/.env.local` + the Vercel project env). The metric surfaces
   flip from "pending" to live automatically once it's set + indexed.

If you'd rather not deploy yet, do nothing — every metric stays honestly
"pending", which is correct.

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
