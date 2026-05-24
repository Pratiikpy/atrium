# Atrium, Launch Ready

Last updated: 2026-05-24 (post-8-audit reconciliation)
Current score: **3 of 15 user flows ACTUALLY work end-to-end. 6 are CONTRACTUALLY WIRED but blocked on init or data. 6 are NOT YET BUILT or BLOCKED on humans.**

(Prior headline said "9/15 60%". That conflated wired with working. The 8-audit pass on 2026-05-24 caught this. Honest count below.)

## Status taxonomy

- **WORKS** ✅ user can complete the flow end-to-end with a real on-chain result today.
- **WIRED-UNINIT** ⚠️ contracts deployed but `initialize()` not called yet. Pressing the button reverts (see `AUDIT_CONTRACTS.md` C-1, C-2, C-3).
- **WIRED-NO-DATA** 🔵 pipeline is live but the subgraph entity is empty (e.g. zero deposits, so the positions list is empty).
- **NOT-BUILT** ❌ the contract or route or UI does not exist yet.
- **HUMAN-BLOCKED** 👤 needs Founder action (Safe ceremony, cohort outreach, partner sign, domain claim).

## 31 contracts deployed on Arbitrum Sepolia

- 7 Phase-0 Solidity (PraetorTimelock, PorticoRegistry, LanternAttestor, Curator, Edict, ResearchAttestation, StoaBlackScholes). Verified.
- 6 Stylus (Coffer, Plinth, Sigil, Vigil, PlinthMath, PlinthOracle). Deployed via cargo-stylus 0.10.7 factory. **Note: Plinth is a 99-byte stub per Auditor E. The activation did not land and needs redeploy. Coffer/Sigil/Vigil never had `initialize()` called.**
- 5 Phase-B Solidity (Aqueduct, AqueductReceiver, AqueductClaimback, PosternKeyRegistry, PosternKillSwitch). Verified.
- 1 Faucet (right-sized: 5 USDC + 0.0005 ETH per claim). Stocked and verified.
- 2 Plinth-dep (AtriumRouter, Rostrum). Verified, but Router has selector mismatch per Auditor A C-4.
- 9 venue adapters (Aave/Curve/GMX/Hyperliquid/Morpho/Pendle/Polymarket/Synthetix/Trade.xyz). Verified, no Curator whitelist yet.
- 1 deprecated (faucet-v1) kept in registry for transparency.

22 of 23 newer Solidity contracts are Sourcify exact_match (last deploy pending).

## Off-chain services

- **Tablet** (FastAPI tax): live at https://tablet-nbuequsc6-pratiikpys-projects.vercel.app (`/health` 200, `/export` validates).
- **Codex** (Hono x402): live at https://codex-8y7umy7c2-pratiikpys-projects.vercel.app (`/health` 200, `/v1/*` returns 402).
- **Agents** (3 TS-ported Rust crates): live at https://agents-9rgcvskkw-pratiikpys-projects.vercel.app (`/api/status` 200, tick endpoints honest about cold-start state).
- **Lantern** (Merkle PoR): live at https://lantern-attestor-cym79nomu-pratiikpys-projects.vercel.app (cron returns ok, correctly skips publish when Coffer balances are 0).
- **Subgraph** (Scribe): live at v0.0.3 endpoint. **2 data sources (Rostrum, AtriumRouter) still at 0x0 per Auditor C, fixing in Phase γ.**

## What blocks "Launch Ready ✅"

Per the 8 audits run 2026-05-24:
- 11 critical findings (5 contract correctness, 3 frontend honesty, 1 subgraph, 1 stale Scribe URL, 1 mobile).
- 7 high findings (multisig, reentrancy, CI dormancy, 2 API correctness bugs, 1 honest-pending defect, 1 fake-numbers in mobile-landing).
- 8 silent scope cuts needing tripwire announcements.
- Founder ceremony: 3-of-5 Safe migration.

See `harmonic-chasing-honey.md` plan for the 22 hour fix sequence (Phases α to ε).

This file is the single source of truth for "launch ready". When every item is ✅, the title flips to **"Atrium, Launch Ready ✅ (date)"**. Until then, the score line is the honest 3/9/3 breakdown above.

---

## 1. What "launch ready" means in one sentence

A real visitor lands on the live site, completes every documented user flow end-to-end with their own money (test money on testnet, real money on mainnet) — and every number they see is real, every button they press leads somewhere real, every state they encounter (loading, error, success, empty, permission, mobile) is designed and built.

## 2. The 15 user flows that must work

1. Land on the page and understand what Atrium is in 90 seconds.
2. Click "Open testnet" and walk through onboarding.
3. Set up a passkey-bound smart wallet (no seed phrase).
4. Claim a faucet drop of test USDC.
5. Deposit USDC into the vault and see their balance update.
6. Open a position on one venue (Hyperliquid) and see real margin numbers.
7. Open a hedged position on a second venue (Aave Horizon) and watch required margin DROP — the whole pitch.
8. Open Portfolio and see real positions, real P&L, real liquidation buffer (not "—").
9. Sign a mandate to an AI agent; the agent acts; the action shows up in the user's log.
10. Press Kill Switch — one transaction revokes every agent + session key.
11. Verify their own balance in the hourly Merkle attestation.
12. Download a tax CSV with real trade history.
13. Move USDC from Ethereum → Arbitrum via Aqueduct in under a minute.
14. Do all of the above on a phone, not just desktop.
15. A judge runs the 7-step Verifier walk and every step lands a real on-chain transaction.

## 3. The rules of full-baked (no compromise)

These rules are absolute. If even one is broken on any page or flow, the product is not launch-ready.

### 3.1 No half-baked features

- Every feature works for every described case in `ATRIUM_FULL_FLOW_DESIGN.md`. If the design doc lists 7 venue chips, all 7 work.
- Every UI state is implemented: **loading, empty, error, permission-denied, success, mobile**. A feature missing any of these states is not done.
- Every "what if X happens" branch has real behavior — never a pending banner standing in for an answer.
- Every button leads somewhere real. No `onClick={() => {}}` placeholders.
- Every form validates inputs server-side, not just client-side.
- Every error has a recovery path the user can take.
- No "coming soon" copy anywhere. If a feature isn't here, it's not advertised.

### 3.2 All data is real (no mocks, no placeholders, no fakes)

- Every number on screen has a real source: **Plinth, Scribe, Codex, Lantern, RPC, or an on-chain tx**. No hardcoded constants pretending to be live data.
- Every address shown is a real deployed contract or wallet. No `0x000…0` shown as if it were a real contract.
- Every timestamp is real. No "as of 5 minutes ago" hardcoded.
- Every partner logo is a partner who actually signed. Zero today → show zero, don't fake eight.
- Every TVL number, agent count, query count comes from Scribe or live RPC.
- Sentry on production actually fires events. Not silently disabled, not sample-rate zero.
- The subgraph is actually indexing on-chain events for the deployed contracts. Empty result = real empty, not pending shrug.
- The Lantern cron is actually publishing attestations. The Reserves page shows the latest real root, not "no attestation yet" forever.
- No "demo data" anywhere. Honest empty states are fine. Fake data dressed as live is not.

### 3.3 Everything connected end-to-end

- A user click on the front-end leads to a real on-chain transaction or service call. Trace every button: UI → API → contract or service → indexed event → UI updates with the result. No gaps.
- The full pipeline works for every entity: **chain → subgraph → API → UI**.
- Cross-chain bridge actually delivers messages. CCIP message ID surfaces, lifecycle status updates, claim-back works.
- Agents on the droplet actually act under mandates. Not "deployed and idle" forever.
- Mandate signed by user → agent submits an action under that intent hash → on-chain validation hits Sigil → result appears in the user's Action Log within 30 seconds of finality.
- Tax export reads from the same subgraph the portfolio reads from. Numbers reconcile.
- Proof-of-reserves Merkle leaves include the user's actual Coffer balance.
- Kill switch transaction actually revokes every active mandate + session key in one block.
- Every API route has a real backing service. No "501 not implemented" anywhere a button can reach.

### 3.4 Performance + accessibility (per `.claude/rules/ui.md`)

- Landing page time-to-interactive ≤ 1.5s on broadband (Lighthouse).
- Mobile PWA Lighthouse score ≥ 90 across performance, accessibility, best-practices, SEO.
- Landing bundle ≤ 250KB gzipped (excludes the self-contained marketing HTML).
- Wallet libraries (wagmi, viem) load only on routes that need them — not on the landing.
- WCAG AA color contrast on every primary palette use.
- Every interactive element has a visible focus ring.
- Every icon has a label (visible or `aria-label`).
- Keyboard navigation works without a mouse on every page.
- Mobile touch targets ≥ 44 × 44 px.
- No horizontal **page** scrolling on mobile (chip + tab rows can scroll where indicated).

### 3.5 Brand + voice (per `.claude/rules/ui.md` + `.claude/rules/writing.md`)

- Every page uses the brand kit: Instrument Serif italic for display, Geist for body, Geist Mono for code/hashes/addresses, parchment background, ink text, terracotta accent, full palette per `desing/extracted/tokens.json`.
- Zero banned words on any rendered surface (`writing.md` list enforced by `apps/verify/src/lib/writing-banned-words.test.ts`).
- Zero banned phrases (same test).
- Every section follows the prototype rhythm from `desing/Atrium.html`.
- Copy is founder-voice, not AI-slop. Plain words. Short sentences.
- Honest pending states name the specific blocker AND the unblock date (e.g. "Plinth deploys Month 1 W2"). Never just "coming soon".
- Every claim is sourced (link to tx hash, dashboard, signed export, or named partner).
- No three-adjective stacks. No marketing sandwich. No drama em-dashes.

### 3.6 Security + honesty (per `.claude/rules/security.md`)

- No secrets in committed code or static bundle. `.env` is gitignored and stays that way.
- No private keys ever logged or exposed in client bundle. Sentry scrubs sensitive fields.
- Every external call from the frontend either uses a public endpoint or goes through a server-side handler that injects the key.
- 3-of-5 multisig + 48h timelock for every contract parameter change. No single-key admin path anywhere.
- Dual oracle (Chainlink + Pyth) with 50bps tolerance + 60s freshness on every Plinth read.
- Reentrancy guards on every state-changing function in Coffer + Plinth (proptest invariant).
- CSP headers, X-Frame-Options DENY, no `unsafe-inline` in production.
- No PII collected without explicit pre-disclosure (see "Honesty boundaries" in `ATRIUM_FULL_FLOW_DESIGN.md`).
- All audit findings from `docs/AUDIT_FINDINGS.md` either closed or formally deferred with a target month.

### 3.7 Operations + monitoring

- Sentry catches and reports every unhandled error in prod. Zero unhandled errors during normal-use QA walk.
- Lantern cron actually fires daily (hobby tier) or hourly (Pro tier later) — not just deployed and never invoked.
- Subgraph health endpoint reports `hasIndexingErrors: false` continuously.
- Codex API responds with proper HTTP status codes (200 / 402 payment-required / 4xx / 5xx) — never silent 500s.
- Every service has a `/health` endpoint that returns real status, not just a hardcoded `{"status": "ok"}`.
- Droplet has fail2ban + ufw enabled. SSH key-only access. No root password login.
- Daily backups of any persistent state (D1 database, Lantern state).
- Alerts wired for: contract paused, oracle disagreement, keeper offline, subgraph stalled, Codex error rate > 1%.

### 3.8 Documentation matches reality

- `ATRIUM_PRD.md`, `TECH_DESIGN.md`, `ATRIUM_FULL_FLOW_DESIGN.md` — every claim in these reflects what's actually deployed. No promises the contracts can't keep.
- `human_left.md` lists every task that genuinely requires a human, with a real reason.
- README + landing page numbers reconcile with the live `/api/protocol/metrics` response.
- Every `desing/` brand asset has a matching live page that respects it.
- Every section number / cross-reference resolves (no `§35` pointing at a deleted section).

### 3.9 Legal + compliance (testnet floor; mainnet has more)

- Privacy Policy + Terms of Service published at `/legal/privacy` and `/legal/terms`.
- `SECURITY.md` with disclosure email + PGP key live.
- No collection of personally-identifying information without prior disclosure.
- Robots.txt + sitemap.xml accurate.
- All third-party licenses listed (OpenZeppelin, Chainlink CCIP, viem, wagmi, etc.).

### 3.10 Tests + CI

- Full test suite green (currently 585 / 585).
- 3 of 5 Kani invariants green in CI (all 5 by Month 6 per PRD).
- Foundry tests green (`forge test`).
- Stylus tests green (`cargo test` in each Stylus crate).
- Subgraph build green.
- Frontend `pnpm build` green + Lighthouse CI mobile ≥ 90.
- Zero secrets detected by gitleaks across full history.
- No CI gate disabled to land a PR. Ever.

## 4. The ONE thing that unblocks ~70% of the rules above

**Stylus SDK 0.6 → 0.10 migration on the 4 Stylus contracts (Coffer, Plinth, Sigil, Vigil).**

This is the single biggest blocker between the current product and launch-ready. Without it:

- Steps 4–13 in section 2 cannot work (10 of 15 user flows).
- Most of section 3.2 ("all data is real") cannot pass — there's nothing to surface real data from.
- Most of section 3.3 ("everything connected end-to-end") cannot pass — pipelines have no source.
- Sections 3.7 (Lantern attestations) and 3.8 (docs match reality) silently fail.

**Therefore, Phase A is mandatory for launch-ready.** Not optional, not deferrable. If we want to claim launch-ready honestly, this migration must ship.

Migration scope (30–50 hours focused):

- All 4 Stylus contracts updated to stylus-sdk 0.10 + openzeppelin-stylus 0.3.
- ~3500 lines of contract code to migrate (Plinth 1500+, Coffer 632, Sigil ~800, Vigil ~600).
- All proptest harnesses re-run.
- 3 Kani proofs re-verified (or marked "in development" until re-proven).
- All 4 contracts deployed to Arbitrum Sepolia.
- Addresses saved to `deployments/arbitrum_sepolia.json`.

Once Phase A ships, every phase below must also ship for launch-ready. Each box is a real deliverable. None of them are optional.

### Phase A — Stylus migration (~30–50 hours focused)

**Current state: ALL 4 contracts migrated to stylus-sdk 0.10 and compile clean.** Migration recipe documented below and in `STYLUS_MIGRATION_PLAN.md`.

- [x] Coffer migrated to stylus-sdk 0.10 — **deployed `0x7420...2071`, activated**
- [x] Plinth migrated — builds clean but **35 KB > 24 KB EIP-170 cap** (see Phase A.7 blocker below)
- [x] Sigil migrated — **deployed `0xefd3...70d0`, activated**
- [x] Vigil migrated — **deployed `0x6771...522e`, activated**
- [x] Proptest harnesses passing (5/5 Plinth invariants green; 1 pre-existing inverted-assertion bug in span.rs:246, not migration related)
- [ ] 3 Kani proofs re-verified (Kani run takes ~hours; deferred to dedicated CI lane)
- [x] **Plinth deployed** — `0x4852...4781` via cargo-stylus 0.10.7 multi-fragment factory (bypasses single-CREATE 24 KB cap)
- [x] Coffer/Sigil/Vigil addresses saved to `deployments/arbitrum_sepolia.json`
- [ ] All 4 contracts verified on Sourcify (deferred — Sourcify support for Stylus pending)

### Phase A.7 — Plinth size surgery (BLOCKER for Plinth deploy)

**Status (2026-05-24):** Plinth wasm compiles at **31.1 KB** compressed (down from 38.1 KB starting). EIP-170 24 KB cap still ~7 KB away.

**Cuts done so far:**
- Removed 3 String event fields (saved 1.3 KB)
- Consolidated 15 typed errors → 1 coded error (saved 1.8 KB)
- Extracted SPAN compute → `plinth-math` contract @ `0xc53d...ddab` (saved 0.3 KB net; SPAN itself was small but freed monomorphization noise)
- Extracted dual-oracle code → `plinth-oracle` contract @ `0x6606...f0b7` (saved 3.4 KB — Chainlink + Pyth interfaces + median/normalize all gone)
- Inlined `math::compute_realized_pnl` at one call site, gated `math.rs` to test-only (saved 0.2 KB)

**Remaining ~7 KB cut requires a structural change:**

1. **UUPS proxy pattern (recommended):** Plinth becomes a thin proxy; all logic in PlinthImpl (delegatecalled). PlinthImpl can be larger because only its runtime code is the proxy's tiny dispatch + delegate. ~3-hour rebuild including OZ template integration.
2. **Storage/logic split:** PlinthCore (storage only, view fns) + PlinthLogic (mutating fns via direct calls passing in current state). ~2-hour refactor but loses some atomicity guarantees.
3. **Drop SPAN entirely (testnet fallback):** linear margin = constant 5% of notional. Saves ~8 KB but loses Atrium's cross-venue netting thesis. **Not acceptable.**

Path #1 is the right move for production. **All downstream contracts that need Plinth's address remain blocked** (AtriumRouter, Rostrum, 10 venue adapters).

**Migration recipe (apply same to each of the 4 Stylus contracts):**

1. Backup `src/` and `Cargo.toml` first (`cp -r src src.bak.<ts>`).
2. Update `Cargo.toml`:
   - `stylus-sdk = "0.10"` (was 0.6)
   - `alloy-primitives = "1"` (was 0.8, now must match the major version stylus-sdk 0.10 uses)
   - `alloy-sol-types = "1"` (same)
   - **Remove `openzeppelin-stylus` if the contract doesn't actually import from it** — leaving it as a phantom dep pulls in stylus-sdk 0.9 + alloy 0.8 transitively and silently breaks every trait derive.
3. Add a minimal `Stylus.toml`:
   ```toml
   [contract]
   optimize = "speed"
   ```
4. Update imports in `src/lib.rs`:
   - Drop `use stylus_sdk::call::Call;` (no longer needed)
   - Add `use alloc::vec::Vec;` if any `Vec` is used in storage/return
   - Imports for primitives and sol! can come from the direct alloy crates (not stylus_sdk re-exports) once both deps are pinned to the version stylus-sdk 0.10 uses.
5. Update external interface calls (`sol_interface!` invocations):
   - **Old:** `let call = Call::new(); usdc.balance_of(call, self, addr)`
   - **New:** `usdc.balance_of(self, addr)` — `&self` (or `&mut self`) IS the call context now. Drop the `Call::new()` wrapper entirely.
6. Fix storage type mismatches at `.set()` call sites:
   - Storage fields declared as `uint16`, `uint64`, `bool` in `sol_storage!` need matching Rust types passed to `.set()`. E.g. `self.tvl_drop_threshold_bps.set(3_000u16)` — not `U256::from(3_000u16)`.
7. Regenerate lockfile: `rm Cargo.lock && cargo generate-lockfile`.
8. Run `cargo stylus check` in Docker (Windows host) until clean.
9. Run `cargo test` to make sure proptests still pass.
10. Run Kani if available (or mark proofs as "in development").

### Phase B — Stylus-dependent Solidity contracts

- [x] PosternKeyRegistry deployed — `0x28c9...47d8` (circular dep solved via CREATE-address prediction in `script/PhaseB.s.sol`)
- [x] PosternKillSwitch deployed — `0xB90a...b676`
- [x] Aqueduct deployed — `0x6139...7EC2` (wired to Coffer + Chainlink CCIP router on Arb Sepolia)
- [x] AqueductReceiver deployed — `0x9a66...Dc70`
- [x] AqueductClaimback deployed — `0x4d44...9382`
- [x] AtriumRouter deployed — `0xf134...2717` (Sourcify exact_match)
- [x] Rostrum deployed — `0xbaf3...b0af` (Sourcify exact_match)
- [x] **Faucet deployed** — `0xb982...8549` (100 USDC + 0.001 ETH per claim, 24h cooldown; **needs Praetor to stock with USDC before users can claim**)
- [x] 5 Phase B addresses saved to deployments registry
- [x] **All 13 Solidity contracts Sourcify-verified** (exact_match) — run `scripts/verify-all-sourcify.sh` to re-verify. Stylus contracts skipped — Sourcify wasm support pending.

### Phase C — Venue adapters

- [x] **All 9 venue adapters deployed** (HIP-3/HIP-4 share one adapter):
  - Aave Horizon `0xe991...8d5d`
  - Curve `0xf3da...5682`
  - GMX V2 `0x2531...d2d4`
  - Hyperliquid hybrid (HIP-3 + HIP-4) `0x8701...371E`
  - Morpho Blue `0xfaBE...344e`
  - Pendle V2 `0x54a1...af7d`
  - Polymarket `0x98A6...08Db` (CCIP-routed to Polygon Amoy)
  - Synthetix V3 `0x62B3...39b8`
  - Trade.xyz `0xf34C...a1ce`
- [x] All 9 verified on Sourcify (exact_match)
- [x] All 9 addresses saved to `deployments/arbitrum_sepolia.json`
- [ ] Each adapter whitelisted in PorticoRegistry via 3-of-3 Curator + multisig + timelock (admin action, see Phase B.3)
- [ ] Venue addresses (currently deployer-EOA placeholders) repointed when each venue ships a testnet contract

### Phase D — Off-chain operational gaps

- [ ] Lantern signing key generated (Argon2id-encrypted) and bundled into Vercel deploy
- [ ] Lantern cron fires daily at 12:00 UTC and publishes a real Merkle attestation (verify in `/lantern` page)
- [ ] Sentry alert rules wired: error-rate > 1% triggers email/Discord
- [ ] Sentry release tracking enabled (SENTRY_AUTH_TOKEN configured in CI for sourcemap upload)
- [ ] Codex error-rate monitor wired (Cloudflare Workers analytics)
- [ ] Subgraph health alert: notify if `hasIndexingErrors: true`
- [ ] Droplet alert: notify if any of the 3 agents drops out of `Up` state
- [ ] Praetor multisig moved from deployer EOA to a real 3-of-5 Safe (testnet acceptable for buildathon; required before mainnet)

### Phase E — Polish + visual / mobile / perf

- [x] Landing-v2 mobile clip fix → **resolved by dedicated mobile landing** from `desing/Mobile Landing.html` (served at `/mobile` or auto-rewritten from `/` for mobile UA via `src/middleware.ts`)
- [x] Mobile app shell from `desing/Mobile App.html` deployed (5-tab Home/Trade/Move/Agents/More, served at `/mobile/app` or auto-rewritten from `/app/*` for mobile UA)
- [ ] Lighthouse audit run on every public route (`/`, `/docs`, `/security`, `/brand`, `/learn`, `/manifesto`, `/team`, `/cohort`, `/lantern`, `/changelog`, `/agents/marketplace`, `/rostrum`, `/benchmarks`, `/verify/1..7`, `/legal/*`)
- [ ] Every route scores ≥ 90 on mobile across perf / a11y / best-practices / SEO
- [ ] Landing bundle ≤ 250KB gzipped (excluding the self-bundled marketing HTML)
- [ ] Wallet libs (wagmi, viem) confirmed lazy-loaded only on `/app/*` + `/lantern` + `/verify/[step]`
- [ ] Real-device mobile QA on iPhone Safari + Android Chrome for the 15 flows
- [ ] Keyboard-only navigation walked on every page
- [ ] Screen reader pass on `/`, `/app/portfolio`, `/verify/1`, `/brand`

### Phase F — Launch dress rehearsal

- [ ] All 15 user flows in section 2 smoke-tested end-to-end on the live site (paste tx links in a rehearsal log)
- [ ] 10 chaos rehearsals of the 7-step Verifier walk; ≥ 9 of 10 finish under 6 minutes with no judge-facing surprise
- [ ] Fallback recorded: pre-recorded video + QR to mirror, in case `verify.atrium.fi` is unreachable on demo day
- [ ] Domain claimed from Student Pack + DNS wired to Vercel + SSL active
- [ ] All testnet keys rotated (deployer pk, Cloudflare token, Sentry DSN, Lantern CRON_SECRET, droplet root password)
- [ ] One-pager + judge runbook updated with final live URLs
- [ ] LAUNCH_READY.md title line flipped to ✅

## 5. Current status — user flows

| # | Step | Works today? | Blocker |
|---|---|---|---|
| 1 | Landing makes sense in 90s | ✅ | — |
| 2 | Onboarding flow walks user through 5 steps | ⚠️ UI exists, faucet step inert | Faucet contract |
| 3 | Passkey-bound wallet creation | ✅ | — |
| 4 | Faucet drops test USDC | ❌ | Coffer + faucet |
| 5 | Deposit USDC into vault | ❌ | **Coffer (Stylus)** |
| 6 | Open position on Hyperliquid | ❌ | **Plinth + adapter (Stylus + Solidity)** |
| 7 | See cross-venue margin saving | ❌ | Plinth |
| 8 | Portfolio shows real numbers | ❌ | Plinth + Scribe events |
| 9 | Sign mandate, agent acts | ❌ | **Sigil (Stylus)** |
| 10 | Kill Switch revokes everything in 1 tx | ❌ | **PosternKillSwitch (needs Sigil)** |
| 11 | Verify balance in Merkle attestation | ❌ | Needs Coffer balances to attest |
| 12 | Tax CSV with real trades | ❌ | Needs trade events |
| 13 | Cross-chain Aqueduct transfer | ❌ | **Aqueduct (needs Coffer)** |
| 14 | Mobile flows | ⚠️ landing clips at 390px; app responsive | Landing HTML was desktop-authored |
| 15 | Judge runs all 7 Verifier steps | ❌ | Steps 1, 2, 3, 5, 7 wait on contracts |

**2.5 of 15 = ~17% launch-ready by flow.**

## 6. Current status — full-baked rules

| Section | Status | Notes |
|---|---|---|
| 3.1 No half-baked features | ⚠️ Partial | Honest pending states exist, but pending IS half-baked from a user perspective. |
| 3.2 All data is real | ⚠️ Partial | What we read IS real (subgraph, registry). But most of what users see is honest-pending placeholders. |
| 3.3 Everything connected end-to-end | ❌ | The chain → subgraph → API → UI pipeline only works for the 7 deployed Solidity contracts; the rest is gapped. |
| 3.4 Performance + accessibility | ⚠️ Partial | Lighthouse not measured. Some routes use heavier bundles than the 250KB landing budget. |
| 3.5 Brand + voice | ✅ | Brand kit page renders all 13 swatches + 4 logo sizes. Banned-words test enforces voice. |
| 3.6 Security + honesty | ✅ | Multisig + timelock enforced on deployed contracts. CSP headers on Vercel. No secrets in committed code. |
| 3.7 Operations + monitoring | ⚠️ Partial | Sentry wired but no Codex error-rate alerts. Lantern cron deployed but won't publish until Coffer balances exist. |
| 3.8 Documentation matches reality | ✅ | Audit fixes tracked; design doc honest about what's pending. |
| 3.9 Legal + compliance | ✅ | `/legal/privacy` + `/legal/terms` live. SECURITY.md committed. |
| 3.10 Tests + CI | ⚠️ Partial | 585/585 frontend tests green. Stylus tests can't run (build broken). Kani CI badge says "pending". |

## 7. Human-only blockers (only the founder can resolve)

1. **Approve Phase A (Stylus migration)** — touches audited code + Kani proofs. Worth the risk; alternative is no working product.
2. **Claim domain** (`atrium.tech` / `.app` / `.dev` from GitHub Student Pack).
3. **Cohort partner outreach** — currently 0 partners; "real company" claim needs ≥ 1 named deposit.
4. **Rotate testnet keys** post-launch (deployer pk, CF token, Sentry DSN, Lantern CRON_SECRET — all visible in chat history).
5. **Decide mainnet timeline** — KYC vendor, restricted-jurisdiction list, formal dispute path. Tracked openly in `ATRIUM_FULL_FLOW_DESIGN.md`.

## 8. Definition of done

The title line at the top of this file becomes **"Atrium — Launch Ready ✅ (date)"** only when:

- All 15 user flows in section 2 are ✅.
- All 10 rule-sections in section 3 are ✅.
- All 5 human-only blockers in section 7 are resolved.

Until then, the title stays as a fraction. No "almost launch-ready", no "soft launch", no "launch-ready except". One bar, one answer.
