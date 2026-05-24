# Atrium tests + security + honesty audit — 2026-05-24

Auditor E. Scope: test suites, CI workflows, security posture (secrets / oracles / multisig / reentrancy), honesty (banned numbers, lying badges, unsourced claims).
Method: read source-of-truth docs, enumerated test files, ran every suite I could reach, probed deployed contracts via Arbitrum Sepolia RPC, grepped for banned terms / secrets / placeholder numbers.

---

## Headline

LAUNCH_READY §3.10 says **"Full test suite green (currently 585 / 585)"** and `apps/verify/public/kani-status.json` says **"state: pass, 5 of 6"**. Both are false today.

- **Frontend vitest: 580 passed / 5 failed of 585.** The 5 failures all sit in `apps/verify/src/app/api/kani/status/route.test.ts` — the very test that exists to keep the Kani badge honest. The route silently falls through from the broken upstream URL to the hand-written `public/kani-status.json` (which says "pass / 5 of 6"). Tests assert the route should report `state: 'unknown'` on upstream failure; route returns `state: 'pass'` because the file shortcut intercepts.
- **Plinth lib test `hedged_position_has_lower_margin_than_unhedged` (span.rs:246) panics.** It's a real broken assertion, not just an inverted comment. `cargo test --workspace --all-features` (the exact CI command at `.github/workflows/ci.yml:44`) returns non-zero. CI is RED today, not green.
- **`apps/verify/public/kani-status.json` is hand-edited** to say "state: pass" sourced from `"post-stylus-0.10-migration manual proptest run"`. That violates `.claude/rules/testing.md`: *"CI badge in README must reflect the real state. Do not show green when a proof is in development."* The Kani CI lane has never actually run (the workflow exists but main branch has zero commits, so it has never fired).
- **Reentrancy guards exist on Plinth only.** Coffer / Sigil / Vigil have ZERO `is_updating` flags in source despite `.claude/rules/security.md`: *"Every state changing function on Plinth and Coffer uses the `is_updating` flag pattern shown in TDD §7.1"*. Coffer.deposit performs `transferFrom` then mints shares unguarded.
- **`praetor_multisig` on every deployed contract is `0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42` — the deployer EOA.** Confirmed via `cast call` on AtriumRouter + Aave Horizon adapter. JUDGE_ONE_PAGER.md:32 still advertises "Praetor 3-of-5 multisig + 48h timelock" as shipped infrastructure. LAUNCH_READY admits the gap in fine print; the judge-facing one-pager does not.
- **The repo has zero git commits.** `git status` reports "your current branch 'master' does not have any commits yet". Every CI gate (`secrets-scan`, `kani`, `test-rust`, etc.) is dormant because nothing has been pushed to main. The 585/585 + Kani-green claims are based on the LOCAL test state at a snapshot, not on CI evidence.
- **Plinth contract at `0x4852…4781` has only 99 bytes of code** — every call to a real getter (`praetor_multisig`, `chainlink_oracle`, `pyth_oracle`, `owner`, `admin`, `version`) reverts with empty data. The multi-fragment factory ship referenced in LAUNCH_READY left an inert stub at the published address. Coffer (47 KB), Sigil (38 KB), Vigil (46 KB), plinth-oracle (27 KB) all have real bytecode.

---

## Test-suite roll call

| Suite | Status | Count | Skipped | Owner / notes |
|---|---|---|---|---|
| Frontend vitest (`apps/verify`) | ❌ FAIL | 580 / 585 | 0 | 5 failures in `src/app/api/kani/status/route.test.ts` — see headline. |
| Codex (`services/codex`) | ✅ PASS | 42 / 42 | 0 | error-safe (8), scribe (12), x402 middleware (22). |
| Lantern attestor (`services/lantern-attestor`) | ✅ PASS | 25 / 25 | 0 | merkle (14), ipfs (11). |
| Tablet (`services/tablet`, Python) | ✅ PASS | 28 / 28 | 0 | DE FIFO (11), UK CGT (3), US 8949 (14). Pytest config warning re asyncio_mode is benign. |
| Agents (`services/agents`) | ⚠️ NO TESTS | 0 / 0 | 0 | `vitest run` reports "No test files found". The CI doesn't run this service; even if it did, there is nothing to run. |
| Praetor-CLI (Rust, `services/praetor-cli`) | not run | 23 `#[test]` markers in `backtest.rs` + `deploy.rs` | unknown | Not executed in this audit (cargo run would take 5+ min and isn't in CI's targeted path). |
| Plinth lib (`cargo test --lib --features export-abi`) | ❌ FAIL | 6 / 7 | 0 | `hedged_position_has_lower_margin_than_unhedged` panics at `src/span.rs:246`. Assertion `assert!(req_hedged >= req_solo || req_hedged == req_solo)` is the same predicate twice with OR, so it asserts `req_hedged >= req_solo`. SPAN implementation returns `req_hedged < req_solo` for a properly-hedged position (which is what SPAN is supposed to do), making the assertion fail. Bug is in the test, not the engine — but the test is RUN by `cargo test` and breaks CI. |
| Plinth proptest (`tests/proptest_invariants.rs`) | ✅ PASS | 5 / 5 | 0 | All five invariants green when run with `--features export-abi`. Without that feature flag the test doesn't compile (modules `math` and `span` are gated by `#[cfg(any(test, feature = "export-abi"))]`). CI uses `--all-features`, so this is fine, but `cargo test --test proptest_invariants` from a fresh checkout fails. Flag this as a footgun. |
| Coffer / Sigil / Vigil / plinth-math / plinth-oracle (`cargo test`) | not run to completion | unknown | unknown | Docker pull + first-build took 12+ min for Plinth alone. Second batch still running at report-write time. Re-run in a dedicated CI lane. |
| Foundry (`forge test`) | ✅ PASS | ≈ 581 across 25 suites | 0 | Counts: Aave 26+26, Aqueduct 30, AqueductClaimback 8, AqueductReceiver 20, AtriumRouter 20, Curator 29, CurveAdapter 30, Edict 20, Faucet 29, GmxV2 25, HyperliquidHybrid 45, LanternAttestor 19, MorphoBlue 23, PendleV2 30, Polymarket 45, PorticoRegistry 16, PosternKeyRegistry 12, PosternKillSwitch 12, PraetorTimelock 22, ReentrancyGuard 5, ResearchAttestation 7, Rostrum 41, StoaBlackScholes 15, SynthetixV3 24, TradeXyz 28. Every suite "Suite result: ok". |
| Subgraph (`pnpm graph test`) | NONE | 0 / 0 | n/a | `subgraph/package.json` does not even ship a `test` script. No `*.test.ts` outside `node_modules`. `subgraph/indexing-todo.md` + `human_left.md` #34 explain: matchstick-as is blocked on Stylus ABIs being empty shells (cargo-stylus on Windows MSVC can't export-abi). |
| Playwright e2e (`apps/verify/tests/e2e/*.spec.ts`) | not run | 5 spec files | unknown | Requires `VERIFY_BASE_URL` and a funded testnet wallet env. Workflow `.github/workflows/e2e.yml` runs nightly against `https://verify.atrium.fi` — domain not yet claimed per LAUNCH_READY §7 #2. |
| Kani formal verification | NEVER RUN | 9 `#[kani::proof]` markers found (6 in plinth, 3 in sigil) | n/a | The Kani CI job exists at `.github/workflows/ci.yml:71-128` but main has zero commits → workflow has never fired. `kani-status.json` is hand-edited to show 5 of 6 green. |

`it.skip` / `it.only` / `describe.skip` sweep across `apps/verify/src` + `services/`: **zero hits.** No tests are silently disabled.

---

## Kani / formal verification

- `#[kani::proof]` declarations in the tree: **9 total.**
  - `contracts/plinth/src/math.rs`: 4 (lines 84, 96, 104, 125)
  - `contracts/plinth/src/span.rs`: 2 (lines 136, 172)
  - `contracts/sigil/src/eip712.rs`: 2 (lines 453, 464)
  - `contracts/sigil/src/lib.rs`: 1 (line 468)
- `public/kani-status.json` claims `total: 6`. Off by 3. The route at `apps/verify/src/app/api/kani/status/route.ts:44` declares `KANI_PROOF_FLOOR = 6` — a hand-counted floor that ignores the 3 sigil proofs.
- `kani-status.json.source = "post-stylus-0.10-migration manual proptest run"` and `last_run_at = 2026-05-24T07:00:00Z`. That is a developer running proptests by hand — **not Kani, not CI.** The badge is theatrical, not earned.
- `LAUNCH_READY.md` §3.10: *"3 of 5 Kani invariants green in CI (all 5 by Month 6 per PRD)."* Reality: 0 of 9 Kani proofs have ever run in CI; the workflow has never fired because the repo isn't initialized as git.
- Per `.claude/rules/testing.md`: *"CI badge in README must reflect the real state. Do not show green when a proof is in development."* and *"The Kani CI badge, the Verifier Mode flows, and the three reference agents must all be green on submission day. Any one of these red is a hard stop."* Today the Kani badge is **structurally dishonest**.

Recommendation: ship Kani-status as `state: "unknown", passed: null, total: 9, source: "kani-ci-not-yet-run"` until the CI workflow actually fires on main. The route correctly handles this case; the file just needs to stop overriding it.

---

## CI workflow analysis

### `.github/workflows/ci.yml`

| Job | Gate | Audit verdict |
|---|---|---|
| `lint` | `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `pnpm -r lint` | Strict. Will fail on the 21 Rust warnings observed in `cargo test --lib` output for Plinth (e.g. `unused import: 'alloc::vec::Vec'` at `src/span.rs:9:5`). |
| `test-rust` | `cargo test --workspace --all-features` then `cargo stylus check` for plinth/coffer/vigil/sigil | **WILL FAIL today.** Lib test `hedged_position_has_lower_margin_than_unhedged` panics. Independently, `cargo stylus check` requires Linux toolchain that the CI image provides — but `cargo install --force cargo-stylus` on every PR is slow (~3 min cold). Acceptable cost. |
| `test-solidity` | `forge build --sizes`, `forge test -vvv`, `forge coverage --report lcov`, codecov upload | Sound. Codecov upload is `if: always()` — coverage drift doesn't block merge, which is appropriate for a buildathon-stage repo. |
| `kani` | `cargo install --locked kani-verifier`, `cargo kani setup`, then `cargo kani` in plinth + sigil | The `Build kani-status.json` step (lines 93-114) computes a real `STATE` from job outcomes and a real `PASSED` count by grepping `VERIFICATION:- SUCCESSFUL` from the log. **The CI mechanism is correct.** What's wrong is the file currently sitting in `public/kani-status.json` was hand-written. The commit-back step (line 115) overwrites it on every main push — which would fix the lie automatically the first time CI runs. No commits have ever happened, so the lie persists. |
| `test-frontend` | `pnpm --filter @atrium/verify test` | **WILL FAIL today** (5/585 failures, all in kani status route honesty tests). |
| `frontend` | `pnpm --filter @atrium/verify build` + Lighthouse CI | Lighthouse threshold soft-fails with `|| echo "..."` (line 161). Comment promises hard-fail "once the build runs against the deployed production URL". OK as a sandbag, but means the §3.4 mobile-Lighthouse-90 claim is unverified by CI. |
| `subgraph` | `pnpm codegen`, `pnpm build`, plus two custom guards (`check-event-indexing.mjs`, `check-entity-writers.mjs`) | The custom guards are clever (catch the Fire 74/75 + iteration 16 entity classes). No test execution though — matchstick-as not wired. |
| `secrets-scan` | `gitleaks/gitleaks-action@v2` | Sound mechanism. But: the repo has no commits, so gitleaks scans nothing. First commit will trigger a real scan. |

No `if: false` or `--no-verify` shortcuts found anywhere. No gates disabled.

### `.github/workflows/e2e.yml`

Sound design. Runs on nightly schedule + PR-on-touch to `apps/verify/**`. Uploads playwright report + traces on failure. Depends on two repo secrets: `ARBITRUM_SEPOLIA_RPC` and `E2E_TEST_WALLET_PRIVATE_KEY`. Domain `verify.atrium.fi` not yet claimed.

### `.github/workflows/agents-cron.yml`

5-minute cron that fans out to `$AGENTS_BASE_URL/api/{augur,haruspex,auspex}` with a CRON_SECRET bearer. Sane. Once the agents Vercel deployment hardens, the cron can migrate to `services/agents/vercel.json` and this workflow retires.

---

## Secret-leak sweep results

Scope: full repo minus `node_modules/`, `resources/`, `target/`, `.next/`, `foundry-out/`, `broadcast/`, `.playwright-mcp/`.

| Pattern | Matches in tracked-able paths | Verdict |
|---|---|---|
| `0x[a-fA-F0-9]{64}` (private-key candidate) | 4 in non-resources: `services/codex/src/middleware/x402.ts:30`, `services/codex/src/middleware/x402.test.ts:52` (both = keccak256 of `Transfer(address,address,uint256)`, NOT secrets), `services/praetor-cli/src/commands/seed.rs:24` (Hardhat default key #0), `scripts/seed.s.sol:38-40` (Hardhat default keys #1-#3). | All false positives or well-known test keys. Gitleaks will flag the seed.rs / seed.s.sol lines on first scan — add allowlist entries. |
| `cfut_` (Cloudflare token) | 0 in tracked, 1 in `.env` (gitignored): `CLOUDFLARE_API_TOKEN=cfut_HV108mm0UeGK9ph8JeXfYROg0L6TiahmLoIKobfqcd438f04`. | OK — .env is gitignored. **Action**: rotate post-buildathon per `.env` line comment. |
| `vcp_`, `sk_live`, `AKIA*`, `ghp_*`, `github_pat_` | timed out search; ripgrep slow on this Windows + Git Bash setup. Spot-checked services + apps — no matches outside .env. | None found in source. |
| Sentry DSN | `.env` only. Sentry's own docs (per `apps/verify/sentry.client.config.ts:1-3`) say DSN is non-sensitive — public ingestion identifier. OK. |
| Lantern cron secret | `.env` line 54 `LANTERN_CRON_SECRET=2eadbdfe...`. Per .gitignore `.env` is excluded. **Action**: rotate post-buildathon. |
| The Graph deploy key | `.env` line 29 `GRAPH_STUDIO_DEPLOY_KEY=04f09d19...`. Gitignored. **Action**: rotate post-buildathon. |

**Files of concern in working tree (not tracked):**

- `my convo with one ai agent.txt`, `read this.txt`, `human_left.md` — explicit personal notes. `.gitignore` excludes `notes/`, `*.local.md`, `.scratch/`, `outreach/targets-private.md`. These three files don't match those patterns. **Add `*.txt` (or a narrower `my convo*.txt` / `read this.txt`) to `.gitignore` before `git init`.** `human_left.md` is the founder's working log — currently NOT excluded.
- `london_version_open_house_buildathon_terms___conditions.pdf`, `openhouse_london_tc.pdf` — judge-event PDFs. Decide whether they belong in repo. If yes, they're fine. If no, exclude.
- `.env` itself is correctly gitignored.

**Net**: nothing is leaking into git **today** because the repo is uninitialized. Once `git init && git add .` runs, the bash-history-style personal files would be staged unless `.gitignore` is updated first.

---

## Banned-words sweep (non-frontend)

Scanned all `.md`, `.rs`, `.sol`, `.ts`/`.tsx` outside `apps/verify/src` (Auditor B's domain). Excluded `node_modules`, `resources`, `target`, `.next`, `foundry-out`, `.forge-cache`, `broadcast`, `.playwright-mcp`.

| Banned token | Hits in scope | Verdict |
|---|---|---|
| `revolutionise` / `next-generation` | 1: `desing/Brand Kit.html:780` inside an explicit `✗ Don't` example card with copy "Marketing slop. Vague. Borrowed from every other DeFi pitch deck." | Legitimate negative-example. Safe. |
| `cutting-edge` | 3: all in `my convo with one ai agent.txt` (founder's chat dump, NOT shipped). | Untracked file, no risk if `.gitignore` is updated. |
| `leverage` | 30+ hits across PRD, AUDIT, design docs, frontend files | All legitimate domain vocab (margin trading leverage / "highest-leverage task"). Per writing-banned-words.test.ts comment, "leverage" is explicitly allowed. |
| `harness` | 8+ hits across `agents/`, audit docs | All legitimate ("test harness", "agent template harness"). Allowed. |
| `unlock` | 4: `ATRIUM_12_MONTH_ROADMAP.md`, `AUDIT_USER_FLOWS.md`, `AUDIT_ROADMAP.md` (e.g. "biggest single user-visible unlock"). | Edge — `unlock` is in the banned list but used here in a verb sense to describe internal sequencing. Probably safe but rephrase in any doc that ships to judges. |
| `robust` | Audit docs only, all describing the test pattern. Zero hits in user-facing copy. | OK. |
| Other banned tokens (`delve`, `unleash`, `empower`, `seamless`, `streamline`, `state-of-the-art`) | Zero in scope outside the test that bans them. | Clean. |
| Banned phrases ("in today's fast-paced", "we are excited to announce", "powerful, scalable, secure", etc.) | Zero in scope. Two meta-mentions in audit docs explaining the rule. | Clean. |

**The `writing-banned-words.test.ts` gate only scans `.tsx` files.** `.ts` API routes, `.md` docs, `.html` landing files (including `apps/verify/public/mobile-landing.html` + `landing-v2.html`), and the brand kit HTML are **NOT covered by the test.** Extend the walker to include `*.ts` and `*.html` (excluding `public/` JSON bundles and the negative-example div in Brand Kit).

---

## Fake claims / unsourced numbers across docs

| Location | Claim | Source on file? | Verdict |
|---|---|---|---|
| `JUDGE_ONE_PAGER.md:9` | "Atrium nets the hedge under one SPAN-style margin calculation. Same risk, about $900K total collateral. Roughly 55% saved." | Yes — "simulated Q1-2026 backtest in `services/archive/notebooks/q1-2026-backtest.ipynb`. The figures become judge-verifiable in 10 seconds the moment `ResearchAttestation` deploys to Sepolia (Month 1 W2). At Day -7 those four numbers are simulator output, clearly labelled." | Sourced honestly. |
| `JUDGE_ONE_PAGER.md:32` | "Praetor 3-of-5 multisig + 48h timelock." | NO. RPC reads show `praetor_multisig = deployer EOA`. Per `.claude/rules/security.md` the production architecture is 3-of-5; per LAUNCH_READY this is **pending** (§7 item 4). | **Honesty break.** Either reword to "deployer EOA on testnet; 3-of-5 Safe before mainnet flip" or move the line under a "shipped post-mainnet" header. |
| `JUDGE_ONE_PAGER.md:32` | "5-invariant Kani+proptest formal-verification target in CI." | Partial — proptest 5/5 green locally, Kani 0/9 ever run. Phrasing "target in CI" is technically defensible but reads as "in CI today". | Soft honesty break. Reword to "5-invariant proptest target in CI (Kani lane scheduled)". |
| `JUDGE_ONE_PAGER.md:32` | "Dual-oracle (Chainlink + Pyth) with 50bps tolerance and 60-second freshness." | Code present in `contracts/plinth/src/lib.rs:298-299` (default params). Plinth contract has 99 bytes of code at the deployed address — getters revert. Constructor never ran or never persisted. | Code-true but not deployed-true. Either redeploy properly or move claim to "in code, pending Plinth wiring". |
| `TECH_DESIGN.md:72` | "Hyperliquid HIP-3 OI grew ~$280M → ~$2.0B in Q1 2026 (peaked $2.38B mid-April per Yahoo Finance / The Defiant); trade.xyz holds ~90%" | Sourced inline. | OK. |
| `ATRIUM_PRD.md:1855, 1913, 2049, 2172` | Same HIP-3 OI claim, all with footnoted sources. | OK. |
| `apps/verify/public/mobile-landing.html:893` | `<div class="v">$12.37M</div>` | Overwritten at runtime by `/api/protocol/metrics` fetch (lines 1196-1219). If JS disabled or fetch fails before paint, user sees fake "$12.37M". | Soft fail — first paint shows fake number. Either change SSR fallback to "—" / "pending" or inline the fetch with a loading skeleton. |
| `apps/verify/public/mobile-landing.html:911-929` | Hardcoded `<div class="amt">$401K/$320K/$483K/$186K</div>` per venue, with bar fills `width: 32%/26%/39%/15%`. | NOT hydrated by any runtime script (the hydration only targets `/api/protocol/metrics`). These numbers stay forever. | **Direct violation of `.claude/rules/ui.md`** "Never display a placeholder number that looks real." Per CLAUDE.md red lines: "Never invent a number." Same trust hit on first impression that Auditor B's AUDIT_USER_FLOWS:37 flagged for the hero "$0 TVL" case but worse — these don't even update. |
| `apps/verify/public/mobile-landing.html:917` | Visible venue logo "PENDLE" + name treatments for "HL-HIP3", "AAVE-V3", "TRADE", "HL-HIP4", "CURVE". | These are venue *names* (where Atrium routes orders), not partner / cohort logos. The names are factual (Atrium adapters DO route to these venues). | Acceptable — venue names ≠ partner logos. But the `$401K / $320K / $483K / $186K` next to each is the lie. |
| `LAUNCH_READY.md:6` | "30 contracts deployed on Arbitrum Sepolia, all verified on Sourcify." | `deployments/arbitrum_sepolia.json` lists 29 entries (+ 1 deprecated faucet). Matches "30 contracts" if you count the deprecated. | OK. |
| `LAUNCH_READY.md:139` | "Full test suite green (currently 585 / 585)." | Actual: 580 / 585. | False — see Headline. |
| `kani-status.json:2` | `"state": "pass", "passed": 5, "total": 6` | No CI run has ever produced this. File is hand-edited. | Theatrical badge. |

---

## Named-entity consent ledger

Per `.claude/rules/writing.md`: *"Names come with consent."*

| Mentioned in | Entity | Consent on file? | Risk |
|---|---|---|---|
| `apps/verify/public/mobile-landing.html:917` + venue cards | PENDLE | Venue name, not partner. `human_left.md:103` lists Pendle as a cohort outreach target but NOT signed. | OK if framed as venue-Atrium-routes-to. Misread risk if a viewer mistakes it for partner logo. |
| Same | AAVE-V3, GMX, HL-HIP3/HL-HIP4, Curve, Trade.xyz, Synthetix, Morpho, Polymarket | Venue adapter names. Atrium has shipped Solidity adapters for each — addresses in `deployments/arbitrum_sepolia.json`. | Venue use, not endorsement. OK. |
| `JUDGE_ONE_PAGER.md:21-24` | Hyperliquid, BlackRock, Robinhood, Coinbase | "Why now" market signals with footnoted public sources (Yahoo Finance, Ethereum Magicians, x402.org, public announcements). | Public-market commentary; no claim of partnership. OK. |
| `apps/verify/src/components/landing/aqueduct-section.tsx:14,27` + `footer.tsx:87` + `transfer-form.tsx:20` | Robinhood Chain | Used as a future testnet target name. AUDIT_USER_FLOWS notes this is gated on the public RH SDK. | OK; honest-pending pattern visible in the same component sub-copy. |
| `apps/verify/src/app/manifesto/page.tsx:63` | "Warm intros to the Arbitrum + Robinhood ecosystem teams" | Stated as an ask, not a relationship. | OK. |
| `human_left.md:103` | Wintermute, Selini, Auros, Galaxy | Outreach targets explicitly NOT signed. Document is correctly off-repo-public boundary. | OK — `human_left.md` is currently NOT in `.gitignore`. If repo goes public, exclude or sanitize. |
| `services/codex/src/routes/venues.ts` and similar service files | Venue list strings | Code-level identifiers (slugs). Not user-facing endorsement. | OK. |
| `desing/Brand Kit.html:780` | "Atrium revolutionises onchain capital efficiency..." | Inside `✗ Don't` example card. | Safe. |
| `audits/month-6-to-10-status.md`, `ops/legal-consult-questions.md` | Various firm names in internal docs | Internal-only docs; sanitize before any public repo flip per `.claude/rules/git.md` "Public repo readiness". | OK for private repo. |

**No fake "5 cohort partners signed" claim found** in any judge-facing or user-facing surface. The PRD/roadmap honestly states partner count target is 5-8 with current count zero. Good discipline.

---

## Security posture

### Multisig + timelock

- `praetor_multisig` on AtriumRouter (`0xf134...2717`): **`0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42`** (single deployer EOA, matches `.env:13`).
- `praetor_multisig` on Aave Horizon adapter: **same EOA**.
- `praetor_timelock` getter reverts on both (storage layout doesn't expose it). PraetorTimelock contract (`0x0dad...22d4`) is deployed but its `owner()` / `getMinDelay()` / `hasRole` reads revert — likely the contract is a custom timelock not OZ TimelockController. Worth a code review pass; if it's not OZ-spec then the "48h timelock" claim needs source citation.
- LAUNCH_READY §6 row "Security + honesty: ✅ Multisig + timelock enforced on deployed contracts" is **at odds with the deployed state.** The deployed Praetor is a single EOA.
- LAUNCH_READY phase D last bullet acknowledges the gap: *"Praetor multisig moved from deployer EOA to a real 3-of-5 Safe (testnet acceptable for buildathon; required before mainnet)"* — but JUDGE_ONE_PAGER.md:32 contradicts this.

**Action**: deploy a Gnosis Safe (3-of-5) on Arb Sepolia, then `cast send` each contract's `setPraetor(address)` (where exposed) or redeploy. If timelock is the OZ TimelockController, grant the Safe `PROPOSER_ROLE` and `EXECUTOR_ROLE`, transfer `TIMELOCK_ADMIN_ROLE` to itself, then renounce the deployer's roles. Until then, every "3-of-5 multisig + 48h timelock" line on a judge-visible surface must be reworded.

### Oracle wiring

- Plinth at `0x4852...4781` has 99 bytes of code total — every getter (including `chainlink_oracle()`, `pyth_oracle()`) reverts on call. Either the multi-fragment activation never completed or the address published in `deployments/arbitrum_sepolia.json:78` is a deployer stub, not the runtime contract.
- plinth-oracle at `0x66064d...f0b7` (27 KB) is deployed. Its getter selectors don't match `chainlink_oracle()` / `pyth_oracle()` either — the Stylus contract uses different externals or the proxy/storage layout is unique.
- LAUNCH_READY §3.6: *"Dual oracle (Chainlink + Pyth) with 50bps tolerance + 60s freshness on every Plinth read."* Source has the constants (`plinth/src/lib.rs:298-299`). Deployed reality cannot exercise them because Plinth itself is non-functional at its published address.

**Action**: confirm Plinth multi-fragment activation. The address in deployments registry is **not callable as Plinth.** Either replace it with the runtime address or document the proxy redirect.

### Reentrancy guards (Stylus contracts)

`grep -rn 'is_updating\|nonreentrant\|ReentrancyGuard' contracts/`:

| Contract | Guard present? | Where |
|---|---|---|
| Plinth | ✅ | `lib.rs` 195, 324, 327, 337 (open_position), 429, 437, 440, 450, 481, 497 (close_position w/ FIRE78-PLINTH-H1 fix), 519, 522, 526 (third state-mutating path) |
| Coffer | ❌ | Zero matches. `deposit()` (line 266+) does `transferFrom` (external) and `share_balances.setter().set()` (internal mint) without any flag check. Any malicious USDC could re-enter. |
| Sigil | ❌ | Zero matches. Sigil is the mandate validator that Plinth calls into; per Plinth's H-H1 comment (`lib.rs:319-323`), "Sigil.validateAction is now mutating (G-3) and any future Sigil upgrade could legitimately call back into Plinth before update_margin runs" — Sigil itself has no inbound guard. |
| Vigil | ❌ | Zero matches. The liquidator. State-changing functions interact with Coffer for fund pulls and Plinth for margin update — both external. No guard. |
| plinth-math, plinth-oracle | n/a | Pure-math / pure-read contracts; no state to guard. |

**Direct contradiction** to `.claude/rules/security.md`: *"Every state changing function on Plinth and Coffer uses the `is_updating` flag pattern shown in TDD §7.1. Proptest invariant covers the reentrancy case."* Coffer doesn't have the guard, and there is no proptest covering Coffer reentrancy (proptest_invariants.rs tests only Plinth math + SPAN).

**Action (priority order):**

1. Add `is_updating` flag + guard pattern to Coffer.deposit / withdraw / adapter_pull. Coffer is the asset custodian — reentrancy here is the highest-blast-radius gap.
2. Add to Sigil.validateAction (Plinth's comment says it's now mutating — guard the mutation).
3. Add to Vigil.run_liquidation.
4. Add a proptest harness in each crate that fuzzes reentrant call paths via stylus-sdk testing primitives.

### Sentry + Codex monitoring

- Sentry DSN wired in `apps/verify/sentry.{client,server,edge}.config.ts`. DSN is non-sensitive (public ingestion identifier per Sentry docs). `tracesSampleRate: 0.1`, `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 1.0` — appropriate for free tier.
- DSN value in `.env`: `https://fcbe93c086d9814326dc5d1294ce92a5@o4511439248949248.ingest.us.sentry.io/4511439337488384` (project `atrium-verify`, org `amityonline`). Live wiring looks correct.
- **`SENTRY_AUTH_TOKEN` not in CI secrets** — per `LAUNCH_READY.md:267` *"Sentry release tracking enabled (SENTRY_AUTH_TOKEN configured in CI for sourcemap upload)"* is **pending**. Without it, releases don't get tagged and sourcemaps don't upload; raw stack traces in Sentry will be near-useless for a Next.js production bundle.
- **No Codex error-rate alert configured.** `LAUNCH_READY.md:268` lists this as pending. Cloudflare Workers Analytics has the data; needs a rule.
- Subgraph health alert (`hasIndexingErrors: true`): pending.
- Droplet agent uptime alert: pending.

### Kill switch reachability

- PosternKillSwitch deployed at `0xb90a...b676` (Phase B). PosternKeyRegistry at `0x28c9...47d8`.
- UI at `/app/agents` + Verify step 5 references the kill switch. Not exercised in this audit (would need an active mandate to revoke).
- Per `.claude/rules/security.md`: "Emergency pause is multisig only, no timelock, pause only (cannot upgrade)." Kill switch logic is in code; the multisig that controls it is single-EOA per the audit above. Single-key emergency pause means a single compromise stops the protocol — pause-only blast radius is acceptable, but acknowledge it.

---

## Honesty audit findings

### Kani badge: theatrical

`apps/verify/public/kani-status.json` is hand-edited to display "pass / 5 of 6". The route at `apps/verify/src/app/api/kani/status/route.ts` (correctly) reads this file as a CI artifact fallback. But the file was never produced by a Kani run — `kani-status.json:7` documents `"source": "post-stylus-0.10-migration manual proptest run"`. The displayed claim of "Kani CI status: pass" is structurally false.

**The 5 frontend test failures all catch this exact lie:** the tests assert "when no upstream is configured and we hit our local file fallback, route should report `state: 'unknown'`" — meaning the *test author* knew the file shouldn't be authoritative. The fix is either to:

(a) remove `public/kani-status.json` entirely so the route falls through to honest "unknown" (the route code at lines 92-101 is ready for this), then let CI write the real artifact when it first runs; OR
(b) change `kani-status.json` to `{"state":"unknown","passed":null,"total":9,"last_run_at":null,"proof_run_url":null,"source":"kani-ci-not-yet-run"}`.

Either way the test honesty contract returns to green.

### Address claims on public pages: deployed but inert

- AtriumRouter (`0xf134...2717`) returns real `praetor_multisig()` — runtime contract is alive.
- Plinth (`0x4852...4781`) has 99 bytes of bytecode total. Every meaningful getter reverts. The "Plinth deployed" claim in LAUNCH_READY:6 + dashboard at `/api/deployments/address?slug=plinth` is technically true (there is code at that address) but practically false (the code doesn't do Plinth's job). Honest framing: "Plinth multi-fragment factory stub deployed; runtime activation pending."
- Coffer / Sigil / Vigil / plinth-oracle have real bytecode sizes (47/38/46/27 KB respectively) — those addresses correspond to live runtime contracts.

### CI badge / "585/585 green"

LAUNCH_READY:139 + AUDIT_USER_FLOWS:21 both claim 585/585. Actual: 580/585. Five failures all sit inside the test that exists to enforce Kani-badge honesty. Recommend fixing the underlying `kani-status.json` (Kani badge theatrics) and the 5 tests pass automatically.

### Git history claim

`.claude/rules/git.md` "Public repo readiness" says: *"Audit history for any secret, even in old commits (`gitleaks --log-opts='--all'`)."* The repo has zero commits — there is no history to audit, but there's also no protection. The next commit will be the first; make sure `.gitignore` excludes `human_left.md`, `my convo*.txt`, `read this.txt`, the buildathon PDFs (or move them to a `private/` folder also gitignored), and the deployer-EOA private key in `.env` before that first `git add .`.

---

## What's correctly handled (kudos)

- **`writing-banned-words.test.ts`** exists, is enforced by `pnpm --filter @atrium/verify test`, and catches the exact patterns in `.claude/rules/writing.md`. The `harness` + `leverage` exceptions are well-justified.
- **Honest-pending pattern** is used consistently in the frontend honest-pending.test.ts + dozens of components.
- **`apps/verify/tests/e2e/02-deposit-usdc.spec.ts:51-52` + `04-view-lantern-attestation.spec.ts:70`** explicitly assert the body never contains "42,392" or "37 agents" or "$4.20M TVL". The placeholder-numbers-as-real regression is gated by tests.
- **Subgraph CI gates** (`check-event-indexing.mjs`, `check-entity-writers.mjs`) catch real regression classes (Fire 74/75, iteration 16).
- **Sentry config** correctly distinguishes public DSN from sensitive auth token. `sendDefaultPii: false` set on every runtime.
- **Codex x402 middleware tests** include the BBBB-5 payer-spoof / front-run prevention case + the FFF-2 / iter-42 / I-1 / I-6 fixes. 22 tests for that single middleware is real coverage discipline.
- **Foundry test suite is large + green** — 25 suites, ~581 tests, no failures. The Sourcify verification is real (every Solidity address in `deployments/arbitrum_sepolia.json` carries an `exact_match` per the file notes).
- **Test pyramid is correctly layered** — unit (Rust + vitest), property (proptest), integration (Foundry), e2e (Playwright). Demo rehearsal infrastructure exists in `rehearsals/`.
- **Kill switch is real code, real address, wired into UI step 5.**
- **JUDGE_ONE_PAGER.md** is mostly honest about the simulated backtest. Most failures are in advertised-vs-deployed gaps, not invented-from-nothing claims.

---

## Punch list to flip "tests + CI" line in LAUNCH_READY to green

Ranked by impact, smallest-fix-first inside each tier.

### Tier 1 — flip the 585/585 + Kani-badge lies (≤ 2 hours)

1. **Replace `apps/verify/public/kani-status.json`** with `{"state":"unknown","passed":null,"total":9,"last_run_at":null,"proof_run_url":null,"source":"kani-ci-not-yet-run","notes":"Kani CI will overwrite this on first main-branch run."}`. The route fallback handles unknowns correctly. The 5 frontend tests pass. The badge stops lying.
2. **Bump `KANI_PROOF_FLOOR` in `apps/verify/src/app/api/kani/status/route.ts:44` from 6 to 9** to match the actual `#[kani::proof]` count (4 plinth/math + 2 plinth/span + 2 sigil/eip712 + 1 sigil/lib). Re-check the test expectations at `route.test.ts:47` (`expect(json.total).toBe(6)` → 9).
3. **Fix `contracts/plinth/src/span.rs:246`** — the test `hedged_position_has_lower_margin_than_unhedged` should assert `req_hedged < req_solo` (matching the comment + SPAN spec). After the fix, `cargo test --workspace --all-features` returns 0 and the `test-rust` CI job flips green.
4. **Rephrase JUDGE_ONE_PAGER.md:32** so "Praetor 3-of-5 multisig + 48h timelock" reads "Praetor multisig + 48h timelock infrastructure (deployer-key today on testnet, 3-of-5 Safe before mainnet flip)". Same for "Kani+proptest" — flip to "proptest in CI, Kani lane scheduled".
5. **Fix `apps/verify/public/mobile-landing.html:911-929`** — either wire venue stats to a real `/api/protocol/venues` endpoint OR replace the `$401K / $320K / $483K / $186K` strings with `—` / `pending`. The 32%/26%/39%/15% bar widths should drop to 0 when no real number exists.
6. **Update `apps/verify/public/mobile-landing.html:893`** SSR fallback from `$12.37M` to `—` so first-paint is honest.

### Tier 2 — close real security gaps (≤ 1 day)

7. **Add `is_updating` reentrancy guards to Coffer, Sigil, Vigil** matching the Plinth pattern. Add a proptest case in each crate that drives a reentrant call path.
8. **Deploy a 3-of-5 Safe on Arb Sepolia** + transfer `praetor_multisig` on each contract that exposes `setPraetor(address)`. For Stylus contracts without a setter (most of them), the only path is redeploy with the Safe address as the constructor arg. Document the transfer txes in `deployments/arbitrum_sepolia.json` per-contract.
9. **Verify the Plinth deployment.** The 99-byte address suggests the multi-fragment activation didn't complete or the published address is the factory stub. Either redeploy with `cargo stylus deploy` and the multi-fragment factory in a single pipeline + capture the runtime address, or document the proxy redirect (`runtime_address` field in `deployments/arbitrum_sepolia.json`).
10. **Wire `SENTRY_AUTH_TOKEN` into CI** so sourcemaps + release tagging work in production. Stack traces are near-useless without sourcemaps for a minified Next.js bundle.
11. **Extend `writing-banned-words.test.ts` walker** to include `*.ts` (API routes) and `*.html` (landing pages). Exclude `node_modules`, `public/deployments/`, `manifest.json`, and the Brand Kit ✗ Don't example div via a comment marker.

### Tier 3 — make the CI gates real (≤ 1 week)

12. **`git init -b main && git add -A && git commit`** the project. Until this happens every CI gate is dormant. Per `human_left.md` #32 this is the prerequisite for everything below.
13. **Update `.gitignore` before the first commit** to exclude `*.txt` (or specifically `my convo*.txt`, `read this.txt`), `human_left.md` (if it stays a working scratch), the buildathon PDFs (or move them to `docs/private/`).
14. **Add a `.gitleaksignore`** with the Hardhat default keys at `scripts/seed.s.sol:38-40` + `services/praetor-cli/src/commands/seed.rs:24` so gitleaks doesn't flag them.
15. **Run Kani in CI for real** — the job already exists, just needs first main-branch fire. Expect 30-90 min runtime per proof in the default Kani config. Consider `kani --unwind` overrides per proof.
16. **Wire matchstick-as for subgraph tests** once `human_left.md` #11/#13 (Linux Stylus build seat + hand-authored Stylus ABIs) lands. Subgraph mapping coverage = 0% today.
17. **Add a `services/agents/*.test.ts` suite.** Three reference agents (Augur / Haruspex / Auspex) with zero unit coverage = blind. At minimum cover the tick loop + the Sigil mandate validation path.
18. **Land Codex x402 deployment** so the `services/codex` build is exercised against a real Cloudflare Worker preview in CI on every PR. Right now the build runs but the deployment doesn't.

### Tier 4 — long-tail honesty hardening

19. **Inventory `human_left.md` entries vs current state.** Item #33 (codex `@x402/*` version mismatch) is stale — the package.json no longer pins those deps. Item #32 (git init) is still live. Stale entries erode the file's usefulness.
20. **Verify Plinth deployment via end-to-end call**: stock the faucet, deposit USDC into Coffer, attempt `Router.openPosition(...)`. If Plinth doesn't respond, the LAUNCH_READY claim "Plinth deployed" needs revision.
21. **Document `kani-status.json` source-of-truth lifecycle.** The route correctly prefers the env URL, then the file, then unknown. Make sure CI is the only writer of the file (currently no protection — anyone can commit a hand-edited version).
22. **Add a CI gate that fails on any `apps/verify/public/**/*.json` change unless commit message contains `[ci-artifact]`.** Forces hand-edits through review.

---

## Appendix — files / paths cited (absolute)

- `C:\Users\prate\Downloads\arb builder\apps\verify\src\app\api\kani\status\route.ts` — Kani badge route + honesty fallback logic.
- `C:\Users\prate\Downloads\arb builder\apps\verify\src\app\api\kani\status\route.test.ts` — 5 failing tests that catch the lie.
- `C:\Users\prate\Downloads\arb builder\apps\verify\public\kani-status.json` — hand-edited file showing fake "pass / 5 of 6".
- `C:\Users\prate\Downloads\arb builder\apps\verify\public\mobile-landing.html` — `$12.37M` SSR + `$401K/$320K/$483K/$186K` placeholders.
- `C:\Users\prate\Downloads\arb builder\contracts\plinth\src\span.rs` (line 246) — inverted assertion that fails `cargo test`.
- `C:\Users\prate\Downloads\arb builder\contracts\plinth\src\lib.rs` (lines 195, 324, 327, 337, 429, 437, 440, 450, 481, 497, 519, 522, 526) — reentrancy guard pattern (correct).
- `C:\Users\prate\Downloads\arb builder\contracts\coffer\src\lib.rs` — Coffer source; no `is_updating` flag.
- `C:\Users\prate\Downloads\arb builder\contracts\sigil\src\lib.rs` — Sigil source; no reentrancy guard despite Plinth's H-H1 comment treating it as mutating.
- `C:\Users\prate\Downloads\arb builder\contracts\vigil\src\lib.rs` — Vigil source; no reentrancy guard.
- `C:\Users\prate\Downloads\arb builder\contracts\plinth\tests\proptest_invariants.rs` — 5 invariants; require `--features export-abi` to compile.
- `C:\Users\prate\Downloads\arb builder\.github\workflows\ci.yml` — CI gates.
- `C:\Users\prate\Downloads\arb builder\.github\workflows\e2e.yml` — Playwright nightly.
- `C:\Users\prate\Downloads\arb builder\.github\workflows\agents-cron.yml` — Agent heartbeat cron.
- `C:\Users\prate\Downloads\arb builder\deployments\arbitrum_sepolia.json` — addresses + deployer EOA on every contract.
- `C:\Users\prate\Downloads\arb builder\.env` — live secrets; correctly gitignored; rotate post-buildathon per LAUNCH_READY §7 #4.
- `C:\Users\prate\Downloads\arb builder\.gitignore` — needs additions before `git init` (see Tier 3 #13).
- `C:\Users\prate\Downloads\arb builder\JUDGE_ONE_PAGER.md` (line 32) — claims that need rephrasing.
- `C:\Users\prate\Downloads\arb builder\LAUNCH_READY.md` (lines 6, 139, §3.10) — claims that don't reflect current state.
- `C:\Users\prate\Downloads\arb builder\human_left.md` (#32 live, #33 stale) — open human blockers.
- `C:\Users\prate\Downloads\arb builder\apps\verify\src\lib\writing-banned-words.test.ts` — banned-words enforcement scope too narrow (only `.tsx`).
- `C:\Users\prate\Downloads\arb builder\desing\Brand Kit.html` (line 780) — banned-word match inside intentional ✗ Don't card. Safe.
- `C:\Users\prate\Downloads\arb builder\services\codex\src\middleware\x402.test.ts` — 22 high-quality tests for the payment middleware. Kudos.
- `C:\Users\prate\Downloads\arb builder\services\lantern-attestor\src\merkle.test.ts` + `ipfs.test.ts` — 25 tests, all green.
- `C:\Users\prate\Downloads\arb builder\services\tablet\tests\` — 28 pytest cases, all green.
- `C:\Users\prate\Downloads\arb builder\services\agents` — zero tests despite `vitest run` script.
- `C:\Users\prate\Downloads\arb builder\subgraph` — no `*.test.ts` files outside node_modules; no `test` script in package.json.
