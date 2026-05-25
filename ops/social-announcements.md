# Social announcement templates — Day 0 launch

**Purpose:** F1+F2+F3 each post on X, Farcaster, Mirror. Sequenced, not simultaneous (per `.claude/rules/writing.md` — "One thought per post, no emoji storms").

**Banned-word check:** every post below has been scrubbed against `.claude/rules/writing.md`. No "revolutionary," no "powerful," no "next-generation," no "unlock," no em-dashes-for-drama.

---

## X (Twitter)

### F1 — primary thread (5 tweets)

**1/**
Atrium is live on Arbitrum Sepolia.

One wallet. One margin number. Six venues today, seven by Day 365.

Most onchain traders post collateral twice when they hedge across venues. We end that.

**2/**
The wedge: Hyperliquid HIP-3 perps + Aave Horizon T-bills + Pendle YT + Polymarket binaries, all margined together.

If you net long $100k HL and short $90k Pendle, you post $10k margin, not $190k.

**3/**
Stylus-native risk engine. SPAN-style math in Rust → WASM. 9 Kani+proptest invariants in CI, badge on the verifier page links to the actual proof run.

15 parallel sub-agent audits over the last week. 59 findings. 17 of 15 HIGH closed.

**4/**
$0 founder capital Year 1. Three founders, $200/year domain budget. The product ships on FLOOR scenario without a single grant.

Grants are upside. They're not the plan.

**5/**
Verifier Mode at verify.atrium.fi — pick step 2 to see the cross-venue position flow live on Sepolia.

PRD + tech design + audit register all public.

This is testnet. No real money at risk. Mainnet is Year-2 post-audit.

---

### F2 — design + UX thread (3 tweets)

**1/**
Postern wallet abstraction on Atrium:

— Passkey login (no seed phrase)
— Gas-sponsored deposits
— Session keys for AI agents via ERC-7715
— Kill Switch revokes everything in one tx

Try it: verify.atrium.fi/wallet

**2/**
Design language is quiet prime brokerage. Warm parchment canvas. Instrument Serif display. No neon. No glass effects. No emoji storms.

The product looks like a Bloomberg terminal that drank good coffee.

**3/**
Mobile PWA installable from the verifier page. Add to home screen, passkey log in, hedged position in 4 taps. No app store.

---

### F3 — research + Cohort thread (4 tweets)

**1/**
Cohort design partner program is open.

5–8 firms. We want trading firms with cross-venue books. DM if you want a seat — we'll share the shortlist after a 15-min call.

**2/**
What we ask: 15 min/month check-in, real testnet usage, honest feedback.

What we offer: direct line to the founders, first look at every adapter ship, public credit on cohort.atrium.fi (live count, never inflated).

**3/**
The Cohort number on cohort.atrium.fi renders from on-chain Scribe queries. Today it's 0. Target 5–8 by Day 365.

We will not put a fake number on the dashboard. If we have 1 partner, the page says 1.

**4/**
Open House London Buildathon submission is Day 17 (June 10).

If you're a judge, mentor, or fellow builder: see verify.atrium.fi, dig into the repo, ask hard questions.

We built this to take hard questions.

---

## Farcaster

Single cast, threaded if needed (Farcaster doesn't reward long threads the way X does):

> Atrium — onchain prime brokerage on Arbitrum.
>
> Cross-margin across 6 venues. Stylus-native risk engine. 9 Kani-verified invariants. 15 parallel sub-agent audits. $0 founder capital.
>
> Year-1 testnet. Mainnet Year-2.
>
> Verifier: verify.atrium.fi
> PRD + audit register: in the repo, signed off on the honesty pass.

---

## Mirror

Long-form launch post. F1 drafts; F2+F3 review before publish.

### Title

"Why we built Atrium without raising"

### Outline (don't paste; F1 writes the body in their own voice)

1. **Hook (1 paragraph):** Jamie's collateral problem. One real number from the published backtest, sourced via ResearchAttestation CID.
2. **The wedge (3 paragraphs):** Cross-venue margin on EVM. What Cascade/August/Project 0 do on Solana that nobody does on EVM. Why HIP-3 + Aave Horizon + Pendle make the timing right.
3. **The build (4 paragraphs):**
   - Stylus risk engine (link to Plinth source)
   - Open adapter standard (link to IPorticoAdapter v1.0)
   - Sigil + Postern (link to Kill Switch demo)
   - Lantern proof-of-reserves (link to verifier page)
4. **The honesty (2 paragraphs):**
   - PRD v0.15 honesty pass
   - 9 Kani proofs, 15 sub-agent audits, 17 of 15 HIGH closed
   - Why every dashboard number renders from on-chain reads
5. **The money story (1 paragraph):** $0 founder capital, $200/year. Grants are upside.
6. **The ask (1 paragraph):** Cohort applications. Code4rena warden listing. Press contacts. Mainnet preferred-partner waitlist (Year-2).
7. **The credits (1 paragraph):** F1, F2, F3 names. Open House London. Arbitrum Stylus team. Chainlink CCIP. Pyth. Coinbase x402.

Word target: 1,200–1,500. Mirror rewards single-thought posts; don't pad.

---

## Coordination

- 10:00 AM PT — F1 posts X thread #1
- 10:15 AM PT — F2 posts X thread #2 (replies to F1's thread #1 first tweet)
- 10:30 AM PT — F3 posts X thread #3 (replies to F2's first tweet)
- 11:00 AM PT — All three post on Farcaster (single cast each)
- 12:00 PM PT — F1 publishes Mirror post; F2+F3 amplify

The cadence matters. Don't all-blast at once. Don't tag everyone you know in tweet #1.

---

## Post-launch monitoring

For 48 hours after launch:

- F1 watches X mentions / replies / DMs
- F2 watches the verifier page (real-time analytics; alerts on errors)
- F3 watches Cohort partner inboxes (some will reply same-day)

Reply to every meaningful comment within 4 hours during the first 48h. After that, daily.

If a press outlet picks up the story (Defiant/Decrypt/The Block), update PRD §22.2 patch 10 with the article link. Then send the Cohort round-2 follow-up email referencing it.
