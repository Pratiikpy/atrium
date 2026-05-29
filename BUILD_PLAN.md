# Atrium - Build Plan to a Perfect, Legible, Testnet-Launch-Ready Product

> The engine is strong. This plan builds the **car**: it turns that power into a product a trader instantly understands, trusts, and can drive end to end. The standard is no-compromise - at every fork we pick the option that makes the product more correct, more usable, more defensible, and we say why.
>
> Money-gated items (3-of-5 multisig, a real domain, paid service tiers) are **deferred to after testnet-launch-ready**, per the founder's call. This plan is build-time + product judgment only - no capital needed.

Authored 2026-05-29 from a 6-agent design pass on the live codebase, sequenced for maximum leverage. Companion docs: `PRODUCT_GAP_AUDIT.md` (why), `QA_LAUNCH_READINESS.md` (how we verify).

---

## North star

> A trader lands and immediately sees **why Atrium saves them margin** (one $100K deposit backs positions across three venues instead of re-posting at each), **trusts it completely** (plain contracts, visible proof-of-reserves, one-tap kill switch), and can **trade cross-venue end to end** with real agent mandates executing on-chain - all testnet-launch-ready, with zero dead buttons and only honest data.

We are launch-ready when a judge can do the whole journey - land, understand the benefit, sign in, fund, deposit, open a cross-venue position, delegate to an agent, verify reserves, close out - and every button works, every number is real, every state is honest.

---

## The six phases (highest leverage first)

```
P1 Legibility ──► P2 New pages ──► P6 Hardening ──► LAUNCH
        │                            ▲
        └──► P3 Feature finish ──► P5 Test + verify
                  │                  ▲
        P4 PWA + brand polish ───────┘  (parallel, polish)
```
P1 gates P2 (pages reuse the label map). P3 gates P5 (tests verify real features). P4 runs in parallel. P6 is final, driven by QA findings.

---

## Phase 1 - Legibility (the #1 lever)

**Goal:** turn the engine into a benefit-first, jargon-free product. This is the PMF blocker from the gap audit; everything downstream reads better once it is done.

**Best-option calls:**
| Fork | Chosen | Why |
|---|---|---|
| Where do labels live? | Central map `lib/atrium/copy.ts` (user name + dev subtitle + plain description) | One source of truth; auditors keep the contract name in small text; no scattered string edits |
| Landing hero | Benefit-first hook + before/after collateral visual; architecture below the fold | A trader who re-posts collateral 3x cares about the pain, not the Latin |
| Explainers | Tooltips on first encounter + a persistent "why" line on key cards + an optional `/app/buying-power` deep-dive | Teaches without clutter |
| Kill switch | Visible "Emergency Stop" card on `/app/portfolio` (panic feature) + full key management in `/app/settings/session-keys` | Safety is not an edge case; it belongs on the live-position view |
| Proof-of-reserves | Plain hero ("Prove your balance in 10 seconds") + Merkle/IPFS in an accordion | It reads as a feature, not a compliance artifact |
| Rename scope | Entire app + landing + nav, dev names in small text | Consistent language wherever the user enters |
| Onboarding | Benefit hook (3-box visual) -> mechanics -> first cross-venue trade with a live margin diff | The user *sees* the benefit land, not just reads it |

**Build items (each ships with done-criteria):**
1. `lib/atrium/copy.ts` - 18 subsystems mapped (Plinth->Margin Engine, Sigil->Agent Mandates, Vigil->Liquidation Guard, Coffer->Vault, Aqueduct->Cross-Chain Bridge, Lantern->Reserves, Rostrum->Leaderboard, Postern->Session Keys). Typed so a bad reference fails the build.
2. Landing hero rewrite (`components/landing/hero-section.tsx`) - benefit headline + CSS before/after ("$100K x 3 venues posted -> $100K backs all three"). Technical chrome stays below.
3. Rename jargon app-wide via `copy.ts` (`components/**`, `app/app/**`, app-shell, breadcrumbs). Done = grep finds <5 hardcoded subsystem names outside comments.
4. "Why is my margin lower?" line on `margin-engine-card.tsx` + a live diff on the first cross-venue open. Info-tooltips on the portfolio 4-stat row.
5. Emergency-Stop kill-switch card on `/app/portfolio` (always visible).
6. Reframe `/app/reserves` as "Prove your balance"; Merkle detail in an accordion.
7. Onboarding reorder (`components/onboarding/**`): step 0 = 3-box benefit visual; step 3 = first cross-venue trade showing the margin drop.
8. `/app/markets` starter combos (Hedged: HL perp + Aave; Yield: Pendle + Curve) + a 2-venue margin-impact compare.
9. Landing feature sections lead with the user benefit (eyebrow), dev name small.
10. `/docs/glossary` + `/docs/deployment` (also serve Phase 2) + `COMPETITIVE_POSITIONING.md` (the wedge: cross-venue hedging that Solana players cannot serve).

**Done:** a trader who knows nothing about Rust margin engines reads the app and knows whether it saves them money. All copy passes `.claude/rules/writing.md`. Visual regression matches intent.

---

## Phase 2 - New pages and surfaces

**Goal:** build the missing surfaces, each routed, data-sourced from real reads, with honest pending states and native mobile.

**Best-option calls:** `/docs/api` = static reference table (8 Codex endpoints) + live `/health` probe + a "Try it" form per endpoint; glossary = expandable cards (2-col); ADRs = one `/docs/adr-NNN` page each + an index; runbooks = list + a page per `runbooks/*.md`; Postern UI = single `/app/settings/session-keys` (list + modal); trade comparison = a drawer on `/app/trade` opened by "See margin on each venue", live Plinth reads + 3 preset scenarios.

**Build items:** `/docs/glossary`, `/docs/deployment` (31 contracts + Arbiscan + a verify probe), `/docs/adr-001..012` + index, `/docs/runbooks` + pages, expanded `/docs/api` with try-it, `/app/settings/session-keys` (wire PosternKeyRegistry: list/revoke/extend), `/app/integrations` (Codex + agent + PoR), `/app/trade` comparison drawer. Link `/docs/honesty` into the footer + docs nav.

**Done:** every page lives, reads real data or shows an honest pending state, no secrets rendered, mobile-native, Lighthouse >=90 (>=85 for the interactive `/docs/api`), linked from nav.

---

## Phase 3 - Feature completion (the genuinely-incomplete)

**Goal:** finish the four features that are real-but-unfinished. No money needed.

**Best-option calls:**
| Fork | Chosen | Why |
|---|---|---|
| Agent execution | Real wired: agents sign an ActionSigil locally (ethers) and submit the envelope via AtriumRouter -> Codex `/execute` -> Sigil validate -> open | Ends the "would-act-on" log; agents actually trade |
| Sigil recovery | Wire the eip712 secp256k1 recovery in the contract (currently a Phase-1 stub returning false) | Without it, no signed mandate can execute on-chain |
| Post-timelock trading | Both: a Foundry integration test + a recorded manual QA pass | Prove open+close cross-venue works the moment the timelock executes (~2026-05-31) |
| Vigil keeper | Reduce `keeper_min_stake_wei` 1000 ETH -> 0.01 ETH + a Praetor-only setter, redeploy, stake | Testnet-achievable now, mainnet-tunable later without a redeploy |
| Off-chain | Confirm Notifier/Lantern pagination (already cursor-based) + wire Codex `/execute` real submission | Lightweight; closes the last orphaned path |

**Build items:** agent ActionSigil signing + `/api/status` shows `action_submitted: <tx>` not "would-act-on"; Codex `POST /execute` (decode envelopes, validate on-chain, route, full error codes + x402 + rate-limit); Sigil eip712 recovery wired; Foundry `AtriumRouter.integration.t.sol` (mandate -> cross-venue open -> close -> PnL); Vigil stake reduction + redeploy + keeper stakes; `FEATURE_COMPLETION.md` + `human_left.md` update (Postern per-user session keys honestly deferred to Year-2).

**Done:** agents sign + submit real actions visible on `/app/agents`; the post-timelock open/close path passes the Foundry test + a recorded run; Vigil keeper is staked + active; lint + clippy clean; no dead buttons, no fabricated data.

---

## Phase 4 - PWA and brand polish (parallel)

**Goal:** every pixel intentional, every interaction buttery, installable, accessible.

**Best-option calls:** icons via a build-time `sharp` script (commit the PNGs); keep `next/font` self-hosting Instrument Serif + add a CSS fallback; Lantern shows **redeemable** balance (`convertToAssets`), not just net deposits, with cursor pagination; offline via a real `/offline.html` + network-first SW; accessibility via `@axe-core/playwright` + a Lighthouse CI gate.

**Build items:** `scripts/generate-icons.ts` (192/512/maskable) + manifest fix; service-worker fetch handler (cache-first assets, stale-while-revalidate `/api/reserves/*`, offline page); `/api/reserves/summary` returns `redeemableUsd` + `isStale`; `/api/reserves/merkle` enforces `first:1000` + pagination metadata; contrast/focus-ring/reduced-motion audit; `pnpm audit:a11y` + CI gate.

**Done:** PWA installs (Lighthouse PWA >=90), offline page serves, zero external font requests, a11y >=90 with axe 0 violations, focus rings visible, reduced-motion respected.

---

## Phase 5 - Test and verify (operationalize the QA plan)

**Goal:** prove it works end to end with recorded, graded evidence - exactly the Rabby + Playwright rig you asked for.

**Best-option calls:** Rabby persistent profile + Playwright (port the proven `fhenix builder` driver); evidence = before/popup/after PNG trio per step + a video per journey + premium 1-5 scoring; tests organized per-journey (`01-portfolio` ... `09-settlement`) mapped to `QA_LAUNCH_READINESS.md`; Foundry integration suites + a parametrized adapter-conformance test (skips pending adapters, runs the live ones hot); Matchstick for subgraph handlers.

**Build items:** `apps/verify/e2e/fixtures/rabby/` (launch + approve/sign helpers), evidence + wallet helpers (`captureStep`, `connectWallet`, `fundFromFaucet`), 9 journey specs, a premium-rubric scorer + `qa-report-generator.ts` -> `VERIFICATION_REPORT.md`, Foundry integration + adapter-conformance, Matchstick handler tests, a live-Sepolia post-timelock smoke spec, `qa-launch-readiness.yml` CI posting a coverage matrix, and a 30-minute playbook.

**Done:** 9 specs pass with zero console errors + full evidence; premium scores >=4 on layout/copy/honesty; Foundry + Matchstick green; smoke run captures real tx hashes post-timelock; >=95% of QA rows mapped; `VERIFICATION_REPORT.md` auto-generates.

---

## Phase 6 - Hardening and launch greenlight

**Goal:** resolve every BLOCKER, confirm zero dead buttons + only honest states, lock copy, capture launch evidence, sign off.

**Build items:** run the full `QA_LAUNCH_READINESS.md` (S1-S9) with evidence; fix all BLOCKER + HIGH findings (or document accepted deferrals); lock copy to `.claude/rules/writing.md`; confirm every interactive element works or fails honestly; confirm every number is live-sourced (TVL from `counter.totalTvlWei`, buying power from Plinth, reserves from Coffer); record a ~5-min launch-evidence video; update `/docs/honesty`; greenlight.

**Done = the launch-ready bar (all must be true):**
- North star achieved; landing + app are benefit-first and jargon-free.
- All 8 new surfaces live with honest states; mobile-native.
- Agent execution wired; post-timelock trading verified; Vigil keeper staked.
- PWA + a11y premium (Lighthouse >=90, axe 0).
- 9 e2e journeys pass with graded evidence; `VERIFICATION_REPORT.md` shows 0 open BLOCKERS, premium average >=4.0.
- **Zero dead buttons. Zero fabricated numbers.** Every pending state honest.
- Founder + cofounder sign-off recorded with the commit hash.

---

## Dependencies + how to run it

- **P1 before P2** (pages reuse `copy.ts`).
- **P3 before P5** (tests verify real features). The live-Sepolia smoke test waits for the timelock execute (~2026-05-31 02:20 UTC); every other spec runs against dev immediately.
- **P4 parallel** to P3/P5 (isolated polish); run the final Lighthouse pass last.
- **P6 last**, fed by P5 findings.

Sequencing rationale: lead with the highest-leverage work (legibility), build pages on top of the new language, finish features before testing them, polish in parallel, then harden against real QA output. No phase ships until its done-criteria are green.

---

## Explicitly deferred (post-launch - money / ceremony, your call)

These are **not** in this plan and do **not** block testnet-launch-ready:
- 3-of-5 Gnosis Safe multisig migration (mainnet gas + hardware wallets + signing ceremony).
- A real domain (DNS/SSL) - a find-and-replace once owned.
- Paid service tiers (FX rate API for tax conversion, real-device test farms, monitoring beyond free tiers).
- Year-2 product: per-user Postern session keys for agents, additional live adapters, agent marketplace, advanced risk (VaR), native mobile app, more chains.

Each is honestly disclosed on `/docs/honesty`; none gate the north star.

---

*This plan was designed from the live code, reconciled against what is already fixed (the gap audit's stale "broken wiring" findings were superseded by the theta phase + this session's work). The single highest-value move is Phase 1: make the strong engine legible. That is what turns "impressive backend" into "a product a trader wants to drive."*
