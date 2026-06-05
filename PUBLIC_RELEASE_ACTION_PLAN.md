# Public Release Action Plan

Consolidated, ordered for execution. Every item verified against the live repo (git-tracked status, em-dash sweep, key-value greps, the public docs/runbooks generator). Highest-blast-radius first.

---

## CRITICAL FINDING THAT CHANGES THE ORDER (read first)

`apps/verify/scripts/build-runbooks.mjs` reads **every** `.md` in `runbooks/` with no allowlist:

```js
files = (await readdir(RUNBOOKS_DIR)).filter((f) => f.endsWith('.md')).sort();
// every runbook's FULL markdown is embedded into runbooks.json
runbooks.push({ slug, title, summary, category: category(slug), markdown });
```

That JSON (`apps/verify/src/lib/generated/runbooks.json`) is rendered at the **public** `/docs/runbooks/[slug]` route. So the sensitive runbooks are not just "in the repo a judge could browse" — their full text is **served on the live site**.

Consequence: `git rm` alone is NOT enough. After removing files you MUST regenerate the JSON (`node apps/verify/scripts/build-runbooks.mjs`) and commit it, or the deleted content stays live. Add an explicit publish allowlist to the generator so this cannot regress.

Two facts that downgrade the panic level (verified):
- **No private-key VALUE is committed anywhere.** Greps for `0x[a-f0-9]{64}` in the incident file and both audit files return zero. Only the public on-chain deployer EOA `0x7DB1…9A42` appears, and it is already public on Arbiscan.
- **Em-dashes are already purged** across all tracked `.md` (commit 430d045). The cross-cutting em-dash item is closed; do not re-spend time on it.

---

## SECTION 1 — REMOVE FROM PUBLIC (`git rm` + add to `.gitignore` + regenerate runbooks.json)

These map live attack surface, ops topology, secret inventories, or internal candor with zero judge value. All are git-tracked today.

### 1A. Internal audits (full attack maps — remove both)
| File | One-line reason |
|---|---|
| `audits/2026-05-28-deep-audit.md` | Working exploit recipes vs the live testnet: SSRF targets (169.254.169.254, 127.0.0.1), GHA shell-injection exfil one-liner, unauthenticated `?wallet=` PII endpoints with file/line, and named CI secrets (`RESEARCH_SIGNER_KEY`, `WEB3_STORAGE_TOKEN`). |
| `audits/2026-05-28-full-audit.md` | 467-finding internal launch audit: names the full secret env inventory (`KEEPER_PRIVATE_KEY`, `PRAETOR_MULTISIG_KEY`, `LANTERN_SIGNER_KEY`, …), the chaos-route origin-bypass to pause Plinth, and reputationally damaging internal candor ("the honesty page itself lies", "two codebases stapled together"). Also stale (says 589 tests; real is 768). |

Keep `audits/2026-05-25-contract-quality-audit.md` (clean, post-scoped, a transparency win) — see Section 3.

### 1B. Ops topology + secret-inventory docs (remove the internal-infra ones)
| File | One-line reason |
|---|---|
| `ops/doppler/README.md` | Service-to-secret map (which daemon holds the deployer/keeper key, signing passphrase, HMAC, multisig addr) — an attacker's "which service to pop for the deployer key". |
| `ops/monitoring/uptime-config.md` | Internal Discord channel/on-call structure (`#alerts`, `#oncall` rotation) + monitored-endpoint list. (Note: one scan rated this keep because the *names* alone are low-risk; remove for consistency with the rest of the ops tree, or downgrade to redact per Section 2 if you want to keep the public-URL monitor list.) |

### 1C. Infra + secret-handling runbooks (remove)
| File | One-line reason |
|---|---|
| `runbooks/caddy-on-droplet.md` | Reverse-proxy topology: `codex.useatrium.me → localhost:3000`, `tablet → localhost:3001`, UFW rules, "DNS A record → droplet IP, not behind Cloudflare orange-cloud" = box is directly IP-exposed. |
| `runbooks/do-droplet-setup.md` | Per-daemon env inventory incl. `KEEPER_PRIVATE_KEY`, `LANTERN_SIGNER_KEY`, `SENDGRID_API_KEY`, `TELEGRAM_BOT_TOKEN`, `WEB3_STORAGE_TOKEN` + SSH-as-root flow + server layout. |
| `runbooks/dns-provisioning.md` | Re-exposes the codex:3000 / tablet:3001 droplet topology and Caddy wiring. |
| `runbooks/discord-server-setup.md` | Documents the secret name `DISCORD_OPS_WEBHOOK` and exactly where it's stored (Doppler all-envs + GitHub repo secret). |
| `runbooks/discord-alerts.md` | Alert-routing map (Honeybadger/Sentry/New Relic → private `#ops-alerts`, `@on-call`), internal Sentry org URL pattern. |
| `runbooks/email-routing.md` | Routes `security@`/`legal@` disclosures to a named "Founder F3" inbox; also marked "not yet configured" (live TODO, not docs). |
| `runbooks/honeybadger-setup.md` | Heartbeat check-in URLs + grace periods = a liveness-evasion hint for when a downed daemon alerts. |
| `runbooks/incident-aqueduct-ccip.md` | Spells out the exact CCIP double-spend window + SEV-0 zero-LINK halt trigger = how to time a bridge exploit. |
| `runbooks/incident-archive.md` | `RESEARCH_SIGNER_KEY` / `WEB3_STORAGE_TOKEN` rotation + "rotated key with stale GHA secret = signing with a now-public key" detail. |
| `runbooks/incident-chaos.md` | Demo-day choreography + multisig emergency-resume + Loom-backup-when-the-demo-misfires; also a **dead link** to `runbooks/demo-day.md` (verified missing). |
| `runbooks/incident-codex.md` | Founder on-call handles (F1/F2/F3), the `CODEX_DISABLED` kill-switch env, `CODEX_HMAC_KEY` rotation, D1 migration + wrangler rollback. |
| `runbooks/incident-keeper.md`, `runbooks/incident-lantern.md`, `runbooks/incident-notifier.md`, `runbooks/incident-oracle.md`, `runbooks/incident-scribe.md`, `runbooks/incident-response.md` | Same class: SEV-graded on-call playbooks naming signer keys, pause paths, and escalation. (These are in the same `incident-*` set and reach the public route — remove the whole set.) |

### 1D. Stray dev litter (remove)
| File | One-line reason |
|---|---|
| `contracts/sigil/src/lib.rs.fix-note` | `.fix-note` sidecar TODO next to source; the fix it describes (`revoke_all_on_behalf_of`, `postern_kill_switch`) is already in `lib.rs`. Pure scratch litter a judge sees while reading contracts. |

### 1E. The disputed file — `incidents/2026-05-24-deployer-key-leaked-to-local-temp-log.md`
The two scans split on this. The decisive facts:
- **No key value is committed** (verified) — only the public EOA address.
- **BUT** `runbooks/deployer-key-rotation.md` links it AND the whole incident is **rendered nowhere public itself**, while the deployer EOA `0x7DB1…9A42` is **still the live admin** across the stack (`deployments/robinhood_chain.json`, `services/codex/wrangler.toml`, deploy scripts) and rotation (#342 / #373 split state) is **not confirmed complete**.

**Decision: REMOVE until the deployer EOA is rotated and admin moves to the 3-of-5 Safe.** Publishing "this admin key was leaked and is unrotated" against a still-privileged live EOA is an open invitation. After rotation, a sanitized post-mortem (no live-privilege framing) can return as a transparency win. This is the founder-gated blocker — it gates the public flip per MEMORY.

Companion that must go with it (it links the leak and enumerates the admin-control surface):
- `runbooks/deployer-key-rotation.md` — links the leak incident, names the still-live EOA, and lists every contract granting it admin + the `transferAdmin`/`transferOwnership` selectors (a precise single-point-of-control map). Remove until rotation lands; re-add sanitized after.

### Execution for Section 1
```bash
git rm \
  audits/2026-05-28-deep-audit.md \
  audits/2026-05-28-full-audit.md \
  ops/doppler/README.md \
  ops/monitoring/uptime-config.md \
  runbooks/caddy-on-droplet.md \
  runbooks/do-droplet-setup.md \
  runbooks/dns-provisioning.md \
  runbooks/discord-server-setup.md \
  runbooks/discord-alerts.md \
  runbooks/email-routing.md \
  runbooks/honeybadger-setup.md \
  runbooks/incident-aqueduct-ccip.md \
  runbooks/incident-archive.md \
  runbooks/incident-chaos.md \
  runbooks/incident-codex.md \
  runbooks/incident-keeper.md \
  runbooks/incident-lantern.md \
  runbooks/incident-notifier.md \
  runbooks/incident-oracle.md \
  runbooks/incident-scribe.md \
  runbooks/incident-response.md \
  runbooks/deployer-key-rotation.md \
  incidents/2026-05-24-deployer-key-leaked-to-local-temp-log.md \
  contracts/sigil/src/lib.rs.fix-note
```

Then add to `.gitignore`:
```
# Internal ops / security — never public
audits/2026-05-28-*.md
ops/doppler/
ops/monitoring/
incidents/
runbooks/caddy-on-droplet.md
runbooks/do-droplet-setup.md
runbooks/dns-provisioning.md
runbooks/discord-*.md
runbooks/email-routing.md
runbooks/honeybadger-setup.md
runbooks/incident-*.md
runbooks/deployer-key-rotation.md
*.fix-note
```

**Then MANDATORY (or the deleted runbook text stays live):**
1. Add an exclusion list to `apps/verify/scripts/build-runbooks.mjs` so `incident-*`, `caddy-on-droplet`, `do-droplet-setup`, `dns-provisioning`, `discord-*`, `email-routing`, `honeybadger-setup`, `deployer-key-rotation` are never embedded — fail-closed allowlist, not blocklist, is safer (publish only a named set of clean deploy/key/monitoring docs).
2. `node apps/verify/scripts/build-runbooks.mjs` to regenerate `apps/verify/src/lib/generated/runbooks.json`.
3. Confirm the regenerated JSON no longer contains the removed slugs, and that `/docs/runbooks/[slug]` 404s for them.

> Note on the rest of `runbooks/` (deploy, key-rotation generic, on-call-rotation, pgp, soft-launch, smoke-test, vercel-*, status-page, student-pack, browserstack, loadtest-eoa, vigil-keeper-testnet-stake, etc.): one scan rated several of these keep-public (anonymized F1/F2/F3, `<placeholder>` IPs, no secrets). They are defensible as a transparency win. Decide as a tree: if you keep any runbooks public, the allowlist in step 1 above is what governs it. The deploy runbook needs fixes regardless — see Section 3.

---

## SECTION 2 — REDACT THEN KEEP (keep the file, strip the exact bits)

### 2.1 `docs/conventions/security.md` — on-call leak + overstated posture (HIGH)
- **Strip:** line 111 `Page F1 on Discord webhook` → `Page on-call via the ops Discord webhook` (drop the founder codename).
- **Edit:** posture/keys sections claim live `Praetor 3-of-5 multisig + 48h timelock` and `Hardware wallets, one per founder`. Add a "today vs Year-1 target" qualifier: *single deployer EOA controls admin today; 3-of-5 Safe + hardware wallets are the queued target (task #342).*
- **Align:** bug-bounty `$25K testnet / $250K+ mainnet` must match SECURITY.md + the `/security` page + the issue template (audit H-060 flags drift) or mark all "program pending".

### 2.2 `docs/conventions/testing.md` — F2/F3 on-call + internal § refs (LOW each)
- **Strip:** `Failures alert F2 on Discord webhook`, `F3 runs ten dry runs`, `random fault injection by F3` → generalize to "the on-call engineer" / "a maintainer", drop the Discord-webhook routing.
- **Reconcile:** line 18 "Halmos does not work on Stylus" contradicts `docs/resources.md` listing Halmos in the Plinth-CI section — fix one (see Section 4).
- Drop or re-point internal `TDD §…` / `PRD §…` cross-refs a public reader cannot open.

### 2.3 `apps/verify/tests/e2e/README.md` — internal subdomain + stale count (MEDIUM)
- **Strip:** the `(the internal ops log)` aside; replace `E2E_BASE_URL=https://verify.useatrium.me` with `https://www.useatrium.me` (or a `$E2E_BASE_URL` placeholder) — `verify.useatrium.me` is auth-walled (403) to outsiders.
- **Fix count:** header says "Five end-to-end journeys" but the dir holds ~13 spec files (06-wallet-connect … onboarding, verifier). Update the count + table. Confirm the `--project=mobile-safari` reference is still valid (WebKit fails headless here).

### 2.4 `apps/verify/public/fonts/README.md` — doc contradicts the repo (MEDIUM)
- **Rewrite to reality:** doc says "WOFF2 fetched at build time, gitignored". Actually the committed files are `.ttf` (`Geist-Regular.ttf`, `InstrumentSerif-Italic.ttf`) and `.gitignore` only ignores `*.woff2`. State which fonts are committed (`.ttf`) vs downloaded/ignored (`.woff2`).
- **Verify:** the OFL 1.1 license claim against the actual font metadata; cite the upstream license file, not "Google Fonts".

### 2.5 `ops/sentry/grouping-rules.md` — doc bugs (LOW; only if you keep `ops/` at all)
- Line 43: tag `wallet_truncated_first_4` but description says "first 6 chars (e.g. 0x1a2b)" — name/desc/example disagree. Pick one (e.g. `wallet_prefix_6` + `0x1a2b3c`).
- Lines 42-44: `chain_id, The chain ID` reads as broken list — use a colon, not a stray comma (no em-dash).
- Drop the internal "Phase 12" framing.
- (If you remove the whole `ops/` tree in Section 1, this goes with it.)

### 2.6 `runbooks/browserstack-setup.md` — stale local claim (LOW; only if keeping runbooks)
- Note `mobile-safari` runs via BrowserStack/CI only — headless WebKit fails locally (SSL connect error), so "working local project" is misleading.

---

## SECTION 3 — KEEP + FIX (public files, honesty / dead-link / stale issues)

### 3A. Cross-checked numbers that a judge will catch (do these first)

**`README.md`**
- Line 147: `660+ Solidity contract + integration tests` is unverified — reconcile against the real current `forge test` total (the 2026-05-25 audit logged 604/604) and use the real number or `600+`. Make it match the CI badge.
- Line 96: hardcoded PoR root `0x4b9e…ef1f0` + block `272828085` as "latest" goes stale instantly (Lantern republishes every 10 min; a judge clicking `/lantern` sees a newer root). Either drop the literal and link `/lantern` as source of truth, or label it "example root at time of writing". (`PITCH.md` lines 127-128 repeat this — fix together, Section 4.)
- Line 13 badge `768 passing` and line 146 Vitest `768` are correct — leave.

**`PITCH.md`**
- Line 134: `the Stylus core carries Kani formal-verification proofs` reads as "running in CI today". Match README/SECURITY: *9 Kani proofs authored; formal-verification CI lane lands Month 3.*

### 3B. "3-of-5 multisig as current" overstatement (repeated — see Section 4)
Affects `docs/architecture.md` (PraetorTimelock "3-of-5 with 48h delay" as current), `docs/conventions/security.md` (2.1 above), and `runbooks/deploy.md` line 6 pre-flight. Real state: single deployer EOA today, Safe migration queued (#342). Add the same "today vs target" one-liner everywhere, consistent with the live `/docs/honesty` page.

### 3C. "ERC-7201 namespaced storage" claimed-but-maybe-unimplemented (repeated)
Audit H-025 flags ERC-7201 as claimed but not implemented in the Stylus contracts. Appears in `contracts/plinth/README.md` and `docs/architecture.md`. **Verify against `src/lib.rs` `sol_storage!`**; if absent, soften to the actual storage approach in both.

### 3D. Dead / broken links
- `.github/ISSUE_TEMPLATE/security.md` line 28 + `SECURITY.md` lines 15/25: `verify.useatrium.me/security/bounty`, `www.useatrium.me/security/bounty`, `/security/hall-of-fame` — confirm each returns 200 before flipping public, else mark "coming at launch" inline / point at the SECURITY.md bounty section.
- `docs/conventions/ui.md`: references `verify.useatrium.me` as the judge-facing surface (auth-walled 403) — soften to the deployed Verifier Mode path.
- `runbooks/deploy.md` line 2/7: `deployments/arbitrum-sepolia.json` (hyphen) does not exist; real file is `arbitrum_sepolia.json` (underscore). Fix.
- `audits/2026-05-25-contract-quality-audit.md` line 217: points to `audits/2026-05-25-services-audit.md` which is `(TBD)`/missing — change to "planned (not yet written)".
- `docs/development.md`: spot-check the third-party faucet/RPC URLs (sepoliafaucet.com, arbitrum.faucet.dev, l2faucet.com, …); drop any dead ones.

### 3E. Honesty / stale facts inside kept files
- `CODE_OF_CONDUCT.md` line 25/28: drop "plus two external contributors when the cohort lands" (council = the three founders only) and soften/remove the "project Discord" enforcement line unless a Discord actually exists (the 2026-06-05 audit stripped unowned socials incl. Discord). Confirm `conduct@useatrium.me` is a live alias.
- `runbooks/deploy.md` (kept if you keep runbooks): line 36 `all 6 venues` → real launch count is **7** (9 adapters deployed, 2 named scaffolds); line 35 `within 60 minutes` → Lantern cadence is **~10 minutes**.
- `contracts/plinth/README.md`: gas table marks rows "Measured Wave-1" while the header says "to be measured + published on loadtest.useatrium.me" — reconcile (either link the published measurement or revert rows to "Target").
- `contracts/coffer/README.md`: drop the internal `(M7 fix)` audit-id tag → plain prose; verify the `$50M/$5M/$1M (testnet)` caps equal the on-chain Coffer config.
- `contracts/postern-kill-switch/README.md`: `PRD §22.2 patch 14` is a dangling internal ref if the PRD isn't public — replace with a self-contained one-line description.
- `GETTING_STARTED.md` line 39: verify `5 USDC / 0.0005 ETH / 24h cooldown` against the deployed Faucet constants.
- `docs/deployment.md`: the generator hard-truncates the Notes column ("…the 6 timelock ops executed a…") — fix `scripts/generate-deployment-doc.mjs` to wrap/footnote instead of clip; keep the honest "deployer placeholder" notes but cross-link the #342 Safe-migration caveat.
- `docs/lantern-attestor.md`: frame the `~100 req/s` public-RPC number as an assumption, not a measured ceiling.

### 3F. Low-priority polish (non-blocking)
- `CHANGELOG.md`: optionally collapse the 13 internal `Phase N:` Unreleased lines into Added/Changed/Fixed buckets (names New Relic/Honeybadger/Sentry — fine, just internal-flavored).
- `COMPETITIVE_POSITIONING.md` lines 9/102: repoint `.claude/rules/writing.md` (not committed) → `docs/conventions/writing.md`.
- `CONTRIBUTING.md`: add "the curator/grant/hall-of-fame program activates at launch, not yet operational"; confirm `tests/adapter-conformance/` is populated with the 6 conformance tests.
- `docs/conventions/git.md` line 13: genericize "outreach/targets-private.md" → "private outreach/target lists live off-repo".
- `docs/conventions/writing.md`: label the example block ($2.38B, 47%) clearly illustrative-only.

---

## SECTION 4 — CROSS-CUTTING (fix once, applies everywhere)

1. **"3-of-5 multisig / hardware wallets as CURRENT" overstatement** — appears in `docs/architecture.md`, `docs/conventions/security.md`, `runbooks/deploy.md`. Real state: single deployer EOA today, Safe migration queued (#342). Add the identical "today vs Year-1 target" qualifier in all three, matching the live `/docs/honesty` page. **This is the single most repeated honesty gap.**

2. **Pinned PoR Merkle root + block `272828085`** — hardcoded in `README.md` line 96 AND `PITCH.md` lines 127-128. Lantern republishes every 10 min, so it's stale on publish. Drop the literal in both, link `/lantern`, or label "example at time of writing".

3. **Kani: "proofs carried/running" vs "authored, CI lane Month 3"** — `PITCH.md` overstates; `README.md`/`SECURITY.md` are precise. Standardize on "9 Kani proofs authored; formal-verification CI lane lands Month 3" across all three.

4. **Halmos contradiction** — `docs/conventions/testing.md` ("does not work on Stylus") vs `docs/resources.md` (lists Halmos in Plinth-CI formal-verification). One is stale; recategorize Halmos as "evaluated, not used (no Stylus support)" in `resources.md` to match `testing.md`.

5. **ERC-7201 claim** — `contracts/plinth/README.md` + `docs/architecture.md`. Verify once against `src/lib.rs`; fix both the same way.

6. **`verify.useatrium.me` (auth-walled 403) cited as judge-facing** — `docs/conventions/ui.md`, `apps/verify/tests/e2e/README.md`. Replace with `www.useatrium.me` / the real Verifier path everywhere.

7. **Bounty figure drift** — `SECURITY.md`, `/security` page, `.github/ISSUE_TEMPLATE/security.md`, `docs/conventions/security.md` (audit H-060). Pick one number/status and use it in all four.

8. **F1/F2/F3 on-call codenames + Discord-webhook routing** — leaks in `docs/conventions/security.md` and `docs/conventions/testing.md` (and removed in Section 1 for the runbooks). Generalize to roles ("on-call engineer", "a maintainer") in the kept files; the canonical `runbooks/on-call-rotation.md` is already anonymized (keep).

9. **`deployments/arbitrum-sepolia.json` hyphen vs `arbitrum_sepolia.json` underscore** — standardize the manifest filename reference across all runbooks (`deploy.md` has the wrong one).

10. **Em-dashes** — ALREADY CLEAN across all tracked `.md` (commit 430d045, verified zero hits). No action; flagged only so you don't re-spend time. When authoring the redactions above, do not introduce any (use a colon, never a stray em-dash).

---

## FOUNDER-GATED GATE (must clear before the repo flips public)

Per MEMORY + Section 1E, none of the above fully closes the launch unless:
- The leaked deployer EOA `0x7DB1…9A42` is **rotated** and admin ownership moves to the 3-of-5 Safe (#342 / #373), so the still-live-privileged-key risk is gone — only then can a sanitized incident retro return.
- The Cloudflare token in git history (commit `9bec37b`) is **rotated** before the history goes public.
- The bounty/hall-of-fame external pages return 200, or are marked "coming at launch".

Order to execute: Section 1 (remove + regenerate runbooks.json + verify the live route 404s) → Section 4 cross-cutting edits (one pass fixes most of 2 and 3) → remaining Section 2/3 per-file → confirm founder-gated gate.
