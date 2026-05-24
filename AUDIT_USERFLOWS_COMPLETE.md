# Atrium complete user-flow audit — 2026-05-24

Auditor G. Scope: every user-perceivable flow walked end-to-end against live `localhost:3461` (Next.js prod server), the deployed 30-contract registry on Arbitrum Sepolia, the React source tree, and the prior five audit reports. Method: probed all routes + every API endpoint; cross-referenced each break against `AUDIT_CONTRACTS.md` (A), `AUDIT_FRONTEND.md` (B), `AUDIT_BACKEND.md` (C), `AUDIT_ROADMAP.md` (D), `AUDIT_TESTS_SECURITY.md` (E); read the source for every step a user actually clicks.

---

## Headline

Atrium ships ~50 distinct user-visible flows. **5 truly work end-to-end** (the Hyperliquid orderbook for BTC/ETH/SOL on `/app/trade`, vault-TVL read on `/app/vault`, transfer-quote read on `/app/transfer`, the WebAuthn passkey ceremony at `/app/onboarding` step 2, and the route-rendering of every public page). **~12 work cosmetically** (page loads, real wagmi handler attached, honest pending state shown — but the upstream data or upstream contract that would make them complete is uninitialized or unfunded). **~33 are dead or visually-misleading** — chiefly because (a) Coffer/Sigil/Vigil were deployed but never had `initialize(...)` called, so every vault-touching, mandate-touching, or liquidation-touching tx will revert on chain, (b) the entire subgraph is correctly indexing-up-to-tip but every entity table is empty because no user has ever transacted, (c) every off-chain `SCRIBE_URL` env points at the stale `v0.0.3` subgraph that will never see new emissions even when they fire, and (d) the mobile UA gets a vanilla-JS clickable mockup served by middleware where every primary button is decorative.

**Top 3 brick-walls (blocking the Buildathon 6-min Verifier walk):**

1. **The three Stylus contracts were never initialized.** Coffer (`0x7420…2071`), Sigil (`0xefd3…70d0`), Vigil (`0x6771…522e`) all have `praetor_multisig = 0x0`, `asset = 0x0`, no admin set. Cite `AUDIT_CONTRACTS.md` C-1/C-2/C-3. Any user clicking Deposit on `/app/vault`, signing a mandate on `/app/agents`, or hitting Verifier step 1 sends a tx that lands but reverts at the contract layer. No frontend honest-pending state catches this because `/api/deployments/status?step=N` returns `ready:true` for all 7 steps — it only checks bytecode-exists, never `initialize`-was-called. So the UI's "Run step" button is enabled, the user presses it, the chain rejects with empty-revert, and the error toast says "tx reverted" with no named cause.

2. **Plinth's deployed address is a 99-byte stub.** AUDIT_TESTS_SECURITY confirms: every meaningful getter at `0x4852…4781` reverts. The multi-fragment activation in `LAUNCH_READY` line 78 either landed somewhere else or never completed. So even after Coffer is initialized, `Plinth.open_position` and `Plinth.update_margin` cannot return. Verifier steps 2, 3, 5 are all gated on this, but `/api/deployments/status?step=2` still answers `ready:true`.

3. **The Faucet is unfunded.** The route at `0x7f3a…2bbc` is deployed with 40 USDC and 0.04 ETH (8 claims) per the registry — but `/api/faucet/status` is hardcoded `{available:false, reason:"Faucet adapter pending Curator whitelist"}`. The route does not read the on-chain balance, so even after stocking the UI says "unavailable". On any first-time user flow the "Get USDC" button is greyed with a wrong reason, blocking every downstream Verifier step from the very first hop.

The architecture is sound. The contracts are deployed. The React app is honest. The pipeline is wired. **Nothing has been turned on.** Every gap is a 5-minute to 3-hour operational fix.

---

## Per-flow walk

For each flow: Entry · Steps · Today · Breaks at · User sees · Fix effort · Severity.

### Group A. Pre-onboarding (no wallet)

#### A.1 Land on `/` (desktop)
- **Entry:** `https://verify-xxx.vercel.app/` or `localhost:3461/` from any desktop UA.
- **Steps:** read hero, scroll Plinth / Aqueduct / Sigil sections, hit closing CTA.
- **Today:** middleware passes through; serves `apps/verify/public/landing-v2.html` — a 1,624,364-byte self-contained Vite bundle (`apps/verify/public/landing-v2.html`). Probed: `code=200 size=1624364`.
- **Breaks at:** the bundle hardcodes `PARTNERS = ["Pendle Labs", "Variational", "Horizen", "IOSG", "Robinhood Chain", "Hyperliquid", "Aave Labs", "Coinbase"]` (zero of these have signed) and a `useState(4.13)` "live TVL" ticker with `Math.random()` drift. Per AUDIT_FRONTEND C-1.
- **User sees:** a polished landing with eight fake partner logos and a "live TVL" number jittering around $4.13M. A judge inspecting the DOM catches the fakes immediately.
- **Fix:** ~3h to rewrite the bundle's `PARTNERS = []` + replace ticker with `fetch('/api/protocol/metrics')`; ~2d to rebuild as a real Next.js route reading Scribe.
- **Severity:** **CRITICAL** — direct violation of `.claude/rules/writing.md` "every number on screen is sourced" + "names come with consent". A 5-minute judge sniff test catches the lie.

#### A.2 Land on `/` (mobile UA)
- **Entry:** same URL, iPhone Safari / Android Chrome.
- **Steps:** scroll the page, tap CTAs.
- **Today:** `src/middleware.ts:24` regex catches `iPhone|Android|Mobile` and rewrites `/` to `/mobile-landing.html` (45,620 bytes). Probed: `code=200 size=45620`.
- **Breaks at:** per AUDIT_FRONTEND C-3: lines 893, 901-931, 958-988 of `apps/verify/public/mobile-landing.html` ship hardcoded `$12.37M`, `$1.25M`, `$892K`, `$401K`, `$320K`, `$483K`, `$186K`, `$12,374,820`, `$4.13M`, `3.0×`, `38.4%`. Only the top stats band hydrates from `/api/protocol/metrics`; per-venue impluvium + Plinth mock card + Aqueduct mock stay forever fake. Footer (lines 1148-1160) is 10 `href="#"` dead links.
- **User sees:** a polished mobile landing with the right brand voice but per-venue panels showing fake six-digit "TVL by venue" numbers next to real venue logos, and a footer that taps nowhere.
- **Fix:** ~2h to wire impluvium/Plinth/Aqueduct cards to `/api/protocol/metrics` + venue endpoints; ~5min to replace footer hrefs with `/app/portfolio` etc.
- **Severity:** **CRITICAL** — same trust hit as A.1 but on the surface 100% of mobile-first traffic sees.

#### A.3 Click "Open testnet ↗" from landing
- **Entry:** click the primary CTA on `/`.
- **Steps:** browser navigates to `/app/onboarding`.
- **Today:** route returns 200, React app renders. Onboarding component loads.
- **Breaks at:** doesn't, at this hop. Goes into B.1.
- **User sees:** clean transition to onboarding.
- **Fix:** none.
- **Severity:** OK.

#### A.4 Browse `/docs`
- **Entry:** click "Docs" from footer/header.
- **Today:** static page with GitHub links. Probed `code=200`.
- **Breaks at:** AUDIT_FRONTEND M-3: `apps/verify/src/app/docs/page.tsx:36-38` references `docs/LAUNCH_READINESS.md` but the file at repo root is `LAUNCH_READY.md` (different name). Two of the linked URLs 404 on the public GitHub repo.
- **User sees:** card grid; click-throughs to GitHub may 404.
- **Fix:** 5 min — fix URL strings.
- **Severity:** polish.

#### A.5 Browse `/security`
- **Today:** static page citing "Cross-cutting audit was run on 2026-05-18 by six parallel sub-agents." Probed 200.
- **Breaks at:** doesn't render-wise. Claim "Praetor 3-of-5 multisig + 48h timelock" implicitly contradicts the on-chain reality (`praetor_multisig = deployer EOA`, per AUDIT_TESTS_SECURITY).
- **User sees:** polished security page; honest-looking but contradicted by chain state.
- **Fix:** ~10 min — reword to "deployer EOA on testnet; 3-of-5 Safe before mainnet flip".
- **Severity:** **HIGH** — honesty rule violation per CLAUDE.md "no fake immutability".

#### A.6 Browse `/sla`
- **Today:** 307 redirect → `/lantern/sla`. Probed correctly. Static SLA bullets render.
- **Breaks at:** nothing render-side.
- **Fix:** none.
- **Severity:** OK.

#### A.7 Browse `/lantern`
- **Today:** real React page; `LanternDashboard` reads `/api/lantern/latest` which 404s with `{"exists":false}`. Page shows honest "No attestation published yet".
- **Breaks at:** the publisher cron exists, the key is set on Vercel (AUDIT_BACKEND probe `/api/cron → ok:true`), but every cron run sees zero Coffer balances → skips publish. So this page will never light up until a real deposit lands. And even then, Lantern's contract event lacks `ipfs_cid`, so `lantern/latest/route.ts:85` 404s with `missing_ipfs_cid` per AUDIT_BACKEND § "summary" row 6.
- **User sees:** honest empty state with the right reason text.
- **Fix:** ~30 min once Coffer has balance; needs contract event extension + redeploy for CID — ~1 day.
- **Severity:** **HIGH** for the Verifier walk step 6; honest in isolation.

#### A.8 Browse `/manifesto`, `/team`, `/learn`, `/brand`, `/legal/privacy`, `/legal/terms`
- **Today:** all 200, all static. Brand kit page has the `✗ Don't` example card with banned words (legitimate negative example).
- **Breaks at:** `/brand` is good; `/team` honors F1/F2/F3 codename treatment from `human_left.md`; `/learn`, `/manifesto`, `/legal/*` all clean.
- **User sees:** clean public surfaces.
- **Fix:** none.
- **Severity:** OK.

#### A.9 Read `/changelog`
- **Today:** static page. WAVES[] array hardcoded as mirror of `docs/AUDIT_FINDINGS.md`. Per AUDIT_FRONTEND M-4: last entry is "Wave N · 2026-05-18" — does not include 2026-05-24 work.
- **Breaks at:** content stale.
- **User sees:** changelog that says "last update 2026-05-18", suggests project hasn't shipped in a week (it has).
- **Fix:** ~15 min to regenerate from markdown; ~1h to wire build-time generation.
- **Severity:** polish.

#### A.10 Read `/benchmarks`
- **Today:** 200, static table comparing Cascade + August. Honest losses listed.
- **Breaks at:** nothing.
- **User sees:** strong page; cites real competitors.
- **Severity:** OK.

#### A.11 Read `/cohort`
- **Today:** 200; `CohortGrid` queries Scribe `cohortPartners`; `/api/cohort/partners` returns `{"partners":[],"source":"scribe"}`. Honest empty state ships.
- **Breaks at:** AUDIT_BACKEND finding D-2: there is **no event handler in the subgraph that writes a `CohortPartner` entity**. The schema entity exists; no code path populates it. So even when partners onboard, this page will stay empty until a Curator-side event + handler are added.
- **User sees:** empty grid with "Open to applications" CTA. Honest today; structurally cannot light up tomorrow.
- **Fix:** ~2h — add Curator-side event + subgraph handler + redeploy.
- **Severity:** **HIGH** for any partner-facing roadmap moment.

#### A.12 Click any partner / cohort partner card
- **Today:** `/cohort/[id]` returns 200 for IDs; renders all stats as `—` honestly.
- **Breaks at:** there are no partners, no IDs to click. Click-through on landing's fake "Built with" logos is a bare `href` (likely page-anchor). Cohort grid shows empty CTA, no cards to click.
- **User sees:** no cards to click → CTA points at `/cohort` apply path which is unbuilt.
- **Fix:** content-side, ~1h after partners exist.
- **Severity:** **MED** — primary action is "Apply" which goes nowhere.

---

### Group B. Onboarding (wallet creation)

#### B.1 `/app/onboarding` step 1 (Welcome)
- **Entry:** A.3 lands here.
- **Today:** renders, "Set up authenticator" / "Skip to app" buttons live.
- **Breaks at:** doesn't.
- **User sees:** clean welcome card.
- **Severity:** OK.

#### B.2 `/app/onboarding` step 2 (Authenticator / passkey)
- **Today:** real `navigator.credentials.create()` WebAuthn ceremony. On Chrome/Safari with passkey support, fingerprint prompt fires.
- **Breaks at:** browsers without WebAuthn get a disabled button with the real reason ("WebAuthn unavailable"). PosternKeyRegistry / PosternKillSwitch are deployed.
- **User sees:** real OS passkey prompt; on success advances to step 3.
- **Severity:** ✅ **WORKS**.

#### B.3 `/app/onboarding` step 3 (Faucet drop)
- **Today:** `/api/faucet/status` returns `{available:false, reason:"Faucet adapter pending Curator whitelist"}` — hardcoded; never reads on-chain balance.
- **Breaks at:** the route at `apps/verify/src/app/api/faucet/status/route.ts` does not read the Faucet contract's balance. AUDIT_BACKEND row 34 confirms: "Faucet contract IS in the registry (`deployments/arbitrum_sepolia.json:184`) but this route doesn't read it." The Faucet at `0x7f3a…2bbc` is stocked with 40 USDC + 0.04 ETH per the registry's `stockTxs` block. Yet the UI says it's not stocked, with the wrong reason ("Curator whitelist" — there is no Curator-whitelist gate on Faucet).
- **User sees:** disabled "Claim faucet" button with misleading reason. Click "Skip →" to move forward without test money.
- **Fix:** ~30 min — patch the route to read on-chain `Faucet.usdcBalance()` + `Faucet.canClaim(address)` and return live state.
- **Severity:** **CRITICAL** — first hop of every onboarding flow + Verifier step 1.

#### B.4 `/app/onboarding` step 4 (Margin posted)
- **Today:** card shows `pending` honestly. Step header reads "Plinth · source built · deploy Month 1 W2" per AUDIT_FRONTEND H-6 — stale text since Plinth IS deployed at `0x4852…4781`, but as a 99-byte stub per AUDIT_TESTS_SECURITY.
- **Breaks at:** copy is wrong (Plinth exists), but the runtime is also wrong (Plinth doesn't function). User effectively sees the right message, wrong reason.
- **User sees:** honest "pending" but with stale rationale.
- **Fix:** ~10 min copy fix; underlying Plinth redeploy ~3h.
- **Severity:** MED.

#### B.5 `/app/onboarding` step 5 (Done) + first-trade prompt
- **Today:** lands on `/app/trade` or `/app/portfolio`. Per AppShell sidebar, the user's wallet address shows as hardcoded `0x1a3b…7f29` (AUDIT_FRONTEND H-2 — confirmed at `app-shell.tsx:144`), not their real connected wallet.
- **Breaks at:** the sidebar address is a static prototype string, not `useAccount().address`. The user just connected a real passkey wallet 30 seconds ago and the sidebar shows someone else's address.
- **User sees:** "I'm signed in but the sidebar shows a different address."
- **Fix:** ~15 min — replace static placeholder with `useAccount()`-driven render + Connect prompt fallback.
- **Severity:** **HIGH** — immediate post-onboarding credibility hit.

#### B.6 Faucet contract drop (the actual claim if button were enabled)
- **Today:** if the route is patched + user clicks Claim, the tx hits `Faucet.claim()` at `0x7f3a…2bbc`. Faucet has balance (40 USDC). Drop succeeds.
- **Breaks at:** the next step (deposit into Coffer) is where the chain falls down.
- **User sees:** would see real USDC arrive in their wallet.
- **Fix:** route fix from B.3 unblocks this.
- **Severity:** dependent on B.3.

#### B.7 Deposit step — first time
- **Today:** `/app/vault` deposit card; wagmi `useVaultDeposit` calls `Coffer.deposit(uint256, address)` at `0x7420…2071`.
- **Breaks at:** **AUDIT_CONTRACTS C-1: Coffer was never initialized.** `cast call 0x7420…2071 "asset()(address)"` returns `0x0`. So `Coffer.deposit` will reach line 313 of `contracts/coffer/src/lib.rs` and call `IERC20(asset).transferFrom(...)` — `asset` is `0x0`, and `transferFrom` against the zero address reverts with empty data.
- **User sees:** wallet confirms two-step flow (approve USDC, then deposit). Approve lands (USDC contract works). Deposit tx is submitted, lands on chain, REVERTS. Error toast says "Transaction failed: transfer to/from the zero address" or just "execution reverted".
- **Fix:** AUDIT_CONTRACTS C-1 recommendation — write `script/PhaseB4-Initialize.s.sol` and call `Coffer.initialize(USDC, Plinth, deployer, PraetorTimelock, deposit_cap_wei, per_user_cap_wei)`. ~20 min.
- **Severity:** **CRITICAL** — every Verifier walk, every first-time user, every screenshot of "real deposit" requires this.

#### B.8 First-trade prompt
- **Today:** onboarding redirects to `/app/trade`. Risk Preview modal lives in source per design.
- **Breaks at:** entire trade flow (Group D) is gated on Plinth + Router + adapter chain — see D below.
- **User sees:** trade page renders; risk modal renders; submit fails.
- **Severity:** **CRITICAL** if user tries to trade; the Risk Preview UI itself is shipped.

---

### Group C. Portfolio + monitoring

#### C.1 `/app/portfolio`
- **Today:** every panel reads `/api/portfolio/*`. Probed live:
  - `/api/portfolio/buying-power → {currentUsd:null, series:[], source:"pending"}`
  - `/api/portfolio/positions → {positions:[], source:"pending"}`
  - `/api/portfolio/margin-health → {marginHealthBps:null, source:"pending"}`
  - `/api/portfolio/summary → {totalAccountValueUsd:null, ...source:"pending"}`
- **Breaks at:** three things: (a) `DEMO_WALLET_ADDRESS` env not set on Vercel (AUDIT_BACKEND finding 8, env-var inventory line); (b) `SCRIBE_URL` baked into env points at stale `v0.0.3` subgraph (AUDIT_BACKEND headline finding 1); (c) no user has ever deposited (zero `marginUpdate` entities even on `/version/latest` per AUDIT_BACKEND § "Entity counts").
- **User sees:** every stat reads `—` or `$0`; page is honest but contains no real data.
- **Fix:** ~15 min — set the env vars + redeploy. Underlying contract pipeline needs B.7 + D.* to actually fire.
- **Severity:** **HIGH** — Portfolio is the centerpiece of the product. Today it's a beautifully-built skeleton.

#### C.2 `/app/portfolio/activity`
- **Today:** 200; ActivityTimeline reads `/api/portfolio/activity` (wallet-gated). Same pending pattern.
- **Breaks at:** same three causes as C.1.
- **User sees:** empty timeline.
- **Severity:** HIGH (depends on C.1).

#### C.3 `/app/markets`
- **Today:** renders 6 venue cards (`apps/verify/src/app/app/markets/page.tsx:9-46`). Each card has a hardcoded `<span>live source</span>` pill at line 66, no API check (AUDIT_FRONTEND H-1).
- **Breaks at:** the 6-venue list is missing Synthetix V3, Morpho Blue, GMX V2 — all deployed (AUDIT_FRONTEND M-1). The "live source" pill lies on every card because no adapter has been whitelisted in PorticoRegistry yet (AUDIT_CONTRACTS C-6/C-8). And `/api/deployments/address?slug=adapter-gmx` returns `400 invalid_slug` — the slug allowlist in `apps/verify/src/app/api/deployments/address/route.ts` is missing gmx/morpho/synthetix entirely.
- **User sees:** 6 venue cards (missing 3); each says "live source" but none are live; "Add a venue" footer references a $5K ARB Curator grant that's blocked on the multisig.
- **Fix:** ~30 min to add 3 missing venues + remove or wire the pill + extend slug allowlist.
- **Severity:** **HIGH** — direct claim "live source" is false on every card.

#### C.4 `/app/notifications`
- **Today:** 200; reads `/api/notifications` → `{notifications:[], source:"pending"}`. Per AUDIT_FRONTEND H-3, not reachable from sidebar nav; only from the Bell icon on top bar.
- **Breaks at:** discoverability + empty data (no on-chain events fired).
- **User sees:** empty inbox.
- **Fix:** ~5 min to add sidebar entry.
- **Severity:** MED.

#### C.5 `/app/reserves`
- **Today:** real React; `VerifyMyBalanceButton` reads Lantern attestation, computes inclusion proof in-browser. `/api/reserves/summary` returns `{tvlUsd:null, isStale:true, staleReason:"no attestation indexed yet"}`. Honest.
- **Breaks at:** Lantern never published (A.7).
- **User sees:** honest "no attestation yet" panel.
- **Severity:** HIGH (gated on A.7).

#### C.6 `/app/settings`
- **Today:** 6 tabs. Only Wallet is live; 5 others render an identical "coming Month X" banner (AUDIT_FRONTEND M-9). `/api/settings/wallet → {address:"—", ens:null, authenticator:null, source:"pending"}`. `/api/settings/connected-sites → {sites:[], source:"pending"}`. `/api/settings/gas → {sponsored:null, cap:10, active:false, source:"pending"}`.
- **Breaks at:** Wallet tab shows `—` for address (same H-2 hardcoded placeholder issue; should read `useAccount().address`). Connected-sites uses a process-local Map that wipes on Vercel cold-start + has cross-tenant leakage per AUDIT_BACKEND row 50.
- **User sees:** Wallet tab missing real address; 5 tabs say the same "coming Month X" copy.
- **Fix:** ~15 min Wallet fix; ~3h connected-sites Postern-backed.
- **Severity:** MED.

#### C.7 `/app/tax`
- **Today:** `TaxView` renders; signed-Merkle disclaimer present. Probed: `/api/tax/summary → all null source:"pending"`, `/api/tax/events → {events:[], source:"pending"}`, `/api/tax/allowance → {usedUsd:null, remainingUsd:"$3,810", totalUsd:"$3,810"}`.
- **Breaks at:** **two API contract gaps with Tablet** per AUDIT_BACKEND finding 4 + 5:
  - Tablet `/summary` endpoint **does not exist** — verify route 404s through to honest `source:"pending"`.
  - Tablet `/events` endpoint **does not exist** — same.
  - Tablet `/export` exists but verify sends `format/jurisdiction/year`; Tablet wants `address/jurisdiction/tax_year_start/tax_year_end` — every export attempt 422s.
- **User sees:** "Tax service unavailable" honestly. Try to download → always fails.
- **Fix:** ~2h to add `/summary` + `/events` to Tablet OR align verify route to call only `/export` with correct args.
- **Severity:** **HIGH** for any user trying to use the tax feature; honest UI.

---

### Group D. Trading

#### D.1 `/app/trade` page render
- **Today:** 200; `TradeView` renders. Probed `/api/trade/orderbook` default symbol is `HSLA-PERP` which returns `source:"pending"`. With `?symbol=BTC` or `?symbol=ETH` returns LIVE Hyperliquid testnet orderbook (real bids/asks).
- **Breaks at:** the **default symbol the page loads with maps to a pending-only stream**. The Hyperliquid testnet API serves real depth for BTC/ETH/SOL but not for the equity-perp + rTSLA-style symbols the page seems to default to. So the orderbook panel appears empty on the very first paint.
- **User sees:** orderbook is empty even though the underlying data source works.
- **Fix:** ~5 min — change default symbol to ETH or BTC.
- **Severity:** MED — silently kills the most live data the app has.

#### D.2 Open long on Hyperliquid HIP-3
- **Today:** wagmi `useOpenPosition` → calls `AtriumRouter.openPosition(...)` at `0xf134…2717`.
- **Breaks at:** four-deep failure cascade:
  - **C-4 (contracts):** `AtriumRouter.adapter_pull(uint256,address,address)` snake-case selector doesn't match Coffer's camelCase export `adapterPull` — every Router-mediated open reverts.
  - **C-6:** `setAuthorizedCaller(Router, true)` never called on any of the 8 v1.1 adapters. Even if C-4 is fixed, adapter rejects Router calls.
  - **C-8:** `Coffer.setAdapter(Router, true, cap)` never scheduled in any PhaseB script. Coffer rejects Router as adapter.
  - **C-1:** Coffer never initialized; even with all above fixed, `Coffer.asset()` is `0x0`.
- **User sees:** wallet confirms, tx submitted, REVERTS with empty data. Error toast: "Transaction reverted".
- **Fix:** ~4h sequenced — redeploy Router with `adapterPull`, run PhaseB4-Initialize, PhaseB5-AuthorizeRouter, PhaseB6-CofferSetAdapter.
- **Severity:** **CRITICAL** — Verifier step 2 + the core product flow.

#### D.3-D.11 Open on Aave / Pendle / Curve / Trade.xyz / Polymarket / GMX / Synthetix / Morpho / HL-HIP4
- **Today:** same Router code path as D.2; same failure cascade.
- **Additional break per adapter:** every adapter's `venue` immutable is set to the deployer EOA (per AUDIT_CONTRACTS § "Per-adapter venue-address status" table). Even if Router → adapter call succeeds, the adapter's inner `pool.deposit(...)` or equivalent reverts with `call to non-contract`.
- **Specific notes:**
  - **Aave Horizon (D.3):** AUDIT_CONTRACTS C-7 — deployed bytecode is legacy v1.0, no `setAuthorizedCaller`, can't even be wired. Needs redeploy with V11 build.
  - **Polymarket (D.7):** routes via Aqueduct → Polygon Amoy. Aqueduct has zero LINK balance (AUDIT_USER_FLOWS Flow 13), so cross-chain send reverts at `link.transferFrom` before reaching Amoy.
  - **Hyperliquid HIP-4 (D.11):** shares the same adapter contract as HIP-3 (`0x8701…371e`); requires validator-set rotation via `setValidatorSet` per AUDIT_CONTRACTS.
- **User sees:** "Transaction failed" toast on every venue.
- **Fix:** see D.2 fix + per-adapter redeploy (venue addresses are immutable). ~2 days for full venue parity.
- **Severity:** **CRITICAL** all 9.

---

### Group E. Cross-chain

#### E.1 `/app/transfer` — Aqueduct send (Arb→Eth Sepolia)
- **Today:** 200; `TransferForm` + `TransferTimeline` + `RecentTransfers` all live. `/api/transfer/quote → {estimatedSeconds:8.4, ccipFeeUsd:"$0.00", source:"aqueduct"}` (real read from registry). `/api/transfer/last → {amount:"0", status:null, steps:[4 pending]}`.
- **Breaks at:** AUDIT_USER_FLOWS Flow 13 + AUDIT_CONTRACTS:
  - Aqueduct has zero LINK balance → `link.transferFrom` reverts on first `send_collateral`.
  - `Aqueduct.allowedDestinations(eth-sepolia)` never set (PhaseB3 scheduled but 48h timelock pending — id 11).
  - `Coffer.setAdapter(Aqueduct, true, cap)` never scheduled — Coffer rejects Aqueduct as caller (C-8).
- **User sees:** "Move USDC" button click → wallet prompt → tx submitted → REVERT.
- **Fix:** ~1h ops — top up LINK (Chainlink testnet faucet), schedule + execute the 3 admin actions, +48h wait.
- **Severity:** **HIGH** — Verifier doesn't depend on this, but the design promises it as a Day-1 capability.

#### E.2 Source-chain send, destination-chain receive
- **Today:** AqueductReceiver deployed (`0x9a66…dc70`); `setAllowedSource` scheduled (id 12) — not executed.
- **Breaks at:** same as E.1 + missing destination wiring.
- **Severity:** HIGH.

#### E.3 Claimback path
- **Today:** AqueductClaimback deployed (`0x4d44…9382`); `setClaimbackRegistry` scheduled (id 13).
- **Breaks at:** never executed → double-spend defense disabled per AUDIT_CONTRACTS.
- **User sees:** if a CCIP transfer hits the 24h expiry, claim_back tx would skip the delivery-ack check.
- **Severity:** HIGH for any real cross-chain use.

---

### Group F. Agents

#### F.1 `/agents/marketplace` browse
- **Today:** 200; three reference agents listed (Augur / Haruspex / Auspex). `/api/agents/leaderboard → {agents:[], source:"pending", detail:"Rostrum leaderboard pending subgraph indexing — see human_left.md #26."}`.
- **Breaks at:** AUDIT_BACKEND finding 2: **Rostrum data source in `subgraph.yaml:381` is `0x0000…0000`** despite the contract deployed at `0xbaf3…b0af`. Subgraph will never index Rostrum events. Even when Rostrum emits, this surface stays empty. Also AUDIT_FRONTEND M-2: "Submit on GitHub" CTA points at a personal fork URL.
- **User sees:** 3 reference agents card; empty community list with honest pending caption.
- **Fix:** ~30 min — fix yaml address + redeploy subgraph. ~5 min — fix GitHub URL.
- **Severity:** HIGH for community-agent surfacing.

#### F.2 `/app/agents` — your mandates
- **Today:** 200; `NewMandateButton` opens real IntentSigil EIP-712 modal. `/api/agents/my-mandates → {mandates:[], source:"pending", reason:"no_wallet_configured"}`. `/api/agents/summary → {activeMandates:0, activeSessionKeys:null, ...source:"scribe"}`.
- **Breaks at:** Sigil never initialized (AUDIT_CONTRACTS C-2) — even successful EIP-712 signing produces an intent hash, but Sigil cannot validate it because `praetor_multisig = 0x0`.
- **User sees:** can sign a mandate (EIP-712 ceremony works in wallet); intent hash shown; no agent picks it up; no validation ever lands.
- **Fix:** init Sigil (C-2 fix, 5 min after PhaseB4 script written).
- **Severity:** **CRITICAL** — Verifier step gated.

#### F.3 Sign new Intent Sigil — full mandate flow
- **Today:** user fills form (agent address, per-action cap, per-day cap, expiry, instrument allowlist). `useSignTypedData` prompts wallet. Wallet signs.
- **Breaks at:** signature lands client-side; no central storage (matches `ATRIUM_FULL_FLOW_DESIGN.md` design caveat lines 600-624). When an agent later picks up the mandate, Sigil.validate_action runs against uninitialized Sigil → revert.
- **User sees:** mandate "issued" state in UI; never advances to "executed".
- **Severity:** **CRITICAL**.

#### F.4 Agent pickup — 3 Vercel agents tick via GH Actions
- **Today:** AUDIT_BACKEND row § "Agents" — `/api/status` returns `{status:"pending"}`. GH cron fires every 5 min per `.github/workflows/agents-cron.yml`. Per-endpoint auth: `CRON_SECRET` discrepancy — Lantern's value 401s the agents endpoints. Operator must verify GH secret matches.
- **Breaks at:** even if cron fires, agents fetch from stale `v0.0.3` Scribe (AUDIT_BACKEND headline 1) → never see new SigilValidated events. Tick logs "mandates.found=0" forever.
- **User sees:** agents page never shows any "agent X acted under your mandate" row.
- **Fix:** ~5 min — point `SCRIBE_URL` at `/version/latest` in agents/vercel.json + redeploy + verify CRON_SECRET parity.
- **Severity:** **CRITICAL** for the agent-acts-on-behalf demo.

#### F.5 Action Sigil emission
- **Today:** none ever emitted — Sigil uninitialized + no agent ever picked up a mandate.
- **Breaks at:** entire upstream chain.
- **Severity:** dependent.

---

### Group G. Emergency

#### G.1 Kill Switch
- **Entry:** `/app/agents` shortcut or `/verify/7`.
- **Today:** real wagmi `useKillSwitch.activate()`. PosternKillSwitch at `0xb90a…b676` deployed. Confirm dialog wired at `verifier-step-runner.tsx:174`.
- **Breaks at:** `PosternKillSwitch.activate(...)` loops `posternKeyRegistry.activeKeys[user]` and revokes each. With no mandate ever issued (F.2 broken), `activeKeys[user]` is empty → tx confirms with zero revocations.
- **User sees:** confirm modal → wallet → tx confirms → "Killed 0 mandates" / Arbiscan link. Anticlimactic but technically correct.
- **Fix:** demo-quality dependent on having an active mandate first (F.2 chain).
- **Severity:** **CRITICAL for demo impact**; tx itself works.

#### G.2 Pause via PraetorTimelock
- **Today:** AUDIT_CONTRACTS C-5: `PraetorTimelock.emergencyPause` invokes `IPausable(target).pause(string)` but Plinth + Coffer expose `pause(bytes32 reason)`. Sigil + Vigil expose no `pause` function at all. So timelock-routed emergencyPause REVERTS on every Stylus contract.
- **Breaks at:** ABI mismatch.
- **User sees:** no user UI for this today.
- **Fix:** ~1h — unify ABI to `pause(bytes32)` + redeploy timelock + Aqueduct.
- **Severity:** **CRITICAL** for security posture; invisible to users.

#### G.3 Liquidation — Vigil keeper
- **Today:** Vigil deployed (`0x6771…522e`) but never initialized (C-3). Even after init, `keeper_min_stake_wei = 1000 ETH` (unrealistic on Sepolia) — no keeper can stake.
- **Breaks at:** Plinth's `queue_liquidation` call reverts inside Vigil because `plinth_address` storage is `0x0`. Plinth catches the revert and emits `VigilQueueFailed` — never queues. No keeper bots running anywhere.
- **User sees:** if a position were underwater, no liquidation; user stays paused with no enforcement.
- **Fix:** init Vigil + reduce stake floor + run a keeper bot. ~2h.
- **Severity:** **CRITICAL** for safety posture; invisible until someone goes under.

---

### Group H. Verifier walk (judge-facing)

#### H.1 `/verify/1` — Intro + Kani badge + Deposit
- **Today:** renders; Kani badge `/api/kani/status → {state:"pass", passed:5, total:6, ...source:"public/kani-status.json"}` — but this is the HAND-EDITED file per AUDIT_TESTS_SECURITY headline (Kani CI has never run; "5 of 6" was authored, not earned). Connect with Postern works. After connect, `/api/deployments/status?step=1 → ready:true`.
- **Breaks at:** Click "Run step 1" → `vaultDeposit.deposit(amountUsd)` → Coffer never initialized (B.7).
- **User sees:** Kani badge says ✅ 5/6 (lies); button enabled (looks healthy); click → tx submitted → REVERTS with empty data. Error: "Did not complete · execution reverted".
- **Verdict:** 🔴 **RED**.

#### H.2 `/verify/2` — Open hedged position
- **Today:** `/api/deployments/status?step=2 → ready:true`. Button enabled.
- **Breaks at:** Plinth stub (99 bytes); Router selector mismatch (C-4); adapters not authorized (C-6); Coffer not approved (C-8); Coffer not initialized (C-1).
- **User sees:** click → tx → REVERTS. No named cause.
- **Verdict:** 🔴 **RED**.

#### H.3 `/verify/3` — See margin saving (recompute)
- **Today:** `ready:true`. Button enabled.
- **Breaks at:** depends on H.2 success (no positions exist) + Plinth stub.
- **User sees:** click → REVERTS.
- **Verdict:** 🔴 **RED**.

#### H.4 `/verify/4` — Trigger Chaos Mode
- **Today:** `/api/chaos/inject` POST returns `{error:"chaos_agent_not_deployed", detail:"PRAETOR_CHAOS_URL not configured..."}` (probed live). The route requires field `fault`; component sends `chaos.defaultFault` which presumably maps correctly. Either way the env is unset → 503.
- **Breaks at:** designed-as-pending per `ATRIUM_FULL_FLOW_DESIGN.md`; honest "Chaos agent deploys Month 9".
- **User sees:** error message naming the right cause.
- **Verdict:** 🟡 **YELLOW** — honest pending but doesn't progress the demo.

#### H.5 `/verify/5` — Run liquidation drill
- **Today:** `ready:true`. Button enabled.
- **Breaks at:** Vigil uninitialized (C-3); no keeper running; no positions to liquidate; Plinth stub.
- **User sees:** click → throws `config.pendingReason` from `verifier-step-runner.tsx:203`. Error toast.
- **Verdict:** 🔴 **RED**.

#### H.6 `/verify/6` — Verify proof of reserves
- **Today:** `ready:true`. `useLanternVerify.verify()` reads latest attestation.
- **Breaks at:** `/api/lantern/latest → {exists:false}`. Honest empty state.
- **User sees:** "Wallet not found in the latest Lantern attestation tree" (because no attestation exists).
- **Verdict:** 🔴 **RED** (honest but not verifiable).

#### H.7 `/verify/7` — Kill Switch
- **Today:** `ready:true`. Confirm modal fires. `PosternKillSwitch.activate()` lands; revokes zero mandates (because none ever issued).
- **User sees:** wallet confirms; Arbiscan link; "killed 0 mandates" outcome.
- **Verdict:** 🟢 **GREEN** mechanically; **YELLOW** dramatically (judge sees a successful tx that did nothing visible).

**Verifier walk net: 5 RED / 1 YELLOW / 1 GREEN. The 6-min demo cannot run end-to-end today.** A judge running it gets four "Did not complete · execution reverted" toasts and an anticlimactic kill switch.

---

### Group I. Diagnostic / chaos

#### I.1 `/chaos`
- **Today:** 200. Component renders; calls `/api/chaos/inject` on button click; gets 503.
- **Breaks at:** Praetor chaos agent never deployed (designed-pending Month 9).
- **User sees:** "Chaos agent deploys Month 9" honest banner.
- **Severity:** OK as designed.

#### I.2 `/loadtest`
- **Today:** 200. `LoadtestDashboard` renders. Unverified whether it reads real measurements or static SLO targets.
- **Breaks at:** unclear without deeper read.
- **Severity:** MED if it shows fake data.

#### I.3 `/verify/[step]` Chaos Mode button
- Same as H.4.

---

### Group J. Mobile

#### J.1 Mobile UA on `/`
- Already covered in A.2.

#### J.2 Mobile UA on `/app/portfolio`
- **Today:** middleware rewrites to `/mobile-app.html` (59,884 bytes — confirmed by curl).
- **Breaks at:** AUDIT_FRONTEND C-2 — vanilla JS, no wagmi. Hardcodes $12,374,820 buying power, 4 fake positions, 5 fake agents on Rostrum, 1 fake delphi.eth mandate, fake $50,000 Aqueduct transfer, fake activity log. Hydration script only updates the hero buying power and zeros-out positions on empty case; everything else stays fake.
- **User sees:** beautifully-designed app with fake numbers.
- **Severity:** **CRITICAL** for mobile traffic.

#### J.3 Mobile app shell — Home tab
- **Today:** renders 4 hardcoded position rows + activity feed.
- **Breaks at:** positions section is hydrated from `/api/portfolio/positions` on empty case only; if API errors, the fakes stay (AUDIT_FRONTEND C-2 H-5: explicit code comment "Leave the design placeholders if the API errors — better than an empty screen for the buildathon demo"). Direct violation of `.claude/rules/ui.md` "never display a placeholder number that looks real".
- **Severity:** CRITICAL.

#### J.4 Mobile Trade tab — tap "Open long · rTSLA-PERP"
- **Today:** AUDIT_FRONTEND C-2 table — line 1130 button handler at line 1396 only toggles colour and label text. **Sends no transaction ever.**
- **User sees:** button color flips; "rTSLA-PERP" label maybe flips to "submitted" decoratively; no wallet prompt; no on-chain anything.
- **Fix:** ~1d wagmi integration into vanilla shell OR full React port (~5-10 days).
- **Severity:** **CRITICAL**.

#### J.5 Mobile Move tab — tap "Move $50,000 USDC"
- **Today:** line 1180 button has **no handler at all** (AUDIT_FRONTEND C-2 table).
- **User sees:** tap does nothing.
- **Severity:** **CRITICAL**.

#### J.6 Mobile Agents tab — tap "Manage" / "All ↗" / "New ↗"
- **Today:** "Manage" no handler; "All ↗" + "New ↗" are `href="#"` dead.
- **User sees:** taps either do nothing or scroll the page to top.
- **Severity:** CRITICAL.

#### J.7 Mobile More tab — settings rows
- **Today:** lines 1278-1318 — 6 rows (Proof of reserves · Tax · UK CGT · Session keys · Account · Recovery · etc.) rendered as `<div class="more-row">` with chevron, no `<a>` or handler.
- **User sees:** chevrons that don't tap through.
- **Severity:** HIGH.

#### J.8 Mobile reserves action tile
- **Today:** Home reserves tile (AUDIT_FRONTEND C-2 line 970) — no `data-go` attribute, no handler.
- **User sees:** tile that doesn't navigate.
- **Severity:** HIGH.

---

### Group K. Cross-flows + side-quests

#### K.1 `/api/[anything-not-routed]`
- **Today:** Next 15 returns 404 with default Next not-found page.
- **Severity:** OK.

#### K.2 Switch networks mid-flow
- **Today:** `verifier-step-runner.tsx:85` checks `chain?.id !== 421614` and renders a "Switch to Arbitrum Sepolia" permission state with the user's current chain name.
- **Breaks at:** the `/app/*` pages do NOT have a chain guard — only the Verifier does. So a user on Mainnet Eth can navigate `/app/vault`, click Deposit, and wagmi will prompt to switch (but the page UI gives no hint).
- **User sees:** Verifier has good guard; `/app/*` pages don't.
- **Fix:** ~30 min — add chain guard to `AppShell` wrapper.
- **Severity:** MED.

#### K.3 Sign in with one wallet, then disconnect mid-trade
- **Today:** wagmi `useAccount().isConnected` flips false; React re-renders; per-page behavior varies. Verifier step runner handles cleanly (returns to "Connect with Postern" state).
- **Breaks at:** in `/app/vault` and `/app/trade`, the in-flight tx may have already been submitted; component still expects a connected wallet for the success state.
- **User sees:** likely a stuck loading spinner if disconnect happens during pending tx.
- **Fix:** add disconnect guard in each `useWriteContract` consumer. ~1h.
- **Severity:** MED.

#### K.4 Mandate expiry (intent.expires_at passes during agent action)
- **Today:** Sigil source has `validate_action` that checks `now <= intent.expires_at` per Kani proof. Cannot exercise because Sigil uninitialized.
- **Breaks at:** even when Sigil works, no UI explicitly handles "mandate expired" — `/app/agents` would show the mandate as `expired` status (designed) but the agent service has no path to surface the failure back to the user.
- **User sees:** in a working chain, mandate would silently stop being honored.
- **Severity:** MED.

#### K.5 Aqueduct expiry + claimback flow
- **Today:** AqueductClaimback deployed; `Aqueduct.setClaimbackRegistry` scheduled but not executed (id 13). UI surface: `/app/transfer` shows a 4-step timeline with `Claimback expiry` row implicitly (per `/api/transfer/last` shape).
- **Breaks at:** no `/app/transfer/[id]/claim` route exists. If a CCIP transfer expires, user has no in-app path to invoke `claim_back`.
- **User sees:** in-app, no way to recover stuck funds; would need to call the contract directly.
- **Fix:** ~3h — add claim UI + handler.
- **Severity:** HIGH.

#### K.6 Tax export — zero trades, single trade, mixed-jurisdiction
- **Today:** `/api/tax/summary` always returns all-null `source:"pending"` because Tablet `/summary` endpoint doesn't exist (AUDIT_BACKEND finding 4). Even with zero trades, the page can't differentiate "no data yet" from "service down".
- **Breaks at:** API contract gap; no jurisdiction-mismatch handling.
- **User sees:** "Tax service unavailable" regardless of trade count.
- **Severity:** HIGH.

#### K.7 Lantern verify-inclusion for a wallet not in the tree
- **Today:** `useLanternVerify.verify()` calls `/api/lantern/latest` → 404 `{exists:false}`. Verifier step 6 surface explicitly handles this with "Wallet not found in the latest Lantern attestation tree" honest negative.
- **Breaks at:** today, no attestation exists at all, so "not found" can't be distinguished from "no attestation yet".
- **User sees:** honest "no attestation" message.
- **Severity:** LOW (works as designed for the empty case).

---

## The 7 Verifier walk steps — judge-facing critical path

| Step | Mechanic | Today | Verdict |
|---|---|---|---|
| 1 | Deposit USDC → Coffer | Button enabled; Coffer never initialized → revert | 🔴 RED |
| 2 | Open hedged position | Button enabled; Plinth stub + Router selector miss + adapters not authed + Coffer not approved | 🔴 RED |
| 3 | Margin recompute | Depends on 2 | 🔴 RED |
| 4 | Chaos inject | Honest 503 "deploys Month 9" | 🟡 YELLOW |
| 5 | Liquidation | Vigil uninitialized; no keepers | 🔴 RED |
| 6 | Verify proof of reserves | Lantern never published | 🔴 RED |
| 7 | Kill switch | Tx works; revokes zero mandates | 🟢 GREEN (anticlimactic) |

**Net: 5 RED / 1 YELLOW / 1 GREEN.** A judge cannot complete the walk today. AUDIT_ROADMAP D-Day-17 tripwire T1 has effectively fired with no announcement.

---

## Cross-flow journeys (multi-step user stories)

### Journey 1 — First-time user signs up + makes first trade

1. Lands on `/` (desktop): sees fake $4.13M live ticker + 8 fake partner logos (A.1 — CRITICAL trust hit).
2. Clicks "Open testnet ↗": navigates to `/app/onboarding`. ✓
3. Step 1 Welcome: clicks "Set up authenticator". ✓
4. Step 2 Passkey: WebAuthn ceremony fires; user touches fingerprint reader; passkey created. ✓ B.2 WORKS.
5. Step 3 Faucet: button disabled with wrong reason ("Faucet adapter pending Curator whitelist"). Faucet IS stocked but `/api/faucet/status` doesn't read on-chain. B.3 BLOCKS.
6. User clicks "Skip →" (no test USDC).
7. Step 4 Margin posted: card reads `pending` with stale "Plinth source built · deploy Month 1 W2" copy. B.4.
8. User clicks "Open portfolio": lands on `/app/portfolio`.
9. Portfolio: every panel empty. Sidebar shows fake address `0x1a3b…7f29`, NOT the user's real connected address. B.5 + C.1 BLOCK.
10. User navigates to `/app/trade`: orderbook empty (default symbol HSLA-PERP returns pending). D.1.
11. User switches to BTC: live HL testnet orderbook renders. Real data! ✓
12. User sets size, clicks "Open long": wallet prompts; tx submitted; REVERTS with empty data. D.2 BLOCKS.
13. Error toast: "Transaction failed". No named cause.
14. User gives up.

**Verdict: 3 of 14 steps succeed end-to-end (1, 4, 11).** Journey fails at first money-touch.

### Journey 2 — Agent operator publishes strategy + earns fees

1. Lands on `/agents/marketplace`.
2. Sees 3 reference agents (Augur / Haruspex / Auspex); empty community list (honest).
3. Clicks "Submit on GitHub": URL points at personal fork, not canonical org (M-2). 404 likely.
4. Even if PR landed, no on-chain mechanism for agent registration today.
5. No earnings — Rostrum subgraph data source is `0x0000…0000` (F.1 / AUDIT_BACKEND finding 2).

**Verdict: structurally impossible today.** Agent publishing has no live end-to-end path.

### Journey 3 — Institutional client demos cross-margin saving + verifies attestation

1. Cohort partner navigates to `/cohort`. Sees empty grid (honest). No application form.
2. Goes to `/verify/1` to see the proof: 5 RED, 1 YELLOW, 1 GREEN walk. Cannot demonstrate margin saving (steps 2+3 RED).
3. Navigates to `/lantern`: "No attestation published yet". Cannot verify reserves.
4. Asks to see backtest: `/api/research-attestation/latest → 404`. No published backtest. JUDGE_ONE_PAGER's "judge-verifiable in 10 seconds" claim cannot be honored.
5. Asks for partner agreement: no flow exists to onboard a cohort partner. `cohort/partners` route has no event handler that creates a partner (AUDIT_BACKEND finding 3).

**Verdict: end-to-end institutional demo is impossible today.** Every promised proof surface either has no data or has a structural pipeline gap (Rostrum 0x0, CohortPartner no handler, Lantern no attestation, ResearchAttestation no publish path).

---

## Edge cases the design didn't account for

1. **Wallet address mismatch.** AppShell sidebar shows static `0x1a3b…7f29` while the connected wallet is different. No user-account drift detection.
2. **Faucet route lies about state.** Hardcoded "pending" instead of reading on-chain; users blocked even after stocking.
3. **`/api/deployments/status` says `ready:true` for every step** even when contracts are deployed-but-uninitialized. The check is only "bytecode exists at address" — never "contract returns non-zero from a getter that initialize() would set".
4. **Default trade symbol** is something the upstream API doesn't have. Most live data path the app has, killed by a default-string.
5. **Adapter slug allowlist drift.** GMX, Morpho, Synthetix deployed but not in the slug allowlist at `/api/deployments/address`. Frontend cannot resolve their addresses.
6. **Markets page hardcodes "live source" pill** on every venue regardless of PorticoRegistry whitelist state.
7. **Sigil/Plinth/Coffer/Vigil have no `is_initialized()` view** anyone could query before sending money. Per AUDIT_TESTS_SECURITY: contracts deliberately don't surface init state, so neither the UI nor the user can pre-detect a bricked call.
8. **Mobile chain-guard absent.** Only Verifier checks chain id; `/app/*` routes don't.
9. **No `/app/transfer/[id]/claim`** route. User stuck if a CCIP transfer expires.
10. **Sigil intent storage is client-side only** — if the user clears localStorage between sign + agent pickup, the mandate is signed but unreferenced.
11. **Chaos route field name** — route expects `fault`; `useChaosInject` hook may send `scenario` or `fault` depending on version. Probe showed `scenario` returns 400; correct usage returns 503.
12. **`AppShell` mobile nav** is dead code on mobile (middleware rewrites `/app/*` away before React renders) — only visible on tablet that doesn't match the UA regex.
13. **Kani badge file** is hand-edited (`public/kani-status.json` says `state:pass, 5/6` — never produced by Kani run). 5 failing tests catch this.
14. **No way to recover a passkey** if the user loses their only device. Design acknowledges this but the warning is buried; the deposit flow doesn't gate on having a second authenticator.

---

## Mobile vs desktop parity table (every flow)

| Flow | Desktop works? | Mobile works? | Same UI? |
|---|---|---|---|
| Landing | partial (fake logos + ticker) | partial (per-venue fakes) | NO (mobile rewrites) |
| `/app` home | renders honest-stale | clickable mockup | NO |
| Onboarding step 1-2 | ✓ passkey works | partially | NO |
| Onboarding step 3 Faucet | route lies | route lies | same fault |
| `/app/vault` deposit | wagmi but Coffer reverts | dead button | NO |
| `/app/portfolio` | empty honest | hardcoded fake | NO |
| `/app/trade` | empty default, BTC works | dead button | NO |
| `/app/transfer` | wagmi but no LINK | dead button | NO |
| `/app/agents` | EIP-712 works; no validation | dead button | NO |
| `/app/markets` | renders 6 of 9 venues | not exposed | NO |
| `/app/notifications` | empty honest | not exposed | NO |
| `/app/reserves` | honest empty | not exposed | NO |
| `/app/settings` | wallet tab static | not exposed | NO |
| `/app/tax` | API contract gap | not exposed | NO |
| `/verify/[1-7]` | 5R/1Y/1G | desktop-only (no rewrite) | n/a |
| `/lantern` | honest empty | desktop-only | n/a |
| `/cohort` | honest empty | desktop-only | n/a |
| `/agents/marketplace` | partial | desktop-only | n/a |
| `/chaos` | honest 503 | desktop-only | n/a |
| `/loadtest`, `/rostrum`, `/benchmarks`, `/changelog`, `/learn`, `/security`, `/sla`, `/manifesto`, `/team`, `/brand`, `/legal/*`, `/docs` | render | desktop-only | n/a |

**Mobile parity: 0 of the 13 authenticated `/app/*` flows actually work on mobile.** Every primary action is decorative.

---

## Top-10 user-visible breakages ranked by demo impact

1. **Verifier walk steps 1-3, 5, 6 all RED.** A judge running the live demo gets 4-5 "tx reverted" toasts. Kills the buildathon submission. Cite: AUDIT_CONTRACTS C-1/C-2/C-3 (uninitialized) + Plinth stub (99 bytes per AUDIT_TESTS_SECURITY) + Lantern never published.
2. **Desktop landing fake "$4.13M live TVL" ticker + 8 fake partner logos.** Catches every desktop visitor on first paint. AUDIT_FRONTEND C-1.
3. **Mobile-app.html clickable mockup.** Every primary mobile button (Open long, Move USDC, Manage agent) is decorative. AUDIT_FRONTEND C-2.
4. **Faucet route lies about state.** `/api/faucet/status` hardcoded pending; doesn't read on-chain. Faucet IS stocked. First-hop blocker for every onboarding flow.
5. **Sidebar hardcodes wrong wallet address.** User signs in, sidebar shows someone else's. Immediate trust hit.
6. **`/app` aside lies about deploy state.** "Plinth source built · deploy Month 1 W2" while Plinth is deployed (as a stub). AUDIT_FRONTEND C-5.
7. **Markets page advertises "live source" on every venue regardless of state.** 6 of 9 deployed venues; none are PorticoRegistry-whitelisted yet. AUDIT_FRONTEND H-1.
8. **Trade orderbook defaults to a symbol the upstream API doesn't carry.** Real Hyperliquid testnet data exists but the page renders empty until user changes symbol.
9. **Kani badge shows `pass 5/6` from a hand-edited file** that no CI run ever produced. The 5 frontend test failures are exactly the tests asserting the badge should report `unknown`. AUDIT_TESTS_SECURITY headline.
10. **Cohort partner list will stay empty even when partners onboard** because no subgraph handler writes `CohortPartner`. AUDIT_BACKEND finding 3.

---

## Top-10 polish gaps that don't break a flow but hurt the feel

1. Sidebar nav missing `/app/markets` + `/app/notifications` entries (AUDIT_FRONTEND H-3).
2. `/app/settings` 5 of 6 tabs share identical "coming Month X" banner — they should differ per tab (M-9).
3. `/docs` cards link to `docs/LAUNCH_READINESS.md` but file is `LAUNCH_READY.md` (M-3).
4. `/changelog` static WAVES[] last entry is 2026-05-18 — stale (M-4).
5. Sidebar Agents `'3'` badge is hardcoded `'0'` in code (M-5).
6. `/legacy` page exists with unclear scope (M-7).
7. Mobile-landing footer is 10 `href="#"` dead links (AUDIT_FRONTEND C-4).
8. Mobile-landing "Documentation" CTA is dead `href="#"` instead of `/docs` (H-7).
9. `/agents/marketplace` "Submit on GitHub" CTA points at personal fork URL (M-2).
10. landing-v2.html bundle is 1.6 MB single-file (no code splitting; bundles full React runtime + node_modules) — overshoots `.claude/rules/ui.md` §3.4 250KB budget by 6.4×. TTI on mobile broadband: untested but cannot hit ≤1.5s. AUDIT_FRONTEND H-8.

---

## The 5 fixes that would change the most flows

Ordered by flows-unblocked-per-hour.

### Fix #1 — Initialize Coffer + Sigil + Vigil (1h, unblocks ~12 flows)
Write `script/PhaseB4-Initialize.s.sol` and call:
- `Coffer.initialize(USDC, Plinth, deployer, PraetorTimelock, deposit_cap_wei, per_user_cap_wei)`
- `Sigil.initialize(praetor=deployer, plinth=Plinth, postern_kill_switch=PosternKillSwitch, ...)`
- `Vigil.initialize(plinth=Plinth, coffer=Coffer, portico_registry=PorticoRegistry, ...)`

**Unblocks:** B.7 (deposit), C.1-C.6 (portfolio + monitoring), F.2-F.5 (agents + Sigil), G.3 (liquidation), H.1, H.5, H.7 (Verifier steps 1, 5, 7 become live). Per AUDIT_CONTRACTS C-1/2/3.

### Fix #2 — Patch `/api/faucet/status` to read on-chain balance (30 min, unblocks ~8 flows)
Replace hardcoded `{available:false, reason:"Faucet adapter pending Curator whitelist"}` with a viem read of `Faucet.usdcBalance()` + `Faucet.canClaim(address)` + return live state.

**Unblocks:** B.3 (faucet step), B.6 (claim works), A.3 (onboarding flow without skip), H.1 first-hop for Verifier walk.

### Fix #3 — Point `SCRIBE_URL` at `/version/latest` + set `DEMO_WALLET_ADDRESS` (10 min, unblocks ~10 surfaces)
Edit `.env`, `services/codex/vercel.json:11`, `services/agents/vercel.json:11`, Lantern + Tablet project envs. Set `DEMO_WALLET_ADDRESS` on the verify Vercel project.

**Unblocks:** C.1-C.6 (portfolio reads), F.4 (agents see emissions), the entire "subgraph showing real entities" pathway. Per AUDIT_BACKEND headline finding 1 + finding 8.

### Fix #4 — Patch Rostrum + AtriumRouter + Plinth subgraph addresses + redeploy (45 min, unblocks ~6 flows)
Edit `subgraph.yaml:381, 418` to real Rostrum + Router addresses; verify Plinth, Vigil, Coffer, Aqueduct, Sigil, PosternKillSwitch data sources have correct addresses (they may also be 0x0 — per AUDIT_USER_FLOWS finding A). Add a handler for `CohortPartner` write path. Republish subgraph.

**Unblocks:** F.1 (agents leaderboard), C.5 (reserves once Lantern publishes), A.11 (cohort grid), all portfolio surfaces that read margin updates.

### Fix #5 — Patch AppShell sidebar to use `useAccount()` + add chain guard + extend Markets venues (45 min, unblocks ~5 trust hits)
Replace hardcoded `0x1a3b…7f29` with `useAccount().address` + Connect prompt fallback. Add chain-id check to AppShell wrapper. Add Synthetix V3, Morpho Blue, GMX V2 to Markets `VENUES[]`. Replace "live source" pill with real PorticoRegistry whitelist check.

**Unblocks:** B.5 (post-onboarding trust), K.2 (wrong-chain detection), C.3 (markets parity). Trust-hit reduction across the entire authenticated surface.

---

## Appendix — files cited (absolute paths)

- `C:\Users\prate\Downloads\arb builder\apps\verify\src\middleware.ts` — mobile UA rewrite.
- `C:\Users\prate\Downloads\arb builder\apps\verify\public\landing-v2.html` — desktop landing, 1.6 MB self-contained Vite bundle with hardcoded PARTNERS + useState ticker.
- `C:\Users\prate\Downloads\arb builder\apps\verify\public\mobile-landing.html` — lines 893, 901-931, 958-988, 1148-1160 hardcoded numbers + dead footer.
- `C:\Users\prate\Downloads\arb builder\apps\verify\public\mobile-app.html` — 1485-line vanilla JS clickable mockup; lines 1130, 1180, 1196, 1278-1318, 1431-1482 are the dead buttons + bad-fallback hydration.
- `C:\Users\prate\Downloads\arb builder\apps\verify\public\kani-status.json` — hand-edited "pass 5/6".
- `C:\Users\prate\Downloads\arb builder\apps\verify\src\app\app\page.tsx:52-57` — stale "Source built · deploy Month 1 W2" Live status rows.
- `C:\Users\prate\Downloads\arb builder\apps\verify\src\app\app\markets\page.tsx:9-46, 66` — 6 hardcoded venues + "live source" pill.
- `C:\Users\prate\Downloads\arb builder\apps\verify\src\components\app-shell.tsx:141-148` — hardcoded `0x1a3b…7f29` sidebar address; also lines 37-61 NAV_GROUPS missing markets + notifications.
- `C:\Users\prate\Downloads\arb builder\apps\verify\src\app\verify\[step]\page.tsx` — 7-step config.
- `C:\Users\prate\Downloads\arb builder\apps\verify\src\components\verifier-step-runner.tsx` — runner with honest empty/permission/error states.
- `C:\Users\prate\Downloads\arb builder\apps\verify\src\app\api\faucet\status\route.ts` — hardcoded pending response.
- `C:\Users\prate\Downloads\arb builder\apps\verify\src\app\api\chaos\inject\route.ts` — 503 when `PRAETOR_CHAOS_URL` unset.
- `C:\Users\prate\Downloads\arb builder\apps\verify\src\app\api\deployments\address\route.ts` — slug allowlist missing gmx/morpho/synthetix.
- `C:\Users\prate\Downloads\arb builder\apps\verify\src\app\api\protocol\metrics\route.ts` — returns `venuesDeployed: {count:7, total:7}` (registry has 9 adapters).
- `C:\Users\prate\Downloads\arb builder\deployments\arbitrum_sepolia.json` — 30 contracts; every Stylus contract activationTx but no `initialize` call recorded.
- `C:\Users\prate\Downloads\arb builder\contracts\coffer\src\lib.rs:155-189` — `initialize(...)` that was never called.
- `C:\Users\prate\Downloads\arb builder\contracts\sigil\src\lib.rs:128-170` — same.
- `C:\Users\prate\Downloads\arb builder\contracts\vigil\src\lib.rs:157-195` — same.
- `C:\Users\prate\Downloads\arb builder\subgraph\subgraph.yaml:381, 418` — Rostrum + AtriumRouter wired to 0x0.
- `C:\Users\prate\Downloads\arb builder\services\tablet\src\main.py:37,59` — only `/health` + `/export` exist; verify calls `/summary` + `/events` → 404.
- `C:\Users\prate\Downloads\arb builder\services\codex\vercel.json:11` — stale SCRIBE_URL.
- `C:\Users\prate\Downloads\arb builder\services\agents\vercel.json:11` — stale SCRIBE_URL.
- `C:\Users\prate\Downloads\arb builder\.github\workflows\agents-cron.yml` — 5-min cron; CRON_SECRET parity needs verification.

---

## What works (kudos — call out so it doesn't get touched)

- **`/verify/[step]` + `VerifierStepRunner`** is the best-built React surface: real wagmi per step, deployment-readiness check (with the caveat that `ready` only means bytecode exists), permission state for wrong chain, error state with retry, success state with Arbiscan link, no fake tx hashes.
- **WebAuthn passkey ceremony** at `/app/onboarding` step 2 is real and works.
- **Hyperliquid testnet orderbook** for BTC/ETH/SOL is real, live, sub-second L2 depth via `api.hyperliquid-testnet.xyz`. Only live trading data in the app.
- **Vault TVL read** (`Coffer.totalAssets()` via viem) is real even with no deposits — returns honest `$0.00`.
- **Transfer quote** is a real read from the deployments registry — deterministic but honest.
- **Banned-words sweep** of `.tsx` files is clean and enforced by `writing-banned-words.test.ts`.
- **Honest-pending contract** is enforced by `apps/verify/src/app/api/honest-pending.test.ts` — every route returning `source:'pending'` ships `null` not fake-zero.
- **Codex x402 middleware** is the strongest-defended single surface; 22 tests; 12-confirmation depth; payer-spoof prevention.
- **Lantern publish-once** correctly skips when zero balances; would publish honestly the moment any deposit lands.
- **Aqueduct + AqueductReceiver** code-correctness is high — CCIP USDC read from destTokenAmounts (not message body); replay defense.
- **`/lantern`, `/cohort`, `/cohort/[id]`** all honor "no attestation yet" / "no partners yet" honestly.
- **Plinth reentrancy guard** is real on every state-changing path (per AUDIT_TESTS_SECURITY).

---

## Final note

This audit reads as harsh because the headline scores 5 working flows of ~50. But the underlying truth is that ~85% of the work to make those 50 flows light up is already done — the contracts are deployed, the React app is honest, the wagmi wiring is correct, the subgraph is indexing. **The choke point is operational: 3 `initialize` calls, 1 env-var change, 1 subgraph republish, 1 faucet-route patch, 1 sidebar fix.** The 5 fixes above unlock ~30 of the 50 flows in 4 hours of focused work. Past that, the Plinth multi-fragment stub, the Aqueduct LINK funding, the Tablet `/summary` endpoint, and the mobile React port are the remaining 2-day items. The buildathon submission can be saved without a single new line of contract code.
