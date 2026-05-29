# Plan Tracker — Per-Finding Checklist

Every finding from every audit file mapped to its phase. Tick when shipped. Reference this from PR descriptions.

**Status legend:** `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` wontfix-with-reason · `[M]` mainnet-deferred

**Phase legend:** P0 Foundation · P1 Truth · P2 Critical · P3 Security · P4 Subgraph · P5 Frontend · P6 Off-chain · P7 Infra · P8 Stylus · P9 Tests · P10 Legal · P11 Launch · P12 Observability · M Mainnet-deferred

---

## FULL_AUDIT_2026-05-28.md (69 findings)

### Critical
- [ ] #1 Phase: P0 — `.env` on disk has real Cloudflare/Graph/deployer/cron secrets. Move to Doppler.
- [ ] #2 Phase: P1 — `MobileLanding.tsx` hardcoded fake stats. Delete component, render desktop responsive.
- [ ] #3 Phase: P2 — `PlinthMath.required_margin` returns U256::ZERO on array mismatch. Revert instead.
- [ ] #4 Phase: P0 — `.dockerignore` excludes `agents/` + `services/` but Dockerfile COPYs them. Fix dockerignore.
- [ ] #5 Phase: P1 — `.gitignore` comments name Claude/AI workflow. Genericize.
- [ ] #6 Phase: P1 — `CONTRIBUTING.md` "Never add Co-authored-by: Claude". Genericize.

### High
- [ ] #7 Phase: P2 — Tablet zero authentication. Add Bearer token gate.
- [ ] #8 Phase: P2 — Notifier webhook SSRF. Implement DNS allowlist + IP family check.
- [ ] #9 Phase: P6 — Tablet UK/DE tax raw USD prices, no FX conversion. Add FX layer.
- [ ] #10 Phase: P2 — Vigil queue_liquidation not gated by is_paused. Add pause check.
- [ ] #11 Phase: P2 — Coffer/Sigil/Vigil initialize() front-run window. Migrate to #[constructor].
- [ ] #12 Phase: P2 — Rostrum mirrorOpen any-relayer. Require msg.sender == follower.
- [ ] #13 Phase: P2 — Aqueduct resume() onlyPraetor bypasses timelock. Change to onlyTimelock.
- [ ] #14 Phase: P3+P7 — notifier-cron 1-min exhausts GHA quota. Move to DO daemon.
- [ ] #15 Phase: P3 — 7/9 workflows no failure notifications. Add Discord webhook step.
- [ ] #16 Phase: P3 — No timeout-minutes on ci.yml. Add explicit timeouts.
- [ ] #17 Phase: P5 — 6 dead `href="#"` links. Wire or remove.
- [ ] #18 Phase: P5 — 21 unused Wordmark imports. eslint --fix.
- [ ] #19 Phase: P4 — LiquidationEvent.account = ''. Add user field, populate from view call.
- [ ] #20 Phase: P4+P6 — CofferUserBalance tracks net deposited, not redeemable. Lantern reads via convertToAssets.
- [ ] #21 Phase: P9 — Plinth/Coffer/Vigil/Sigil no Foundry integration tests. Write 8 cross-contract scenarios.
- [ ] #22 Phase: P9 — services/notifier zero tests. Vitest suite.
- [ ] #23 Phase: P5 — viewport-fit=cover missing. Add to layout.tsx Viewport export.
- [ ] #24 Phase: P5 — Kill-switch only desktop. Add mobile FAB + Settings row.
- [ ] #25 Phase: P0 — Deployer key leak follow-up unchecked. Complete rotation.
- [ ] #26 Phase: P4+P6 — Lantern first:1000 hardcoded. Paginate with cursor.

### Medium
- [ ] #27 Phase: P5 — 3 competing color approaches. Standardize on CSS var utilities.
- [ ] #28 Phase: P5 — Typography inconsistency. Italic headings violate ui.md.
- [ ] #29 Phase: P5 — 3 animate-spin spinners. Replace with skeleton.
- [ ] #30 Phase: P5 — Button system mismatch. Pick one shape per surface.
- [ ] #31 Phase: P5 — Instrument Serif not rendering. Self-host fonts (Phase 11) + Tailwind utility.
- [ ] #32 Phase: P5 — Touch targets too small (30/26/24px). Min 44px.
- [ ] #33 Phase: P5 — Body text 13.5/12.5px. Min 16px.
- [ ] #34 Phase: P11 — Theme color light but mobile UI dark. Match.
- [ ] #35 Phase: P1 — deployment.md personal Vercel URLs. Generate from registry.
- [ ] #36 Phase: P1 — deployment.md "conversation log" reference. Remove.
- [ ] #37 Phase: P11 — `audits/month-2-5-half-baked-audits.md` filename. Rename.
- [ ] #38 Phase: P1+M — SECURITY.md references `docs/prd.md §21`. Publish PRD or reword.
- [ ] #39 Phase: P2+P6 — Vigil keeper_min_stake_wei = 1000 ETH. Reduce to 0.01 testnet.
- [ ] #40 Phase: P2 — PorticoRegistry active_venue_ids never shrinks. Swap-and-pop.
- [ ] #41 Phase: P2 — Plinth close_position never calls Sigil.record_close. Add agent field + call.
- [ ] #42 Phase: P2 — AtriumRouter has no pause. Add pause/resume.
- [ ] #43 Phase: P4 — Position.entryPriceQ64 always zero. Emit in PositionOpened v2.
- [ ] #44 Phase: P4 — Counter + CohortPartner dead schema. Implement Counter writes; Cohort contract OR honestly empty.
- [ ] #45 Phase: P4 — LiquidationEvent.positionId stores job_id. Rename + add real positionId.
- [ ] #46 Phase: P3 — No concurrency groups (6/9 workflows). Add per workflow.
- [ ] #47 Phase: P3 — agents-cron prints API responses. Redact.
- [ ] #48 Phase: P3 — archive-weekly shell injection. Bind to env var.
- [ ] #49 Phase: P6 — Codex CODEX_PAY_TO_ADDRESS placeholder. Configure for testnet.
- [ ] #50 Phase: P6 — Agents are stubs. Implement real strategies.
- [ ] #51 Phase: P2 — Notifier tick.ts no fetch timeout. Add AbortSignal.timeout.
- [ ] #52 Phase: P9 — agents zero tests, conformance dir empty. Build conformance suite.
- [ ] #53 Phase: P3 — No rate limiting 90% routes. Upstash Redis ratelimit.

### Low
- [ ] #54 Phase: M — Cargo.toml semver ranges not pinned. Mainnet hardening.
- [ ] #55 Phase: M — Plinth instrument_key no domain separator. Mainnet hardening.
- [ ] #56 Phase: M — StoaBlackScholes returns zeros. Phase-2 explicitly deferred.
- [ ] #57 Phase: P4 — Subgraph package.json caret ranges. Pin exact.
- [ ] #58 Phase: P4 — LanternAttestation root as ID overwrites. Use txHash+logIndex ID.
- [ ] #59 Phase: P11 — Inconsistent title separators. Standardize on `·`.
- [ ] #60 Phase: P11 — manifest.json one icon. Add 192/512px PNG.
- [ ] #61 Phase: P5 — Double DOM render. Conditional render via useMediaQuery.
- [ ] #62 Phase: P5 — No mobile search. Add to mobile More tab.
- [ ] #63 Phase: P11 — Docker debian:bookworm-slim not digest-pinned. Pin SHA.
- [ ] #64 Phase: P11 — No non-root user in Docker runtime. Add USER directive.
- [ ] #65 Phase: P11 — No resource limits in docker-compose. Add limits.
- [ ] #66 Phase: P0 — bash.exe.stackdump in repo root. Delete.
- [ ] #67 Phase: P4 — subgraph/indexing-todo.md tracked. Rename to INDEXING-LOG.md.
- [ ] #68 Phase: P6 — Loadtest uses leaked deployer EOA. Use dedicated LOADTEST_EOA_KEY.
- [ ] #69 Phase: P6 — Archive pin_to_ipfs wrong Content-Type. Fix to multipart/form-data.



---

## ANTIGRAVITY_DEEP_AUDIT_REPORT_2026-05-28.md

### Critical
- [ ] CRT-01 Phase: P2 — PlinthMath array mismatch zero-margin (dup of #3).
- [ ] CRT-02 Phase: P2 — Notifier webhook SSRF (dup of #8).
- [ ] CRT-03 Phase: P5+P11 — Instrument Serif rendering as Geist. Fix CSS + self-host fonts.
- [ ] CRT-04 Phase: P5 — Mobile timeframe buttons 20.5px. Min 44px.
- [ ] CRT-05 Phase: P5 — Mobile body 14-15px. Min 16px.
- [ ] CRT-06 Phase: P3 — archive-weekly shell injection (dup of #48).

### High
- [ ] HIGH-01 Phase: P2 — Signed division floors-toward-zero. Add signed_floor_div helper.
- [ ] HIGH-02 Phase: P2 — Aqueduct resume timelock bypass (dup of #13).
- [ ] HIGH-03 Phase: P2 — Vigil queue_liquidation pause bypass (dup of #10).
- [ ] HIGH-04 Phase: P2 — Adapters bypass Coffer global pause. Gate adapter_pull on is_withdrawals_paused.
- [ ] HIGH-05 Phase: P2+P3 — Unauth APIs leak balances. Lock to env Phase 2; SIWE Phase 3.
- [ ] HIGH-06 Phase: P2+P3 — my-mandates unauth. Same as HIGH-05.
- [ ] HIGH-07 Phase: P2 — Notifier first:100 cap. Cursor pagination.
- [ ] HIGH-08 Phase: P4+P6 — Lantern first:1000 (dup of #26).
- [ ] HIGH-09 Phase: P6 — Tablet trade history first:1000. Paginate.
- [ ] HIGH-10 Phase: P6 — Tablet DE no FX. ECB API integration.
- [ ] HIGH-11 Phase: P6 — Tablet UK no FX. Same.
- [ ] HIGH-12 Phase: P6 — Tax export missing params. Pass address+tax_year_*.
- [ ] HIGH-13 Phase: P6 — Tax /summary, /events not implemented. Add to Tablet.
- [ ] HIGH-14 Phase: P1 — Mobile fake stats (dup of #2).
- [ ] HIGH-15 Phase: P0 — .dockerignore mismatch (dup of #4).
- [ ] HIGH-16 Phase: P3 — Workflow concurrency missing (dup of #46).

### Medium
- [ ] MED-01 Phase: P2 — Stylus initialize() front-run (dup of #11).
- [ ] MED-02 Phase: P2 — Chainlink answeredInRound ignored. Validate.
- [ ] MED-03 Phase: P2 — Aave shortfall deletes collateral. Assert exact withdraw match.
- [ ] MED-04 Phase: P3 — Chaos rate limiter in-memory Map. Move to Upstash Redis.
- [ ] MED-05 Phase: P3+P7 — notifier-cron 1-min (dup of #14).
- [ ] MED-06 Phase: P3 — CI no timeout-minutes (dup of #16).
- [ ] MED-07 Phase: P3 — Workflows no failure alerts (dup of #15).
- [ ] MED-08 Phase: P5 — Loader2 spinners (dup of #29).
- [ ] MED-09 Phase: P5 — Inline OKLCH bypass vars (dup of #27).
- [ ] MED-10 Phase: P5 — Leaderboard catches → empty array. Surface error state.

---

## wave1-a11y-perf-seo.md

### Accessibility (13)
- [ ] A11Y-01 Phase: P5 — `--muted` on `--bg` 3.8:1 contrast. Darken to oklch(46%).
- [ ] A11Y-02 Phase: P5 — `--faint` 2.2:1 contrast. Darken or promote to muted.
- [ ] A11Y-03 Phase: P5 — Mobile `--muted` 4.3:1. Lighten.
- [ ] A11Y-04 Phase: P5 — Mobile `--faint` 2.8:1. Lighten.
- [ ] A11Y-05 Phase: P5 — Hero light 4.1:1. Raise opacity.
- [ ] A11Y-06 Phase: P5 — No skip-to-content link. Add as first body child.
- [ ] A11Y-07 Phase: P5 — KaniBadge aria-live wrap missing. Wrap in persistent live region.
- [ ] A11Y-08 Phase: P5 — DesktopApp inputs no programmatic labels. Add htmlFor/id pairs.
- [ ] A11Y-09 Phase: P5 — Leverage range no aria-label. Add.
- [ ] A11Y-10 Phase: P5 — Verifier animate-spin (dup of #29).
- [ ] A11Y-11 Phase: P5 — Sub-stylesheets no prefers-reduced-motion. Add blocks.
- [ ] A11Y-12 Phase: P5 — Modal backdrop aria-hidden + onClick contradiction. Remove aria-hidden.
- [ ] A11Y-13 Phase: P5 — window.confirm for kill-switch. Replace with custom modal.

### Performance (8)
- [ ] PERF-01 Phase: P5+P11 — Lighthouse soft-fails. Remove `|| echo` after prod URL live.
- [ ] PERF-02 Phase: P5 — wagmi/viem in dependencies, tree-shaking dependent. Verify in bundle analyzer.
- [ ] PERF-03 Phase: P5+P11 — Google Fonts render-blocking link. Migrate to next/font/google + self-host.
- [ ] PERF-04 Phase: P5 — Heavy components static-imported. Use next/dynamic.
- [ ] PERF-05 Phase: P5 — globals.css 45KB unused selectors. Split into route-scoped modules.
- [ ] PERF-06 Phase: P5 — Dual DOM render. Conditional via useMediaQuery (dup of #61).
- [ ] PERF-07 Phase: P5 — localStorage in render flicker risk. useSyncExternalStore.
- [x] PERF-08 — Sentry tunnelRoute configured. PASS.

### SEO (10)
- [ ] SEO-01 Phase: P5 — 8 pages no metadata. Add export const metadata.
- [ ] SEO-02 Phase: P5 — No canonical URLs. Add metadataBase + per-page canonical.
- [ ] SEO-03 Phase: P5 — No JSON-LD. Add Organization, FAQPage, BreadcrumbList.
- [ ] SEO-04 Phase: P5 — Sitemap missing /docs/honesty + /docs/api. Add.
- [ ] SEO-05 Phase: P5 — robots.ts allows /loadtest, /chaos. Disallow.
- [ ] SEO-06 Phase: P5 — Landing no twitter card + keywords. Add explicit.
- [ ] SEO-07 Phase: M — No hreflang for DE/UK. Mainnet i18n.
- [ ] SEO-08 Phase: M — /verify/[step] non-descriptive URLs. Slug-based mainnet.
- [x] SEO-09 — OG image brand-aligned. PASS.
- [ ] SEO-10 Phase: P5 — metadataBase missing. Add to root layout.

---

## wave1-launch-brand-legal.md

### Critical (3)
- [ ] L-1 Phase: P10 — Privacy policy missing GDPR/CCPA substance. Full rewrite.
- [ ] L-2 Phase: P3+P10 — Sentry fires without consent/disclosure. Consent gate + privacy update.
- [ ] L-3 Phase: P1 — Desktop landing fake metrics (dup of P-1, #2).

### High (10)
- [ ] L-4 Phase: P10 — Terms missing governing law/disputes/eligibility.
- [ ] L-5 Phase: P10 — No cookie consent. Implement banner.
- [ ] L-6 Phase: P5+P10 — No risk disclosure on vault deposit. Add testnet pill.
- [ ] L-7 Phase: P11 — No CHANGELOG.md. Generate from page + git tags.
- [ ] L-8 Phase: P7+P10 — No status page. Upptime on GH Pages.
- [ ] L-9 Phase: P7+P10 — No support@/Discord/Telegram. Set up.
- [ ] L-10 Phase: P9 — Adapter conformance tests missing. Build 6-test suite.
- [ ] L-11 Phase: P10 — No accessibility statement. Create /accessibility page.
- [ ] L-12 Phase: P10 — KYC disclosure incomplete. Dedicated section.
- [ ] L-13 Phase: P10 — Bug bounty scope/exclusions not published. Document.

### Medium (19)
- [ ] L-14 Phase: P11 — Title separator inconsistency. Standardize on `·`.
- [ ] L-15 Phase: P5+P11 — Hardcoded fontFamily 20+ files. Tailwind utilities.
- [ ] L-16 Phase: P5+P11 — Em-dash overuse 191 instances. Audit per writing.md.
- [ ] L-17 Phase: P1 — SECURITY.md no runbooks/ link. Add.
- [ ] L-18 Phase: P11 — No press kit ZIP. Build /press page.
- [ ] L-19 Phase: P11 — Team page no founder names. Add.
- [ ] L-20 Phase: P7 — SLA page no monitoring link. Link to status.
- [ ] L-21 Phase: P0 — atrium_goal_audit_prompt.md tracked. Gitignore.
- [ ] L-22 Phase: P0 — ANTIGRAVITY report at root. Move to audits/.
- [ ] L-23 Phase: P0 — FULL_AUDIT at root. Move to audits/.
- [ ] L-24 Phase: P11 — Banned word "unlock" in deployment.md. Rewrite.
- [ ] L-25 Phase: P11 — Banned word "robust" in audit-prompt. Rewrite or gitignore.
- [x] L-26 — Claude reference removed (per existing audit). Confirm git.md uses generic.
- [ ] L-27 Phase: P11 — OG image system fonts. Load Instrument Serif via fetch.
- [ ] L-28 Phase: P11 — manifest.json one icon (dup of #60).
- [ ] L-29 Phase: P11 — Dynamic favicon no static fallback for SEO. Verify static link.
- [ ] L-30 Phase: P11 — Wordmark no Tailwind serif class. Add `font-display italic`.
- [ ] L-31 Phase: P11 — CODEOWNERS placeholder users. Real GitHub handles.
- [ ] L-32 Phase: P11 — CODEOWNERS missing audits/, incidents/, etc. Expand.
- [ ] L-33 Phase: P7 — Discord redirect indirect. Direct invite link.

### Low (11)
- [ ] L-34 Phase: P11 — Portfolio no testnet pill. Add.
- [ ] L-35 Phase: P11 — Dependabot no Docker ecosystem. Add.
- [ ] L-36 Phase: P10 — Issue template $25K bounty without scope. Align to bounty doc.
- [ ] L-37 Phase: P11 — PR template no deploy-safety check. Add checklist row.
- [ ] L-38 Phase: P5+P11 — Privacy/terms unused Wordmark imports. Remove.
- [ ] L-39 Phase: P5+P11 — Security/manifesto/team etc unused Wordmark imports. Remove.
- [ ] L-40 Phase: P1 — PARTNERS array unverified. Replace with technologies.
- [ ] L-41 Phase: P0 — JUDGE_ONE_PAGER tracked check. git rm --cached if needed.
- [x] L-42 — README clean. PASS.
- [ ] L-43 Phase: P1 — Manifesto $3M/$500K no footnote. Link to backtest.
- [ ] L-44 Phase: P1 — Codex pricing no source. Footnote.



---

## wave1-live-verify.md (26 findings)

- [ ] LV-01 Phase: P1 — deployment.md Stylus "BLOCKED" wrong. Generate from registry.
- [ ] LV-02 Phase: P1 — deployment.md lantern v1 address shown. Use v2.
- [ ] LV-03 Phase: P1 — deployment.md 7 contracts vs JSON 30+. Generate.
- [ ] LV-04 Phase: P1 — Numbers.tsx fabricated (dup of P-1). Delete.
- [ ] LV-05 Phase: P1 — MobileLanding 18 fake values (dup of #2). Delete.
- [ ] LV-06 Phase: P1 — MobileLanding fake partner logos (dup of L-40). Delete.
- [ ] LV-07 Phase: P1 — hero-section "live testnet feed" on static. Wire to /api/landing/hero.
- [ ] LV-08 Phase: P1 — Features.tsx fake portfolio. Delete.
- [ ] LV-09 Phase: P1 — Faucet copy $10K USDC wrong. Read from contract.
- [ ] LV-10 Phase: P1 — JUDGE_ONE_PAGER refs missing AUDIT_FINDINGS.md. Generate or remove.
- [ ] LV-11 Phase: P1 — docs/ROADMAP.md missing. Publish public roadmap.
- [ ] LV-12 Phase: P7 — *-staging URLs unreachable. Provision DNS.
- [ ] LV-13 Phase: P1+P7 — SECURITY.md PGP URL no key. Phase 1 fix text; Phase 7 publish key.
- [ ] LV-14 Phase: P1 — SECURITY.md 48-hour SLA without process. Soften wording.
- [ ] LV-15 Phase: P1 — CONTRIBUTING.md $5K ARB no funding. Qualify "post-mainnet treasury".
- [ ] LV-16 Phase: P1+P9 — CONTRIBUTING.md empty test dir. Phase 1 note; Phase 9 ship.
- [ ] LV-17 Phase: P1 — "Thirteen ship at launch" derived count. Read from registry.
- [ ] LV-18 Phase: P1 — "94 patches" no source. Link to audit-findings page.
- [ ] LV-19 Phase: P1 — Honesty page lies about MobileLanding fix. Truthful after Phase 1.1.
- [ ] LV-20 Phase: P1 — Hero "live testnet feed" label (dup of LV-07).
- [ ] LV-21 Phase: P1 — MobileApp.tsx hardcoded portfolio. Delete with MobileLanding.
- [x] LV-22 — All 9 workflows present. PASS.
- [ ] LV-23 Phase: P11 — README Build commands missing demo-frontend, install, lint. Add.
- [ ] LV-24 Phase: P11 — Makefile deploy no pre-flight check. Add.
- [x] LV-25 — Sourcify partial confirmed. INFO.
- [ ] LV-26 Phase: P1 — JUDGE_ONE_PAGER closing claim contradicts simulated. Rewrite.
- [x] LV-27 — UI features confirmed wired. INFO.
- [ ] LV-41 Phase: P0 — JUDGE_ONE_PAGER tracked-check (dup of L-41).

---

## wave1-wallet-tx-ux.md (47 findings)

### Wallet (7)
- [ ] W-1 Phase: P5 — Only Coinbase Smart Wallet connector. Add injected fallback.
- [ ] W-2 Phase: P5 — No wrong-chain banner in AppShell. Add useChainGuard hook.
- [ ] W-3 Phase: P5 — No account-switch detection. Watch useAccount() invalidate.
- [ ] W-4 Phase: P5 — No ENS resolution. Add useEnsName everywhere.
- [ ] W-5 Phase: P5 — toLowerCase on display addresses. Use getAddress().
- [x] W-6 — EIP-712 Smart Wallet compatible. PASS.
- [ ] W-7 Phase: P5 — Postern session-key panel stub. Real data from PosternSessionKey entity.

### Transaction UX (11)
- [ ] TX-1 Phase: P5 — Tx pending state partial. Use useWaitForTransactionReceipt.
- [ ] TX-2 Phase: M — No tx replacement support. Mainnet polish.
- [ ] TX-3 Phase: P5 — Slippage hardcoded 0.10%. Make configurable dropdown.
- [ ] TX-4 Phase: P5 — No gas estimation USD preview. Add estimateGas + ETH/USD.
- [x] TX-5 — Decimal precision BigInt-native. PASS.
- [ ] TX-6 Phase: P5 — Faucet route Number(wei)/1e18 precision loss. Use formatUnits.
- [ ] TX-7 Phase: P5 — Max button no gas-aware. Subtract gas for ETH-paid.
- [ ] TX-8 Phase: P5 — Risk preview no MEV warning. Add 7th bullet.
- [x] TX-9 — Kill-switch confirm dialog. PASS (custom modal in Phase 5.18).
- [ ] TX-10 Phase: P5 — No insufficient-balance detection. useBalance + compare.
- [x] TX-11 — Approval exact-amount. PASS.

### Network/RPC (3)
- [ ] NET-1 Phase: P5 — Single RPC no fallback. wagmi fallback transport.
- [ ] NET-2 Phase: M — No block-confirmation count. Mainnet hardening.
- [ ] NET-3 Phase: P5 — Faucet step no external faucet link. Add.

### Microcopy (19)
- [ ] MC-1 Phase: P5 — "leverage" banned-word amendment to writing.md. Permit as financial noun.
- [ ] MC-2 Phase: P5 — Raw error.message leaked. humanizeWalletError shared helper.
- [x] MC-3 — Empty states well-differentiated. PASS.
- [ ] MC-4 Phase: P5 — animate-spin spinners (dup of #29).
- [x] MC-5 — Skeleton shimmer correct in data components. PASS.
- [x] MC-6 — Success Arbiscan link. PASS.
- [ ] MC-7 Phase: P5 — Onboarding dead-end if no WebAuthn. Add Skip authenticator.
- [x] MC-8 — Disconnected wallet state correct. PASS.
- [ ] MC-9 Phase: P5 — No inline tooltips. HelpTip component.
- [ ] MC-10 Phase: P5 — No form debouncing. useDeferredValue + onBlur.
- [ ] MC-11 Phase: P5 — Permission states partial. useContractPaused + useEdictTier.
- [ ] MC-12 Phase: P5 — "By opening you agree to portico-wired adapters" unclear. Rewrite.
- [ ] MC-13 Phase: P5 — Transfer form CTA dead. Wire useTransfer.
- [ ] MC-14 Phase: P5 — Vault no Max button. Add for deposit and withdraw.
- [ ] MC-15 Phase: P5 — window.confirm kill-switch. Custom modal (dup of A11Y-13).
- [ ] MC-16 Phase: P5 — Onboarding `.` separator. Use `·`.
- [x] MC-17 — Mandate success no Arbiscan (off-chain). PASS by design.
- [ ] MC-18 Phase: P5 — humanizeIssueError leaks raw. Same helper as MC-2.
- [ ] MC-19 Phase: P5 — my-mandates "Loading mandates…" text. useQuery + skeleton.

### Additional (7)
- [ ] ADD-1 Phase: P5 — Vault deposit success before receipt. Use useWaitForTransactionReceipt.
- [x] ADD-2 — useDeploymentStatus key correct (global state). PASS.
- [ ] ADD-3 Phase: P5 — Order form no debounce on impact. useDeferredValue.
- [ ] ADD-4 Phase: P5 — Transfer USD preview parseFloat. BigInt formatter.
- [ ] ADD-5 Phase: P5 — issue-mandate parseFloat round-trip. Pass raw string to parseUnits.
- [ ] ADD-6 Phase: P5 — Connect button no double-click guard. wagmi handles; UX flicker.
- [ ] ADD-7 Phase: P5 — WebAuthn raw browser error. Map per-browser.

---

## wave1-websec.md (32 findings)

- [ ] F1 Phase: P3 — No CSP header. Build buildCsp() helper.
- [ ] F2 Phase: P3 — No HSTS. Add max-age=63072000 includeSubDomains preload.
- [ ] F3 Phase: P11 — Google Fonts no SRI. Self-host via next/font.
- [ ] F4 Phase: P3 — No global-error.tsx. Add Sentry-reporting boundary.
- [ ] F5 Phase: P3+P10 — Sentry without consent (dup of L-2).
- [ ] F6 Phase: P3 — Chaos *.vercel.app wildcard. Strict allowlist.
- [ ] F7 Phase: P3 — Sentry no PII scrub. Add beforeSend with regex scrub.
- [ ] F8 Phase: P2+P3 — Unauth APIs (dup of HIGH-05).
- [ ] F9 Phase: P3 — issue-mandate no CSRF. Origin check + session.
- [ ] F10 Phase: P3 — CI actions tag-pinned. SHA pin via npx pin-github-action.
- [ ] F11 Phase: P3 — 5 workflows no permissions. Top-level deny-all.
- [ ] F12 Phase: P3 — loadtest pushes main. PR-based commit.
- [ ] F13 Phase: P3 — agents-cron prints API responses (dup of #47).
- [ ] F14 Phase: P3 — Permissions-Policy too narrow. Comprehensive policy.
- [ ] F15 Phase: P3 — Sentry tunnel undocumented in CSP. Add comment + connect-src 'self'.
- [ ] F16 Phase: P0 — Deployer key rotation overdue (dup of #25).
- [ ] F17 Phase: P3 — No Cache-Control private. noCacheHeaders helper.
- [ ] F18 Phase: P3 — connected-sites no auth. Bearer + session.
- [ ] F19 Phase: P3 — Sumsub callback leaks wallet. Remove from response body.
- [ ] F20 Phase: P3 — archive-weekly shell injection (dup of CRT-06).
- [ ] F21 Phase: P3 — No X-DNS-Prefetch-Control. Add `off`.
- [ ] F22 Phase: P3 — Sentry replay 1.0 without consent. Lower + consent gate.
- [ ] F23 Phase: P5 — robots indexes /verify/*. Document decision; if private, disallow.
- [ ] F24 Phase: P11 — hideSourceMaps + widenClientFileUpload tuning. Verify.
- [ ] F25 Phase: P3 — No rate limiting (dup of #53).
- [x] F26 — No dangerouslySetInnerHTML. PASS.
- [x] F27 — No CORS for state-changing. PASS.
- [ ] F28 Phase: P3 — Vercel preview env scope. Production-only flag.
- [ ] F29 Phase: P3 — kani contents:write pushes main. PR-based.
- [ ] F30 Phase: P3 — brand-assets auto-commit. PR-based.
- [ ] F31 Phase: P3 — e2e exposes test-wallet key broadly. Step-level env scope.
- [ ] F32 Phase: P5 — layout.tsx external script no nonce. Convert to <Script> + nonce.



---

## wave2-contracts-deep.md (32 findings)

### Critical (3)
- [ ] W2-C1 Phase: P2 — PlinthMath array mismatch ZERO (dup of #3).
- [ ] W2-C2 Phase: P2 — Aqueduct resume onlyPraetor (dup of #13).
- [ ] W2-C3 Phase: P2 — close_position no Sigil.record_close (dup of #41).

### High (7)
- [ ] W2-H1 Phase: P2 — PlinthMath haircuts_bps unused. Integrate into SPAN loop.
- [ ] W2-H2 Phase: P2 — Oracle abs_diff_bps asymmetric. Divide by max(a,b).
- [ ] W2-H3 Phase: P2 — Vigil queue_liquidation pause bypass (dup of #10).
- [ ] W2-H4 Phase: P2 — AqueductReceiver.ccipReceive no reentrancy guard. Add OZ nonReentrant.
- [ ] W2-H5 Phase: P2 — Rostrum leader_followers unbounded. Swap-and-pop.
- [ ] W2-H6 Phase: P2 — PosternKeyRegistry markAllRevoked unbounded. Cap + batch.
- [ ] W2-H7 Phase: P2 — Adapter setAuthorizedCaller onlyPraetor. Change to onlyTimelock.

### Medium (12)
- [ ] W2-M1 Phase: P2 — Price overflow silent clamp to I256::MAX. Revert above sane bound.
- [ ] W2-M2 Phase: P2 — Correlation class 0 default nets. Reserve 0 = no-netting.
- [ ] W2-M3 Phase: P2 — Coffer adapter_pull rounds down. Use convert_to_shares_ceil.
- [ ] W2-M4 Phase: P2 — Aqueduct nonce no destSelector. Include in hash.
- [ ] W2-M5 Phase: P2 — CCIP extraArgs="" 200k gas may OOG. Set 500k.
- [ ] W2-M6 Phase: P2 — Plinth no initial-vs-maintenance margin. 1.5x multiplier on open.
- [ ] W2-M7 Phase: P2 — PorticoRegistry active_venue_ids never shrinks (dup of #40).
- [ ] W2-M8 Phase: P2 — Sigil action_nonce not enforced. Store last_action_nonce[agent].
- [ ] W2-M9 Phase: P2 — Vigil only closes one position per job. Implement partial close.
- [ ] W2-M10 Phase: M — PhaseC.s.sol imports v1.0 not V11. Pre-mainnet deploy fix.
- [ ] W2-M11 Phase: M — PhaseB3 venue 1+7 same Hyperliquid adapter address. Separate instances.
- [ ] W2-M12 Phase: P2 — LanternAttestor verifyInclusion single-hash. Use OZ double-hash.

### Low (10)
- [ ] W2-L1 Phase: M — Plinth instrument_key no domain separator (dup of #55).
- [ ] W2-L2 Phase: P2 — Coffer initialize no deployer binding (dup of #11).
- [ ] W2-L3 Phase: P2 — Vigil active_keepers never shrinks. Swap-and-pop.
- [ ] W2-L4 Phase: M — Edict no tier downgrade. Process decision.
- [ ] W2-L5 Phase: M — MockAavePool getReserveData mutates state. Testnet-only; remove for mainnet.
- [ ] W2-L6 Phase: M — Faucet no global cap. Mainnet hardening.
- [ ] W2-L7 Phase: P2 — Sigil ecrecover no upper-s reject. Add EIP-2 check.
- [ ] W2-L8 Phase: M — Plinth get_user_positions unbounded return. Already capped at 100.
- [ ] W2-L9 Phase: P2 — AtriumRouter no pause (dup of #42).
- [ ] W2-L10 Phase: M — Deploy.s.sol no test-key guard. Process improvement.

### PASS (6)
- [x] PASS-1 — ERC-7201 namespaced storage verified.
- [x] PASS-2 — Negative-price guard verified.
- [x] PASS-3 — EIP-712 domain separator includes chainId+verifyingContract.
- [x] PASS-4 — Position cap 100 enforced.
- [x] PASS-5 — PraetorTimelock emergencyPause is pause-only.
- [x] PASS-6 — MockAavePool not deployed to non-test.

---

## wave2-e2e-journeys-routes.md (63 findings)

### Critical (5)
- [ ] E2E-01 Phase: P8 — Verifier steps 2/3/5 disabled. Wire via timelock txs.
- [ ] E2E-22 Phase: P1 — Landing renders both real+fake numbers. Delete fake.
- [ ] E2E-24 Phase: P1 — Honesty page dishonest about MobileLanding fix. Truthful after fix.
- [ ] E2E-34 Phase: P5 — Kill Switch inaccessible mobile (dup of #24).
- [ ] E2E-40 Phase: P8 — Judge runbook describes non-functional demo. Update after wiring.

### High (16)
- [ ] E2E-02 Phase: P5 — No chaos button injection on step pages. Add per ui.md.
- [ ] E2E-06 Phase: P5 — /app/portfolio no permission state. Add wrong-chain banner.
- [ ] E2E-09 Phase: P5 — /app/trade no permission state. Same.
- [ ] E2E-11 Phase: P5 — /app/transfer no permission state. Same.
- [ ] E2E-12 Phase: P5 — /app/vault no mobile panel. Build VaultMobile.
- [ ] E2E-18 Phase: P5 — /app/reserves no mobile panel. Build ReservesMobile.
- [ ] E2E-21 Phase: P2+P3 — Tax export zero auth (dup of #7).
- [ ] E2E-31 Phase: P5 — Deposit USDC no mobile flow (dup of E2E-12).
- [ ] E2E-33 Phase: P5 — View Lantern attestation no mobile flow (dup of E2E-18).
- [ ] E2E-35 Phase: P11 — manifest.json one icon (dup of #60).
- [ ] E2E-39 Phase: P11 — No service worker. Add next-pwa.
- [ ] E2E-46 Phase: P5 — 8+ components silently swallow fetch errors. Distinguishable error state.
- [ ] E2E-55 Phase: P5 — 6 dead href="#" links (dup of #17).
- [ ] E2E-58 Phase: P5 — Focus rings missing 100+ components. focus-visible:ring-2.
- [ ] E2E-59 Phase: P5 — No useSwitchChain anywhere (dup of W-2).
- [ ] E2E-61 Phase: P5 — No contract-paused state in app pages. useContractPaused.

### Medium (30)
- [ ] E2E-03 Phase: P5 — Kani badge hidden mobile. Show always.
- [ ] E2E-04 Phase: P5 — No keyboard shortcut between steps. Enter advances.
- [ ] E2E-07 Phase: P5 — Activity page no dedicated mobile layout. Build ActivityMobile.
- [ ] E2E-08 Phase: P5 — Trade fetchImpact swallows errors. Surface.
- [ ] E2E-10 Phase: P5 — Transfer balance loading no skeleton. Add.
- [ ] E2E-13 Phase: P5 — Agents leaderboard swallows errors (dup of MED-10).
- [ ] E2E-14 Phase: P5 — Markets page no mobile layout. Build MarketsMobile.
- [ ] E2E-15 Phase: P5 — Notifications error indistinguishable from empty. Surface.
- [ ] E2E-16 Phase: P5 — Notifications sidebar highlights Portfolio. Fix active prop.
- [ ] E2E-17 Phase: P5 — Onboarding animate-spin (dup of A11Y-10).
- [ ] E2E-19 Phase: P5 — Settings 5 tabs say "coming Month X". Either ship or honest "later".
- [ ] E2E-20 Phase: P5 — Tax page no mobile layout. Build TaxMobile.
- [ ] E2E-23 Phase: P6 — Docs/API describes paid flow returning 503 (dup of #49).
- [ ] E2E-25 Phase: P4 — /cohort/[id] renders for non-existent partner. 404 or empty.
- [ ] E2E-26 Phase: P1 — Lantern hourly vs 10-min cron inconsistent. Align.
- [ ] E2E-27 Phase: P11 — Benchmarks no evidence links. Add.
- [ ] E2E-28 Phase: P1+P6 — Marketplace implies live performance. Banner Phase 1; real Phase 6.
- [ ] E2E-29 Phase: P1+P6 — Rostrum copy "live PnL never invented" misleading. Same.
- [ ] E2E-30 Phase: P5 — Onboarding 22px step indicators. 44px.
- [ ] E2E-32 Phase: P5+P8 — Hedged position single-leg. Wire pair flow.
- [ ] E2E-36 Phase: P11 — No apple-touch-icon. Add.
- [ ] E2E-37 Phase: P11 — No install prompt. Add component.
- [ ] E2E-38 Phase: P11 — theme_color light vs dark UI (dup of #34).
- [ ] E2E-41 Phase: P5 — Onboarding warning no skip. Add Remind me later.
- [ ] E2E-42 Phase: P5 — Onboarding faucet drops fake. Read from contract.
- [ ] E2E-43 Phase: P5 — "Margin posted" implies success even if skipped. Conditional.
- [ ] E2E-44 Phase: P5 — Onboarding no Back button. Add.
- [ ] E2E-45 Phase: P5 — Onboarding state not persisted. localStorage.
- [ ] E2E-47 Phase: P5 — 3+ components show error without retry. Add retry.
- [ ] E2E-48 Phase: P5 — transfer-form fetchBalance swallows. Surface error.
- [ ] E2E-49 Phase: P5 — order-form fetchImpact swallows (dup of E2E-08).
- [ ] E2E-50 Phase: P5 — notifications/list catch returns empty array. Distinguishable.
- [ ] E2E-51 Phase: P5 — agents/leaderboard catch (dup of MED-10).
- [ ] E2E-56 Phase: P5 — animate-spin spinners (dup of #29).
- [ ] E2E-57 Phase: P5 — Keyboard nav minimal. Add Escape, Enter, arrows.
- [ ] E2E-60 Phase: P5 — No Edict tier gate. useEdictTier.
- [ ] E2E-62 Phase: P5 — MobileApp Lovable port fake (dup of LV-21). Delete.

### Low (12)
- [ ] E2E-05 Phase: P5 — window.confirm step 7 (dup of A11Y-13).
- [ ] E2E-52 Phase: P5 — settings/connected-sites error display unclear. Surface.
- [ ] E2E-53 Phase: P5 — settings/gas-sponsorship error display unclear. Surface.
- [ ] E2E-54 Phase: P5 — settings/wallet-detail error display unclear. Surface.
- [ ] E2E-63 Phase: P5 — DesktopApp Lovable port `href="#"`. Delete.

---

## wave2-product-prd.md (key findings)

- [ ] P-1 Phase: P1 — Numbers.tsx fully fabricated (dup of LV-04).
- [ ] P-2 Phase: P1 — MobileLanding fake stats (dup of LV-05).
- [ ] P-3 Phase: P1 — Landing PARTNERS strip (dup of L-40).
- [ ] P-4 Phase: P8 — Verifier 2/3/5 not wired (dup of E2E-01).
- [ ] P-5 Phase: P1 — deployment.md status table contradicts JSON (dup of LV-01).

(Other wave2-product items overlap with above audit IDs and are tracked there.)

---

## wave2-resources-xref.md (key findings)

- [ ] Finding 1.1 Phase: M — ERC-7201 storage claimed but not implemented. Mainnet upgrade safety.
- [x] Finding 1.2 — Reentrancy guard ad-hoc but functional. PASS (informational).
- [x] Finding 1.3 — Event emission via sol! correct. PASS.
- [x] Finding 1.4 — TestVM API usage correct. PASS.
- [x] Finding 2.1 — ERC-4626 virtual shares offset. PASS (documented).
- [x] Finding 2.2 — Deposit rounds down. PASS.
- [x] Finding 2.3 — Withdraw rounds up. PASS.

(Remaining wave2-resources-xref findings are educational/informational PASS items; not tracked as todos.)

---

## wave2-subgraph-data.md (27 findings)

### Critical (2)
- [ ] SD-1 Phase: P2+P4 — Notifier queries non-existent fields. Phase 2 fix; Phase 4 schema lock.
- [ ] SD-2 Phase: P2+P4 — Notifier wrong enum case. Phase 2 fix; Phase 4 sync test.

### High (6)
- [ ] SD-3 Phase: P4 — No _meta block-lag check anywhere. Shared health helper.
- [ ] SD-4 Phase: P2 — vigil-keeper no fetch timeout. Add.
- [ ] SD-5 Phase: P2 — notifier no fetch timeout. Add.
- [ ] SD-6 Phase: P4 — first:1000 cap. Cursor pagination + Counter entity.
- [ ] SD-7 Phase: P4 — agents/[id]/profile non-existent fields. Align query.
- [ ] SD-8 Phase: P0+P4 — subgraph-deploy.sh path mismatch. Phase 0 quick fix.

### Medium (11)
- [ ] SD-9 Phase: P4 — CohortPartner dead (dup of #44).
- [ ] SD-10 Phase: P4 — Counter dead (dup of #44).
- [ ] SD-11 Phase: P4 — LanternAttestation overwrite (dup of #58).
- [ ] SD-12 Phase: P4 — LanternAttestor registry missing block. Add.
- [ ] SD-13 Phase: P4 — update-subgraph-addresses.mjs not called. Make canonical.
- [ ] SD-14 Phase: P4+P9 — No matchstick tests. Phase 4 minimum; Phase 9 full suite.
- [ ] SD-15 Phase: P4 — vigil-keeper no RPC cross-validation. Add per-account check.
- [ ] SD-16 Phase: P4+P6 — lantern-attestor no RPC cross-validation. Sample-based.
- [ ] SD-17 Phase: P4 — CofferUserBalance negative clamp hides errors. log.warning.
- [ ] SD-18 Phase: P4 — agents/[id]/profile no pagination. Cursor + window.
- [ ] SD-19 Phase: P4 — protocol/metrics 5-entity join. Use Counter.

### Low (8)
- [ ] SD-20 Phase: P4 — Caret ranges (dup of #57).
- [ ] SD-21 Phase: P4+P7 — No indexer health cron. Phase 4 helper; Phase 7 cron.
- [ ] SD-22 Phase: P4 — entryPriceQ64 dead field (dup of #43).
- [ ] SD-23 Phase: P4 — Agent.totalPnlSigned always zero. Implement intent_hash join.
- [ ] SD-24 Phase: P4+P6 — reserves/summary first:1000 (dup of #26).
- [ ] SD-25 Phase: M — Single-indexer trust. Mainnet redundancy.
- [ ] SD-26 Phase: P4 — reserves/recent 720-row query. Paginate.
- [ ] SD-27 Phase: P4+P9 — CI graph test not gated. Add to subgraph job.

### PASS (8)
- [x] MarginAccount.requiredMarginWei — written correctly.
- [x] @derivedFrom integrity (positions, updates).
- [x] BigInt vs String — all numeric fields BigInt or Int.
- [x] Address sync — subgraph.yaml matches registry.
- [x] Frontend graceful degradation — try/catch returns pending shape.
- [x] Empty-vs-error distinction — zero-defaults test exists.
- [x] Subgraph ABI sync (Solidity).
- [x] LiquidationEvent.account = '' — already documented; fix in P4.

---

## Summary

Total tracked: ~430 unique findings across 12 audits (with cross-audit duplicates noted).

| Phase | Open count (rough) |
|-------|--------------------|
| P0 Foundation | ~10 |
| P1 Truth | ~35 |
| P2 Critical | ~50 |
| P3 Security | ~35 |
| P4 Subgraph | ~30 |
| P5 Frontend | ~120 |
| P6 Off-chain | ~15 |
| P7 Infra | ~10 |
| P8 Stylus wiring | ~5 |
| P9 Tests | ~10 |
| P10 Legal | ~12 |
| P11 Launch | ~30 |
| P12 Observability | ~5 |
| M Mainnet-deferred | ~25 |
| PASS / wontfix | ~30 |

Fill in actual counts after Phase 0 by running `make plan-status`.

---

## Update workflow

When closing a finding:
1. Tick the box: `[x]`.
2. Add the closing PR / commit hash on the same line.
3. If the fix surfaces a follow-up finding, add it to the right phase here.

When deferring with reason:
1. Mark `[-]` and add reason: `[-] X-NN reason: "out of scope for testnet, tracked in mainnet section"`.

When re-opening:
1. Mark `[~]` and note why: `[~] X-NN reopened: regression in PR #321`.



---

## Phase 13a verification log (2026-05-28)

### Closed in 13a
- Adapter modifier contradiction: confirmed all 9 adapters use `onlyTimelock` (Phase 2b correct). Updated `SetAuthorizedCallerOnAdapters.s.sol` NatSpec + `setup-stylus-adapters.ts` comment to document timelock path as canonical.
- Plinth PositionOpened event extended: added `entry_price_q64` (U256) and `intent_hash` (B256) to event signature, emit, ABI, subgraph.yaml, plinth.ts handler, and matchstick test.
- verifier-step-runner.tsx conditional hooks: refactored all hook calls to top of component (before early returns). Lint now shows 0 errors, 25 warnings.
- auth-session.ts consistency: verified `getSession(req)` and `requireWalletMatch(req, wallet)` signatures match all 12 importers.
- Mobile panel hook consumption: verified all imports resolve, hook files exist, destructuring matches.
- Orphaned imports from Phase 1 deletions: none found.
- next build: fixed twitter-image.tsx re-export, agents/page.tsx ssr:false, onboarding/page.tsx ssr:false, /verify typed route, app-shell.tsx typed route, onboarding-flow.tsx implicit any. Build now passes.
- Foundry tests: confirmed all adapter tests prank as `timelock` for `setAuthorizedCaller` (function names say "FromPraetor" but logic is correct).

### Confirmed deferred to 13b (Linux/WSL toolchain required)
- forge build/test
- cargo stylus check / cargo test --workspace
- matchstick subgraph test (graph-ts codegen)
- Playwright E2E with funded wallet
- Lighthouse + axe-core
- npx pin-github-action --check

### Truly mainnet-deferred
- Real audit firm engagement
- Halmos formal verification full run
- Production multisig ceremony
