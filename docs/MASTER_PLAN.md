# Atrium Master Plan — Build → Test → Testnet Launch

**Owner:** Atrium core team
**Last updated:** 2026-05-28
**Source audits:** 12 reports under `audits/` and `.scratch/audit/` totalling ~450 findings.
**Target:** testnet launch ready. Mainnet items are listed but deferred.
**Rule:** no half-baked fixes. Every finding gets the best possible solution, not the quickest.

---

## 0. How to read this plan

Twelve sequential phases. Each phase has:

- A goal (what "done" looks like)
- The findings it closes (with audit IDs)
- The best solution chosen for each, with rationale
- Reference implementations under `resources/` to copy patterns from
- Free Student Pack tooling used
- Exit criteria (how to know the phase is complete)

`docs/plan-tracker.md` is the live checklist. Every finding ID across all 12 audit files maps to a phase here and gets ticked off there.

Phases 0–4 are the security and correctness foundation. Phases 5–7 make the product complete. Phases 8–11 are launch readiness. Phase 12 is operations.

When a phase blocks on another, the dependency is named. Otherwise sub-tasks within a phase can run in parallel.

---

## 1. Mission

Atrium ships cross-venue portfolio margin on Arbitrum Sepolia. The honest version, with no fake numbers, no broken handlers, no half-shipped contracts. The bar for testnet launch is institutional-grade quality at testnet scope: real money is not at risk yet, but every promise the UI makes must be true, every service must work end-to-end, every claim must have a source, and the security posture must support the move to mainnet without a rewrite.

What "testnet launch ready" means in practice:

- Any address can sign in, deposit testnet USDC, open a hedged position, see real margin maths, watch a Lantern attestation include their balance, and revoke every mandate with one click.
- Every chart, counter, and dashboard reads from a real source. No `useState(4.13)`, no `setInterval` increments, no hardcoded venue amounts.
- All 7 verifier steps execute end-to-end against deployed contracts.
- All 5 mobile flows work on a real iPhone and a real Android device.
- The notifier delivers liquidation, oracle, and mandate alerts to email/telegram within 60s of the event.
- The proof-of-reserves tree is correct: every depositor included, every balance share-redemption-aware, RPC cross-validated.
- A user with a connected wallet on the wrong chain sees a banner. A user on a paused contract sees why. A user with insufficient balance sees it before signing.
- Privacy policy + terms + cookie consent are GDPR/CCPA compliant for global users.
- Status page reports real uptime. Discord exists. Domain DNS resolves. PGP key is published.
- Every secret is in Doppler. No `.env` on disk. The leaked deployer key is rotated.

---

## 2. Tooling stack — GitHub Student Pack mapping

Free credits chosen so $0/month covers the whole launch. Cost in parens is the value of the offer.

| Need | Tool | Tier | Why |
|------|------|------|-----|
| Secrets management | Doppler Team | free while student | Replaces `.env` on disk. Closes incident #25 properly. |
| Error tracking | Sentry Student | 50K errors/100K txns/1GB attachments | Already wired; consent gate + PII scrub added in Phase 3. |
| APM + uptime | New Relic Student | $300/mo equivalent | Covers app metrics, browser RUM, alerts. |
| Cron monitoring | Honeybadger Small | 1 year | Pings every cron tick, alerts on miss. |
| Daemon hosting | DigitalOcean | $200 credit, 1 year | Notifier + vigil-keeper move off GHA cron. |
| Static analytics | SimpleAnalytics Starter | 100K page views/mo, 1 year | Privacy-friendly, replaces Vercel Analytics for GDPR. |
| Code coverage | Codecov | private repos free | Already wired. Ensure all jobs upload. |
| Code quality | CodeScene + DeepScan | free | Static analysis on PRs. |
| Cross-browser/mobile testing | BrowserStack + LambdaTest | 1 year each | Real iOS/Android devices. |
| Status page hosting | Upptime on GitHub Pages | free | YAML-driven, public, alert wiring. |
| Domains | Namecheap (.me) + .TECH (.tech) + Name.com (.live/.app) | 1 year free each | `status.atrium.fi`, `atrium.tech` redirect. |
| SSL | Namecheap PositiveSSL | 1 year free | Pin status page to HTTPS-only. |
| 1Password | Team Developer | 1 year | Shared vault for non-secret team creds. |
| Feature flags | DevCycle Starter | 1 year | Gradual rollout for new mandates UI etc. |
| AI pair programming | GitHub Copilot Student | free | IDE assist for the team. |
| Web app firewall | AstraSecurity | 6 months | Bot mitigation, malware scan. |
| Wallet ops | not needed | – | Wallet flows are wagmi + Coinbase Smart Wallet (Postern) — no Clerk needed. |

What we will NOT use from the pack to avoid scope creep: MongoDB Atlas (we already index on chain via Scribe; off-chain DB only needed for notifier KV which Upstash Redis covers under DO bandwidth), Heroku (DO fits our daemon needs better), Datadog (New Relic covers the same ground; pick one).

What costs money and is mainnet-only:
- Real audit firm engagement (Trail of Bits, OpenZeppelin) — $30K–$100K
- Privacy lawyer GDPR review (~$2K–$5K) — recommended but not blocking testnet if we follow the GDPR template carefully
- Bug bounty program funding (Immunefi tier) — defer to mainnet
- Real Gnosis Safe gas — minimal, but signers must be coordinated

---

## 3. Phases at a glance

| # | Phase | Goal | Days | Closes (audit groups) | Blocks |
|---|-------|------|------|-----------------------|--------|
| 0 | Foundation | All Student Pack accounts active, secrets in Doppler, leaked keys rotated, domains registered. | 2 | Critical #1, #25, #66, F16 | – |
| 1 | Truth | Every fake number on the site is replaced with a real source or honestly absent. Stale docs aligned to reality. | 3 | #2, #5, #6, #35, #36, #37, P-1, P-2, P-3, LV-04..21 | 0 |
| 2 | Critical bugs | All Critical contract findings fixed and redeployed. Notifier resurrected. Unauth APIs locked. SSRF closed. | 5 | #3, #10, #11, #12, #13, #41, #42, W2-C1..C3, W2-H1..H7, CRT-01, CRT-02, SD-1, SD-2, HIGH-05, HIGH-06 | 0 |
| 3 | Security | CSP/HSTS, GDPR consent, SIWE auth on every mutation route, rate limiting, GHA hardening, secret hygiene end-to-end. | 4 | F1..F32, CRT-06, MED-01..07, FULL_AUDIT #14..16, #46..48, #53 | 2 |
| 4 | Subgraph + indexing | Every entity has a writer. Every event has a handler. Every consumer cross-validates with RPC. `_meta` health checks live. | 4 | #19, #20, #43..45, #57, #58, SD-1..27 | 0 |
| 5 | Frontend completeness | Every page passes the 6-state UI check. All 5 mobile flows have dedicated panels. WCAG AA. PWA installable. SEO clean. | 7 | #17, #18, #23, #24, #27..34, #59..62, A11Y-01..13, PERF-01..08, SEO-01..10, MC-1..19, TX-1..11, W-1..7, NET-1..3, E2E-01..63, L-14..30 | 1 |
| 6 | Off-chain services | Tablet, notifier, lantern-attestor, vigil-keeper, codex, agents all functional with FX, pagination, auth, integration tests. | 4 | #7, #8, #9, #20, #22, #26, #39, #49, #50, #51, #52, #68, #69, HIGH-07..13 | 0, 2, 4 |
| 7 | Infrastructure | Daemons on DO, Doppler secrets pipeline, status page live, DNS provisioned, Discord live. | 3 | L-7, L-8, L-9, L-33, infra rows in wave2-product | 0 |
| 8 | Stylus wiring | Timelock txs #335 + #337 executed. Verifier steps 2/3/5 wired. Full 7-step demo runs end-to-end. | 2 | E2E-01, E2E-40, P-4, P-5, LV-01 | 2 |
| 9 | Testing | Foundry integration tests, matchstick handler tests, 5-mobile-flow Playwright, adapter conformance suite, Halmos additional proofs. | 6 | #21, #22, #52, SD-14, SD-27, L-10 | 2, 4, 5, 6, 8 |
| 10 | Legal | GDPR-grade privacy, terms, cookie consent banner, accessibility statement, KYC disclosure, bug bounty scope, sub-processor list. | 3 | L-1..6, L-12, L-13, F5, websec consent items | 3 |
| 11 | Launch prep | Brand consistency, OG image, PWA icons, status page wired to footer, CHANGELOG, audits relocated, repo hygiene. | 3 | #60, L-7, L-14..32, L-38..44, E2E-35..39, repo cleanup | 7, 10 |
| 12 | Observability + soft launch | New Relic dashboards, Honeybadger crons, Sentry final, status page live data, alerting routed to Discord ops + email. | 2 | F22, indexer health, infra observability | 7, 11 |

Total: ~48 days of focused team work. With a "big team", phases 1, 4, 5, 6, 9 can be split across people in parallel after Phase 0 lands.

---

## 4. Phase 0 — Foundation (Days 1-2)

### Goal

Every Student Pack account is active. Every secret is in Doppler. Every domain is reserved. The leaked deployer key is rotated. The team has shared password access. CI is healthy.

### Findings closed

| ID | Title | Source |
|----|-------|--------|
| Critical #1 | `.env` on disk has real Cloudflare token, Graph Studio key, deployer key, cron secrets | FULL_AUDIT |
| #25 | Deployer key leak incident (May 24) follow-up still unchecked | FULL_AUDIT |
| F16 | Deployer key rotation 4 days overdue | wave1-websec |
| #66 | `bash.exe.stackdump` exists in repo root | FULL_AUDIT |
| L-21 | `atrium_goal_audit_prompt.md` tracked in repo root | wave1-launch-brand-legal |
| L-22 | `ANTIGRAVITY_DEEP_AUDIT_REPORT_2026-05-28.md` in repo root | wave1-launch-brand-legal |
| L-23 | `FULL_AUDIT_2026-05-28.md` in repo root | wave1-launch-brand-legal |

### Best solution per item

#### 0.1 Secrets — Doppler-first, `.env` files banned

**Rationale:** The leaked-key incident already happened once. The fix is not "be more careful with `.env`," it is "make it impossible to commit `.env`." Doppler injects env vars at runtime via `doppler run -- pnpm dev`. The repo never sees real values.

Steps:
1. Activate Doppler via Student Pack.
2. Create three projects: `atrium-dev`, `atrium-staging`, `atrium-prod`. Each has configs for: `verify-app`, `notifier`, `vigil-keeper`, `lantern-attestor`, `tablet`, `codex`, `agents`, `praetor-cli`.
3. Move every secret currently in `.env` to the right Doppler config. List from FULL_AUDIT #1: Cloudflare token, Graph Studio key, deployer key, cron secrets, Sumsub webhook secret, Sentry DSN, RPC URLs, Telegram bot token, Resend API key, Vercel KV token.
4. Generate a fresh deployer EOA with `cast wallet new` offline. Transfer admin ownership of Plinth, Coffer, Vigil, Sigil to the new EOA via `PraetorTimelock.schedule(target, transferAdmin)` then execute after 48h. Until then, the rotation is half-done.
5. Update Vercel project env: delete every env var set in the dashboard, replace with `DOPPLER_TOKEN`. Vercel reads token, calls Doppler at build, gets the rest.
6. Update GitHub Actions: replace per-secret references with `doppler secrets download --no-file --format env`. Single `DOPPLER_TOKEN` repo secret.
7. Replace local dev `.env` with `.env.example` only. Add `.env*` to `.gitignore` (already is, verify).
8. Run `gitleaks detect --source . --redact` to confirm no secret remains in history. If history has the leak, decide: rewrite history (BFG repo cleaner) vs accept — for testnet-launch, history rewrite is overkill if all keys rotated.

Reference: Doppler's `setup` and `run` commands. No `resources/` reference because Doppler is SaaS.

Exit: `git ls-files | grep -i env` returns only `.env.example`. `gitleaks` exits 0. Old deployer EOA has zero admin privileges anywhere.

#### 0.2 Domain reservation

Two domains needed:
- `atrium.fi` — already registered (assumed; if not, register via Namecheap with the .me free promo or Name.com promo. .me/.fi/.tech are all viable but `.fi` matches the existing brand).
- `status.atrium.fi` — subdomain on the same registrar. DNS A record points to GitHub Pages IP for Upptime hosting (Phase 7).

Optional vanity: `atrium.tech` via .TECH free domain → 301 redirect to `atrium.fi`. Useful for press-kit URLs and brand recall.

Exit: `nslookup atrium.fi` and `nslookup status.atrium.fi` resolve.

#### 0.3 Repo hygiene

| Action | File | Rationale |
|--------|------|-----------|
| Delete | `bash.exe.stackdump` | Crash artifact, not source |
| Move | `FULL_AUDIT_2026-05-28.md` → `audits/2026-05-28-full-audit.md` | Audits live under `audits/` |
| Move | `ANTIGRAVITY_DEEP_AUDIT_REPORT_2026-05-28.md` → `audits/2026-05-28-antigravity-deep-audit.md` | Same; rename to drop "ANTIGRAVITY" branding |
| Gitignore | `atrium_goal_audit_prompt.md` | Internal AI prompt file |
| Gitignore | `.scratch/` | Internal scratch — already done? verify |
| Verify | `JUDGE_ONE_PAGER.md` not tracked (LV-41) | `git rm --cached` if tracked |

Exit: `git status` clean after the moves; root has no audit/log files.

#### 0.4 Account setup checklist

For each, complete sign-up via Student Pack and store the API token in Doppler:
- [ ] Doppler (auth tokens for each project)
- [ ] DigitalOcean ($200 credit applied)
- [ ] Sentry (DSN already exists; verify Student tier is applied, raises quota)
- [ ] New Relic (license key)
- [ ] Honeybadger (project tokens for each daemon)
- [ ] SimpleAnalytics (site code for verify-app)
- [ ] Namecheap (domain controls)
- [ ] BrowserStack (username + access key for CI)
- [ ] LambdaTest (same)
- [ ] DevCycle (project SDK key)
- [ ] AstraSecurity (site key for the Vercel domain)
- [ ] 1Password Team (vault for the team)
- [ ] Codecov (already wired; verify token)
- [ ] CodeScene + DeepScan (GitHub App install)

Exit: every tool is reachable from the team's 1Password vault entry titled "atrium-tools".

### Exit criteria for Phase 0

- `gitleaks` clean.
- Old deployer EOA has zero admin role on any contract (verified via on-chain reads).
- New deployer EOA's private key is in Doppler `atrium-prod` only.
- `doppler run -- make demo` boots the local stack with no `.env` file present.
- `verify.atrium.fi` still gated behind Vercel auth (intentional — opens in Phase 11).
- Status page domain DNS resolves.
- All Student Pack accounts active and tokens in Doppler.

---

## 5. Phase 1 — Truth (Days 3-5)

### Goal

Every number visible on every public surface is either real (sourced from a live API/contract read) or honestly absent ("pending"/"—"). Every doc that contradicts the deployed reality is corrected. The honesty page itself becomes truthful.

This phase is mostly text and component swaps. No contracts redeploy. No infrastructure changes. It's the highest-impact-per-hour phase: most credibility-killer findings die here.

### Findings closed

| ID | Source | Component / file |
|----|--------|------------------|
| Critical #2 | FULL_AUDIT | `MobileLanding.tsx` fake stats |
| #5 | FULL_AUDIT | `.gitignore` Claude/AI comments |
| #6 | FULL_AUDIT | `CONTRIBUTING.md` Claude reference |
| #35 | FULL_AUDIT | `docs/deployment.md` personal Vercel URLs |
| #36 | FULL_AUDIT | `docs/deployment.md` "conversation log" reference |
| #37 | FULL_AUDIT | `audits/month-2-5-half-baked-audits.md` filename |
| #38 | FULL_AUDIT | `SECURITY.md` references missing `docs/prd.md §21` |
| P-1 | wave2-product | `Numbers.tsx` fake metrics |
| P-2 | wave2-product | `MobileLanding.tsx` fake stats (mobile detail) |
| P-3 | wave2-product | Landing "Building with" partner strip |
| P-5 | wave2-product | `deployment.md` status table contradicts JSON |
| LV-01 | wave1-live-verify | `deployment.md` Stylus "BLOCKED" wrong |
| LV-02 | wave1-live-verify | `deployment.md` lantern-attestor address mismatch |
| LV-03 | wave1-live-verify | `deployment.md` 7 contracts vs JSON 30+ |
| LV-04 | wave1-live-verify | `Numbers.tsx` fabricated |
| LV-05 | wave1-live-verify | `MobileLanding.tsx` 18 fake values |
| LV-06 | wave1-live-verify | `MobileLanding.tsx` partner logos |
| LV-07 | wave1-live-verify | `hero-section.tsx` "live testnet feed" label on static data |
| LV-08 | wave1-live-verify | `Features.tsx` fake portfolio |
| LV-09 | wave1-live-verify | Faucet copy "$10K USDC + $5K rAAPL" wrong |
| LV-10 | wave1-live-verify | `JUDGE_ONE_PAGER.md` references non-existent `docs/AUDIT_FINDINGS.md` |
| LV-11 | wave1-live-verify | `docs/ROADMAP.md` referenced 20+ times, doesn't exist |
| LV-12 | wave1-live-verify | `*-staging.atrium.fi` URLs unreachable (text-only fix here; provisioning in Phase 7) |
| LV-13 | wave1-live-verify | `SECURITY.md` PGP key URL — defer publish to Phase 10, fix text now |
| LV-14 | wave1-live-verify | `SECURITY.md` 48-hour SLA without process — soften wording |
| LV-15 | wave1-live-verify | `CONTRIBUTING.md` $5K ARB grants — qualify |
| LV-16 | wave1-live-verify | `CONTRIBUTING.md` references empty test directory |
| LV-17 | wave1-live-verify | "Thirteen ship at launch" — derive from registry |
| LV-18 | wave1-live-verify | "94 patches landed" without source |
| LV-19 | wave1-live-verify | Honesty page lies about MobileLanding fix |
| LV-20 | wave1-live-verify | Hero "live testnet feed" label |
| LV-21 | wave1-live-verify | `MobileApp.tsx` hardcoded fake portfolio |
| LV-26 | wave1-live-verify | `JUDGE_ONE_PAGER.md` "no number invented" closing claim contradicts simulated backtest |
| L-3 | wave1-launch-brand-legal | Desktop landing fake metrics (same root as P-1) |
| L-40 | wave1-launch-brand-legal | `PARTNERS` array unverified |
| L-43 | wave1-launch-brand-legal | Manifesto $3M / $500K without footnote |
| L-44 | wave1-launch-brand-legal | Codex pricing without source |
| E2E-22 | wave2-e2e | Landing renders both honest `NumbersSection` AND fake `Numbers` |
| E2E-24 | wave2-e2e | Honesty page dishonest |
| E2E-26 | wave2-e2e | Lantern "hourly" vs 10-min cron inconsistency |
| E2E-28 | wave2-e2e | Agent marketplace implies live performance |
| E2E-29 | wave2-e2e | Rostrum "live PnL never invented" copy with no agents trading |

### Best solution per cluster

#### 1.1 Kill every fake-data component

The `Numbers.tsx`, `Features.tsx`, `MobileLanding.tsx`, and `MobileApp.tsx` files were Lovable design-tool ports kept around for visual reference. They contain `useState(4.13)`, hardcoded venue dollar amounts, and `setInterval` increments. Each renders alongside or instead of the real data-driven components.

Best path: **delete the Lovable-port components, render the real data-driven components in both desktop and mobile breakpoints.** Since these are visual mockups not used as-is, replacement is straightforward.

Plan:
1. Delete `apps/verify/src/components/atrium/landing/Numbers.tsx`, `Features.tsx`, the entire `apps/verify/src/components/atrium/mobile/MobileLanding.tsx` file, and `MobileApp.tsx` and `DesktopApp.tsx` Lovable ports.
2. The honest replacements already exist:
   - Desktop: `NumbersSection`, `HeroSection` (with corrected labels per 1.2), `CohortSection` (already empty-state), `PortfolioMock` (rename to `PortfolioPreview`, add "Design preview · not live data" disclosure or wire to live `/api/portfolio/summary` for the demo wallet).
3. Mobile: build true mobile panels in Phase 5. For now, in Phase 1, the landing renders the desktop layout responsively at `< md` until Phase 5 ships dedicated mobile panels. The double-render (`MobileLanding` + desktop CSS-hidden) bug (PERF-06, E2E-62) dies the moment the Lovable-port component is deleted.
4. `apps/verify/src/lib/atrium/mock.ts` — rename to `apps/verify/src/lib/atrium/static.ts` (subsystem catalog, venue list — these ARE static data, just not "mock"). Remove `PARTNERS` array.

Reference: existing `NumbersSection` is the pattern — fetch via TanStack Query, render skeletons during load, render error state on failure, render "—" when value is null.

Exit: `grep -r "useState(4.13)" apps/verify/src/` returns zero. `grep -r "PARTNERS\s*=" apps/verify/src/lib/atrium/` returns zero. `grep -r 'setInterval.*tvl\|setInterval.*queries' apps/verify/src/` returns zero.

#### 1.2 Hero section labels

`hero-section.tsx` renders pool/venue cards with hardcoded design-reference dollar amounts and labels them "live testnet feed." Fixing this is a label issue, not a data issue (these aren't claimed to be live, the label just lies).

Best path: pick one of two options based on what we want the hero to do.

- Option A (chosen): wire the venue cards to `/api/protocol/metrics` or a new `/api/landing/hero` route that returns real venue TVL where measurable, null where not. Render real numbers when present, "—" otherwise. Drop the static reference values.
- Option B: keep the cards as static but change the label to "Plan view · static reference" and remove animation that implies liveness.

Option A is the BEST per the no-half-baked rule. Implement:

```ts
// apps/verify/src/app/api/landing/hero/route.ts
// Returns: { poolValueUsd, venues: [{ slug, label, tvlUsd, status }] }
// poolValueUsd = sum of cofferUserBalances (paginated) + ccip in-flight
// venues[].tvlUsd = adapter.totalSupplied() via viem read, null if RPC fails
```

Reference: `apps/verify/src/app/api/protocol/metrics/route.ts` is the right template — same `formatUsd`, same null fallback, same `source: 'pending' | 'scribe'` shape.

Exit: hero renders real numbers from a single API call, with skeletons/empties.

#### 1.3 Faucet copy match reality

`MobileLanding.tsx` (now deleted) had the wrong copy. The faucet drops 5 USDC + 0.0005 ETH per claim. The onboarding faucet step also has a fallback drops array showing `10,000 USDC` and `3 WETH` — both fake.

Best path:
1. The onboarding faucet step fetches `/api/faucet/status` which reads the on-chain faucet contract. Render the actual `dropAmount` from the contract response, no hardcoded fallback.
2. If the contract call fails, render "Faucet drops are paused — see status.atrium.fi" with no fake values.
3. Update any prose copy referring to faucet drops to match the contract values dynamically.

Exit: `grep -r '10,?000.*USDC\|10K.*USDC' apps/verify/src/` returns zero hits in component files. The faucet contract value is the only source.

#### 1.4 Fix `docs/deployment.md` to reflect on-chain reality

The status table claims Stylus is BLOCKED but the JSON has addresses. The contract list shows 7 contracts but the JSON has 30+. The lantern-attestor address points at the deprecated v1 contract.

Best path: **`docs/deployment.md` becomes a generated file**. Source of truth is `deployments/arbitrum_sepolia.json`. A script generates the markdown table.

```js
// scripts/generate-deployment-doc.mjs
// reads deployments/arbitrum_sepolia.json
// writes docs/deployment.md from a template
// run by CI on every push (or pre-commit hook)
```

The doc has:
- Header (testnet info, RPC URL, chain ID).
- A table per category: Stylus, Solidity core, adapters, oracle, helpers.
- Each row: name, address (Arbiscan link), tx, deploy block, kind, version, deploy timestamp.
- A status pill column derived from a single `status` field per contract in the JSON: `live | pending-timelock-tx | deprecated`.
- Personal Vercel URLs (`pratiikpys-projects`) removed (#35).
- "Conversation log" reference removed (#36).

Half-baked alternative: hand-edit. Rejected because the doc will drift again the moment the next deploy lands.

Exit: `make deployment-doc` regenerates `docs/deployment.md` and `git diff` is empty after a fresh deploy.

#### 1.5 Honesty page becomes honest

`/docs/honesty/page.tsx:113` claims `MobileLanding` was fixed in the 2026-05-25 audit. With 1.1 done, the claim becomes true. Rewrite the section anyway to reference the specific commit/PR that landed each fix and the audit ID it closed. Add a "last verified" date that bumps on every change to the page.

Replace any other forward-looking claims ("we will...") with present-tense facts about what's actually shipped. If something isn't shipped, the honesty page must say "pending" or remove the claim.

Exit: every claim on the honesty page is independently verifiable by clicking through to the linked code/audit.

#### 1.6 PARTNERS strip — replace with technology stack

`PARTNERS = ["Pendle Labs", "Variational", "Horizen", ...]` — none signed. The footer says "Building with..." which implies partnership.

Best path: replace with **technology stack** instead of company partnership names:

```tsx
// Building on:
// - Arbitrum (testnet)
// - Stylus (Rust contracts)
// - Chainlink CCIP + Data Streams
// - Pyth Network (price feeds)
// - The Graph (Scribe indexer)
// - ERC-4337 (Postern smart wallets)
// - ERC-8004 (Sigil agent identity)
// - x402 (Codex paid APIs)
```

This is honest: we ARE building on these protocols (per `resources/` and the actual code). Use brand-allowed marks for each (Arbitrum, Chainlink, Pyth all have public usage policies). Remove company-partnership framing entirely until LOIs are signed.

When a partner signs an LOI, restore `PARTNERS` array gated by signed-source-of-truth (a JSON file checked in only after the signed PDF lands in `1Password > atrium-partner-LOIs`).

Exit: landing strip lists technologies, not partner companies. `grep PARTNERS lib/atrium/` returns only documentation comments.

#### 1.7 `JUDGE_ONE_PAGER.md` and `docs/ROADMAP.md`

These are referenced in 20+ places but `docs/ROADMAP.md` is gitignored and `JUDGE_ONE_PAGER.md` is buildathon-specific.

Best path:
1. `docs/ROADMAP.md` — publish a real one. Remove from `.gitignore`. Convert internal phase plans into a public-facing roadmap with Q-by-Q milestones. Use this MASTER_PLAN.md as the source for current priorities; the public roadmap is a redacted view.
2. `JUDGE_ONE_PAGER.md` — keep gitignored. It's an internal demo prep doc. Verify with `git ls-files JUDGE_ONE_PAGER.md` that it's not tracked. Replace any references in tracked files with a generic "demo flow" link to `/verify`.
3. `docs/AUDIT_FINDINGS.md` — also gitignored but referenced from the public-facing audit-findings table component. Two options:
   - Generate `docs/audit-findings.md` from the consolidated audit files (this MASTER_PLAN's tracker can be the source).
   - Remove the reference from the component.

Best path: generate. The public audit-findings table is high-trust value and directly grounded in this audit work.

Exit: every `docs/ROADMAP.md` reference points at a real file. Same for `docs/AUDIT_FINDINGS.md`. `JUDGE_ONE_PAGER.md` references are removed or redirected.

#### 1.8 SECURITY.md and CONTRIBUTING.md cleanups

- SECURITY.md `docs/prd.md §21` reference (#38) — either publish prd.md (similar to ROADMAP, with redactions) or rewrite the reference to point at concrete public docs (architecture.md, this MASTER_PLAN, security.md convention).
- SECURITY.md "48-hour response" SLA (LV-14) — soften to "Best-effort 48-hour acknowledgment. Critical issues triaged the same day." Add a sentence: "Until a paid security ops rotation lands, response is best-effort by the founding team."
- SECURITY.md PGP key (LV-13) — fix the URL or remove the encryption ask. Phase 10 publishes a real key; for now, change the URL to a placeholder note: "Public PGP key publication is in progress (target: Phase 10 of MASTER_PLAN). Until then send unencrypted with subject `[security] ...` and we will follow up over Signal."
- CONTRIBUTING.md $5K ARB grants (LV-15) — qualify: "Grant program activates after testnet launch and is funded by the Praetor treasury post-mainnet. Until then, contributors are credited in CONTRIBUTORS.md and the changelog."
- CONTRIBUTING.md adapter conformance test reference (LV-16) — keep the reference because Phase 9 ships the tests. Add a note: "Conformance suite ships in Phase 9 of the master plan; until then PRs without it will be reviewed manually against the IPorticoAdapter interface."
- CONTRIBUTING.md / `.gitignore` Claude references (#5, #6) — generic-ize: "AI tooling configuration files." Verify `docs/conventions/git.md` also uses generic phrasing.
- "Thirteen ship at launch" (LV-17) — derive the count from `deployments/arbitrum_sepolia.json` at build time, render as `${liveContracts.length} ship at launch`. Update or delete the static prose.
- "94 patches landed" (LV-18) — replace with a link to the tracked audit-findings file, or to the audits/ directory. Don't claim a number that has no source.
- `audits/month-2-5-half-baked-audits.md` filename (#37) — rename to `audits/month-2-through-5-followups.md`. Update internal references.

Exit: every cited document exists, every numeric claim has a source, every aspirational statement is qualified.

#### 1.9 Lantern cadence consistency (E2E-26)

`/lantern/sla` says "hourly" attestations. The cron runs every 10 minutes. Pick one and align all copy.

Best path: keep the 10-min cadence (more frequent = better proof of reserves). Update all copy to say "every 10 minutes" or "≤10 minutes." Update the SLA threshold (`STALE_THRESHOLD_SECONDS` in `reserves/summary/route.ts`) to match: 2× cadence + 5 min grace = 25 min.

Exit: every reference to attestation cadence says 10 minutes; the staleness threshold matches.

#### 1.10 Marketplace + Rostrum copy honesty (E2E-28, E2E-29)

`/agents/marketplace` and `/rostrum` show agents that don't actually trade. Phase 6 makes them trade for real. For Phase 1, fix the copy.

Best path:
- Marketplace: add a banner "Reference agents — strategy logic ships in Phase 6. PnL columns show 'pending' until then."
- Rostrum leaderboard: change the page subtitle to "Action attestation log" until agents trade. The current "live PnL — never invented" is technically not invented (the column shows null) but it implies agents trade.
- After Phase 6 lands real strategy logic, restore the original copy.

Exit: a user reading marketplace or Rostrum gets an accurate impression of what works today vs Phase 6.

### Exit criteria for Phase 1

- `grep -rE 'useState\(\s*[0-9.]+M?\s*\)' apps/verify/src/components/atrium/landing/ apps/verify/src/components/atrium/mobile/` returns zero.
- `grep -r 'PARTNERS\s*=' apps/verify/src/lib/atrium/` returns zero.
- The honesty page passes a self-audit: every claim links to evidence.
- `docs/deployment.md` is generated, matches `deployments/arbitrum_sepolia.json` 1:1.
- `docs/ROADMAP.md` exists with public content.
- A first-time visitor on the landing sees only real or honestly-pending numbers.

### Resources used

- `resources/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol` — pattern for storage-slot constants when generating doc tables (we reuse the storage-slot encoding pattern in 1.4 for status tags).
- `resources/graph-tooling/examples/` — for Scribe-driven values in landing hero (Phase 1.2 and beyond).



---

## 6. Phase 2 — Critical bugs (Days 6-10)

### Goal

Every Critical-class contract bug fixed and redeployed. Notifier service resurrected from dead. Unauthenticated APIs locked down. SSRF webhook closed. Initialize front-run windows closed.

This is the highest-risk phase: contract redeploys touch live state. Schedule each redeploy through PraetorTimelock with a written rollback plan.

### Findings closed

| ID | Severity | Source | Issue |
|----|----------|--------|-------|
| #3 | Critical | FULL_AUDIT | PlinthMath returns U256::ZERO on array mismatch |
| #10 | High | FULL_AUDIT | Vigil queue_liquidation not gated by is_paused |
| #11 | High | FULL_AUDIT | Coffer/Sigil/Vigil initialize() front-run window |
| #12 | High | FULL_AUDIT | Rostrum mirrorOpen any-relayer |
| #13 | High | FULL_AUDIT | Aqueduct resume() onlyPraetor bypasses timelock |
| #41 | Medium | FULL_AUDIT | Plinth close_position never calls Sigil.record_close |
| #42 | Medium | FULL_AUDIT | AtriumRouter has no pause |
| W2-C1 | Critical | wave2-contracts | PlinthMath.required_margin returns ZERO (same as #3) |
| W2-C2 | Critical | wave2-contracts | Aqueduct.resume() onlyPraetor (same as #13) |
| W2-C3 | Critical | wave2-contracts | close_position credit-line monotonic growth (same as #41) |
| W2-H1 | High | wave2-contracts | PlinthMath haircuts_bps unused |
| W2-H2 | High | wave2-contracts | Oracle abs_diff_bps asymmetric |
| W2-H3 | High | wave2-contracts | Vigil queue_liquidation pause bypass (same as #10) |
| W2-H4 | High | wave2-contracts | AqueductReceiver.ccipReceive no reentrancy guard |
| W2-H5 | High | wave2-contracts | Rostrum leader_followers unbounded |
| W2-H6 | High | wave2-contracts | PosternKeyRegistry markAllRevoked unbounded |
| W2-H7 | High | wave2-contracts | Adapter setAuthorizedCaller onlyPraetor not onlyTimelock |
| W2-M1..M12 | Medium | wave2-contracts | 12 medium contract findings batched into one redeploy wave |
| CRT-01 | Critical | ANTIGRAVITY | PlinthMath array-mismatch zero-margin (same as #3) |
| CRT-02 | Critical | ANTIGRAVITY | Notifier webhook SSRF |
| HIGH-01 | High | ANTIGRAVITY | Signed division floor-toward-zero in PnL |
| HIGH-04 | High | ANTIGRAVITY | Adapters bypass Coffer global pause |
| HIGH-05 | High | ANTIGRAVITY | Unauth APIs leak balances/inboxes |
| HIGH-06 | High | ANTIGRAVITY | Unauth my-mandates discloses delegations |
| HIGH-07 | High | ANTIGRAVITY | Notifier `first: 100` cap drops alerts |
| MED-01 | Medium | ANTIGRAVITY | Stylus initialize() EOA hijack window (same as #11) |
| MED-02 | Medium | ANTIGRAVITY | Chainlink answeredInRound ignored |
| MED-03 | Medium | ANTIGRAVITY | Aave shortfall deletes collateral |
| SD-1 | Critical | wave2-subgraph-data | Notifier queries non-existent fields |
| SD-2 | Critical | wave2-subgraph-data | Notifier mapAlertKind wrong enum case |
| FULL_AUDIT #7 | High | FULL_AUDIT | Tablet zero auth |
| FULL_AUDIT #8 | High | FULL_AUDIT | Notifier webhook SSRF (same as CRT-02) |

### Best solution per cluster

#### 2.1 Stylus contract redeploys — one batched wave

Five Stylus changes need redeploys (Plinth, Coffer, Sigil, Vigil, PlinthMath, PlinthOracle). Don't redeploy individually — one coordinated wave per Phase 2.5 of the existing roadmap. Use `praetor-cli` to drive the sequence.

Per contract, the changes:

**PlinthMath** (closes #3, W2-C1, CRT-01, W2-H1, HIGH-01, W2-M1, W2-M2):
- Replace `return U256::ZERO` on array mismatch with `revert ArrayLengthMismatch`. Use `panic!` macro or `sol! { error ArrayLengthMismatch(); }` and `Err(...)`.
- Integrate `haircuts_bps` into the SPAN scenario loop: `worst_loss_per_class *= (10000 + max_haircut_in_class) / 10000`.
- Floor-divide signed PnL toward negative infinity (not toward zero). Add helper `signed_floor_div(numerator, denominator) -> I256`.
- Revert if `entry_price_q64 > U256::from(1) << 128` (sane upper bound).
- Treat `correlation_class = 0` as "each position is its own class" rather than "all class-0 net." Either reserve 0 as no-netting or require `class > 0` in `set_instrument_risk`.

**Plinth** (closes #41, W2-C3, W2-M6):
- Add `agent: Address` to Position struct. `open_position` stores it from the intent envelope.
- `close_position` calls `Sigil.record_close(agent, abs_notional)` after settlement.
- Apply `initial_margin_multiplier` (1.5×) at open time. `do_update_margin` from open path uses higher threshold than ongoing path.

**Coffer** (closes HIGH-04, W2-M3):
- Gate `adapter_pull` behind `is_withdrawals_paused` check.
- Use `convert_to_shares_ceil` (round up) in `adapter_pull_inner`, not floor.

**Vigil** (closes #10, W2-H3, W2-M9):
- Gate `queue_liquidation` behind `is_paused` check.
- Implement actual partial liquidation: reduce position by `partial_liquidation_max_bps` fraction rather than full close.
- Reduce `keeper_min_stake_wei` from 1000 ETH to 0.01 ETH for testnet (closes #39 too); guard with build-time feature flag so mainnet can't accidentally ship the testnet value.

**Sigil** (closes #11 part, W2-M8, W2-L7):
- Replace public `initialize()` guard from `praetor_multisig.is_zero()` to `msg.sender == DEPLOYER` where DEPLOYER is captured at constructor time. Best path: migrate to Stylus `#[constructor]` like Plinth already uses; the SDK supports it.
- Enforce `action_nonce` monotonicity: store `last_action_nonce[agent]`, require strict increment.
- Reject upper-`s` in `ecrecover_via_precompile` (EIP-2 malleability): require `s <= secp256k1n / 2`.

**PlinthOracle** (closes W2-H2, MED-02):
- Symmetric `abs_diff_bps`: divide by `max(a, b)` instead of `a`.
- Validate Chainlink `answeredInRound >= roundId`; revert on stale round.

**Aqueduct** (closes #13, W2-C2, W2-H4, W2-M4, W2-M5):
- `resume()` modifier `onlyPraetor` → `onlyTimelock`.
- Add OZ `ReentrancyGuard.nonReentrant` modifier on `AqueductReceiver.ccipReceive`. Use the OZ pattern from `resources/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol`.
- Include `destSelector` in the `seen_send_nonces` hash so multi-chain sends in the same block don't collide.
- Set `extraArgs` with explicit gasLimit: `Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 500_000}))`.

**AtriumRouter** (closes #42):
- Add `pause()` / `resume()` with the same modifier pattern as other contracts. `pause()` = `onlyPraetor`, `resume()` = `onlyTimelock`. Gate every state-changing route through the pause check.

**Adapters (all 8 v1.1)** (closes W2-H7):
- `setAuthorizedCaller` modifier `onlyPraetor` → `onlyTimelock`. Emergency `deauthorizeCaller` stays `onlyPraetor`.

**Rostrum** (closes #12, W2-H5):
- `mirrorOpen` requires `msg.sender == follower` OR `msg.sender == approvedKeeper`. Add `approvedKeepers` mapping, schedule via timelock.
- Swap-and-pop removal in `endFollow` to keep `leader_followers` bounded.

**PosternKeyRegistry** (closes W2-H6):
- Cap `_activeKeys[user].length` at 50 in `recordIssued`. Implement batched revocation chunked at 25 keys per call so `markAllRevoked` never exceeds gas limit.

**Aave-horizon adapter** (closes MED-03):
- Assert `withdrawn == pos.supplied_amount` after `pool.withdraw`; revert `InsufficientAaveLiquidity` if shortfall.

#### 2.2 Redeploy sequencing

Order matters because some contracts depend on others' addresses:

1. PlinthMath, PlinthOracle, Aqueduct (no callers depend on these directly).
2. Coffer, Vigil, Sigil (depend on PlinthMath/PlinthOracle).
3. Plinth (depends on all four above).
4. AtriumRouter, Rostrum, PosternKeyRegistry, all adapters.
5. Coffer + adapters: schedule the new `setAdapter` and `setAuthorizedCaller` timelock txs (these are tasks #335, #337 from your roadmap; Phase 8 executes them).

For each redeploy:
- Run `cargo stylus check` against Sepolia first.
- Use `praetor-cli deploy --network arbitrum_sepolia --contract <name>` with `--dry-run` first.
- Schedule via `PraetorTimelock.schedule(target, calldata)`.
- Wait 48h.
- Execute via `PraetorTimelock.execute`.
- Update `deployments/arbitrum_sepolia.json` with new address + tx hash.
- Run `node scripts/update-subgraph-addresses.mjs arbitrum_sepolia` to sync subgraph manifest.
- Redeploy subgraph (`pnpm --filter @atrium/subgraph deploy`).
- Update verify-app `deploymentsRegistry` cache invalidation.

Reference: `resources/stylus-sdk-rs/examples/` for `#[constructor]` migration patterns; `resources/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol` for the canonical reentrancy modifier.

#### 2.3 Notifier resurrection (SD-1, SD-2, HIGH-07)

The notifier queries `txHash`, `detail`, `user` fields that don't exist on `LiquidationEvent`/`AlertEvent`/`SigilRevocation`. It also uses uppercase enum values (`'ORACLE_DISAGREEMENT'`) while handlers write lowercase. Plus `first: 100` caps lose alerts.

Best path:
1. Add the missing fields to the schema: `LiquidationEvent.user: Bytes!`, `LiquidationEvent.txHash: Bytes!`, `AlertEvent.txHash: Bytes!`, `AlertEvent.detail: String`, `SigilRevocation.txHash: Bytes!`. Update handlers in `subgraph/src/vigil.ts`, `subgraph/src/sigil.ts`, etc., to populate them. Redeploy subgraph.
2. Fix `mapAlertKind` to lowercase: `'oracle_disagreement'` etc. Match the values handlers actually write. Add a unit test that imports the same constants used by handlers and the notifier — single source of truth.
3. Replace `first: 100` with cursor-based pagination. Use `blockNumber_gt: $cursor` + repeated query until empty. Advance cursor only after all pages processed.
4. Add `AbortSignal.timeout(5000)` to fetch.
5. Move from GHA cron (1-min cadence is bad — kills GH Actions quota per FULL_AUDIT #14) to a DigitalOcean droplet (Phase 7) running `pm2` daemon with 30s tick interval.
6. Wire Honeybadger cron monitoring: ping at start of every tick, alert if no ping in 5 minutes.
7. Add an integration test against a live testnet Scribe URL: `vitest run notifier.integration.test.ts` queries Scribe, asserts every aliased field exists, asserts every alert kind in the union maps to a known router output.

Exit: notifier delivers an alert end-to-end (real Scribe → routeAlert → email + telegram) within 60s of an event. CI integration test passes.

#### 2.4 Webhook SSRF (CRT-02 ANTIGRAVITY, FULL_AUDIT #8)

User-supplied `customWebhookUrl` has no validation. Hits localhost, RFC 1918, or 169.254.169.254 metadata.

Best path: a proper SSRF guard, not just a regex.

```ts
// services/notifier/src/lib/ssrf-guard.ts
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const PRIVATE_IPV4 = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
  /^::1$/,
  /^fc00:/i,  // IPv6 ULA
  /^fe80:/i,  // IPv6 link-local
];

export async function assertPublicHttps(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('webhook_https_required');
  // Resolve hostname. Reject if any A/AAAA record is private.
  const hostname = url.hostname;
  const ip = isIP(hostname) ? hostname : null;
  if (ip) {
    if (PRIVATE_IPV4.some(re => re.test(ip))) throw new Error('webhook_private_ip');
    return url;
  }
  const records = await lookup(hostname, { all: true });
  for (const r of records) {
    if (PRIVATE_IPV4.some(re => re.test(r.address))) throw new Error('webhook_private_ip');
  }
  return url;
}
```

Plus:
- Body size cap (1KB outbound, 64KB inbound to prevent slowloris).
- 8-second total timeout via `AbortSignal.timeout(8000)`.
- Per-user rate limit (max 100 webhook deliveries per hour).
- Log every delivery attempt (status, target host, latency) to Honeybadger.

DNS rebinding: re-resolve before each fetch and pin to the originally resolved IP via custom Agent if paranoid. For testnet, the assert-on-each-call DNS check is sufficient.

Exit: a webhook to `http://127.0.0.1`, `https://10.0.0.1`, or `https://169.254.169.254` returns 400 with structured error. End-to-end integration test confirms.

#### 2.5 Lock unauthenticated APIs (HIGH-05, HIGH-06, FULL_AUDIT #7, websec F8, E2E-21)

Routes accepting `?wallet=` with no auth: every `/api/portfolio/*`, `/api/transfer/*`, `/api/tax/*`, `/api/agents/my-mandates`, `/api/notifications`, `/api/settings/connected-sites`. Plus tablet's `/export`, `/summary`, `/events`.

SIWE session auth is the right long-term answer (Phase 3 implements it). For Phase 2, lock to the demo wallet or env-configured wallet only.

Best path:
1. Create `apps/verify/src/lib/auth-session.ts` stub with two functions: `getSession(req)` returning `{ walletAddress } | null` and `requireWalletMatch(req, requestedWallet)` returning a 401/403 NextResponse if mismatched.
2. In Phase 2, `getSession` reads `process.env.DEMO_WALLET_ADDRESS` only — no real session yet.
3. Every `?wallet=` route enforces: if `walletParam` differs from `session.walletAddress`, return 403.
4. Remove the public `?wallet=` accept path until Phase 3 wires real SIWE. The verify-app's portfolio pages pass the connected wallet via a server-side fetch with a session cookie added in Phase 3.
5. Tablet (`services/tablet/`): require `Authorization: Bearer <ATRIUM_INTERNAL_KEY>` (Doppler-managed) from the verify-app. The tablet service is internal-only; no direct browser access.

Exit: hitting `/api/portfolio/positions?wallet=0xVICTIM` from an unauthenticated session returns 401. Tablet `/export` requires the bearer token.

#### 2.6 Initialize front-run windows (#11, MED-01, W2-L2)

Coffer, Sigil, Vigil rely on public `initialize()` guarded only by `praetor_multisig.is_zero()`. On L1/other L2s without a single sequencer, attackers can front-run init.

Best path: migrate to Stylus `#[constructor]`. The Stylus SDK 0.8+ supports constructor blocks (per `resources/stylus-sdk-rs/CHANGELOG.md`). Plinth already uses `#[constructor]`, so the migration pattern exists.

If `#[constructor]` isn't viable for some reason (e.g. multi-fragment deploy needs special handling), use the deployer-binding pattern: capture `tx.origin` in the storage at deploy via `cargo stylus deploy`'s post-deploy hook, then `initialize()` requires `msg.sender == STORED_DEPLOYER`. This is half-baked compared to constructor migration; use only if SDK constraints force it.

Exit: every Stylus contract has its admin set at deployment time, no public `initialize()` to front-run.

#### 2.7 AtriumRouter pause (#42)

Currently no pause. Incident response means pausing each downstream individually.

Best path: add `pause()` and `resume()` with the standard modifier pattern. `pause()` = `onlyPraetor` (instant), `resume()` = `onlyTimelock` (48h veto). Every state-changing route checks `is_paused` and reverts `RouterPaused` if set. Add `RouterPauseState` entity to the subgraph; add a UI banner that reads it.

#### 2.8 Mainnet-only contract items (defer)

These are non-blocking for testnet launch but tracked here for mainnet:

- W2-L1: `Plinth.instrument_key` domain separator — low risk, fix when next instrument schema change ships.
- W2-L4: Edict no tier downgrade — needs a process decision (when do we revoke a tier?), not just code.
- W2-L5: MockAavePool not view — testnet-only; remove for mainnet.
- W2-L8: `Plinth.get_user_positions` unbounded return — already capped at 100 positions, watchful but not blocking.
- W2-L10: Deploy.s.sol no test-key guard — process improvement, doc fix.
- W2-M10/M11: Deploy script PhaseC import + duplicate Hyperliquid adapter address — these need redeploy of the Hyperliquid adapter pair as a pre-mainnet item.
- FULL_AUDIT #56: StoaBlackScholes returns zeros — Phase-2 conditional explicitly deferred.
- FULL_AUDIT #54, #55: Cargo semver ranges, instrument_key — pin and fix in mainnet hardening.

### Exit criteria for Phase 2

- `forge test -vvv` green for all updated Solidity contracts.
- `cargo test --workspace` green for all updated Stylus contracts.
- All redeploys land via timelock with no manual EOA admin call.
- `deployments/arbitrum_sepolia.json` reflects new addresses and the subgraph re-indexes from new startBlocks.
- Notifier delivers a real alert end-to-end against testnet within 60s.
- A staged SSRF attempt (test webhook to private IP) returns 400.
- Hitting any `?wallet=` API with an unauthorized wallet returns 401/403.
- Stylus `initialize()` is no longer publicly callable on any deployed contract.



---

## 7. Phase 3 — Security hardening (Days 11-14)

### Goal

Browser hardening (CSP/HSTS/Permissions-Policy). Real SIWE session auth across every mutation route. Rate limiting on every API route. GHA workflows hardened (concurrency, timeouts, SHA pinning, permissions, secret scoping). GDPR consent gate on Sentry/analytics. Doppler-driven secret pipeline for everything. The deployer key fully rotated.

### Findings closed

| ID | Source | Issue |
|----|--------|-------|
| F1 | wave1-websec | No CSP header |
| F2 | wave1-websec | No HSTS header |
| F3 | wave1-websec | Google Fonts no SRI (self-host fixes) |
| F4 | wave1-websec | No global error boundary |
| F5 | wave1-websec | Sentry without consent |
| F6 | wave1-websec | Chaos `*.vercel.app` wildcard origin |
| F7 | wave1-websec | Sentry no PII scrub |
| F8 | wave1-websec | Unauth APIs (covered in Phase 2 partial; SIWE here) |
| F9 | wave1-websec | issue-mandate no CSRF |
| F10 | wave1-websec | CI actions tag-pinned not SHA |
| F11 | wave1-websec | 5 workflows missing permissions |
| F12 | wave1-websec | loadtest-nightly pushes to master |
| F13 | wave1-websec | agents-cron logs response bodies |
| F14 | wave1-websec | Permissions-Policy too narrow |
| F15 | wave1-websec | Sentry tunnel undocumented |
| F16 | wave1-websec | Deployer key rotation overdue (covered in Phase 0) |
| F17 | wave1-websec | No Cache-Control private |
| F18 | wave1-websec | connected-sites no auth |
| F19 | wave1-websec | Sumsub callback leaks wallet |
| F20 | wave1-websec | archive-weekly shell injection (same as CRT-06) |
| F21 | wave1-websec | No DNS-Prefetch-Control |
| F22 | wave1-websec | Sentry replay 1.0 without consent |
| F23 | wave1-websec | robots indexes /verify/* |
| F24 | wave1-websec | hideSourceMaps + widenClientFileUpload |
| F25 | wave1-websec | No rate limiting (90% routes) |
| F28 | wave1-websec | Vercel preview env scope |
| F29 | wave1-websec | kani job contents:write pushes main |
| F30 | wave1-websec | brand-assets auto-commit |
| F31 | wave1-websec | e2e exposes test wallet key broadly |
| F32 | wave1-websec | layout.tsx external script no SRI |
| CRT-06 | ANTIGRAVITY | archive-weekly shell injection |
| MED-04 | ANTIGRAVITY | Chaos rate limit in-memory map |
| MED-05 | ANTIGRAVITY | notifier-cron 1-min cadence (also Phase 7 daemon move) |
| MED-06 | ANTIGRAVITY | CI no timeout-minutes |
| MED-07 | ANTIGRAVITY | Workflows no failure notifications |
| #14 | FULL_AUDIT | notifier-cron 1-min |
| #15 | FULL_AUDIT | 7/9 workflows no failure notification |
| #16 | FULL_AUDIT | No timeout-minutes |
| #46 | FULL_AUDIT | No concurrency groups (6/9) |
| #47 | FULL_AUDIT | agents-cron prints API responses |
| #48 | FULL_AUDIT | archive-weekly shell injection |
| #53 | FULL_AUDIT | No rate limiting |

### Best solution per cluster

#### 3.1 Browser security headers — single source of truth

`next.config.mjs` headers array currently has only X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy (narrow). Missing: CSP, HSTS, COOP/COEP/CORP, X-DNS-Prefetch-Control, full Permissions-Policy.

Best path: a typed config file that generates all headers, with comments explaining each. Single import in `next.config.mjs`.

```ts
// apps/verify/src/lib/security-headers.ts
export const securityHeaders = [
  // HSTS — force HTTPS for 2 years, include subdomains, allow preload
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Frame-Ancestors via CSP supersedes X-Frame-Options but keep both for legacy
  { key: 'X-Frame-Options', value: 'DENY' },
  // No MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No DNS prefetch — leaks domains via DNS resolver
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // Strict referrer for cross-origin
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Comprehensive Permissions-Policy — deny everything not explicitly used
  { key: 'Permissions-Policy', value: [
    'camera=()','microphone=()','geolocation=()','payment=()','usb=()',
    'midi=()','magnetometer=()','gyroscope=()','accelerometer=()',
    'ambient-light-sensor=()','autoplay=()','bluetooth=()','display-capture=()',
    'document-domain=()','encrypted-media=()','fullscreen=(self)','gamepad=()',
    'hid=()','idle-detection=()','interest-cohort=()','local-fonts=()',
    'picture-in-picture=()','publickey-credentials-get=(self)',
    'screen-wake-lock=()','serial=()','speaker-selection=()',
    'xr-spatial-tracking=()',
  ].join(', ') },
  // Cross-origin isolation — opt-in for crypto.subtle perf, leave off for now
  // CSP — strict, with documented allowlist
  { key: 'Content-Security-Policy', value: buildCsp() },
];

function buildCsp() {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'","'unsafe-inline'","https://vercel.live"], // unsafe-inline until atrium-favicon.js gets a nonce
    'style-src': ["'self'","'unsafe-inline'"], // Tailwind inline styles
    'font-src': ["'self'","data:"], // self-hosted fonts in Phase 1
    'img-src': ["'self'","data:","blob:","https://sepolia.arbiscan.io","https://*.simpleanalyticscdn.com"],
    'connect-src': ["'self'",
      "https://*.sentry.io", "https://o.atrium.fi/monitoring", // Sentry tunnel
      "https://api.studio.thegraph.com", // Scribe
      "https://arbitrum-sepolia.publicnode.com", "https://arb-sepolia.g.alchemy.com",
      "https://ethereum-sepolia.publicnode.com",
      "https://polygon-amoy.publicnode.com",
      "wss://relay.walletconnect.com", "https://rpc.walletconnect.com",
      "https://explorer-api.walletconnect.com", "https://verify.walletconnect.com",
      "https://pulse.walletconnect.org",
      "https://*.coinbase.com", "wss://*.coinbase.com",
      "https://api.simpleanalytics.com", "https://queue.simpleanalyticscdn.com",
      "https://api.web3.storage", "https://*.ipfs.w3s.link", // IPFS gateway for Lantern verify
    ],
    'frame-src': ["'self'", "https://verify.walletconnect.com"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': [],
  };
  return Object.entries(directives)
    .map(([k, v]) => v.length ? `${k} ${v.join(' ')}` : k)
    .join('; ');
}
```

Then in `next.config.mjs`:

```js
import { securityHeaders } from './src/lib/security-headers.js';

export default {
  // ...
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```

Move `atrium-favicon.js` to a Next.js Script component with a nonce or import it as a module so `'unsafe-inline'` can come out of `script-src` long-term. For Phase 3 we keep `'unsafe-inline'`; tighten in Phase 11.

Test: deploy to Vercel preview, run securityheaders.com against the URL, target A+ grade.

Closes: F1, F2, F3 (paired with self-host fonts in Phase 11), F14, F21, F32 (favicon migration in Phase 11).

#### 3.2 Sentry consent gate + PII scrub

Three problems: Sentry initializes unconditionally (GDPR violation); `replaysOnErrorSampleRate: 1.0` captures full DOM without consent; no `beforeSend` to scrub wallet addresses from messages and breadcrumb URLs.

Best path:
1. Cookie/consent banner shipped in Phase 10 with the privacy policy. Persists `atrium_analytics_consent='1'` in localStorage.
2. Sentry init wrapped in consent check:

```ts
// apps/verify/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';
import { hasConsent } from '@/lib/consent';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn && hasConsent('analytics')) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENV ?? 'dev',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5, // Lower than 1.0; full replays only on consent
    sendDefaultPii: false,
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    beforeSend(event) {
      const scrub = (s: string) => s
        .replace(/0x[0-9a-fA-F]{40}/g, '0x[REDACTED]')
        .replace(/0x[0-9a-fA-F]{64}/g, '0x[HASH-REDACTED]');
      if (event.message) event.message = scrub(event.message);
      if (event.request?.url) event.request.url = scrub(event.request.url);
      if (event.request?.query_string && typeof event.request.query_string === 'string') {
        event.request.query_string = scrub(event.request.query_string);
      }
      event.breadcrumbs?.forEach(b => {
        if (b.message) b.message = scrub(b.message);
        if (b.data && typeof b.data === 'object') {
          for (const k of Object.keys(b.data)) {
            if (typeof b.data[k] === 'string') {
              b.data[k] = scrub(b.data[k] as string);
            }
          }
        }
      });
      return event;
    },
    beforeBreadcrumb(b) {
      if (b.category === 'navigation' && b.data?.to && typeof b.data.to === 'string') {
        b.data.to = b.data.to.replace(/0x[0-9a-fA-F]{40}/g, '0x[REDACTED]');
      }
      return b;
    },
  });
}
```

3. Document Sentry in the privacy policy (Phase 10) including the tunnel route.
4. Document tunnelRoute in `next.config.mjs` comment (F15).

Closes: F5, F7, F15, F22.

#### 3.3 Real SIWE session auth

Replace the env-only stub from Phase 2.5 with proper Sign-In With Ethereum. The wagmi connector (Coinbase Smart Wallet) supports `signMessage`.

Architecture:
- `/api/auth/nonce` → returns single-use nonce stored in HTTP-only secure cookie.
- Client signs `Sign in to Atrium\n\n<address>\n<nonce>\n<domain>\n<issuedAt>` per EIP-4361.
- `/api/auth/verify` → verifies signature, sets HTTP-only `atrium-session` cookie containing `{ walletAddress, expiresAt }` signed with HMAC.
- Middleware (`apps/verify/src/middleware.ts`) reads session cookie on every `/api/*` route that needs auth.
- `getSession(req)` returns parsed session or null.

Library choice: SIWE official library (`siwe` npm package) for the message format. Cookie signing via `iron-session` (battle-tested, used by Vercel templates). Both free, MIT.

Routes that need session-bound `?wallet=`: portfolio/*, transfer/*, tax/*, agents/my-mandates, notifications, settings/*. Each enforces `session.walletAddress.toLowerCase() === walletParam.toLowerCase()` else 403.

Routes that need session existence (any address): tax/export, agents/issue-mandate.

Routes that stay public (no session): protocol/metrics, lantern/latest, reserves/*, alerts/recent (read-only public data).

Closes: F8 (full), F9 (issue-mandate gets origin check + session), F18 (connected-sites gets session).

#### 3.4 Rate limiting — Upstash Redis or DO managed Redis

In-memory Maps reset on cold start (MED-04). Token-bucket on Vercel needs persistent storage.

Best path: use Upstash Redis (free tier covers our load, 10K commands/day) or DigitalOcean managed Redis ($15/mo eats DO credit fast) — pick Upstash since it's free.

```ts
// apps/verify/src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv(); // UPSTASH_REDIS_REST_URL + TOKEN from Doppler

export const ratelimitPerIp = new Ratelimit({
  redis, prefix: 'rl:ip',
  limiter: Ratelimit.slidingWindow(60, '1 m'),
});
export const ratelimitPerWallet = new Ratelimit({
  redis, prefix: 'rl:wallet',
  limiter: Ratelimit.slidingWindow(120, '1 m'),
});

// middleware.ts uses ratelimitPerIp on every /api/*
// Sensitive routes (issue-mandate, kill-switch, deposit) layer on per-wallet cap
```

Closes: F25, MED-04, FULL_AUDIT #53.

#### 3.5 Cache-Control on user-specific routes

Every `/api/*` returning user data returns `Cache-Control: private, no-store` plus `CDN-Cache-Control: no-store` plus `Vercel-CDN-Cache-Control: no-store`. Add a shared utility used by every NextResponse for user data.

Closes: F17.

#### 3.6 GitHub Actions hardening

**Permissions** (F11): every workflow has top-level `permissions: {}` deny-all, then per-job grants only what's needed.

**Concurrency** (FULL_AUDIT #46): every workflow gets a concurrency group:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

**Timeouts** (FULL_AUDIT #16, MED-06): every job has `timeout-minutes`. CI lint/format=10, tests=20, foundry=30, kani=45, build=15. Default GH cap of 6h is unacceptable.

**SHA pinning** (F10): run `npx pin-github-action .github/workflows/*.yml` to convert every `@v4`/`@v1` to a SHA. Add a Dependabot rule for `package-ecosystem: github-actions` so SHAs update through Dependabot PRs (which CI re-checks).

**Failure notifications** (FULL_AUDIT #15, MED-07): every cron + e2e workflow gets a Discord webhook step on failure. Use a single `DISCORD_OPS_WEBHOOK` Doppler secret.

```yaml
- name: Notify ops on failure
  if: failure()
  run: |
    curl -X POST -H 'Content-Type: application/json' \
      -d "{\"content\":\"🚨 ${{ github.workflow }} failed on ${{ github.ref_name }}: ${{ github.run_url }}\"}" \
      $DISCORD_OPS_WEBHOOK
  env:
    DISCORD_OPS_WEBHOOK: ${{ secrets.DISCORD_OPS_WEBHOOK }}
```

**Shell injection** (FULL_AUDIT #48, CRT-06): `archive-weekly.yml` interpolates user input directly. Move to env-bound:

```yaml
- env:
    INPUT_STRATEGY: ${{ github.event.inputs.strategy || 'mean-reversion-v1' }}
  run: |
    python -m services.archive.src.research_loop --strategy "$INPUT_STRATEGY"
```

**Log redaction** (FULL_AUDIT #47, F13): `agents-cron.yml` `cat /tmp/*.json` → replace with `curl -sS -o /dev/null -w "%{http_code}"` so only status codes log.

**Branch protection bypass** (F12, F29, F30): kani writes back kani-status.json, brand-assets writes PNGs, loadtest-nightly writes report. All push directly to main. Move each to a `ci/data` branch with auto-PR (use `peter-evans/create-pull-request` action), then auto-merge after CI passes. Or push to a separate `atrium-ci-data` repo.

**e2e secret scoping** (F31): move `E2E_TEST_WALLET_PRIVATE_KEY` from job-level env to step-level so only the test step sees it.

**Vercel preview env** (F28): in Vercel dashboard, scope every sensitive env var (deployer key, chaos key, sumsub secret, internal key) to "Production" only. Preview deploys see dummy values.

**Chaos origin allowlist** (F6): replace `*.vercel.app` wildcard with strict allowlist:
```ts
const ALLOWED_ORIGINS = [
  'https://verify.atrium.fi',
  'https://atrium.fi',
];
const PREVIEW_REGEX = /^https:\/\/atrium-verify-[a-z0-9-]+-(atrium-team|prateekkumar|...)\.vercel\.app$/;
```

Closes: F6, F10, F11, F12, F13, F28, F29, F30, F31, MED-05/06/07, FULL_AUDIT #14/15/16/46/47/48.

#### 3.7 robots + sitemap

`robots.ts`: add `/loadtest`, `/chaos` to disallow (F23 mostly OK; verify Loadtest/Chaos disallowed). The verifier walk steps should remain crawlable since they're the demo surface.

#### 3.8 issue-mandate CSRF + origin

```ts
// apps/verify/src/app/api/agents/issue-mandate/route.ts
const origin = req.headers.get('origin');
if (!origin || !isAllowedOrigin(origin)) {
  return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });
}
const session = await getSession(req);
if (!session) return NextResponse.json({ error: 'unauth' }, { status: 401 });
// Then verify the EIP-712 signature recovery matches session.walletAddress.
```

Closes: F9.

#### 3.9 Sumsub callback — secret + scrub (F19)

The callback already has a webhook secret check. Confirm wallet is removed from error responses:

```ts
return NextResponse.json(
  { ok: false, error: 'tier_assign_failed', detail: e instanceof Error ? e.message.slice(0, 120) : 'unknown' },
  { status: 502 },
);
```

Plus log full context (with wallet) to Sentry/Honeybadger so we can debug, but don't echo in HTTP response.

#### 3.10 Sentry source maps (F24)

`hideSourceMaps: true` is correct (don't serve to public). Confirm Sentry is uploading via the auth token at build (already in next.config.mjs). Set `widenClientFileUpload: true` if Sentry stack frames look unresolved in practice.

#### 3.11 layout.tsx external script SRI (F32)

`<script src="/atrium-favicon.js" defer />` is same-origin so SRI isn't strictly needed. Tightening: convert to `<Script src="/atrium-favicon.js" strategy="afterInteractive" />` (Next.js Script component) which lets us add a nonce in Phase 11 when CSP `'unsafe-inline'` comes off `script-src`.

### Exit criteria for Phase 3

- securityheaders.com grades verify-app A+.
- Sentry receives no events from a fresh browser until consent toggled.
- Hitting `/api/portfolio/positions?wallet=0xVICTIM` from a different connected wallet returns 403.
- `/api/agents/issue-mandate` POST from a third-party origin returns 403.
- Rate limiting blocks 61st request in a minute from a single IP.
- Every workflow has top-level deny-all permissions, concurrency group, timeout, and Discord failure notification.
- `npx pin-github-action --check` returns clean.
- Vercel preview deploys see no production secrets (verified by inspecting env in a preview deploy log).
- Privacy policy in Phase 10 references the consent banner; consent banner gates Sentry init.



---

## 8. Phase 4 — Subgraph + indexing completeness (Days 15-18)

### Goal

Every entity in `schema.graphql` has at least one writer. Every event in every ABI has a handler or an explicit `INDEXING_IGNORE` reason. Every consumer (verify-app routes, lantern-attestor, vigil-keeper, notifier) cross-validates critical reads against on-chain RPC. The indexer's own health (`_meta { block { number } }`) is monitored. Pagination caps are gone. The notifier schema-field bug from Phase 2 has its long-term fix here.

### Findings closed

| ID | Source | Issue |
|----|--------|-------|
| #19 | FULL_AUDIT | LiquidationEvent.account = '' |
| #20 | FULL_AUDIT | CofferUserBalance tracks net deposited not redeemable |
| #43 | FULL_AUDIT | Position.entryPriceQ64 always zero |
| #44 | FULL_AUDIT | Counter + CohortPartner dead schema |
| #45 | FULL_AUDIT | LiquidationEvent.positionId stores job_id |
| #57 | FULL_AUDIT | Subgraph package caret ranges |
| #58 | FULL_AUDIT | LanternAttestation ID = root overwrites |
| #67 | FULL_AUDIT | indexing-todo.md tracked |
| SD-1 | wave2-subgraph | Notifier non-existent fields (long-term schema fix) |
| SD-2 | wave2-subgraph | Notifier wrong enum case |
| SD-3 | wave2-subgraph | No `_meta` block-lag check anywhere |
| SD-4 | wave2-subgraph | vigil-keeper no fetch timeout |
| SD-5 | wave2-subgraph | notifier no fetch timeout |
| SD-6 | wave2-subgraph | first:1000 cap on protocol/metrics + reserves/summary |
| SD-7 | wave2-subgraph | agents/[id]/profile non-existent fields |
| SD-8 | wave2-subgraph | subgraph-deploy.sh path mismatch |
| SD-9 | wave2-subgraph | CohortPartner dead (same as #44) |
| SD-10 | wave2-subgraph | Counter dead (same as #44) |
| SD-11 | wave2-subgraph | LanternAttestation overwrite (same as #58) |
| SD-12 | wave2-subgraph | LanternAttestor registry missing block field |
| SD-13 | wave2-subgraph | update-subgraph-addresses.mjs not called |
| SD-14 | wave2-subgraph | No matchstick tests |
| SD-15 | wave2-subgraph | vigil-keeper no RPC cross-validation |
| SD-16 | wave2-subgraph | lantern-attestor no RPC cross-validation |
| SD-17 | wave2-subgraph | CofferUserBalance negative clamp hides errors |
| SD-18 | wave2-subgraph | agents/[id]/profile no pagination |
| SD-19 | wave2-subgraph | protocol/metrics 5-entity join |
| SD-20 | wave2-subgraph | Caret ranges (same as #57) |
| SD-21 | wave2-subgraph | No indexer health cron |
| SD-22 | wave2-subgraph | entryPriceQ64 dead field (same as #43) |
| SD-23 | wave2-subgraph | Agent.totalPnlSigned always zero |
| SD-24 | wave2-subgraph | reserves/summary first:1000 |
| SD-25 | wave2-subgraph | Single-indexer trust |
| SD-26 | wave2-subgraph | reserves/recent 720-row query |
| SD-27 | wave2-subgraph | CI graph test not gated |

### Best solution per cluster

#### 4.1 Schema completeness — LiquidationEvent + entry price + dead entities

Several entities have wrong types or unwritten fields. Address them in one schema change + redeploy.

**LiquidationEvent** (#19, #45):
- Add fields: `user: Bytes!`, `txHash: Bytes!`, `instrumentId: Bytes`, `recoveredAssetsUsd: BigDecimal`. The `user` field comes from the on-chain `Vigil.jobs(jobId).user` view call inside the handler (use `Vigil.bind(event.address).try_jobs(...)`). Rename `positionId` to `jobId` and add a separate `positionId: BigInt!` populated from the job's position field.
- The `account` derived FK then resolves correctly to MarginAccount via the new `user` field.

**Position.entryPriceQ64** (#43, SD-22):
- Plinth must emit entry price in `PositionOpened` event v2. Phase 2 already redeploys Plinth — extend the event signature there: `event PositionOpened(uint256 indexed position_id, address indexed owner, uint8 venue_id, bytes32 instrument_id, int256 notional_signed, uint256 entry_price_q64)`. Update handler to read it.

**Counter @entity** (#44, SD-10):
- Implement aggregate counter writes. Each handler that creates an entity bumps its corresponding counter:
  - `handlePositionOpened` → `Counter.openPositionsCount += 1`
  - `handlePositionClosed` → `Counter.openPositionsCount -= 1`, `closedPositionsCount += 1`
  - `handleDeposit` → `Counter.totalDepositsCount += 1`, `Counter.totalTvlWei += amount`
  - etc.
- Single Counter row keyed by `'global'`. Lazy-create on first handler invocation.
- `protocol/metrics` route reads Counter directly instead of paginating MarginAccount.

**CohortPartner** (#44, SD-9):
- Decision: implement on-chain Cohort contract OR honestly remove the entity.
- Best path: **implement the on-chain contract.** A Cohort partner registration event is small: `CohortPartnerJoined(address indexed partner, string displayName, uint256 commitedAmountWei)`. New contract `contracts/cohort/src/Cohort.sol`. Owned by Praetor. Off-chain LOI signing → Praetor multisig calls `joinPartner(addr, name, amount)` → event → indexed → `/api/cohort/partners` reads real data.
- Until partners actually sign LOIs, the cohort page renders empty state. That's honest.

**LanternAttestation ID** (#58, SD-11):
- Change ID from `event.params.root.toHexString()` to `event.transaction.hash.toHexString() + '-' + event.logIndex.toString()`. Add a separate non-unique `root: Bytes! @search` field for queries by root.
- A republish of the same root creates a new entity row, preserving history.

#### 4.2 Indexer health — `_meta` checks everywhere

Every consumer of Scribe must check freshness. A stale indexer must surface as a banner, not silent stale data.

Best path: shared helper.

```ts
// apps/verify/src/lib/scribe-health.ts
export interface ScribeHealth {
  indexedBlock: number;
  chainBlock: number;
  lagBlocks: number;
  isStale: boolean;
}

const STALE_THRESHOLD_BLOCKS = 100; // ~25s on Arbitrum L2 at 250ms blocks

export async function checkScribeHealth(scribeUrl: string): Promise<ScribeHealth> {
  const [scribe, chain] = await Promise.all([
    fetch(scribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ _meta { block { number } } }' }),
      signal: AbortSignal.timeout(3000),
    }).then(r => r.json()),
    fetch(process.env.ARBITRUM_SEPOLIA_RPC!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      signal: AbortSignal.timeout(3000),
    }).then(r => r.json()),
  ]);
  const indexedBlock = Number(scribe.data._meta.block.number);
  const chainBlock = parseInt(chain.result, 16);
  const lagBlocks = chainBlock - indexedBlock;
  return { indexedBlock, chainBlock, lagBlocks, isStale: lagBlocks > STALE_THRESHOLD_BLOCKS };
}
```

Where this is wired:
- Verify-app: a new `/api/scribe/health` route. The app shell calls it every 30s, shows a yellow banner when `isStale`.
- Lantern-attestor: refuses to publish if `lagBlocks > 50` (writes warning to Honeybadger). Closes SD-3 for POR critical path.
- Vigil-keeper: skips the tick if stale, logs warning. Closes SD-3 for liquidation.
- Notifier: same. Skip tick if stale.
- A dedicated `subgraph-health.yml` cron (every 15 min) calls the helper and posts to Discord ops if `lagBlocks > 200` for two consecutive checks. Closes SD-21.

#### 4.3 RPC cross-validation on critical paths (SD-15, SD-16, SD-25)

Two paths matter most: lantern-attestor (publishes a Merkle root on-chain, every leaf affects it) and vigil-keeper (executes liquidations).

**Lantern**:
- Sample-based: after pulling N balances from Scribe, randomly sample 5% (capped at 50 max) and re-verify by calling `Coffer.convertToAssets(balanceOf(user))` via viem.
- If any sample mismatches by >0.5%, abort the publish and alert ops.
- Document the sample ratio in `docs/lantern-attestor.md`.

**Vigil-keeper**:
- After fetching paused accounts from Scribe, call `Plinth.getAccount(user)` for each via viem.
- Confirm `isPaused == true` AND `marginVersion == scribeMarginVersion` before queuing.
- If mismatched, log warning + skip that account in the tick.

**Notifier**: low-stakes (off-chain delivery only). RPC cross-validation not needed; staleness check sufficient.

**Verify-app**: most reads display-only; staleness banner is sufficient.

#### 4.4 Pagination — cursor-based everywhere (SD-6, SD-18, SD-24, SD-26, FULL_AUDIT #26)

Every `first: 1000` becomes a cursor loop. Helper:

```ts
// apps/verify/src/lib/scribe-paginate.ts
export async function paginate<T>(
  query: (cursor: string) => string,
  parseRows: (data: any) => T[],
  cursorOf: (row: T) => string,
): Promise<T[]> {
  const all: T[] = [];
  let cursor = '';
  for (;;) {
    const data = await gql(query(cursor));
    const rows = parseRows(data);
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < 1000) break; // last page
    cursor = cursorOf(rows[rows.length - 1]);
  }
  return all;
}
```

Apply to: `protocol/metrics` (use Counter entity instead — easier), `reserves/summary` (paginate cofferUserBalances), `lantern-attestor` (paginate balances), `agents/[id]/profile` (paginate trades + actions, cap at 30d window), `tablet/scribe_client` (paginate trade history per user-year).

For `agents/[id]/profile` specifically: use Counter-style aggregation if hot — write per-agent counters in handler so the route reads totals without scanning trades.

`reserves/recent` 720-row 30d query (SD-26): keep single-shot but add `where: timestamp_gt: <now-30d>` so the indexer can use the timestamp index. If still slow, paginate in 100-row chunks.

#### 4.5 CofferUserBalance semantics (FULL_AUDIT #20, SD-17)

Currently tracks net deposited, not current redeemable. Lantern publishes this as POR — wrong if vault accrues yield/loss.

Best path:
- Rename field: `balanceWei` → `netDepositedAssetsWei` (the actual semantics).
- Add a new derived field: when Lantern fetches, it calls `Coffer.convertToAssets(Coffer.balanceOf(user))` for each address and uses that for the Merkle leaf. The subgraph entity stays as the simple net-deposit aggregate for display purposes; Lantern goes direct to RPC for the authoritative redeemable balance.
- Remove the negative-clamp (SD-17). Instead, log a warning via subgraph `log.warning()` if subtraction would go negative. Keep the clamp for display safety but surface the anomaly.

#### 4.6 Notifier long-term schema fix (SD-1, SD-2)

Phase 2 added the missing fields to the schema and lowercase enum values. Phase 4 adds the safety net:
- A schema/handler unit test that imports the same `KIND` constants used by both writers and the notifier's `mapAlertKind`. Drift becomes a CI failure.
- An integration test in CI that boots a local Graph Node, deploys the subgraph, fires a known event sequence, and asserts the notifier produces the expected alert. Use `@graphprotocol/graph-cli`'s local node feature.

#### 4.7 Misc subgraph hygiene

- `package.json` caret ranges → exact pins (`@graphprotocol/graph-cli@0.84.0`, `@graphprotocol/graph-ts@0.35.0`, `matchstick-as@0.6.0`). Closes #57, SD-20.
- `subgraph/indexing-todo.md` (#67) — already serves as audit trail. Either gitignore or rename to `subgraph/INDEXING-LOG.md` to signal it's a kept log, not a TODO.
- LanternAttestor registry block field (SD-12) — add `"block": 270918668` to the `lantern-attestor` entry in `deployments/arbitrum_sepolia.json`. Otherwise running `update-subgraph-addresses.mjs` regresses startBlock to 0.
- `subgraph-deploy.sh` path mismatch (SD-8) — change `DEPLOY_FILE="deploy/arbitrum-sepolia.json"` to `"deployments/arbitrum_sepolia.json"`. Update the inline Python patcher's key format to match the registry's slug-based keys.
- `update-subgraph-addresses.mjs` (SD-13) — make this canonical. Delete the duplicate Python patcher in `subgraph-deploy.sh` and have it call the Node script. Add to a `make subgraph-sync` target.
- Agent.totalPnlSigned (SD-23) — implement the intent_hash join: when `IntentValidated` fires, store `intent_hash → agent` mapping; when `PositionClosed` fires from Plinth on a position whose intent_hash is in the mapping, update `Agent.totalPnlSigned`. Document the mapping table as a separate entity `IntentToAgent`.

#### 4.8 Matchstick tests (SD-14, SD-27)

Phase 9 ships the full test suite. Phase 4 ships the minimum viable: tests for the 4 critical handlers.

- `subgraph/tests/plinth.test.ts` — handleMarginUpdated, handlePositionOpened, handlePositionClosed.
- `subgraph/tests/coffer.test.ts` — handleDeposit, handleWithdraw (with rounding cases).
- `subgraph/tests/vigil.test.ts` — handleLiquidationExecuted (with view-call mock for jobs.user).
- `subgraph/tests/lantern.test.ts` — handleAttestationPublished.

CI gate (SD-27): add `pnpm --filter @atrium/subgraph test` to the `subgraph` job in `.github/workflows/ci.yml`.

Reference: `resources/graph-tooling/examples/` for matchstick patterns. Pyth's subgraph also has matchstick tests if needed: `resources/pyth-crosschain/...` (graph subdirs).

#### 4.9 Single-indexer trust (SD-25)

Mainnet hardening item. For testnet launch:
- Document the trust model in `docs/architecture.md`: "Scribe is hosted by Atrium on The Graph Studio. Lantern's Merkle proof is RPC-cross-validated, so a compromised indexer cannot falsify reserve attestations. Other surfaces are display-only."
- Track a self-hosted Graph Node deploy as a mainnet-blocker item.

### Exit criteria for Phase 4

- `node scripts/check-event-indexing.mjs` exits 0.
- `node scripts/check-entity-writers.mjs` exits 0.
- Every consumer's Scribe call has a `signal: AbortSignal.timeout(...)`.
- `/api/scribe/health` returns real lag data; the verify-app banner shows when stale.
- A staged 30-block lag triggers Discord ops alert within 15 minutes.
- Lantern aborts publish if a sampled balance mismatches RPC by >0.5%.
- Vigil-keeper skips a paused account if RPC says it isn't paused.
- Matchstick tests pass in CI.
- Pagination loops exhaust cursors; no `first: 1000` literal remains in app/services code (single-shot reads use a documented `LIMIT` constant).
- LanternAttestation history preserves duplicate-root publishes.



---

## 9. Phase 5 — Frontend completeness (Days 19-25)

### Goal

Every page passes ui.md's 6-state requirement (Empty, Loading, Error, Permission, Success, Mobile). All 5 mobile flows have dedicated panels. WCAG AA. PWA installable. SEO clean. Wallet UX correct. No banned words. No spinners (skeletons only). No silent error swallowing. No fake "live" labels.

### Findings closed (62 entries)

| Cluster | IDs | Source |
|---------|-----|--------|
| Wallet integration | W-1..W-7 | wave1-wallet-tx-ux |
| Transaction UX | TX-1..TX-11, ADD-1..ADD-7 | wave1-wallet-tx-ux |
| Network/RPC | NET-1..NET-3 | wave1-wallet-tx-ux |
| Microcopy | MC-1..MC-19 | wave1-wallet-tx-ux |
| Accessibility | A11Y-01..A11Y-13 | wave1-a11y-perf-seo |
| Performance | PERF-01..PERF-08 | wave1-a11y-perf-seo |
| SEO | SEO-01..SEO-10 | wave1-a11y-perf-seo |
| 6-state UI completeness | E2E-01..E2E-63 | wave2-e2e |
| Frontend findings (legacy) | #17, #18, #23, #24, #27..34, #59..62 | FULL_AUDIT |
| Brand consistency | L-14..L-30, L-38..L-44 | wave1-launch-brand-legal |

### Best solution per cluster

#### 5.1 Wrong-chain banner (W-2, E2E-59)

`AppShell` checks `useAccount().chain?.id` against `arbitrumSepolia.id`. If mismatch, renders a banner above sidebar/topbar with a "Switch network" button using wagmi's `useSwitchChain`. Disable every write hook while on wrong chain. Single hook `useChainGuard()` returns `{ ok, current, target, switch }` consumed by AppShell + every form's submit guard.

#### 5.2 Account-switching cache invalidation (W-3)

In `WagmiProviders`, watch `useAccount().address` with `useEffect`. On change, call `queryClient.invalidateQueries()` and clear localStorage scoped to the previous wallet. No stale-data window.

#### 5.3 ENS + checksumming (W-4, W-5)

Add `useEnsName({ address })` to `AppShellWalletCard`, agent profile cards, mandate panel, positions table. Fall back to `0xAB…CD` truncation. Replace every `.toLowerCase()` on a display address with `getAddress()` from viem (preserves EIP-55 checksum). Lowercase only for set-membership comparisons.

#### 5.4 Tx receipt confirmation gating (TX-1, ADD-1)

Every write hook gets four states: `idle | submitting | pending | success | error`. `submitting` is from `writeContractAsync` resolving. `pending` is the receipt-wait window. `success` only after `useWaitForTransactionReceipt({ hash }).data.status === 'success'`. UI shows "Submitted" with hash during pending, "Confirmed" only after. One shared `useTxStatus()` hook drives every form.

#### 5.5 Insufficient-balance + Max button (TX-7, TX-10, MC-14)

Every form reads on-chain balance via wagmi `useBalance` (ETH) or `useReadContract({ functionName: 'balanceOf' })` (USDC, vault shares). Submit button disabled with "Insufficient USDC balance" label if `parseUnits(input) > balance`. Max button reads balance, subtracts gas (for ETH-paid balances), sets remainder. Vault deposit Max = USDC balance. Vault withdraw Max = `Coffer.convertToAssets(balanceOf(user))`. Trade Max = `getAccount(user).buyingPowerWei`.

#### 5.6 Gas estimation USD preview (TX-4)

Every write hook calls `publicClient.estimateGas({ ...args })` during `idle` → `resolving` transition. Cache for 60s. Display in form summary alongside slippage and CCIP fee. ETH→USD via PlinthOracle's stored ETH/USD price (read once per session, cached).

#### 5.7 Slippage + MEV warnings (TX-3, TX-8)

Slippage becomes a dropdown (0.05 / 0.10 / 0.50 / Custom). RiskPreviewModal gets a 7th bullet about Arbitrum sequencer ordering and price-impact for large trades.

#### 5.8 RPC fallback (NET-1)

Wagmi `transports` becomes `fallback([http(primary), http(secondary), http(tertiary)])`. Primary = configured Alchemy URL via Doppler. Secondary = publicnode. Tertiary = drpc. All three Sepolia-capable; failure rolls forward.

#### 5.9 Faucet skip → external faucet link (NET-3)

Onboarding faucet step always renders "Need testnet ETH?" link to `https://faucet.quicknode.com/arbitrum/sepolia` and `https://www.alchemy.com/faucets/arbitrum-sepolia`. Both work without API keys.

#### 5.10 Wallet error humanization (MC-2, MC-7, MC-18, ADD-7)

One shared `humanizeWalletError(reason: unknown)` function maps known patterns:
- `"User rejected"`, `"User denied"`, `"4001"` → "Cancelled in wallet"
- `"insufficient funds"` → "Not enough ETH for gas"
- `"nonce too low"` → "Stale tx — refresh and try again"
- `"execution reverted: <name>"` → look up named error from contract ABI; fall back to "Transaction reverted: \<message>"
- WebAuthn errors → mapped per browser
Unknown errors: "Something went wrong. Check your wallet." with raw reason in `<details>` for debug.

#### 5.11 Skeletons everywhere (MC-4, A11Y-10, E2E-17, E2E-56, FULL_AUDIT #29)

Replace every `Loader2` / `animate-spin` with `<Skeleton />` matching the eventual content shape. Verifier step "Connecting"/"Submitting" uses pulsing-dot text instead of spinner. Onboarding shield icon during WebAuthn uses scale-pulse, not rotate.

#### 5.12 Permission states everywhere (MC-11, E2E-06, E2E-09, E2E-11, E2E-60, E2E-61)

`useContractPaused(slug)` hook reads pause state for a contract. `useEdictTier()` returns user's tier. AppShell renders banners for global pause (Coffer/Plinth/Aqueduct/Vigil/Sigil/Router). Tier-gated features (jurisdiction-restricted venues) check `useEdictTier()` and gray out with "Region not supported" when tier disallows.

#### 5.13 Inline tooltips for financial concepts (MC-9)

`<HelpTip term="margin">` component renders a `?` icon. On hover/focus, popover shows one-sentence explanation. Terms: margin, liquidation, buying power, notional, leverage (acceptable as financial noun per amended writing.md), maintenance vs initial margin, hedging, basis trade.

#### 5.14 Form validation with debounce (MC-10, ADD-3)

Every form input gets `onBlur` validation + 300ms debounce on the margin-impact preview API call. Use `useDeferredValue` from React 19 for the impact query key.

#### 5.15 Transfer form CTA wired (MC-13)

Currently dead. Build `useTransfer()` hook calling `Aqueduct.send(amount, dest_chain_selector, dest_user)` via wagmi. Wire submit. Show pending → settled timeline using the CrossChainCredit subgraph entity polled every 10s for 30 min then archived.

#### 5.16 Onboarding polish (E2E-30, E2E-41..45, MC-16)

- Step indicators 22px → 44px touch targets.
- Persist progress to localStorage; resume on reload.
- Add Back button.
- Faucet step: render real `dropAmount` from contract — no hardcoded fallback.
- Margin step: only show "Margin posted" if balance > 0; else "Deposit first" with link.
- Replace `.` separator with `·` for consistency.
- Authenticator skip button: "Skip for now (set up later in Settings)".
- Second-device modal: add "Remind me later" option.

#### 5.17 Mobile panels — every required flow (E2E-12, E2E-18, E2E-31, E2E-33, E2E-34, FULL_AUDIT #24)

Build dedicated mobile panels that share business logic with desktop:
- `VaultMobile` — full-width deposit/withdraw with 44px+ inputs, inline balance, Max button.
- `ReservesMobile` — Lantern attestation card with verify-my-balance flow.
- `KillSwitchMobile` — accessible from `SettingsMobile` AND a persistent FAB (red shield icon) on every authenticated page.
- `ActivityMobile`, `NotificationsMobile`, `TaxMobile`, `MarketsMobile`, `OnboardingMobile` (already partly built; complete to match desktop feature parity).
All mobile components import the same hooks as desktop. UI shell differs; data layer is shared.

#### 5.18 Accessibility (A11Y-01..A11Y-13)

- Color contrast: darken `--muted` to oklch(46%), `--faint` to oklch(52%) on light theme; lighten on dark. Test with `axe-core` in CI.
- Skip-to-content link as first child of `<body>`.
- KaniBadge: wrap in persistent `aria-live="polite"` container.
- Form labels: every `<input>`/`<select>` has matching `<label htmlFor>` or `aria-label`.
- Range input `aria-label="Leverage"`.
- `prefers-reduced-motion` block in atrium-mobile.css and atrium-landing.css.
- Modal backdrop: remove `aria-hidden="true"` since it has onClick.
- Replace `window.confirm` with styled `<ConfirmModal>` (kill switch, destructive actions).
- Focus rings on all interactive elements: `focus-visible:ring-2 focus-visible:ring-[--accent]`.
- Keyboard nav: Escape closes modals (already done in modal.tsx); add Enter to advance verifier steps; arrow keys in positions table.

#### 5.19 Performance (PERF-01..PERF-08)

- Lighthouse CI hard-fails after Phase 11 deploys to prod URL. Remove `|| echo` fallback in ci.yml.
- Migrate Geist + Instrument Serif to `next/font/google`. Removes `<link>` to fonts.googleapis.com (also helps CSP F1). Self-hosting effectively done at the same time.
- `next/dynamic` with `{ ssr: false }` for: `MobileLanding` (deleted in Phase 1 anyway), `RiskPreviewModal`, `OnboardingFlow`, `NewMandateButton`, any wagmi-pulling component on landing routes.
- Split globals.css into route-scoped modules: `app-shell.css` (loaded by /app layout), `landing.css` (landing only), `mobile.css` (mobile only).
- Dual-render fix: use `useMediaQuery` + conditional render OR Next.js `userAgent()` SSR detection. One tree at a time. (Phase 1 deletes the Lovable port; this PERF item then naturally resolves.)
- localStorage reads: `useSyncExternalStore` with explicit `getServerSnapshot` returning false.
- Verify Sentry tunnelRoute `/monitoring` is in CSP `connect-src 'self'`.

#### 5.20 SEO (SEO-01..SEO-10)

- Every page exports `metadata` (or `generateMetadata` for dynamic). 7 verifier steps + chaos + benchmarks + cohort etc. all need this. Use a shared `buildMetadata({ title, description, ogImage })` helper.
- Add `metadataBase: new URL('https://atrium.fi')` in root layout. Per-page `alternates: { canonical: '/path' }`.
- JSON-LD: `Organization` on landing, `FAQPage` on /learn, `BreadcrumbList` on `/app/*`, `SoftwareApplication` on landing for product schema. Use `next/script` with strategy="afterInteractive".
- Sitemap: add `/docs/honesty`, `/docs/api`, `/team`, `/security`, `/changelog`, `/manifesto`, `/learn`. Auto-derive from filesystem in `sitemap.ts`.
- robots.ts: disallow `/loadtest`, `/chaos`, `/monitoring`. Keep verifier steps allowed (judge-facing).
- Twitter: `card: 'summary_large_image'` explicit on landing. Keywords array.
- OG image: load Instrument Serif via `fetch()` in the OG handler so the wordmark renders correctly (closes L-27).

#### 5.21 Brand consistency (L-14..L-30)

- Title separator: `·` everywhere. Find/replace 8 outliers.
- Hardcoded `fontFamily` in 20+ components → Tailwind `font-sans`/`font-mono`/`font-display`. Removes per-file fallback strings.
- Em-dash audit: 191 instances — keep where ranges/attribution, replace with period/comma elsewhere. Run `pnpm dlx writing-lint` (if exists) or manual.
- Wordmark unused imports: 21 files — remove. Auto-fixable via `eslint --fix`.
- Dead `href="#"` (FULL_AUDIT #17, E2E-55): wire to real destinations or remove.
- SECURITY.md → link to runbooks/.
- Press kit ZIP at `/brand/press-kit.zip` (Phase 11).
- Team page: real founder names + GitHub links + 1-line backgrounds.
- Manifesto $3M/$500K → footnote linking to `services/archive/research/atrium-vs-isolated-aapl-arb-q1-2026.json`.
- Codex pricing → footnote "set by Praetor governance, see /docs/api".

#### 5.22 Demo + walk page (LV-21, LV-22, LV-26)

- `MobileApp.tsx` deletion in Phase 1 closes LV-21.
- All 9 workflow files confirmed (LV-22 — already PASS).
- JUDGE_ONE_PAGER closing claim (LV-26): rewrite "Numbers sourced from simulated backtest are labelled as such above. On-chain numbers come from Scribe."



### Exit criteria for Phase 5

- Lighthouse: ≥90 on every category for landing, /app/portfolio, /verify/1.
- axe-core CI: zero violations on every public route.
- BrowserStack: pass on iPhone 14 Safari, Pixel 7 Chrome, iPad Safari, Galaxy S23 Chrome.
- 6 states verified per page via a screenshot test matrix.
- All 5 mobile flows usable on 375×667 viewport without horizontal scroll.
- Wrong-chain banner shows when wallet on chain != arbitrumSepolia.
- Tx hash + Arbiscan link on every successful write.
- No banned-word violations: `pnpm dlx writing-lint` clean (or manual grep).
- All metadata exports + canonical URLs verified by `next-sitemap`.
- Sentry consent banner gates init (verified in fresh-browser test).

---

## 10. Phase 6 — Off-chain services (Days 26-29)

### Goal

Tablet, notifier, lantern-attestor, vigil-keeper, codex, agents — all functional with real FX, pagination, auth, integration tests. No stubs.

### Findings closed

| ID | Source | Issue |
|----|--------|-------|
| #7, #20, #22, #26, #39, #49, #50, #51, #52, #68, #69 | FULL_AUDIT | Off-chain services issues |
| HIGH-09..13 | ANTIGRAVITY | Tablet pagination, FX, broken endpoints |

### Best solution per cluster

#### 6.1 Tablet — proper FX layer (HIGH-10, HIGH-11, FULL_AUDIT #9)

Use `services/tablet/src/fx_rates.py` reading historical USD→GBP and USD→EUR via the European Central Bank's free API:

```python
# https://api.frankfurter.app/<date>?from=USD&to=GBP,EUR
# Free, no auth, daily ECB rates back to 1999, sub-100ms response.
```

Cache per-day in SQLite at `services/tablet/data/fx-cache.sqlite`. Fallback to ECB CSV download if API unreachable. Both UK CGT and German FIFO calculators apply rates per trade timestamp. Update `de.py` and `uk.py` to call `get_rate(timestamp.date(), 'EUR'|'GBP')` for every trade row.

Closes: HIGH-10, HIGH-11, FULL_AUDIT #9.

#### 6.2 Tablet — missing endpoints + auth (HIGH-12, HIGH-13, FULL_AUDIT #7)

`/summary` and `/events` endpoints don't exist in Tablet. Add them in `services/tablet/src/main.py`:

```python
@app.get("/summary")
async def summary(address: str, jurisdiction: str, year: int, _auth: str = Depends(require_internal_key)):
    ...

@app.get("/events")
async def events(address: str, jurisdiction: str, year: int, _auth: str = Depends(require_internal_key)):
    ...
```

Verify-app `/api/tax/export` route passes `address`, `tax_year_start`, `tax_year_end` correctly. `require_internal_key` checks `Authorization: Bearer <ATRIUM_INTERNAL_KEY>` (Doppler-managed).

Closes: HIGH-12, HIGH-13, FULL_AUDIT #7.

#### 6.3 Tablet — pagination (HIGH-09)

`scribe_client.py` paginates trade history with `skip` cursor. Same cursor pattern as Phase 4.4. Tests assert >1000 trades over a year produce a complete CSV.

#### 6.4 Notifier on DigitalOcean daemon (FULL_AUDIT #14, MED-05)

Phase 7 provisions the droplet. Phase 6 prepares the daemon code:
- `pm2 start ecosystem.config.js` runs notifier as managed process.
- Restart on crash.
- Environment from Doppler via `doppler run -- pm2 start`.
- Log to `/var/log/notifier/` rotated daily.
- Honeybadger ping at start of every tick, alert if no ping in 5 min.
- 30-second tick interval (down from 1-minute, since GHA quota is no longer the constraint).

#### 6.5 Notifier no-fetch-timeout fix (SD-5) — already done in Phase 2

Confirmed.

#### 6.6 Lantern share-redemption-aware (FULL_AUDIT #20)

Phase 4.5 noted: Lantern fetches user list from Scribe but reads authoritative balance via `Coffer.convertToAssets(Coffer.balanceOf(user))` per leaf. Phase 6 implements:

```ts
// services/lantern-attestor/src/leaves.ts
async function buildLeaves(users: string[], coffer: ContractInstance): Promise<Leaf[]> {
  return Promise.all(users.map(async (user) => {
    const shares = await coffer.read.balanceOf([user]);
    const assets = await coffer.read.convertToAssets([shares]);
    const salt = keccak256(toBytes(user));
    return { user, balanceWei: assets, salt };
  }));
}
```

Plus pagination (Phase 4.4 cursor pattern) for the user list.

#### 6.7 Vigil-keeper testnet stake unblock (FULL_AUDIT #39)

Phase 2 reduced `keeper_min_stake_wei` from 1000 ETH to 0.01 ETH (testnet feature flag). Phase 6 stakes the keeper EOA: `praetor-cli vigil:stake-keeper --addr <KEEPER_EOA> --amount 0.01`. Updates `deployments/arbitrum_sepolia.json` with keeper info.

Vigil-keeper service flips from logs-only to real execution path (the code already supports it; just needs `activeKeeperCount > 0`). Add Honeybadger cron monitoring + Discord ops on errors.

#### 6.8 Codex pay-to address (FULL_AUDIT #49)

`CODEX_PAY_TO_ADDRESS` is `"REPLACE_BEFORE_PRODUCTION_DEPLOY"`. For testnet, configure to a Coffer-deposit-derived address controlled by Praetor. Update Doppler secret. Test x402 paid endpoint round-trip with a testnet USDC payment.

x402 reference: `resources/x402/specs/x402-specification-v2.md` for the request/response shape; `resources/x402/typescript/` for the verifier reference impl.

#### 6.9 Real agent strategy logic (FULL_AUDIT #50)

Currently `notes.push('would-act-on: ...')`. Implement minimum-viable strategies for testnet:

- **Augur (mean-reversion)**: read 24h price from Scribe, compute z-score vs 30d mean, if `|z| > 2` open opposite-direction position sized at 10% of available margin. Close when |z| < 0.5.
- **Haruspex (momentum)**: 7-day SMA crossover. Long when price > SMA + 1σ.
- **Auspex (basis-trade)**: read perp funding rate from Hyperliquid testnet, read T-bill yield from Aave-Horizon, open hedged pair when funding > yield + 200bps spread.

All three live in `agents/<name>/src/lib.rs` (or .ts). Each agent runs as a GHA workflow on its own cron, signs an EIP-712 ActionSigil, calls `Sigil.validate_action` → `AtriumRouter.openPosition`.

For testnet: simple. For mainnet: real strategy R&D needed.

Each agent has `/api/status` returning real "live" status (last action timestamp, total actions count from Scribe). No more "live" claim when stub.

#### 6.10 Notifier + agents test coverage (FULL_AUDIT #22, #52)

Vitest for notifier (channel delivery, alert routing, schema sync). Conformance suite for `IPorticoAdapter` (Phase 9 detailed). Agents get unit tests on strategy logic + integration test against Sepolia.

#### 6.11 Loadtest deployer EOA replacement (FULL_AUDIT #68)

Use a dedicated `LOADTEST_EOA_KEY` (Doppler), separate from deployer. Stocked with testnet USDC + ETH for gas. Worst case: leak compromises only loadtest funds.

#### 6.12 Archive IPFS Content-Type (FULL_AUDIT #69)

Web3.storage expects `Content-Type: multipart/form-data` with the CAR file. Current code uses `application/json`. Fix in `services/archive/src/pin_to_ipfs.py`. Add integration test that pins a known CAR and reads it back.

### Exit criteria for Phase 6

- Tablet `/summary`, `/events`, `/export` all return correct values for a known test wallet across UK, DE, US.
- Tablet FX tests pass: a 2024-03-15 trade priced at $100 USD shows as the actual ECB EUR/GBP rate for that date.
- Tablet auth: unauth request returns 401.
- Notifier delivers a real alert end-to-end within 30s (down from 60s).
- Lantern: a sampled balance from Scribe matches `convertToAssets(balanceOf(user))` within 1 wei.
- Vigil-keeper: stake confirmed on-chain, ready to execute.
- Codex paid endpoint returns 200 + signed payment receipt.
- Each agent's `/api/status` returns real `lastAction` timestamp from Scribe.



---

## 11. Phase 7 — Infrastructure (Days 30-32)

### Goal

Notifier + vigil-keeper run on DigitalOcean droplets (no more 1-min GHA cron). Doppler injects every secret. `status.atrium.fi` is live. Discord exists with a vanity invite. DNS for staging subdomains either provisioned or stripped from refs. Vercel auth wall removed when ready.

### Best solution per cluster

#### 7.1 DigitalOcean droplet for daemons

Single $6/mo basic droplet (covered by $200 credit for ~33 months). Ubuntu 24.04 LTS. Setup:

1. Create droplet via DO dashboard or `doctl compute droplet create`.
2. Install Node 20 + pnpm + pm2 + Doppler CLI.
3. Clone the repo (read-only deploy key).
4. `pnpm install --filter @atrium/notifier --filter @atrium/vigil-keeper --filter @atrium/lantern-attestor`.
5. `doppler setup` for each project, paste service tokens.
6. `pm2 start ecosystem.config.cjs` with three apps: notifier (30s tick), vigil-keeper (5min tick — kept here for safety), lantern-attestor (60min tick).
7. `pm2 save && pm2 startup` for boot persistence.
8. Honeybadger heartbeat per process.
9. UFW firewall: only port 22 (SSH key auth), no public services.
10. `unattended-upgrades` for security patches.

GHA cron files for these three services become disabled (set `on: workflow_dispatch` only) but kept for emergency manual triggers.

Closes: FULL_AUDIT #14, MED-05.

#### 7.2 Doppler integration end-to-end

- All Vercel env: replaced with single `DOPPLER_TOKEN`.
- DO droplet: each pm2 app launches via `doppler run --token=<service-token>`.
- GHA: `doppler secrets download --no-file --format env > .env.ci` then sourced.
- Local dev: `doppler run -- make demo` boots everything.
- Old `.env*` files deleted from disk and `.gitignore`.
- Audit log: Doppler workspace activity → Slack/Discord ops channel.

#### 7.3 Status page — Upptime on GitHub Pages

Free, no SaaS. Drop a YAML config with monitored URLs:

```yaml
# .github/upptime.yml
sites:
  - name: verify.atrium.fi
    url: https://verify.atrium.fi
  - name: codex.atrium.fi
    url: https://codex.atrium.fi/health
  - name: tablet.atrium.fi
    url: https://tablet.atrium.fi/health
  - name: scribe (subgraph)
    url: https://api.studio.thegraph.com/query/<id>/atrium/version/latest
    method: POST
    body: '{"query":"{ _meta { block { number } } }"}'
status-website:
  cname: status.atrium.fi
```

GitHub Action runs every 5 minutes, pings each URL, commits status to a `status` branch, GitHub Pages serves it. Outage history auto-tracked. Free.

DNS: CNAME `status.atrium.fi` → `<user>.github.io`. Both Namecheap and Name.com support CNAME at subdomain.

Closes: L-8, L-20, FULL_AUDIT #38 indirect.

#### 7.4 Discord server

Create a Discord server, vanity invite `discord.gg/atrium` (requires server boost level 3 — defer if cost-blocked, use a stable invite link). Channels:
- `#announcements` (mod-only)
- `#general`
- `#dev`
- `#bug-reports`
- `#ops-alerts` (webhooks from Honeybadger, GHA failure notifications, Sentry)
- `#audit-disclosure` (private, security@ recipients)

Footer link uses the real invite. Remove the redirect via `https://atrium.fi/discord`. Closes L-9, L-33.

Bot setup: install a webhook bot (e.g. `Webhooks` integration) for ops-alerts. No third-party SaaS needed.

#### 7.5 DNS for staging subdomains

Decision: **provision them**. Each is a Vercel preview deployment with a stable alias, easier than stripping every reference.

- `verify-staging.atrium.fi` → Vercel project alias for the `staging` branch.
- `codex-staging.atrium.fi` → DO droplet on port 3000, Caddy reverse-proxy with auto-TLS.
- `tablet-staging.atrium.fi` → same pattern as codex-staging on a different port.
- `lantern-staging.atrium.fi` → not needed; lantern is a daemon, not an HTTP service. Remove references.

Add DNS records via Namecheap dashboard. Verify with `nslookup`.

#### 7.6 PGP key for security disclosures (LV-13)

Generate offline:
```bash
gpg --full-generate-key  # RSA 4096, 1y expiration
gpg --armor --export security@atrium.fi > pgp.asc
```

Publish at `apps/verify/public/security/pgp.asc` and reference from `SECURITY.md`. Update `.well-known/security.txt`.

Private key in 1Password Team vault, two team members hold copies.

#### 7.7 Vercel auth wall removal

When Phase 11 lands, flip Vercel project setting "Deployment Protection" from "Standard Protection" to "Only Preview Deployments". Production at `verify.atrium.fi` becomes publicly reachable.

### Exit criteria

- `ssh atrium-do` reaches the droplet.
- `pm2 list` shows three healthy processes.
- Honeybadger reports green for all three crons.
- `nslookup status.atrium.fi` resolves; the page loads with real data.
- `https://discord.gg/atrium` (or stable invite) opens the server.
- `nslookup verify-staging.atrium.fi` resolves to Vercel.
- `https://atrium.fi/security/pgp.asc` returns a valid armored PGP block.

---

## 12. Phase 8 — Stylus wiring (Days 33-34)

### Goal

Execute the two pending timelock txs (#335 setAuthorizedCaller on adapters, #337 set_adapter on Coffer). Wire verifier steps 2/3/5. Run a full 7-step demo end-to-end against testnet.

### Best solution

#### 8.1 Execute timelock tx #335 — setAuthorizedCaller(AtriumRouter)

For each of the 8 v1.1 adapters (aave-horizon, curve, gmx, hyperliquid, morpho, pendle, polymarket, synthetix, trade-xyz):

```bash
# schedule
praetor-cli timelock:schedule \
  --target <adapter-address> \
  --calldata "$(cast calldata 'setAuthorizedCaller(address)' <ROUTER_ADDR>)" \
  --delay 172800

# wait 48h
# execute
praetor-cli timelock:execute --id <op-id>
```

Closes the open task #335 from your roadmap.

#### 8.2 Execute timelock tx #337 — Coffer.setAdapter for each Portico adapter

Same pattern. Schedule once, execute after 48h:

```bash
praetor-cli timelock:schedule \
  --target <coffer-address> \
  --calldata "$(cast calldata 'setAdapter(uint8,address)' <venue_id> <adapter_addr>)" \
  --delay 172800
```

Closes task #337.

#### 8.3 Verifier step 2 — plinth-open-position

The button currently throws `pendingReason`. After 8.1 and 8.2 land, AtriumRouter's `openPositionViaAdapter` works end-to-end. Update `lib/verifier-step-config.ts`:

```ts
{
  id: 2,
  kind: 'plinth-open-position',
  pending: false, // was true
  ...
}
```

`verifier-step-runner.tsx` switch case dispatches to `useOpenPosition()` hook. Hook signs Sigil mandate, calls `Router.openPositionViaAdapter` with venue_id 1 (Hyperliquid HIP-3 perp, $1000 long), waits for receipt, displays Arbiscan link.

#### 8.4 Verifier step 3 — plinth-recompute-margin

After step 2 opens a position, step 3 calls `Plinth.update_margin(user)` and reads `before/after` margin. UI shows the saving (e.g. "Required margin: $1,200 → $1,200, hedged saving applies on opposite-leg open"). Real numbers from real reads.

For the demo to show meaningful margin saving, step 2 should actually open BOTH legs (long perp + long T-bills) and step 3 should show the SPAN-net margin. Update step 2 to be a hedged batch: call `Router.openHedgedPair(legA, legB)` if such a function exists, or two sequential `openPositionViaAdapter` calls.

Reference: `resources/openzeppelin-contracts/contracts/proxy/utils/Initializable.sol` for the multicall pattern; the Router already supports a multicall path per existing AtriumRouter.sol.

#### 8.5 Verifier step 5 — vigil-liquidate

Phase 6 already staked the vigil-keeper EOA. Step 5 demonstrates: chaos drift Plinth margin via `praetor:chaos-inject oracle_drift`, observe Plinth pause, trigger `Vigil.queueLiquidation`, then `Vigil.executeLiquidation`. UI shows the keeper's reward + recovered collateral.

For the demo: pre-fund a "stunt-double" position at low margin so the chaos drift makes it underwater. Run the kill-switch demo (step 7) AFTER step 5 to clean up.

#### 8.6 Demo runbook update

`rehearsals/judge-runbook.md` rewritten to match what now actually works. Beat-by-beat with real expected timings. `rehearsals/dress-runs/` directory created with one signed-off run per practice session.

Acceptance criteria gate updated: 7/7 steps wired (was 4/7).

### Exit criteria

- All 7 verifier steps execute end-to-end against Sepolia in a fresh wallet.
- A judge runs the demo in 5 minutes with no manual intervention.
- `/verify/2`, `/verify/3`, `/verify/5` show real tx hashes.
- Judge-runbook acceptance criteria all checked.



---

## 13. Phase 9 — Testing (Days 35-40)

### Goal

Foundry integration tests for cross-contract flows. Matchstick tests for every handler. Notifier vitest. Agents vitest. IPorticoAdapter conformance suite. Playwright for all 7 verifier steps + 5 mobile flows. Halmos symbolic execution for additional invariants. CI gates green on all of it.

### Findings closed

- FULL_AUDIT #21 (no Foundry integration tests)
- FULL_AUDIT #22 (notifier zero tests)
- FULL_AUDIT #52 (agents zero tests, conformance dir empty)
- SD-14, SD-27 (matchstick + CI gate)
- L-10 (adapter conformance)

### Best solution

#### 9.1 Foundry integration tests

`tests/integration/` Foundry suite. Each file exercises a cross-contract scenario:

- `Deposit_Withdraw_RoundTrip.t.sol` — deposit USDC to Coffer, mint shares, withdraw shares, assert assets within rounding tolerance.
- `Margin_Liquidation_Recovery.t.sol` — open a position, drift oracle to liquidate, vigil executes, vault recovers collateral, user balance reflects loss.
- `Mandate_Action_Revoke.t.sol` — owner signs Sigil, agent calls validate_action, position opens, owner revokes, agent's next action reverts.
- `Aqueduct_Send_Settle.t.sol` — happy-path CCIP send → AqueductReceiver mints credit on dest → settle. Fork Sepolia + Polygon Amoy.
- `Aqueduct_Expired_ClaimBack.t.sol` — send, dest doesn't ack within window, source user calls claimBack.
- `Kill_Switch_Revokes_Everything.t.sol` — issue 3 mandates, issue 2 session keys, kill switch, assert all 5 revoked.
- `Hedged_Pair_Margin_Savings.t.sol` — open long perp + long T-bills, assert SPAN-net required margin < sum of isolated margins.
- `Adapter_Pull_Pause_Respect.t.sol` — pause Coffer withdrawals, attempt adapter pull, assert revert.

Use Foundry forking against Sepolia for realistic state. CI runs forge test in `test-solidity` job.

#### 9.2 Matchstick tests for all handlers

`subgraph/tests/` per-source file with handler tests:
- `plinth.test.ts` — every handler with edge cases (load-before-create, idempotent on re-orgs).
- `vigil.test.ts` — including `try_jobs(jobId)` view-call mock.
- `coffer.test.ts` — deposit/withdraw + circuit breaker + pause states.
- `aqueduct.test.ts` — credit lifecycle (created → settled or claimed-back).
- `sigil.test.ts` — IntentValidated bumps Agent counter.
- `lantern.test.ts` — root republishing creates new entity (post-Phase 4 fix).
- `rostrum.test.ts` — follow start/end, mirror filled/failed.
- `postern.test.ts` — kill switch + session key lifecycle.
- `curator.test.ts`, `praetor_timelock.test.ts`, `portico_registry.test.ts`, `research.test.ts`, `edict.test.ts`, `atrium_router.test.ts`.

CI gate: `pnpm --filter @atrium/subgraph test` added to `subgraph` job. Closes SD-27.

Reference: `resources/graph-tooling/examples/` for matchstick patterns.

#### 9.3 Notifier vitest

`services/notifier/src/*.test.ts`:
- `tick.test.ts` — mock Scribe response, assert routing logic, assert cursor advance.
- `router.test.ts` — per-channel delivery (telegram, email, webhook). Uses `nock` for HTTP mocks.
- `ssrf-guard.test.ts` — confirm 127.0.0.1, 10.0.0.1, 169.254.169.254, IPv6 ULA all rejected; public IPs accepted.
- `schema-sync.test.ts` — imports the same `KIND` constants used by handlers, asserts `mapAlertKind` covers every value.

#### 9.4 Agent tests

`agents/<name>/tests/` per agent:
- `strategy.test.ts` — given a price series, assert the strategy produces expected signals.
- `integration.test.ts` — fork-mode test that the agent signs an ActionSigil, calls the Router, and observes the right Position event.

#### 9.5 Adapter conformance suite (L-10)

`tests/adapter-conformance/` — 6 Foundry tests every IPorticoAdapter must pass:

1. `test_supports_iface()` — `supportsInterface(type(IPorticoAdapter).interfaceId) == true`.
2. `test_only_authorized_caller()` — `openPosition` reverts when caller != authorized.
3. `test_paused_blocks_open()` — adapter pause blocks new opens.
4. `test_health_returns_status()` — `getVenueHealth()` returns a valid struct.
5. `test_round_trip()` — open + close returns funds within slippage tolerance.
6. `test_reentrancy_protected()` — re-entry attempt reverts.

Run as a parameterized suite over each adapter address. CI gates that every adapter passes. Future adapters PR-tested by running the suite against the new contract.

CONTRIBUTING.md (after Phase 1) references this suite for grant eligibility.

#### 9.6 Playwright E2E

`apps/verify/tests/e2e/`:
- `verifier.spec.ts` — all 7 steps with a funded test wallet. Uses Playwright's wallet mock or the Coinbase Wallet test mode.
- `onboarding.spec.ts` — full flow, including WebAuthn mocked.
- `mobile-flows.spec.ts` — 5 required flows on iPhone 14 viewport via BrowserStack.
- `kill-switch.spec.ts` — issue mandates + keys, kill switch, assert revoked.
- `error-states.spec.ts` — wrong chain, paused contract, insufficient balance — all show banners.

Wire BrowserStack via Student Pack credentials in CI. Run on every PR.

#### 9.7 Halmos symbolic execution

`resources/halmos/examples/` shows the pattern. Add halmos proofs for:
- `Plinth.required_margin` SPAN scenario non-negativity.
- `Coffer.convert_to_shares ↔ convert_to_assets` round-trip rounding bound.
- `Sigil.validate_action` nonce monotonicity.
- `AtriumRouter.openPositionViaAdapter` reverts iff any precondition fails.

Run as a separate CI job (slow, parallel). Gate on success.

#### 9.8 CI gating

Update `.github/workflows/ci.yml`:
- All test suites must pass for merge.
- Coverage uploaded to Codecov on every job.
- Lighthouse hard-fails on landing + /app/portfolio.
- axe-core hard-fails on every public route.
- BrowserStack matrix passes on iPhone 14, Pixel 7, iPad, Galaxy S23.

### Exit criteria

- 0 contract findings without test coverage.
- Subgraph handler tests cover every event handler.
- Notifier integration test green against testnet Scribe.
- 6 adapter conformance tests green for every deployed adapter.
- Playwright verifier suite passes 7/7 steps.
- BrowserStack passes 5/5 mobile flows.

---

## 14. Phase 10 — Legal + compliance (Days 41-43)

### Goal

GDPR/CCPA-compliant privacy policy. Cookie consent banner gates Sentry + analytics. Real terms with governing law and dispute resolution. Accessibility statement. Bug bounty scope document. Sub-processor list. Risk disclosures everywhere users commit funds.

### Findings closed

- L-1 through L-13 (legal/compliance items)
- F5 (Sentry consent)
- websec consent items
- E2E-21 (tax export auth — Phase 2 partial; legal text here)

### Best solution

#### 10.1 Privacy policy — proper rewrite

Use a GDPR-compliant template (e.g. Termly free tier or hand-written based on ICO guidance). Required sections:

- Data controller: Atrium Labs Inc. (or whatever entity name; if no entity, document as "the Atrium project team — see /team for individuals").
- Lawful basis (Art. 6): legitimate interest for analytics (with opt-out), contract for service delivery, consent for Sentry replay/marketing.
- Data categories: wallet addresses, IP addresses, user-agent strings, error context, optional KYC documents (if Sumsub integration active).
- Retention: per category. Codex API logs 24h. Sentry events 90d. KYC documents per Sumsub's policy.
- Third-party processors: Vercel (hosting), Cloudflare (DNS), Sentry (errors), SimpleAnalytics (analytics), Sumsub (KYC), Doppler (secrets), DigitalOcean (daemons). Each linked with their privacy URL.
- User rights: access, rectification, erasure, portability, objection, complaint to supervisory authority.
- Mechanism to exercise rights: `privacy@atrium.fi` plus a self-service `/legal/data-request` page.
- International transfers: SCCs (standard contractual clauses) for Vercel/DigitalOcean US transfers.
- KYC disclosure: dedicated section (closes L-12).
- Minors: service not intended for under-18.

Lawyer review recommended ($2-5K) but not strictly required for testnet if template is followed carefully. Mainnet must have lawyer review.

#### 10.2 Terms of service rewrite (L-4)

- Eligibility: 18+, not in OFAC-sanctioned country, not a US person if SEC restrictions apply (decision needed).
- Governing law: Cayman Islands or Delaware (typical for crypto). Written into the constitutional documents of the entity.
- Dispute resolution: arbitration via JAMS or LCIA. Class-action waiver. Limitation of liability standard caps.
- Excluded jurisdictions list (Edict tier 0): US sanctioned, OFAC list, plus any per legal advice.
- Service definition: testnet-only for v1.
- License: MIT for the codebase, separate license for the service itself.

#### 10.3 Cookie consent banner (L-5, F5)

Implement using a small custom React component (no heavyweight SaaS). Stored in localStorage as `atrium_consent_v1` with categories: `essential` (always on), `analytics` (SimpleAnalytics + Sentry), `marketing` (none today).

Banner shown on first visit, gives "Accept all", "Reject non-essential", "Customize". Customize lets user toggle analytics. Banner dismissable via Escape. Re-shows after 12 months or on consent reset.

Sentry init waits on `hasConsent('analytics')`. SimpleAnalytics tag waits on same.

Reference component: open-source `react-cookie-consent` or hand-written 100-line component (better — no extra deps).

#### 10.4 Accessibility statement (L-11)

Page at `/accessibility` listing:
- Target: WCAG 2.1 AA.
- Known gaps (post-Phase 5 fixes — should be very few).
- Contact: `accessibility@atrium.fi` for issues.
- Date last reviewed.
- Statement that the assessment was self-conducted.

Required by European Accessibility Act 2025 if EU users targeted.

#### 10.5 KYC disclosure (L-12)

Dedicated section in privacy policy AND a `/legal/kyc` page. Lists:
- When KYC triggered (Edict tier upgrade for restricted venues).
- Data Sumsub collects (gov ID, selfie, biometric).
- Sumsub's role as processor; their privacy policy linked.
- Retention: per Sumsub policy + AML record-keeping requirement.
- Failure consequence: tier remains at 0, restricted venues unavailable.
- Appeal mechanism: re-submit via the KYC flow; manual review available.

#### 10.6 Bug bounty scope (L-13, L-36)

`SECURITY.md` and `/security` reference a $25K ceiling. Either publish a real bounty program OR remove the dollar figure.

Best path: publish a scope document NOW even if no funds are escrowed. Format:

- In scope: testnet contracts (list specific addresses), verify-app, codex, tablet APIs.
- Out of scope: front-end UI bugs without security impact, social engineering, third-party services.
- Severity matrix: critical (fund-loss / unauthorized admin) → $5-25K, high → $1-5K, medium → $250-1K, low/info → swag.
- Funded: from Praetor treasury post-mainnet. Until then "best-effort" with public hall-of-fame credit.
- Disclosure: 90-day responsible disclosure window.

Hall-of-fame page at `/security/hall-of-fame` listing acknowledged researchers.

#### 10.7 Risk disclosures on commit-fund pages (L-6)

Vault deposit, trade open, transfer — every page where user commits funds renders a small persistent "Testnet only · no real funds at risk" pill. Already on the kill-switch (per Phase 5.16); extend to every commit page.

#### 10.8 Support email + Discord (L-9)

- `support@atrium.fi` set up via Namecheap free email or Cloudflare Email Routing (free) → forwards to a real inbox.
- Discord live (Phase 7).
- Footer updates: support@, Discord invite, GitHub issues link.

#### 10.9 Status page link from SLA (L-20)

The SLA page links to `status.atrium.fi`. Live indicator shows current uptime. Historical incidents from `incidents/` linked.

#### 10.10 Sub-processor list

Live page at `/legal/sub-processors`. Updated whenever a new SaaS lands. RSS feed of changes for sophisticated users.

### Exit criteria

- Privacy policy reviewed against GDPR Art. 13/14 checklist.
- Terms reviewed against typical crypto-product template (e.g. Tornado Cash terms as a baseline; not legal advice).
- Cookie consent banner functional; Sentry only initializes after consent.
- `/accessibility` page live.
- `/legal/sub-processors` page live with all real third parties.
- `/security/bounty` page live with scope and severity matrix.
- Risk pill present on every commit-fund page.



---

## 15. Phase 11 — Launch prep (Days 44-46)

### Goal

Final brand polish. PWA installable. CHANGELOG. Audits relocated. Repo hygiene done. Vercel auth wall removed. All metadata exports + canonical URLs. Sourcify verification confirmed for every contract.

### Best solution per cluster

#### 11.1 OG image with real serif font (L-27)

Load Instrument Serif from `public/fonts/` via fetch in the OG image handler:

```ts
// apps/verify/src/app/opengraph-image.tsx
const interFont = await fetch(new URL('../../public/fonts/InstrumentSerif-Italic.woff2', import.meta.url)).then(r => r.arrayBuffer());

export default function OG() {
  return new ImageResponse(<>...</>, {
    width: 1200, height: 630,
    fonts: [{ name: 'Instrument Serif', data: interFont, style: 'italic' }],
  });
}
```

Test by sharing the URL in Slack/Twitter and confirming the OG card renders the wordmark in italic serif.

#### 11.2 PWA — proper install (L-28, FULL_AUDIT #60, E2E-35..39)

- Generate 192px and 512px PNG icons from the SVG. Add to `manifest.json` with `purpose: "any maskable"`.
- Add `apple-touch-icon` `<link>` in layout.tsx pointing to the 180px PNG.
- `theme_color` matches mobile dark: `#141210`. `background_color` same. Closes FULL_AUDIT #34.
- Service worker via `next-pwa`: caches static assets, falls back offline for `/app/*` shell.
- Install-prompt component: detects `beforeinstallprompt` event, shows a small toast "Install Atrium for offline access" the second visit.

#### 11.3 Self-host fonts properly (PERF-03, websec F3)

Phase 5 already migrated to next/font. Phase 11 confirms: WOFF2 files in `public/fonts/`, no external Google Fonts link, CSP `font-src 'self'` only.

#### 11.4 CODEOWNERS real usernames + completeness (L-31, L-32)

Replace `@atrium-f1`/`@atrium-f2`/`@atrium-f3` with real GitHub handles. Add coverage for:
- `audits/`
- `incidents/`
- `docs/architecture.md`, `docs/deployment.md`, `docs/MASTER_PLAN.md`
- `.env.example`
- `Makefile`
- `docker-compose*.yml`
- `apps/verify/src/app/api/` (currently partial)

Confirm the GitHub branch protection enforces CODEOWNERS review.

#### 11.5 Press kit (L-18)

`/press` page with downloadable ZIP of: wordmark SVG (light + dark), icon PNG (multiple sizes), color palette PDF, one-paragraph boilerplate, photography (if any), testnet metrics snapshot.

Build the ZIP via a `make press-kit` target so it stays in sync.

#### 11.6 Team page (L-19)

Real founder names (or pseudonyms with consistent identity), GitHub profile links, 1-line backgrounds. Optional: photos. The "work is the credential" philosophy keeps language minimal but adds substance.

#### 11.7 CHANGELOG.md (L-7)

Generate from git tags + `/changelog` page content. Use `git-chglog` or hand-curate. Live at repo root. Auto-update on release tag via GHA.

#### 11.8 Repo hygiene

- Delete `bash.exe.stackdump` (FULL_AUDIT #66).
- Move `audits/month-2-5-half-baked-audits.md` → `audits/month-2-through-5-followups.md` (FULL_AUDIT #37).
- Move all root-level audit files into `audits/` (L-21, L-22, L-23) — done in Phase 0.
- Confirm `JUDGE_ONE_PAGER.md` not tracked (LV-41).
- Banned-word audits: `delve`, `robust`, `leverage` (as verb), `seamless`, `harness`, `streamline`, `cutting-edge`, `state-of-the-art`, `unlock` (L-24/25/26 plus this whole audit's writing rule).
- Dependabot Docker ecosystem (L-35).
- PR template adds "deployment-impact" checkbox (L-37).
- Issue template bounty figure aligned to Phase 10 scope doc (L-36).

#### 11.9 Sourcify verification

Verify every Solidity contract on Sourcify. For Stylus: track upstream support; if not yet available, document the limitation in `docs/deployment.md`.

#### 11.10 Vercel auth wall removal

Toggle "Deployment Protection" → "Only Preview Deployments" in Vercel project settings. Production at `verify.atrium.fi` becomes publicly reachable. Smoke test: incognito Chrome loads landing without auth challenge.

#### 11.11 Final smoke test

Manual checklist run-through of every public route, every authenticated flow, every mobile flow. Document with screenshots. Sign off as a team.

### Exit criteria

- Lighthouse ≥90 across all categories on production URL.
- PWA installable on Android Chrome and iOS Safari.
- Press kit downloadable.
- CHANGELOG matches git history.
- Sourcify shows green badge for every Solidity contract.
- `verify.atrium.fi` opens publicly with no auth challenge.
- Every URL in the sitemap returns 200 + valid metadata.

---

## 16. Phase 12 — Observability + soft launch (Days 47-48)

### Goal

Sentry, New Relic, Honeybadger all wired with real data. Status page live with five days of historical data. Alerting routes correctly. First testers invited. Feedback collection live.

### Best solution

#### 12.1 New Relic — APM, RUM, alerts

- APM agent on the verify-app (Node + browser). Collects request latency, error rate, web vitals.
- Browser RUM dashboard: per-route p50/p95 latency, error rate, slowest API routes.
- Custom dashboards: "Atrium core flow latency" (deposit, open position, withdraw, kill switch), "Indexer health" (Scribe block lag chart), "Daemon health" (notifier tick latency, lantern publish cadence).
- Alerts: p95 > 3s for 10 min → Discord ops; error rate > 1% for 5 min → Discord ops + email.

#### 12.2 Honeybadger — cron monitoring

Heartbeat URLs for every cron + daemon:
- Notifier (every 30s).
- Vigil-keeper (every 5 min).
- Lantern-attestor (every 10 min for v2 cadence).
- Subgraph health check (every 15 min).
- Loadtest nightly (daily at 3 AM UTC).
- Archive weekly (Mondays).
- Brand-assets daily.

Each daemon pings on tick start. Honeybadger alerts if no ping in 2× expected interval.

#### 12.3 Sentry — final config

Phase 3 set up consent + scrubbing. Phase 12 adds:
- Source maps uploaded automatically per build.
- Custom tags: `chain_id`, `wallet_truncated_first_4`, `route_kind`.
- Grouping rules to consolidate similar errors.
- Sampled session replay (10% session, 50% on error after consent).
- Slack/Discord integration for critical errors.

#### 12.4 Subgraph indexer health dashboard

A Grafana-like view (or just a `/api/scribe/health` page) showing:
- Current block lag.
- Last hour of lag values.
- Block-by-block ingestion rate.
- Per-handler tick latency.

Wired to New Relic custom metrics if needed.

#### 12.5 Discord ops alerting routes

`#ops-alerts` channel receives:
- Honeybadger missed-heartbeat alerts.
- Sentry critical errors (deduped).
- New Relic threshold alerts.
- GHA workflow failures (existing per Phase 3).
- Subgraph staleness (>200 blocks lag).
- Vigil-keeper liquidation events (informational).
- Lantern publish events (informational).

Each alert links to the relevant dashboard.

#### 12.6 First testers + feedback

- Invite ~10 trusted testers via Discord onboarding channel.
- Each tester gets a "verified tester" role granting access to a private feedback channel.
- Feedback form via Notion (Student Pack) or hand-built `/feedback` page.
- Bug reports route to GitHub issues with the security/standard templates.

#### 12.7 Soft launch announcement

- Coordinated tweet from team accounts with verify.atrium.fi link.
- Discord announcement.
- GitHub release notes.
- Status page goes live before announcement.
- Be ready for traffic spike: New Relic shows real load, scale daemon if needed.

### Exit criteria

- New Relic dashboard shows real verify-app traffic.
- Honeybadger reports green for every cron.
- Sentry receives source-mapped errors with clean grouping.
- Status page shows ≥5 days uptime data.
- 10 testers actively using the service over 48h.
- Zero P0 incidents in the first 48h post-launch.

---

## 17. Mainnet-deferred items

These are tracked but not blocking testnet launch. Each must be closed before mainnet:

| Area | Item | Source |
|------|------|--------|
| Multisig | Real Gnosis Safe with 3+ named signers, threshold ≥2/3 | wave2-product, security pre-mainnet |
| Audit | Trail of Bits or OpenZeppelin contract audit ($30K-100K) | mainnet hardening |
| Audit | Privacy lawyer review of policy + terms ($2-5K) | L-1, L-4 |
| Bounty | Immunefi-tier bug bounty program funded | L-13, FULL_AUDIT #25 partial |
| Indexer | Self-hosted Graph Node redundant indexer | SD-25 |
| Contracts | Stoa Black-Scholes Phase-2 implementation | FULL_AUDIT #56 |
| Contracts | Plinth instrument_key domain separator | W2-L1, FULL_AUDIT #55 |
| Contracts | Edict tier downgrade flow | W2-L4 |
| Contracts | Cargo.toml exact pins | W2-L1, FULL_AUDIT #54 |
| Contracts | Hyperliquid HIP-3/HIP-4 separate adapter instances | W2-M11 |
| Contracts | Aave-horizon adapter v1.0 cleanup (deregister deprecated) | W2-M10 |
| Frontend | Real PRD page or strip references | FULL_AUDIT #38 |
| Frontend | Real ROADMAP page or strip references | LV-11 |
| Frontend | i18n for DE/UK locales (hreflang) | SEO-07 |
| Frontend | Slug-based verifier URLs (`/verify/deposit` not `/verify/1`) | SEO-08 |
| Operations | On-call rotation funded + paid security ops | LV-14 |
| Operations | Sub-second monitoring with PagerDuty | mainnet hardening |
| Operations | Real legal entity registered | L-1 implicit |
| Tests | Halmos proofs for additional invariants beyond initial set | Phase 9.7 |
| Stylus | ERC-7201 namespaced storage for upgrade safety | wave2-resources-xref Finding 1.1 |

---

## 18. How to use this plan

### Day 1

Open `docs/plan-tracker.md`. Pick Phase 0 items. Assign owners. Start.

### Per-day standup format

- "What's done since yesterday." → tick boxes in plan-tracker.md.
- "What's blocked." → escalate; if a phase dependency, flag in standup.
- "What I'm doing today." → reference phase + finding ID.

### Per-phase exit gate

Run the Exit criteria checklist. If any item fails, do not start the next phase. Phase dependencies are enforced.

### Per-PR checklist (matches PR template)

- Which finding(s) does this close? List IDs.
- Have the associated tests landed?
- Does this change ABIs / require subgraph redeploy? If yes, document in PR body.
- Is there a documentation update? If user-visible behavior, yes.

### When a new finding lands

Add to `docs/plan-tracker.md` under the right phase. If it's Critical and in a closed phase, reopen the phase.

### When a finding turns out to be invalid

Document in `docs/plan-tracker.md` with reason marked `wontfix-with-reason`. Do not silently delete.

### Tooling shortcuts

- `make demo` — full local stack.
- `make plan-status` — counts open vs closed findings (script TBD in Phase 0).
- `make subgraph-sync` — runs update-subgraph-addresses + redeploys subgraph.
- `make press-kit` — regenerates downloadable ZIP.
- `make deployment-doc` — regenerates docs/deployment.md from registry JSON.
- `doppler run -- <cmd>` — runs anything with secrets injected.

### Communication

- Daily standup in Discord `#dev`.
- Weekly demo in `#general` showing what shipped.
- Critical issues escalate to `#ops-alerts` and email founders.
- Investor updates monthly with link to `/changelog` and `/security`.

---

## 19. Confidence and risk

### Highest-risk items in this plan

1. **Stylus redeploy wave (Phase 2).** Cross-contract state migration risk. Mitigation: dry-run on a forked Sepolia, schedule via timelock, written rollback plan per contract.
2. **SIWE auth migration (Phase 3).** Touches every API route. Mitigation: incremental rollout, env-only stub Phase 2 → SIWE Phase 3 → public Phase 11.
3. **Subgraph schema change (Phase 4).** Re-index from start block. Mitigation: deploy as v0.0.7 alongside v0.0.6, switch consumers, retire v0.0.6.
4. **Notifier on DO daemon (Phase 7).** Single droplet single-point-of-failure. Mitigation: Honeybadger heartbeat, DO snapshots, rebuild script committed.
5. **Vercel auth wall removal (Phase 11).** Public exposure. Mitigation: pre-launch security headers verification, rate limiting confirmed live, Sentry consent flow verified.

### Confidence assessment per phase

| Phase | Confidence | Why |
|-------|-----------|-----|
| 0 | High | Mostly account setup + key rotation. Standard ops. |
| 1 | High | Text + simple component swaps. No architecture risk. |
| 2 | Medium-High | Contract changes well-scoped; redeploy is the main risk. |
| 3 | Medium | SIWE introduces complexity; CSP needs careful allowlist tuning. |
| 4 | High | Schema changes are routine for The Graph. |
| 5 | Medium-High | Largest scope. Risk of running long. Parallelizable across team. |
| 6 | Medium | FX integration + agent strategies are real-engineering. |
| 7 | High | Standard ops setup. |
| 8 | High | Two timelock txs + UI state flips. Bounded scope. |
| 9 | Medium | Test coverage is large; risk of running long. Parallelizable. |
| 10 | Medium | Lawyer review is the unknown. Without it, accept self-review risk. |
| 11 | High | Polish work. Mostly checklist. |
| 12 | High | Standard observability setup. |

Total realistic estimate: 48 working days for a focused team of 3-4. Solo dev: 80-120 days.

