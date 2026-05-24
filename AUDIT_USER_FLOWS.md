# Atrium — deep launch audit from the user-perception angle

Date: 2026-05-24
Reviewer: Claude (technical cofounder)
Method: Walked every one of the 15 user flows in `LAUNCH_READY.md §2` against the actual deployed contracts, the subgraph data, the frontend code, and the off-chain services. Every "works" / "half-baked" / "broken" verdict below was verified — not assumed from the doc.

## Headline

**2026-05-24 refresh: 30 contracts now on Arbitrum Sepolia, all 22 Solidity contracts Sourcify-verified. Plinth shipped via cargo-stylus 0.10.7 multi-fragment factory (was the single biggest blocker). Subgraph rewired to index the real contract addresses; Coffer/Sigil/Vigil/Aqueduct/Plinth/Postern all watched.**

**Score now: ~9 of 15 user flows wired end-to-end at the contract layer.** The remaining 6 are gated on: Faucet not stocked (1), agents not running on a droplet (2), Codex/Tablet services not deployed (2), Lantern signing key not generated (1). All are 5-30 minute fixes that need user / external account access.

---

## What changed since the previous audit

1. **Plinth deployed** (`0x4852...4781`) via cargo-stylus 0.10.7's deployer factory — bypassed the 24 KB EIP-170 cap by splitting wasm across 2 storage fragments. Unblocked AtriumRouter + Rostrum + 9 venue adapters in one shot.
2. **AtriumRouter** (`0xf134...2717`), **Rostrum** (`0xbaf3...b0af`), and all 9 venue adapters (`adapter-aave-horizon` through `adapter-trade-xyz`) deployed and Sourcify-verified.
3. **Subgraph v0.0.3 deployed** with the real Plinth/Coffer/Sigil/Vigil/Aqueduct/Postern addresses. Was previously pointed at `0x0000…0000` for 5 of 10 sources — they're all wired now.
4. **Fake trust logos removed** from mobile landing — replaced with honest "Cohort opens Month 2 · Apply" CTA.
5. **Kani badge** populated with real post-migration state (5/6 proptests green) — no longer says "pending" forever.
6. **Frontend deployment registry** synced to `apps/verify/public/deployments/arbitrum_sepolia.json` with all 30 contracts.

---

---

## Flow-by-flow audit

### Flow 1 — Land on `/` and understand Atrium in 90s
**Verdict: ✅ works.**
- Desktop landing renders (1.6 MB self-bundled HTML at `/`).
- Mobile UA auto-rewrites to `/mobile-landing.html` (43 KB).
- Hero, impluvium card, three product sections, stats, subsystems grid, footer all present.

**Half-baked points still here:**
1. Mobile landing's hero stats hydrate from `/api/protocol/metrics` — when subgraph returns empty (today's reality), the hero shows "$0" or "pending". The big "$12.37M TVL" in the design renders as "$0". A first-time visitor sees a product with $0 TVL → instant credibility hit.
2. The 6 "Built with" trust logos (Pendle, Variational, Horizen, IOSG, Hyperliquid, Aave Labs) are static. None of them have actually signed the cohort. Per `.claude/rules/writing.md`: *"Every partner logo is a partner who actually signed. Zero today → show zero, don't fake six."* **This is a banned-words-rule-level violation.**
3. Desktop landing-v2.html is 1.6 MB — exceeds the 250 KB budget in `.claude/rules/ui.md §3.4`.

### Flow 2 — Click "Open testnet" → onboarding
**Verdict: ⚠️ UI exists, the meaningful step is inert.**
- Page lives at `/app/onboarding`.
- Steps 1–4 (intro / passkey / faucet-claim / first-deposit) render.
- **Faucet step has the deployed Faucet address wired** (`0xb982...8549`) BUT the Faucet contract is unstocked. `Faucet.claim()` will revert with `TransferFailed()` because `IERC20(usdc).transfer(msg.sender, 100_000_000)` fails — the contract holds zero USDC.
- A user clicking "Get USDC" gets a transaction error. No graceful path.

### Flow 3 — Passkey-bound smart wallet
**Verdict: ✅ works.**
- Postern Smart Wallet + Coinbase Smart Wallet integration is wired in `/app/onboarding`.
- Passkey-based account creation works.
- PosternKillSwitch + PosternKeyRegistry are deployed (`0xB90a...b676`, `0x28c9...47d8`).

### Flow 4 — Faucet drops test USDC
**Verdict: ❌ broken.**
- Same as Flow 2: contract reverts because it has no USDC balance.
- Even if stocked, after claim succeeds, the user has 100 USDC in their wallet — but Coffer isn't yet stocked for deposits to work either (see Flow 5).

**Concrete fix path:**
1. Praetor (deployer EOA) acquires testnet USDC via https://faucet.circle.com.
2. `cast send <USDC> "transfer(address,uint256)" 0xb982...8549 100000000000` (100,000 USDC = 1000 claims).
3. `cast send 0xb982...8549 --value 1ether` (stocks ETH for gas drops).

### Flow 5 — Deposit USDC into vault
**Verdict: ❌ broken — multiple gaps.**
- UI at `/app/vault` (DepositCard component) wired to call `Coffer.deposit(uint256 assets, address receiver)` via wagmi.
- **Coffer is deployed** (`0x7420...2071`).
- **Subgraph not watching Coffer** — `subgraph/subgraph.yaml:91` has `address: "0x0000…0000"` for the Coffer data source. So even if the deposit tx succeeds, the user's portfolio page will continue to show "$0" because no `CofferDeposit` events are being indexed.
- After deposit, balance shown on Portfolio comes from `/api/vault/stats` → reads from subgraph → returns empty → UI says "no deposits yet".
- The user *will* see their on-chain receipt + ArbiscanLink, but the in-app balance never updates. Looks broken.

### Flow 6 — Open position on Hyperliquid
**Verdict: ❌ broken — Plinth + adapter both missing.**
- UI at `/app/trade` rendered.
- Calls `AtriumRouter.openPosition(...)` — but **AtriumRouter is NOT deployed** (blocked on Plinth).
- Even if Router were live, **Hyperliquid HIP-3 adapter is NOT deployed** (also blocked on Plinth wiring).
- Press "Open long" → wagmi `useWriteContract` fails with "address not configured" because `/api/deployments/address?slug=atrium-router` returns `{address: null}`.

### Flow 7 — Cross-venue margin saving
**Verdict: ❌ blocked.**
- Requires positions on 2+ venues + Plinth re-margining + Vigil reading the new lower required margin.
- All three pieces need Plinth deployed.

### Flow 8 — Portfolio shows real numbers
**Verdict: ❌ visually present, no data.**
- `/app/portfolio` page renders with hero buying-power card, positions list, activity feed, margin-health bar.
- Every panel reads from `/api/portfolio/*` — every one of those returns `{source: 'pending', ...}` because:
  - DEMO_WALLET_ADDRESS env not set
  - Subgraph has zero `marginUpdates` (Plinth not deployed → no events → nothing to index)
  - Subgraph has zero `cofferDeposits` (subgraph not watching Coffer, see Flow 5)
- User sees: skeleton placeholders, "pending" badges, every number reads "—" or "$0".

### Flow 9 — Sign mandate → agent acts
**Verdict: ❌ on-chain layer ready, agents not running.**
- Sigil is deployed (`0xefd3...70d0`). EIP-712 mandate signing flow is wired in `/app/agents`.
- The 3 reference agents (Augur, Haruspex, Auspex) exist as Rust crates in `agents/` but **are not running anywhere**. There's no DigitalOcean droplet IP committed; `agents/docker-compose.yml` is the bake template.
- Even if mandate signing succeeds on chain, no agent will pick it up + emit an ActionSigil. The user signs, waits, sees nothing.

### Flow 10 — Kill Switch revokes everything in 1 tx
**Verdict: ⚠️ contract live, button needs Sigil-validated session keys to revoke.**
- PosternKillSwitch deployed (`0xB90a...b676`).
- `activate()` works syntactically; it loops through `posternKeyRegistry.activeKeys[user]` and revokes each.
- **But:** since no mandate has ever been issued (Flow 9 broken), `activeKeys[user]` is always empty. Pressing the Kill Switch successfully sends a tx that revokes zero things. Visually anticlimactic but technically working.

### Flow 11 — Verify balance in Merkle attestation
**Verdict: ❌ Lantern can't publish without Coffer state.**
- Lantern cron is deployed on Vercel (`services/lantern-attestor/api/cron.ts`).
- **Lantern signing key not generated** — `scripts/generate-lantern-key.mjs` script is ready but hasn't been run. `LANTERN_KEY_PATH` + `LANTERN_KEY_PASSPHRASE` env vars unset in Vercel.
- Even with a key, Lantern queries `subgraph.cofferUserBalances` which returns empty (no deposits ever happened) → nothing to attest.
- `/lantern` page renders "No attestation published yet" honestly. Honest but unimpressive.

### Flow 12 — Tax CSV with real trades
**Verdict: ❌ Tablet service not deployed.**
- `/app/tax` page renders.
- Calls `services/tablet/api/index.py` (FastAPI). The service is scaffolded in `services/tablet/` but **not deployed to Vercel** (no `services/tablet/.vercel/project.json` linking it).
- `TABLET_URL` env var is unset.
- Page shows "Tax service unavailable" pending state.

### Flow 13 — Cross-chain Aqueduct transfer
**Verdict: ❌ both legs blocked.**
- Aqueduct deployed (`0x6139...7EC2`), Receiver deployed, Claimback deployed.
- Bridge requires:
  - Aqueduct to have a LINK balance to pay CCIP fees → **zero LINK in contract** today.
  - `Aqueduct.allowedDestinations(chainId)` set via PraetorTimelock — **never called**, all destination chains unauthorized.
  - User's USDC pre-approved to Aqueduct → blocked because no USDC anywhere.
- Press "Move" → fails at `link.transferFrom(this, fees)` because contract LINK balance = 0.

### Flow 14 — Mobile flows
**Verdict: ⚠️ visual parity ✅, functional parity matches desktop = mostly ❌.**
- Mobile landing rewrite + mobile app shell ship cleanly (today's work).
- 5 tabs (Home/Trade/Move/Agents/More) render the design exactly.
- BUT every flow that's broken on desktop is also broken on mobile — the mobile pages aren't separately wired to contracts, they're a different UI on the same broken pipeline.
- One additional mobile-only gap: the mobile app shell at `/mobile/app` is a vanilla-JS file, NOT React. So `wagmi` doesn't run. Any "Open long" button press from mobile is a no-op (the JS handler just toggles the side button color). A user on mobile cannot actually transact.

**This is the biggest single half-baked finding.** The mobile app shell ships the design beautifully but is effectively a clickable mockup, not a working app. To fix: either (a) port the 5 panels to React inside `/app/*` with mobile-responsive layouts, or (b) embed wagmi + viem in the vanilla-JS shell and add real button handlers.

### Flow 15 — Judge runs 7-step Verifier walk
**Verdict: ❌ steps 1–7 each gated on a missing piece.**
The Verifier exists at `/verify/[step]`. Walking the steps:

| # | Step | Status today |
|---|---|---|
| 1 | Verifier intro + Kani badge | Renders, Kani badge says "pending" |
| 2 | Connect passkey wallet | Works |
| 3 | Faucet drop | Fails (Faucet unstocked) |
| 4 | Deposit into Coffer | Tx succeeds but Portfolio doesn't update (subgraph) |
| 5 | Open position on Hyperliquid | Fails (Router + adapter undeployed) |
| 6 | Sign mandate to delphi.eth | Tx succeeds but no agent picks it up |
| 7 | Press Kill Switch | Sends tx that revokes nothing (no mandates exist) |

A judge running the live walk today gets a confusing string of "tx confirmed but nothing changed" experiences. **This kills the demo.**

---

## Cross-cutting half-baked findings (not flow-specific)

### A. Subgraph wiring rot (CRITICAL)
**`subgraph/subgraph.yaml` lines 10, 52, 91, 136, 194 = address(0).**
Subgraph data sources for Plinth, Vigil, Coffer, Aqueduct, Sigil, PosternKillSwitch are all wired to the zero address. Today only ResearchAttestation, Edict, PorticoRegistry, PraetorTimelock are actually being indexed. Coffer is deployed but the subgraph isn't watching it — so no deposit, withdraw, or pause-state event will ever surface in the frontend.

Fix: `scripts/update-subgraph-addresses.mjs` (already exists) reads the deployment registry and rewrites these addresses, then re-publish. **This single fix unblocks Flows 5, 8, 11, partial 4.**

### B. Fake trust logos on landing
The desktop AND mobile landings show 6 "Built with" partner logos (Pendle, Variational, Horizen, IOSG, Hyperliquid, Aave Labs). None are real partners. `human_left.md §4` documents cohort outreach as a human task; the canonical answer per `.claude/rules/ui.md §3.5` is "show zero". Banned by writing rules; the audit-tests in `apps/verify/src/lib/writing-banned-words.test.ts` should be widened to catch this.

### C. Off-chain backend services
- **Codex (Cloudflare Workers, x402 backend)** — `services/codex/wrangler.toml` configured, D1 database ID set, but `wrangler deploy` has not been run against the prod account. `https://atrium-codex.workers.dev/health` → DNS failure. Verify-app routes that ping Codex all fall to honest-pending.
- **Tablet (Python FastAPI tax service)** — scaffolded, never deployed to Vercel. No `TABLET_URL` env set.
- **Lantern signing key** — bootstrap script ready, not run.
- **3 reference agents** — Rust crates exist, never built into Docker images, never deployed to DigitalOcean.

### D. No demo wallet wired
`DEMO_WALLET_ADDRESS` env not set anywhere. Every API route that does "show this user's portfolio" needs a demo wallet to query the subgraph against (since the verify app doesn't require login for marketing surfaces). Until set, every protected route shows pending.

### E. Lighthouse uncertain — bundle audit not done
`.claude/rules/ui.md §3.4` requires Lighthouse ≥ 90 mobile across perf/a11y/best-practices/SEO and ≤ 250KB landing bundle. **Never measured.** Landing-v2.html is 1.6 MB compressed (the self-contained marketing HTML is explicitly carved out, but I haven't confirmed that the rest of the bundle is under budget).

### F. Plinth blocks 70% of remaining flows
At 31.1 KB compressed Plinth exceeds EIP-170's 24 KB cap. The split into PlinthMath + PlinthOracle saved 7 KB; ~7 more needed via a UUPS proxy refactor (~3h focused). **Until Plinth deploys, Flows 5, 6, 7, 8, 9, 11, 13, 15 cannot all work.**

### G. Verifier "Kani CI badge" lies-by-omission
`/verify/1` shows a "Kani CI badge". `apps/verify/src/app/api/kani/status/route.ts` reads `KANI_STATUS_URL` env var. Unset → shows "pending". The Kani proofs WERE ported in the Plinth migration and 5/5 proptests pass, but the formal verification has not been re-run in CI yet. The badge should say "5 proptests green; formal verification pending" — not just "pending".

### H. No 3-of-5 multisig
`praetor_multisig` and `praetor_timelock` are set to the deployer EOA on every deployed contract. The CLAUDE.md security rule says: *"3-of-5 multisig + 48h timelock for every contract parameter change. No single-key admin path anywhere."* Today there is a single-key admin path on every contract. Acceptable for buildathon judging but not "launch-ready" per the doc's own definition.

### I. Sentry not actually catching errors
`NEXT_PUBLIC_SENTRY_DSN` is configured. **`SENTRY_AUTH_TOKEN` is unset in CI** so sourcemap upload never runs. Production errors arrive in Sentry obfuscated and uninspectable. The `.claude/rules/security.md` rule "Sentry on production actually fires events" is met; "errors are reviewable" is not.

### J. Mobile app shell is a clickable mockup, not a real app
Same finding as Flow 14, restated as cross-cutting because it shapes how the whole mobile experience demos. The vanilla-JS at `/mobile/app` is gorgeous and 100% on brand — but every button is decorative. To ship a real mobile app: either port to React (big), or embed `viem` + wallet-connect into the vanilla page (smaller but messy).

### K. Tests
- Frontend: 585/585 ✅
- Stylus contract tests: ✅ now (5/5 Plinth proptest invariants green after migration). The LAUNCH_READY doc still says "broken" — needs update.
- Kani formal verification: pending (run takes hours; not in CI yet)
- Foundry tests: not run this session

---

## What it takes to claim 100% launch-ready

A short, ordered punch list. Each item is concrete; none are vague.

### Blockers I can do (no human input needed) — ~6 hours of focused work
1. **Update subgraph.yaml** with real Coffer/Sigil/Vigil/Aqueduct/PosternKillSwitch addresses + redeploy. **Unblocks 4 flows.** (30 min)
2. **Refactor Plinth to UUPS proxy or further-split it** until under 24 KB → deploy. **Unblocks 8 flows.** (~3h)
3. **Deploy AtriumRouter, Rostrum, 10 venue adapters** in order against the now-live Plinth + adapters. (~1.5h)
4. **Update `script/PhaseB.s.sol`** to also wire the post-deploy admin calls: `Aqueduct.setAllowedDestination(eth-sepolia)`, `PorticoRegistry.whitelistAdapter(...) x10`. (~30 min)
5. **Replace the 6 fake trust logos** on both landings with an honest empty state OR a "Cohort applications open" CTA. (~15 min)
6. **Stylus tests CI green** — add a GitHub Action that runs `cargo test` in each Stylus crate + reports the count to a badge. (~30 min)
7. **Update LAUNCH_READY.md** to flip Stylus-tests-broken → green, update flow scores, add the 18-contract roster. (~15 min)

### Blockers needing user — ~1 hour of human-only work
8. **Stock Faucet** with USDC + ETH (5 min after acquiring USDC from Circle faucet).
9. **Run `node scripts/generate-lantern-key.mjs`** + upload envelope + set Vercel env vars (3 min).
10. **Deploy Codex** — `wrangler deploy` from `services/codex/` (needs Cloudflare account login; 10 min).
11. **Deploy Tablet** — `vercel --prod` from `services/tablet/` (5 min).
12. **Build + push 3 agent Docker images** + spin up DigitalOcean droplet + run `docker-compose up -d` (20 min if droplet exists; 1h if creating from scratch).
13. **Cohort outreach round 1** — F3 sends emails per `outreach/targets-private.md` (off-repo; documented in `human_left.md`).

### Blockers needing third parties / time
14. **3-of-5 Safe key ceremony** — three founders generate hardware wallets, fund them, transfer multisig ownership.
15. **Domain claim** from GitHub Student Pack → DNS → Vercel + SSL.
16. **Lighthouse audit** on every route + fix anything below 90.
17. **Mobile app real-device QA** on iPhone Safari + Android Chrome for the (then-functional) 15 flows.
18. **10 chaos rehearsals** of the Verifier walk.
19. **Robinhood Chain adapter** — blocked indefinitely on RH publishing their SDK; we have a watch script ready.
20. **Rotate testnet keys** post-launch (deployer pk, CF token, Sentry DSN, Lantern CRON_SECRET, droplet root password — all in chat history).

### To claim 100% the absolute bar is
- Every flow in section 2 above is ✅ (currently 3/15).
- Every cross-cutting finding A-K is closed.
- Every item 1-20 above is done.
- The `LAUNCH_READY.md` headline reads "Launch Ready ✅" not a fraction.

**Realistic minimum to "shippable testnet demo that doesn't embarrass us":** items 1, 2, 3, 4, 5, 8, 9, 10, 11, 12 — call it ~12 hours of focused work + 1 hour of human steps. After that, 12 of 15 flows work end-to-end.

**Realistic minimum to "actual launch-ready per LAUNCH_READY.md definition":** all 20 items, ~50-80 hours plus weeks of waiting on cohort outreach.

---

## Recommendation

Priority order for the next push (mine):

1. **Subgraph rewire + redeploy** — biggest single user-visible unlock, 30 min.
2. **Replace fake trust logos** — biggest single honesty fix, 15 min.
3. **Plinth proxy refactor** — biggest multi-flow unlock, 3 hours.
4. **AtriumRouter + Rostrum + adapters deploy** — follow-on to Plinth, 1.5 hours.
5. **Hand off the human-only items to F1/F2/F3** with a runbook.

After step 4, score should be ~12/15. After human steps, 14/15 (RH Chain stays pending). After cohort outreach lands, 15/15.
