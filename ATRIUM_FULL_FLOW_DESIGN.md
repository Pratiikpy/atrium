# Atrium — Full User Flow Design

This document is the product behaviour catalogue. For every feature in Atrium, it walks through what a user does, what they see on screen, what options they have, what happens behind the scenes in plain words, what can go wrong, and what a human helper can do for them.

Goal: prove the product is fully designed for all known user actions, common failure modes, and declared pending states. Unknown edge cases will surface in [What's not yet decided](#whats-not-yet-decided) as they become real.

Not in scope: technical architecture, contract names, smart-contract code, API routes. Those live in other documents. This is purely what a person experiences when they use Atrium.

## What Atrium is, in one paragraph

Atrium is one wallet that lets you trade across many places — perpetual futures, lending markets, yield tokens, prediction markets — and shows you one buying-power number across all of them. Today, if you hedge a position on one venue against another, you have to post collateral twice. Atrium nets the hedge so you only post collateral once. You can also hand a fixed budget to an AI agent that trades on your behalf inside boundaries you set, and pull the plug on every agent with one button.

## Why Atrium? Why not use the venues directly?

A trader who only uses one venue does not need Atrium. The pitch only makes sense if you trade across two or more places.

**Without Atrium.** You post collateral on Hyperliquid for your perp position. You post collateral on Aave for your lending position. You post collateral on Pendle for your yield trade. If your perp and your lending are a natural hedge, the two venues do not know about each other — both venues require their own full margin. Your money is split across four or five sandboxes. If one venue gets congested, you cannot move collateral to another without manually withdrawing, bridging, and redepositing — a process that takes minutes and costs gas at each step.

**With Atrium.** You deposit USDC once. You open positions across the same set of venues. Atrium's margin engine sees the whole portfolio at once and nets the hedge. The collateral that would have been double-locked on two venues is now free to back a third trade. If a venue fails, your money is not stranded — it stays in Atrium's vault, with only the position itself exposed. You manage everything from one dashboard.

**The single sentence.** Less capital locked. Risks made visible.

**What Atrium does NOT remove.** Atrium does not eliminate the market risk of your underlying trade. It also adds its own risk surface on top of the venues you already use — smart-contract risk (our contracts), adapter risk (the glue between us and a venue), oracle risk (the price feeds we trust), cross-venue basis risk (a "hedge" can de-correlate), liquidation-engine risk (the safety bot misbehaves), bridge risk (cross-chain transfers), admin/governance risk (the multisig acts wrongly), and indexer/UI risk (you act on stale data). These risks are listed where relevant and disclosed before your first trade in [Before your first trade — Risk Preview](#before-your-first-trade--risk-preview). The pitch is capital efficiency, not risk-free trading.

## Who uses Atrium

**Trader.** A person who deposits money once and opens positions across venues. The main user.

**Agent.** A trading bot that the trader has authorised to act on their behalf within strict limits.

**Cohort partner.** An institutional pilot user testing Atrium with a meaningful deposit and a named contact at Atrium. ("Meaningful deposit" is currently undefined — see [What's not yet decided](#whats-not-yet-decided).)

**Keeper.** A bot operator who runs liquidation services and earns a small fee for protecting the system.

**Atrium team.** The people who can press emergency buttons, approve new trading venues, and answer support questions.

**Anyone (public).** Anyone on the internet who can read the public landing page, the proof-of-reserves page, the partner directory, and verify their own funds are accounted for — without needing an account.

## Where everything lives

Atrium has three kinds of pages:

**The public site** (landing, docs, security, brand kit, learn, manifesto, team). Anyone can read these. No login required.

**The verifier walk** (a 7-step demo for judges or investors). Anyone can run it. Each step shows you exactly what Atrium can do, end to end, with real transactions.

**Your account** (the app). After you connect a wallet, you get to your portfolio, trading screen, transfer screen, agents screen, reserves screen, tax screen, settings, and vault.

## Honesty list — what is built, what user sees today, what's next

Three columns so a reader can't misread the state. "Designed" means the UI flow exists, the contracts or services are scaffolded, and the user sees an honest disabled state with a named blocker until deployment.

| Feature | Current status | What user sees today | Next milestone |
|---|---|---|---|
| Connect wallet via passkey | Live | Real WebAuthn ceremony | — |
| Deposit USDC into the vault | Designed | Disabled button: "Coffer deploys Month 1 W2" | Vault contract deploy, Month 1 Week 2 |
| Open a position on a venue | Designed | Disabled with same named blocker | Adapters deploy, Month 1 Week 2 |
| Close a position | Designed | Same | Same |
| Cross-chain transfer | Designed | Live for testnet routes where the destination chain has a deployed Aqueduct adapter (Arbitrum Sepolia today). Other destinations show "pending" with a named blocker until adapters deploy. | Per-chain adapter rollout (see roadmap) |
| Withdraw USDC | Designed | Disabled button with named blocker | Vault contract deploy, Month 1 Week 2 |
| Sign an agent mandate | Live for the signature flow | Real wallet signs the EIP-712 envelope; intent hash is shown to the user | Central storage of signed mandates, Month 1 Week 2 |
| Agent trades under a mandate | Designed | Agent's transaction reverts until the verifier contract is live | Verifier contract deploys, Month 1 Week 2 |
| Revoke a single mandate | Designed | Same | Same |
| Kill switch (revoke everything in one transaction) | Designed | Disabled button: "Safety contracts deploy Month 1 W2." Confirm dialog is previewable in [the 90-second judge walk](#the-90-second-judge-walk-verifier-mode) but no wallet transaction is requested. | Safety contracts deploy, Month 1 Week 2 |
| Proof-of-reserves: verify your inclusion | Read flow live | "No attestation published yet" honestly until the cron starts | Hourly publisher cron, Month 6 |
| Tax export (UK / US / Germany) | Live (read-only) | Real download in CSV / PDF / signed-JSON | — |
| Inject a chaos drill | Designed | Honest 503: "Chaos agent deploys Month 9" | Chaos service deploys, Month 9 |
| See live cohort partners | Live | Real count from on-chain (zero today; we don't fake logos) | Partners sign on; count goes up |
| Faucet on signup | Designed | Disabled button with named blocker | Faucet adapter ships alongside the vault, Month 1 Week 2 |
| Notifications inbox | Live | Real events from on-chain | Off-app channels (see [Notification settings and off-app alerts](#notification-settings-and-off-app-alerts)), Month 5 |
| Settings → Wallet tab | Live | Real connected-sites and session-key list | — |
| Settings → Recovery (guardian-based) | Designed | "Recovery — coming Month 8" honest banner | Month 8 |
| Settings → Network / Notifications / Account tabs | Designed | Each shows a "coming Month X" honest banner | Per-tab roadmap |

Nothing in this list is fake. If the contract is not deployed, the button is disabled with the specific reason and the specific month.

## What Atrium charges (fees)

The honest fee answer, by user action, for testnet today and mainnet later.

| Action | Testnet today | Mainnet plan |
|---|---|---|
| Deposit USDC | Free. Atrium does not take a deposit fee. You pay gas, which Atrium sponsors for your first ten actions. | Free. You pay your own gas after the first ten sponsored ops. |
| Withdraw USDC | Free. No protocol fee. You pay gas. | The contract supports a protocol fee, set to 0 by default at launch. If we ever turn it on, we will say so on this page first. |
| Open a position | Free at Atrium's level. The underlying venue charges its own fee (Hyperliquid funding, Aave borrow rate, etc.). Atrium does not add a markup. | Same. |
| Close a position | Same. Free at Atrium's level. Venue charges its own. | Same. |
| Margin recompute (triggered automatically by every action) | Free | Same. |
| Cross-chain transfer | Free at Atrium's level. The bridge charges a LINK fee, which Atrium pays from a reserve on testnet. | The user pays the LINK fee, or Atrium continues to sponsor depending on cohort tier. |
| Sign an agent mandate | Free. No on-chain transaction at signing. | Same. |
| Agent trades on your behalf | Free. The agent pays its own gas. | Same. |
| Revoke a single mandate | Gas only. No protocol fee. | Same. |
| Kill switch (revoke everything) | Gas only. No protocol fee. | Same. |
| Liquidation | When you get liquidated, the liquidator keeper takes a small fee from the collateral seized. This is industry standard (e.g. Aave keeper rewards). | Same. We will publish the exact percentage before mainnet. |
| Verify your own inclusion in proof-of-reserves | Free. Pure read. | Same. |
| Tax export download (CSV / PDF / signed) | Free. The Tablet service charges nothing. | Free during pilot. May charge a small per-export fee for high-volume institutional users. We will say so on this page first. |
| Codex API access (third parties hitting our gateway) | Per-route micropayment in test USDC, configured so a full demo loop costs less than a cent | Same model, with mainnet pricing yet to be set. |

Nothing in this list is hidden. If we ever add a fee not in this table, we add it to the table first and announce it on the changelog page before it goes live.

## What's not yet decided

A short, honest list of open product questions. We do not pretend these are settled.

| Open question | Status |
|---|---|
| Exact mainnet protocol fee schedule | Default zero at launch; will publish before turning anything on |
| Recovery before guardian-based recovery ships | Today: users must set up a second authenticator (see [About account recovery](#about-account-recovery-read-this-before-depositing-real-money)). Long term: guardian flow in Month 8. |
| Off-app notification channels (Telegram, Discord, push, email) | Choice deferred to Month 5. We do not collect email or phone today. Until then, alerts only show inside the app. |
| Agent marketplace ranking and trust signals | Initial trust signals defined in [Choosing an agent](#choosing-an-agent--trust-signals-agent-marketplace). Final ranking algorithm: not decided. |
| Cohort partner deposit threshold | "Meaningful deposit" placeholder. Real number set per-partner during pilot. |
| Mainnet user eligibility / KYC requirements | Not decided. See [Eligibility and disclosures](#eligibility-and-disclosures-mainnet-plan) for the categories we know we will have to handle. |
| Final visual QA for mobile layouts | All reflows (trade, transfer, portfolio, action log, agents, mandate modal, kill-switch dialog) are defined in [Mobile behaviour](#mobile-behaviour). Implementation QA across real devices is pending. |
| Tax export legal liability if our number is wrong | Tablet exports include a disclaimer that they are calculation aids, not tax advice. Liability and dispute process: not decided. |
| Escalation path if support is wrong | Not decided. Today: there is no formal dispute process. |
| Testnet-to-mainnet user migration | Defined in [Migrating from testnet to mainnet](#migrating-from-testnet-to-mainnet). Final cutover date: not decided. |

If you see something missing from this list that should be open, we want to hear about it.

## Getting started (first-time onboarding)

This is the first thing a brand-new user does.

**You arrive.** You land on the public site or click a "try testnet" link from somewhere.

**You see** a hero saying "One wallet. Every venue. One number." and a button that says "Open testnet". You click it.

**You see** the onboarding screen. Five steps along the side: Welcome → Authenticator → Faucet → Margin posted → Done. You're on step 1.

**You read** a short welcome message: "Step inside the atrium. You'll need ninety seconds to set up an authenticator, claim some test money, and post your first hedged position."

**You see** three reassurances:
- No seed phrase (you'll use a fingerprint or hardware key)
- Gas is sponsored for your first few actions
- This is test money — nothing here has real value

**You can choose:** "Set up authenticator" (the main path), or "Skip to app" if you already have a passkey set up.

**You click "Set up authenticator."** Your browser pops up the same fingerprint or hardware-key prompt you'd use to sign into your Apple ID or Google account. You touch your fingerprint reader. The browser creates a passkey scoped to Atrium.

**You move to step 3, the faucet.** You see a table of four drops: 10,000 USDC on Arbitrum, 5,000 USDC on Robinhood Chain, 25 rAAPL (tokenised Apple shares), 3 WETH. Each row says "pending" today, because the faucet ships alongside the vault.

**You can choose:** "Claim faucet" (disabled until the contracts deploy), or "Skip →" to move forward without test money.

**Honest detail:** the page says "Faucet deploys with Coffer (Month 1 W2)" so you know exactly why the button is greyed out. We don't fake a successful drop.

**You move to step 4, "Margin posted."** You see a card that shows your buying power, your collateral, your utilisation percentage, and your headroom. Today this whole card reads "pending" with one honest line: "Plinth · source built · deploy Month 1 W2." Once the margin engine deploys, it shows your real numbers.

**You click "Open portfolio."** You land on your dashboard.

### Behind the scenes

We never see your private key. It lives on your device. We just get the public side of it. There is no seed phrase to lose.

### If something goes wrong

- **Your browser doesn't support fingerprint authentication.** We tell you so directly and recommend a modern browser. No way forward without it.
- **You dismiss the authenticator prompt.** We show you the actual reason your wallet gave us. You can click "Authenticate" again to retry.
- **The faucet isn't live yet.** Button stays disabled with a named explanation. You can skip and come back when contracts deploy.
- **You're on the wrong network.** We show "Switch to Arbitrum Sepolia" and the chain you're currently on.

### What support can do

If you get stuck, support can look up your wallet address and tell you which step you didn't complete. There's nothing they need to do for you — the whole flow is self-serve.

## About account recovery (read this before depositing real money)

Atrium uses passkeys (fingerprint, hardware key) instead of seed phrases. This is more secure for everyday use, but it has a real consequence: **if you lose your only authenticator, you lose access to your wallet.**

Until guardian-based recovery ships (Month 8), the only safe practice is to set up at least two authenticators on two separate devices.

**What you should do today, before depositing anything substantial:**

1. After you finish the passkey setup on device 1 (your laptop, say), open Atrium on device 2 (your phone) and add a second passkey to the same wallet. Most browsers and OS authenticators support cross-device passkey sync (iCloud Keychain, Google Password Manager). Use that.
2. Keep a hardware key (Yubikey, etc.) as a tertiary backup if you can.

**What Atrium will show you:**

Before your first deposit larger than a placeholder amount (real number set before mainnet), Atrium will pop a confirmation: "You have one authenticator set up. Guardian-based recovery ships in Month 8. Until then, lost device equals lost wallet. Do you want to add a second authenticator before depositing?"

You can dismiss this warning at your own risk. We don't block you.

### Behind the scenes

We don't have your key. We can't recover it for you. Guardian recovery, when it ships, lets you appoint trusted people who can collectively help you regain access if you lose all your authenticators.

### What support can do

Today: nothing. Support cannot recover a lost passkey. They will tell you this honestly if you reach out, and direct you to set up a second authenticator before you deposit.

## Putting money in (deposit)

You have a wallet with some test USDC and you want to put it into Atrium so it counts as collateral.

**You go to** the Vault page or the deposit shortcut on your portfolio.

**You see** two cards side by side: Deposit and Withdraw. Big input box, the word "USDC" next to it.

**You type** an amount. The button below says "Deposit 100 USDC".

**You click deposit.** Your wallet pops up. Two prompts happen in sequence:
1. First prompt: "Approve Atrium to spend up to 100 USDC." You confirm.
2. Second prompt: "Deposit 100 USDC into Atrium's vault." You confirm.

**Why two prompts?** This is how every USDC-spending app works on Ethereum. You authorise the contract first, then make the deposit. If you've already authorised enough, we skip the first prompt automatically.

**You see** after the first confirmation: "Approve tx submitted · 0x4a3b…7f29 ↗ — click Deposit again once the wallet confirms." You click again. Your wallet shows the second prompt.

**You see** after the second confirmation: "Deposited. 0x9c2a…d4b1 ↗ · deposit more". The clickable link takes you to a block explorer showing the transaction.

### Behind the scenes

The vault accepts your USDC and credits you with shares — like depositing into a bank account and seeing your balance go up. Your shares are what the margin engine reads when calculating how much you can trade.

### You can choose at any time

- Cancel the wallet prompt (nothing happens)
- Make another deposit (just type a new amount)
- Switch to withdraw
- Leave the page (your deposit isn't lost; it's on-chain)

### If something goes wrong

- **You don't have enough USDC.** Your wallet tells you, before any transaction goes through.
- **The vault is paused** (one of five safety brakes has fired). You see "Coffer paused — see withdrawal SLA" with a link explaining which brake fired and when withdrawals will resume.
- **USDC itself is paused by Circle** (very rare, has happened twice in history). We check this before sending the transaction and tell you "USDC is currently paused — try again later."
- **You reject the prompt.** Nothing happens. The button resets so you can try again.
- **Gas estimation fails.** Atrium's paymaster pays your gas for the first ten actions. After that you pay your own.

### What support can do

Support can read your wallet's deposit history (it's on-chain, public) and confirm your balance. If a deposit looks "missing," it's almost always still on-chain and Atrium just hasn't indexed it yet — support can tell you to wait one or two minutes.

## Before your first trade — Risk Preview

Trading on Atrium with leverage can lose you all your collateral. Before your very first position, Atrium walks you through what could happen.

**When this fires.** The first time you click "Open position" with no positions ever opened on this wallet, a modal appears before the wallet prompt. If you've traded on Atrium before, the modal does not re-appear. You can re-open it at any time from Settings → Account.

**What the modal contains:**

A title: "Before your first trade."

Six short bullets, in plain language:

1. **Leverage can wipe you out.** Margin trading lets you control more than you put in. If the market moves against you, you can lose your full collateral.
2. **Hedging reduces required margin, but not risk.** A long on one venue against a short on another is "hedged" only on paper. If one venue fails or oracles disagree, you can lose money even when you thought you were market-neutral.
3. **Oracles can pause trading.** Atrium uses two independent price feeds. If they disagree by more than half a percent, the system pauses to protect everyone. During a pause, you cannot open or close positions.
4. **Venues can lose liquidity.** A market that was deep yesterday can be empty today. Closing a large position in a thin market costs more than opening it.
5. **Bridges can delay transfers.** Moving collateral across chains uses Chainlink's bridge. Most messages settle in seconds. Some take longer. We surface the wait.
6. **AI agents can only act inside the limits you set, but bad limits still lose money.** A 24-hour-cap of 100 trades is enforced — but if each trade is a bad idea, the cap doesn't save you. Read the agent's profile before approving (see [Choosing an agent](#choosing-an-agent--trust-signals-agent-marketplace)).

A live preview of your specific trade:
- "At your planned size of $1,000 with 3× leverage on HL-HIP3:"
- "If the market moves -5%, your buffer becomes $850. Healthy."
- "If the market moves -10%, your buffer becomes $700. Closer to liquidation."
- "If the market moves -15%, liquidation begins."

A button: "I understand. Open position." (no I-agree checkbox theatre — the consent is the button click).

A secondary button: "Cancel — go back."

### Behind the scenes

The buffer math is the same calculation the margin engine uses; we just run it client-side for the preview. The risk text is static and the same for every user. Atrium does not pretend to give personalised investment advice.

### You can choose

- Open the position
- Cancel and go back
- Reduce your size before opening (preview updates live)
- Add more collateral first (deposit shortcut button)

### What support can do

Nothing — this is education, not a support interaction. Support can re-explain the same content if you contact them later, but the modal is the canonical source.

## Opening a position

You have collateral in Atrium and want to take a position somewhere.

**You go to** the Trade page.

**You see** seven venue chips at the top (Hyperliquid, Aave, Pendle, Curve, Trade.xyz, Polymarket, Hyperliquid HIP-4), each with the venue's name, type, and current haircut. You can pick one.

**You pick a venue.** The middle column shows the order form. The right column shows a live order book (if the venue exposes one). The left column shows the margin impact panel — how this trade will change your buying power.

**You set up your trade:**
- Long or short (two big buttons, green or red)
- Size in USDC (text input)
- Leverage (a slider from 1× to 20×)
- Slippage tolerance shows as "0.10% · default" so you know it's not configurable yet

**You see** the margin impact updating live as you type:
- Initial margin needed (how much collateral this locks up)
- Maintenance margin (the floor before liquidation kicks in)
- Liquidation buffer (how far the market can move against you before you get liquidated)
- "From Plinth · simulated" caption so you know whether the math is live or pending

**You click "Open long · market".** If this is your very first trade ever, the [Risk Preview](#before-your-first-trade--risk-preview) modal appears first. After you click through it, your wallet pops up. You confirm. You see "Submitting…" and then a transaction link.

### Behind the scenes

Atrium routes your order to the right venue's adapter, the adapter opens the position, and the margin engine recomputes your total required margin across all your positions at once. If you're hedged across venues, the margin engine nets them and you free up collateral.

### You can choose at any time

- Cancel before signing
- Switch venues (the form resets per venue)
- Adjust size or leverage
- Open multiple positions in a row

### If something goes wrong

- **The venue's adapter isn't deployed yet.** Submit button stays disabled with a helpful line: "venue adapter is not deployed on this network yet."
- **You typed a zero or negative size.** Button does nothing; you see "enter a positive size."
- **Your collateral is insufficient.** Transaction reverts with "deposit more or reduce size." A "Top up" shortcut appears (see [Topping up](#topping-up-when-you-are-close-to-liquidation)).
- **The price oracle is stale or two oracles disagree by more than 50bps.** The margin engine pauses itself and your trade reverts. You see a status banner saying the engine is paused and why.
- **The venue itself is having issues** (oracle depegged, paused). We catch this before sending and show a "venue down" notice.

### What support can do

Support can pull your account health, see the last few transactions, and look at the alert feed to tell you which subsystem is having a problem. If a venue adapter is broken, the team can disable it for everyone.

## Topping up when you are close to liquidation

The market moved against you. Your buffer is below the green zone.

**You see** on your portfolio:
- Liquidation buffer panel drops below the green zone (it turns amber, then red)
- A banner appears at the top of the page: "Buffer at 12%. Top up to avoid liquidation."
- A "Top up" button next to the banner
- If you have notifications wired (Month 5), an in-app push fires

**You click "Top up."** A deposit modal appears, pre-filled with a suggested amount that would restore your buffer to a safe level (say, back to 30% buffer).

**You see** the modal:
- Suggested amount input (editable; you can override)
- Live preview: "Depositing $X will restore your buffer to Y% — safe."
- Standard deposit two-prompt flow as in [Putting money in](#putting-money-in-deposit).

**You confirm both prompts.** Deposit lands. Buffer updates. Banner clears.

### Behind the scenes

We compute the minimum deposit that would restore a healthy buffer at your current price. We don't compute a minimum that just barely avoids liquidation — that would leave you exposed to the next tick. We default to a comfortable buffer.

### You can choose

- Accept the suggested amount
- Type a different amount
- Skip top-up and instead close some positions (close-shortcut button below the modal)
- Ignore the warning entirely

### If something goes wrong

- **Vault is paused (a safety brake fired).** Top-up button shows "Coffer paused — see SLA." You cannot deposit until the brake clears. Closing positions is still available.
- **You don't have enough USDC in your wallet to top up.** Standard insufficient-funds wallet error.
- **Liquidation fires while you're filling out the modal.** Modal closes; portfolio updates with the liquidation event. You see a notification.

### What support can do

Support can explain your current buffer and the last known on-chain price state, but cannot promise how much time you have before liquidation — markets can move at any speed. They cannot pause liquidation on your behalf; keepers act when conditions are met.

## Looking at your portfolio

After you've deposited and maybe opened a position, the portfolio page is your home base.

**You see** at the top: four big numbers — total account value, total required margin, total notional exposure, 24-hour P&L. Today the 24-hour P&L shows "—" because we haven't wired the price-history feed yet, and we say that honestly rather than fake a zero.

**You see** two cards in the next row:
- **Margin engine** — a breakdown of where your collateral sits, with a small bar chart per source. Below it, a "liquidation buffer" panel showing how much room you have before automatic liquidation kicks in.
- **Buying power** — your buying power over the last 30 days, drawn as a line.

**You see** below those, your open positions table:
- One row per position
- Pill filter at the top (All / HL / Aave / Pendle / PMK) — clicking one filters the table
- Columns: instrument, venue, size, notional, entry · mark, P&L, and a Close button

**Honest detail:** today the "Mark" and "P&L" columns read "—" with a tooltip "mark price pending oracle." Once the oracle is wired, they fill with live values. We never show "$0.00 P&L" as if that's a measurement.

**You see** on the right side: an activity rail. Recent events from your account — margin recomputes, position opens, mandate validations. Each event has a timestamp and a link to a block explorer if there's a transaction.

### You can choose

- Click Close on any row to close that position
- Click an open-position venue label to filter the table
- Click "View all" on the activity rail to see the full timeline
- Use the header buttons: "Open position" goes to Trade; "Deposit" goes to Vault

### If something goes wrong

- **An indexer is lagging.** You see slightly stale numbers; we don't usually call this out unless it gets bad.
- **You have a position that won't close because the venue has no liquidity.** See [Emergency close](#emergency-close-when-the-venue-has-no-liquidity) for that path.

### What support can do

Support can read everything you see, plus the raw on-chain data. They can confirm what the system thinks your account looks like, in case the UI shows something stale.

## Choosing an agent — trust signals (agent marketplace)

Before you sign a mandate giving an agent permission to trade for you, you should be able to inspect the agent.

**You go to** the Agents page → Marketplace tab.

**You see** a leaderboard of registered agents, sorted by 7-day P&L by default. You can re-sort by Sharpe ratio or AUM. Each row shows:

- Agent address (with an ENS name if one exists)
- Status badge (running / paused / revoked)
- Strategy label (a free-text string the agent sets — "volatility arbitrage", "delta-neutral basis trade", etc.)
- 30-day P&L sparkline
- 7-day P&L (with up/down/flat colour)
- Sharpe ratio
- AUM (assets currently being managed across all followers)
- Copier count (how many users have ever delegated to this agent)
- A "Delegate" button per row that takes you to the mandate flow with the agent address pre-filled

### Each agent has a profile page

**You click an agent row.** You go to that agent's profile.

**You see:**
- All the leaderboard fields, expanded
- **Data source badge** — "Live trades on Sepolia" (real on-chain history) vs "Backtest only — synthetic data" vs "Backtest only — real trades." This badge is critical. Backtests on synthetic data are explicitly marked unpublishable in our research pipeline; they appear on the profile but with a banner: "Numbers below are from synthetic-pair backtesting and are not a real trading record."
- **Max drawdown** — largest peak-to-trough loss in the agent's history
- **Venues used** — chips for each venue the agent has actually traded on
- **Average trade size** — calibrates the scale this agent operates at
- **Failure/revert rate** — what percentage of the agent's transactions reverted (an honest signal: high revert rate means the agent makes bad calls that Sigil's caps catch)
- **Mandate cap envelope** — the smallest and largest caps any current follower has set for this agent
- **Deboost status** — if the agent has ever been deboosted by the curator team for misbehaviour, a clear amber banner with the reason hash
- **"What this agent will be able to do if you approve it"** — a worked example: "If you grant a $500 total cap, $50 per-action cap, and approve HL-HIP3 + AAVE, this agent will be able to: open and close perp positions on Hyperliquid HIP-3 up to $50 each, take Aave borrows up to $50 each, and never hold more than $500 in total open notional. It cannot touch Pendle, Curve, Trade.xyz, Polymarket, or Hyperliquid HIP-4 with these settings."

### Behind the scenes

The leaderboard data comes from on-chain action history indexed by the subgraph. The "data source" badge is set by the agent's own backtest claim, which is verified against an on-chain hash. Backtests on synthetic data are marked unpublishable at the source by the research pipeline; we do not allow them to be claimed as a real trading record.

### You can choose

- Sort the leaderboard differently
- Open any agent's profile
- Delegate to the agent (jumps to [Handing a budget to an AI agent](#handing-a-budget-to-an-ai-agent-signing-a-mandate) with the address pre-filled)
- Walk away

### If something goes wrong

- **Subgraph hasn't indexed the agent yet.** Profile shows "Indexing pending — try again in a minute."
- **Agent has zero history.** Profile shows "New agent — no live trades yet." All performance numbers display "—". You should think twice before delegating to a brand-new agent.
- **Agent's backtest claim is synthetic and they're trying to pass it off as real.** The data-source badge will catch it; the page will show the "synthetic data — not a real trading record" banner.

### What support can do

Support can look up an agent's full action history, the curator deboost log if any, and walk through whether the agent is operating as their profile claims. They cannot tell you whether to delegate — that's your decision.

## Closing a position

You're done with a position and want out.

**You click Close** on a row in your portfolio.

**You see** the button change to "…" while we resolve the right adapter for that venue. Then your wallet pops up. You confirm.

**You see** the row update to "closed ↗" with a link to the closing transaction.

### Behind the scenes

We call the venue's adapter to close the position, the venue returns whatever realised P&L you made (or lost), and the margin engine recomputes your free collateral.

### You can choose at any time

- Cancel the wallet prompt
- Close multiple positions back-to-back
- Use the [Emergency close](#emergency-close-when-the-venue-has-no-liquidity) path if normal close doesn't work

### If something goes wrong

- **The venue has no liquidity to close into.** The transaction reverts. UI offers the emergency partial close path (next section).
- **The adapter is paused.** The Close button still shows but the transaction reverts with a clear reason.

### What support can do

If a close stays stuck, support can run an emergency force-close through the timelocked admin path — but that takes 48 hours. Usually they direct you to the emergency close UX.

## Emergency close (when the venue has no liquidity)

Sometimes a venue has no buyer for what you're trying to sell. Normal close reverts. You need an alternative.

**You see** when normal close fails: a new banner appears below the failed row.

> Normal close failed — venue has no liquidity for the full size. You can use the emergency partial close: this closes you at whatever price the venue offers, taking whatever loss the thin market produces. Worse price, but you get out.

**You see** a button: "Use emergency partial close."

**You click it.** A confirmation modal:

> Emergency close. The safety bot will close up to 10% of this position per block at the best available price on the most-liquid leg of the venue. You may lose more than market price because the venue is thin. Continue?

**You confirm.** Your wallet pops up. You confirm. The safety bot fires.

**You see** the row update across several blocks as partial closes land:
- "Closing… 10% / 90% remaining"
- "Closing… 20% / 80% remaining"
- and so on until fully closed

**You see** the final realised P&L and a transaction link per partial.

### Behind the scenes

The safety bot is the same one that handles liquidations. It's used here as a manual escape hatch when the normal close path is blocked. Each partial is capped at 10% per block to protect the venue from a sudden dump.

### You can choose

- Confirm and let it run
- Cancel the modal
- Wait for liquidity to return on the venue and try normal close later
- Contact support for a force-close (48-hour timelocked, last resort)

### If something goes wrong

- **The safety bot is paused.** Banner says "Vigil paused — see SLA." Try normal close, or wait.
- **Partial close hits a worse price than expected.** This is the nature of a thin market. We surface the actual realised price per partial.

### What support can do

Confirm whether the venue is genuinely dry or whether something else is blocking. If genuinely dry, walk you through the emergency close. If something else, escalate to the team.

## Moving money between chains

You have USDC on Ethereum, Polygon, or another chain, and you want to use it as collateral on Atrium (which lives on Arbitrum).

**You go to** the Transfer page.

**You see:**
- Two big chain cards: "From" and "To"
- A swap button between them to flip the direction
- A token picker (USDC default)
- An amount input
- A quote panel showing estimated time, bridge fee, and gas fee

**You pick:**
- Source chain (e.g. Polygon)
- Destination chain (Arbitrum Sepolia)
- Token (USDC)
- Amount

**You see** the quote update: "Estimated 8 seconds · $0.00 fee · gas sponsored by Atrium."

**You click Transfer.** Your wallet pops up. You confirm. The transfer step timeline below the form updates in real time:
1. **Signature submitted** (checkmark)
2. **Source commit · Aqueduct** (checkmark when confirmed on source chain)
3. **CCIP message in transit** (spinning, then checkmark)
4. **Destination finalised** (checkmark when arrives on destination)

### Behind the scenes

Atrium uses Chainlink's official cross-chain bridge to move your USDC. When the message arrives on the other side, your collateral on Arbitrum goes up.

### You see

After settlement: "32 blocks between source commit and dest settle" — a real measurement. No fake "8.4 seconds" that the page shows for every transfer regardless of how long it actually took.

### You can choose

- Cancel before signing
- Swap the direction
- Pick a different token
- Watch the timeline live

### If something goes wrong

- **The bridge is out of LINK tokens** (the fee currency). Atrium tops it up but if it runs out, transfers pause. You see "LINK reserve low — transfers pausing temporarily."
- **The CCIP message expires before arriving** (rare; happens if the destination chain is congested). You get a "Claim back" button to recover your money on the source chain.
- **You pick "To" and "From" as the same chain.** We block it with "from and to must be different chains."
- **You sent to a chain that isn't supported.** The transfer fails before submission.

### What support can do

Support can read the bridge message ID, follow it on Chainlink's CCIP explorer, and tell you where the message is in its lifecycle. If a bridge incident occurs, support can escalate it to the team and explain the recovery path (claim-back on source, or reserve refill) if either applies. Funds are never custodial inside Atrium during a CCIP transfer; the standard recovery paths are Chainlink-defined.

## Handing a budget to an AI agent (signing a mandate)

You want an AI bot to trade on your behalf, but with hard limits.

**You go to** the Agents page → My mandates tab.

**You see** four tabs at the top of the page: Marketplace (covered in [Choosing an agent](#choosing-an-agent--trust-signals-agent-marketplace)), My mandates, Session keys, Action log.

**You click "+ New mandate"** at the top right. A modal opens.

**You fill in the form:**
- **Agent address** — the wallet address of the bot you're authorising. If you came here from the Marketplace by clicking Delegate on an agent's row, this field is pre-filled.
- **Per-action cap** — the largest single trade the bot can make (default $50)
- **Total open cap** — the largest total notional the bot can have open at any time (default $500)
- **Actions per day** — how many trades per 24 hours (default 24)
- **Expires in** — how many days until this permission auto-revokes (default 14)
- **Venues allowed** — a row of chips. Click to toggle. The bot can only trade on the venues you check.

**You click "Sign mandate".** Your wallet pops up showing a structured permission slip — not a confusing hex string. You sign it.

**You see** a success message: "Mandate signed. Intent hash: 0xabcd…5f12 — share the hash with the agent. They reference it on every action they take under your scope."

**Important:** Until our mandate storage layer ships (Month 1 Week 2), Atrium does not store the signed envelope centrally for you. The intent hash is shown to you in this success message and emailed nowhere. **Copy it down or screenshot it before closing the modal.** Once storage ships, you'll be able to look up any past mandate by your wallet address.

### Behind the scenes

Atrium does NOT put your mandate on-chain when you sign it. Your signature lives off-chain; it only gets verified on-chain when the agent actually tries to trade. This is how the system stays cheap and how revoking is instant — the agent simply can't use a revoked mandate.

### You can choose

- Hand the intent hash to the agent (paste into their chat, their config, whatever)
- Edit and re-issue (no in-place edits — issue a new one, revoke the old)
- Cancel before signing

### If something goes wrong

- **You typed an invalid agent address.** Form rejects with "Agent address must be 0x-prefixed 40-hex."
- **You typed the zero address.** Rejected — it would brick revocation.
- **You picked too many venues.** Max is 8 (a contract limit). Form caps you.
- **You set total cap lower than per-action cap.** Rejected with "total open cap must be ≥ per-action cap."
- **You reject the wallet signature.** Modal stays open. Try again.
- **Sigil contract is not deployed yet.** Modal shows "Sigil is not deployed on this network — mandate signing lights up Month 1 W2."
- **You lost the intent hash before storage ships.** No way to recover it. Re-issue a fresh mandate.

### What support can do

After mandate storage ships (Month 1 Week 2), support can look up all the mandates you've signed (by your wallet address), tell you which ones are still active, and walk you through revoking them. Until then, support cannot recover a lost intent hash — you have to re-issue.

## Revoking a single mandate

You decide one specific agent should not have permission to trade for you any more, but you want to keep your other mandates active.

**You go to** the Agents page → My mandates tab.

**You see** a list of every mandate you've signed that is still active. Each row shows:
- Agent address (truncated)
- Intent hash (truncated)
- Issued date
- Caps (per-action and total)
- Venues allowed (small chips)
- A Revoke button per row

**You click "Revoke"** on the row you want to cancel.

**You see** a confirmation dialog:

> Revoke mandate for agent 0xabcd…3f29? This agent will lose access to:
> - Open new positions on HL-HIP3, AAVE-V3 (or whatever venues you allowed)
> - Up to $500 in total notional (whatever cap you set)
> - 24 trades per day (whatever cap you set)
>
> Existing positions opened under this mandate remain open. You can close them yourself from the Portfolio page.
>
> Continue?

**You click Continue.** Your wallet pops up. You sign one transaction.

**You see** the row update to "revoked ↗" with a link to the revocation transaction. The row sticks around (greyed out) for 24 hours so you have a record, then drops off.

**You also see** a new entry in the Action log tab: "Mandate revoked · agent 0xabcd…3f29 · intent 0xabcd…5f12."

### Behind the scenes

The mandate verifier contract records the revocation. The next time the agent tries to trade under this intent hash, the transaction reverts with "intent revoked." The agent's session key tied to this mandate is also marked as cancelled.

### You can choose

- Cancel the dialog and leave the mandate active
- Confirm the revoke
- Revoke multiple mandates back-to-back
- Use [the Kill Switch](#the-kill-switch-revoke-every-agent-and-session-key-in-one-click) instead if you want to revoke everything in one shot

### If something goes wrong

- **You revoke an already-revoked mandate.** Transaction reverts harmlessly with "already revoked."
- **Sigil contract is paused.** Revoke transaction reverts. The kill switch path uses a different code path that survives Sigil being paused — try that.
- **You reject the wallet prompt.** Mandate stays active.

### What support can do

After storage ships, support can show you every mandate you've signed and walk you through revoking specific ones.

## An agent trades on your behalf

An AI agent has your mandate. It wants to take a position.

**You see** (on the Action log tab of Agents) a new row appearing the moment the agent acts:
- Timestamp
- Agent address
- Action ("Opened HL-HIP3 long $50")
- Mandate it used (intent hash, short form)
- Block explorer link

**You don't have to do anything.** The agent acts within the boundaries you set. You only need to do something if you want to revoke or change those boundaries.

### Behind the scenes

Every time the agent tries to act, Atrium checks five things:
1. Is the mandate still valid (not revoked)?
2. Has the action 24-hour quota been hit?
3. Is this venue in your allow-list?
4. Is the trade size within the per-action cap?
5. Will the new total open exposure still be under the total open cap?

If any check fails, the trade reverts. The agent learns. You don't pay for it.

### You can choose any time

- Watch the Action log
- [Revoke this specific mandate](#revoking-a-single-mandate) (one click on My mandates tab)
- Revoke everything the agent ever did ([the Kill Switch](#the-kill-switch-revoke-every-agent-and-session-key-in-one-click))
- Adjust caps by issuing a new mandate and revoking the old

### If something goes wrong

- **Agent tries something out of bounds.** Transaction reverts. You see it on the Action log with the reason ("ExceedsPerActionCap" or similar). Your money is untouched.
- **Agent's session key is revoked.** Trade can't even start.
- **Mandate expired.** Same — the agent can't trade.

### What support can do

If you suspect an agent is misbehaving, support can read your full action history and help you decide whether to revoke one mandate or kill everything.

## When you're close to liquidation

The market moves against you. Your buffer shrinks. This is covered as a UI flow above; here is the trigger behaviour.

**You see** on your portfolio:
- Liquidation buffer panel drops below the green zone
- 24-hour P&L tile (when live) shows red
- Top banner with "Top up" shortcut (see [Topping up](#topping-up-when-you-are-close-to-liquidation))
- A notification fires (in-app today; off-app channels once [Notification settings and off-app alerts](#notification-settings-and-off-app-alerts) ships)

**You can choose:**
- Top up via the [Topping up](#topping-up-when-you-are-close-to-liquidation) flow
- Close one or more positions to reduce required margin
- Take it on the chin and let liquidation happen

### What support can do

Support can confirm your numbers and explain what's about to trigger. They cannot pause a liquidation on your behalf — the system is non-custodial and the keeper bots act when conditions are met.

## If you get liquidated

The market moved enough that your collateral fell below the maintenance threshold. A liquidator bot fires.

**You see** on your notifications inbox: "Liquidation triggered — Vigil started a partial liquidation on your account" with a transaction link.

**You see** on your portfolio: one or more of your positions is now smaller (or closed entirely). Your collateral has dropped by the liquidation amount plus a small keeper fee.

### Behind the scenes

Atrium's safety bot (three independent keepers, racing to be first) closes part of your position — never the whole thing in one block. The cap is 10% of the position per block, hitting the most-liquid venue first. This protects you from a catastrophic single-block close.

### You can choose

- Add collateral now to stop further liquidations ([Topping up](#topping-up-when-you-are-close-to-liquidation))
- Close the remaining position yourself
- Do nothing and let further partial liquidations happen if the market keeps moving

### If something goes wrong

- **All three keepers are offline.** Your account stays in danger until one comes back. This is rare and we monitor for it; on testnet there's no real money at risk.
- **The price oracle is stale during a liquidation attempt.** Transaction reverts. The keeper retries when fresh data arrives.

### What support can do

Support can pull the liquidation event, the price snapshots, and walk you through what happened. If the team finds a bug, the timelocked admin path can force-close stuck positions — but this is 48-hour delayed and a last resort.

## The Kill Switch (revoke every agent and session key in one click)

Something has gone wrong. Maybe you suspect an agent has been compromised. Maybe a session key has been leaked. You want to cut everything.

**Honest status today.** The kill-switch button is **disabled** with the named blocker "Safety contracts deploy Month 1 W2." No wallet transaction is requested before that date — we don't ask a user to sign something that we already know will revert. The confirmation dialog (the text below) is previewable inside [the 90-second judge walk](#the-90-second-judge-walk-verifier-mode) as a UI preview only; clicking "Confirm" in the preview surfaces the same disabled-blocker message and never opens the wallet.

Once the safety contracts deploy, the full flow described below goes live.

**You go to** the Kill Switch shortcut on the Agents page (or step 7 of [the 90-second judge walk](#the-90-second-judge-walk-verifier-mode)).

**You see** a single red button: "Kill switch · revoke all".

**You click it** (post-deploy). A confirmation dialog appears:

> Kill Switch: revoke every mandate AND cancel every active session key for this wallet. This cannot be undone with the same keys. Continue?

**You confirm.** Your wallet pops up. You sign one transaction. That single transaction:
- Revokes every active agent mandate you've issued
- Cancels every Postern session key tied to your wallet

**You see** a success message with a transaction link.

### Behind the scenes

Atrium walks through every agent you've mandated and revokes each one — wrapped in a try/catch so that if any single revocation fails, the others still go through. Then it tells the session-key registry to mark all your keys as cancelled.

### You can choose

- Confirm and revoke everything
- Cancel the dialog and revoke nothing
- Re-issue specific mandates afterward (you'll need to sign new ones)

### If something goes wrong

- **You have no active mandates.** Button shows "nothing to revoke."
- **One specific agent revocation fails** (very rare — happens if Sigil paused mid-flight). The others succeed; the failure is logged so the team can re-run that one.
- **Safety contracts not deployed yet.** Button is disabled with the named blocker; no wallet prompt fires.

### What support can do

In a serious security incident, the admin team can mass-revoke on your behalf — but this is timelocked 48 hours. Self-serve kill switch is the fast path once the contracts deploy.

## Taking money out (withdraw)

You're done. You want your USDC back.

**You go to** the Vault page.

**You see** the Withdraw card alongside Deposit. Input box for shares to redeem.

**You enter** a share amount. Click "Withdraw N shares."

**Your wallet** pops up. You confirm. You see a transaction link.

### Behind the scenes

Atrium redeems your shares for USDC and sends them to your wallet in the same block (about 250 milliseconds on Arbitrum) — assuming no safety brake has fired.

### You can choose

- Withdraw all, or partial
- Cancel before signing

### Withdrawal SLA — five safety brakes

| Condition | What happens |
|---|---|
| Normal operation | Withdrawal settles in one block |
| Vault drops more than 30% in one block | Withdrawals pause until the team reviews (48h max) |
| Price oracles disagree | Withdrawals pause until they agree again |
| USDC itself is paused upstream | Withdrawals pause until Circle unpauses |
| Many agent mandates queued for revocation | New mandates pause; withdrawals continue |
| Many liquidations queued | New positions pause; withdrawals continue |

**You see** the relevant brake status on the SLA page (linked from the withdraw card).

### If something goes wrong

- **A brake has fired.** You see why, and roughly when withdrawals will resume.
- **You have open positions requiring this collateral.** Transaction reverts. You need to close positions first.
- **USDC paused by Circle.** Honest pause notice.

### What support can do

When a brake fires legitimately, support can point you at the on-chain attestation explaining why. They cannot bypass the brake — it's there for a reason.

## Tax export

You want a CSV or PDF of your taxable events for your accountant.

**You go to** the Tax page.

**You see:**
- Jurisdiction picker (United Kingdom / United States / Germany) — pick one
- Year picker (2024 / 2025 / 2026)
- A form indicator (CGT · SA108 for UK, Form 8949 for US, FIFO · § 23 EStG for Germany)
- Four stat tiles at the top: total proceeds, cost basis, realised gain, tax owed estimate. Sub-labels are jurisdiction-aware (the wording for UK explains the HMRC matching rule, US says FIFO IRS default, Germany says FIFO § 23 EStG).
- An allowance progress bar showing how close you are to your annual exemption (£3,000 for UK, €1,000 for Germany Sparer-Freibetrag, US has no equivalent exemption)
- A table of realised events sorted newest first
- Three download buttons: CSV, PDF, Signed export
- A disclaimer footer: "Atrium is not a tax advisor. This export is a calculation aid intended for review by a qualified accountant. The signed Merkle root proves the export was produced from the same dataset that Lantern attested for the relevant block."

**You change jurisdiction or year.** The whole page updates. The stats refetch. The events table refetches.

**You click "⇣ CSV"** (or PDF or Signed export). Your browser downloads the file with the right filename ("atrium-uk-cgt-0x1a3b.csv").

### Behind the scenes

Atrium computes your cost basis per the jurisdiction's accounting method, runs it across your trade history, and produces a download. The signed export embeds the latest Lantern Merkle root so an auditor can verify the underlying balances came from a real on-chain snapshot.

### You can choose

- Switch jurisdiction at any time
- Download in any of the three formats
- Pass the signed export to your accountant for an auditor-grade record

### If something goes wrong

- **The tax service isn't reachable.** Stats show "—" with a "pending" caption. Try again later.
- **You ask for a year before 2020 or after 2099.** Rejected at the boundary.
- **Atrium ships you an empty CSV** (Scribe is down) — we refuse rather than fake it. You see an error message explaining what happened. We will never silently understate your tax exposure.

### Liability and dispute path (open question)

If a number in your export turns out to be wrong, you have two remedies today and one open question:

- **Re-run.** Support can reproduce a bit-identical export with the same Lantern Merkle root as proof of source data. If our number was right and your accountant disagreed, the proof clarifies.
- **Manual amendment.** You and your accountant can produce a corrected version off-platform. The Atrium export is a starting point.
- **Open:** liability if our export is materially wrong is not yet defined. This is on the list in [What's not yet decided](#whats-not-yet-decided).

### What support can do

Support can re-run your export, and if you have a dispute, they can produce a bit-identical re-export with the same Lantern Merkle root as proof.

## The 90-second judge walk (Verifier Mode)

This is the demo path. Anyone can run it. It's a 7-step walkthrough showing every major Atrium capability end to end.

**You go to** `verify.atrium.fi` (or the verifier route in the app).

**You see** seven step pages: each one shows you a single button, an explanation, and a Kani CI badge at the top right. You go through them in order.

**Step 1 — Deposit USDC.** Pending until Coffer deploys (Month 1 W2). Today the button shows the named blocker and no wallet prompt fires. After deploy, clicking opens the wallet, you confirm, and the step returns a block explorer link.

**Step 2 — Open a hedged position.** Currently shows "pending — Plinth deploys Month 1 W2." Will go live once Plinth is deployed.

**Step 3 — Trigger a margin recompute.** Same as step 2.

**Step 4 — Inject chaos: oracle drift.** You click. The system reports honestly "PRAETOR_CHAOS_URL not configured. Chaos agent deploys Month 9." No fake success.

**Step 5 — Trigger a liquidation via the safety bot.** Pending — Vigil deploys Month 1 W2.

**Step 6 — Verify your balance against the proof-of-reserves.** You click. If no attestation has been published yet, you see "no attestation published yet" honestly. Once cron starts, you see a real verification.

**Step 7 — Kill switch.** Preview-only until safety contracts deploy (Month 1 W2). Today the button shows the named blocker; the confirmation dialog can be previewed but no wallet transaction is requested (matches [The Kill Switch](#the-kill-switch-revoke-every-agent-and-session-key-in-one-click)). After deploy, confirming fires one wallet transaction that revokes every mandate and cancels every session key for your wallet, with a block explorer link.

**You finish.** Total time: about 25 to 70 seconds depending on chain finality.

**Backup plan:** if `verify.atrium.fi` is unreachable on demo day, we have a pre-recorded video + QR code to a mirror, per the design rules.

### What admin/team can do

Before judge day, the team runs ten chaos rehearsals injecting random faults (oracle drift, keeper offline, Wi-Fi drop). Acceptance: at least nine of ten finish under six minutes with no judge-facing surprise.

## Looking at notifications

**You go to** the Notifications page.

**You see** a list, newest first:
- "Liquidation triggered" (red badge) with details and a transaction link
- "Mandate revoked" (yellow badge) showing which agent and which intent
- "Lantern attestation published affecting your balance" (info badge)
- "Withdrawal SLA breach" (yellow badge) if a brake fired during your withdrawal
- "Buffer below 20%" (amber badge) when liquidation is approaching

**You see** for each row: title, short context, time, and (if applicable) a block explorer link.

### Behind the scenes

Atrium reads on-chain events that mention your wallet, sorts them by real timestamp (not by human "5 minutes ago" string — that sort would be lexical and wrong), and presents them.

### You can choose

- Click through to any transaction
- Filter by type (when filter is wired)
- Configure off-app delivery channels — see [Notification settings and off-app alerts](#notification-settings-and-off-app-alerts)

## Notification settings and off-app alerts

Liquidation warnings inside the app only help if you have the app open. Real users need off-app alerts so they get warned before they get liquidated.

**Honest status:** off-app channels ship in Month 5. Until then, alerts are in-app only. We do not collect email or phone today, by design.

**You go to** Settings → Notifications (today: shows "coming Month 5" honest banner).

**Once it ships, you will see:**

| Channel | Today | Month 5 | Privacy note |
|---|---|---|---|
| In-app inbox | Live | Live | No PII required — your wallet address is the identifier |
| Push notification (browser / PWA) | — | Available | Browser-controlled; no email or phone |
| Telegram bot | — | Available | You give us a Telegram chat ID; nothing else |
| Discord webhook | — | Available | You give us a webhook URL; nothing else |
| Email | — | Optional | If you opt in. We will store only the email and the wallet it ties to. |
| SMS | — | Not planned | Privacy and cost reasons |

**For each event type, you will be able to set the channel:**

| Event | Default channel |
|---|---|
| Liquidation triggered | All channels you have enabled (this is the loudest) |
| Buffer below threshold (default 20%) | All channels |
| Mandate revoked | In-app only |
| Withdrawal SLA brake fired | All channels |
| Proof-of-reserves attestation published | In-app only |
| Agent action (per-trade) | In-app only (otherwise it would be noisy) |
| Daily agent summary | Push, Telegram, Discord, Email if enabled |

**You also set thresholds:**

- Buffer warning threshold: default 20%. You can lower to 10% or raise to 30%.
- Agent action: per-trade vs daily summary
- "Quiet hours" (when push notifications are suppressed)

### Behind the scenes

Off-app alerts will be fired by a small worker that watches the on-chain event stream and dispatches to the channels you've configured. Atrium does not store your wallet's transaction history just to send alerts; alerts are computed on the fly from the public on-chain feed.

### What support can do

After this section ships, support can confirm whether an alert fired and was dispatched, but they cannot resend a missed alert (the channel providers do not provide replay).

## Connected sites and session keys (settings)

**You go to** Settings → Wallet (default tab).

**You see:**
- Your connected smart wallet address (truncated)
- Chain context (arb-sepolia · rh-chain)
- Gas sponsorship status (the first ten of your actions are sponsored)
- A list of "connected sites" — dapps that have asked for permission via Postern
- A row per session key currently active, with an issuance time and a Revoke button

**You can choose:**
- Click "Disconnect" on any connected site
- Click "Revoke all" to disconnect every site at once
- Revoke individual session keys
- Switch to Session keys, Recovery, Network, Notifications, or Account tabs

### Settings tabs status

- **Wallet** — live today
- **Session keys** — shows "Postern session-key indexing pending" until the indexer entity ships
- **Recovery** — pending (Month 8)
- **Network** — pending (Month 3)
- **Notifications** — pending (Month 5; see [Notification settings and off-app alerts](#notification-settings-and-off-app-alerts))
- **Account** — pending (Month 4)

Each pending tab shows an honest banner explaining when the work ships, instead of a working-looking shell.

### What support can do

Support can list your active session keys and walk you through revoking them. For social recovery (when it ships), they help you initiate the guardian flow.

## Mobile behaviour

Atrium is designed for mobile from the start. Every screen reflows; complex layouts collapse into stacks or cards. Touch targets are at least 44px. No horizontal page scrolling. Chip and tab rows may scroll horizontally when clearly indicated.

### Per-screen mobile behaviour

**Landing page.** Same content, stacked. Hero compresses; section CTAs become full-width buttons.

**Onboarding stepper.** Vertical step rail at top instead of side. Same flow.

**Vault (deposit / withdraw).** Two cards stack vertically. Input fields stay full-width.

**Trade page.** Three-column desktop layout (form / book / impact) collapses to: venue chips at top (horizontally scrollable), then order form full-width, then order book in a collapsible accordion, then margin impact panel full-width below. The user can collapse the book to see more of the impact panel.

**Portfolio page.** Stat row becomes two-by-two. Margin engine + buying power cards stack. The positions table becomes a list of cards, one per position, with the Close button at the bottom of each card. The activity rail moves below the main content rather than to the side.

**Cross-chain transfer.** From/To chain cards stack vertically. The swap-direction button sits between them. The step timeline is unchanged but takes the full width.

**Agents page.** The four tabs become a horizontally-scrollable pill bar at the top. Each tab's contents are as on desktop but with table-to-card collapse for the marketplace and action log.

**Mandate modal.** Same content, but the venues-allowed chip grid wraps to two or three columns instead of four. The signature confirmation in the wallet remains the same.

**Kill switch confirmation dialog.** Full-screen on mobile (no half-modal). Same copy. The red button is large enough to thumb-tap by mistake — so we move it below the cancel button and keep the wallet prompt as the irreversible step.

**Action log.** Tabular on desktop. Becomes a vertical timeline on mobile: each event is a card with a timestamp, agent address, action, and link.

**Reserves page.** Latest attestation card and Merkle visualisation stack. The "Verify my inclusion" button stays prominent.

**Tax page.** Jurisdiction and year pickers stack at the top. Stat row becomes two-by-two. Events table becomes a list of cards. Download buttons full-width.

**Settings.** Tab bar becomes a horizontally-scrollable pill row.

### Touch and gesture rules

- Minimum touch target: 44×44 px
- No multi-finger gestures required for any flow
- Swipe-to-dismiss available on modals, but never as the only way to dismiss (Cancel button always present)
- No horizontal **page** scrolling. The main content always stacks instead of overflowing the viewport.
- Horizontal **chip and tab rows** are allowed where clearly indicated as scrollable (with a soft fade on the right edge to signal there's more, and ample finger-target spacing). This is the only horizontal-scroll exception, and it's used for: venue chips on Trade, agent-tab pills on Agents, and settings-tab pills on Settings.

### Behind the scenes

Atrium ships as a Progressive Web App (PWA), so users can install it on their phone home screen. Lighthouse mobile score target: ≥ 90 across performance, accessibility, best-practices, and SEO.

### What support can do

Support can walk a mobile user through any flow the same way as desktop. If a mobile-specific layout breaks, the team can fix it via a deploy without the user reinstalling.

## What happens when a service is down

| What's down | What user sees | What they can do |
|---|---|---|
| The chain's RPC | Honest "pending" everywhere that reads chain data | Wait, try again |
| Our subgraph indexer | Slightly stale numbers but app stays usable | Wait; we usually catch up within seconds |
| The IPFS gateway | Proof-of-reserves verification times out | Retry; or use a different IPFS gateway |
| The tax export service | Tax page stats show "—" with pending caption | Try again later |
| The Codex API gateway | Pages that use it fail gracefully to "pending" | Try again later |
| A single venue adapter | That venue chip is greyed; other venues still work | Trade somewhere else |
| The kill switch contract | Disabled button with named blocker | Wait for deployment (Month 1 W2) |
| Lantern publisher cron | "No attestation published yet" honestly | Wait for first hourly publish (Month 6) |
| The chaos drill service | Honest 503 saying "chaos agent not deployed" | This is the design — not an outage |
| The Praetor multisig | Admin actions are blocked but normal user actions continue | Normal usage unaffected |

The principle: nothing fakes a success when the underlying service is unavailable. Every "pending" or "down" state names the specific reason.

## When a transaction goes weird (failed-tx recovery)

Blockchain transactions have edge cases that confuse users. Here is the universal pattern Atrium uses so every flow behaves the same.

### Case 1: Transaction pending too long

**You see:** Your transaction shows "Submitting…" for more than 60 seconds.

**Atrium shows:** After 60 seconds, the action button changes from "Submitting…" to "Still waiting — view on block explorer ↗" with a link to your wallet's pending transaction.

**You can choose:**
- Wait longer (Arbitrum is usually fast but can be slow under congestion)
- Cancel the transaction in your wallet (most wallets let you do this with a higher-gas replacement)
- Refresh the page (won't break anything; we re-read state from chain)

### Case 2: Transaction reverted

**You see:** The action button shows "Failed: <reason>." The reason is the actual contract revert string — not a generic "something went wrong."

**Atrium shows:** A "Retry" button next to the reason. Click to re-prompt your wallet.

**You can choose:**
- Retry as-is
- Adjust inputs (size, leverage, etc.) and try again
- Read the reason and understand why it failed (most reasons are self-explanatory: "InsufficientCollateral", "OracleStaleError", "venue paused")

### Case 3: Transaction submitted but UI shows stale data

**You see:** Your wallet shows a successful transaction, but Atrium's page hasn't updated.

**Atrium shows:** Up to 30 seconds of staleness is normal — that's how long subgraph indexing takes. After 30 seconds, the page should reflect the new state automatically.

**You can choose:**
- Wait 30 seconds and refresh
- Click the manual refresh button in the top right of every page (the circle-arrow icon)

### Case 4: You double-clicked and submitted two transactions

**You see:** Your wallet has two pending transactions for the same action.

**Atrium shows:** This is a wallet-level issue; Atrium can't prevent it once both are signed. Both will execute; the second one will probably revert because the first one already changed the state.

**You can choose:**
- Cancel the second one in your wallet
- Let them both execute; the second's revert costs gas but does no other harm
- Atrium's deposit, withdraw, mandate, and revoke actions are all idempotent — running twice produces the same final state

### Case 5: Block explorer shows success but Atrium says failed

**You see:** Disagreement between your wallet's history and Atrium's UI.

**Atrium shows:** Trust the block explorer — it's the source of truth. Atrium's UI is lagging.

**You can choose:**
- Refresh the page
- If the state still doesn't update after 2 minutes, contact support with the transaction hash

### Behind the scenes

Atrium reads chain state on a 5-second to 30-second polling interval depending on the surface (positions every 30 seconds, order book every 5 seconds, etc.). The polling is generous enough that you won't drown in network requests but tight enough that state stays current.

### What support can do

Support can read any transaction by hash and tell you exactly what happened on-chain. If the issue is Atrium not displaying state correctly, the team can clear the indexer cache and re-read.

## What support / admin can and cannot do

In plain words.

**For any user, support can:**
- Pull your wallet's full transaction and event history (it's on-chain, public)
- Tell you why a transaction failed (we have the raw revert reason)
- Tell you which step of a multi-step flow you completed
- Tell you when a pending service is expected to come online
- Walk you through any self-serve action (revoke, kill switch, withdraw)
- After mandate storage ships (Month 1 Week 2): look up every mandate you've signed and tell you which are still active
- After notification channels ship (Month 5): confirm whether an alert was dispatched

**For any user, support CANNOT:**
- Recover a lost passkey (you must set up a second authenticator before guardian recovery ships in Month 8)
- Recover a mandate hash you lost before the storage layer shipped
- Pause a liquidation on your behalf
- Resend a missed off-app notification (the channels don't support replay)
- Move your collateral
- Trade on your behalf
- Bypass a safety brake

**For the system, the admin team can:**
- Pause any subsystem instantly (the only thing that requires no timelock — for safety)
- Unpause any subsystem (requires the 3-of-5 multisig plus a 48-hour timelock — community can object)
- Approve a new trading venue (requires three independent reviewers from three orgs, plus the multisig)
- Rotate the proof-of-reserves signing key (timelocked)
- Update parameters like oracle freshness thresholds or per-venue caps (timelocked)
- Refill the cross-chain bridge's LINK reserve (timelocked)
- Force-close a stuck position via the safety-bot's last-resort path (timelocked)
- Publish a research backtest, but only if the backtest itself is marked `is_publishable: true` (synthetic data is blocked by design)

**What admin canNOT do:**
- Move your collateral out of the vault (no path exists; the only collateral-movement is your own withdraw or a proper liquidation)
- Skip the 48-hour timelock for non-pause actions
- Trade on your behalf without your signed mandate
- Read your private keys (we never have them)
- Censor a specific user (no per-user blocks in the contracts)

Every admin action records: who initiated, what they did, why (reason hash), when, and the before/after state. This audit log is on-chain.

### Escalation if support is wrong

This is on the open-decisions list ([What's not yet decided](#whats-not-yet-decided)). Today there is no formal dispute path. If you believe support got something wrong, you can:
- Re-state your case with the relevant transaction hashes — a different team member will re-review
- Post in our Discord support channel for community visibility
- Email the security contact in `SECURITY.md` if it's a safety issue

A formal dispute mechanism is on the mainnet readiness list.

## Eligibility and disclosures (mainnet plan)

Today is testnet. No real money. No KYC. No geographic restrictions. We don't collect anything that identifies you beyond a wallet address.

Mainnet is different. Here is what we know we will have to handle.

### Restricted jurisdictions (not yet decided)

Atrium will block users in jurisdictions where we cannot legally offer some or all features. The specific list is not yet set. Candidates likely to be restricted include those that prohibit derivatives trading by retail users, or that prohibit unregistered exchanges. Whatever the final list, it will be:
- Published on a public page before mainnet flip
- Detected at the IP / wallet level (we will use a third-party geolocation provider)
- Surfaced to the user as a clear "this feature is not available in your jurisdiction" notice, not a silent block

### Asset availability by region

Some assets we offer on testnet (tokenised equities like rAAPL) may not be available in all jurisdictions on mainnet. We will mark per-asset availability on the trading screen.

### Tokenised equities disclosure

Tokenised equities are not the same as the underlying public security. They are crypto tokens that track price. Differences include:
- No voting rights
- No direct dividend pass-through (synthetic only)
- Trade 24/7 not 9:30am-4pm
- Settlement on Arbitrum, not DTCC
- Issuer credit risk

A modal explaining these will appear before the first tokenised-equity trade.

### Copy-trading disclosure

If you follow another agent via the Rostrum copy-trade flow:
- You are not buying a service
- You are giving another wallet permission to trade on your behalf within your limits
- Past performance does not predict future performance
- You can revoke at any time (see [Revoking a single mandate](#revoking-a-single-mandate))

This disclosure ships with the copy-trade UI before mainnet.

### Agent trading disclosure

When you sign a mandate to any agent:
- The agent is software written by someone you don't necessarily know
- The agent operates within your limits, but bad limits still lose money
- Atrium does not vet agents beyond the basic registry and the on-chain reputation visible on the marketplace

### Tax disclaimer

The Atrium tax export is a calculation aid, not tax advice. You and your accountant are responsible for your tax filings.

### KYC and account verification

We do not collect KYC today (testnet). On mainnet, KYC will depend on:
- Your jurisdiction
- The features you want to use (proof-of-reserves verification and view-only flows likely remain KYC-free; trading and withdrawing real money may not)

The specific KYC partner and threshold are not yet selected. They will be announced before mainnet flip.

### If you become ineligible

If you used Atrium from an eligible jurisdiction and later become ineligible (you move, regulations change, you fail a re-KYC):
- You retain the ability to withdraw your collateral
- New positions and new mandates may be blocked
- The withdrawal SLA in [Taking money out](#taking-money-out-withdraw) still applies
- We do not freeze user funds unilaterally; the contracts do not have that path

### What support can do

Support can explain what the app is showing you and point you to the published eligibility policy. They cannot give legal advice and they cannot make a determination of your legal status. They can walk you through withdrawal if you need to exit.

## Migrating from testnet to mainnet

When Atrium flips to mainnet, testnet users do not auto-migrate. Here is the user flow.

### Step 1: Warning banner

For the two weeks before mainnet flip, every page in the testnet app shows a banner:

> Atrium mainnet launches on [date]. This is the testnet — no real money. To prepare: verify the official mainnet contract addresses on our website, set up a second authenticator on a second device, and read the mainnet disclosures.

### Step 2: Mainnet site at a new URL

Mainnet launches at a different URL (e.g. `app.atrium.fi` vs `app.atrium.fi/testnet`). Testnet stays live as an archive.

### Step 3: First-visit mainnet acceptance

The first time a user opens the mainnet app, before they connect a wallet, they see:

> Mainnet warning. This is real money. Real losses. Real liquidations.
>
> You are responsible for verifying the contract addresses you interact with. Official addresses are published at `/security` and on our verified Twitter and Discord.
>
> Your jurisdiction may restrict some features. Click "I confirm I am eligible" only if you have read the mainnet disclosures (see [Eligibility and disclosures](#eligibility-and-disclosures-mainnet-plan)).
>
> [Confirm and continue]    [Cancel]

This is a one-time check per device.

### Step 4: Fresh wallet, fresh start

Mainnet uses a different chain (Arbitrum One, not Sepolia). Your testnet wallet's contents are not moved. You start fresh on mainnet:
- Set up a new authenticator (or use the same passkey on the new chain — wallet specifics)
- Deposit real USDC
- Mandates do not carry over (you have to re-sign on mainnet)
- Tax exports from testnet are still downloadable from the testnet archive

### Step 5: Testnet archive

Testnet becomes read-only. Your testnet positions, mandates, and history stay viewable indefinitely. New actions on testnet are not supported.

### Behind the scenes

Mainnet is a different deployment of all contracts at different addresses. There is no on-chain bridge between testnet and mainnet (and there shouldn't be — testnet money is not real money). The migration is entirely about user mental model and a clean cutover.

### What support can do

Support can walk you through the mainnet setup, confirm the official contract addresses, and help you verify you're on the right URL. They cannot move your testnet positions to mainnet — that is by design.

## Public pages anyone can read

These pages don't require a wallet. They exist to build trust before anyone signs up.

**Landing page.** Hero, product, the margin engine, the cross-chain bridge, the agent mandate system, the proof-of-reserves, live numbers (TVL, agents, queries, venues), subsystem map, architecture, cohort partners, closing CTA.

**Learn.** A six-step explainer of how Atrium works in plain English.

**Docs.** Links to the PRD, technical design, audit findings register, roadmap, resources.

**Security.** Posture: formal-method invariants in CI, dual oracle, 3-keeper redundancy, 3-of-5 multisig with 48-hour timelock, bug bounty info, audit-findings register, disclosure email and PGP key.

**Brand kit.** Tokens, typography, palette, component samples.

**Manifesto.** Long-form positioning.

**Team.** Founders and advisors.

**Cohort.** Live count of signed partners (zero today — we don't fake logos).

**Lantern (public).** Anyone can verify any wallet's inclusion in the latest proof-of-reserves snapshot.

**Withdrawal SLA.** The five circuit-breaker matrix and what each one does.

**Changelog.** Public log of changes and audit fixes. Any fee added to [What Atrium charges](#what-atrium-charges-fees) is announced here before going live.

**Legal pages.** Privacy policy and terms.

### What support can do

Nothing — these pages are read-only.

## What Atrium will NOT do (honesty boundaries)

A short, explicit list of things we don't do — so users and partners know what to expect.

- We don't claim real money is at risk on testnet. It isn't.
- We don't show fake TVL, fake partner logos, or fake user counts. The landing-page numbers come from the live on-chain reads.
- We don't ship dead buttons. Every button either does something real, or is disabled with a specific reason why.
- We don't show "$0.00" or "0.0 seconds" as if they were measurements when we haven't measured anything. We show "—" with a pending tag.
- We don't fake a working passkey ceremony. The browser does the real WebAuthn flow.
- We don't claim Pyth feeds for tokenised equities exist on Sepolia — they don't. We route through a multisig-signed mainnet relay and say so on the landing page.
- We don't claim cohort partners we haven't signed. The cohort count is zero today.
- We don't take admin actions without an audit-log entry on-chain.
- We don't publish a backtest as evidence unless the backtest's data is real, not synthetic.
- We don't collect personally identifying information today. If optional email notifications ([Notification settings and off-app alerts](#notification-settings-and-off-app-alerts)) or mainnet compliance ([Eligibility and disclosures](#eligibility-and-disclosures-mainnet-plan)) ever require PII, we will disclose exactly what is collected, why, and for how long it is retained, before enabling it.
- We don't use screenshots as final proof of anything.
- We don't claim mainnet venue support that doesn't exist (Robinhood Chain is "pending RH SDK" — we say it directly).
- We don't bypass the 48-hour timelock for non-pause actions.
- We don't recover lost passkeys. You set up a second authenticator before guardian recovery ships, or you accept the risk.
- We don't store your mandate hashes centrally before the storage layer ships. You keep the hash yourself or re-issue.
- We don't add a fee without publishing it on [What Atrium charges](#what-atrium-charges-fees) and the changelog page before turning it on.
- We don't pretend off-app notifications exist before Month 5.

## What's coming after testnet

Mainnet readiness gates — the things that need to be true before any contract goes live with real money:

- Third-party audit (e.g. Code4rena) complete and findings addressed
- All five formal-method invariants green in CI (3 of 5 today)
- Ten of ten chaos rehearsals pass under six minutes with no judge-facing surprise
- All open audit-fix items closed (or formally deferred)
- Pyth equity feeds available on mainnet (or alternative disclosed)
- Multisig moved from 3-of-5 to 4-of-7 with rotating signers
- Bug bounty raised from $25K (testnet tier) to $250K+ (mainnet tier)
- Tax exports legally reviewed per jurisdiction
- Privacy policy and terms updated for mainnet handling
- Cohort partners have signed off-chain memoranda
- Lantern publisher running on managed infrastructure, not a $5 VPS
- KYC partner selected (if KYC required for any feature)
- Restricted-jurisdictions list published
- Mainnet disclosures ([Eligibility and disclosures](#eligibility-and-disclosures-mainnet-plan)) live on the site
- Post-deploy smoke test passes in CI on the new contract addresses

## Quick reference — every action a user can take

A flat list of every user-initiated action in the product. If you're reading this and you find an action that's missing, the design isn't complete yet.

- Connect a wallet via passkey (fingerprint, hardware key)
- Connect a wallet via Coinbase Smart Wallet
- Set up a second passkey on a second device
- Switch network
- Claim a faucet drop (once contracts ship)
- Deposit USDC into the vault
- Approve the vault for USDC spending (one-time)
- Withdraw USDC from the vault (full or partial)
- Top up collateral when close to liquidation
- Pick a trading venue
- Pick long or short side
- Type a trade size
- Adjust leverage
- Read the first-trade Risk Preview
- Open a position
- Close a single position
- Use the emergency partial close when normal close fails
- Filter the positions table by venue
- Look at activity feed
- View an individual transaction on a block explorer
- Set up a cross-chain transfer
- Swap the source and destination chains
- Confirm a cross-chain transfer
- Claim back a stuck cross-chain transfer
- Open the agent marketplace
- Sort agents by P&L, Sharpe, or AUM
- Read an agent's profile (live vs backtested, drawdown, venues, deboost status)
- Click "Delegate" on an agent row
- Open the new mandate modal
- Type an agent address
- Set per-action cap, total cap, daily action count, expiry
- Pick allowed venues for an agent
- Sign a mandate
- Copy the intent hash (before central storage ships)
- Revoke a single mandate
- Revoke all mandates and session keys (kill switch)
- Verify your own balance in the proof-of-reserves tree
- Pick a tax jurisdiction
- Pick a tax year
- Download a CSV tax export
- Download a PDF tax export
- Download a signed-export tax record
- Disconnect a connected dapp
- Revoke all connected dapps
- Revoke a single session key
- Switch settings tab
- Configure notification channels (Month 5)
- Set buffer warning threshold (Month 5)
- Run any step of the verifier walk
- Connect with Postern smart wallet (from the verifier walk)
- Confirm the kill-switch dialog
- Read any public page (landing, learn, docs, security, brand, manifesto, team, cohort, lantern, SLA, changelog, legal)
- Read the brand kit
- Visit the partner directory
- Visit an individual partner profile
- Look at the agents marketplace (no login required)
- Retry a failed transaction
- Cancel a stuck transaction (via wallet)
- Confirm the mainnet eligibility check (when mainnet ships)

## Quick reference — what the product will show in each "state"

A few examples so the design is explicit about UI states:

| Situation | What the user sees |
|---|---|
| Loading | A skeleton (grey shimmer block), not a spinner |
| Empty | Friendly message with the reason and an action ("Open one from Trade") |
| Pending (service not deployed yet) | "—" or "pending" with a specific named blocker ("Coffer deploys Month 1 W2") |
| Error | Named error with the actual reason and a Retry button |
| Wrong wallet network | "Switch to Arbitrum Sepolia" with the network they're currently on |
| Wallet not connected | "Connect with Postern" CTA |
| Success | Clear confirmation message with a link to the on-chain proof |
| Mobile screen | Same content with bigger touch targets (≥44px). No horizontal **page** scrolling; chip and tab rows may scroll horizontally when clearly indicated. |
| Risk preview (first trade) | Modal with six bullets and a live buffer preview at the user's planned size |
| Top-up suggestion | Banner with pre-filled deposit amount that restores a healthy buffer |
| Transaction stuck > 60 seconds | Button changes to "Still waiting — view on block explorer ↗" |

## Final product picture

Atrium is one wallet. You deposit USDC once. You trade across seven venues with one buying-power number computed by a margin engine that nets your hedges. You can hand a bounded budget to an AI agent with one signature, inspect the agent's track record before delegating, and pull the plug on every agent with one click. You can verify your money is actually in Atrium without trusting Atrium — the proof is on-chain and on IPFS. You can take a tax export your accountant can audit. You can withdraw any time, subject to five clearly defined safety brakes. You will be warned before your first trade about how you can lose money. You will be warned before liquidation, and offered a top-up shortcut.

Today, on testnet, the wallet onboarding works, the agent mandate flow signs real EIP-712 envelopes, the cross-chain bridge moves real test USDC through Chainlink CCIP, the proof-of-reserves verification page reads real on-chain data, and the tax export is a real download. The kill-switch UX is live; the underlying one-transaction revoke goes live once the safety contracts deploy in Month 1 Week 2 — and the same is true for deposit, withdraw, open, close, and the agent verifier. By Month 6 the proof-of-reserves publisher is running hourly. By Month 9 the chaos drill is live and we can run a full red-team rehearsal end to end.

Every user-visible testnet flow is designed. Every state has been thought through, every failure has a defined behaviour, every admin action has a defined boundary, every "pending" thing has a named reason and a date, every fee is on the table in [What Atrium charges](#what-atrium-charges-fees).

Mainnet policy decisions — fee schedule, KYC provider and thresholds, restricted-jurisdiction list, formal support dispute path, tax-export liability, agent ranking algorithm, cohort partner threshold, off-app notification implementation, mainnet cutover date, final visual QA for mobile layouts — are explicitly listed as open in [What's not yet decided](#whats-not-yet-decided) and will be resolved before mainnet flip.

If a user can do it on testnet, we've designed it. If something can go wrong, we've designed the response. If a human helper might be needed, we've defined what they can and can't do. If a decision hasn't been made, it's named in [What's not yet decided](#whats-not-yet-decided) rather than papered over.

This is what "best testnet version, no bug to find" looks like as a product design — not a marketing promise.
