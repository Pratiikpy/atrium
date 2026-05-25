# Cohort partner outreach — email template

**Purpose:** F3 sends to each name in `outreach/targets-private.md`. Personalize the second paragraph per target. Don't send the same canned message — Cohort is a relationship play.

**Subject line options** (pick the one that fits the recipient):
- "Cross-margin EVM design partner program — short ask"
- "Atrium Cohort — could use your eyes on our risk model"
- "5 design partners. We'd like you to be one."

---

## Body

Hi [name],

I'm [F1's name] from Atrium — we're shipping cross-venue portfolio margin on Arbitrum, Stylus-native. The wedge is straightforward: collateral nets across Hyperliquid HIP-3 + Aave Horizon + Pendle + Trade.xyz + Polymarket via CCIP. One wallet, one margin number, math you can verify on chain.

[Personalize: 1-2 sentences on what THIS firm is solving that overlaps with us. E.g. for a HIP-3 market maker: "Your market-making book ends up over-collateralized whenever you hedge directional risk on Aave. We collapse that into one number." For a prediction-market shop: "Your Polymarket+Pendle pairs trade requires posting collateral twice. We make it once."]

We're forming a 5–8 partner Cohort to ship Year-1 testnet. The asks:

1. **15 min/month** check-in with one of the three founders
2. **Real testnet usage** — deposit a meaningful slug into Coffer, run actual hedged positions through our Verifier Mode
3. **Honest feedback** on the risk model and adapter UX — what would block you from porting mainnet

We don't ask for any capital, any signed paper, any exclusivity. Just real eyes on real testnet flows.

What we offer:

- Direct line to the founder team
- First look at every adapter ship (your venue pain becomes our v0)
- Public credit on `cohort.atrium.fi` (live count, no inflation — we're at [N] partners today, target 5–8 by Day 365)
- Mainnet preferred-partner status when we flip Year-2

PRD + tech design here: [link to public ATRIUM_PRD.md once repo public, or attach v0.15 honesty pass directly]

Verifier Mode demo (test wallet, $0 risk): https://verify.atrium.fi/ — pick step 2 to see the hedged-position flow live on Sepolia.

Worth a 30-min chat?

Best,
[F1's name]
F1 / smart-contract lead, Atrium
[founder email] · [Telegram handle] · atrium.fi

---

## Reply handling

If they say **yes, interested but busy**: confirm a 30-min slot in 7–10 days. Send Calendly link, not a back-and-forth email thread.

If they say **yes, what's the catch**: there isn't one for Year-1 testnet. Reiterate "no capital, no signed paper, no exclusivity." If they push, send the Cohort partner agreement template (`legal/cohort-loi-template.pdf` — pending Stanford Law clinic review per `human_left.md` #5).

If they say **need to see more before committing**: send the PRD v0.15 + the JUDGE_ONE_PAGER + a link to the verify.atrium.fi backtest. Don't promise things you can't deliver.

If they **don't reply in 5 business days**: one follow-up only. Mention the day-90 PRD milestone and that the Cohort fills up first-come.

If they say **no**: ask for a referral. "Who in your network would be the right thinker for this?" — most "no"s yield a useful pointer.

---

## Track

After each send, log in `outreach/targets-private.md`:

```
[date] · [name] · [firm] · [stage: sent | reply | meeting | partner | declined] · [next action]
```

Update `cohort.atrium.fi` (Scribe-backed) live count whenever a partner formally signs the LOI.
