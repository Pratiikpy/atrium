# Atrium - Engine vs Car: product gap + build audit

> Your question: the engine (backend/contracts) is strong - have we built the **car** (a product people actually want to drive), is every feature **real + PMF** (not jargon), and what is left to **build to scale**, where money is the only blocker?
>
> This is the honest answer, from a 6-agent audit of the live codebase + PRD + competitive frame, **reconciled against what is actually true today** (the raw audit leaned partly on stale pre-fix docs; corrected below).

Generated 2026-05-29.

---

## TL;DR verdict

| Dimension | Score | One line |
|---|---|---|
| **Engine** (backend, contracts, services) | **8 / 10** | Genuinely strong + deployed. The SPAN margin engine, vault, mandates, CCIP, proof-of-reserves are real and defensible. |
| **Car - is it built?** | **~7 / 10** | Better than the raw audit claims. ~11 of 15 user flows are wired end to end with real reads and honest pending states. It is **not** "on blocks." |
| **Car - is it legible / PMF?** | **~4 / 10** | **This is the real gap.** The value prop is buried under jargon (Plinth/Sigil/Lantern). A normal trader cannot tell *why* to use Atrium over trading on Hyperliquid directly. |
| **Money-only blockers** | **few** | On testnet almost nothing is money-blocked. The big ones: 3-of-5 multisig (mainnet gas + ceremony), a couple of paid services, a real domain. |

**Bottom line:** the engine is strong and the car is largely *built* - what is missing is the part that makes a strong engine into a product someone wants: **turning the power into a legible, PMF story, finishing a few genuinely-incomplete features, and a small set of new pages.** Most of it is build-time and product-judgment work, not capital.

---

## Important: reconciliation (audit vs reality)

The audit agents partly read older audit docs (waves F-L, C-/H- findings) that predate recent fixes. These claims are **stale / already closed** and should not drive decisions:

| Stale audit claim | Reality (today) |
|---|---|
| "Coffer/Sigil/Vigil never initialized; admin slots 0x0" | Initialized in Phase theta (#332); contracts redeployed 2026-05-24. |
| "Plinth is a 99-byte stub" | Redeployed full at `0xef31b4b7...` (#331). |
| "AtriumRouter selector mismatch reverts every trade" | Fixed (#333); selector corrected. |
| "Coffer.setAdapter never scheduled / adapters not authorized" | **Scheduled on-chain THIS session** (24 actions, executes ~2026-05-31 02:20 UTC). |
| "Landing has 8 fake partners + a random-walk $TVL ticker" | Removed (#338 + commit ff1196e). |
| "Mobile is a decorative mockup with fake $12.37M" | Ported to responsive React /app (#339/#375); the orphan static `mobile-app.html` may still exist and should be deleted. |
| "Tax export has no auth (IDOR)" | Fixed this session (commit 2dd6a1a: wallet derived from session, not query param). |
| "SCRIBE_URL frozen at v0.0.3" | Subgraph v0.0.7 deployed this session; SCRIBE_URL pinned. |

So the honest headline is **not** "the car won't start." It is: **the car drives, but it does not yet *sell itself* - and a few features + pages are unfinished.**

---

## 1. The real gap: the Car is built but speaks jargon, not value

This is the highest-leverage work and it is almost all product-framing, not engineering. Source: the car-utilization + PMF agents reading the live app.

| # | Where | The gap | What to do | Priority |
|---|---|---|---|---|
| 1 | Landing hero | Leads with architecture ("unified margin prime brokerage"), not the benefit. The one-sentence value is buried 300px down. | Lead with the money: "Deposit once. Trade across 7 venues. See 2-3x buying power because your risks net." Show a before/after: "$50K x 3 venues tied up -> $50K backs all three." | P1 |
| 2 | Jargon everywhere | Section names are contract names: Plinth, Sigil, Aqueduct, Lantern, Rostrum. A user reads Latin, not value. | Rename user-facing labels: Plinth->Margin/Account health, Sigil->Agent mandates, Aqueduct->Cross-chain transfers, Lantern->Reserves, Rostrum->Agent leaderboard. Keep contract names as small dev subtitles. (~2h) | P1 |
| 3 | /app/portfolio buying power | Shows a raw number + trend, never explains what "buying power" is or why it is the whole point. | One-line header: "Your buying power across all venues - the same collateral backs every position." Tooltips on the 4-stat row (TVL/req margin/notional/PnL). | P1 |
| 4 | Margin engine card | Bars + haircut % with no "why margin dropped" story. | Add: "Margin required $X. Why less than the sum? Different asset classes offset risk." On first cross-venue open, show the diff ($50K -> $42K). | P1 |
| 5 | Onboarding | Teaches mechanics, never lands the wedge ("why this vs Hyperliquid alone?"); ends before the first trade. | Reframe step 1 around the benefit + a 3-box visual (HL/Aave/Pendle each $100K -> Atrium one $100K). Extend to "open your first position" + "see margin drop on a hedge." | P1 |
| 6 | Proof-of-reserves | Reads like a compliance artifact ("Merkle proof", "inclusion proof", "IPFS"). The "Verify my balance" hero is buried. | Reframe: "Prove your vault balance to anyone in 10 seconds." Make verify-balance the hero; plain-language the proof steps. | P1 |
| 7 | Agent delegation | Jargon form (per-action cap, actions-per-day) with no "why delegate" or strategy story. | Add a Strategy dropdown (market-making / mean-reversion / arbitrage) with plain descriptions; agent profile shows strategy + live PnL + how revoke works; a "safe limits" wizard. | P1 |
| 8 | Kill switch | The best safety feature, buried in settings. | Add a visible "Emergency stop" card on /app/portfolio: "One tap revokes every agent mandate + session key." Also surface it on mobile (it is a panic feature and is desktop-only today). | P1/P2 |
| 9 | Liquidation banner | "Buffer low" with no numbers a user can act on. | "Buffer 2%. Vigil liquidates at -3%. Deposit $X for +5% safety, or close $Y." Wire $X/$Y to live Plinth reads. | P1 |
| 10 | Competitive wedge | The real wedge - "Hyperliquid HIP-3 cross-margin with Aave T-bills + Pendle yield, which Solana players cannot serve" - is never stated. | Write a one-page positioning ("who we win for + why"); add a concrete side-by-side scenario to /benchmarks (collateral naive vs Atrium-netted; same trade impossible on Cascade). | P1 |
| 11 | Tax export | Works, but undiscoverable + accountant-jargon. | Add "Download your tax history ->" to the portfolio activity feed + onboarding mention. | P2 |
| 12 | Markets page | Reads like API docs; no "which venues to combine to save margin." | Add 3-5 starter combos ("Hedged: perp + cash", "Yield stack: Pendle + Curve") + a 2-venue margin-impact compare tool. | P2 |

---

## 2. Genuinely still to build (real, not stale)

| # | Item | Type | Blocker | Priority |
|---|---|---|---|---|
| 1 | **Execute the timelock batch** (scheduled; executes ~2026-05-31 02:20 UTC) -> turns on cross-venue position opening | on-chain | your key + 48h wait | **P0** |
| 2 | **Agent on-chain execution**: Augur/Haruspex/Auspex run the loop but log "would-act-on" instead of submitting a real ActionSigil; Sigil contract signature recovery is a Phase-1 stub | build-time | needs session keys + testnet testing | P1 |
| 3 | **Vigil liquidation keeper**: `keeper_min_stake` hardcoded 1000 ETH (infeasible on Sepolia); keeper runs read-only | build-time | 1 Stylus redeploy to 0.01 ETH + stake | P1 |
| 4 | **3-of-5 Safe multisig**: every contract admin is still the deployer EOA (which leaked once); docs promise 3-of-5 + 48h | decision/ops | **money-only** (mainnet gas + hardware wallets + ceremony) | P1 |
| 5 | **Lantern**: signing-key + pagination (`first:1000` cap; `balanceWei` = net deposits, not redeemable). For real PoR it must paginate + reflect `convertToAssets` | build-time | none | P1 |
| 6 | **PWA**: manifest points at PNG icons that do not exist; service worker has no fetch handler; Instrument Serif not self-hosted (falls back to Geist) | design/build | none | P1 |
| 7 | **Legal completeness**: privacy (GDPR/CCPA), terms (governing law, liability, "testnet USDC is not real money"), KYC disclosure, bug-bounty scope | decision | free templates; a legal read for mainnet | P1 |
| 8 | **Infra/observability**: real domain + status page (Upptime), Discord, PGP/security.txt, secrets into Doppler, health endpoints, rate-limits on public routes | ops | **money-only-ish** (domain + some paid tiers; most is student-pack free) | P1 |
| 9 | **Demo readiness** (#380): dress rehearsals + judge runbook + Loom backups | build-time | founder time | P1 |
| 10 | **Test depth**: Foundry integration tests for Plinth/Coffer/Sigil/Vigil + an adapter-conformance suite; Matchstick handler tests | build-time | none | P2 |
| 11 | **Off-chain polish**: Tablet FX conversion (UK/DE), Notifier cursor pagination, Codex `/execute` real call | build-time | a paid FX API for tax | P2 |

---

## 3. New pages / surfaces to build (you asked for these, incl. small ones)

| Page | Why | Size |
|---|---|---|
| `/docs/api` (real reference) | #377 marked done but there is no real Codex API reference - 8 endpoints, auth (x402), curl + SDK snippets, rate limits | M |
| `/docs/glossary` | 18 Latin subsystem names need plain definitions - directly fights the jargon problem | S |
| `/docs/deployment` | Every deployed contract: address, block, admin, Arbiscan link - trust + auditability | S |
| `/docs/adr-001..012` | The 12 architecture decisions live inside TECH_DESIGN; make them linkable | M |
| `/docs/runbooks` | The 5 incident runbooks exist as files; publish them | S |
| `/app/settings/postern` | Session-key management (list/revoke), gas sponsorship status, social recovery - Postern is the 18th subsystem with no UI today | M |
| `/app/integrations` (Codex "try it") | An in-app place to see + test the x402 API; today it is invisible inside the product | M |
| `/app/trade` comparison drawer | "Given my collateral, here is buying power on each venue + best combo" - the missing pre-trade decision surface, high PMF | M |
| Link the honesty page | `/docs/honesty` exists but is not linked from nav/footer; surface it (it is a credibility asset) | XS |

---

## 4. Money-only blockers (your one real constraint)

On testnet, **very little is actually money-blocked.** The honest list:

- **3-of-5 Gnosis Safe migration** - mainnet gas (~$3K) + 3 hardware wallets + a signing ceremony. Testnet stays single-key (disclosed honestly on /docs/honesty).
- **A real domain** (atrium.fi or similar) + DNS/SSL - small, "change anytime."
- **Paid service tiers** where the free tier runs out: an FX rate API for UK/DE tax conversion, real-device mobile testing (BrowserStack/LambdaTest), monitoring beyond free tiers.
- Everything else (agent execution, keeper stake, Lantern, PWA, legal templates, docs pages, the entire jargon->value reframing) is **build-time + product judgment, not capital.**

So your instinct is right: money is close to the only *hard* blocker - but it gates a small set of items. The thing standing between "strong engine" and "product people want" is mostly the **car/PMF reframing in section 1**, which costs effort, not money.

---

## 5. Quick wins (do-now, high value, reconciled to not-already-done)

- [ ] Delete the orphan `mobile-app.html` static mockup (real /app is responsive now).
- [ ] Link `/docs/honesty` from the footer + docs nav.
- [ ] Rename the jargon labels (Plinth->Margin, etc.) - ~2h, biggest legibility win.
- [ ] Landing hero: lead with the benefit + the before/after collateral math.
- [ ] Add the "Emergency stop" kill-switch card to /app/portfolio + mobile.
- [ ] Build `/docs/glossary` + `/docs/deployment` (small, high trust value).
- [ ] Reduce Vigil `keeper_min_stake` to 0.01 ETH (one line + redeploy).
- [ ] Self-host Instrument Serif + generate the manifest PNG icons (fixes brand + PWA install).

---

## 6. Honest roadmap to "real, usable, competitive testnet product"

1. **Unlock trading (this week):** execute the scheduled timelock batch (~2026-05-31) -> open-position works; verify a 1-USDC position end to end.
2. **Make it legible (the car):** the section-1 reframing - jargon rename, benefit-led landing + onboarding, buying-power/margin "why", kill-switch visibility, PoR reframing. This is what makes the engine feel like a product.
3. **Finish the genuinely-incomplete:** Lantern pagination + key, PWA icons/font, keeper stake, the new pages (api/glossary/deployment/postern).
4. **Compete on story:** the one-page wedge + the concrete side-by-side scenario vs Cascade/August.
5. **Light up the rest:** agent on-chain execution, off-chain polish, test depth, demo rehearsals.
6. **Mainnet-gated (money + ceremony):** 3-of-5 Safe, domain, paid tiers, legal review.

---

*Scores are a judgment call, reconciled against the live code and this session's fixes - not the stale audit docs. The single most valuable next move is section 1: turn the strong engine into a legible, benefit-first product. That is the difference between "impressive backend" and "thing a trader wants to use."*
