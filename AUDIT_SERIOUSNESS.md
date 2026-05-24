# Atrium "serious-project" audit — 2026-05-24

Auditor H. Scope: would a serious investor, partner, user, regulator, or competitor look at Atrium today and dismiss it as "not real yet"? Synthesises auditors A (contracts), B (frontend), C (backend), D (roadmap), E (tests/security), and the user-flow walks. Out of scope: implementation specifics, polish, individual flow grading — those are owned elsewhere.

---

## Headline

**Atrium is at 22 / 100 on the seriousness scale today.** The architecture work is real and defensible; almost nothing else is. Top-3 buildathon finish is still attainable as a hackathon entry. "Credible early-stage protocol that institutional capital could touch" is at least 6-8 weeks of focused operational work away, and most of that work is not engineering — it's the boring connective tissue (multisig, post-deploy choreography, partner outreach, public history, post-mortems) that the team has consistently deferred.

To cross the credibility threshold (~70/100), six gates have to flip in order: (1) the chain has to actually work end-to-end, (2) the deployer-EOA admin path has to become a real 3-of-5 Safe, (3) the public history (git, CI, incidents) has to exist as evidence not vibe, (4) every public number has to be either live or honestly absent, (5) the docs and the deployed state have to stop contradicting each other, (6) at least one real third-party (partner, user, audit firm) has to have touched the system and said so on record.

The single biggest gap is **#3 — there are zero git commits, zero CI runs, zero post-mortems, zero rehearsals, zero auditor handoffs, zero deposits, zero attestations, zero mandates**. Every claim about quality is "trust me, I tested it locally". An investor can't price that. A partner can't integrate against that. A regulator can't audit that. Until there's a public ledger of the team doing the work over time, Atrium is structurally a single-person snapshot with great taste — not a project.

The fastest 5 fixes (collectively ~12 hours, ~25-point shift):
1. **`git init`, push to GitHub, let CI run for real** (1h work, 0 lines of code) — turns every quality claim from theatre into evidence.
2. **Wire the post-deploy admin txs** (`Coffer/Sigil/Vigil.initialize`, `setAdapter`, `setAuthorizedCaller`) so the deployed chain actually works (4-6h, per auditor A's punch list).
3. **Replace `apps/verify/public/kani-status.json` with `state:"unknown"`** and remove the static $12.37M / $4.13M / fake-partner literals from `landing-v2.html` and `mobile-landing.html` (2h) — kills the only lying surfaces on the public site.
4. **Deploy a Gnosis Safe on Arb Sepolia and re-point praetor_multisig**, even if it's the 3 founders holding their own keys (3h + Safe ceremony) — turns the JUDGE_ONE_PAGER claim from a lie into a truth.
5. **Write the 2 silent-scope-cut tripwires** (T1 buildathon-submission and Praetor-multisig) per the format in `.claude/rules/writing.md`, and one post-mortem in `/incidents/` for any past stumble (Plinth size surgery is the obvious candidate) (1h) — turns the "team doesn't acknowledge slips" tell into the opposite.

After those five, Atrium reads as a serious early-stage protocol with known operational debt — not a hackathon mockup with marketing copy.

---

## The 13-dimension rubric

Each scored 1-5: 1 = joke, 2 = toy, 3 = hackathon, 4 = credible early-stage, 5 = institutional-grade.

### 1. Capital can flow through it — **1.5 / 5 (joke → toy)**

- Faucet is deployed but unstocked (auditor A). User has no testnet USDC to start the loop.
- Coffer, Sigil, Vigil were never initialized (`asset()`, `praetorMultisig()`, etc. all return zero per cast probes; auditor A C-1/C-2/C-3). Every deposit, mandate, liquidation reverts before it begins.
- `AtriumRouter` calls `coffer.adapter_pull(...)` with the wrong selector (snake_case vs Stylus camelCase export) and checks `is_adapter_approved(address)` on a method Coffer does not expose (auditor A C-4). Every router-mediated trade reverts.
- 8 of 9 venue adapters have `onlyAuthorizedCaller` but nobody ever called `setAuthorizedCaller(AtriumRouter, true)` (auditor A C-6).
- `Coffer.setAdapter(...)` was never scheduled through PraetorTimelock for Router, Aqueduct, or Vigil (auditor A C-8).
- Subgraph version baked into every service is the stale `…/v0.0.3` snapshot from ~3 months ago (auditor C). Even if a user transacted, every dashboard would stay empty.
- Subgraph `Rostrum` and `AtriumRouter` data sources point at `0x0000…0000` (auditor C). Mirror trades and router-orchestrated events permanently invisible.

  **One real loop today**: a user can deposit to Coffer via direct wagmi call (vault page works), and `Coffer.totalAssets()` is a live RPC read. That is the only end-to-end path. Everything else — open position, hedge, attest, agent act, withdraw — is dead.

  **Move +1**: execute auditor A's recommended 7-step ordering (initialize, fix selectors, whitelist, fund LINK, set adapter caps). ~5h.

### 2. Capital is safe — **2 / 5 (toy)**

- `praetor_multisig` on every contract = deployer EOA `0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42` (auditor E confirmed via `cast`). Single key controls every parameter, every pause, every upgrade.
- `JUDGE_ONE_PAGER.md:32` advertises "Praetor 3-of-5 multisig + 48h timelock" as current state. It isn't. This is a `CLAUDE.md` "no fake immutability" red line.
- Reentrancy guards exist on Plinth only. Coffer, Sigil, Vigil have **zero** `is_updating` flags despite `.claude/rules/security.md` mandate (auditor E). Coffer is the asset custodian — this is the highest-blast-radius reentrancy gap in the system.
- Plinth at `0x4852…4781` has 99 bytes of code (auditor E). Every getter reverts. The whole margin engine the protocol is named for is either inert or behind an undocumented proxy. Either way, "dual-oracle Chainlink + Pyth with 50bps tolerance" is unverifiable on chain today.
- `PraetorTimelock.emergencyPause` cannot reach Plinth, Coffer, Sigil, or Vigil — wrong selector shape (auditor A C-5). The emergency pause infrastructure the team brags about is structurally inoperable.
- No bug bounty live (Immunefi planned).
- STRIDE matrix exists in PRD §21 (good); not visibly executed against deployed addresses.

  **Move +1**: do auditor A's PraetorTimelock + Aqueduct redeploy with unified `pause(bytes32)`, add reentrancy guards to Coffer/Sigil/Vigil (~6h), deploy a real Safe (~3h ceremony).

### 3. Capital is traceable — **1.5 / 5 (joke → toy)**

- Lantern attestor: deployed (`0x900a…1168`), cron deployed to Vercel, signing key wired. Cron correctly short-circuits when there are zero Coffer balances (good honesty). But: 0 balances ever, 0 attestations ever published. The whole "hourly proof-of-reserves" promise is mechanically wired and empty.
- Lantern's published event has no `ipfsCid` field, so even when an attestation lands the verify-app falls through to `404 missing_ipfs_cid` (auditor C, finding #9).
- Tablet (tax export): deployed, but `/summary` and `/events` endpoints **don't exist** on the FastAPI service; the verify-app calls them and 404s. `/export` query contract is mismatched — verify sends `format/year`, Tablet wants `address/tax_year_start/tax_year_end` (auditor C). Tax export is dead end-to-end.
- Subgraph `CohortPartner` entity exists in schema but no handler ever writes it (auditor C). Even if a partner signed, the page couldn't display it.
- Subgraph cron: daily at 12:00 UTC, not hourly as PRD §11 promises. Silent regression.

  **Move +1**: implement Tablet `/summary` + `/events` OR drop them from verify; ship the `ipfs_cid` event extension; rewire Rostrum data source. ~6h.

### 4. A team exists, can be reached, takes responsibility — **2 / 5 (toy)**

- `/team` page exists with F1/F2/F3 codenames per `human_left.md`. Three real founders are documented but only by codename publicly.
- `SECURITY.md` lists `security@atrium.fi`. Domain not claimed (per LAUNCH_READY §7 — no Vercel custom domain). The email may not resolve. PGP key URL at `https://atrium.fi/security/pgp.asc` is unreachable for the same reason.
- Cohort: **0 partners signed**. PRD Day-90 target is 2. Day -7 today; no outreach started visibly (per auditor D + `human_left.md` #4).
- No incident-response process documented beyond `.claude/rules/security.md` text. `/incidents/` directory is empty (confirmed: only `rehearsals/dress-run-template.md` exists). Zero post-mortems for past stumbles (Plinth size surgery, deploy-and-forget initialize gap, AtriumRouter selector bug).
- 10 demo dress rehearsals committed per `.claude/rules/testing.md`: **0 run**. Only the template file exists.

  **Move +1**: claim domain (1h), publish founder names on `/team` even if just first names + roles (15 min), run one rehearsal and commit the log (2h), write Plinth-size-surgery post-mortem (1h), send one cohort outreach email (1h).

### 5. The architecture is durable — **3.5 / 5 (hackathon → credible early-stage)**

This is one of the strongest dimensions. The Stylus split (Plinth + PlinthMath + PlinthOracle to escape EIP-170 via multi-fragment factory) is real engineering. The PraetorTimelock pattern, the Curator 3-reviewer adapter whitelist, the Coffer per-adapter per-block notional cap, the Sigil EIP-712 mandate shape, the Aqueduct CCIP receiver with destTokenAmounts-correct ccipReceive, AqueductClaimback for expired-message recovery — all defensibly designed.

Caveats:
- The 9 venue adapters point at deployer EOA as venue address (auditor A). All 9 will revert with "call to non-contract" on any real trade. PRD honestly disclaims most venues have no Arb Sepolia presence; the team has not yet published the "venue-pointer ledger" auditor A recommends.
- Plinth's deployed bytecode is 99 bytes (auditor E). Either the multi-fragment factory left an inert stub or the published address is a proxy with no documentation. Until the team explains, "architecture is durable" reads as architecture-on-paper.
- Plinth, Coffer, Sigil, Vigil (the Stylus contracts) have **no UUPS proxy** despite PRD claim of UUPS upgradeability. They are immutable today. The 22 Solidity contracts have OZ UUPS where stated.
- Adapter `pool`/`bridge` fields are immutable — re-pointing when a real venue ships requires full adapter redeploy (auditor A per-adapter table).

  **Move +1**: document the Plinth proxy story; publish the venue-pointer ledger to `human_left.md` and surface it in `/app/markets`; add a Stylus upgrade ADR.

### 6. The product story holds water in 10 minutes of cross-examination — **2.5 / 5 (toy → hackathon)**

Strong points: the Jamie hook is concrete, labelled as simulator output, sourced to a real notebook. The PRD §17 FLOOR/REALISTIC reconciliation is honest. The competitive frame (vs Cascade and August doing intra-venue cross-margin) is defensible.

Cross-examination weak points a DeFi OG will catch in minutes:
- "Arbitrum + Robinhood Chain testnet" — RH has no public SDK (PRD §1.1 admits this honestly; one-pager still phrases it ambiguously).
- "Dual oracle Chainlink + Pyth with 50bps tolerance and 60s freshness" — the Plinth contract that would enforce this has 99 bytes. The constants exist in source. They are not exercised on chain today.
- "Praetor 3-of-5 multisig + 48h timelock" — single EOA per `cast`.
- "5-invariant Kani+proptest formal-verification target in CI" — 5 proptests pass locally, **0 Kani runs ever** (the CI lane exists but the repo has no commits, so nothing has ever fired). `kani-status.json` is hand-edited to claim "pass / 5 of 6" (auditor E).
- "10-100× cheaper gas" — never measured on Atrium's contracts. PRD §1.1 hedges to "per Arbitrum's own docs"; the team has not run a comparison.
- "~55% saved" cross-product margin — labelled as simulator output (honest), but the underlying `ResearchAttestation` is deployed and never used.
- "Hourly Lantern attestations" — cron is daily, not hourly. PRD says hourly.
- "10 cohort partners with live testnet TVL" — 0 partners, 0 TVL, 0 outreach started.

  **Move +1**: every claim either (a) becomes true in deploy state or (b) gets the conditional language already present in the PRD pulled forward to the judge-facing one-pager and landing. Rephrase the four claims that contradict deployed reality.

### 7. The team isn't lying to itself — **2.5 / 5 (toy → hackathon)**

The discipline is good in spots, broken in load-bearing places:

Good:
- `.claude/rules/writing.md` banned-words sweep is enforced and clean across `.tsx` (auditor B + E).
- The honest-pending pattern is implemented across 30+ API routes (auditor C).
- `LAUNCH_READY.md §7` itemizes the deferral list honestly in places.
- Cohort partner count = 0, displayed as 0.
- `human_left.md` is a real working ledger.

Broken (lying to self):
- `LAUNCH_READY.md:139` "Full test suite green (currently 585 / 585)" — actual: **580 / 585**. The 5 failures are inside the test that catches the Kani-badge lie (auditor E). Self-aware self-deception.
- `LAUNCH_READY.md:6` headline "~9 of 15 user flows wired end-to-end (~60%)". Same doc's own table at line 315 says **2.5 / 15 = ~17%** (auditor D). The headline and the supporting data contradict.
- `apps/verify/public/kani-status.json` is hand-edited to display "pass / 5 of 6" from a "post-stylus-0.10-migration manual proptest run" — claims Kani CI passed when Kani CI has never run (auditor E). The Kani job in `.github/workflows/ci.yml` would correctly overwrite it on first main-branch fire; nothing has ever been pushed.
- `apps/verify/public/landing-v2.html` ships hardcoded `PARTNERS = ["Pendle Labs", "Variational", "Horizen", "IOSG", "Robinhood Chain", "Hyperliquid", "Aave Labs", "Coinbase"]` and a `useState(4.13)` random-walk "live TVL" ticker (auditor B C-1). None of these partners signed.
- `mobile-landing.html` Plinth mock card shows `$12,374,820`, `$4.13M`, `3.0×`, `38.4%` with a "live" pill (auditor B C-3 + auditor E).
- `LAUNCH_READY.md §6 row 3.6` says "Security + honesty: ✅ Multisig + timelock enforced on deployed contracts". Auditor E proved this false in 5 minutes with `cast`.
- `human_left.md` has 4+ closed items still listed open (#11, #13, #15, #32) and several partially-closed without status (auditor D).

  **Move +1**: per auditor E's Tier 1 punch list (≤ 2 hours). Replace `kani-status.json`, reconcile LAUNCH_READY headline with its own table, strip fake numbers and partners from the two static HTML files, rephrase the one-pager's three over-claims.

### 8. The team has shipped under pressure before — **1 / 5 (joke)**

This is the most uncomfortable finding.

- `git status`: **zero commits** (auditor E). The "master" branch has never had a commit. Every CI workflow is dormant. Every "tested in CI" claim is false. There is no public evidence the team has shipped anything together.
- `incidents/` directory is empty. No post-mortems, despite multiple known stumbles (Plinth EIP-170 surgery requiring two emergency contract extractions, the deploy-but-never-initialize cliff, the AtriumRouter selector bug).
- `rehearsals/` has only the template. Zero of the committed 10 dress runs done.
- No closed audit findings publicly: `docs/AUDIT_FINDINGS.md` is referenced as the canonical wave-tracking doc but the project has no history of fixes-then-merges-then-deployments.
- No public dev video, blog, or X/Farcaster post per `human_left.md` #10 (open).

  A serious investor's first question: "what have you shipped under pressure?" The honest answer today is "31 contracts in a few-week sprint and a polished design — but there is no public record of the team operating as a team over time." That's hackathon-shaped, not company-shaped.

  **Move +1**: `git init && git commit && git push` (1h). Then run one chaos rehearsal and write the log. Then write the Plinth-size-surgery post-mortem. Single afternoon of work, +1 point.

### 9. The protocol economics make sense — **2.5 / 5 (toy → hackathon)**

- Codex x402 middleware is one of the strongest-defended surfaces in the repo (22 tests, BBBB-5 payer-spoof guard, 12-confirmation depth, unique-tx-hash dedup per auditor C). Endpoints return real 402 responses with `accepts:[…]`. But: the in-memory D1 stub mismatch in `backtest.ts` (`backtest_jobs` vs `backtests`) will 500 every enqueue (auditor C). The endpoint `agents/intent-validation` queries `sigilMandate` which doesn't exist in the schema. Fee model is wired; the value side is broken.
- `CODEX_HMAC_KEY` is empty in `.env`; response signing middleware likely produces dummy signatures (auditor C). Agents that verify HMAC will reject.
- Vigil keeper rewards: contract has `keeper_min_stake_wei = 1000 ether` baked in (auditor A C-3). That's $4M+ on mainnet, unattainable on Sepolia. No setter exists. Means no keeper can stake → no liquidations ever execute. The economic incentive infrastructure does not function.
- No protocol token. PRD does not promise one. Honest.
- Curator $5K ARB per adapter grant — documented but `LAUNCH_READY` admits Praetor multisig isn't live, so the grant payout path isn't actionable today.
- Runway: $0 founder capital + free tier (Vercel + Cloudflare + The Graph + Fly.io). Sustainable for Year-1 scope; documented. Fine.

  **Move +1**: add `set_keeper_min_stake(U256)` to Vigil and execute, fix Codex SQL mismatch, populate HMAC key.

### 10. It can survive a real adversary — **2 / 5 (toy)**

- MEV / front-running: not modelled in any contract. Risk preview modal does slippage estimation client-side; no `commit-reveal`, no MEV-protect submission path. Acceptable for testnet, unaddressed for mainnet.
- Flash-loan attacks: Coffer's per-adapter per-block notional cap is the documented defence. Cap is meant to be set via `Coffer.setAdapter(addr, true, cap)` — never called (auditor A C-8). Defence exists in code, not in production.
- Oracle manipulation: dual-oracle median + 50bps tolerance is documented + coded in Plinth. Plinth has 99 bytes deployed. Defence is on paper.
- CCIP replay: `seen_messages` mapping is implemented and the AqueductReceiver's `ccipReceive` correctly reads `destTokenAmounts[i].token` (auditor A — this is right). Good defence, real code.
- Reorg safety: Aqueduct uses `expires_at` window + `claim_back` path (auditor A confirmed correct). Strong here.
- Rug-pull impossible: actually no — every contract has the deployer EOA as `praetor_multisig`. A single key can pause, parameter-change, or (if upgradeable) rewrite logic. The Stylus contracts are not upgradeable today (no UUPS), which paradoxically improves this — but Praetor can still set deposit caps to 0, mark all adapters un-approved, etc.
- Postern Kill Switch: real, deployed, wired into UI. Strong defence in user-protection terms.
- Sigil signature recovery uses the ecrecover precompile correctly and rejects malformed v values (auditor A noted G-3 fix is real). Strong.

  **Move +1**: real Safe, real adapter caps, real keeper stake, document MEV stance, run one Echidna or Foundry-invariant pass.

### 11. The competitive frame is honest — **3 / 5 (hackathon)**

- `/benchmarks` page exists (auditor B) with honest "where Atrium loses" framing vs Cascade and August. Good.
- Cascade and August do intra-venue cross-margin; Atrium does cross-venue. True comparison.
- "10-100× cheaper gas" lifted from Arbitrum's docs, not measured on Atrium specifically.
- Cross-product margin "40-60% savings" backed only by an unattested simulator notebook. `ResearchAttestation` contract is deployed; backtest has never been published via it. Until that flips, the team is asking judges to trust a closed notebook.
- No public comparison vs dYdX, GMX V2, Pendle, Aave — those are mentioned in PRD as competitors but no like-for-like benchmark.
- "Hyperliquid HIP-3 OI ~$2.0B" sourced to Yahoo Finance + The Defiant. Honest.

  **Move +1**: run the Q1-2026 backtest, publish via `ResearchAttestation`, surface the tx hash on the benchmarks page. Auditor D noted `human_left.md` #23 (PP-3 baseline-USD gap) is the gating fix.

### 12. The launch plan is real — **1.5 / 5 (joke → toy)**

- Post-buildathon loop: roadmap goes Month 1 → Month 12 with concrete deliverables. But Day-90 cohort target (2 partners) is 0 with no outreach started. Day-180 target 3. Day-365 floor target 3-5. Without outreach kickoff, those tripwires fire in sequence.
- First-100-users plan: not documented. "Cohort" is the only acquisition vector named. No content, no community, no developer-relations plan, no integration partnership, no incentive program.
- First $1M testnet TVL plan: PRD §17 FLOOR target is $5M Day-365. Today $0. No incentive structure to attract testnet capital is documented (testnet TVL is inherently weak signal; even so, the team has no plan to seed it).
- Partner integration: no Slack/Discord onboarding, no integration-partner agreement template, no `/partners/integrate` page or docs.
- No "Day 30 / Day 60 / Day 90" demand-gen milestones distinct from build milestones.

  This is the cleanest "hackathon project, not company" tell. The team has built infrastructure but has no plan to put traffic through it.

  **Move +1**: write a Day-17 → Day-90 demand-side roadmap with three specific outreach targets and a content plan (1 day).

### 13. The brand survives third-party scrutiny — **3 / 5 (hackathon)**

What a Google search finds today: nothing. No press, no blog, no domain. PRD/TDD/etc. are in repo. The deployed Vercel URLs are `verify-n7xoe20z3-pratiikpys-projects.vercel.app` etc — judge-visible but un-brandable.

What a competitor evaluator finds: a polished design, a long PRD, 31 deployed contracts, 22 Sourcify exact-matches, banned-words discipline. They'd respect the architecture, smell the fake-partner trust strip, notice no commits in git, conclude "credible solo or 2-person effort, not yet a company."

What a journalist finds: nothing. There is no "Atrium DeFi" story in public yet.

Brand assets (`/brand`, `/manifesto`, `/team` — all reviewed by auditor B): genuinely strong. Brand kit page is honest source-of-truth. The wordmark, palette, typography are coherent and on-thesis (warm-paper prime-brokerage vs neon crypto). The brand can carry the company; the company hasn't shown up yet.

  **Move +1**: claim domain, ship a single "what is Atrium" Mirror/Farcaster post that links to the verify page with the working flows after the operational push.

---

### Composite score

(1.5 + 2 + 1.5 + 2 + 3.5 + 2.5 + 2.5 + 1 + 2.5 + 2 + 3 + 1.5 + 3) / 65 × 100 = **22 / 100**.

Read as: architecturally credible, operationally hackathon, evidentially absent.

---

## The 7 personas verdict

### A skeptical user (just lost money to a rug last cycle)
**Verdict today: dismisses immediately.** No published audit. Single-key admin. No bug bounty live. Domain not even claimed. Hand-edited Kani badge. They've seen this exact shape before — pretty marketing site, "multisig coming soon", single dev, no commits. Pass.
- **Mind-changer**: real Safe + Immunefi listing + first published Lantern attestation showing real reserves.
- **Dealbreaker**: the hand-edited `kani-status.json`. A user who reads the source sees the lie and walks.

### A serious investor (a16z crypto associate, similar shop)
**Verdict today: 15-minute meeting, no follow-up.** The PRD and TDD are above-bar for the stage. Architecture is real. But: zero git history means they cannot diligence the team. Single-EOA admin means they cannot price the security. Zero customers means they cannot price the market. They will say "come back when you have one cohort partner signed and a Safe live."
- **Mind-changer**: one named institutional cohort partner with a tx-hash deposit on chain. Even $50K of testnet TVL from a real fund means more than the architecture.
- **Dealbreaker**: discovering the LAUNCH_READY 60%-vs-17% headline contradiction. Founder-honesty failure is unrecoverable for them.

### A potential partner (Wintermute integrations lead)
**Verdict today: declines to whitelist.** Their checklist: stable adapter ABI (yes, `IPorticoAdapter v1.0` is real), tested on testnet (no, adapters route to deployer EOA), liquidity model (Coffer is sound on paper), liquidation incentive (Vigil broken — 1000 ETH min stake, no setter), governance (single key). They cannot integrate.
- **Mind-changer**: a working Curve or Pendle adapter on Arb Sepolia with real venue contracts (not EOA placeholders), end-to-end deposit → trade → settle, and a Safe-controlled adapter cap.
- **Dealbreaker**: `Vigil.keeper_min_stake_wei = 1000 ETH`. Wintermute won't run a keeper that needs $4M staked.

### A formal-verification PhD
**Verdict today: amused, then dismissive.** Sees 9 `#[kani::proof]` markers (4 plinth/math, 2 plinth/span, 2 sigil/eip712, 1 sigil/lib). Sees `KANI_PROOF_FLOOR = 6` (hand-counted, wrong). Sees `kani-status.json` claiming "pass / 5 of 6" sourced from "manual proptest run." Reads `.github/workflows/ci.yml` and sees the Kani job is correctly wired but has never fired (no commits). Concludes: "the team understands formal methods well enough to perform them, but is performing them, not running them."
- **Mind-changer**: one real Kani CI run on main, badge updates from CI artifact, blog post explaining the invariants.
- **Dealbreaker**: the hand-edited badge. Honesty floor.

### A competitor founder (Hyperliquid, Drift, Cascade)
**Verdict today: tracks, doesn't worry.** Reads PRD, respects the unification thesis, notes the architecture is solid. Then checks the deployment — sees adapters pointing at EOAs, sees Plinth as 99 bytes, sees zero git history, concludes "vapor with great taste". Adds to bookmarks for Q3 check-in.
- **Mind-changer**: cross-venue trade demo with real venue (not EOA) on the destination side. Single working hedge example on Sepolia would force them to pay attention.
- **Dealbreaker**: keeps shipping mocks (mobile app shell, fake partner logos) instead of operational wiring.

### A regulator (UK FCA crypto-asset analyst)
**Verdict today: not yet relevant to look at — but if they did, they'd note Edict (tier-based feature gating + Sumsub sandbox) is scaffolded honestly, Tablet supports UK CGT calculation, `/legal/privacy` + `/legal/terms` are live, and the project explicitly disclaims "no real money in Year 1". The compliance posture is structurally thoughtful (more than most DeFi projects at this stage). The execution gap is that Edict isn't wired to any flow yet.
- **Mind-changer**: actual KYC integration with Sumsub sandbox.
- **Dealbreaker**: the mobile landing's pretend $12.37M TVL would read as misleading advertising if Atrium were UK-regulated.

### A buildathon judge
**Verdict today: yes to top-5, maybe to top-3, depends on demo path chosen.** The architecture story plus the design polish plus the size of the PRD is unusual quality for a hackathon. But:
- Verifier walk: 4 of 7 steps un-runnable end-to-end (auditor D table).
- 48h timelock means even after wiring, the demo cannot transact for 2 days unless `TIMELOCK_DURATION` is dropped to 1h via redeploy.
- Mobile experience is a clickable mockup with no wagmi (auditor B C-2). A judge who taps a button gets nothing.
- The honest-pending pattern is impressive but a judge who walks the live URL sees mostly "—" and "pending"; a judge who watches a polished pre-recorded Loom sees a different (and more flattering) story. **No Loom recorded** per `human_left.md` #20.

  **Mind-changer**: do auditor D's 7-hour push (Faucet stock → 1 adapter whitelist → 1 mandate run → 1 attestation) for a real 6/7 live demo. Top-3 becomes plausible.
  **Dealbreaker**: ship as-is and let judges click. Top-10 at best.

---

## The "this is a hackathon project" tells (top 10)

What a DeFi OG sees in 60 seconds:

1. **Zero git commits.** Open the GitHub repo → "your repo is empty." Every claim about CI, testing, audit waves becomes unverifiable instantly.
2. **No domain.** `verify-n7xoe20z3-pratiikpys-projects.vercel.app` in the judge URL. Personal-fork shape.
3. **`PARTNERS = ["Pendle Labs", "Variational", "Horizen", "IOSG", "Robinhood Chain", "Hyperliquid", "Aave Labs", "Coinbase"]` in `landing-v2.html`.** Eight named entities, none have signed. Single biggest credibility leak.
4. **Random-walk "live TVL" ticker `useState(4.13)` with `Math.random()` drift** on the desktop landing. Inspectable in dev tools in 30 seconds.
5. **`cast call <plinth> "praetorMultisig()"` returns the deployer EOA.** Contradicts the one-pager's "3-of-5 multisig + 48h timelock" headline.
6. **`cast code <plinth>` returns 99 bytes.** The contract the protocol is named for is inert at its published address.
7. **`kani-status.json` hand-edited to "pass / 5 of 6", sourced from "post-stylus-0.10-migration manual proptest run".** Theatre, caught by the project's own tests.
8. **Mobile shell at `/mobile/app` is a vanilla-JS file with no wagmi.** Tap "Open long · rTSLA-PERP" → handler just toggles the button color. Tap "Move $50,000 USDC" → no handler. Pretty mockup, not an app.
9. **LAUNCH_READY headline says "9/15 (60%)"; the same doc's table says "2.5/15 (17%)".** Internal contradiction in the canonical status doc.
10. **`incidents/` directory empty. `rehearsals/` empty except template.** Zero post-mortems, zero dress runs. The team has not yet operated under pressure with a record.

---

## The "this is real" signals (kudos)

Genuine credibility-building work that should be louder:

- **Stylus contracts deployed via cargo-stylus 0.10.7 multi-fragment factory.** Plinth was 35 KB, hit EIP-170, split into Plinth + PlinthMath + PlinthOracle, multi-fragment factory pattern. Legitimate, advanced engineering.
- **22 Solidity contracts Sourcify-verified exact_match.** That is the right way to publish on chain.
- **Subgraph indexing is healthy** (`hasIndexingErrors: false`, current to tip) on `/version/latest`. The pipe works.
- **Codex x402 middleware is one of the strongest-defended surfaces in DeFi-buildathon-shape**: 22 tests, 12-confirmation depth, unique tx_hash dedup, chain-truth from-address binding, USDC log-decode (not tx.value), zero-address payTo gate.
- **Honest-pending discipline is genuinely above bar** — 30+ API routes return `source: 'pending'` with named blocker instead of fake-zero literals; the `honest-pending.test.ts` cross-route invariant guards this.
- **Banned-words sweep is clean** across `.tsx` and enforced by `writing-banned-words.test.ts`.
- **`/verify/[step]` Verifier walk** is the highest-quality single surface in the app (auditor B). Real wagmi hooks per step, real deployment-readiness check, honest empty/permission/error/success states, Arbiscan tx links.
- **Aqueduct's `ccipReceive` correctly reads from `destTokenAmounts`** not the message body — B-6/F-4 audit fix locked in.
- **Coffer's virtual-shares offset (1e6)** matches OZ ERC4626 inflation defense exactly.
- **`Plinth.do_update_margin` reentrancy guard is real** and the M6 race fix on Vigil's `margin_version` nonce is real.
- **PRD's FLOOR/REALISTIC reconciliation in §17** is one of the more honest scope-management docs in any buildathon project.
- **Architecture story (Plinth/PlinthMath/PlinthOracle split, AtriumRouter as orchestrator, IPorticoAdapter v1.0, Sigil EIP-712, Aqueduct/Receiver/Claimback trio) is internally coherent** and defensible against cross-examination.
- **Brand kit (`/brand`) is a genuine source-of-truth page** with palette swatches and "value slot" labels rather than fake numbers.
- **The honest "Cohort applications open" empty state on mobile landing** (today's fix) is the right pattern; just needs to spread to desktop.

---

## The 5 things blocking "serious" status (priority-ordered)

### 1. Public history of the team operating

**What it is**: no git commits, no CI runs, no `/incidents/` post-mortems, no `/rehearsals/` logs, no public blog/announcement, no Loom demo backup. Every quality claim is "trust me, locally."

**Why it matters**: a serious investor, partner, or auditor cannot price what they cannot see. Architecture without history is a hackathon snapshot. The whole "team has shipped under pressure" dimension scored 1/5 because there is no evidence either way.

**What fixing it costs**: 1 hour to `git init`, push, let CI run. Plus 2-3 hours to write one rehearsal log + one post-mortem (Plinth size surgery is the obvious candidate; the team did real surgery and never wrote it up).

**What it unlocks**: every other dimension. CI green badges become evidence. Sourcify-verified count becomes credible. Test-suite-585 claim becomes verifiable. Even the Safe-deploy and adapter-whitelist work, once done, lands as commits in a visible history — not as another snapshot claim.

### 2. The deployed chain actually works end-to-end

**What it is**: per auditor A's 9-step ordering — `Coffer/Sigil/Vigil.initialize`, `AtriumRouter` selector fix + redeploy, `PraetorTimelock` + `Aqueduct` `pause(bytes32)` unification, 8 adapter `setAuthorizedCaller` calls, 3 `Coffer.setAdapter` schedules, `Aqueduct.depositLink`, Vigil keeper min-stake reduction, Aave V11 redeploy, AaveHorizon venue-id 2 schedule re-issue.

**Why it matters**: dimension 1 (capital can flow) is the foundation of every other dimension. Today nothing past `Coffer.totalAssets() = 0` works. Until the chain works, Lantern can't attest, Tablet can't export, Rostrum can't leaderboard, agents can't act, Vigil can't liquidate, judges can't walk.

**What it costs**: ~5h focused work + 48h timelock wait (or 1h if `TIMELOCK_DURATION` constant is reduced via redeploy).

**What it unlocks**: 12-14 of the 15 LAUNCH_READY flows. All of dimension 1, most of 3, half of 6.

### 3. 3-of-5 Praetor multisig actually deployed, with admin transferred

**What it is**: deploy a Gnosis Safe (3-of-5) on Arb Sepolia. Re-point `praetor_multisig` on every contract that has a setter; redeploy the ones without. Transfer `PROPOSER_ROLE` + `EXECUTOR_ROLE` on PraetorTimelock to the Safe. Renounce the deployer's roles.

**Why it matters**: this is the single load-bearing security claim in the JUDGE_ONE_PAGER and SECURITY.md. Today it's fake. A user, investor, partner, or regulator who runs `cast call <coffer> "praetor_multisig()"` catches it in 60 seconds and the credibility collapses in one screenshot.

**What it costs**: ~3h Safe ceremony with three founders' hardware wallets; ~2h to re-point or redeploy contracts; documenting the transfer txes in `deployments/arbitrum_sepolia.json`.

**What it unlocks**: dimension 2 (capital is safe) jumps from 2/5 to 3.5/5. JUDGE_ONE_PAGER.md:32 stops being a lie. Every "no fake immutability" CLAUDE.md commitment becomes honest.

### 4. Public surfaces stop lying

**What it is**: per auditor B (C-1 to C-5) and auditor E (Tier 1):
- Replace `kani-status.json` with `state:"unknown"`. Fix `KANI_PROOF_FLOOR` to 9.
- Strip the `PARTNERS = […]` literal and `useState(4.13)` ticker from `landing-v2.html`.
- Strip the `$12,374,820` / `$4.13M` / `$401K/$320K/$483K/$186K` literals from `mobile-landing.html`, OR wire them to a real endpoint.
- Strip the `$12,374,820` mobile-app shell hero card + fake positions + fake mandate + fake $50,000 transfer, OR clear placeholders on missing data (don't "leave the design placeholders" per the current code comment).
- Fix `/app/page.tsx` to read deployment state from `/api/deployments/status` instead of hardcoding "Source built · deploy Month 1 W2" for already-deployed subsystems.
- Rephrase JUDGE_ONE_PAGER.md:32 to honest conditional language for multisig + Kani.
- Reconcile LAUNCH_READY headline (60%) with its own table (17%).

**Why it matters**: every public dishonesty has a cost when caught. The team has built strong honesty discipline in the React app and the API layer; it's the static HTML files and a couple of canonical docs that betray the discipline. Cleaning the surfaces is fast and pays out across every persona.

**What it costs**: ~3-4h.

**What it unlocks**: dimension 7 (not lying to itself) goes from 2.5 → 4. Every persona's "dealbreaker" finding above stops being a dealbreaker.

### 5. One real third-party touch on chain

**What it is**: any one of —
- One cohort partner (even a friend's fund or a friendly DeFi-OG) deposits real testnet USDC to Coffer with a public tx hash + a quote consenting to be named.
- One Code4rena or Cantina contest scoped, even at a small bounty.
- One Immunefi listing live (standard tier $25K is committed in SECURITY.md).
- One mention in The Defiant / Wu Blockchain / Crypto Twitter from a non-team account.

**Why it matters**: today every signal about Atrium comes from the team. There is no third-party validation. Cohort partner count is 0; outreach hasn't visibly started.

**What it costs**: 2 weeks of focused BD + acceptance of small bounty cost OR ~$5K Immunefi listing fee.

**What it unlocks**: dimension 4 (team exists, can be reached) jumps from 2 → 3.5. The "no customers" investor-pass becomes "early customers."

---

## The 10 fixes that move the needle most (seriousness-per-hour)

| # | Change | Hours | Score shift | Risk |
|---|---|---|---|---|
| 1 | `git init && git add && git commit && git push` + enable Actions | 1 | +5 | None. Update `.gitignore` first per auditor E (`*.txt`, `human_left.md`, PDFs). |
| 2 | Replace `kani-status.json` with `state:"unknown"`; bump `KANI_PROOF_FLOOR` to 9 | 0.5 | +2 | None. Frontend tests pass, badge stops lying. |
| 3 | Strip 8 fake `PARTNERS` + `useState(4.13)` from `landing-v2.html`; strip $12.37M / $4.13M / per-venue $K from `mobile-landing.html` | 2 | +3 | None. Replace with empty-state CTAs. |
| 4 | `Coffer.initialize`, `Sigil.initialize`, `Vigil.initialize` via new `PhaseB4-Initialize.s.sol`; reduce `Vigil.keeper_min_stake_wei` (needs Stylus redeploy + new setter) | 3 | +4 | Low. Coffer caps need confirming with PRD; pick conservative testnet values. |
| 5 | Fix `AtriumRouter` selector (snake → camel) + remove `is_adapter_approved` check OR add it to Coffer; redeploy Router | 1 | +3 | Low. Need to confirm Coffer redeploy isn't required (read-only fix possible). |
| 6 | Deploy 3-of-5 Safe on Arb Sepolia, re-point `praetor_multisig` on contracts with setter; redeploy the 3 Stylus ones that don't | 5 | +6 | Medium. Stylus redeploys cost gas, change addresses, invalidate Sourcify state. Plan deployments registry update. |
| 7 | Write 2 tripwire notes (T1 buildathon, Praetor-multisig) per `.claude/rules/writing.md` format; write 1 post-mortem for Plinth size surgery in `/incidents/` | 1 | +2 | None. Pure honesty win. |
| 8 | Reconcile LAUNCH_READY headline (drop the "60%" claim; use the table's 17%); fix `/app/page.tsx` to read real deployment state from `/api/deployments/status` | 1 | +2 | None. |
| 9 | Run the 9 `setAuthorizedCaller(Router, true)` calls on adapters; schedule + execute 3 `Coffer.setAdapter` actions; fund Aqueduct with LINK from Chainlink faucet | 2 + 48h wait | +3 | Low. Timelock wait is the bottleneck — consider 1h `TIMELOCK_DURATION` for testnet. |
| 10 | Fix subgraph `Rostrum` + `AtriumRouter` `0x0` addresses; switch every `SCRIBE_URL` to `/version/latest`; redeploy subgraph | 1.5 | +2 | None. Per auditor C's headline fix list. |

**Total: ~18h focused work + 48h timelock window, ~+32 points (22 → 54).** Gets Atrium from hackathon-shape to early-stage-credible. Top-3 buildathon plausible. Investor/partner conversations become substantive instead of polite.

To reach 70+/100: add real cohort partner #1 (2 weeks BD), one Kani CI green run (1 week formal-verification time), Lighthouse audit + mobile-app port (5-10 days), Immunefi listing (1-2 weeks intake). All of that is post-buildathon.

---

## What founders need to hear out loud

### Three hard truths

1. **The architecture is impressive; the operations are absent.** The team has built more contract surface in a few weeks than most seed-stage protocols ship in a year. None of it works end-to-end today because the post-deploy choreography (initialize, whitelist, fund, schedule, authorize) was never executed. This isn't a code problem; it's a "we don't do operations" problem. Fix by treating the 9-step ordering from auditor A as a single focused afternoon and putting it on the calendar.

2. **The 60-vs-17 LAUNCH_READY contradiction is the team lying to itself, not just to the reader.** Two numbers in the same canonical status doc disagree by 3.5×. That means the team isn't actually reading the doc when it updates the headline. The honesty discipline that's enforced in code (`writing-banned-words.test.ts`, `honest-pending.test.ts`) is not enforced in the docs. Fix by treating LAUNCH_READY as production code: any number in the headline must be derivable from a table below it, or it doesn't ship.

3. **Zero git commits is the single biggest "this is not a real project" signal.** Every other gap can be closed in days. This one only closes by starting. The team has been working privately for weeks; the moment that work becomes public history (even if it's a single squash commit today), every audit, every test, every CI gate, every Sourcify verification stops being a claim and starts being evidence. Do it before any next action.

### Three things to stop saying in public until they're real

1. **"Praetor 3-of-5 multisig + 48h timelock"** in `JUDGE_ONE_PAGER.md:32`. Today this is a deployer EOA. Rephrase: "Praetor timelock + multisig infrastructure (deployer key on testnet; 3-of-5 Safe ceremony before mainnet)." Or actually deploy the Safe. Either is fine. The current state is not.

2. **"5-invariant Kani+proptest formal-verification target in CI"** — Kani has never run. Rephrase: "5-invariant proptest target green in local runs; Kani CI lane scheduled for first main-branch fire." Or fire the workflow once.

3. **"$12.37M live TVL", "$4.13M collateral", "37 agents", "42,392 queries", and the 8 partner names** on landing-v2.html. None are real. Replace with the same honest-empty / honest-pending pattern that the React app already uses cleanly. The team has the discipline; just extend it to the static files.

### Three places the team is over-promising

1. **The buildathon Verifier walk.** Marketed as "judge runs 7 steps with real Arbiscan tx hashes." Reality is 4 of 7 steps un-runnable. Choose: do the 7-hour push to make 6/7 work, OR record a Loom and submit honestly. Don't ship the live walk in current state — a judge clicking through will catch the gap.

2. **The mobile experience.** `LAUNCH_READY` includes "Mobile flows" as item 14 of 15 — implying it works. Reality (auditor B): every primary button on the mobile app shell is dead. The shell is a beautiful clickable mockup. A judge or investor opening Atrium on their phone gets nothing. Either port to responsive React (5-10 days, post-buildathon) or write "mobile shell is preview-only; transact on desktop" in copy and ship it honest.

3. **The cohort + partner story.** PRD targets 2 partners by Day 90; today 0 with no outreach started. JUDGE_ONE_PAGER says "Cohort partner program will list named design partners… At Day -7 the partner count is 0" — this is honest at the one-pager level. But the landing has 8 fake partner logos, and the broader marketing posture (Robinhood, Hyperliquid, Aave Labs by name on the bundle) is incompatible with the "count is 0" line. Pick the honest framing and apply it consistently.

---

## The yes/no question

**Can Atrium credibly call itself a "real project" today?**

**No — not yet.**

What flips it: the five priority-ordered blockers above, executed in that order. Specifically — once (1) git history exists, (2) the chain works end-to-end on the 7-step Verifier walk, and (3) `cast call <coffer> "praetor_multisig()"` returns a Safe address instead of an EOA — Atrium is a real early-stage protocol with known operational debt. Add (4) the honesty cleanup of the static surfaces and (5) one third-party touch (cohort partner OR Code4rena scope OR Immunefi listing) and it crosses 70/100. That's "credible early-stage protocol institutional capital could touch, after due diligence."

The work is small. The architecture is already done. What's missing is operations, evidence, and the discipline to make the public surfaces match the private discipline. None of that requires more money. All of it requires the team to stop building new things and start finishing the things they already shipped.

The product is closer to serious than the headline numbers suggest. The headline numbers are part of the problem.
