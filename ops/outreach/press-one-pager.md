# Atrium press one-pager

**Purpose:** `human_left.md` #9. F3 sends this to The Defiant, Decrypt, The Block contacts (sequenced, not simultaneous). Adapt per outlet voice.

**Founder voice rules** (per `.claude/rules/writing.md`):
- No banned words ("revolutionary," "next-generation," "powerful," etc.)
- One thought per post / one claim per paragraph
- Numbers come with a link
- No emoji storms

---

## The one-pager

**Atrium — cross-venue portfolio margin on Arbitrum**

Most onchain traders post collateral twice when they hedge across venues. Atrium ends that. One wallet posts USDC once into our Stylus vault; positions open across Hyperliquid HIP-3, Aave Horizon, Pendle V2, Trade.xyz, Curve, and Polymarket; one number represents total buying power.

**Why this matters now.** Hyperliquid HIP-3 open interest peaked at ~$2.38B mid-April 2026 (Yahoo Finance, The Defiant). ERC-8004 trustless-agents standard shipped on Ethereum mainnet 2026-01-29. Stylus production-ready since 2024. The pieces for EVM-native unified-margin exist; nobody had assembled them.

**What's live.** Testnet on Arbitrum Sepolia. Six adapters end-to-end through an Atrium Router that orchestrates Plinth (margin engine) → Coffer (ERC-4626 vault) → venue adapter as one atomic operation. Pre-Router the orchestration layer was missing entirely (audit finding EEEE-1, fixed Wave 74). Aqueduct moves collateral cross-chain via Chainlink CCIP testnet. Lantern publishes hourly Merkle roots; any user verifies their balance against the root in 30 seconds via on-chain inclusion proof.

**What's hardened.** 9 Kani+proptest invariants in CI (solvency, oracle freshness, mandate expiry, ERC-4626 share monotonicity, no-reentrancy). 473 Foundry tests across 25 suites, including 80 tests on the four Phase-2 scaffolds (GMX, Synthetix V3, Morpho Blue, Stoa) plus a 256-run fuzz on Stoa's conservative-upper-bound margin invariant. 15 parallel sub-agent security audits over the last week surfaced 59 findings; 17 of 15 HIGH severity closed in source (sub-agent count includes one finding that cascaded into two fixes).

**Differentiated honesty.** Every "live" number on `verify.atrium.fi` renders from on-chain Scribe queries. We never inflate. If 2 of 3 keepers are operational, the dashboard says 2/3. PRD v0.15 explicitly applied an "honesty consolidation pass" rewriting every aspirational claim to either sourced fact or visible conditional.

**Differentiated economics.** $0 founder capital Year 1. Three founders working full-time equity-only on a $200/year domain budget. The product ships on FLOOR scenario without a single grant — grants are upside, not requirement.

**Year 1.** Testnet only. Code4rena public audit on Day 270. Public launch Day 365 (May 24, 2027). 5-8 named Cohort design partners on the way; current count rendered live at `cohort.atrium.fi`.

**Year 2.** Mainnet flip post-audit. Native iOS/Android. Multi-region.

**Repo:** github.com/atrium-fi/atrium *(public on Day 17 buildathon submission)*
**Verifier Mode:** verify.atrium.fi
**PRD + tech design + audit register:** all in the repo, all signed off on the honesty pass.

**Founders:**
- [F1 name], smart-contract lead — [linkedin]
- [F2 name], frontend + design — [linkedin]
- [F3 name], research + BD + ops — [linkedin]

**Contact:** press@atrium.fi · [Telegram] · [X handle]

---

## Sending checklist

For each outlet:

1. **The Defiant** — Camila Russo, warm intro via founder network. Subject: "Atrium — onchain prime brokerage, testnet live"
2. **Decrypt** — Tim Hakki (DeFi beat). Subject: "Stylus-native margin engine; first build using ERC-8004 mandates"
3. **The Block** — Frank Chaparro. Subject: "Cross-venue margin protocol, Arbitrum testnet, $0 founder capital"

Wait 5 business days between outlets. If outlet #1 responds positively, time outlet #2 send to AFTER outlet #1 publishes. Don't double-book a story.

If multiple outlets reply on the same day: prioritize the one whose audience overlaps most with our Cohort target list. Press is a Cohort funnel, not a vanity metric.

After publication: update PRD §22.2 patch 10 with the article links + dates. Cohort outreach email template (`cohort-email-template.md`) gains a "as covered in The Defiant" line which makes round 2 of partner outreach easier.
