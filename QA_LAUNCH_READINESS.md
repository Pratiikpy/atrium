# Atrium - Launch-Readiness QA Test Plan

> One pass, top to bottom. **Every item must pass** (or be a written, accepted exception) before we call Atrium launch-ready. The bar is premium: a real person should be able to do everything end to end, see only honest data, and never hit a dead button, a fake number, a broken state, or a sloppy screen.

Generated **2026-05-29** from the live codebase: **45 pages**, **50 API routes**, **565 scripted checks** across 8 dimensions, plus a completeness critic pass.

---

## S0. How to use this document

- Go in order. Tick the **Pass** box when an item behaves exactly as **Expect** describes. If it does not, log it (screenshot + page + step number + what you saw) and mark the severity.
- **Severity key:** **BLOCKER** = not launch-ready until fixed. **HIGH** = fix before launch. **MED** = fix soon after. **LOW** = polish.
- Test **both axes** on every screen: it must **work** (the action does what it says) **and** it must look/read **premium** (typography, spacing, copy, calm prime-brokerage feel - never generic).
- **The honesty rule (hard, non-negotiable):** no screen may present a fabricated number as real. Every figure is either real (from the subgraph/chain/an API) or an honest `pending` / `0` / `not indexed yet` / disabled state. If you cannot tell where a number came from, that itself is a finding.
- A surface is only "done" when its loading, empty, error, permission, success, **and** mobile states are all correct - not just the happy path.

## S1. Global checklist - apply to EVERY page

Run these on every route before the page-specific tests. Any failure is at least HIGH.

| # | Do this on the page | Expect | Sev | Pass |
|---|---------------------|--------|-----|------|
| 1 | Open the route fresh (hard reload) | Renders within ~2s, no white flash, no layout shift as data loads | HIGH | [ ] |
| 2 | Open DevTools console | Zero errors, zero React warnings, no failed network calls rendered as success | HIGH | [ ] |
| 3 | Watch the first paint while data loads | A real loading/skeleton state shows - never a flash of fake/zero numbers | BLOCKER | [ ] |
| 4 | If the page shows data with nothing to show | Honest empty state with a clear next action - never "No data" with a dead end, never fake filler | BLOCKER | [ ] |
| 5 | Kill the network / force an API failure | A clear error state with a retry or honest "pending" - never a silent hang or a frozen form | HIGH | [ ] |
| 6 | Resize to 375px (mobile), 768px (tablet), 1280px (desktop) | Layout reflows cleanly at each; no overflow, overlap, clipped text, or horizontal scroll | HIGH | [ ] |
| 7 | Tab through with the keyboard only | Every control is reachable, focus ring is visible, order is logical, Enter/Space activate | HIGH | [ ] |
| 8 | Read every word on the page | Cofounder voice, no banned marketing words, no typos, no em-dashes, no lorem/placeholder | MED | [ ] |
| 9 | Check the browser tab | Correct page title + favicon (the breathing status tile) | LOW | [ ] |
| 10 | Click every button / link | Each does something real or is honestly disabled with a reason - zero dead controls | BLOCKER | [ ] |

## S2. Setup before you start

- **Where to run it:** locally, start the app and open `http://localhost:3000` (the verify app under `apps/verify`); or use the deployed site once it is published. The local subgraph URL is already wired in `apps/verify/.env.local` to the v0.0.7 endpoint.
- **Wallet:** a browser wallet (Rabby or MetaMask) set to **Arbitrum Sepolia (chain 421614)**.
- **Test funds:** use the in-app **Faucet** (test USDC + a little ETH, 24h cooldown). For extra gas, a public Arbitrum Sepolia faucet.
- **Live numbers are syncing:** TVL / counts come from the subgraph **v0.0.7**, which is still indexing. Early on some tiles read `pending` - that is **correct**, not a bug. Re-check after it catches up.
- **Testable now vs after the timelock (important):** opening a **cross-venue position** (and anything that routes funds through Coffer to an adapter) unlocks only **after the timelock executes (~2026-05-31 02:20 UTC)**. Until then, the correct behavior is that "open position" is **cleanly gated/disabled with an honest message** - so test that it is gated gracefully, *not* that it trades. **Everything else is testable today:** login, faucet, vault deposit/withdraw, portfolio reads, reserves, transfers UI, agents/mandate UI, all reads, all copy, all design, all states.
- **One wallet covers everything.** Atrium is single-user-per-wallet (portfolio, vault, trade, transfer, mandates, reserves are all scoped to the connected wallet). There is **no user-to-user feature that needs a second wallet** - the agent and the keeper are services, not other users. So one funded Rabby wallet on Arbitrum Sepolia tests the entire product.

## S3. Evidence capture + premium scoring (how to run each test)

This plan is meant to be **executed with a real wallet and recorded**, not eyeballed. For **every** test case below, capture proof and a quality verdict - not just a pass/fail tick:

1. **Record the journey as video** (Playwright `recordVideo`, or a screen recorder). One clip per journey.
2. **Screenshot the interaction + outcome:** (a) the screen *before* the action, (b) the **Rabby approve/sign popup** when one appears, (c) the **result state** after. Name them `<route>-<step>-{before|popup|after}.png`.
3. **Capture console + network** for the step - zero errors is part of passing (see S1.2). Note any failed request or warning.
4. **Score the screen (premium rubric, 1-5 each; flag anything < 4):** layout/spacing, typography + brand fidelity, copy quality, motion/interaction feel, state handling (loading/empty/error), honesty (no fabricated data). End with a one-line verdict: **premium / acceptable / not launch-ready** and why.
5. **Log** the evidence path + verdict next to the test row.

**The rig (Rabby + Playwright).** Drive the app with a *real* Rabby wallet via Playwright `launchPersistentContext`, loading the Rabby extension and a funded Arbitrum Sepolia profile - the same proven pattern as `Downloads/fhenix builder/packages/app/e2e/fixtures/rabby` (`rabby-driver.ts` launches the extension and approves/signs popups; `setup-rabby-profile.ts` imports the seed; `enable-rabby-testnets.ts` turns on testnets; video + screenshots per step). Ported to `apps/verify/e2e` it gives a repeatable, recorded run. Evidence lands under `apps/verify/qa-evidence/<date>/`; the final output is a graded report in the `VERIFICATION_REPORT` style (per-domain PASS/FAIL + critical issues + an overall premium grade).

---

## 1. Page-by-page UI walkthrough

> Comprehensive LAUNCH-READINESS QA TEST PLAN for the Atrium protocol covering 28 distinct routes and pages in the Next.js 16 app directory. The plan covers authenticated core pages (/app/* area), public/marketing pages, documentation, security, legal, and verifier journey pages. Each page is grounded in actual code files, with purpose, key elements, states to verify, concrete test cases (ACTION/EXPECTED/severity), and specific flaws to hunt (dead buttons, fake data, broken states, sloppy copy, unprofessional visuals, silent failures). The QA bar is PREMIUM/company-level with honesty discipline: never show fabricated numbers as real; flag any place where a tester should confirm live data vs. mocked data. All test cases include severity ratings (blocker/high/medium/low) and target responsive design (mobile/tablet/desktop), real data vs. pending states, comprehensive error handling, and consistency with brand voice and design tokens.

#### 1.1 Page: /app/portfolio
*Where:* `apps/verify/src/app/app/portfolio/page.tsx`
*Purpose:* Portfolio dashboard: 4-stat row (TVL, required margin, notional, 24h PnL), margin engine bar chart, buying power sparkline, open positions table with Close buttons

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /app/portfolio with no open positions | Show honest empty state 'No open positions' with 4-stat skeletons, not fake data | BLOCKER | [ ] |
| 2 | Click Close button on a position | Signature request appears, Close tx executes, position disappears from table | HIGH | [ ] |
| 3 | Check TopUpBanner visibility when buffer below threshold | Banner shows ONLY when bufferBps < threshold AND source is 'live', NOT if 'pending' | BLOCKER | [ ] |
| 4 | Resize viewport to mobile (< 768px) | All 4 stats stack vertically, charts hidden, table becomes scrollable card list with one item per row | HIGH | [ ] |
| 5 | Check TVL/margin display for staleness | If Scribe data > 60s old, show '-' with 'pending Scribe update' label, not stale numbers | BLOCKER | [ ] |

*States to verify:* Loading (skeleton) / No positions / With positions / Margin warning / Margin critical / TopUp banner visible / TopUp banner hidden
*Hunt for these flaws:*
- Fake TVL numbers shown as real data
- TopUpBanner visible when source='pending' (shows fake urgency)
- Dead Close buttons (click does nothing)
- Broken margin calculation display
- Mobile layout broken (charts overflow)
- Stale Scribe data (> 60s old) without 'pending' label
- TopUpBanner triggers on stale source instead of live-only
- Position table empty state says 'No data' instead of clear CTA to trade

#### 1.2 Page: /app/trade
*Where:* `apps/verify/src/app/app/trade/page.tsx`
*Purpose:* Trade execution across Portico-registered venues; OrderForm with signature stamp, adjust mode, authorized adapter selector; 8 live adapters + 2 scaffold-blocked

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /app/trade with no wallet connected | Clear 'Connect wallet' state, all trading controls disabled, Connect button visible | BLOCKER | [ ] |
| 2 | Select Hyperliquid adapter and create long position | Signature request appears with EIP-712 envelope, trade executes, position opens | HIGH | [ ] |
| 3 | Try to trade via 'scaffold · open blocked' adapter (GMX or Morpho) | Disabled state with honest 'Phase theta-followup' label, click shows tooltip explaining status | HIGH | [ ] |
| 4 | Click signature stamp on active order | Shows EIP-712 envelope with intent, signer, cap bounds visible in readable format | MED | [ ] |
| 5 | Adjust existing position (increase notional) | Margin recalculates in real-time, new SPAN scenarios (14 shock scenarios) render with updated buying power | MED | [ ] |

*States to verify:* No wallet connected / Loading venue data / Adapters ready / Order pending / Order signed / Post-trade margin updated / Scaffold adapters disabled
*Hunt for these flaws:*
- Fake trade executions (shows 'Success' when tx never sent)
- Silently failing trades without error toast
- Dead adapter selector (click doesn't change venue)
- Broken signature copy (JSON malformed)
- Mobile trade form broken (inputs wrap oddly, labels overlap)
- Stale adapter metadata (> 10min old, contract changed)
- No error boundary (JS crash on adapter error crashes app)
- Adapters show as live when they're pending deployment

#### 1.3 Page: /app/transfer
*Where:* `apps/verify/src/app/app/transfer/page.tsx`
*Purpose:* Cross-chain USDC collateral transfer via Aqueduct (Chainlink CCIP); posted collateral becomes Plinth credit on arrival; TransferForm + TransferTimeline (right panel at xl breakpoint) + RecentTransfers (no separate history page)

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /app/transfer with 0 USDC balance | Honest 'Insufficient balance' state, submit button disabled with gray styling | BLOCKER | [ ] |
| 2 | Enter 500 USDC, select destination chain, submit | Signature request → tx confirms → timeline shows 'in-flight' → updates to 'confirmed' with timestamp | HIGH | [ ] |
| 3 | Resize desktop viewport to below xl breakpoint | Timeline moves below form (single-column layout), form still functional | MED | [ ] |
| 4 | Transfer fails mid-CCIP route | Error message appears with clear 'claim-back' path, not silent failure | HIGH | [ ] |
| 5 | Check RecentTransfers list | Shows last 5 transfers with status, no 'View all' button (no separate history page exists) | MED | [ ] |

*States to verify:* No balance / Form valid/invalid / Transfer pending / Transfer confirmed / Transfer failed / Timeline showing in-flight / Timeline showing confirmed / Claim-back path visible on failure
*Hunt for these flaws:*
- Fake CCIP confirmations (shows 'confirmed' when messageId never received)
- Silent tx failures (no error state, form becomes unresponsive)
- Broken timeline animations (steps jump instead of animate)
- Form validation doesn't block invalid submits (negative amounts)
- Mobile layout broken (panels don't stack at correct breakpoint)
- Stale balance display (doesn't update when new tx lands)
- No claim-back CTA when transfer fails
- Timeline shows pending forever (CCIP callback never fires)

#### 1.4 Page: /app/vault
*Where:* `apps/verify/src/app/app/vault/page.tsx`
*Purpose:* ERC-4626 vault deposit/withdrawal with Coffer; VaultDeposit + VaultWithdraw cards, VaultStats, 4-item Safety section (virtual-shares inflation guard, 30% TVL drop circuit breaker, withdrawal SLA, USDC pause-check)

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Deposit 1000 USDC into Coffer | Signature request → shares minted immediately → balance updates → 'shares earned' appears with count | BLOCKER | [ ] |
| 2 | Withdraw all shares | Signature request → USDC returned → share balance becomes 0 → deposit card shows 'No deposits' state | HIGH | [ ] |
| 3 | Check Safety section when 30% TVL drop happens | Circuit breaker icon shows (red), withdrawal blocked with honest reason 'TVL drop ≥ 30% detected, emergency pause active' | BLOCKER | [ ] |
| 4 | Check withdrawal SLA timer | Counts down with real block time (not client-side fake countdown), shows block number + ETA | MED | [ ] |
| 5 | Try withdraw while USDC is paused on-chain | Shows honest 'USDC pause detected, withdrawal blocked until pause lifts' message | HIGH | [ ] |

*States to verify:* Vault loading / No deposits / With deposits / Deposit pending / Withdrawal pending / Safety warning (30% TVL drop triggered) / Withdrawal SLA active / Vault paused
*Hunt for these flaws:*
- Fake share calculation (1000 USDC yields wrong share count)
- Withdrawals execute when circuit breaker is active
- SLA timer is client-side fake (not block-driven, counts incorrectly)
- Safety section shows 'pending' state without clear 'waiting for next block' label
- Mobile form broken (inputs overflow, labels cut off)
- Deposit succeeds silently without share confirmation toast
- Stale TVL data drives false circuit breaker state (shows active when TVL recovered)
- Safety SLA shows wrong ETA (doesn't account for block time)

#### 1.5 Page: /app/agents
*Where:* `apps/verify/src/app/app/agents/page.tsx`
*Purpose:* Delegate to agents with bounded EIP-712 Intent Sigil mandates; NewMandateButton dynamically loaded with skeleton; AgentsMobile responsive panel, AgentsStatRow, AgentsView

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /app/agents before any adapters deploy | NewMandateButton shows honest 'deployment pending' state, not clickable, explains why | BLOCKER | [ ] |
| 2 | Click NewMandateButton after Atrium deploys | Modal opens with Intent Sigil form (perActionUsd, dailyUsd, expiryDays, agent selection), EIP-712 JSON visible | HIGH | [ ] |
| 3 | Fill mandate form (Augur: perActionUsd=250, dailyUsd=2500, expiryDays=14), sign | Sigil stored on-chain, Sigil.validateIntent called immediately, agent granted permission within bounds | HIGH | [ ] |
| 4 | View AgentsStatRow | Shows real agent counts from Rostrum + live copy-trade volume, or honest 'pending Rostrum indexing' state | MED | [ ] |
| 5 | Mobile view (< 768px) | AgentsMobile panel renders, mandate creation accessible via modal or bottom sheet | MED | [ ] |

*States to verify:* Loading button skeleton / Agents loading / Agents list ready / Modal open for mandate creation / Mandate signed / Mandate visible in agent card
*Hunt for these flaws:*
- NewMandateButton clickable before deployment (leads to silent failure or 'contract not found' error)
- Fake Sigil creation (doesn't actually emit SignatoryIntent event)
- Stale agent counts (> 60s old, doesn't show 'pending' label)
- Dead agent cards (click does nothing)
- Mandate form allows 0 or negative bounds (validation missing)
- Mobile modal broken (form inputs overflow, submit button cut off)
- No revocation CTA visible (should show 'Revoke' button on existing mandates)
- Missing copy-trade link to /app/agents?copy=[id] workflow

#### 1.6 Page: /app/reserves
*Where:* `apps/verify/src/app/app/reserves/page.tsx`
*Purpose:* Proof-of-reserves via Lantern attestation; VerifyMyBalanceButton reads latest Lantern attestation, computes Merkle inclusion proof in browser; ReservesStatRow, LatestAttestationCard, MerkleStructureCard, RecentAttestationsSection

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /app/reserves with recent Lantern attestation (< 10 min old) | LatestAttestationCard shows timestamp, leafCount, IPFS CID, 'verified' status; VerifyMyBalanceButton clickable | HIGH | [ ] |
| 2 | Load /app/reserves > 10 minutes after last Lantern publish | VerifyMyBalanceButton shows honest 'waiting for next attestation (~ 0 min)' with countdown, disabled state | BLOCKER | [ ] |
| 3 | Click VerifyMyBalanceButton | Merkle proof computed in browser, 'Your balance verified' appears with proof summary (leaf index, root, path length) | HIGH | [ ] |
| 4 | Check RecentAttestationsSection | Shows prior attestations (timestamp, leafCount, IPFS CID) in reverse chronological order, or 'No prior attestations' if first publish | MED | [ ] |
| 5 | Mobile responsive (< 768px) | Cards stack, Merkle proof scrollable horizontally, all text readable | MED | [ ] |

*States to verify:* Lantern ready (published within 10 minutes) / Lantern stale (> 10 min, no recent publish) / Inclusion proof verified / Proof verification pending / Attestation missing for user
*Hunt for these flaws:*
- VerifyMyBalanceButton visible but disabled when Lantern is stale (doesn't say why)
- Fake Merkle proofs (computation skipped, always shows 'verified')
- Old attestation timestamps shown as '5 minutes ago' when actually > 10min old
- Lantern publish cadence wrong in copy (docs say 'hourly' but actually 'every 10 min')
- Missing user's address in proof summary (unclear whose balance was verified)
- Mobile layout broken (proof overflows without scroll)
- Dead IPFS link in CID (404 when clicked)
- Silent proof verification failure (no error state, form hangs)

#### 1.7 Page: /app/settings
*Where:* `apps/verify/src/app/app/settings/page.tsx`
*Purpose:* SettingsTabs with 6 tabs; only 'wallet' tab populated (WalletDetailCard, GasSponsorshipCard, ConnectedSitesCard); other 5 tabs show 'coming Month X' banners

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /app/settings | 'wallet' tab active by default, all 6 tabs visible and clickable for preview (session-keys, recovery, network, notifications, account) | HIGH | [ ] |
| 2 | Click 'session-keys' tab | Shows 'coming Month 6' placeholder banner, not broken/empty state | MED | [ ] |
| 3 | Click 'recovery' tab | Shows 'coming Month 7' placeholder banner with period end date | MED | [ ] |
| 4 | View WalletDetailCard on 'wallet' tab | Shows wallet address (truncated + full on hover), connected chain (arb-sepolia), disconnect button functional | HIGH | [ ] |
| 5 | Check GasSponsorshipCard | Shows remaining gas sponsorship credit (Postern USDC balance) or 'no active credit', not fake number | MED | [ ] |

*States to verify:* Wallet tab active / Other tabs showing placeholder / WalletDetailCard loaded / GasSponsorshipCard loaded / ConnectedSitesCard loaded
*Hunt for these flaws:*
- 'Coming Month X' banners missing (tabs show broken empty state)
- Dead Disconnect button (click doesn't disconnect)
- Fake gas sponsorship credit shown as real number
- Fake connected sites list (shows phantom dApps user never connected)
- Tab clicks not working (routing broken)
- Mobile tab navigation broken (overflow without scroll, tabs unreadable)
- No indication which Month is which feature (e.g., 'Month 6' is vague)
- Stale wallet address (doesn't update when user reconnects)

#### 1.8 Page: /app/onboarding
*Where:* `apps/verify/src/app/app/onboarding/page.tsx`
*Purpose:* 90-second onboarding flow (Welcome → Authenticator → Faucet → Margin posted → Done); OnboardingFlow dynamically loaded with Skeleton fallback

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /app/onboarding | Skeleton appears, then Welcome step renders with clear CTA to start flow | HIGH | [ ] |
| 2 | Complete Welcome step | Authenticator/Passkey step appears, passkey enrollment prompt available (Postern) | BLOCKER | [ ] |
| 3 | Enroll passkey | Wallet created in browser via Postern (public key stored), next step unlocked automatically | HIGH | [ ] |
| 4 | Complete Faucet step | 1000 testnet USDC deposited into Coffer, shares minted, balance appears in portfolio | HIGH | [ ] |
| 5 | Complete Margin posted step | Margin account opens, 'Done' step visible, can proceed to portfolio or repeat flow | HIGH | [ ] |

*States to verify:* Flow loading (skeleton) / Step 1 (Welcome) visible / Step 2 (Authenticator) active / Step 3 (Faucet) active / Step 4 (Margin posted) active / Flow complete
*Hunt for these flaws:*
- Skeleton never disappears (loading stuck forever)
- Steps show out-of-order (e.g., Faucet before Authenticator)
- Skipped steps (e.g., jump from Welcome to Margin posted)
- Passkey enrollment fails silently (no error message)
- Faucet never drains (balance stays 0 after step)
- Margin account never opens (no confirmation)
- Flow never completes ('Done' button dead or missing)
- Mobile flow breaks (steps overlap, text cut off)
- No error handling (JS crash on authenticator failure)

#### 1.9 Page: /app/markets
*Where:* `apps/verify/src/app/app/markets/page.tsx`
*Purpose:* 9 whitelisted venues grid (Hyperliquid HIP-3, Aave Horizon, Pendle V2, Curve, Trade.xyz, Polymarket, GMX V2, Morpho Blue, Synthetix V3); cards show name, description, risk, instruments, correlation, haircut; scaffold venues disabled

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /app/markets | All 9 venue cards visible with name, description, risk profile badge, 3 instruments, correlation class, haircut % clearly displayed | BLOCKER | [ ] |
| 2 | Click live venue card (Hyperliquid) | Links to /app/trade or shows venue detail modal with full spec | MED | [ ] |
| 3 | Hover over disabled venue card (GMX, Morpho, Synthetix) | Shows 'scaffold · open blocked' label + tooltip 'Available in Phase theta-followup' | HIGH | [ ] |
| 4 | Try to click disabled venue | No action (cursor shows 'not-allowed'), or links to /docs#adapters explaining scaffold phase | MED | [ ] |
| 5 | Click 'Add a venue' section | Links to /learn#adapters with adapter spec and submission process | MED | [ ] |

*States to verify:* All 9 venues listed / Some venues disabled (scaffold phase) / Add venue CTA visible / Risk badges shown / Correlation values shown
*Hunt for these flaws:*
- Missing venues (only 6 shown when 9 expected)
- Duplicate cards (same venue appears twice)
- Disabled venues still clickable (can try to trade)
- Stale venue metadata (haircut not updated > 1h after contract change)
- Missing correlation/instruments data (shows placeholder or empty)
- 'Add venue' link broken (404)
- Mobile cards don't stack properly (overlap or cut off)
- No risk-profile legend (user can't understand the ratings)
- Haircut values are outdated (doesn't match Curator registry)

#### 1.10 Page: /agents/marketplace
*Where:* `apps/verify/src/app/agents/marketplace/page.tsx`
*Purpose:* Reference agents marketplace with 3 reference agents (Augur, Haruspex, Auspex) as Card links to /agents/marketplace/[id]; Community submissions section; How a submission works walkthrough

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /agents/marketplace | 'Reference agents' section shows 3 cards (Augur, Haruspex, Auspex) with 'Reference agents - strategy logic ships in Phase 6... PnL pending' honesty banner | HIGH | [ ] |
| 2 | Click reference agent card | Links to /agents/marketplace/[id] with agent profile (5 trust-signal sections) | HIGH | [ ] |
| 3 | Check 'Community submissions' section | Shows 'No community agents submitted yet' message or lists any submitted agents with status | MED | [ ] |
| 4 | Read 'How a submission works' section | Shows 4 steps (fork template, add README, open PR, merge+grant disburse) with $5K ARB Curator grant callout and link to template | MED | [ ] |
| 5 | Mobile responsive (< 768px) | Cards stack vertically, all text readable, no overflow | MED | [ ] |

*States to verify:* No community agents submitted / With community agents / Reference agents showing live metadata / Submission walkthrough visible
*Hunt for these flaws:*
- Reference agents missing (< 3 shown)
- Community submissions list shows deleted agents
- Dead card links (404)
- Stale reference agent metadata (performance data > 10min old)
- 'Phase 6' text is hardcoded when it should reference current phase
- Missing Curator grant callout ($5K mention missing)
- Mobile layout broken (cards overflow)
- No link to submission template repo
- Submission steps are incomplete or vague

#### 1.11 Page: /agents/marketplace/[id]
*Where:* `apps/verify/src/app/agents/marketplace/[id]/page.tsx`
*Purpose:* Agent profile with 5 trust-signal sections: (1) Header with name+strat+status, (2) Data source badges (Scribe/Rostrum/Codex), (3) Max drawdown 90d chart + counters, (4) Deboost status, (5) Cap envelope (Sigil EIP-712), (6) Copy-trade CTA

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /agents/marketplace/augur | Agent name 'Augur' + strategy description + status badge visible, force-dynamic page loads without error | HIGH | [ ] |
| 2 | Check data source badges | Shows Scribe (live), Rostrum (live), Codex (live) badges; pending states show 'waiting for first event' | HIGH | [ ] |
| 3 | Load max drawdown chart | Shows 90-day chart, revert counter, failure counter; shows 'pending Rostrum data' if Rostrum empty | HIGH | [ ] |
| 4 | Check recommended cap for Augur | Shows perActionUsd: 250, dailyUsd: 2500, expiryDays: 14 (from Sigil contract, not hardcoded) | MED | [ ] |
| 5 | Click Copy-trade CTA | Links to /app/agents?copy=augur or similar intent-based workflow | HIGH | [ ] |

*States to verify:* Agent loaded / Performance pending (Rostrum empty) / Deboost inactive / Deboost active / Copy-trade CTA visible
*Hunt for these flaws:*
- Agent not found (404 instead of graceful error)
- Stale performance data (> 10min old without 'pending' label)
- Missing data source badges (shows empty state incorrectly)
- Chart doesn't render (JS error in recharts or d3)
- Dead Copy-trade link (404)
- Recommended caps are fake (hardcoded, not from Sigil)
- Deboost status never updates (stale Rostrum data)
- Cap envelope JSON is fake (not real Sigil values)
- Mobile layout broken (chart doesn't fit)
- Missing agent description text

#### 1.12 Page: /
*Where:* `apps/verify/src/app/page.tsx`
*Purpose:* Marketing landing hero with venue status (Live/Pending tags), subsystems grid (Plinth, Sigil, Vigil, Lantern, Coffer, Postern), CTAs to /app and /verify/1, real test collateral amounts

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load / | Hero loads with 'Arbitrum Sepolia' + 'Verifier Mode' + subsystems grid (6 cards) + venue status badges + 2 main CTAs visible | HIGH | [ ] |
| 2 | Check venue status badges | Shows 'Live' for deployed venues, 'Pending' for scaffold; honest keeper count (e.g., 2/3 up, not 3/3 fake) | BLOCKER | [ ] |
| 3 | Click 'Open testnet' CTA | Routes to /app/portfolio (or login screen if not connected) | HIGH | [ ] |
| 4 | Click 'Verify protocol' CTA | Routes to /verify/1 (verifier step 1: Deposit USDC) | HIGH | [ ] |
| 5 | Check subsystem descriptions | All text is real (not placeholder 'Coming Soon...' or TBD) | MED | [ ] |

*States to verify:* All systems live / Some systems pending / Load complete / Hero rendered / Subsystems grid visible
*Hunt for these flaws:*
- Fake TVL numbers shown as real
- Venue status shows 3/3 keepers when only 2 are up
- Subsystem descriptions are placeholder text
- CTA links broken (404)
- Grid layout broken on mobile (cards overlap)
- No WagmiProvider so connect wallet fails
- Stale venue data (> 10min old without 'pending' label)
- Hero never finishes loading (animation stuck)
- Copy contains typos or grammatical errors

#### 1.13 Page: /docs
*Where:* `apps/verify/src/app/docs/page.tsx`
*Purpose:* Documentation hub linking to 8 GitHub markdown files + 2 local pages + ADR list + 3 info cards (Adapter spec, Sigil schema, SPAN scenarios); honest disclosures section

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /docs | All 8 GitHub links visible + 2 local links (/docs/honesty, /docs/api) + 3 cards + ADR list (ADR-001 through ADR-012) | HIGH | [ ] |
| 2 | Click GitHub link to ATRIUM_PRD.md | Opens GitHub raw/blob with PRD (2297 lines) in new tab or modal | MED | [ ] |
| 3 | Check honest disclosures section | Shows 'Three venues (Aave V3, Pyth equity feeds, Hyperliquid) are mocked or relayed on testnet' clearly | BLOCKER | [ ] |
| 4 | Click /docs/honesty link | Routes to /docs/honesty page (8 disclosures list) | HIGH | [ ] |
| 5 | Click /docs/api link | Routes to /docs/api page (Codex x402 API, 8 endpoints) | HIGH | [ ] |

*States to verify:* All links present / Links functional / Honest disclosures visible / ADR list complete
*Hunt for these flaws:*
- Missing links (< 8 GitHub shown)
- Dead GitHub links (404 or timeout)
- Honest disclosures missing or incomplete
- ADR list incomplete (< 12 shown)
- Local links broken (404)
- Cards missing descriptions
- No back navigation from /docs/* pages
- Mobile layout broken (links unreadable)
- Doc dates shown as outdated (last-updated > 1 month ago)

#### 1.14 Page: /docs/honesty
*Where:* `apps/verify/src/app/docs/honesty/page.tsx`
*Purpose:* 8 live disclosures of mocked systems, relayed data, stubbed services on testnet

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /docs/honesty | Shows 8 items (e.g., 'Aave V3 is mocked via MockAavePool', 'Hyperliquid is relayed from testnet validator', 'Pyth equity feeds are stubbed') | BLOCKER | [ ] |
| 2 | Check each disclosure matches landing copy | 'Three venues...' sentence in /docs/honesty matches / page exactly (no inconsistency) | HIGH | [ ] |
| 3 | Mobile responsive (< 768px) | Text readable, no overflow, list items stacked | MED | [ ] |

*States to verify:* All 8 disclosures visible / Disclosures accurate / Copy consistent with landing page
*Hunt for these flaws:*
- Missing disclosures (< 8 items)
- Inaccurate wording (says 'live' when 'mocked')
- Dead explanations (placeholder text)
- Inconsistency with landing page wording
- Mobile text unreadable

#### 1.15 Page: /docs/api
*Where:* `apps/verify/src/app/docs/api/page.tsx`
*Purpose:* Codex x402 API reference with 8 endpoints, request/response examples, authentication requirements

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /docs/api | Shows all 8 Codex endpoints with method, path, description, example request/response | HIGH | [ ] |
| 2 | Check authentication instructions | Shows x402 (x-api-key header or on-chain proof) requirements with examples | MED | [ ] |
| 3 | Mobile responsive (< 768px) | Code blocks scrollable, examples readable, no overflow | MED | [ ] |

*States to verify:* All 8 endpoints documented / Examples clear / Authentication explained
*Hunt for these flaws:*
- Missing endpoints (< 8 shown)
- Example responses are fake (don't match real API)
- Dead links to Codex repo
- Authentication docs missing
- Mobile code blocks overflow without scroll

#### 1.16 Page: /security
*Where:* `apps/verify/src/app/security/page.tsx`
*Purpose:* Security posture, disclosure policy, audit-findings register, design-intent bullets (Kani, dual oracle, 3-keeper redundancy, Praetor, etc.), bug bounty, vulnerability disclosure

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /security | Shows 'Atrium targets Arbitrum Sepolia testnet in Year 1. No user funds at real economic risk.' prominently | BLOCKER | [ ] |
| 2 | Check design-intent bullets | Lists all 9: Kani (3/5 wired, 5 by Month 6), dual oracle (Chainlink+Pyth 50bps 60s), 3-keeper, Praetor 3-of-5 Safe+48h, ERC-7201, per-adapter cap, Kill Switch, Vigil redundancy, updateability | HIGH | [ ] |
| 3 | Check AuditFindingsTable | Loads latest audit register, refreshes on page load (not cached > 1h old) | HIGH | [ ] |
| 4 | Click disclosure email (security@atrium.fi) | Opens mail client or shows email formatted correctly | MED | [ ] |
| 5 | Check bug-bounty info | Says 'Year 1 testnet pending, Year 2 mainnet formal Immunefi-style before flip' with timeline | MED | [ ] |

*States to verify:* Design-intent bullets present / Table loaded / Table refreshes on load / Email visible / Bug bounty terms clear
*Hunt for these flaws:*
- Design-intent bullets are outdated (Kani count wrong, oracle tolerance wrong)
- AuditFindingsTable doesn't refresh (shows stale findings > 1h old)
- Security email wrong or malformed
- No PGP key link (.well-known/pgp.asc)
- Bug bounty text is fake (says 'live' when pending)
- Missing /docs/honesty link
- Mobile table breaks (findings unreadable)

#### 1.17 Journey: Verify Protocol (7-Step Verifier Flow)
*Where:* `apps/verify/src/app/verify/[step]/page.tsx`
*Purpose:* 7-step testnet launch-readiness journey: Step 1 (Deposit USDC) → Step 2 (Open position) → Step 3 (See margin saving) → Step 4 (Chaos Mode) → Step 5 (Liquidation drill) → Step 6 (Verify proof-of-reserves) → Step 7 (Kill Switch revoke)

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /verify/1 | Shows Deposit step instructions + form (input USDC amount, confirm Coffer deposit) with clear next steps | HIGH | [ ] |
| 2 | Complete step 1 | 1000 USDC locked in Coffer, shares minted, Plinth margin account opens, 'Next' button appears | BLOCKER | [ ] |
| 3 | Click 'Next' from step 1 | Routes to /verify/2 (Trade step) | HIGH | [ ] |
| 4 | Complete step 2 (Open position) | Single-leg trade executes on one venue, margin saved visible in portfolio context, next button active | HIGH | [ ] |
| 5 | Load /verify/4 (Chaos Mode) | Shows Chaos Mode instructions + 'Trigger chaos fault' button (if Chaos contract deployed) | MED | [ ] |
| 6 | Trigger chaos fault | One of 5 faults injects (oracle drift, keeper offline, partial fill, gas spike, indexer stall); app remains responsive | HIGH | [ ] |
| 7 | Load /verify/6 (Reserves verify) | Shows Lantern proof-of-reserves with Merkle root + VerifyMyBalanceButton, latest attestation | HIGH | [ ] |
| 8 | Load /verify/7 (Kill Switch) | Shows Kill Switch explanation (revokes all Sigil mandates, cancels all Postern session keys, returns wallet to base EOA) | HIGH | [ ] |

*States to verify:* Step 1 (Deposit) active / Step 2 (Trade) active / Step 3 (Margin) active / Step 4 (Chaos) active / Step 5 (Liquidation) active / Step 6 (Reserves) active / Step 7 (Kill Switch) active / Journey complete
*Hunt for these flaws:*
- Missing steps (< 7 shown)
- Step copy outdated (e.g., Step 2 says 'hedged-flow ships in follow-up')
- Forms don't submit (silent failure)
- Margin calculation broken (shows wrong number)
- Chaos Mode never injects fault (button dead or does nothing)
- Liquidation drill doesn't execute (no Vigil event)
- Merkle proof never computes
- Kill Switch never revokes (silent failure)
- Navigation buttons broken (can't go to next step)
- Mobile layout broken (forms unreadable)
- No error messages on failure (user doesn't know what went wrong)

#### 1.18 Page: /team
*Where:* `apps/verify/src/app/team/page.tsx`
*Purpose:* Founding team placeholder with 'How we work' principles (5 items); TODO to replace with real founder identities when sign-off lands

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /team | Shows 'TODO: Replace with real founder identities when sign-off lands' + 3 placeholder founders + 'How we work' section | MED | [ ] |
| 2 | Check 'How we work' principles | Shows 5 items (Honesty, Best product, Live dashboards never inflate, Tripwires beat silent slips, No fake immutability) with explanations | HIGH | [ ] |
| 3 | Check contact email | Shows security@atrium.fi + 'PGP key linked from /security' | MED | [ ] |
| 4 | Mobile responsive (< 768px) | Text readable, no overflow | MED | [ ] |

*States to verify:* Placeholder identities visible / Principles listed / Contact info visible / TODO visible (if still placeholder)
*Hunt for these flaws:*
- TODO comment not visible (real founders might be showing)
- Placeholder names are misspelled
- 'How we work' principles incomplete (< 5 items)
- Contact info is outdated or wrong
- Mobile text unreadable
- Missing link to /security for PGP key

#### 1.19 Page: /brand
*Where:* `apps/verify/src/app/brand/page.tsx`
*Purpose:* Brand kit source of truth: I. Logo (wordmark sizes, app-icon gallery, construction), II. Typography (7 specimens), III. Colour (8 swatches), IV. Components (buttons, status pills, numerals), V. Voice (Do/Don't), VI. Trademark, VII. Download

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /brand | Shows all 7 sections (I-VII) in order, renders without error | HIGH | [ ] |
| 2 | Check Wordmark samples | Shows hero (full width), lg, md, sm samples + light/dark context variants matching design/Brand Kit.html canon | HIGH | [ ] |
| 3 | Check App icon gallery | Shows 160/64/32/16px icons + 3 status states (testnet amber, healthy green, critical red) with correct status-bar colors | HIGH | [ ] |
| 4 | Verify Construction spec | Shows all 9 items: typeface, dimensions, tracking, A letterform, optical correction, optical centre, minimum size, status bar, clear space, animation | MED | [ ] |
| 5 | Check Typography specimens | Shows 7 styles with correct sizes and typefaces (Display 64px, Section 40px, Title 22px, Body 17px, Figures 14px mono, Labels 11px mono, Wordmark Instrument Serif) | HIGH | [ ] |
| 6 | Check Colour swatches | All 8 swatches with OKLCH + HEX values matching globals.css tokens (paper, ink, accent oxblood, live moss, testnet amber, neg clay, line, muted) | BLOCKER | [ ] |
| 7 | Check Voice section | Shows 'Do' example (specific, declarative, architectural) and 'Don't' example (hyped, vague, memed) | MED | [ ] |
| 8 | Click Download | Downloads or shows ZIP with SVG/PNG/ICO assets (wordmark, icon, typefaces) | HIGH | [ ] |

*States to verify:* All 7 sections loaded / Samples visible / Swatches visible / Download working
*Hunt for these flaws:*
- Missing sections (< 7 shown)
- Wordmark samples don't match design (wrong italic angle, tracking)
- App icon status bar wrong color (doesn't match palette)
- Construction spec has wrong values (dimensions don't match built assets)
- Typography specimens use wrong typeface or wrong size
- Colour swatches don't match globals.css (OKLCH/HEX mismatch)
- Voice examples are generic (not Atrium-specific)
- Trademark rules incomplete
- Download links broken (404)
- Mobile swatches unreadable (colors too close together)

#### 1.20 Page: /changelog
*Where:* `apps/verify/src/app/changelog/page.tsx`
*Purpose:* Public-facing release timeline with 4 published milestones (v0.2.1, v0.2.0, v0.1.0, pre-v0.1) linked to git tags + dates, release summaries

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /changelog | Shows all 4 releases (v0.2.1, v0.2.0, v0.1.0, pre-v0.1) with tags, dates (2026-05-25, 2026-05-25, 2026-05-23, 2026-05-18), titles, summaries | HIGH | [ ] |
| 2 | Check v0.2.1 summary | Says 'Closed every code-doable item from post-launch contract + integration audit...' | MED | [ ] |
| 3 | Check v0.2.0 summary | Says 'Subgraph completeness, Vigil keeper live, ResearchAttestation, 3-of-5 multisig...' | MED | [ ] |
| 4 | Check v0.1.0 summary | Says 'LanternAttestor, validator bootstrap, MockAavePool, Chaos Mode wired, OnboardingFlow...' | MED | [ ] |
| 5 | Check footer links | Links to /security and /docs/honesty are present and functional | MED | [ ] |

*States to verify:* All 4 releases visible / Dates correct / Summaries present / Footer links working
*Hunt for these flaws:*
- Missing releases (< 4 shown)
- Release dates wrong (not matching git tags)
- Summaries are placeholder or incomplete
- Footer links broken (404)
- Mobile layout broken (cards unreadable)

#### 1.21 Page: /cohort
*Where:* `apps/verify/src/app/cohort/page.tsx`
*Purpose:* Named design partners on Arbitrum Sepolia testnet; 'We never inflate this page. If a partner has not committed in writing, they do not appear'; CohortGrid with on-chain Scribe query data

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /cohort | Shows 'named design partners using Atrium on Arbitrum Sepolia today. Numbers from on-chain Scribe queries' + CohortGrid | HIGH | [ ] |
| 2 | Check partner data | Shows only partners who have 'committed in writing' (not inflated list with phantom partners) | BLOCKER | [ ] |
| 3 | Check CohortGrid | Shows partner names, icons, activity metrics from Scribe (real data, not fake) | MED | [ ] |
| 4 | Click 'Email cohort@atrium.fi' CTA | Opens mail client or shows email formatted correctly | MED | [ ] |
| 5 | Mobile responsive (< 768px) | Grid becomes single column, text readable | MED | [ ] |

*States to verify:* Partners loaded / Partners empty (none yet) / Email working / Metrics real
*Hunt for these flaws:*
- Inflated partner list (shows partners who didn't commit in writing)
- Stale partner data (> 1h old from Scribe, no refresh on load)
- CohortGrid empty when partners exist (Scribe query failed silently)
- Email link broken
- Mobile grid doesn't stack
- Missing 'We never inflate' message
- Fake activity metrics shown

#### 1.22 Page: /manifesto
*Where:* `apps/verify/src/app/manifesto/page.tsx`
*Purpose:* Why Atrium exists; 'What we will not do' (5 items), 'What we will' (5 items), 'What we are building toward'; illustrative scenario + backtest reference

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /manifesto | Shows hedged-trader scenario + 'What we will not do' (5 items) + 'What we will' (5 items) + 'What we are building toward' section | HIGH | [ ] |
| 2 | Check 'will not' items | Lists all 5: (1) Invent impressive number, (2) Claim unsigned partner, (3) Ship lying CI badge, (4) Treat formal verification as sticker, (5) Hide failure modes | HIGH | [ ] |
| 3 | Check 'will' items | Lists all 5: (1) Testnet Year 1, (2) Upgradeable with multisig+48h, (3) Proofs every ≤10min, (4) Open-source adapters, (5) Bounded agent mandates | HIGH | [ ] |
| 4 | Check backtest reference | Links or references to services/archive/research/ or similar validation source | MED | [ ] |
| 5 | Mobile responsive (< 768px) | Text readable, no overflow | MED | [ ] |

*States to verify:* Will not items listed / Will items listed / Building toward section visible / Backtest referenced
*Hunt for these flaws:*
- Missing items (< 5 in either section)
- Items are placeholder text
- Backtest reference is broken (file doesn't exist)
- Copy doesn't match philosophy (sounds hyped, not restrained)
- Mobile text unreadable

#### 1.23 Page: /press
*Where:* `apps/verify/src/app/press/page.tsx`
*Purpose:* Brand assets, boilerplate copy, press contacts for journalists; Boilerplate, Logo+wordmark card, Download ZIP card, Logo guidelines (4 rules), press@atrium.fi contact

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /press | Shows boilerplate + 2 cards (logo, download ZIP) + logo guidelines (4 items) + email contact | HIGH | [ ] |
| 2 | Check boilerplate copy | Defines Atrium and mentions 48-hour timelock, cross-margin, Arbitrum Sepolia testnet | MED | [ ] |
| 3 | Click 'View brand page' link | Routes to /brand page | HIGH | [ ] |
| 4 | Click 'Download press kit (.zip)' link | Downloads ZIP file with wordmark + icon assets | MED | [ ] |
| 5 | Check logo guidelines | Shows 4 rules: (1) clear space, (2) no stretch/rotate/recolor, (3) dark/light variants, (4) 24px min digital | MED | [ ] |

*States to verify:* All cards visible / Download working / Email present / Guidelines listed
*Hunt for these flaws:*
- Missing cards (boilerplate or guidelines)
- ZIP download returns 404
- Links broken (brand page link dead)
- Email address wrong or missing
- Guidelines incomplete (< 4 items)
- Mobile cards unreadable
- No indication that email routing is incomplete (if still pending)

#### 1.24 Page: /legal/terms
*Where:* `apps/verify/src/app/legal/terms/page.tsx`
*Purpose:* Self-drafted GDPR/CCPA-compliant Terms of Service for Atrium Verifier Mode on Arbitrum Sepolia testnet; 13 sections, note that lawyer review is scheduled pre-mainnet

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /legal/terms | Shows 'Note: This document is self-drafted GDPR/CCPA-compliant template. Lawyer review scheduled pre-mainnet.' prominently | BLOCKER | [ ] |
| 2 | Check all section titles | Shows all 13: Service definition, Eligibility, Acceptable use, License, Disclaimers, Liability, Indemnification, Governing law, Dispute resolution, Excluded jurisdictions, Term, Severability, Contact | HIGH | [ ] |
| 3 | Check section 1 (Service definition) | Says 'testnet-only' + 'No real funds involved' + 'Tokens are testnet USDC' | BLOCKER | [ ] |
| 4 | Check section 2 (Eligibility) | Shows 4 conditions: age 18+, not OFAC-sanctioned, not US person for perp trading, provide own hardware | HIGH | [ ] |
| 5 | Check section 6 (Liability) | Says 'Total aggregate liability capped at $0 USD for testnet period (v1)' | BLOCKER | [ ] |
| 6 | Check Governing law (section 8) | Says 'Cayman Islands' + rationale for choice | MED | [ ] |
| 7 | Check links to /privacy and /security | Both links present and functional | MED | [ ] |

*States to verify:* Note box visible / All 13 sections present / Liability cap shown / Governing law stated
*Hunt for these flaws:*
- Note box missing (doesn't flag self-drafted status)
- Section count wrong (< 13 shown)
- Liability cap says '$X USD' instead of '$0'
- 'testnet-only' warning missing from section 1
- Links to /privacy or /security broken
- Text is placeholder or incomplete
- Governing law is not Cayman Islands
- Mobile text unreadable


### 1.cov Full page coverage (all 45 routes)

Every route must get at least the **S1 Global checklist**. Routes marked "Deep" also have scripted cases above.

| Route | Coverage | Pass |
|-------|----------|------|
| `/accessibility` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/agents/marketplace` | Deep - see section 1 | [ ] |
| `/agents/marketplace/[id]` | Deep - see section 1 | [ ] |
| `/app` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/app/agents` | Deep - see section 1 | [ ] |
| `/app/markets` | Deep - see section 1 | [ ] |
| `/app/notifications` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/app/onboarding` | Deep - see section 1 | [ ] |
| `/app/portfolio` | Deep - see section 1 | [ ] |
| `/app/portfolio/activity` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/app/reserves` | Deep - see section 1 | [ ] |
| `/app/settings` | Deep - see section 1 | [ ] |
| `/app/tax` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/app/trade` | Deep - see section 1 | [ ] |
| `/app/transfer` | Deep - see section 1 | [ ] |
| `/app/vault` | Deep - see section 1 | [ ] |
| `/benchmarks` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/beta` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/brand` | Deep - see section 1 | [ ] |
| `/changelog` | Deep - see section 1 | [ ] |
| `/chaos` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/cohort` | Deep - see section 1 | [ ] |
| `/cohort/[id]` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/docs` | Deep - see section 1 | [ ] |
| `/docs/api` | Deep - see section 1 | [ ] |
| `/docs/honesty` | Deep - see section 1 | [ ] |
| `/internal/scribe-health` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/lantern` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/lantern/sla` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/learn` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/legal/kyc` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/legal/privacy` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/legal/sub-processors` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/legal/terms` | Deep - see section 1 | [ ] |
| `/loadtest` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/manifesto` | Deep - see section 1 | [ ] |
| `/page.tsx` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/press` | Deep - see section 1 | [ ] |
| `/rostrum` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/security` | Deep - see section 1 | [ ] |
| `/security/bounty` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/security/hall-of-fame` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/sla` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/team` | Deep - see section 1 | [ ] |
| `/verify/[step]` | Smoke pass (apply the Global checklist in S1) | [ ] |

---

## 2. End-to-end user journeys

> Professional launch-readiness QA test plan for Atrium user journeys dimension. Covers 12 end-to-end flows grounded in real code: onboarding, vault deposit/withdraw, trade open/close, cross-chain transfer, agent mandate delegation, Lantern balance verification, chaos mode injection, kill-switch revocation, tax export, and agent marketplace browsing. Each journey maps to concrete API endpoints, components, and contract ABIs. All test cases validate honest data rendering (no fabricated numbers), proper error states, and correct wallet scoping via the useScopedWallet hook. Severity levels reflect blocker risks (auth failures, wrong data, unrecoverable states) vs. polish issues.

#### 2.1 Journey: SIWE Login + Passkey Authenticator (Onboarding Step 1-2)
*Where:* `apps/verify/src/app/api/auth/nonce/route.ts`
*Purpose:* Verify passkey-based authentication via WebAuthn (navigator.credentials.create) and SIWE (Sign-In with Ethereum) login flow is secure, recovers from errors honestly, and creates a session that gates subsequent authenticated routes (/app/*).

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to /app/onboarding. Observe Welcome step. Click 'Set up authenticator'. | Authenticator step loads with 'Waiting for authenticator...' message. Browser prompts for WebAuthn credential creation (platform authenticator or security key). | BLOCKER | [ ] |
| 2 | Complete WebAuthn passkey creation. Authenticator generates ES256 or RS256 key pair, returns attestation. UI processes response. | SecondDeviceWarning modal appears explaining recovery risks (3 paths: 2nd device passkey, 3 guardians, TOTP app). Modal has 'I understand · continue' and 'Remind me later' buttons. | HIGH | [ ] |
| 3 | Click 'I understand · continue' in SecondDeviceWarning. | Modal closes. Faucet step loads. Wallet is NOT automatically connected yet (no Postern or MetaMask wallet selected). Faucet shows 'Faucet pending' button (disabled) with reason from /api/faucet/status. | HIGH | [ ] |
| 4 | WebAuthn credential unavailable (browser doesn't support, user cancels). UI waits 60 seconds then times out. | Clear error message: 'WebAuthn not available' or 'Signing was cancelled'. No silent failure. 'Try again' CTA to restart. | BLOCKER | [ ] |
| 5 | Complete authenticator step. Browser prompts for SIWE signature (MetaMask, Postern, WalletConnect). User signs the nonce. | Session is created (HTTP-only cookie or secure token stored). User is logged in. localStorage persists onboarding progress under 'atrium_onboarding_v1'. | BLOCKER | [ ] |
| 6 | Restart browser. Navigate to /app/portfolio without reconnecting wallet. | User is still authenticated (session valid). Portfolio page loads with connected wallet's data (or DEMO_WALLET_ADDRESS if no wallet connected). | BLOCKER | [ ] |
| 7 | Call /api/auth/logout via the app header or navigate to /api/auth/logout?returnTo=/. | Session cookie is cleared. Next page load redirects to /. Attempting /app/* redirects back to /. | HIGH | [ ] |

*States to verify:* WebAuthn challenge (32-byte random) generated server-side, not mocked / Passkey credential securely stored in browser/device / SIWE message includes nonce and Arbitrum Sepolia chainId (421614) / Session cookie is HttpOnly, Secure, SameSite=Strict / Second device warning modal displays 3 real recovery paths, not placeholders / Logout clears all auth state without data leakage
*Hunt for these flaws:*
- WebAuthn timeout hardcoded to unrealistic value (< 10s or > 120s)
- Browser error 'WebAuthn not available' not surfaced to user (silent failure)
- SIWE signature validation accepts wrong chainId (e.g., mainnet)
- Session leaks authenticated user data in logs or error messages
- Second device warning modal is skippable without confirming recovery risks
- Logout doesn't clear localStorage/sessionStorage (session hijacking risk)

#### 2.2 Journey: Faucet Claim (Onboarding Step 3)
*Where:* `apps/verify/src/lib/use-local-storage.ts`
*Purpose:* Verify faucet claim endpoint returns honest availability status (reads on-chain stock, cooldown, and wallet history), handles out-of-stock gracefully, and gates claim action until user has testnet USDC + ETH.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Faucet step active. User not yet claimed. Call GET /api/faucet/status?wallet=0x<user>. | Response: { available: true/false, reason: <null or blocker string>, faucetUsdcBalance: 123.45, faucetEthBalance: 0.5, usdcDrop: 10.0, ethDrop: 0.1, walletCooldownRemainingSec: 0, source: 'faucet' }. Concrete numbers from on-chain Faucet contract. | BLOCKER | [ ] |
| 2 | Faucet has stock (usdcBalance >= usdcDrop, ethBalance >= ethDrop, wallet cooldown elapsed). Click 'Claim USDC + ETH'. | Button shows spinner. TX submitted. On success: { status: 'success', txHash: '0x...' }. Button becomes 'Claimed' with Arbiscan link. | BLOCKER | [ ] |
| 3 | Faucet USDC stock depleted (balance < drop amount). User attempts claim. | Button disabled. Reason text: 'Faucet USDC stock 2.5 below per-claim drop 10.0'. No TX submitted. Honest message, not 'Faucet deploys Month X'. | HIGH | [ ] |
| 4 | Wallet has claimed once. Cooldown is 86400 seconds (24h). User attempts second claim < 24h later. | Button disabled. Reason text: 'Wallet cooldown 43200s remaining' (example: 12 hours left). Time-accurate, not hardcoded. | HIGH | [ ] |
| 5 | RPC node is down or returns error. Call /api/faucet/status. | Response: { available: false, reason: 'RPC probe failed: <error message>', source: 'pending' }. Max 120 chars of error detail (not full stack). No 500 error; graceful fallback. | HIGH | [ ] |
| 6 | User skips faucet claim ("Skip" button). No USDC/ETH claimed. | Advance to next step (Margin Posted). Can later access /app/transfer to deposit collateral manually without faucet. | MED | [ ] |

*States to verify:* Faucet stock (USDC + ETH) read from contract immutables + balanceOf, not mocked / Cooldown per-wallet tracked in lastClaim[wallet], time-accurate / available=true iff: hasUsdcStock AND hasEthStock AND cooldownRemainingSec==0 / RPC errors caught and surfaced with truncated message (max 120 chars) / Arbiscan TX link validates hash format before rendering (no fake links) / Skip button allows progression without claiming
*Hunt for these flaws:*
- Stock values hardcoded instead of read from contract
- Cooldown always shows '0s remaining' even if user claimed < 24h ago
- RPC failures cause 500 error instead of graceful pending response
- Full RPC error message exposed (leak internals)
- available=true when stock is insufficient (logic inverted)
- Arbiscan link rendered without validating TX hash format

#### 2.3 Journey: Vault Deposit USDC (Verifier Step 1 + /app/vault + Onboarding Step 4)
*Where:* `apps/verify/src/app/api/deployments/status/route.ts`
*Purpose:* Verify vault (Coffer ERC-4626) deposit flow: user connects wallet, approves USDC spend, deposits into vault, receives erc4626 shares, and portfolio margin is correctly computed as collateral by Plinth.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to /app/vault on Arbitrum Sepolia. Wallet connected with 10+ USDC. | VaultDeposit card shows: 'Deposit USDC'. Input field accepts decimal amounts. 'Max' button fills with wallet's USDC balance. Deposit button enabled. | HIGH | [ ] |
| 2 | Enter 5.5 USDC (valid amount). Click 'Approve USDC spend' button. | TX submitted: ERC20.approve(Coffer, 5.5e6 wei). Button shows 'Approving...'. On success: approval granted. Next step: 'Deposit' button becomes enabled. | BLOCKER | [ ] |
| 3 | Click 'Deposit' after approval. | TX submitted: Coffer.deposit(5.5e6, receiver=session.wallet). Button shows 'Depositing...'. On success: { status: 'success', depositHash: '0x...' }. Arbiscan link rendered. | BLOCKER | [ ] |
| 4 | Deposit TX confirmed. Refresh page. Call GET /api/portfolio/summary?wallet=0x<user>. | Response includes: { totalAccountValueUsd: '5.50', source: 'plinth' } (or actual USDC + accrued yield). Number formatted via formatUsd (locale-rounded, thousands separator). No pending placeholder. | BLOCKER | [ ] |
| 5 | User deposits before faucet claim (no ETH for gas). | TX fails with 'insufficient funds for gas'. Error message: 'Insufficient ETH for gas. Claim testnet ETH from the faucet.' Clear CTA, not generic revert. | HIGH | [ ] |
| 6 | USDC is paused on-chain (audit C-23). User attempts deposit. | TX reverts: ERC20Pausable(USDC).paused == true. Error: 'USDC is paused. Cannot deposit at this time.' Help text links to /sla or status page. | BLOCKER | [ ] |
| 7 | TVL drops > 30% in one block (circuit-breaker triggered). User attempts deposit. | TX reverts: Coffer.circuitBreakerTriggered(). Error: 'Circuit breaker active: TVL drop > 30%. Withdrawals blocked until stabilization.' Estimated wait time shown. | BLOCKER | [ ] |
| 8 | Coffer not deployed. /api/deployments/status?step=1 returns { ready: false, blocker: 'coffer-not-deployed' }. | VaultDeposit button disabled. Banner: 'Step not ready · Blocker: coffer not deployed. The contract for step 1 is not fully wired on this network.' | HIGH | [ ] |

*States to verify:* Deposit amount accepted only in valid USDC range (> 0, <= balance, <= uint128 max) / Approval TX includes correct recipient (Coffer) and amount / Deposit TX transfers shares to receiver (msg.sender), not to a fixed address / Portfolio summary reflects deposited amount in totalAccountValueUsd (no delay > 1 block) / formatUsd applies locale rounding and thousands separator correctly / Circuit breaker read from Coffer.circuitBreakerTriggered() / USDC paused status checked via ERC20Pausable.paused() / Deployment readiness gated via /api/deployments/status before TX submission
*Hunt for these flaws:*
- Deposit amount not validated (negative, zero, or overflow accepted)
- Approval TX points to wrong recipient (not Coffer)
- Shares sent to hardcoded address instead of msg.sender
- Portfolio value cached (shows stale balance after deposit)
- formatUsd truncates instead of rounding (1.99 for 1.999)
- Circuit breaker not checked (deposit succeeds when TVL dangerous)
- USDC pause status ignored (deposit succeeds when paused)
- Deployment blocker not rendered (user submits TX that reverts on-chain)

#### 2.4 Journey: Vault Withdraw USDC + Withdrawal SLA
*Where:* `apps/verify/src/app/api/portfolio/summary/route.ts`
*Purpose:* Verify vault withdrawal flow: user redeems ERC-4626 shares for USDC, receives funds within SLA (≤1 block ≈250ms when circuit-breaker inactive, ≤10 min attestation via Lantern when breaker active), and balance reflects immediately in portfolio.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | User has 10 ERC-4626 shares in Coffer. Navigate to /app/vault. VaultWithdraw card shows: 'Withdraw USDC'. | Input accepts decimal shares. 'Max' button fills with user's share balance. Expected output (USDC to receive) previewed in real-time as user types. | HIGH | [ ] |
| 2 | Enter 5.0 shares (valid amount). Click 'Withdraw'. | TX submitted: Coffer.withdraw(5.0e18, receiver, owner). Button shows 'Withdrawing...'. On success: { status: 'success', withdrawHash: '0x...' }. Arbiscan link rendered. | BLOCKER | [ ] |
| 3 | Withdrawal TX confirmed. Circuit breaker NOT active. Check USDC balance in wallet (off-chain via wallet UI) and portfolio API within 1 block. | Balance updated within 1 block (≈250ms on Arbitrum). Portfolio /api/portfolio/summary reflects new balance immediately (no delay > 1 block). | BLOCKER | [ ] |
| 4 | Circuit breaker IS active (TVL drop > 30%). User initiates withdrawal. | TX succeeds but shares placed in withdrawal queue. UI shows: 'Withdrawal queued (SLA: ≤10 min via Lantern attestation)'. Estimated clearance time shown. | HIGH | [ ] |
| 5 | User tries to withdraw more shares than held (e.g., 100 shares, only 10 owned). | TX reverts: ERC4626.withdraw insufficient shares. Error: 'Insufficient shares. Max: 10.0 shares.' No silent failure. | HIGH | [ ] |
| 6 | User withdraws all shares (balance -> 0). Refresh page. Portfolio summary should show zero collateral. | totalAccountValueUsd: '0.00'. No orphaned data. Can re-deposit to rebuild. | HIGH | [ ] |
| 7 | Virtual-shares offset (audit B-7) applied during withdrawal. Verify math. | Shares redeemed correctly accounting for offset. User receives stated USDC amount (no silent loss). | HIGH | [ ] |

*States to verify:* Withdrawal amount validated (> 0, <= user balance, <= uint256 max) / USDC received = shares * sharePrice, where sharePrice includes vault yield + virtual-shares offset / Circuit breaker state read from Coffer.circuitBreakerTriggered() / When breaker inactive: USDC in wallet within 1 block; portfolio summary updated immediately / When breaker active: shares queued; withdrawal queue can be viewed (Lantern attestation triggers clearance) / Withdrawal SLA: ≤250ms normal, ≤10 min when breaker active (documented in /sla) / Virtual-shares offset (audit B-7) applied correctly in math (user gets full stated USDC)
*Hunt for these flaws:*
- Withdrawal amount not validated (negative, zero, or overflow)
- USDC not credited to wallet (funds stuck in contract)
- Circuit breaker state read only once at page load (stale for in-flight TXs)
- Portfolio summary not updated after withdrawal (shows stale balance)
- Virtual-shares offset not applied (user loses yield/faces rounding)
- Withdrawal queued even when breaker inactive (unnecessary delay)
- SLA timer shows wrong deadline (hardcoded instead of computed from block time)

#### 2.5 Journey: Open Position (Trade + Verifier Step 2)
*Where:* `apps/verify/src/app/api/portfolio/positions/route.ts`
*Purpose:* Verify trade order submission flow: user selects venue (Hyperliquid, Aave, Pendle), enters order details (size, price, direction), submits via Portico adapter, and position appears in portfolio with live margin impact.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to /app/trade. User has collateral (USDC shares in vault). TradeView loads. | Venue pills visible: 'HL', 'Aave', 'Pendle', 'PMK'. OrderForm shows: Instrument, Side (Buy/Sell), Size, Price, Preview (margin impact). User selects Hyperliquid. | HIGH | [ ] |
| 2 | Select 'HYPE/USD perp' instrument on Hyperliquid. Enter: Side=Long, Size=1.0, Price=5.50. | Order preview updates: notional=$5.50, initial-margin-req=$0.27 (at 20x leverage). Buying power decreases. Preview shows: 'Remaining buying power: $50.00'. | HIGH | [ ] |
| 3 | Click 'Submit Order'. | TX submitted via Portico.executeOrder(venue='hl', order={ ... }). Button shows 'Submitting...'. On success: { status: 'success', orderHash: '0x...' }. | BLOCKER | [ ] |
| 4 | Order confirmed. Refresh /app/portfolio. Call GET /api/portfolio/positions?wallet=0x<user>. | Response includes new position: { venue: 'hl', instrument: 'HYPE/USD', side: 'long', size: 1.0, entryPrice: 5.50, collateral: 0.27, status: 'open' }. Portfolio stat row updates: notional += $5.50. | BLOCKER | [ ] |
| 5 | User attempts order with size exceeding buying power (e.g., 100 HYPE at $5.50 = $550 notional, but only $50 buying power). | TX reverts: Plinth.requireBuyingPower fails. Error: 'Insufficient buying power. Required: $550.00, available: $50.00.' Order not opened. | BLOCKER | [ ] |
| 6 | Venue adapter (e.g., HyperliquidAdapter) not authorized on Portico. | TX reverts: Portico.executeOrder fails. Error: 'Venue not authorized. Contact team to whitelist this venue.' Clear error, not generic 'tx reverted'. | HIGH | [ ] |
| 7 | Order partially filled (venue fills 0.5 HYPE out of 1.0 requested). | Position reflects filled size (0.5). Fee deducted. Remaining buying power updated. No silent loss. | HIGH | [ ] |

*States to verify:* Venue pills filter OrderForm inputs to valid instruments for that venue / Order preview shows real margin requirement (reads Plinth.estimateMargin) / Buying power decreases by initial margin requirement before order confirmation / Position recorded with entry price, size, and collateral posted / Portfolio notional updated (sum of all open positions' notional) / Margin impact applies immediately (no delay in buying power calculation) / Partial fills handled correctly (position size != order size if fill < 100%)
*Hunt for these flaws:*
- Venue pills don't filter instruments (user selects invalid instrument for venue)
- Order preview shows stale margin (cached instead of live from Plinth)
- Buying power not decremented (user opens position beyond actual limit)
- Position recorded with wrong entry price (uses current market, not execution price)
- Partial fills not reflected (position size inflated)
- Fee deduction silent (user sees wrong net collateral)
- Adapter not checked for authorization before submit (TX fails predictably)

#### 2.6 Journey: Close Position (Portfolio + Vigil Liquidation Drill + Verifier Step 5)
*Where:* `apps/verify/src/app/api/portfolio/positions/route.ts`
*Purpose:* Verify position closing flow: user initiates close via portfolio 'Close' button or liquidation keeper (Vigil) automatically closes at margin threshold, realized PnL is computed, and collateral is returned.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | User has open position: 1.0 HYPE long @ $5.50 entry. Current price $6.00. Portfolio shows row: [HYPE/USD \| 1.0 \| $6.00 \| +$0.50 PnL]. Click 'Close' button on the row. | Modal or inline form: confirm close, show PnL ($+0.50), new buying power after close. Button: 'Confirm close'. | HIGH | [ ] |
| 2 | Click 'Confirm close'. User initiates close order. | TX submitted: Portico.closePosition(venue, position_id). Button shows 'Closing...'. On success: { status: 'success', closeHash: '0x...' }. | BLOCKER | [ ] |
| 3 | Close TX confirmed. Position is closed. Refresh portfolio. | Position no longer appears in open positions table. Collateral returned to Coffer balance. Portfolio notional decreases. Realized PnL ($+0.50) added to cumulative stats. | BLOCKER | [ ] |
| 4 | Position margin falls below liquidation threshold (e.g., buffer < 10%). Vigil keeper (liquidation service) detects undercollateralization at block N. | Vigil submits TX at block N+X (within SLA, documented in /sla): Vigil.liquidate(position_id, percent=50%). Partial close executes. Collateral freed for other positions. | BLOCKER | [ ] |
| 5 | Verify liquidation SLA. Vigil queues undercollateralized position; execution should complete within documented SLA (e.g., next block). | Close TX appears in activity feed with timestamp. On-chain events confirm partial/full close. Portfolio reflects new margin state. | HIGH | [ ] |
| 6 | User attempts to close with price slippage. User closes at $6.00; venue fills at $5.80 (adversarial market). | Actual realized PnL: (5.80 - 5.50) * 1.0 = $0.30 (less than preview due to slippage). Fee deducted. User sees honest PnL in activity feed. | HIGH | [ ] |
| 7 | Close fails (insufficient liquidity on venue). TX reverts. | Error: 'Cannot close position: insufficient liquidity at this price. Try a wider price range.' User can retry or partially close. | HIGH | [ ] |

*States to verify:* Close button only appears for open positions (not closed/liquidated positions) / Margin calculation includes fees before close (user sees accurate new buying power) / Realized PnL = (exit_price - entry_price) * size, adjusted for fees / Collateral fully returned to Coffer (no stuck funds) / Vigil liquidates undercollateralized positions within SLA (every block or documented cadence) / Liquidation SLA enforced (timeout -> circuit breaker + manual resolution) / Position close recorded in activity feed with timestamp + PnL
*Hunt for these flaws:*
- Close button appears for liquidated positions (user can't tell status)
- Realized PnL shown as 0 (no PnL calculation)
- Fees not deducted from realized PnL (user sees inflated profit)
- Collateral lost after close (funds not returned)
- Vigil doesn't liquidate (position remains open until user manually closes)
- Liquidation delay exceeds SLA (position margin goes negative, cascading loss)
- Slippage not reflected (user sees preview $0.50 profit but gets $0.30 actual)

#### 2.7 Journey: Chaos Mode Injection + Fault Tolerance (Verifier Step 4)
*Where:* `apps/verify/src/app/api/chaos/restore/route.ts`
*Purpose:* Verify chaos mode fault injection system: operator can pause deposits, oracle drift, keeper offline, partial fills, gas spikes, indexer stall. System must recover gracefully without data loss.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to /verify/4 (Verifier Chaos Mode step). User connected. Click 'Trigger Chaos Mode'. | Modal lists available faults: oracle-drift, keeper-offline, partial-fill-failure, gas-spike, indexer-stall. User selects one (e.g., 'oracle-drift'). Confirms. | HIGH | [ ] |
| 2 | Submit oracle-drift fault via POST /api/chaos/inject with fault='oracle-drift' (Scribe API delayed 60 blocks). | TX submitted via Praetor multisig pause governance. On success: { status: 'success' }. System is now in chaos mode. Deposits paused. Portfolio shows: 'Chaos mode active · Oracle drifted 60 blocks'. | HIGH | [ ] |
| 3 | User tries to deposit while oracle-drift is active. | Deposit reverts: Coffer.deposit() reads stale oracle. Error: 'Cannot deposit while oracle is drifted. Estimated recovery: 60 blocks (~15 min).' Clear, honest message. | HIGH | [ ] |
| 4 | Chaos mode operator restores system. POST /api/chaos/restore. | TX submitted via Praetor multisig. On success: chaos mode deactivated. Deposits resume. Portfolio message clears. | HIGH | [ ] |
| 5 | Keeper-offline fault injected (Vigil service doesn't submit liquidation TXs). Undercollateralized position exists. | Position stays open (not auto-liquidated). Manual close button available. User can close manually. On restore, Vigil catches up. | HIGH | [ ] |
| 6 | Partial-fill-failure fault injected. User submits order for 1.0 HYPE; venue confirms 0.7 HYPE, rest fails. | Position recorded with filled size (0.7). Collateral posted for 0.7 only. No silent loss. Activity feed shows partial fill. | HIGH | [ ] |
| 7 | Verify chaos mode does NOT lose user funds. Position collateral + accrued yield fully recoverable after restore. | No funds locked. Buying power correctly recomputed after restore. Users can withdraw collateral normally. | BLOCKER | [ ] |

*States to verify:* Fault injection via Praetor multisig (true governance, not hardcoded flag) / Chaos mode flag readable from Praetor (on-chain state) / Each fault type (oracle-drift, keeper-offline, etc.) causes honest error or suspension, not silent failure / Restore operation clears chaos flag and resumes normal operation / No fund loss during/after chaos (all deposits/margin preserved) / Activity feed logs fault injection + restoration with timestamps
*Hunt for these flaws:*
- Chaos mode hardcoded flag (not Praetor-based, can't be controlled)
- Fault doesn't actually pause/disable system (deposits succeed during chaos)
- Silent failure during chaos (user thinks deposit succeeded, funds lost)
- Recovery doesn't clear chaos state (system stuck in chaos mode)
- Partial fills not tracked (position size wrong after partial-fill fault)
- Keeper offline doesn't prevent liquidation (Vigil still runs, defeating fault test)

#### 2.8 Journey: Cross-Chain Transfer (Aqueduct + Chainlink CCIP + Verifier Step TBD)
*Where:* `apps/verify/src/app/api/portfolio/positions/route.ts`
*Purpose:* Verify cross-chain collateral transfer via Aqueduct (Chainlink CCIP): user deposits USDC on source chain, Aqueduct burns it, CCIP relays, target chain mints equivalent Plinth credit.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | User has 10 USDC collateral on Arbitrum Sepolia. Navigate to /app/transfer. | TransferForm shows: From (Arbitrum Sepolia), To (dropdown: Ethereum Sepolia, Polygon Mumbai, etc.), Amount input. Button: 'Initiate transfer'. | HIGH | [ ] |
| 2 | Select Ethereum Sepolia as destination. Enter 5.0 USDC. Click 'Initiate transfer'. | TX submitted: Aqueduct.transfer(destination=eth-sepolia, amount=5.0e6). Button shows 'Initiating...'. On success: { status: 'success', transferHash: '0x...' }. | BLOCKER | [ ] |
| 3 | Transfer TX confirmed on Arbitrum. USDC burned via Aqueduct. CCIP relayer submits on Ethereum Sepolia. | After CCIP confirmation (≈5-10 min): target Plinth updates user's collateral to +$5.00. TransferTimeline shows: 'Sent (0x...) → Confirmed on destination (0x...) → Collateral posted'. | BLOCKER | [ ] |
| 4 | Call GET /api/portfolio/summary?wallet=0x<user>&chain=ethereum-sepolia after transfer settles. | Response: { totalAccountValueUsd: '5.00', source: 'plinth' } on target chain. No double-counting across chains. | BLOCKER | [ ] |
| 5 | User initiates transfer of more USDC than available (balance: 10, attempt: 15). | TX reverts: Aqueduct.transfer insufficient balance. Error: 'Insufficient collateral. Max: 10.00 USDC.' Order not submitted. | HIGH | [ ] |
| 6 | CCIP relayer fails or is delayed beyond SLA. Transfer TX confirmed on Arbitrum but not on Ethereum. | TransferTimeline shows: 'Sent (0x...) → Awaiting relay (~5 min)'. User can check /app/transfer/history (if route exists) or monitor Arbiscan/Etherscan. | HIGH | [ ] |
| 7 | Transfer completes. User withdraws from Ethereum Plinth. Arbitrum Plinth balance unaffected. | Cross-chain balances independent (no cascading margin loss). User can manage margin on each chain separately. | HIGH | [ ] |

*States to verify:* Transfer amount validated (> 0, <= source balance) / USDC burned on source chain via Aqueduct (not locked, burned) / CCIP relayer submits confirmation on target chain / Target Plinth credit posted within SLA (≈10 min documented) / Source chain balance decreases immediately (user sees burned amount) / Target chain balance increases after CCIP confirmation (no pending placeholder) / TransferTimeline shows accurate milestones: Sent → Relay → Confirmed → Posted
*Hunt for these flaws:*
- Transfer amount not validated (overflow, negative)
- USDC locked instead of burned (funds recoverable only via admin)
- CCIP confirmation never arrives (transaction hangs indefinitely)
- Source balance not decremented (double-spend possible)
- Target balance not credited (collateral lost)
- TransferTimeline shows misleading status (says 'Confirmed' when still pending)
- No way to monitor transfer after initial TX (user can't track cross-chain journey)

#### 2.9 Journey: Issue Agent Mandate (Sigil EIP-712 + Verifier Step TBD)
*Where:* `apps/verify/src/app/app/agents/page.tsx`
*Purpose:* Verify agent mandate issuance: user creates bounded IntentSigil via EIP-712 signing, server validates signature matches fields, mandate persists off-chain for agent to use.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to /app/agents. Click 'New Mandate' button. Modal opens with IntentSigil form. | Form fields: Agent address (0x...), Per-action cap (USD), Total open cap (USD), Actions-per-day, Expires (days), Venue allowlist (checkboxes: HL, Aave, Pendle, PMK). | HIGH | [ ] |
| 2 | Fill form: Agent=0xAugur..., per-action=$100, total=$500, actions/day=10, expires=30, venues=[HL, Aave]. Click 'Create mandate'. | wagmi useSignTypedData hook invoked. Browser prompts for signature. User signs EIP-712 struct with all fields baked in. | BLOCKER | [ ] |
| 3 | Signature acquired. Client POSTs to /api/agents/issue-mandate with { ...fields, signature: 0x..., intentHash: 0x..., expiresAt: 1234567890, nonce: 5 }. | Server validates: signature shape (0x + 130 hex), intentHash shape (0x + 64 hex), expiresAt is future timestamp, nonce is decimal string. | BLOCKER | [ ] |
| 4 | Server recomputes EIP-712 hash from form fields + canonical Sigil address on Arbitrum Sepolia + chainId 421614. | Recomputed hash MUST match client's intentHash (if not, fields were tampered). Signature recovered with Viem.recoverTypedDataAddress(). | BLOCKER | [ ] |
| 5 | Recovered signer MUST match session wallet. | If recovered != session wallet, reject with 403: 'Recovered signer does not match session wallet'. No mandate created. | BLOCKER | [ ] |
| 6 | All validations pass. Server responds: { ok: true, mandate: { agent, perActionCap, totalOpenCap, ... }, detail: 'Mandate signed and verified...' }. | Client stores mandate locally (localStorage or state). User can view under 'My mandates'. Mandate text shows: 'Agent 0xAugur... · HL + Aave · expires in 30 days'. | HIGH | [ ] |
| 7 | User attempts to create mandate with zero address as agent (0x0000...). | Server rejects: 400 'agent cannot be the zero address - this would brick mandate revocation'. Form shows error; no TX submitted. | HIGH | [ ] |
| 8 | User attempts to create mandate with total cap < per-action cap (per=$100, total=$50). | Server rejects: 400 'total open cap must be ≥ per-action cap'. Form shows error. | HIGH | [ ] |
| 9 | Signature valid but signed on wrong chainId (user's MetaMask set to mainnet, signs EIP-712 for mainnet). | Server recomputes hash with ARB_SEPOLIA_CHAIN_ID (421614). Hash mismatch. Rejects: 403 'intent_hash_mismatch. Submitted intentHash does not match the mandate fields.' | BLOCKER | [ ] |

*States to verify:* EIP-712 signature includes all mandate fields (agent, caps, duration, venues) / Signature binding: recomputed hash matches client's intentHash / Recovered signer matches session wallet (no signature spoofing) / ChainId is Arbitrum Sepolia (421614), not mainnet / Zero-address agent rejected (prevents mandate revocation brick) / Cap ordering enforced (per-action <= total open) / Venue allowlist membership validated (no invalid venue IDs) / Mandate persisted (user can retrieve via /api/agents/my-mandates)
*Hunt for these flaws:*
- EIP-712 hash doesn't include all fields (signature not truly binding)
- Recomputed hash not validated against client's intentHash (tampered fields accepted)
- Recovered signer not checked (wrong wallet can issue mandates)
- ChainId not enforced (cross-chain signature accepted)
- Zero-address agent not rejected (mandate revocation bricks)
- Cap ordering not validated (total < per-action accepted)
- Signature stored in logs (privacy leak)
- Mandate not persisted (user can't retrieve after page refresh)

#### 2.10 Journey: Revoke / Kill Switch (Postern Session Keys + Sigil Revocation + Verifier Step 7)
*Where:* `apps/verify/src/components/verifier-step-runner.tsx`
*Purpose:* Verify kill switch: revoke every Sigil mandate AND cancel every active Postern session key for a wallet in one irreversible operation. Prevents agent actions immediately.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | User has 2 active mandates issued to different agents. Navigate to /verify/7 (Kill Switch step) or /app/agents and click 'Revoke all mandates'. | Modal appears: 'Kill Switch · Revoke every Sigil mandate AND cancel every active session key for this wallet. This cannot be undone with the same keys. Continue?' Buttons: 'Activate Kill Switch' (destructive), 'Cancel'. | BLOCKER | [ ] |
| 2 | Click 'Activate Kill Switch'. | TX submitted: Postern.killSwitch() (revokes all session keys). Sigil.revokeAllMandates() called (or revocation nonce incremented). Button shows 'Activating...'. | BLOCKER | [ ] |
| 3 | Kill switch TX confirmed. All mandates are revoked. Agents can no longer act on behalf of user. | Portfolio shows: 'Kill switch active · All mandates revoked'. Agents list shows: 'No active mandates.' User can issue new mandates only after new session keys. | BLOCKER | [ ] |
| 4 | Agent attempts to act under revoked mandate (submit trade, liquidate position). Signature verification fails. | Sigil.validateAction reverts: 'Mandate revoked or nonce mismatched'. Agent action blocked. | BLOCKER | [ ] |
| 5 | Kill switch is IRREVERSIBLE with the same keys. User must re-authenticate and issue new mandates. | UI explains: 'To delegate again, you must issue new mandates. Old signatures are permanently invalid.' Clear guidance, not hidden. | HIGH | [ ] |
| 6 | Kill switch called twice (user accidentally clicks button twice). Second call should be no-op or idempotent. | Second call reverts gracefully: 'Kill switch already active' or succeeds idempotently. No data loss. | HIGH | [ ] |
| 7 | User's session key is stolen (private key leaked). User activates kill switch immediately. | Thief's future agent actions blocked. Old sessions revoked. User can create new session key + re-issue mandates with tight limits. | BLOCKER | [ ] |

*States to verify:* Kill switch modal shows clear irreversibility warning (not easy to dismiss) / Postern.killSwitch() revokes all session keys (on-chain state) / Sigil.revokeAllMandates() or nonce increment blocks all old signatures / Agent actions with revoked mandates revert on-chain (Sigil.validateAction) / After kill switch, user must re-auth and re-issue mandates (no easy rollback) / Kill switch is one-time per key (destroying keys is the point)
*Hunt for these flaws:*
- Kill switch modal is easily dismissed (user clicks cancel by accident)
- Kill switch doesn't actually revoke all session keys (agent still acts)
- Kill switch doesn't revoke mandates (Sigil signatures still valid)
- Second kill switch call fails (system can't be called twice)
- User can rollback kill switch without re-authenticating (defeats security)
- Silent failure (kill switch says 'success' but keys still active)

#### 2.11 Journey: Verify My Balance (Lantern Proof-of-Reserves + Merkle Inclusion Proof)
*Where:* `apps/verify/src/app/reserves/page.tsx`
*Purpose:* Verify Lantern proof-of-reserves: user downloads latest attestation (Merkle root + signature) from IPFS, computes inclusion proof for their balance locally, submits to /api/lantern/verify-inclusion for validation.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to /app/reserves. Click 'Verify my balance'. | Modal/drawer shows: 'Retrieving latest Lantern attestation...'. Fetches from /api/lantern/latest to get { merkleRoot, ipfsCid, timestamp, signature }. | HIGH | [ ] |
| 2 | Lantern attestation fetched (published hourly via GHA cron). Download Merkle tree from IPFS (ipfsCid). | Tree contains leaf nodes: hash(Coffer balance for each depositor). User's leaf is hash(user_addr \|\| balance_wei). UI: 'Merkle tree loaded. Computing inclusion proof...' | BLOCKER | [ ] |
| 3 | Compute inclusion proof client-side (Merkle proof = path from leaf to root). | Proof is array of sibling hashes. Root computed from proof and user's leaf should match attestation's merkleRoot. | BLOCKER | [ ] |
| 4 | POST /api/lantern/verify-inclusion with { userAddress, balance, proof: [ ... ], merkleRoot, signature }. | Server validates proof. If valid: { ok: true, message: 'Your balance is included in the Lantern attestation as of block X.' } Shows balance, timestamp, block number. | BLOCKER | [ ] |
| 5 | User balance NOT in latest attestation (stale or was zero at snapshot time). | Response: { ok: false, reason: 'Balance not found in latest attestation. Ensure you deposited before the latest snapshot.' } Honest message, not silent failure. | HIGH | [ ] |
| 6 | Merkle root or signature invalid (tampered attestation). | Response: { ok: false, reason: 'Invalid attestation signature. Merkle root could not be verified on-chain.' } User should not trust the attestation. | BLOCKER | [ ] |
| 7 | Verify button disabled when Lantern attestor hasn't published yet (latency in GHA cron). Show honest message. | Button state: disabled. Message: 'Lantern attestor hasn't published yet. Next attestation in ~XX minutes. Check back then.' | HIGH | [ ] |
| 8 | User runs verification locally (CLI or Python script). Can replicate the proof without server. | Off-chain verification succeeds. Proof matches on-chain attestation. User can verify balance trustlessly. | HIGH | [ ] |

*States to verify:* Lantern publishes attestation every ≤10 minutes (read from /api/lantern/latest) / Merkle tree is complete and pinned to IPFS (ipfsCid is stable) / User's balance (leaf) is correctly encoded as hash(address || balance_wei) / Inclusion proof is valid (verifyProof returns true) / Attestation signature is valid (verifySignature on-chain or locally) / Attestation age shown (block number, timestamp) / Off-chain verification possible (Merkle tree + leaf + proof are sufficient)
*Hunt for these flaws:*
- Lantern attestor doesn't publish (cron job never runs)
- Merkle tree missing from IPFS (ipfsCid is dead link)
- User balance not included in tree (depositors excluded)
- Inclusion proof computed wrong (doesn't verify against root)
- Attestation signature not validated (fake proofs accepted)
- Verify button enabled even when attestation stale (user sees false positive)
- No way to verify off-chain (Merkle tree proprietary, not downloadable)

#### 2.12 Journey: Tax Export (Realized Gains + Merkle Proof)
*Where:* `apps/verify/src/lib/format-usd.ts`
*Purpose:* Verify tax export flow: user downloads realized-gains report (CSV + PDF) auditor-grade, signed Merkle root proves the export matches on-chain attestation.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to /app/tax. TaxView shows: 'Export realized gains'. Dropdown: jurisdiction (US, EU, other). Date range selector. | Options: Download CSV, Download PDF. Both include: transaction date, instrument, side, size, entry price, exit price, realized PnL, fees, cost basis, proceeds. | HIGH | [ ] |
| 2 | Select US jurisdiction, date range (2025-01-01 to 2025-12-31). Click 'Download CSV'. | CSV file downloaded. Format: header row [Date, Instrument, Side, Size, EntryPrice, ExitPrice, Fee, RealizedPnL]. One row per closed position. Numbers are concrete (not pending placeholders). | HIGH | [ ] |
| 3 | Open CSV in Excel or spreadsheet. Verify numbers are calculated correctly. | RealizedPnL = (exit_price - entry_price) * size - fee. Totals sum correctly. Locale-formatted (thousands separator, decimal separator per region). | HIGH | [ ] |
| 4 | Download PDF version of the same report. | PDF includes: header (user name/address, report date range), table of transactions, summary (total realized gain/loss, total fees paid). Professional formatting. | HIGH | [ ] |
| 5 | Export includes 'Merkle proof' section: Merkle root from Lantern attestation that matches the dataset used to generate the export. | Proof section: { merkleRoot, signature, attestationBlock, dataset_hash }. User can verify export came from unmodified Coffer data. | HIGH | [ ] |
| 6 | User has no realized gains (all positions still open). Tax export requested. | Export shows: 'No realized gains in this period.' Honest message, not blank/empty file. | MED | [ ] |
| 7 | Date range spans multiple Lantern attestations (e.g., Jan-Mar covers 3 hourly snapshots). Report is time-accurate. | Export consolidates gains across all relevant blocks. Merkle proof is for the complete dataset (no gaps). | HIGH | [ ] |

*States to verify:* CSV export includes all required tax fields (date, instrument, side, size, entry, exit, fee, PnL) / Numbers are calculated correctly (PnL = (exit - entry) * size - fee) / Locale formatting applied (thousands separator, decimal per region) / PDF is auditor-grade (professional layout, no lorem ipsum) / Merkle proof ties export to Lantern attestation (dataset integrity) / Empty-state handling (no realized gains → honest 'no gains' message) / Multi-attestation consolidation (export spans multiple snapshots if needed)
*Hunt for these flaws:*
- CSV shows pending placeholders (-) instead of concrete PnL
- Numbers are fabricated or hardcoded (not from on-chain positions)
- Locale formatting not applied (shows $1234.5678 instead of $1,234.57)
- PDF layout is broken (misaligned columns, missing data)
- Merkle proof doesn't match actual attestation (integrity not provable)
- Empty-state shows blank file (not clear 'no gains' message)
- Export includes closed positions from before requested date range (scoping wrong)

#### 2.13 Journey: Agent Marketplace Browse + Delegate (Reference Agents: Augur, Haruspex, Auspex)
*Where:* `apps/verify/src/components/agents/new-mandate-button.tsx`
*Purpose:* Verify agent marketplace: user browses 3 reference agents (Augur, Haruspex, Auspex), reads strategy + risk profile, clicks to view profile, issues mandate via inline form.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to /agents/marketplace. Page loads. | Heading: 'Agents marketplace'. Copy: 'Open-source agents that trade for you under bounded Sigil mandates...' Three cards visible: Augur (Mean reversion, Hourly), Haruspex (Momentum, Hourly), Auspex (Basis trade, Daily). | HIGH | [ ] |
| 2 | Card metadata displayed for each agent. Augur card shows: name, strategy, cadence, instruments, repo link (agents/augur). | Instruments listed: 'HIP-3 perps · range bands' (accurate to agent design). Repo link points to GitHub agents/augur. Tag: 'reference'. | HIGH | [ ] |
| 3 | Phase 6 honesty banner visible: 'Reference agents - strategy logic ships in Phase 6 of the launch plan. PnL columns show pending until then.' | Banner displayed above agent cards. Explains: strategy logic pending Phase 6 (Month X W Y), PnL not available yet. User knows not to expect live PnL. | HIGH | [ ] |
| 4 | Click Augur card. Link navigates to /agents/marketplace/augur. | Agent profile page loads. Shows: strategy description, risk profile, venue list (HL, Aave), range bands configuration (if available), GitHub repo link. | HIGH | [ ] |
| 5 | From agent profile, click 'Issue mandate to this agent'. | Inline or modal IntentSigil form opens, pre-filled with agent=0xAugur. User fills: per-action cap, total cap, actions/day, expires, venue allowlist. Submits signature. | HIGH | [ ] |
| 6 | Mandate successfully issued. Agent is now listed under /app/agents 'My mandates'. User can monitor agent actions via activity feed. | Agent card in 'My mandates' shows: agent name, strategy, cap limits, expiration. Links to revoke or view agent profile. | HIGH | [ ] |
| 7 | Community submissions section. No community agents submitted yet. | Section shows: 'No community agents submitted yet. The Curator grant program opens with the production release.' Link to GitHub PR instructions. | MED | [ ] |

*States to verify:* 3 reference agents (Augur, Haruspex, Auspex) displayed with accurate metadata / Instruments listed per agent match GitHub repo definitions / Phase 6 honesty banner explains strategy logic pending / Agent profile pages load and show full strategy details / Mandate issuance form pre-fills agent address from profile / Issued mandates appear in /app/agents 'My mandates' list / Community submissions section explains Curator grant program
*Hunt for these flaws:*
- Agent cards missing strategy or cadence info (incomplete metadata)
- Instruments incorrect or hardcoded (not matching GitHub)
- Phase 6 banner missing (user expects live PnL when unavailable)
- Agent profile doesn't load (404 or blank page)
- Mandate form doesn't pre-fill agent address (user must copy-paste)
- Issued mandate doesn't appear in 'My mandates' (creation silently failed)
- Community submissions section shows fake agents (not yet in Curator review)


### 2.extra Additional journeys to script + run

The completeness critic flagged these higher-order journeys; walk each end to end and confirm no data loss, no stuck state, and a notification/receipt at each hand-off:

- [ ] User Onboarding Critical Path: Sign-up (via passkey or email+OTP) → KYC (Sumsub callback handling) → FirstDeposit (vault selection) → AgentSignal (viewing agent profiles + trust scoring) → ManualTrade (order flow)
- [ ] Liquidation Event Cascade: Monitor position → TriggerEvent (Vigil keeper executes) → NotificationInbox (user sees alert) → ViewLiquidationDetails → ClosePosition (recovery flow)
- [ ] Attestation Publication & Proof: Lantern hourly publish → verification contract state update → user balance impact → SLA compliance view
- [ ] Mandate Issuance to Revocation: Create mandate → submit via Sigil (validation) → agent accepts → monitor compliance → revoke (if violated) → settlement → notification
- [ ] Cross-Venue Rebalancing: View portfolio across venues → calculate consolidation benefit → execute swap (CoW) → settle across venues → tax report generation
- [ ] Error Recovery Flows: API timeout during deposit → retry with exponential backoff → show 'Scribe pending' state → eventual consistency check
- [ ] Adapter Failover & Fallback: Primary venue (e.g., Aave) unavailable → automatic fallback to secondary (Morpho) → user notification → transparent routing
- [ ] Real-Time Margin Monitoring: View margin utilization → Plinth updates on-chain → UI re-fetches via Scribe → shows pending state → confirms update
- [ ] Tax Reporting Workflow: Select date range → query historical trades → compute FIFO/HIFO → download CSV or PDF → audit trail
- [ ] Mobile-Specific Flows: Tap Bell icon (notification drawer) → swipe to dismiss → confirmation toast, Pinch-zoom chart on portfolio page → multi-touch gesture handling

---

## 3. On-chain + services tests

> Atrium's on-chain backbone (Arbitrum Sepolia testnet, launch-readiness 2026-05-31) comprises: Stylus vault+keeper contracts (Coffer ERC-4626, Sigil IntentSigil, Vigil liquidation, Plinth collateral), 8 adapter routes (Aave, Curve, GMX, Hyperliquid, Morpho, Pendle, Polymarket, Synthetix), middleware (Aqueduct CCIP, Postern kill-switch, Praetor 48h timelock), Codex x402-payable API gateway (Cloudflare Workers), and three reference agents (Augur mean-reversion, Auspex variance, Haruspex momentum) operating via hourly cron. Vigil-keeper detects liquidations on 5-min intervals. Lantern-attestor publishes hourly attestation trees (v2 with ipfsCid). Subgraph v0.0.7 is live. This plan enumerates testable flows grounded in real code with concrete test cases (action, expected outcome, severity), on-chain effects (tx/event), timelock gates (2026-05-31T23:59Z), and honest-pending states.

#### 3.1 Faucet: 5 USDC + 0.0005 ETH / 24h cooldown
*Where:* `contracts/faucet/src/Faucet.sol | apps/verify/src/app/api/faucet/status/route.ts | 0x7f3a714c824c0926ae98ecfb2e59513e78d82bbc`
*Purpose:* Testnet onboarding drop; each address claims once per 24h cooldown. Must report exact stock or shortfall (not vague 'out of stock'). Calls to /api/faucet/status read on-chain balance + per-wallet cooldown eligibility.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Call faucet/status?wallet=0x<your_address> when faucet is fully stocked (≥5 USDC, ≥0.0005 ETH) and wallet has no active cooldown | Response: {available:true, reason:null, faucetUsdcBalance:5.0+, faucetEthBalance:0.0005+, walletCooldownRemainingSec:0} | BLOCKER | [ ] |
| 2 | Claim once via onboarding flow (Faucet.claim); immediately call faucet/status for same wallet | Response: {available:false, reason:'Wallet cooldown 86400s remaining', walletCooldownRemainingSec:86400±5} | HIGH | [ ] |
| 3 | Drain faucet USDC to 2.5 USDC (below 5e6 per-claim drop); call faucet/status | Response: {available:false, reason:'Faucet USDC stock 2.50 below per-claim drop 5.00'} (exact shortfall, not generic) | HIGH | [ ] |
| 4 | Drain faucet ETH to 0.00001 ETH; call faucet/status | Response: {available:false, reason:'Faucet ETH stock 0.0000 below per-claim drop 0.0005'} (not silent fail) | HIGH | [ ] |
| 5 | Claim from faucet; monitor tx for event logs | Claimed(wallet, 5000000, 500000000000000) event emitted with correct usdcDrop (5e6 wei = 5 USDC, 6 decimals) + ethDrop | MED | [ ] |
| 6 | Call Faucet.drainUsdc(0x<any_addr>, 1e6) from non-praetor wallet | Revert Unauthorized(); only praetor can drain | HIGH | [ ] |
| 7 | Call Faucet.drainEth(address(0), 1e16) from praetor | Revert ZeroRecipient() (not silent burn) | HIGH | [ ] |

*States to verify:* Faucet stock is honestly reported (no hardcoded {available:false} despite real funds) / Per-wallet cooldown is calculated from lastClaim[wallet] + cooldown (24h = 86400s) / Transfer failures surface as reverts (TransferFailed), not silent Claimed events without funds / ZeroRecipient guard prevents fat-finger burns in drainUsdc/drainEth
*Hunt for these flaws:*
- Pre-fix: /api/faucet/status hardcoded {available:false} despite Faucet stocked at 0x7f3a (audit G-2)
- Silent transfer failures: USDC.transfer returns false, Faucet emits Claimed anyway (no revert)
- Missing ZeroRecipient in drain* → praetor typo burns funds to 0x0
- RPC offline / contract missing from deployments: route returns pending state with source:'pending' not false stock claims

#### 3.2 Coffer Vault: ERC-4626 USDC collateral (Stylus)
*Where:* `contracts/coffer/src/lib.rs | 0xd169554caf920f1fbcffbafcff3068a84892b0d8 | Deployed 2026-05-24T15:17:02Z (block 270800974)`
*Purpose:* Tokenized vault (ERC-4626 compatible) accepting USDC collateral. Mints/burns shares. Guarded by per-user caps, adapter budgets, Plinth liquidation lock, emergency pause, and circuit-breaker. Reentrancy guard (is_updating) added 2026-05-24 (audit C-7).

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Approve 1000e6 USDC to Coffer; call deposit(1000e6, receiver). Monitor Transfer + Deposit events | receiver receives shares proportional to assets (shares = assets * totalShares / totalAssets or 1:1 if first deposit); Deposit event with correct assets + shares + receiver | BLOCKER | [ ] |
| 2 | Deposit 101e6 USDC when user per-deposit cap is 100e6 | Revert PerUserCapExceeded(101000000, 100000000) - NOT partial fill to 100e6 | BLOCKER | [ ] |
| 3 | Mint shares for user; set Plinth.pending_liquidation=true for user; attempt withdraw(shares, user, user) | Revert PendingLiquidation(user) (cannot exit if under liquidation) | BLOCKER | [ ] |
| 4 | Praetor calls pauseWithdrawals(keccak256('demo reason')); attempt withdraw | Revert WithdrawalsPausedError; WithdrawalsPaused event emitted with reason hash + timestamp | BLOCKER | [ ] |
| 5 | Praetor calls pauseDeposits(keccak256('demo reason')); attempt deposit | Revert DepositsPausedError | HIGH | [ ] |
| 6 | Call adapter_pull(adapter, 50e6); adapter has per-block cap of 30e6; within 1 block re-call adapter_pull(25e6) same adapter | Second call either reverts AdapterCapExceeded(55e6, 30e6) or succeeds within cap; AdapterCapHit event if cap was hit this block | HIGH | [ ] |
| 7 | Mock USDC.paused() to return true; attempt deposit(10e6) | Revert UsdcPaused (not silent proceed) | HIGH | [ ] |
| 8 | Mock USDC.transfer to return false; call deposit(10e6) | Revert TransferFailed(usdc, receiver, amount) - NOT Deposit event without funds moved | BLOCKER | [ ] |
| 9 | Set Plinth to unreachable address; call adapter_pull(adapter, 10e6) on user | Revert PlinthUnreachable(user) (not silent skip of liquidation check) | BLOCKER | [ ] |
| 10 | USDC with transfer hook attempts re-entry into Coffer.deposit mid-flight | Revert CofferReentrant (is_updating flag prevents double-entry) | BLOCKER | [ ] |
| 11 | Execute: deposit 100e6, withdraw 50e6, deposit 30e6. Query share_balances + total_shares for all actors | Sum of all share_balances == total_shares at every step (no share inflation/deflation bugs) | BLOCKER | [ ] |

*States to verify:* initialize() was called by timelock → admin fields are set (not 0x0) / Per-user cumulative deposit cap is enforced (not per-tx) / Plinth liquidation lock blocks withdraw (pending_liquidation=true rejects ALL exits) / Global pause (pauseDeposits/pauseWithdrawals) is enforced instantly (not timelock-gated) / Adapter budgets are per-block (reset each block.number) / USDC.paused() state is checked before transfer (not after) / Reentrancy guard (is_updating) prevents hook-based re-entry
*Hunt for these flaws:*
- initialize() never called → admin=0x0 → set_adapter calls revert UnauthorizedCaller (all adapters locked out)
- Missing reentrancy guard pre-2026-05-24 → deposit hook can re-enter, double-mint shares
- USDC.paused() check missing → operate against paused asset silently fails (no revert)
- transfer() return value ignored → shares minted but funds never moved
- Adapter budget resets on block.number change NOT respected → multi-adapter ops in same block exceed global budget
- Plinth call fails silently → liquidation lock never enforced

#### 3.3 Sigil IntentSigil: Mandate issuance via EIP-712
*Where:* `apps/verify/src/app/api/agents/issue-mandate/route.ts | contracts/sigil/src/eip712.rs | 0xc9933ebe7dc8c4849a1720b2e5b33e381442c873 | Deployed 2026-05-24T15:21:15Z`
*Purpose:* Agent mandate issuance: server validates EIP-712 signature, recovers agent + cap details, writes mandate to Codex storage. Agent actions reference the mandate hash. Venue allowlist max 8 (enforcement on both client + server per audit R-2).

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | POST /api/agents/issue-mandate with valid EIP-712 envelope (agent, perActionCapUsdc, totalOpenCapUsdc, actionsPerDay, expiresDays, venueAllowlist, signature from wagmi) | {ok:true, mandateHash: <32-byte hex>}; Sigil.IntentIssued event with matching hash, agent, caps, expiry | BLOCKER | [ ] |
| 2 | POST with agent=0x0000000000000000000000000000000000000000 | {ok:false, error:'agent cannot be the zero address - would brick mandate revocation'} | HIGH | [ ] |
| 3 | POST with perActionCapUsdc=0 | {ok:false, error:'perActionCapUsdc must be > 0'} | HIGH | [ ] |
| 4 | POST with venueAllowlist containing 9 venue IDs (max is 8) | {ok:false, error:'venue allowlist exceeds max 8'} (not silent truncation) | HIGH | [ ] |
| 5 | POST with venueAllowlist=['0xdeadbeef'] (invalid venue ID not in canonical VENUES) | {ok:false, error:'venue ID 0xdeadbeef not found in canonical VENUES list'} | HIGH | [ ] |
| 6 | Sign EIP-712 with wallet B; authenticate as wallet A; POST mandate for agent C | {ok:false, error:'signature does not recover to authenticated user'} (via session + recovery check) | BLOCKER | [ ] |
| 7 | Issue mandate; query Codex /v1/agents/{agentId}/mandates | Mandate object includes intentHash matching the recovered EIP-712 hash, agent, per-action cap, total cap, expiry | HIGH | [ ] |
| 8 | POST with expiresDays=7; monitor Sigil event expiresAt field | expiresAt = block.timestamp + (7 * 86400), timestamp visible in event | MED | [ ] |
| 9 | POST from disallowed origin (not verify.atrium.fi, atrium.fi, or localhost:3000) | {status:403, error:'origin_not_allowed', detail:'Mandate issuance only callable from verify.atrium.fi'} | HIGH | [ ] |
| 10 | POST without signature/intentHash (legacy client, no EIP-712 provided) | Advisory response: form shape validated, caps checked, but signature marked as pending/optional during transition | MED | [ ] |

*States to verify:* Signature recovery matches authenticated session wallet (EIP-712 chainId = 421614 on Arbitrum Sepolia) / All 8 venues in allowlist exist in canonical VENUES struct (not typos or disallowed venues) / Per-action cap and total cap are strictly > 0 (not off-by-one bugs) / expiresDays is relative to current block.timestamp (not absolute wall-clock) / Origin allowlist is enforced (ALLOWED_ORIGINS checked in route.ts:72) / Mandate hash matches recovered EIP-712 hash (not signature verification skip)
*Hunt for these flaws:*
- Signature verification skipped → attacker forges mandates for other wallets + agents
- Venue allowlist silently truncates to 8 → venues 9+ are ignored, wrong venues allowed
- Origin check missing → CSRF from evil.com issues mandates on victim wallet
- EIP-712 chainId mismatch (not 421614) → accepted silently (cross-chain signature reuse)
- Mandate hash does not match signature envelope → hash collision or wrong recovery
- Per-action cap validation missing → cap=0 accepted (agent can spend unlimited per action)

#### 3.4 Vigil Liquidation Keeper: 5-min cron, Plinth detection, Codex queue
*Where:* `services/vigil-keeper/src/tick.ts | contracts/vigil/src/lib.rs | 0x08f3d3a878a75aa454be6bd07f0b74d3e6e46dc8 | Deployed 2026-05-24T15:24:46Z`
*Purpose:* Background service (5-min interval via KEEPER_INTERVAL_MS env) detects under-collateralized positions from Plinth, queues liquidation intents in Codex, executes on-chain (pays 0.5% bounty to caller). Integrates with Scribe subgraph v0.0.7 for live position data.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Mint shares + short HIP-3 perp + fall underwater (maintenance ratio breached). Call Plinth.update(user). Run keeper tick. | Keeper fetches Plinth.getAccount(user), finds pending_liquidation=true, queues Vigil.liquidate intent in Codex with correct user + margin requirement | BLOCKER | [ ] |
| 2 | Inspect on-chain liquidate(user, intent) calldata posted by keeper | Intent carries user's current position + required margin from Plinth (not hardcoded or stale snapshot) | BLOCKER | [ ] |
| 3 | Call liquidate(user, intent); monitor for BountyPaid event | Bounty = 0.5% of liquidation_amount, transferred from Coffer to msg.sender (caller) | HIGH | [ ] |
| 4 | Call liquidate(user, intent) with user.pending_liquidation=false (healthy account) | Revert (permission check) - NOT execute silently on healthy accounts | BLOCKER | [ ] |
| 5 | Call Vigil.markKeeperMissedWindow(keeper_eoa) during chaos drill | KeeperMissedWindow event emitted; Codex notifier sends alert (Telegram/Discord/email) | HIGH | [ ] |
| 6 | Check Scribe block number vs chain tip before keeper tick | If Scribe lag > 600 blocks, keeper returns pending/retry (not stale positions); if sync'd, executes with live data | HIGH | [ ] |
| 7 | Praetor pauses Coffer.withdrawals + Sigil; attempt keeper tick with underwater user | Liquidate call reverts (Coffer.adapter_pull fails if withdrawals paused) OR keeper skips queue + logs advisory | HIGH | [ ] |
| 8 | Point keeper at broken Codex URL; run tick with RPC failure | Error logged to console/Sentry (JSON format with ts + event:'tick_error' + error message); retry next interval (not silent skip) | MED | [ ] |

*States to verify:* initialize() was called → Vigil admin fields set (not 0x0) → setValidators calls work / Plinth.getAccount(user) is called for every pending liquidation check (not cached stale snapshot) / Bounty calculation is 0.5% of liquidation amount (not 1 wei, not hardcoded) / Scribe subgraph v0.0.7 is synced within 600 blocks of chain tip (not stale data) / Error logging is honest (JSON with ts, event, error message, not silent skip)
*Hunt for these flaws:*
- Plinth call fails silently → liquidations never queued even for real underwater users
- Bounty calculation wrong (0.5% vs 1 wei vs missing) → underpays keeper, breaks liquidation incentive
- initialize() never called → keeper's setValidators + markKeeperMissedWindow revert UnauthorizedCaller
- Scribe sync never checked → executes liquidations against stale data (user already liquidated elsewhere)
- Coffer/Sigil pause state not checked → liquidation tx reverts on-chain (bounty not paid, user not liquidated)
- Keeper missing window not logged → no alert sent (keeper outage goes unnoticed)

#### 3.5 Postern Kill-Switch: Emergency pause + session key auth
*Where:* `contracts/postern-kill-switch/src/PosternKillSwitch.sol | contracts/postern-kill-switch/src/PosternKeyRegistry.sol | Deployed 2026-05-24`
*Purpose:* Emergency power-down lever (multisig-gated). Kill-switch pauses any contract. PosternKeyRegistry manages agent session keys (expiry + revocation). Integration point for Sigil mandates + agent actions.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Praetor multisig calls PosternKillSwitch.pause(Plinth, keccak256('oracle_drift')); agent attempts action on Plinth | Action reverts with paused error OR pending state (depending on contract implementation); PauseApplied event logged | BLOCKER | [ ] |
| 2 | After pause, call restore(Plinth, keccak256('oracle_drift')); retry agent action | Action succeeds; PauseRestored event + state flag flips to unpaused | BLOCKER | [ ] |
| 3 | Pause with reason=keccak256('oracle_drift'), restore with same reason | Events carry reason hash; off-chain decoder recovers 'oracle_drift' string (audit trail) | HIGH | [ ] |
| 4 | Non-multisig wallet calls pause(Plinth, reason) | Revert Unauthorized (only multisig EOA or Safe can pause) | BLOCKER | [ ] |
| 5 | PosternKeyRegistry.addKey(agent, sessionKey_bytes32, expiryBlock); sign + submit agent action with sessionKey | Before expiryBlock: action signature valid; after expiryBlock: signature invalid (session key expired) | HIGH | [ ] |
| 6 | Call revokeKey(agent, sessionKey); attempt action with same key | Revert (session key no longer valid in registry) | HIGH | [ ] |

*States to verify:* Only multisig EOA (or Safe via multisig delegation) can call pause/restore / Session key expiry is enforced (checked against block.number, not wall-clock) / Revocation is permanent (once revoked, key cannot be re-added without explicit addKey) / Reason hash is logged for audit trail (not just binary paused flag)
*Hunt for these flaws:*
- Pause gate not checked in downstream contracts (Coffer, Vigil, Sigil) → pause has no effect
- Session key expiry checked against timestamp (not block.number) → off-by-one with block timing
- Only one key per agent → multi-sig (agent + co-signer) fails (agent loses access if key leaked)
- Pause reason not logged → no audit trail for governance review

#### 3.6 Praetor Timelock: 48h schedule→execute lock
*Where:* `contracts/praetor-timelock/src/PraetorTimelock.sol | 0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4 | Deployed block 270408443`
*Purpose:* Governance timelock (48h delay). All protocol upgrades are schedule(target, calldata) then execute(target, calldata, scheduled_timestamp) after 48h. Emergency pause (pause(bytes32 reason)) is instant (no timelock). All critical ops gated until 2026-05-31T23:59Z.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Call schedule(Coffer, setAdapterABI.encodeCall(...)); returns id = keccak256(target, data, block.timestamp) | Scheduled event emitted with id, target, data, block.timestamp + earliest_execute_timestamp (block.timestamp + 48h) | BLOCKER | [ ] |
| 2 | Immediately call execute(Coffer, data, scheduled_timestamp) | Revert TimelockNotExpired(scheduled_timestamp, earliest_exec, block.timestamp) - NOT execute before 48h elapsed | BLOCKER | [ ] |
| 3 | After 48h, call execute(Coffer, data, scheduled_timestamp) with matching target + data + timestamp | Execute succeeds; Executed event with id, target, data, return value | BLOCKER | [ ] |
| 4 | Schedule with target=EOA_address (not a contract); attempt execute after 48h | Revert TargetNotAContract (audit LLL-4 fix) - prevents silent success on typo addresses | HIGH | [ ] |
| 5 | Call pause(keccak256('chaos: oracle_drift demo')) from multisig EOA (instant, no timelock) | Paused event emitted immediately; target contract is paused (depending on pause implementation) | HIGH | [ ] |
| 6 | Call resume() after pause - check if resume is timelock-gated or instant | Resume is timelock-gated (cannot instantly flip back) OR instant via separate gate (per audit LLL-3) | HIGH | [ ] |
| 7 | Only multisig EOA calls schedule/execute | Non-multisig caller: revert Unauthorized | BLOCKER | [ ] |

*States to verify:* 48h delay enforced strictly (block.timestamp >= scheduled_timestamp + 48h required) / schedule() + execute() use matching keccak256(target, data, scheduled_timestamp) id (not random) / Target contract validation (TargetNotAContract prevents silent success on EOA typos) / Only multisig EOA can schedule/execute (not deployer, not individual signers) / Emergency pause (instant, no timelock) is documented + enforced / All critical ops (setAdapter, setAdapter cap, setValidator) are gated until 2026-05-31
*Hunt for these flaws:*
- 48h delay not enforced → execute() succeeds before timelock window (critical operations bypass governance)
- ID mismatch (schedule id != execute id) → attacker replays old scheduled operations
- Target not validated (EOA address accepted) → silent success on typo, funds sent to wrong address
- Resume not timelock-gated → pause is reversible instantly (bypass governance)
- Non-multisig can schedule → anyone queues arbitrary protocol changes

#### 3.7 Codex API Gateway: /v1/*(health, margins, positions, risk, venues, agents, backtest, attestation, options)
*Where:* `services/codex/src/index.ts | Cloudflare Workers | Hono framework | x402-payable pipeline`
*Purpose:* RESTful API exposing protocol state: health check, margin calculations, portfolio positions, risk metrics, venue list, agent profiles, backtesting, attestation proofs, options pricing. Uses x402 payment gating (paymentMiddleware → idempotency-key → rate limit → handler → HMAC sign → cache + log). Public: /health, /. Paid: /v1/*.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | GET /health (public, no payment required) | {ok:true, service:'Codex', uptime_sec:1234, db_latency_ms:12, subgraph_block:270800000, timestamp:2026-05-29T12:34:56Z} | HIGH | [ ] |
| 2 | GET /v1/positions without payment headers | {error:'payment_required', x-402-www-authenticate:'...'} | HIGH | [ ] |
| 3 | POST /v1/positions with valid x-402 headers + HMAC signature | {positions:[{user, venue, symbol, notional, margin_ratio, liquidation_price, pnl, ...}], ...} | BLOCKER | [ ] |
| 4 | Repeat same request (idempotency-key=same_uuid) within cache window | Response served from cache (same data, response-time < 10ms, X-Cache-Hit: true) | MED | [ ] |
| 5 | Spam /v1/positions with high frequency (>10 req/s per API key) | Rate limit kicks in; 429 Too Many Requests with Retry-After header | HIGH | [ ] |
| 6 | GET /v1/attestation?root=0x<latest>&agentId=0x<agent>&nonce=123 | Merkle proof for agent in latest attestation tree + inclusion proof for nonce | HIGH | [ ] |
| 7 | GET /v1/agents (list all registered agents + trust signals + mandate state) | [{id, name, strategy, pnl_30d, mandate_hash, expiry_block, venue_allowlist, ...}] | HIGH | [ ] |
| 8 | Simulate error: RPC offline, D1 query fails, Scribe slow (timeout > 30s) - check error response | Generic error response (not leaking RPC URL, D1 query string, Scribe URL); detail logged server-side only (audit FIRE78-CODEX1) | HIGH | [ ] |

*States to verify:* /health is public + fast (< 100ms, no auth required) / /v1/* endpoints require x-402 payment headers (or bypass via allowlist for demo) / Idempotency-key prevents duplicate charges (same request = same txHash + timestamp) / Rate limit is per-API-key (not per-IP, not global) / HMAC signature validation matches secret CODEX_HMAC_KEY (request tampering detected) / Error responses do NOT leak RPC URLs, D1 query strings, Scribe URLs (logged server-side) / Subgraph block synced within 600 blocks of chain tip
*Hunt for these flaws:*
- Payment gate missing on /v1/* → endpoints publicly accessible (protocol data leakage)
- Idempotency-key not checked → duplicate charges for same request
- Rate limit is global (not per-key) → one user DoS'es all others
- HMAC signature validation skipped → request tampering undetected
- Error responses leak RPC URL + D1 query string → attacker reconnaissance (audit FIRE78-CODEX1)
- Subgraph lag never checked → margin calculations use stale position data (liquidation false positives)

#### 3.8 Lantern Attestation: Hourly root publish + Merkle proof + IPFS pinning
*Where:* `apps/verify/src/app/api/lantern/latest/route.ts | apps/verify/src/app/api/lantern/verify-inclusion/route.ts | 0xF0B90b94C0B8a52c545768bFf06a3932c67d5888 (v2 redeployed 2026-05-25) | Subgraph v0.0.7 sync dependency`
*Purpose:* Hourly attestation of protocol state: agent performance, liquidation events, mandate expirations. Publishes Merkle tree root on-chain (AttestationPublished event now carries root, block_number, timestamp, leafCount, ipfsCid). Verifiers download tree from IPFS, compute Merkle proofs, submit to protocol.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | GET /api/lantern/latest (requires subgraph v0.0.7 synced) | {root: '0x<32-byte-hex>', block_number: 270800123, timestamp: 2026-05-29T12:00:00Z, leafCount: 512, ipfsCid: 'Qm...', sources: ['agent1', 'agent2', ...]} | BLOCKER | [ ] |
| 2 | Download tree from IPFS (ipfsCid); compute Merkle proof for agent inclusion; POST /api/lantern/verify-inclusion with proof | {valid:true, agent: '0x<agent>', root_matched: '0x<root>', inclusion_path: [...], position_in_tree: 42} | BLOCKER | [ ] |
| 3 | Submit proof with wrong agent address (not in tree) | {valid:false, reason:'Agent not found in merkle tree'} | HIGH | [ ] |
| 4 | Modify proof (flip one byte); POST verify-inclusion | {valid:false, reason:'Merkle proof does not match root'} | HIGH | [ ] |
| 5 | Check Lantern.publish() scheduled via timelock; monitor AttestationPublished event | Event emitted every hour (or per schedule) with root, block_number, timestamp, leafCount, ipfsCid (not root only) | HIGH | [ ] |
| 6 | Subgraph v0.0.7 is lagged > 600 blocks; call /api/lantern/latest | Either pending state (source:'pending') or cached prior root + advisory ('last published 30min ago, subgraph syncing') | MED | [ ] |

*States to verify:* Root is published on-chain every hour (or per cron schedule) / AttestationPublished event carries root + block_number + timestamp + leafCount + ipfsCid (not root only) / IPFS tree is pinned + accessible (not temporary upload) / Merkle proof verification is correct (not off-by-one in path construction) / Agent inclusion proofs are auditable (can be verified on-chain or off-chain) / Subgraph v0.0.7 is synced before publishing (not stale snapshot)
*Hunt for these flaws:*
- Root not published on-chain hourly → no on-chain record of attestation history
- AttestationPublished event missing ipfsCid → verifiers cannot retrieve tree (proof verification impossible)
- IPFS tree expires (not pinned) → attestation proofs become invalid after time
- Merkle proof has off-by-one bug → valid agents fail inclusion check (false negatives)
- Subgraph lag not checked → publishes stale agent state (liquidations miss deadlines)
- Agent address not validated in tree → attackers claim attestation for non-existent agents

#### 3.9 Reference Agents: Augur (mean-reversion), Auspex, Haruspex
*Where:* `agents/augur/src/main.rs | agents/auspex/src/main.rs | agents/haruspex/src/main.rs | Hourly cron via tokio::time::sleep`
*Purpose:* Three reference agents running on testnet. Augur: Bollinger band strategy on HIP-3 stock perp (enter <2σ, exit ±1σ). Auspex: variance tracking. Haruspex: momentum strategy. All use Sigil IntentSigil for mandates, Postern session keys for actions, Codex /v1/* endpoints for market data. Per-action cap: 50 USDC notional; total: 500 USDC testnet allocation.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Start Augur agent (cargo run --bin augur); monitor logs for hourly tick | Logs: 'tick: fetched prices (n=20), computed bands (mean=X, lower=Y, upper=Z), current price=P, signal=BUY\|SELL\|HOLD' | HIGH | [ ] |
| 2 | Augur detects long signal (price < mean-2σ); submits action via Postern session key | Sigil.ActionSubmitted event with agent, venue, symbol, size, price, mandate_hash; Codex logs action in /v1/agents/{agent}/actions | HIGH | [ ] |
| 3 | Action size is 50 USDC notional (per-action cap); repeat actions until total > 500 USDC | 11th action reverts (mandate total cap exceeded); Codex logs 'action rejected: exceeds mandate total cap 500 USDC' | HIGH | [ ] |
| 4 | Mandate expires (block > expiresAt); Augur attempts new action | Sigil.ActionValidation fails (expired mandate); action queued with status:'pending_renewal' | HIGH | [ ] |
| 5 | Codex /v1/backtest returns stale price data (Scribe lag > 600 blocks); Augur computes bands | Augur logs 'warning: scribe lag 650 blocks, using cached prices' (not silent stale-data trade) | MED | [ ] |
| 6 | Venue is paused (Postern.pause(venue)); Augur attempts action | Sigil action queued with status:'pending_venue_unpause' (not rejected, advisory state) | MED | [ ] |

*States to verify:* Augur strategy logic is correct: Bollinger(mean, 2σ bands, enter <mean-2σ, exit ±1σ) / Per-action cap (50 USDC) is enforced by mandate (not agent checking) / Total cap (500 USDC) is enforced by mandate (agent cannot exceed) / Mandate expiry is checked (block > expiresAt blocks action) / Codex /v1/backtest endpoint returns price history with correct timestamps / Session key is used for action signing (not private key leak) / Actions are logged in Codex (auditable per-agent action history)
*Hunt for these flaws:*
- Strategy logic has off-by-one in band calculation → enters at wrong price (missing alpha)
- Per-action cap not enforced by mandate → agent can submit 100+ USDC single action (mandate bypass)
- Mandate expiry never checked → expired agent submits actions (no authorization validation)
- Codex /v1/backtest returns wrong price (not latest, or wrong instrument) → strategy trades stale data
- Session key leaked in logs → private key exposure (RPC signature capture)
- Actions not logged in Codex → agent activity invisible (no audit trail)


---

## 4. API endpoint tests

> LAUNCH-READINESS QA TEST PLAN for Atrium cross-venue portfolio-margin protocol on Arbitrum Sepolia testnet. Comprehensive test coverage for 24 API routes in apps/verify/src/app/api/**/route.ts. Each route includes tests for happy path, empty/pending states, error/outage scenarios, auth/permission handling (401/403), input validation (bad params, injection), and honesty verification (real source vs pending data).

#### 4.1 agents/[id]/profile
*Where:* `apps/verify/src/app/api/agents/[id]/profile/route.ts`
*Purpose:* Return agent reputation, deboost history, action counts, PnL from Scribe. Depends on SCRIBE_URL.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | GET /api/agents/0x1234...5678/profile with Scribe available | 200 JSON with reputation, deboostHistory, actionCounts, pnlWindows[], source='scribe' | BLOCKER | [ ] |
| 2 | GET /api/agents/invalid-address/profile with malformed wallet | 200 with empty/pending state, source='pending' | HIGH | [ ] |
| 3 | GET /api/agents/0x1234...5678/profile with SCRIBE_URL unavailable | 200 JSON with null metrics, source='pending' | HIGH | [ ] |
| 4 | GET /api/agents/0x1234...5678/profile with null PnL metric from Scribe | 200 JSON with pnlWindows null (not $0.00) | HIGH | [ ] |
| 5 | GET /api/agents with ?id missing | 400 or 200 with pending state | MED | [ ] |

*States to verify:* Scribe health and data availability / Agent exists with indexed reputation / PnL measurement state (null vs numeric) / Source field accuracy ('scribe'|'pending') / Timestamp parsing validity
*Hunt for these flaws:*
- Fake-zero PnL ($0.00 when unmeasured)
- Missing null coalescing on string-BN conversion
- Timestamp Invalid Date rendering
- Stale reputation cache
- Missing wallet checksum validation

#### 4.2 agents/issue-mandate
*Where:* `apps/verify/src/app/api/agents/issue-mandate/route.ts`
*Purpose:* Create Sigil IntentSigil mandate via EIP-712 signature. Auth: Origin allowlist + session + wallet-matched signature. 14-point input validation.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | POST /api/agents/issue-mandate with valid wallet, signature, intent, permissions | 200 JSON with mandateHash, txHash, status='issued' | BLOCKER | [ ] |
| 2 | POST /api/agents/issue-mandate without Authorization header | 401 unauthorized | BLOCKER | [ ] |
| 3 | POST /api/agents/issue-mandate with Origin not in allowlist | 403 origin_not_allowed | BLOCKER | [ ] |
| 4 | POST /api/agents/issue-mandate with malformed EIP-712 signature | 400 invalid_signature | HIGH | [ ] |
| 5 | POST /api/agents/issue-mandate with wallet mismatch | 401 wallet_mismatch | BLOCKER | [ ] |

*States to verify:* Session token valid and not expired / Wallet matches authenticated session / EIP-712 domain separator for arbitrumSepolia / Signature recovery yields correct signer / Deployment registry has Sigil address / RPC connectivity
*Hunt for these flaws:*
- Missing domain/uri validation in signature
- Bitmap permissions not clamped
- Signature reuse vulnerability
- Missing CSRF validation
- RPC timeout handling

#### 4.3 agents/leaderboard
*Where:* `apps/verify/src/app/api/agents/leaderboard/route.ts`
*Purpose:* Return top agents by reputation from Rostrum. Depends on SCRIBE_URL. Returns empty with source='pending' on failure.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | GET /api/agents/leaderboard with Scribe available | 200 JSON with leaderboard[], source='scribe' | BLOCKER | [ ] |
| 2 | GET /api/agents/leaderboard with SCRIBE_URL unavailable | 200 JSON with leaderboard=[], source='pending' | HIGH | [ ] |
| 3 | GET /api/agents/leaderboard with empty Rostrum | 200 JSON with leaderboard=[], source='pending' | MED | [ ] |
| 4 | GET /api/agents/leaderboard?limit=200 (exceeds max 100) | 200 with limit clamped to 100 | MED | [ ] |
| 5 | GET /api/agents/leaderboard with corrupted reputation (NaN) | 200 with corrupt entries filtered | HIGH | [ ] |

*States to verify:* Rostrum entity has entries / Reputation field numeric and finite / Entries sorted descending / Source reflects truth / Limit clamped 1-100
*Hunt for these flaws:*
- NaN propagation from string conversion
- Missing limit clamping
- Stale cache
- Missing tier classification

#### 4.4 agents/my-mandates
*Where:* `apps/verify/src/app/api/agents/my-mandates/route.ts`
*Purpose:* List active Sigil mandates. Auth: session OR ?wallet=. Depends on SCRIBE_URL. Computes (validations - revocations).

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | GET /api/agents/my-mandates with authenticated session and mandates | 200 JSON with mandates[], source='scribe' | BLOCKER | [ ] |
| 2 | GET /api/agents/my-mandates?wallet=0x1234...5678 with requireWalletMatch pass | 200 JSON with wallet mandates | BLOCKER | [ ] |
| 3 | GET /api/agents/my-mandates with no session and no ?wallet | 200 JSON with mandates=[], source='pending' | HIGH | [ ] |
| 4 | GET /api/agents/my-mandates with SCRIBE_URL unavailable | 200 JSON with mandates=[], source='pending' | HIGH | [ ] |
| 5 | GET /api/agents/my-mandates with revoked mandate | 200 JSON with revoked intent filtered out | HIGH | [ ] |

*States to verify:* Session OR ?wallet param / Wallet checksum valid / Scribe returns entities / Revocation logic filters correctly / Timestamp numeric
*Hunt for these flaws:*
- Missing revocation dedup
- Timestamp NaN propagation
- Missing session validation
- Expired mandates not filtered

#### 4.5 agents/summary
*Where:* `apps/verify/src/app/api/agents/summary/route.ts`
*Purpose:* Return agent summary stats (PnL, win rate, Sharpe). All metrics null when unmeasured.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | GET /api/agents/0x1234...5678/summary with complete data | 200 JSON with metrics, source='scribe' | BLOCKER | [ ] |
| 2 | GET /api/agents/0x1234...5678/summary with zero PnL | 200 JSON with totalPnlUsd=null (not $0.00) | HIGH | [ ] |
| 3 | GET /api/agents/0x1234...5678/summary with SCRIBE_URL unavailable | 200 JSON with null metrics, source='pending' | HIGH | [ ] |
| 4 | GET /api/agents/invalid-wallet/summary | 400 or 200 with pending | MED | [ ] |
| 5 | GET /api/agents/0x1234...5678/summary with calculated Sharpe | 200 JSON with Sharpe = return/volatility or null | MED | [ ] |

*States to verify:* All metrics null when unmeasured / Sharpe calculated correctly / Win rate 0-1 or null / Source reflects truth
*Hunt for these flaws:*
- Hardcoded zero metrics
- Division-by-zero on Sharpe
- Missing wallet validation

#### 4.6 alerts/recent
*Where:* `apps/verify/src/app/api/alerts/recent/route.ts`
*Purpose:* Return recent ops alerts. Query params: ?limit (max 100, default 25), ?kind, ?since (unix-seconds). Depends on SCRIBE_URL.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | GET /api/alerts/recent with Scribe available | 200 JSON with alerts[], count<=25, source='scribe' | BLOCKER | [ ] |
| 2 | GET /api/alerts/recent?limit=200 (exceeds max) | 200 with limit clamped to 100 | HIGH | [ ] |
| 3 | GET /api/alerts/recent?limit=-1 (negative) | 200 with limit clamped to 1 or default | MED | [ ] |
| 4 | GET /api/alerts/recent?since=abc123 (non-numeric) | 400 or 200 with since ignored | MED | [ ] |
| 5 | GET /api/alerts/recent with SCRIBE_URL unavailable | 200 JSON with alerts=[], source='pending' | HIGH | [ ] |

*States to verify:* Limit clamped 1-100 / Timestamp >= since param / Kind in closed enum / Results ordered descending
*Hunt for these flaws:*
- Unbounded limit
- Missing timestamp validation
- Missing since fence
- Stale cache

#### 4.7 audit-findings
*Where:* `apps/verify/src/app/api/audit-findings/route.ts`
*Purpose:* Return audit findings from filesystem. Returns empty with source='pending' if missing.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | GET /api/audit-findings with findings.json present | 200 JSON with findings[], source='filesystem' | BLOCKER | [ ] |
| 2 | GET /api/audit-findings with findings.json missing | 200 JSON with findings=[], source='pending' | MED | [ ] |
| 3 | GET /api/audit-findings with corrupted findings.json | 200 JSON with findings=[], source='pending' | HIGH | [ ] |

*States to verify:* Filesystem artifact accessible / JSON parseable / Findings array non-null
*Hunt for these flaws:*
- Missing error handling
- Uncaught JSON.parse exception
- Stale cache

#### 4.8 auth/logout
*Where:* `apps/verify/src/app/api/auth/logout/route.ts`
*Purpose:* POST endpoint for session termination and cookie clearance.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | POST /api/auth/logout with active session | 200 JSON with ok=true, session cookie cleared | BLOCKER | [ ] |
| 2 | POST /api/auth/logout without session | 200 JSON with ok=true (idempotent) | MED | [ ] |
| 3 | POST /api/auth/logout with invalid body | 200 JSON with ok=true (body ignored) | LOW | [ ] |

*States to verify:* Session cookie deleted / Set-Cookie with MaxAge=0 / Cookie path correct
*Hunt for these flaws:*
- Session not cleared
- Missing Set-Cookie header
- Cookie not hardened

#### 4.9 auth/nonce
*Where:* `apps/verify/src/app/api/auth/nonce/route.ts`
*Purpose:* GET for SIWE challenge generation. Generates 16-byte random hex in httpOnly cookie (15-min TTL).

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | GET /api/auth/nonce with no prior nonce | 200 JSON with nonce=0x..., httpOnly cookie | BLOCKER | [ ] |
| 2 | GET /api/auth/nonce, verify nonce format | Nonce matches regex ^0x[0-9a-fA-F]{32}$ | HIGH | [ ] |
| 3 | GET /api/auth/nonce, verify MaxAge=900 | Set-Cookie with MaxAge=900 | HIGH | [ ] |
| 4 | GET /api/auth/nonce twice in succession | Two different nonces (not reused) | HIGH | [ ] |
| 5 | GET /api/auth/nonce verify randomness | Each nonce unique and unpredictable | HIGH | [ ] |

*States to verify:* Nonce random and unique / Nonce format valid (16-byte hex) / Cookie httpOnly, secure, sameSite=strict, MaxAge=900 / Response JSON matches cookie
*Hunt for these flaws:*
- Non-random nonce
- Cookie not httpOnly
- Missing MaxAge
- Nonce not in response
- Not freshly generated


### 4.cov Full API coverage (all 50 routes)

Every endpoint must be checked for: happy path, empty/pending, error/outage, auth (401/403 where applicable), input validation, and honesty of source.

| Route | Coverage | Pass |
|-------|----------|------|
| `/api/agents/[id]/profile` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/agents/issue-mandate` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/agents/leaderboard` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/agents/my-mandates` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/agents/summary` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/alerts/recent` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/audit-findings` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/auth/logout` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/auth/nonce` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/auth/verify` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/chaos/inject` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/chaos/restore` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/cohort/partners` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/deployments/address` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/deployments/status` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/faucet/status` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/feedback` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/kani/status` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/lantern/latest` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/lantern/verify-inclusion` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/loadtest/metrics` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/notifications` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/portfolio/activity` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/portfolio/buying-power` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/portfolio/margin-health` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/portfolio/positions` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/portfolio/summary` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/protocol/metrics` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/protocol/subsystems` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/research-attestation/latest` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/reserves/merkle` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/reserves/recent` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/reserves/summary` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/scribe/health` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/settings/connected-sites` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/settings/gas` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/settings/notifications` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/settings/wallet` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/sumsub/callback` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/tax/allowance` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/tax/events` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/tax/export` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/tax/summary` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/trade/margin-impact` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/trade/orderbook` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/transfer/chain-balance` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/transfer/last` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/transfer/quote` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/transfer/recent` | Smoke pass (apply the Global checklist in S1) | [ ] |
| `/api/vault/stats` | Smoke pass (apply the Global checklist in S1) | [ ] |

---

## 5. Components + universal state matrix

> LAUNCH-READINESS QA TEST PLAN: COMPONENTS-STATES DIMENSION. Every interactive surface in /app/** (buttons, modals, forms, tables, tabs, tooltips, navigation, banners, lists) must pass a UNIVERSAL STATE MATRIX: loading, empty, error, permission/disabled, success, mobile/responsive, real-time update, keyboard/focus. This plan enumerates 12 component families with specific test cases grounded in actual code. Hunt for dead buttons, modals that don't close, forms with no validation, missing disabled/loading states, fake data shown as real, broken mobile nav, off-brand styling, silent failures, accessibility violations, and sloppy copy. Grade: blocker (launch blocking), high (critical user-facing flaw), medium (professional polish), low (minor cosmetic). Every test case specifies a concrete ACTION, the EXPECTED premium outcome, and identifies specific flaws likely to surface in code.

#### 5.1 Button Family (Base + Semantic)
*Where:* `apps/verify/src/components/ui.tsx (lines 1-150, PrimaryButton, SecondaryButton, DangerButton)`
*Purpose:* Test all button states across the universal state matrix. Buttons are the most-clicked surface and the most likely to have dead clicks, missing disabled states, or inconsistent styling.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Click a PrimaryButton (bg-ink) in normal state | Button triggers its onClick handler with no delay. Hover state shows darker ink background (hover:bg-ink-dark). Visual feedback is immediate and clear. | BLOCKER | [ ] |
| 2 | Click a PrimaryButton while it is disabled (disabled={true}) | No handler fires. Button appears with opacity-60 (60% opacity) and cursor-not-allowed. Visual state is unmistakable and prevents accidental interaction. | BLOCKER | [ ] |
| 3 | Click a PrimaryButton with pending/loading state (e.g., useVaultDeposit checking allowance) | Button is disabled, opacity-60, label changes to indicate progress ('Checking allowance…'). User cannot double-click. After success, button returns to enabled state. | BLOCKER | [ ] |
| 4 | Press Tab to focus a PrimaryButton, then press Space or Enter | Button activates as if clicked. Focus ring is visible (ring-2 or outline). On mobile, focus ring disappears on blur (not permanently visible). | HIGH | [ ] |
| 5 | View SecondaryButton (border border-divider bg-parchment) on light backgrounds | Button text is ink-colored and readable. Border is subtle but visible. Hover effect lightens border (hover:border-ink/30). Button does not blend into background. | HIGH | [ ] |
| 6 | View DangerButton (bg-neg) for destructive actions (e.g., Emergency close confirm) | Button is red/negative color, high contrast text (parchment). Hover state is darker. Label clearly signals destructive intent ('Confirm emergency close', not 'OK'). | HIGH | [ ] |
| 7 | Test button on mobile (viewport < 640px). Button min-h-[44px] (44px minimum height per WCAG touch target). | Button is tap-friendly (at least 44x44 CSS pixels). Text is readable. No overflow of text outside button boundary. | HIGH | [ ] |
| 8 | Hover over button with no hover state CSS (e.g., button missing hover:bg-ink-dark) | User sees SOME visual change (opacity, color, or cursor-pointer). Dead button feels unresponsive. | MED | [ ] |

*States to verify:* idle (enabled, ready to click) / loading/busy (disabled, label shows spinner or 'Checking...' text) / disabled (permission/requirement gate, e.g., wallet not connected, deployment not ready) / success (label changes, often button becomes 'again' variant) / error (retryable, button re-enables with 'retry' label) / mobile/tap-friendly (44px+ height, readable text) / focus/keyboard (Tab navigable, Space/Enter activates, focus ring visible) / hover (visual feedback on mouse over)
*Hunt for these flaws:*
- Dead button: onClick handler missing or not wired (e.g., deposit-card.tsx pre-fix had type='button' with no onClick)
- Missing disabled state: button clickable when it shouldn't be (e.g., submit button clickable before form is ready)
- Opacity-60 not applied: disabled button looks enabled, user tries to click
- No focus ring: button not keyboard-navigable
- Label doesn't change on state: user doesn't know button is submitting
- Hover state missing: button feels unresponsive to mouse
- Inconsistent min-h: buttons vary in height; some < 44px on mobile
- Text overflow: button label wraps or overflows outside boundary

#### 5.2 Modal & Dialog Family
*Where:* `apps/verify/src/components/ui/modal.tsx, apps/verify/src/components/ui/confirm-modal.tsx, apps/verify/src/components/portfolio/emergency-close-banner.tsx`
*Purpose:* Test modal lifecycle: open, focus trap, keyboard (Tab, Escape), click-outside dismissal, close button, scroll lock, focus restoration. Modals are high-friction surfaces where UX mistakes feel broken.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Click a button that opens a Modal (e.g., 'Use emergency partial close') | Modal appears centered with overlay (bg-ink/40 backdrop). Modal has border-divider, rounded-xl, max-h-[90vh] overflow-y-auto. Focus moves to first focusable element (FOCUSABLE_SELECTOR) inside modal. | BLOCKER | [ ] |
| 2 | Modal is open. Press Escape key. | Modal closes immediately. Focus returns to the button that opened it (previouslyFocused.current restored via isConnected check). Page content behind modal is no longer scrollable. | BLOCKER | [ ] |
| 3 | Modal is open. Click the modal close-X button (ModalCloseButton, aria-label='Close dialog') | Modal closes. Focus returns to opener. No visual lag or flicker. | BLOCKER | [ ] |
| 4 | Modal is open. Click anywhere on the overlay (bg-ink/40 backdrop) but outside the modal content box | Modal closes. Click inside modal content does not close (e.stopPropagation). Click on backdrop reliably closes (onClick handler on outer div). | HIGH | [ ] |
| 5 | Modal is open with multiple focusable elements inside (buttons, inputs, links). Press Tab repeatedly. | Focus cycles through focusable elements in order. At last focusable (e.g., 'Confirm emergency close' button), pressing Tab again wraps to first focusable element. Focus never escapes modal. | HIGH | [ ] |
| 6 | Modal is open. Press Shift+Tab on first focusable element. | Focus wraps to last focusable element. Backward Tab cycling works smoothly. | HIGH | [ ] |
| 7 | Modal is open. Scroll page behind modal (on mobile or desktop with mouse wheel). | Page does not scroll. Modal scroll-lock acquired via acquireBodyLock() (body.style.overflow='hidden'). Lock persists until modal closes. Multiple modals stack lock count (LOCK_COUNT_ATTR data attribute). | HIGH | [ ] |
| 8 | Modal content is tall (> 90vh). User scrolls modal content internally. | Modal container (max-h-[90vh] overflow-y-auto) scrolls, not the page behind. Scrollbar is visible inside modal only. | MED | [ ] |
| 9 | Modal opens. Close modal. Open a second modal while first focus restoration is pending. | Second modal's focus trap activates. Escape closes second modal, restores focus to second opener (not first). No focus conflict or restoration race condition. | MED | [ ] |
| 10 | ConfirmModal (wraps Modal with title, description, cancel/confirm buttons) is opened. User clicks Cancel button. | Modal closes via onClose callback. Page state reverts (no side effects from confirm). | HIGH | [ ] |
| 11 | ConfirmModal with destructive={true} flag is opened (changes button styling from black to red/neg). | Confirm button is clearly red/negative colored (bg-neg text-parchment). Visual language unmistakably signals destructive action. | HIGH | [ ] |

*States to verify:* closed (modal not rendered, overlay not visible) / opening (modal appears with backdrop, focus trap activates) / open-with-content (modal displays title, description, buttons, form inputs) / loading/async-action (confirm button disabled, label shows 'Submitting...') / success (status text shows green success message with tx hash link) / error (status text shows error reason, retry button enabled) / closing (Escape or close button clicked, focus restoration in progress) / mobile/responsive (modal fills viewport with safe padding, scrollable on small screens)
*Hunt for these flaws:*
- Modal doesn't close on Escape key (onKeyDown listener not attached or stopped propagation incorrectly)
- Modal doesn't close on click-outside (onClick on backdrop not wired)
- Modal doesn't close on close-X button (ModalCloseButton missing or onClick not firing)
- Focus escapes modal: Tab on last element doesn't wrap, user can Tab to page elements behind
- Focus not restored: closing modal leaves focus on page element instead of opener
- No scroll lock: user can scroll page behind modal (body.style.overflow not set)
- Modal content overflows and cuts off (max-h-[90vh] not respected, or content > 90vh with no scrollbar)
- Modal backdrop invisible or too dark (overlay opacity wrong, backdrop-blur not applied)
- Close-X button invisible or unclickable (color too light, hit area too small, position off-screen)
- No aria-modal or aria-label: screen reader users cannot identify modal as dialog
- Modal label empty or generic ('Dialog' instead of 'Emergency close')

#### 5.3 Form Family (Input, NumberField, SelectField, Textarea)
*Where:* `apps/verify/src/components/ui.tsx (TextField, NumberField, SelectField), apps/verify/src/components/vault/deposit-card.tsx, apps/verify/src/components/vault/withdraw-card.tsx, apps/verify/src/components/trade/slippage-select.tsx`
*Purpose:* Test form field lifecycle: empty state, user input, validation (or lack thereof), disabled state, error messages, focus/keyboard, real-time feedback. Forms are trust surfaces - bad validation or missing error states make users feel unsafe.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Focus a TextField or NumberField input (e.g., deposit amount in VaultDeposit). | Input gets focus ring (focus:border-ink/40 focus:outline-none). Placeholder text ('0.00') is visible and readable. Cursor is positioned in field. | HIGH | [ ] |
| 2 | Type a number into NumberField (e.g., '123.45') to set deposit amount. | Input value updates in real-time. Button state re-evaluates (ready gate checks amount > 0). No lag or delay. Input is readable (font-mono text-lg text-ink). | BLOCKER | [ ] |
| 3 | User clears the NumberField (deletes text, field is empty). Observe button state. | Button disables because ready gate fails (amount.length === 0 \|\| parseFloat(amount) <= 0). Button shows disabled opacity-50. User cannot submit empty form. | BLOCKER | [ ] |
| 4 | User types a negative number ('-5.00') into NumberField. Form is submitted via pressing Enter or clicking button. | Form submission prevented or backend rejects with error message displayed. Negative amounts are invalid. | HIGH | [ ] |
| 5 | NumberField is disabled (disabled={true}, e.g., during busy state). | Input appears grayed out (opacity-50 or disabled styling). User cannot type into field. Cursor shows 'not-allowed' on hover. | HIGH | [ ] |
| 6 | SelectField is rendered (e.g., slippage-select.tsx with preset buttons 0.05%, 0.10%, 0.50%). | All 3 preset buttons are visible and clickable. Selected button has active styling (bg-ink text-parchment). Unselected buttons are muted (bg-parchment-soft text-muted). | HIGH | [ ] |
| 7 | User clicks Custom button to reveal custom input field in SlippageSelect. | Input field appears (showCustom toggles true). Input is focused (autoFocus). Placeholder is visible ('0.00'). User can type decimal number. | HIGH | [ ] |
| 8 | User types a custom slippage value ('0.25') into SlippageSelect custom input, then presses Enter. | Input validates (parseFloat('0.25') = 0.25, check 0 < v < 50 passes). Value is persisted to localStorage scoped by wallet address. Custom input hides (showCustom resets false). Custom button now shows '0.25%'. | HIGH | [ ] |
| 9 | User types an invalid value ('abc' or '999999') into SlippageSelect custom input, presses Enter. | Validation fails silently ('abc' parseFloat=NaN, '999999' > 50 fails). Input reverts to previous value or clears. No error toast. User attempts again. | MED | [ ] |
| 10 | Form shows error state (e.g., useBalanceAware returns disabledReason='Insufficient USDC balance'). Check error text rendering. | Error message displays in neg (red) color with clear explanation (mt-1 text-[10px] text-neg). Button is disabled. User sees why they cannot submit. | HIGH | [ ] |
| 11 | NumberField has a Max button (e.g., VaultDeposit). User clicks Max. | Input value populates with user's max available balance (derived from useBalanceAware). Button enable state re-evaluates. Form is ready to submit. | HIGH | [ ] |
| 12 | Form is submitted. Async operation begins (approve or withdraw). Button is disabled during busy. | Button label changes to 'Checking allowance...' or 'Depositing...'. Button disabled={true}. User cannot double-click. Submit handler not called again. | BLOCKER | [ ] |

*States to verify:* empty (input has no value, placeholder visible, button disabled) / focused (input has focus ring, cursor visible, user can type) / filled (user has entered data, button enable state re-evaluates) / disabled (form element grayed out, cannot type, cursor-not-allowed) / validating (async validation in progress, spinner or 'Checking...' label) / error (validation failed or server error, error message displayed in red) / success (form submitted, success message with tx hash, button state changes to 'again') / mobile/responsive (input readable on mobile, min-h-[44px], no text cutoff)
*Hunt for these flaws:*
- No onChange handler wired: user types but value doesn't update on screen
- No validation: form accepts invalid input (negative amounts, out-of-range slippage, invalid hex addresses)
- No disabled state: button submittable while form is busy, causing double-submit
- Error message missing: validation fails silently, user has no idea why form won't submit
- No focus ring: field not keyboard-accessible, focus invisible
- Input too small: < 44px height on mobile, not tap-friendly
- Placeholder text too light: unreadable or indistinguishable from actual value
- Max button broken or missing: user cannot fill max amount
- Custom input not persisted: user enters custom value, refreshes page, value is lost
- Invalid input accepted: parseFloat('NaN') or Infinity silently ignored, user thinks input was saved
- Button label misleading: 'Approve sent · click again' doesn't clearly explain user must confirm wallet tx

#### 5.4 Table Family (OpenPositionsTable, EventsTable)
*Where:* `apps/verify/src/components/portfolio/open-positions-table.tsx, apps/verify/src/components/tax/events-table.tsx`
*Purpose:* Test table state transitions: loading (skeleton rows), empty (source=pending vs. source=scribe), error, data display, per-row actions (close, retry), real-time updates, mobile responsiveness. Tables are heavy data surfaces where wrong states feel broken.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to /app/portfolio/positions on first load. Positions query is fetching. | 3 skeleton rows (Skeleton component, animate-pulse gray boxes) render while data loads. 'Open positions' heading visible. User understands page is loading, not broken. | HIGH | [ ] |
| 2 | Positions query fails (Scribe unreachable). Table shows error state. | Skeleton rows disappear. Centered error message: 'Could not load positions' (heading). Subtext: 'Scribe is unreachable. Positions will load once the service recovers.' User is informed and knows to retry or come back later. | HIGH | [ ] |
| 3 | Positions query succeeds but returns empty array. Source is 'scribe'. | Skeleton rows disappear. Centered message: 'No open positions yet. Start your first trade.' (or similar). Button to navigate to /app/trade. No ambiguity - table is truly empty, not still loading. | HIGH | [ ] |
| 4 | Positions query returns pending state (source='pending'). Data has not yet synced from chain. | Skeleton rows show. Subtext message: 'Positions will appear here once synced from blockchain (currently pending)' or 'not yet available'. Different from true empty state or error. | HIGH | [ ] |
| 5 | Table displays 3+ position rows. User sees price columns (entryPrice, markPrice) that are null (pending oracle data). | Null prices render as '-' (em dash). Tooltip on hover explains 'oracle data pending' or similar. User is not confused by missing data. | MED | [ ] |
| 6 | User hovers over a position row. Row background color changes (hover:bg-parchment-soft/40). | Hover effect is subtle but visible. User understands row is interactive. Close button on row becomes more prominent on hover. | MED | [ ] |
| 7 | User clicks the Close button on a position row. Position close request is submitted. | Close button disables (disabled={true} opacity-50). Row status shows '...' (ellipsis, pending state). User cannot click again. | BLOCKER | [ ] |
| 8 | Position close succeeds. Row status updates to show 'closed ↗' (link to tx on Arbiscan). | Status link is blue, underlined, opens in new tab (target='_blank'). Row remains visible (not immediately deleted). User can verify tx on block explorer. | HIGH | [ ] |
| 9 | Position close fails with liquidity error. Row status shows 'retry' (button). | EmergencyCloseBanner appears below table with explanation: 'Normal close failed for [instrument]. Venue likely has no liquidity.' User has alternative path (emergency partial close). | HIGH | [ ] |
| 10 | User clicks retry on a failed position close. Request resubmits. | Status goes back to '...' (pending). Close button re-disables. User can see operation is retrying, not stuck. | HIGH | [ ] |
| 11 | View EventsTable (tax/events-table.tsx) on /app/tax route. Query is loading. | 4 skeleton rows render. 'Events' heading visible. Same loading pattern as OpenPositionsTable. | HIGH | [ ] |
| 12 | EventsTable displays rows with Realized Gain/Loss colors (green=profit, red=loss, black=flat). | Color-coding is accurate and high-contrast. Green text on parchment background is readable. Red text is readable. Black/ink text is readable. No accessibility fail. | HIGH | [ ] |

*States to verify:* loading (skeleton rows animating, user sees activity) / error (error message, user knows why table failed) / empty (source=scribe, true empty state vs. pending empty state) / pending (source=pending, data not yet available from chain) / populated (data rows with real values or '-' for null fields) / row-action-busy (per-row close button disabled, status shows ellipsis) / row-action-success (status shows 'closed ↗' with tx link) / row-action-error (status shows 'retry' button for failed close) / real-time-update (positions table refetches every 5-10s, rows update without flicker) / mobile/responsive (table scrolls horizontally on mobile, column headers sticky or wrapped)
*Hunt for these flaws:*
- Skeleton rows never disappear: data loads but UI still shows spinners
- Empty state same as error state: user cannot distinguish 'truly empty' from 'failed to load'
- Pending state not distinguished: source='pending' rows shown as error or empty, confusing user about sync status
- Null prices not handled: null entryPrice renders as 'null' string or blank, no tooltip explanation
- No hover effect: row is not clearly interactive, user doesn't see close button
- Close button stays disabled: button disabled after success, cannot close another position
- Double-submit possible: close button not disabled during submission, user double-clicks and submits twice
- Status link broken: tx hash link invalid or opens wrong block explorer
- No emergency banner: liquidity error shown as generic 'retry', user has no escape hatch
- Table layout broken on mobile: columns overflow, headers not visible, cannot scroll horizontally
- Color accessibility fail: green/red gain/loss colors only indicate meaning, not readable for colorblind users

#### 5.5 Tab Group & Navigation (VenueChipBar, MobileBottomNav, AppShellWalletCard)
*Where:* `apps/verify/src/components/trade/venue-chip-bar.tsx, apps/verify/src/components/mobile/mobile-bottom-nav.tsx, apps/verify/src/components/app-shell-wallet-card.tsx`
*Purpose:* Test tab/nav selection, active state styling, keyboard navigation, mobile responsiveness, URL synchronization. Navigation is critical for app discoverability and usability.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | View VenueChipBar on /app/trade. 5+ venue chips visible (Hyperliquid, Aave, Pendle, Trade.xyz, Polymarket, HL-HIP4). | All venues render as clickable buttons. Each shows shortLabel, full name, and haircut percentage. Venues pulled from canonical VENUES const for single source of truth. | HIGH | [ ] |
| 2 | Click a venue chip (e.g., 'Aave'). Chip becomes active. | Active chip styling: border-ink bg-ink text-parchment. Inactive chips: border-divider bg-parchment text-ink. OrderForm, OrderBook, MarginImpactPanel all update to show Aave data (venue id drives symbol resolution via SYMBOL_BY_VENUE map). | BLOCKER | [ ] |
| 3 | VenueChipBar is active={venue} controlled component. Parent (TradeView) owns state. Parent re-renders. | Active chip styling persists (no flicker). Child components re-render only if venue id changes, not on parent re-render. | MED | [ ] |
| 4 | Press Tab to focus a venue chip. Press Space or Enter to activate. | Chip activates as if clicked. Focus ring visible. Active styling updates. Next Tab focus moves to next chip, not off the chip bar. | HIGH | [ ] |
| 5 | View MobileBottomNav on mobile device (/app/* routes). 5 tabs visible: Trade, Portfolio, Vault, Agents, Settings. | Tabs are fixed at bottom (fixed bottom-0 left-0 right-0). Glass-blur effect (backdrop-blur-xl) shows. Safe area padding applied (safe-area-inset-bottom). Tabs do not overlap page content. | BLOCKER | [ ] |
| 6 | Tap a bottom nav tab (e.g., Portfolio). Active tab updates. | Active tab has higher ink color, bottom accent halo. Tab icon scales up (scale-110). aria-current='page' set on active tab. Navigation to /app/portfolio occurs (route sync). | BLOCKER | [ ] |
| 7 | User is on /app/settings. Settings tab in bottom nav is marked as active. | Settings tab shows active state (aria-current='page'). Bottom nav also matches on /app/notifications, /app/reserves, /app/tax (multiple route patterns). | HIGH | [ ] |
| 8 | Press Tab on bottom nav tabs. Focus cycles through all 5 tabs. | All tabs are keyboard-navigable. Tab order left-to-right. After last tab (Settings), Tab moves focus up to page content (not trapped in nav). | HIGH | [ ] |
| 9 | View AppShellWalletCard on app-shell.tsx. User wallet is connected. | Card shows EIP-55 checksummed wallet address (e.g., '0x1234...abcd'). Gradient background applied (connected state). aria-label='Wallet connected: 0x1234...abcd'. Click navigates to /app/settings. | HIGH | [ ] |
| 10 | User disconnects wallet (via wallet UI). AppShellWalletCard updates. | Text changes to 'Not connected'. Background loses gradient (plain divider border). aria-label changes to 'Wallet not connected'. Click still navigates to /app/settings for connect action. | HIGH | [ ] |
| 11 | Wallet connection changes mid-render (race condition). AppShellWalletCard reads live useAccount hook. | Address display may flicker briefly but settles correctly. No stuck 'connecting' state. No old address displayed after disconnect. | MED | [ ] |

*States to verify:* tabs-rendered (all tabs visible, labeled, clickable) / tab-active (active tab has distinct styling, aria-current or role=tab aria-selected) / tab-inactive (non-active tabs are muted, not selected) / keyboard-navigation (Tab cycles through tabs, Space/Enter activates, focus visible) / mobile-fixed-nav (bottom nav fixed at bottom, does not overlay content, safe-area respected) / mobile-glass-effect (backdrop-blur visible, semi-transparent background) / route-sync (clicking tab navigates to correct URL, active state matches URL) / icon-scale (active tab icon scales up, visual prominence clear) / wallet-connected (shows address, gradient background, correct aria-label) / wallet-disconnected (shows 'Not connected', no gradient, aria-label reflects state)
*Hunt for these flaws:*
- Chip not clickable: onClick not wired or event stopped propagation
- Active state not persisted: user clicks chip, then page re-renders, active state resets
- Symbol not updated: user selects Aave chip but OrderBook still shows Hyperliquid data (SYMBOL_BY_VENUE map broken)
- No focus ring: chips not keyboard-navigable, Tab skips them
- Mobile nav covers content: bottom nav overlays page content, user cannot see form inputs
- Safe area not applied: bottom nav extends under phone home indicator on iOS
- Tab order wrong: Tab skips some tabs or wraps in unexpected order
- Mobile glass effect missing: nav looks opaque or flat, no visual distinction from page
- Wallet address not checksummed: shows lowercase '0x1234...abcd' instead of EIP-55 mixed-case
- Wallet disconnect not reflected: old address still shows after wallet disconnect
- No aria-label or role: tabs not semantic HTML, screen readers cannot navigate

#### 5.6 Tooltip & Help (HelpTip, Skeleton, StatusLine)
*Where:* `apps/verify/src/components/ui/help-tip.tsx, apps/verify/src/components/ui/skeleton.tsx`
*Purpose:* Test ephemeral UI surfaces that provide context without breaking flow. Tooltips and help tips are user-friendly affordances that must not be off-screen, non-interactive, or invisible.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | View a HelpTip component (inline '?' button that shows tooltip on hover). | Button is visible and small (typically 1em × 1em icon). Tooltip text is not visible initially. Button has aria-label explaining what it does. | HIGH | [ ] |
| 2 | Hover over HelpTip button. Tooltip appears. | Tooltip shows helpful text (e.g., 'Haircut is the venue's margin requirement for this symbol'). Tooltip is positioned absolute with z-50 (above page content). Text is readable (white or dark text on contrasting background). | HIGH | [ ] |
| 3 | Move mouse away from HelpTip button. Tooltip disappears. | onMouseLeave handler fires, tooltip hides. No lingering tooltip. Tooltip does not interfere with other page elements. | MED | [ ] |
| 4 | Focus HelpTip button via keyboard (Tab). Tooltip appears. | onFocus fires, tooltip shows. onBlur or Escape hides tooltip. User can navigate with Tab and see all tooltips. | HIGH | [ ] |
| 5 | HelpTip is near viewport edge (e.g., near right edge on mobile). Tooltip is positioned absolutely. | Tooltip does not overflow viewport. Tooltip is repositioned to stay on-screen (or user can scroll to see it). No off-screen invisible tooltip. | MED | [ ] |
| 6 | Skeleton component is rendered (loading placeholder, e.g., in table loading state). | Gray box appears (bg-parchment-soft or similar muted color). animate-pulse class makes it pulse gently. aria-hidden='true' hides from screen readers. Default 100% width, 1em height. | HIGH | [ ] |
| 7 | Skeleton is used for variable-height content (e.g., 3 skeleton rows in table). Each skeleton renders. | Each skeleton box is roughly the same height as real row content (width auto, height customizable via props). User sees plausible loading preview, not oversized or tiny skeletons. | MED | [ ] |
| 8 | Data loads and skeleton disappears. Real content renders. | Smooth transition (no flicker). Content layout does not shift (skeleton height matched real content height). User experiences natural loading. | MED | [ ] |
| 9 | StatusLine component displays transaction hash link (e.g., deposit success). | TX hash is rendered as blue underlined link. Link points to arbiscanTxUrl (https://sepolia.arbiscan.io/tx/[hash]). Link opens in new tab (target='_blank' rel='noreferrer noopener'). Hash is shortened for readability (first 8 + last 4 chars). | HIGH | [ ] |
| 10 | StatusLine shows error reason (e.g., 'Failed: Insufficient USDC balance'). Reason text is long (> 50 chars). | Text renders fully or wraps. No text cutoff. Error color is readable (text-neg or similar). Button to retry is visible below or beside. | MED | [ ] |

*States to verify:* tooltip-hidden (initial state, no tooltip visible) / tooltip-visible-on-hover (onMouseEnter triggers show) / tooltip-visible-on-focus (onFocus triggers show, keyboard accessible) / tooltip-hidden-on-blur (onBlur hides tooltip) / tooltip-on-screen (positioned to not overflow viewport) / skeleton-animate (animate-pulse class applies gentle pulsing) / skeleton-hidden-a11y (aria-hidden='true' excludes from screen readers) / status-link-clickable (link opens tx on Arbiscan) / error-reason-readable (long error text wraps and does not cut off)
*Hunt for these flaws:*
- Tooltip invisible: onMouseEnter not firing or tooltip opacity=0
- Tooltip off-screen: tooltip positioned left:-100px or similar, invisible on edge of page
- Tooltip blocks interaction: tooltip z-index too high, clicking through tooltip hits element behind
- Tooltip not keyboard-accessible: onFocus handler missing, Tab does not trigger tooltip
- Skeleton does not pulse: animate-pulse class missing, skeleton appears static
- Skeleton height mismatched: real content taller than skeleton, page layout jumps when data loads
- TX hash link broken: link points to wrong block explorer or invalid hash format
- Error reason cutoff: long error text overflows button container, truncated without ellipsis
- No aria-label on HelpTip: screen reader users cannot understand button's purpose
- Tooltip text too small: font-size too small to read (< 12px on mobile)

#### 5.7 Banner & Alert (WrongChainBanner, EmergencyCloseBanner, CookieConsentBanner)
*Where:* `apps/verify/src/components/wrong-chain-banner.tsx, apps/verify/src/components/portfolio/emergency-close-banner.tsx, apps/verify/src/components/cookie-consent-banner.tsx`
*Purpose:* Test conditional banners that surface critical information or warnings. Banners are non-dismissible or conditionally dismissible; their presence/absence must sync with app state.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | User is on Arbitrum Sepolia testnet. WrongChainBanner is rendered. | Banner does not appear (ok=true, banner returns null). Page content is visible without obstruction. | BLOCKER | [ ] |
| 2 | User switches wallet chain to Ethereum Mainnet. WrongChainBanner appears. | Banner shows: 'You are on Ethereum. Atrium runs on Arbitrum Sepolia testnet.' (or similar). Button 'Switch to Arbitrum' is visible. Banner has warning color (testnet border and background). | BLOCKER | [ ] |
| 3 | User clicks 'Switch to Arbitrum' button on WrongChainBanner. | switchChain(CHAIN_ID) is called via wagmi. Wallet shows confirmation dialog. On success, banner disappears. On failure, user sees wallet error. | HIGH | [ ] |
| 4 | Position close fails with liquidity error. EmergencyCloseBanner appears below position row. | Banner shows: 'Normal close failed for [instrument]. Venue likely has no liquidity for the full size.' (testnet/40 border bg-testnet/5). Buttons: 'Use emergency partial close' (testnet bg) and 'Dismiss' (underline). Reason text truncated (max 40 chars with ellipsis). | HIGH | [ ] |
| 5 | User clicks 'Use emergency partial close' button. Modal opens. | Modal appears with title 'Emergency close', explanation text, and confirm button. Modal follows modal.tsx behavior (focus trap, Escape to close, backdrop click to close). | HIGH | [ ] |
| 6 | User submits emergency close in modal. Status transitions: resolving → submitting → success. | Button label changes: 'Resolving Vigil…' → 'Submitting…' → 'Queued'. Success message shows green text with tx hash link. Modal remains open for user to review. | HIGH | [ ] |
| 7 | User clicks 'Dismiss' on EmergencyCloseBanner. | Banner disappears. onClose callback fires. User can still retry normal close or navigate away. Banner state managed by parent (OpenPositionsTable). | MED | [ ] |
| 8 | User lands on /app/* routes. CookieConsentBanner is rendered. | Banner appears at bottom (fixed or sticky positioning). Message: 'We use cookies for analytics.' Accept and Decline buttons visible. Dismiss X button visible. | MED | [ ] |
| 9 | User clicks Accept on CookieConsentBanner. | Consent is persisted (localStorage or cookie). Banner dismisses. Analytics tracking is enabled (gtag or similar fires). | MED | [ ] |
| 10 | User clicks Decline on CookieConsentBanner. | Consent is rejected (persisted in localStorage). Banner dismisses. Analytics tracking is not enabled. | MED | [ ] |

*States to verify:* banner-hidden (ok=true for WrongChainBanner, normal state) / banner-visible (ok=false or emergency error condition, banner renders) / banner-has-action-button (Switch to Arbitrum, Use emergency partial close, etc.) / banner-has-dismiss (X button or Dismiss link) / button-clickable (onClick fires, state changes) / modal-opens-on-action (clicking main action opens related modal) / async-state-transitions (button label changes as operation progresses) / consent-persisted (user's choice remembered across page refreshes)
*Hunt for these flaws:*
- Banner stuck visible: ok=true but banner still renders (conditional return null broken)
- Banner stuck hidden: ok=false but banner returns null (state not updated)
- Action button not clickable: onClick not wired or disabled
- Modal does not open: clicking 'Use emergency partial close' does not open modal
- Modal does not close: clicking 'Cancel' or pressing Escape does not dismiss modal
- Switch chain fails silently: switchChain(CHAIN_ID) fails but no error shown, user confused
- Banner covers content: banner z-index too high, user cannot click page elements
- Dismiss not sticky: user dismisses banner, page refreshes, banner reappears
- Consent not persisted: user accepts cookies, refreshes, consent banner reappears
- Reason text not truncated: error reason overflows banner (> 40 chars not ellipsized)
- No accessibility: banner not aria-live, screen reader users miss critical warnings

#### 5.8 Async State Machines (Deposit Flow, Withdraw Flow, Emergency Close)
*Where:* `apps/verify/src/components/vault/deposit-card.tsx (3-step: checking → approving → depositing), apps/verify/src/components/vault/withdraw-card.tsx (1-step: submitting), apps/verify/src/components/portfolio/emergency-close-banner.tsx (3-step: resolving → submitting → success/error)`
*Purpose:* Test complex multi-step flows where state transitions are async and buttons/labels must match state exactly. Async state machines are where silent failures and misleading UI most commonly hide.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | User enters deposit amount and clicks Deposit button. No allowance, so approve is needed. | Flow: idle → checking (label: 'Checking allowance…', button disabled) → approving (label changes, approve tx submitted) → success (status line shows approve tx). User then clicks Deposit again. Flow: → depositing → success (status shows deposit tx, button becomes 'Deposit again'). | BLOCKER | [ ] |
| 2 | User enters deposit amount and clicks Deposit button. Allowance is sufficient. | Flow: idle → checking → (skip approve) → depositing → success. No approve tx needed. Status line shows only deposit tx. Flow is shorter but UI state is correct at each step. | BLOCKER | [ ] |
| 3 | Allowance check (useDeploymentStatus(1) check) returns error. User sees error state. | Button disables with error message in neg (red) color. Message explains why: 'Coffer not deployed' or 'Wallet error: ...'. Retry button allows user to try again. | HIGH | [ ] |
| 4 | Approve tx submitted but wallet user rejects. Error is caught. | Flow resets to idle. Error message displays: 'Failed: User rejected approve tx' (humanized). Retry button is enabled. User can try again. | HIGH | [ ] |
| 5 | Approve tx succeeds. User clicks Deposit again. Deposit tx is submitted but fails. | Flow: submitting → error. Error message displays: 'Failed: Insufficient liquidity' or actual error reason. Retry button enabled. User can retry without re-approving. | HIGH | [ ] |
| 6 | Withdraw amount entered. User clicks Withdraw. Single-step flow (no approve). | Flow: idle → submitting (label: 'Submitting…', button disabled) → success or error. Status line shows tx hash on success. | HIGH | [ ] |
| 7 | Emergency close flow initiated. Modal opens, user clicks Confirm. | Flow: resolving (label: 'Resolving Vigil…', button disabled) → submitting (label: 'Submitting…') → success (label: 'Queued', green message with tx hash). | HIGH | [ ] |
| 8 | Emergency close succeeds, then user clicks Confirm again (edge case). | Button remains disabled or re-enables with correct state. No double-submit. Modal does not reset state and re-fire confirm. | MED | [ ] |
| 9 | User submits deposit, then wallet is disconnected mid-flight. | Flow aborts. Error message: 'Wallet disconnected'. Retry button. User must reconnect wallet to retry. | HIGH | [ ] |
| 10 | Button label matches state at each step (e.g., 'Deposit 100 USDC' → 'Checking allowance…' → 'Approve sent · click again' → 'Depositing…' → 'Deposit again'). | Labels are clear and distinguish each state. User always understands what just happened and what to do next. | HIGH | [ ] |

*States to verify:* idle (button enabled, label shows action name + amount) / checking (button disabled, label: 'Checking allowance...') / approving (button disabled, label: 'Approve sent · click again', approve tx hash shown) / depositing (button disabled, label: 'Depositing...') / success (button enabled 'Deposit again', green status with tx hash) / error (button enabled 'retry', red error message with reason) / wallet-disconnected (flow aborts, error message, retry button) / double-submit-prevented (button disabled during submission, clicking multiple times does not queue multiple txs)
*Hunt for these flaws:*
- State machine stuck: user clicks button, flow starts, then label never changes (state not updating)
- Label misleading: 'Approve sent · click again' but user does not realize they must confirm in wallet UI
- Button not disabled: user can click button multiple times during busy, causing double-submit
- No status line: tx hash not shown after success, user cannot verify on block explorer
- Error not humanized: raw error string shown ('IntegerOverflow' instead of 'amount too large')
- Retry button broken: user clicks retry, nothing happens (onClick not wired or state not reset)
- Flow does not reset on new input: user changes amount after error, error status still shown (status not cleared)
- Approve step skipped incorrectly: allowance is sufficient, but approve is sent anyway (unnecessary tx)
- Approve step cannot be skipped: allowance is sufficient, but flow still asks for approve (wrong check)
- Wallet disconnection not handled: disconnect during flight leaves UI in submitting state forever

#### 5.9 Mobile Responsiveness (All Components)
*Where:* `apps/verify/src/components/** (all components, responsive via Tailwind breakpoints: sm: lg: xl:)`
*Purpose:* Test that every interactive component adapts to mobile viewports (< 640px width) and remains usable. Mobile is premium surface.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | View app on iPhone 12 (390px width) or Android device. Bottom nav is visible at screen bottom (fixed position). | 5 tabs in bottom nav, icons are clear, labels are truncated or not shown (xs/sm breakpoint). Safe area inset applied (notch/home indicator does not cover nav). Tabs are tap-friendly (≥ 44px height, ≥ 44px width). Page content does not overlap nav (padding-bottom applied). | BLOCKER | [ ] |
| 2 | User taps tab in mobile bottom nav to navigate. Page transitions. | Smooth transition to new page. Active tab updates. No layout shift or jank. Tab state persists across navigation. | HIGH | [ ] |
| 3 | User opens a form on mobile (e.g., deposit card on /app/vault). Input field is visible and has sufficient spacing. | Input min-h-[44px] and min-w-[44px] (touch target). Label text is readable (not too small). Spacing between fields is adequate (mt-4 or similar). Form does not require horizontal scroll. | HIGH | [ ] |
| 4 | User scrolls a long form on mobile. Input field is focused. | Mobile keyboard appears. Input field scrolls into view (browser auto-scrolls). Form does not freeze or become unresponsive. Keyboard does not overlap critical buttons (confirm button is above keyboard line). | HIGH | [ ] |
| 5 | Table (OpenPositionsTable) is viewed on mobile. | Table scrolls horizontally or columns are hidden/reordered for mobile. User can see key info: instrument, mark price, close button. No horizontal overflow of page. Columns are readable. | HIGH | [ ] |
| 6 | Modal is opened on mobile. | Modal width is 100% - padding (not > 500px fixed width). Modal height respects max-h-[90vh] and is scrollable. Focus trap works on mobile (Tab key on virtual keyboard). Close button is tappable (≥ 44×44px). | HIGH | [ ] |
| 7 | Tooltip/HelpTip is hovered on mobile (no hover, only tap). | HelpTip shows onFocus (when user taps, if input-like) or onMouseDown. Tooltip is positioned within viewport (not off-screen on small screen). Tooltip is dismissible on blur or tap elsewhere. | MED | [ ] |
| 8 | Button with long text is rendered on mobile (e.g., 'Use emergency partial close'). | Text wraps within button or button text is truncated with ellipsis. Text is not cut off. Button height grows if needed (min-h-[44px] is minimum, can be taller). Text remains readable. | MED | [ ] |
| 9 | Multi-line error message is shown on mobile (e.g., 'Failed: ...'). | Error text wraps and does not overflow container. All error text is visible (not truncated). Text color is readable (neg color on light background). | MED | [ ] |
| 10 | User pinch-zooms page on mobile (user zoom = 150%). Page is still usable. | Text remains readable. Buttons remain tappable. Form inputs are accessible. Layout does not break (horizontal scroll is OK for content, but not for layout). | MED | [ ] |

*States to verify:* mobile-viewport (< 640px width, Tailwind sm: breakpoint) / touch-target-size (≥ 44×44px for buttons, inputs, tabs) / tab-text-visibility (labels truncated or hidden, icons clear) / form-input-accessible (input readable, keyboard does not cover confirm button) / table-horizontal-scroll (table scrolls left/right, columns visible one at a time) / modal-mobile-layout (modal fills viewport with safe padding, height is responsive) / tooltip-on-screen (tooltip positioned within viewport, not off-screen on mobile) / button-text-wrapping (long button text wraps and does not overflow) / error-text-wrapping (error messages wrap fully visible, no truncation) / zoom-resilient (page usable at 150% zoom, text readable, buttons tappable)
*Hunt for these flaws:*
- Bottom nav not fixed: nav scrolls with page content, disappears when user scrolls down
- Touch targets too small: buttons < 44px, user cannot tap reliably
- Text too small on mobile: font-size < 12px, unreadable without zoom
- Horizontal overflow: form or table requires horizontal scroll at viewport width (bad UX)
- Modal wider than viewport: modal width: 500px on 390px device, cannot be dismissed
- Keyboard covers button: submit button is below keyboard on mobile, user cannot see/tap
- Tooltip off-screen: tooltip appears outside viewport on edge of mobile screen (no repositioning)
- Button text truncated: button label is cut off with no ellipsis ('Confirm emergenc...')
- Error text truncated: error reason is cut off, user cannot read full message
- Layout shift on keyboard: keyboard appears, content jumps, layout is unstable
- Safe area not respected: nav extends under phone notch or home indicator
- No mobile-optimized columns: desktop table with 8 columns forced onto 390px mobile

#### 5.10 Real vs. Pending Data Honesty (Source Distinction)
*Where:* `apps/verify/src/components/portfolio/open-positions-table.tsx (source='scribe'|'pending'), apps/verify/src/components/tax/events-table.tsx (source='pending'|'scribe'), apps/verify/src/components/trade/order-book.tsx (source='hyperliquid'|'pending')`
*Purpose:* Test that every data surface honestly declares whether it shows REAL data from blockchain (source='scribe') or PENDING/PENDING-CONFIRMATION data (source='pending'). Never show fabricated or default data as real. Honesty is the highest bar.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | User navigates to /app/portfolio/positions on first load. Positions data is syncing from chain. | UI shows skeleton rows with subtext 'Positions will appear here once synced from blockchain (currently pending)' or 'not yet available'. NOT 'No open positions yet' (which implies user has none, not that data is pending). Empty state clearly indicates source='pending', not source='scribe'. | BLOCKER | [ ] |
| 2 | Positions data has fully synced from chain (Scribe reports latest block). Table shows positions with real mark prices, entry prices, P&L. | Subtext changes to 'Open positions' or 'Positions as of block [number]' (real data label). No 'pending' label. User trusts data is real. | BLOCKER | [ ] |
| 3 | Position row displays entryPrice and markPrice. Data is synced from oracle (real). | Prices are numbers (e.g., '1,234.56'). Trailing spaces or formats indicate real data. No '-' or 'N/A' (which indicate pending/unknown). | HIGH | [ ] |
| 4 | Position row has null entryPrice or markPrice (oracle has not reported yet). | Price cell renders '-' (em dash) with tooltip 'Oracle data pending' or similar. User understands this specific data point is pending, not stale/old. | HIGH | [ ] |
| 5 | OrderBook (venue symbol data) is loading from Hyperliquid API. | Source is 'pending'. Header shows 'orderbook pending' (subtext). midPrice is '-'. No stale/old prices shown as current. | HIGH | [ ] |
| 6 | OrderBook data has loaded from Hyperliquid API (source='hyperliquid'). | Header subtext changes to 'Hyperliquid info feed'. midPrice shows current real price. Bid/ask levels populated with real market data. User trusts price is live. | HIGH | [ ] |
| 7 | Risk preview modal on /app/trade shows client-side simulated buffer preview (not real execution). | Modal has disclaimer: '(This is a simulation based on your input. Actual venue execution may differ.)' or similar. User is NOT misled into thinking preview is guaranteed. | HIGH | [ ] |
| 8 | SlippageSelect custom value is entered and saved to localStorage. User refreshes page. | Saved value is restored and clearly labeled 'Custom' or shown as custom value. NOT presented as one of the preset values (0.05%, 0.10%, 0.50%). | MED | [ ] |
| 9 | Tax events table is loading from Scribe (source='pending'). | Empty state: 'Tax events will appear here once synced from blockchain (currently pending)'. NOT 'You have no tax events yet' (implies user has none, not pending). | HIGH | [ ] |
| 10 | Tax events table has synced (source='scribe'). Realized gains/losses are shown. | Each event shows real realized P&L value. Values are non-zero (or explicitly '0' if flat). No default/placeholder values shown as real. | HIGH | [ ] |
| 11 | User hovers over entryPrice or markPrice field showing '-'. Tooltip appears. | Tooltip explains 'Oracle data pending' or 'Mark price not yet reported'. User understands '-' means 'unknown/pending', not '0' or 'N/A'. | MED | [ ] |

*States to verify:* source-pending-explicit (UI says 'pending', not 'no data yet') / source-scribe-explicit (UI says 'synced', 'real', or 'Scribe data', not 'latest' ambiguously) / null-price-distinguished (null price is '-' not '0' or blank) / empty-vs-pending-distinct (empty state message differs from pending state message) / live-price-labeled (real live price includes 'live', 'info feed', or 'real-time') / simulated-data-disclaimed (client-side simulations include 'simulation', 'estimate', 'may differ' disclaimer) / custom-value-identified (user-entered value is labeled 'Custom', not mistaken for preset) / stale-data-not-shown (if data is > N minutes old, UI says 'last updated X minutes ago', not 'current')
*Hunt for these flaws:*
- Pending data shown as real: 'No open positions yet' when data is pending (implies user has no positions, not that data is syncing)
- Default/placeholder values shown as real: '-' or '0' for null price, user thinks price is zero or unknown (confusing)
- No source label: UI does not say whether data is real ('scribe') or pending ('pending'), user cannot tell
- Stale data not labeled: data is > 5 minutes old but shown as 'current' or 'live', user trusts outdated data
- Simulated data not disclaimed: risk preview says 'you will liquidate at X% leverage' without caveat 'this is a simulation'
- Custom value mistaken for preset: user enters '0.25%' slippage, refreshes, UI shows '0.25%' without 'Custom' label, user thinks it's preset
- Oracle data null rendered as blank: entryPrice is null, cell is visually empty (no '-'), user doesn't understand data is missing
- Pending empty state label matches real empty: both say 'No open positions', user cannot distinguish pending from truly empty
- API error not surfaced: data fetch fails, UI shows skeleton forever or last-known stale data, user has no way to know
- No tooltip on null fields: user does not understand what '-' means, assumes data is 0 or lost

#### 5.11 UNIVERSAL STATE MATRIX (Global Test Group: Apply to Every Page)
*Where:* `apps/verify/src/components/** (all interactive surfaces and pages)`
*Purpose:* Meta test group: define the UNIVERSAL STATE MATRIX that applies to every page and every interactive surface in /app/**. Every page must pass all 8 states. This is the baseline professional quality bar.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to any /app/** page (trade, portfolio, vault, tax, etc.). Page is loading initial data (useQuery refetch). | LOADING state: skeleton rows or placeholder content render. Heading and nav are visible. User understands page is loading, not broken. No blank white screen. | BLOCKER | [ ] |
| 2 | API request fails (Scribe unreachable, wallet RPC timeout, etc.). Page shows error state. | ERROR state: centered error message explains what went wrong and suggests next step (retry, check connection, etc.). User knows why page is not working, not left guessing. Error is styled distinctly (neg color or testnet warning color). | BLOCKER | [ ] |
| 3 | API returns empty result (no open positions, no tax events, no deposits). Page shows empty state. | EMPTY state: message says 'You have no X yet' or 'Get started with X' (CTA button to relevant page). Not 'Loading...' or error. User understands they can proceed (by taking an action, e.g., open a trade). | HIGH | [ ] |
| 4 | User is not connected to wallet, or wrong chain. Page shows DISABLED/PERMISSION state. | Form inputs are disabled or show 'Connect wallet' banner. Buttons are disabled with clear reason ('Connect wallet first', 'Wrong chain', etc.). User cannot submit form. Visual states clearly signal 'blocked', not 'broken'. | HIGH | [ ] |
| 5 | Action succeeds (deposit confirmed, tx mined, position closed). Page shows SUCCESS state. | Success message appears (green text, live/success color). Message includes confirmation (tx hash link, amount confirmed, etc.). Button state changes to 'again' or 'new' variant. User has clear proof of success. | HIGH | [ ] |
| 6 | View page on mobile (< 640px viewport). All text is readable, buttons are tappable (≥ 44px), no horizontal scroll for page layout. | MOBILE/RESPONSIVE state: layout adapts. Text is ≥ 12px. Touch targets ≥ 44×44px. No side-scroll required for main content. Bottom nav does not cover content (padding-bottom applied). Page is professional on mobile. | BLOCKER | [ ] |
| 7 | Page displays real-time data (positions table with 5-second refetch, order book with live prices). Wait 10 seconds, observe data updates. | REAL-TIME UPDATE state: data refreshes without full page reload. Prices/quantities update. No flicker or layout shift. User sees 'last updated: X seconds ago' or similar timestamp. Updates feel natural. | HIGH | [ ] |
| 8 | User navigates page with only Tab key (no mouse). Focus ring is visible on all interactive elements. Tab order is logical. | KEYBOARD/FOCUS state: every button, input, link, and interactive element is Tab-navigable. Focus ring is visible (ring-2 outline or similar). Tab order left-to-right, top-to-bottom. Space/Enter activates buttons. All interactive surfaces are keyboard-accessible per WCAG 2.1 AA. | HIGH | [ ] |

*States to verify:* loading (skeleton or placeholder, data is syncing) / empty (data returned but empty array/object, no results to show) / error (API error or validation failed, user informed of reason) / disabled/permission (user lacks permission or prerequisite, button/input disabled, reason shown) / success (action succeeded, confirmation shown, next action clear) / mobile/responsive (layout adapts to viewport < 640px, touch targets ≥ 44px, no horizontal scroll) / real-time-update (data refreshes dynamically, no page reload, updates visible to user) / keyboard/focus (Tab navigable, focus ring visible, Space/Enter activates, logical tab order)
*Hunt for these flaws:*
- LOADING state missing: page shows blank white screen while data loads, user thinks page is broken
- ERROR state missing: API fails, user sees nothing (no error message), unsure what happened
- EMPTY state confused with ERROR: 'No positions' message looks like error, user thinks page is broken
- DISABLED state not visual: button for disabled action (e.g., disconnect wallet) looks enabled, user clicks and sees nothing happen
- SUCCESS state unclear: action succeeds but UI gives no confirmation (no tx hash, no 'success' message), user unsure if it worked
- MOBILE layout broken: text < 12px or buttons < 44px on mobile, text unreadable, buttons untappable
- REAL-TIME updates cause flicker: data refresh causes layout shift or full re-render, user experience is janky
- KEYBOARD not accessible: Tab key does not navigate, focus ring invisible or missing, screen reader users cannot use page
- FOCUS TRAP in modal incomplete: focus escapes modal when tabbing, user can interact with page behind modal
- TAB ORDER illogical: tabbing order is right-to-left or bottom-to-top, user is confused
- ARIA labels missing: interactive elements have no aria-label, screen readers cannot identify purpose
- NO VISUAL FEEDBACK: button hover state missing, link visited state missing, user feels interaction is unresponsive


---

## 6. Copy + writing QA

> Comprehensive QA test plan for all copy/writing surfaces across the Atrium cross-venue portfolio-margin protocol (Next.js 16 app at apps/verify). Tests verify: (1) Compliance with writing.md rules (banned words, tone, claims discipline); (2) Honesty-of-claims (no invented numbers/partners/mentors, explicit conditionals, transparent pending states); (3) Voice/tone alignment (quiet prime-brokerage, cofounder voice, no marketing slop); (4) All surfaces: landing pages, modals, tooltips, error messages, empty states, button labels, docs, legal pages. Grounds every test case in real code with file paths. Includes automated test coverage validation via writing-banned-words.test.ts.

#### 6.1 Landing Page: Hero & Product Sections
*Where:* `apps/verify/src/components/landing/hero-section.tsx, apps/verify/src/components/landing/product-section.tsx`
*Purpose:* Verify landing headline, eyebrow, and product narrative follow writing.md rules and maintain honest pending states. Tests that all placeholder values use em dashes (-), all claims are sourced or marked TBD, and tone reflects cofounder voice with no marketing speak.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to landing page (/); read hero section eyebrow, headline, and trust strip | Eyebrow reads 'Prime brokerage · Unified margin · Testnet' (no banned words); headline is 'One wallet. Every venue. One buying-power number' with 'buying-power' italicized in serif; engineering chrome shows 'Fig. 01 · Capital convergence · Sheet 02 / 08 · Atrium Labs · May 2026' (properly dated, real team name). All TVL figures on venue cards show '-' (em dash), not invented numbers. No words from banned list (unlock, unleash, seamless, cutting-edge, revolutionary, empower, etc.). | BLOCKER | [ ] |
| 2 | Read product section headline and subheading | Headline: 'Capital efficiency, mathematically' with 'mathematically' in serif italic. Subheading: 'Plinth, the Stylus margin engine, reads collateral across every venue you hold positions in and computes a SPAN-style cross-product margin figure, live, on testnet. [N] venues feed one buying-power number.' (plain language, domain-accurate, no marketing jargon). All venue cards marked as 'illustrative schematic' with 'pending' label, not fake numbers. Pool shows 'pending' for buying-power figure until real data loads. | BLOCKER | [ ] |
| 3 | Check all claims in hero and product sections against docs/conventions/writing.md rules | No banned phrases: 'in today's fast-paced world', 'in the realm of', 'game changing', 'next generation', 'we are excited to announce', 'we are proud to share', 'built with love'. No filler words (very, actually, basically, just, really, simply). All claims are either: (a) sourced with links/numbers, (b) labeled 'TBD pending [specific event]', or (c) direct user-observable behavior (e.g., 'reads collateral across every venue'). | HIGH | [ ] |
| 4 | Verify CTA buttons use clear, direct language | Hero CTAs: 'Open testnet' (→) and 'See the product' (→). Both are direct imperatives, no marketing speak (not 'Explore', 'Unlock', 'Discover'). Button labels in trade/risk-preview match: 'I understand. Open position.' and 'Cancel - go back'. | HIGH | [ ] |

*States to verify:* Landing page fully loaded from SSR (before hydration) / Landing page after client hydration (TVL figures still pending/em-dash until real data arrives) / Hero section eyebrow and headline centered and readable / Venue cards in 2-row × 4-col grid (8 venues total) / Pool figure shows 'pending' until /api/protocol/metrics returns real TVL
*Hunt for these flaws:*
- Any venue TVL card showing invented numbers (e.g., $1.2M, $543K) instead of '-' or 'pending'
- Hero headline using italics on wrong word (should be only 'buying-power')
- Banned word/phrase appearing in eyebrow, headline, or product narrative (search code for: unlock, unleash, seamless, cutting-edge, state-of-the-art, revolutionize, empower, streamline, robust, delve, 'in today's fast-paced', 'we are excited to announce')
- Placeholder text like 'Lorem ipsum' or '[EXAMPLE]' left in user-facing copy
- Pool figure showing fake-live animation (Math.random jitter) instead of static 'pending' or real value
- Missing 'Atrium Labs · May 2026' attribution in engineering chrome
- Missing 'illustrative schematic' label on diagram (vs. fake 'Live' label)
- CTAs using marketing words: Explore, Unlock, Discover, Discover now, Launch, Get started, Join the revolution

#### 6.2 App: Risk Preview Modal & Education Copy
*Where:* `apps/verify/src/components/trade/risk-preview-modal.tsx`
*Purpose:* Verify risk disclosure is direct, honest, and educates without marketing speak. Tests seven risk bullets are plain-English and condition-specific. Tests that buffer preview shows simulated (not real) figures. Tests CTA honesty ('I understand' not 'I agree').

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Open app, try to open first position; modal appears before form submission | Header: 'Before your first trade' (italic, serif font). Subheading: 'Atrium can lose you money. Read this once. You can re-open it from Settings → Account at any time.' (direct, honest, not 'Risks to understand' or 'Important disclaimers'). Seven numbered risk bullets follow, each with bold title and plain explanation. | BLOCKER | [ ] |
| 2 | Read all seven risk bullets for directness and accuracy | 1. 'Leverage can wipe you out. Margin trading lets you control more than you put in. If the market moves against you, you can lose your full collateral.' (direct, not 'Leverage is powerful' or 'Leverage amplifies gains and losses'). 2. 'Hedging reduces required margin, but not risk. A long on one venue against a short on another is hedged only on paper. If one venue fails or oracles disagree, you can lose money even when you thought you were market-neutral.' (honest about limitations). 3-7. All bullets use plain language, specific examples, and no marketing jargon. No word from banned list (seamless, cutting-edge, robust, etc.). | BLOCKER | [ ] |
| 3 | Check buffer preview callout text and labels | Buffer preview shows: 'At your planned size: $[amount] · [leverage]× · [venue] · [side]'. Table shows: 'if market moves +5% ... buffer ≈ $X [status]'. Footer: 'Client-side preview using the same Plinth haircut formula. Numbers are simulated - actual fills depend on venue execution.' (honest about limits, not 'Live estimates' or 'Real-time calculations'). | HIGH | [ ] |
| 4 | Verify button labels are honest consent, not legal theatre | Left button: 'Cancel - go back' (clear escape path). Right button: 'I understand. Open position.' (not 'I agree', 'I accept', or 'Proceed' - consent is reading, not legal fiction). | HIGH | [ ] |

*States to verify:* Modal appears on first-ever trade attempt (localStorage check for atrium.risk-preview.ack.v1) / Modal can be re-opened from Settings (future feature, but text must promise it) / Buffer preview shows only when user enters positive size / Empty state shows: 'enter a positive size to see live buffer preview' / Modal closes on Cancel, proceeds to trade on I understand.
*Hunt for these flaws:*
- Any risk bullet using passive voice or marketing softening (e.g., 'leverage may amplify outcomes' vs. 'leverage can wipe you out')
- Buffer preview claiming 'live' or 'real-time' instead of 'simulated'
- Missing plain explanation of Plinth's 5% haircut example in computed buffer logic
- Button using legal theatre: 'I agree to the risks', 'I acknowledge', 'I accept'
- Missing '-' (em dash) for missing venue short labels in buffer preview
- Modal header using serif (correct) but CTA using serif (should be regular sans-serif for buttons)

#### 6.3 App: Order Form & Trade Labels
*Where:* `apps/verify/src/components/trade/order-form.tsx`
*Purpose:* Verify order form copy is direct and doesn't invent figures. Tests that margin figures show '-' when pending, sources are disclosed (Plinth.update_margin · simulated vs. plinth pending), and helper text explains deployment readiness without marketing speak.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to /app/portfolio or /app/trade; open order form sidebar | Header: 'Order · [venue short label]' with 'testnet' label on right. No invented margin figures. Size field is empty by default (not '1200' or other hardcoded number). Leverage slider shows 1× to 20× with no default assumption of 3× being 'recommended'. | HIGH | [ ] |
| 2 | Enter size and check margin impact preview | Maintenance margin and Initial margin rows show: real figures IF /api/trade/margin-impact succeeds (source label: 'from Plinth.update_margin · simulated'), OR em dashes '-' if pending or fetch fails. Helper text at bottom: 'from Plinth.update_margin · simulated' (honest source) OR 'plinth pending · figures populate after deploy' (honest pending state). No invented figures like $19,238 or $19,338. | BLOCKER | [ ] |
| 3 | Check readiness helper text when form is disabled | When deployment step 2 not ready: 'Adapters initializing · live in 4 minutes' or other specific condition from readinessMessage(). When size empty: no helper (enabled only when size > 0). When ready: no helper, just CTA 'Open [long\|short] · market'. | HIGH | [ ] |
| 4 | Verify all labels and help tips use plain language | Labels: 'Size · USDC', 'Leverage' (with HelpTip for definition), 'Maintenance margin', 'Initial margin', 'Slippage tolerance' (with HelpTip). HelpTips: 'leverage' = 'Multiplier on your collateral - higher leverage means larger positions but faster liquidation.' (direct, domain-accurate). No banned words (seamless, cutting-edge, robust, empower, unlock). | MED | [ ] |

*States to verify:* Size field starts empty (no default number) / Leverage slider starts at 3× (reasonable default for testing) / Margin preview shows '-' before fetch completes / Margin preview shows real figures when Plinth responds / Margin preview shows pending when /api/trade/margin-impact fails / CTA disabled when size is empty or deployment not ready / Helper text changes based on deployment readiness state
*Hunt for these flaws:*
- Default size field showing invented number (e.g., '1200') instead of empty
- Margin figures showing hardcoded $19,238 / $19,338 instead of real/pending '-'
- Helper text using marketing language: 'Adapters coming soon', 'Almost ready', 'Loading awesomeness'
- Missing 'simulated' label on margin preview (users must know figures are client-side estimates)
- Button label changing to non-imperative: 'Submit', 'Place order', 'Execute' (should be 'Open [long|short] · market')
- HelpTip definitions using jargon without plain explanation

#### 6.4 App: Tooltips & Microcopy (HelpTip)
*Where:* `apps/verify/src/components/ui/help-tip.tsx`
*Purpose:* Verify all inline tooltips use plain-English domain definitions without marketing speak. Tests that all nine defined terms (leverage, buying power, margin, liquidation, notional, maintenance margin, initial margin, hedging, basis trade, slippage) are precise and accessible to first-time traders.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Hover/click all HelpTip instances in order form and portfolio pages | leverage: 'Multiplier on your collateral - higher leverage means larger positions but faster liquidation.' buying_power: 'Maximum notional value you can open given your current collateral and margin usage.' margin: 'Required deposit to control a position. Higher leverage = lower margin requirement.' liquidation: 'Automatic position close if your buffer falls below maintenance margin.' notional: 'Total market value of your position (size × spot price). E.g., $1K size at 3× = $3K notional.' maintenance_margin: 'Minimum buffer to keep a position open. Falls below this = liquidation.' initial_margin: 'Collateral required to open a position. Typically higher than maintenance margin.' hedging: 'Offsetting positions on different venues (long here, short there). Reduces margin but not risk.' basis_trade: 'Exploiting price differences between venues by going long on one and short on another.' slippage: 'Difference between expected fill price and actual fill price. Higher on thin markets.' | MED | [ ] |
| 2 | Check that all tooltips use consistent structure: noun phrase, em dash, plain explanation | Every definition follows pattern: '[Term]: [Direct definition - explanation/example]'. No definitions use jargon without explanation. No circular definitions (e.g., 'leverage lets you leverage more'). All examples use concrete numbers or markets. | MED | [ ] |

*States to verify:* HelpTip component renders with question mark icon / Tooltip appears on hover (desktop) or tap (mobile) / Tooltip includes term definition and practical example / Tooltip closes on blur or escape key
*Hunt for these flaws:*
- Any tooltip using jargon without explanation (e.g., 'Initial margin is the haircut applied to your notional')
- Circular definitions (term used in its own definition)
- Missing plain example or comparison
- Tooltip text exceeding 2-3 sentences (too wordy)
- Definition contradicting Plinth's actual haircut logic or margin formula

#### 6.5 App: Lantern (Reserves) & Status Copy
*Where:* `apps/verify/src/components/lantern-dashboard.tsx`
*Purpose:* Verify Lantern attestation UI distinguishes clearly between loading, error, empty, and verified states without marketing language. Tests that error messages explain remediation (check Praetor status) and empty state is clear ('not yet published').

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Load /lantern (Reserves page); wait for initial /api/lantern/latest fetch | Loading state: skeleton placeholder (honest 'not yet loaded'). Error state: 'Lantern source unavailable' (red bg). Text: 'The /api/lantern/latest endpoint failed. If the Lantern attestor service is down, check Praetor status. Subgraph fallback also unavailable.' (specific remedy, not generic 'Please try again'). 'Retry' button available. | HIGH | [ ] |
| 2 | Simulate empty state (API returns null/no attestation yet) | Empty state shows: 'Attestation not yet published' (not 'No data available' or 'Coming soon'). Explanation: 'Lantern publishes hourly. Check back in a few minutes.' Refresh button included. | MED | [ ] |
| 3 | Check IPFS fetch error copy | If proof verification fails: 'IPFS fetch failed. Retry in a moment.' (not 'Server error' or 'Connection timeout'). Explains what failed (IPFS, not Lantern API) without scary language. | MED | [ ] |
| 4 | Verify success state copy | When attestation loads and user's address is found in tree: 'Your address is included in the current reserve tree.' Link to IPFS JSON. No marketing (not 'You are verified', 'Your funds are safe'). | MED | [ ] |

*States to verify:* Loading state displays skeleton (no fake data) / Error state shows with /api/lantern/latest 500/network error / Empty state shows when attestation not yet published / Verified state shows when user's address found / Absence state shows when user's address not in tree ('Your address is not in the current tree. Cohort grows as partners sign LOIs.') / IPFS CID validation happens before any fetch (security audit UUU-2 fix)
*Hunt for these flaws:*
- Error message using vague language: 'Something went wrong', 'Error occurred'
- Missing specific remediation: 'The endpoint failed' without 'check Praetor status'
- Empty state claiming 'Coming soon' or showing fake data
- Success copy using marketing: 'You are verified!', 'Your reserves are confirmed!'
- Absence state claiming user 'not whitelisted' instead of 'not in current tree'
- Fetching IPFS before validating CID (security audit regression)

#### 6.6 App: Notifications & Empty States
*Where:* `apps/verify/src/components/notifications/list.tsx`
*Purpose:* Verify empty state copy is clear and honest. Tests that 'Inbox is empty' is used (not 'No messages', 'Nothing here', 'You're all caught up').

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Navigate to notifications page with no notifications | Empty state card shows: 'Inbox is empty.' (plain, direct, no marketing). No exclamation point (exclamation creates false cheerfulness). No additional copy ('You'll see updates here' is redundant). | LOW | [ ] |

*States to verify:* Empty state renders when /api/notifications returns 0 items / List renders notifications when items are present / No fallback fake data or placeholder messages
*Hunt for these flaws:*
- Empty state using: 'No messages', 'Nothing to see here', 'You're all caught up!', 'Check back later'
- Exclamation point added to 'Inbox is empty.'
- Redundant copy after empty message

#### 6.7 Page Metadata & SEO Copy
*Where:* `apps/verify/src/app/page.tsx, apps/verify/src/app/*/page.tsx (all page.tsx metadata)`
*Purpose:* Verify page titles, descriptions, and OG metadata are accurate and don't make invented claims. Tests that metadata is sourced from real data (not 'the #1 platform' or 'trusted by 10K users').

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Inspect page <head> metadata for all routes (/app, /app/portfolio, /verify, /lantern, etc.) | Landing page (/): title = 'Atrium - Unified margin prime brokerage for the EVM', description = 'Unified margin prime brokerage for the EVM. Deposit USDC once. Trade across perps, lending, yield, and prediction markets with one buying-power number. Testnet-first.' (fact-based, testnet disclaimer). No invented claims like 'Trusted by 10K+ traders', 'The fastest protocol', '#1 platform'. | HIGH | [ ] |
| 2 | Check all route metadata for consistent voice and honesty | All pages: title format '[Page name] - Atrium', description matches actual feature (not aspirational copy). Metadata must not claim: live status (page is testnet), user numbers (none published), partnership claims (none verified), awards (none). OG images point to real assets (not placeholder). | HIGH | [ ] |

*States to verify:* Next.js metadata properly configured (generateMetadata() or export const metadata) / All routes have unique, accurate titles and descriptions / No dynamic metadata without data sources (e.g., 'Trusted by [count] traders' must come from real DB) / OG image URLs resolve (no 404s)
*Hunt for these flaws:*
- Title using invented superlatives: 'The fastest', 'Most secure', 'Leader in DeFi'
- Description claiming user numbers without source: 'Used by 50K traders'
- Description claiming partnerships without verification: 'Built with Arbitrum', 'Trusted by Aave'
- Description claiming testnet as live: omitting 'Testnet-first' or 'for testing only'
- OG image URL pointing to placeholder or 404

#### 6.8 Footer & Contact Copy
*Where:* `apps/verify/src/components/atrium/Footer.tsx`
*Purpose:* Verify footer claims are accurate and disclosures are complete. Tests that version, build date, and contact email are real. Tests that legal/security pages are linked and accessible.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Check footer tagline and metadata | Tagline: 'Unified margin prime brokerage for the EVM. Testnet-first. Built on Arbitrum Sepolia with Chainlink CCIP, ERC-8004, and ERC-4337 / 7702.' (all technologies accurately listed). Version: 'v0.15 · 2026.05 · testnet only' (real version, real date, testnet disclaimer). Contact: 'support@atrium.fi' and 'see /security for security@ contact' (real email, clear security contact path). | HIGH | [ ] |
| 2 | Verify all footer links are present and functional | Product section: App, Verifier walk, Reserves, Docs (all navigate correctly). Company section: Manifesto, Team, Cohort, Security, Bug bounty (all page routes exist). Legal section: Privacy, Terms, KYC disclosure, Sub-processors, Accessibility (all route to real legal pages). | HIGH | [ ] |
| 3 | Check copyright and disclaimer copy | Left footer: '© 2026 Atrium Labs Ltd · CC-BY-4.0 brand assets' (real year, real company, clear license). Right footer: 'Testnet only · not investment advice' (both disclosures present). | HIGH | [ ] |

*States to verify:* Footer appears on all pages / All links navigate to correct routes / Version and date match deployment artifacts / Testnet disclaimer appears twice (top + bottom) / Contact email is monitored (test by sending)
*Hunt for these flaws:*
- Footer claiming live status: omitting 'testnet only'
- Missing 'not investment advice' disclaimer
- Outdated version number or date
- Contact email not monitored or bouncing
- Links to legal pages returning 404
- Copyright year not matching current year
- Missing CC-BY-4.0 license notice

#### 6.9 Banned Words & Phrases Automated Test
*Where:* `apps/verify/src/lib/writing-banned-words.test.ts`
*Purpose:* Verify that the automated test suite catches all banned words and phrases per docs/conventions/writing.md. Tests that the allowlist (leverage, harness) correctly excludes legitimate domain vocabulary. Validates test runs in CI without false positives.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Run npm test -- writing-banned-words.test.ts locally | Test passes if no banned words found in /src/**/*.tsx (excluding .test.tsx). Test fails with specific file + line if any banned word detected. Banned words list (lines 24-35): delve, unlock, unleash, robust, empower, seamless, streamline, cutting-edge, state-of-the-art, revolutionize. Banned phrases (lines 40-51): 'in today's fast-paced', 'in the realm of', 'game changing', 'game-changing', 'next generation', 'we are excited to announce', 'we are proud to share', 'we are excited to share', 'we are proud to announce', 'built with love'. Allowlist (lines 56-57): 'leverage', 'harness' (legitimate domain vocabulary, not marketing speak). | BLOCKER | [ ] |
| 2 | Verify test normalizes to lowercase (case-insensitive matching) | Test detects 'Unlock', 'UNLOCK', 'UnLock' as violations (all case variants caught). Test detects 'SEAMLESS EXPERIENCE' with case-insensitive matching. | HIGH | [ ] |
| 3 | Verify test only scans .tsx files (not .test.tsx, not .css, not .json) | Test file itself contains banned words in test data (lines 24-51) but test passes (only scans /src/**/*.tsx, not itself). If a banned word appears in src/components/foo.tsx, test fails. If same word appears in src/lib/foo.test.tsx, test passes (correctly ignores test files). | MED | [ ] |
| 4 | Verify allowlist correctly permits legitimate usage | Test passes when 'leverage' appears in HelpTip definitions, order form labels, or risk modal (domain vocabulary, not marketing). Test passes when 'harness' appears in comments or code (legitimate technical term). Test fails if 'harness the power of' appears in user-facing copy (that's marketing speech). | HIGH | [ ] |

*States to verify:* Test runs in CI without manual intervention / Test output lists file paths and line numbers for violations / Test correctly identifies case-insensitive matches / Test excludes .test.tsx files from scanning / Test respects allowlist (leverage, harness) as legitimate vocabulary
*Hunt for these flaws:*
- Banned word introduced in new .tsx file but test doesn't catch it
- Test false-positive on allowlist term used as marketing (e.g., 'harness the power of')
- Test incorrectly flagging 'leverage' in domain context (e.g., 'leverage slider')
- Test scanning .test.tsx files (creates noise, slows CI)
- Test case-sensitive matching (missing 'Unlock', 'SEAMLESS')
- Test not run in CI pipeline
- Allowlist outdated or missing legitimate terms

#### 6.10 Conditional Statements & Honesty of Scope
*Where:* `apps/verify/src/components/landing/hero-section.tsx, apps/verify/src/app/page.tsx (all claims sections)`
*Purpose:* Verify that all conditional statements (pending features, scope cuts, timelines) are explicitly disclosed. Tests that 'pending' state is announced same-day, not hidden. Tests that partnerships/integrations marked 'Live' or 'Pending' are honest.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Search all landing page copy for timeline claims | Venues section copy: 'Eight venues. One margin engine. Live testnet adapters today. RH-Chain ships within 14 days of the Robinhood SDK going public.' (Conditional explicitly stated: 'within 14 days of the Robinhood SDK going public'). Not 'Ships in 14 days' or 'RH-Chain coming soon'. | BLOCKER | [ ] |
| 2 | Check all venue cards for 'Live' vs 'Pending' labels | Landing page venue cards: all show 'Live' if adapter deployed on testnet, 'Pending' if not yet. RH-Chain marked 'Pending' (not 'Live'). No venue marked 'Live' unless its adapter is actually callable via /api/adapters. | BLOCKER | [ ] |
| 3 | Verify TBD claims are marked and dated | Any metric not yet known: marked 'TBD pending [specific event]', e.g., 'Partners: TBD pending community governance vote' (not just 'Partners: TBD'). Timestamp included if relevant (e.g., 'TBD pending Q2 2026 launch'). | HIGH | [ ] |
| 4 | Check that scope cuts are announced immediately and reallocated | If a planned feature is cut (e.g., Discord launching with testnet → Discord launching 1 week after testnet), the change is announced in: (a) writing.md CHANGELOG entry, (b) footer link to /security page explaining delay, (c) smart messaging in UI ('Discord launching with testnet - see /security for status'). Not hidden in fine print or omitted. | HIGH | [ ] |

*States to verify:* All conditionals include explicit trigger (e.g., 'within 14 days of X') / All pending features marked 'Pending' in UI (not 'Coming soon', 'Not available') / All TBD metrics marked with reason and date / Scope cuts announced with specific new timeline / No claims made without source or TBD disclaimer
*Hunt for these flaws:*
- Timeline claim without conditional: 'Ships in 14 days' (should be 'within 14 days of Robinhood SDK launch')
- Pending feature marked 'Live' in UI (e.g., RH-Chain marked 'Live' before adapter deployed)
- TBD metric without reason: 'Partners: TBD' (should be 'Partners: TBD pending governance vote')
- Scope cut not announced (e.g., Discord launch date changed but UI still says 'with testnet')
- Feature cut silently from footer or removed from link without explanation in /security page


---

## 7. Design, brand fidelity + accessibility

> Authored directly (the design enumerator did not return structured output). Compare every surface against the prototype contract in CLAUDE.md, `.claude/rules/ui.md`, and the tokens in `desing/`. The intended difference from the prototype is *real data*, never a visual reinterpretation.

#### 7.1 Typography
| # | Do this | Expect | Sev | Pass |
|---|---------|--------|-----|------|
| 1 | Inspect display headings + the Atrium wordmark | `Instrument Serif`, italic where the prototype is italic; warm ink color, not pure black | HIGH | [ ] |
| 2 | Inspect body + numbers | Body `Geist`; tabular/mono figures use `Geist Mono`; numbers align in tables | MED | [ ] |
| 3 | Check the wordmark underline motif | Present where the brand kit specifies; not a generic logo | LOW | [ ] |

#### 7.2 Color, radii, shadows, motion
| # | Do this | Expect | Sev | Pass |
|---|---------|--------|-----|------|
| 1 | Eyeball the canvas + ink | Warm parchment (`#FBFAF7` family), ink near `#1A1714` - no stark white app feel | HIGH | [ ] |
| 2 | Check status colors | Green `oklch(0.58 0.13 145)`, amber, terracotta `rgb(126,42,32)`; used consistently for live/warn/neg | MED | [ ] |
| 3 | Check corner radii + card shadows | Radii from the 6/10/12/14/16/pill set; shadows subtle + layered, never glossy | MED | [ ] |
| 4 | Hover cards + trigger transitions | Fast 120-200ms color/transform; card lift on the prototype's cubic-bezier; restrained, no neon | MED | [ ] |
| 5 | Watch the favicon tab | Black tile, italic A, breathing status bar (amber/green/red testnet health) | LOW | [ ] |
| 6 | Compare landing section order | hero -> product -> Plinth -> Aqueduct -> Sigil dark -> Lantern -> live stats -> subsystems -> architecture -> cohort -> closing | MED | [ ] |
| 7 | Scan for generic shadcn defaults | No unstyled default buttons/cards/inputs that break the prime-brokerage feel | HIGH | [ ] |

#### 7.3 Responsive (run on 375 / 768 / 1280)
| # | Do this | Expect | Sev | Pass |
|---|---------|--------|-----|------|
| 1 | Load every /app/* page at 375px | Mobile shell renders real data (not a decorative mock); stats stack; tables become cards | BLOCKER | [ ] |
| 2 | Open every modal at 375px | Fits viewport, scrolls if needed, close control reachable, no clipped buttons | HIGH | [ ] |
| 3 | Landing at 768px | Sections reflow, no overlap (watch the Kani/Plinth diagram + nav) | HIGH | [ ] |
| 4 | Rotate / very wide (1440px+) | Content max-width holds; no stretched line lengths or stranded controls | LOW | [ ] |

#### 7.4 Accessibility
| # | Do this | Expect | Sev | Pass |
|---|---------|--------|-----|------|
| 1 | Run axe-core / Lighthouse a11y on the main pages | No critical violations; score >= 90 | HIGH | [ ] |
| 2 | Keyboard-only through a full journey (deposit) | Every step doable without a mouse; focus never trapped or lost | HIGH | [ ] |
| 3 | Check color contrast on text + status chips | Meets WCAG AA (4.5:1 body, 3:1 large) | HIGH | [ ] |
| 4 | Check icons/images | Meaningful `alt`/aria labels; decorative ones hidden from SR | MED | [ ] |
| 5 | Enable OS "reduce motion" | Animations tone down; no essential info conveyed by motion alone | MED | [ ] |
| 6 | Screen-reader a live-updating tile | Updates are announced (aria-live) or at least not disruptive | MED | [ ] |

*Hunt for:* off-brand neon/crypto-dashboard styling, pure-white panels, generic component defaults, layout overlap on mobile, invisible focus rings, low-contrast amber-on-parchment, charts that overflow on small screens.

---

## 8. Security, performance + robustness

> Comprehensive QA test plan for Atrium Verifier Mode covering authentication security (SIWE/nonce binding, phishing defense), session integrity (HMAC-SHA256 tamper detection), IDOR protection (wallet validation), CSRF hardening (origin allowlist), rate limiting enforcement, input validation, error handling honesty, and frontend performance metrics. Grounded in real code files with concrete test cases, severity levels, and known flaws to hunt for.

#### 8.1 Auth Flow: SIWE Message Verification and Domain/URI Binding
*Where:* `apps/verify/src/app/api/auth/nonce/route.ts`
*Purpose:* Verify that SIWE signatures are bound to the correct domain and URI, preventing phishing replay attacks where a signature created for a malicious clone domain could be replayed against Atrium.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Call GET /api/auth/nonce from verify.atrium.fi, observe nonce cookie (httpOnly, sameSite=strict, 15-min TTL) | Receive nonce in atrium-nonce cookie with httpOnly and secure flags; inspect browser DevTools → Application → Cookies to verify httpOnly prevents JavaScript access | HIGH | [ ] |
| 2 | Sign SIWE message with wagmi for domain='verify.atrium.fi' and uri='https://verify.atrium.fi/...', POST to /api/auth/verify with valid signature | 201 response, session cookie set (atrium-session, httpOnly, secure, sameSite=strict, 24h TTL), walletAddress echoed | BLOCKER | [ ] |
| 3 | Craft SIWE message with domain='evil.com' but sign it for verify.atrium.fi domain; POST to /api/auth/verify with signature | 401 error with 'domain_mismatch' or 'uri_mismatch'; no session cookie set. Code: siweMessage.domain.toLowerCase() !== expectedHost check at line 51 | BLOCKER | [ ] |
| 4 | Sign SIWE message for domain='verify.atrium.fi' and uri='https://evil.com/app' (URI mismatch); POST to /api/auth/verify | 401 error with 'uri_mismatch'; no session cookie set. Code: uri validation at line 54 enforces expectedUriPrefix | BLOCKER | [ ] |
| 5 | Capture a valid SIWE signature for verify.atrium.fi, then change the message object (e.g., add space to nonce) and resubmit with the original signature | 401 'verification_failed' because siweMessage.verify() in line 60 will reject the tampered message against the nonce | BLOCKER | [ ] |
| 6 | Call GET /api/auth/nonce twice from the same IP, skip the first nonce, attempt to verify with the second nonce | 401 'nonce_expired' for the first nonce (consumed), 200 for the second; verify nonce is single-use by examining route.ts line 31-33 cookie.get + delete | HIGH | [ ] |
| 7 | Request /api/auth/nonce, wait 16 minutes (past 15-min TTL), then POST /api/auth/verify with the expired nonce | 401 'nonce_expired' because the cookie maxAge:900 (15 min) has expired and is no longer readable | HIGH | [ ] |

*States to verify:* Session cookie present with httpOnly + secure + sameSite=strict flags / Nonce cookie invalidated after first use / Domain binding enforced at message parse (line 51) AND siweMessage.verify() (line 60, defence-in-depth) / URI prefix matching prevents phishing via subdomain/path tricks / No session created on domain or URI mismatch
*Hunt for these flaws:*
- Domain/URI checks bypassed if Cloudflare/proxy strips headers
- Nonce reuse across multiple verify() calls if cookie delete fails silently
- Race condition: nonce requested, immediately used twice concurrently before delete lands
- Signature recovery succeeds but domain validation skipped (missing line 51 or 54 check)

#### 8.2 Session Integrity: HMAC-SHA256 Tamper Detection and Timing-Safe Comparison
*Where:* `apps/verify/src/lib/auth-session.ts`
*Purpose:* Verify that session tokens are cryptographically signed and any tampering (modified wallet address, expiration time) is detected and rejected via timing-safe comparison.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Establish valid session via /api/auth/verify, extract atrium-session cookie value (base64-encoded {data, sig}) | Cookie contains Base64-encoded JSON with 'data' (payload) and 'sig' (HMAC-SHA256 hex); structure matches signSession() at line 16-20 of auth-session.ts | HIGH | [ ] |
| 2 | Decode session cookie, extract JSON {data, sig}, modify data.walletAddress to a different address, re-encode, set cookie, access protected route (/api/portfolio/summary) | 403 Forbidden; requireWalletMatch() fails because timingSafeEqual(sigBuf, expBuf) at line ~108 in auth-session.ts rejects the tampered signature | BLOCKER | [ ] |
| 3 | Decode session, modify data.expiresAt to a future Unix timestamp (e.g., +1 year), re-encode, POST to protected route | 403 Forbidden; the modified expiresAt changes the signed data, so the HMAC no longer matches. Timing-safe comparison catches it. | BLOCKER | [ ] |
| 4 | Establish session with wallet A, then extract the session token and manually set it in a new browser context as wallet B's session cookie; call GET /api/portfolio/summary from wallet B browser | 401 Unauthorized because requireWalletMatch() compares req (from wallet B browser) against session.walletAddress (wallet A) and returns 401 at line ~117 | BLOCKER | [ ] |
| 5 | Establish session, call GET /api/portfolio/summary without the atrium-session cookie | 401 Unauthorized; getSession() returns null if no cookie, requireWalletMatch() returns 401 at line ~113 | BLOCKER | [ ] |
| 6 | Use a packet sniffer (e.g., Wireshark) to capture the session cookie over HTTPS, attempt to replay it from a different IP address | Session is valid (cookies are stateless); the different IP should not cause rejection. This tests that Atrium does NOT bind sessions to IP (simplifies dev/mobile UX, acceptable for testnet) | MED | [ ] |

*States to verify:* Session token is Base64-encoded {data, sig} structure / HMAC-SHA256 signature validated with timing-safe comparison on every protected route / Wallet mismatch detected and rejected with 403 / Expired session detected and rejected / Missing session cookie returns 401
*Hunt for these flaws:*
- Timing-safe comparison replaced with === operator (vulnerable to timing attacks on signature recovery)
- Session secret is empty string or hardcoded (check ATRIUM_SESSION_SECRET env at line 11)
- HMAC digest uses wrong hash algorithm (e.g., SHA1 instead of SHA256)
- Wallet validation skipped on certain routes (check all calls to requireWalletMatch)
- Session TTL not enforced (expiresAt check missing)

#### 8.3 IDOR Protection: Wallet Address Validation on Multi-Tenant Routes
*Where:* `apps/verify/src/app/api/agents/my-mandates/route.ts`
*Purpose:* Verify that users cannot access portfolio data, activity, or mandates for wallets other than their own by tampering with ?wallet= query parameter.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Sign in as wallet A (0x1111...), then call GET /api/portfolio/summary?wallet=0x2222... (wallet B's address) | 403 Forbidden; requireWalletMatch() at line 20 of route.ts compares session.walletAddress (0x1111) vs. requested wallet (0x2222) and returns 403 | BLOCKER | [ ] |
| 2 | Sign in as wallet A, call GET /api/portfolio/activity?wallet=0x2222... (another wallet's address) | 403 Forbidden; same IDOR protection at line 20 of activity/route.ts | BLOCKER | [ ] |
| 3 | Sign in as wallet A, call GET /api/agents/my-mandates?wallet=0x2222... (request mandates for a different wallet) | 403 Forbidden; requireWalletMatch() at line 54 of my-mandates/route.ts enforces wallet matching | BLOCKER | [ ] |
| 4 | Sign in as wallet A, call GET /api/portfolio/summary without ?wallet= param (should use session wallet or DEMO_WALLET_ADDRESS) | 200 with portfolio data for wallet A (the session wallet); no IDOR because the route uses the authenticated session, not an untrusted param | HIGH | [ ] |
| 5 | Call GET /api/portfolio/summary?wallet=0x1111... without a session (no atrium-session cookie) | 401 Unauthorized; requireWalletMatch() returns 401 if no session at line ~113 of auth-session.ts, before wallet comparison | BLOCKER | [ ] |
| 6 | Sign in as wallet A (0x1111...), then craft a GET request to /api/portfolio/summary?wallet=0x1111... (correct wallet but uppercase mixed case) | 200 with data; the route lowercases the wallet param for comparison (see line 15 regex /^0x[0-9a-fA-F]{40}$/ and line 48 wallet.toLowerCase()) | MED | [ ] |
| 7 | Sign in as wallet A, attempt to call GET /api/portfolio/summary?wallet=0xZZZZ... (invalid hex characters) | 403 Forbidden; the regex /^0x[0-9a-fA-F]{40}$/ at line 15 rejects invalid addresses. If the param doesn't match, the route falls back to DEMO_WALLET_ADDRESS or null, and requireWalletMatch() compares that against the session wallet. | MED | [ ] |

*States to verify:* Wallet parameter validation via regex /^0x[0-9a-fA-F]{40}$/ (40 hex chars, 42 with 0x prefix) / requireWalletMatch() enforces session wallet == requested wallet / 401 returned if no session (blocks unauthenticated requests) / 403 returned if wallet mismatch (blocks cross-wallet access) / Case-insensitive wallet comparison (toLowerCase applied)
*Hunt for these flaws:*
- Wallet validation regex missing or using wrong pattern (e.g., allowing 0X uppercase)
- requireWalletMatch skipped on a route (check all /api/portfolio/*, /api/agents/*, /api/settings/* routes)
- Wallet comparison is case-sensitive (0x1111 != 0x1111 due to uppercase)
- Fallback to DEMO_WALLET_ADDRESS bypasses session check on missing param
- No validation of wallet param format (allows arbitrary strings)

#### 8.4 CSRF Protection: Origin Allowlist and Dynamic Route Gating
*Where:* `apps/verify/src/app/api/chaos/inject/route.ts`
*Purpose:* Verify that mutation routes (POST to /api/agents/issue-mandate, /api/chaos/inject) are gated by Origin header validation to prevent CSRF attacks from attacker-controlled websites.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | POST to /api/agents/issue-mandate with Origin header set to 'https://verify.atrium.fi' (allowed) | 403 if no session (auth check happens first), or proceeds to mandate validation. Code: isOriginAllowed() at line 15 of issue-mandate/route.ts returns true for this origin | HIGH | [ ] |
| 2 | POST to /api/agents/issue-mandate with Origin header set to 'https://evil.com' | 403 Forbidden with 'origin_not_allowed' error. Code: isOriginAllowed() checks ALLOWED_ORIGINS at line 10-14 and regex (line 19-22) | BLOCKER | [ ] |
| 3 | POST to /api/agents/issue-mandate with Origin header set to 'https://atrium-verify-abc123-myname.vercel.app' (matches preview regex in allowed-origins.ts) | 403 auth/origin check first; if regex is configured, the request proceeds. Inspect ATRIUM_ALLOWED_PREVIEW_REGEX env to see what preview domains are allowed. | HIGH | [ ] |
| 4 | POST to /api/agents/issue-mandate from a localhost:3000 browser during local dev, with Origin: 'http://localhost:3000' | Allowed (localhost:3000 in ALLOWED_ORIGINS at line 13 of issue-mandate/route.ts); proceed to auth + mandate validation | MED | [ ] |
| 5 | POST to /api/agents/issue-mandate with NO Origin header (e.g., from curl, server-to-server call) | 403 Forbidden; isOriginAllowed() at line 16-17 returns false for null origin. Mutation routes REQUIRE Origin header. | HIGH | [ ] |
| 6 | POST to /api/chaos/inject with Origin: 'https://evil.com' | 403 'origin_not_allowed'; chaos route uses isAllowedOrigin() from allowed-origins.ts (same check as issue-mandate) | BLOCKER | [ ] |
| 7 | POST to /api/chaos/inject from verify.atrium.fi with a valid origin but no CHAOS_PRIVATE_KEY env set | 503 'chaos_key_not_configured'; origin allowlist is checked BEFORE the key check, so origin is enforced even if the key is missing | HIGH | [ ] |

*States to verify:* ALLOWED_ORIGINS list is exact (no wildcards, e.g. *.vercel.app should NOT match) / Origin header is required on POST/mutation routes (null origin returns 403) / Preview regex (ATRIUM_ALLOWED_PREVIEW_REGEX) is strict and anchored (avoid loose patterns like .*) / Origin check runs before authentication and mandate validation (fail fast) / Case-insensitive origin comparison applied
*Hunt for these flaws:*
- Wildcard origin in ALLOWED_ORIGINS (e.g., '*.vercel.app') - allows any subdomain
- Origin check skipped for certain routes or request methods
- Origin header not required (null origin accepted)
- Case-sensitive origin comparison (https://Verify.atrium.fi != https://verify.atrium.fi)
- Origin regex missing anchors (^...$), allowing partial matches

#### 8.5 Rate Limiting: IP and Wallet-Based Sliding Window Enforcement
*Where:* `apps/verify/src/lib/rate-limit.ts`
*Purpose:* Verify that rate limiting via Upstash Redis is enforced on API routes and chaos drill endpoints with per-IP (60/min) and per-wallet (120/min) limits.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Make 60 rapid GET requests to /api/portfolio/summary from the same IP within 1 minute | All 60 succeed; the 61st returns 429 Too Many Requests with Retry-After header. Code: ratelimitPerIp.limit(ip) at line 22 of middleware.ts | HIGH | [ ] |
| 2 | Make 61 rapid requests to /api/portfolio/summary from the same IP within 1 minute, verify Retry-After header | 61st request returns 429 with Retry-After set to remaining seconds until the window resets. Code: Math.ceil((reset - Date.now()) / 1000) at line 24 | HIGH | [ ] |
| 3 | Make 30 requests from IP A and 30 requests from IP B (different IPs) within 1 minute | All 60 succeed; the rate limit is per-IP, not global. Code: rate-limit.ts creates separate limits for each IP | MED | [ ] |
| 4 | Make a POST to /api/agents/issue-mandate from the same IP 60 times in 1 minute (assuming valid auth for each) | All succeed (rate limited via Upstash, not per-endpoint); chaos injection also rate-limited by in-memory map at line 63 of chaos/inject/route.ts (30s min interval per IP) | HIGH | [ ] |
| 5 | Call GET /api/chaos/inject twice from the same IP within 30 seconds | First succeeds, second returns 429 'rate_limited' with Retry-After header. Code: chaosLastCall map at line 63, CHAOS_MIN_INTERVAL_MS = 30_000 at line 64 | HIGH | [ ] |
| 6 | Disable rate limiting by not setting Upstash env vars (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN), then make 100 requests from the same IP in 1 minute | All 100 succeed; rate-limit.ts gracefully falls back to null when env is missing (line ~15). Middleware checks 'if (ratelimitPerIp)' at line 17 and skips limiting if null. This is acceptable for local dev. | MED | [ ] |
| 7 | Set UPSTASH_REDIS_REST_URL to a non-existent server, make a request to /api/portfolio/summary | Request may timeout or return 503 error (Upstash SDK handles connection failure). Middleware should fail open or fail closed depending on implementation. Verify behavior. | MED | [ ] |

*States to verify:* Rate limit enforced on /api/* routes via Upstash per-IP sliding window (60 req/min) / Chaos endpoint has stricter per-IP limit (30s min interval) in addition to API limit / Rate limit falls back gracefully when Upstash env is missing (local dev scenario) / 429 response includes Retry-After header with correct reset time / Rate limits are per-IP, not global (different IPs have independent counters)
*Hunt for these flaws:*
- Upstash rate limit removed or commented out on mutation routes
- Retry-After header missing or set to wrong value
- Rate limit allows exceeding the cap on the first request of a new window (off-by-one)
- Per-IP extraction uses wrong header (x-forwarded-for parsed incorrectly)
- Chaos endpoint rate limit not enforced (in-memory map is per-instance only, resets on Vercel cold start)

#### 8.6 Input Validation: Ethereum Address Regex and Bounds Checking
*Where:* `apps/verify/src/app/api/portfolio/summary/route.ts`
*Purpose:* Verify that input parameters (Ethereum addresses, cap amounts, venue lists) are validated server-side and invalid/malicious input is rejected before downstream processing.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | POST /api/agents/issue-mandate with agent='0xZZZZ...' (invalid hex) | 400 Bad Request with 'agent must be 0x-prefixed 40-hex' error. Code: !/^0x[0-9a-fA-F]{40}$/.test(body.agent) at line 94 | HIGH | [ ] |
| 2 | POST /api/agents/issue-mandate with agent='0x' + 39 hex chars (too short) | 400 'agent must be 0x-prefixed 40-hex' | HIGH | [ ] |
| 3 | POST /api/agents/issue-mandate with agent='0x' + 41 hex chars (too long) | 400 'agent must be 0x-prefixed 40-hex' | HIGH | [ ] |
| 4 | POST /api/agents/issue-mandate with agent='0x0000000000000000000000000000000000000000' (zero address) | 400 'agent cannot be the zero address - this would brick mandate revocation'. Code: line 97-98 | HIGH | [ ] |
| 5 | POST /api/agents/issue-mandate with perActionCapUsdc=0 or negative | 400 'per-action cap must be > 0'. Code: line 100-101 | HIGH | [ ] |
| 6 | POST /api/agents/issue-mandate with totalOpenCapUsdc < perActionCapUsdc | 400 'total open cap must be ≥ per-action cap'. Code: line 106-107 | HIGH | [ ] |
| 7 | POST /api/agents/issue-mandate with actionsPerDay=1001 (exceeds 1000 limit) | 400 'actions-per-day must be 1..1000'. Code: line 109 | MED | [ ] |
| 8 | POST /api/agents/issue-mandate with expiresDays=366 (exceeds 365 limit) | 400 'expires-days must be 1..365'. Code: line 112 | MED | [ ] |
| 9 | POST /api/agents/issue-mandate with venueAllowlist=[] (empty list) | 400 'at least one venue must be allowed'. Code: line 115 | HIGH | [ ] |
| 10 | POST /api/agents/issue-mandate with venueAllowlist containing 9 venue IDs (exceeds SIGIL_MAX_VENUES=8) | 400 'venue allowlist cannot exceed 8 (Sigil decoder limit)'. Code: line 118-121 | HIGH | [ ] |
| 11 | POST /api/agents/issue-mandate with venueAllowlist=['unknown-venue-id'] (invalid venue) | 400 'unknown venue id: unknown-venue-id'. Code: line 124-127 | HIGH | [ ] |
| 12 | GET /api/portfolio/summary?wallet=0x not-hex-at-all | Wallet param fails regex validation; route falls back to DEMO_WALLET_ADDRESS or null. If null, returns pending state. If DEMO_WALLET, returns that wallet's data (expected behavior). | MED | [ ] |
| 13 | POST /api/agents/issue-mandate with signature='0x' + 129 hex chars (too short, must be 130 = 65 bytes) | 400 'signature must be 0x + 65-byte hex (130 chars)'. Code: line 134-138 | HIGH | [ ] |
| 14 | POST /api/agents/issue-mandate with intentHash='0xABC' (too short, must be 64 hex chars = 32 bytes) | 400 'intentHash must be 0x + 32-byte hex (64 chars)'. Code: line 140-144 | HIGH | [ ] |

*States to verify:* Address validation regex rejects invalid formats, case-insensitive / Zero address explicitly rejected (prevents mandate revocation brick) / Numeric bounds enforced (caps > 0, expires 1..365 days, actions 1..1000, venues ≤ 8) / Venue IDs validated against canonical VENUES list (line 31) / Signature and hash format validated if signature signing path is used
*Hunt for these flaws:*
- Regex allows addresses without 0x prefix or with wrong case (0X)
- Zero address check missing or incorrect
- Bounds checks allow 0 or negative values (e.g., perActionCapUsdc >= 0 instead of > 0)
- Unknown venue IDs accepted without validation
- Signature/hash format validation skipped (lines 134-155)

#### 8.7 Signature Binding: EIP-712 Struct Hash Recomputation and Signer Recovery
*Where:* `apps/verify/src/app/api/agents/issue-mandate/route.ts`
*Purpose:* Verify that mandate signatures are cryptographically bound to the exact mandate fields (per-action cap, total cap, expiry, venues, etc.) so tampering after signing is detected.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Sign a mandate payload (perActionCapUsdc=50, expiresDays=14, venues=[aave, hyperliquid]) via wagmi, obtain signature + intentHash, POST to /api/agents/issue-mandate | 200 OK; server recomputes the EIP-712 struct hash from validated form fields and recovered signer matches session wallet. Code: lines 179-228 | BLOCKER | [ ] |
| 2 | Sign a mandate, then modify perActionCapUsdc to 100 in the request body (form field), keep signature the same, POST to /api/agents/issue-mandate | 403 Forbidden with 'intent_hash_mismatch' error. Server recomputes hash with modified field and it no longer matches the signed intentHash. Code: line 213-221 | BLOCKER | [ ] |
| 3 | Sign a mandate, submit with a forged intentHash (different 32-byte hash), keep signature valid for some other hash | 403 'intent_hash_mismatch'; the server will recompute the correct hash from fields and reject the client's intentHash if it doesn't match. Code: line 213-221 | BLOCKER | [ ] |
| 4 | Sign a mandate with wallet A, obtain the signature, then submit it with wallet B's session (wallet B makes the request with wallet A's signature) | 403 'signature_wallet_mismatch'; recovered signer (wallet A) != session wallet (wallet B). Code: line 223-227 | BLOCKER | [ ] |
| 5 | Sign a mandate without the wagmi EIP-712 path (legacy POST without signature + intentHash fields), verify response | 400 or 202 response depending on Sigil deployment status. Legacy path (line 254-275) returns a pending response saying 'Sign with your wallet to complete issuance'. No signature verification on this path. | MED | [ ] |
| 6 | Sign a mandate with a chain ID of 1 (Ethereum mainnet) instead of 421614 (Arbitrum Sepolia), POST to /api/agents/issue-mandate | 403 'signature_wallet_mismatch' or signature recovery fails. The server uses only chainId=421614 (line 35, ARB_SEPOLIA_CHAIN_ID) so cross-chain signatures are rejected. Code: line 203 passes ARB_SEPOLIA_CHAIN_ID to buildSigilTypedData() | BLOCKER | [ ] |
| 7 | POST /api/agents/issue-mandate with signature but missing expiresAt or nonce (required to reproduce the EIP-712 struct) | 400 'expiresAt must be a unix-seconds decimal string' or 'nonce must be a decimal string'. Code: line 150-155 | HIGH | [ ] |

*States to verify:* EIP-712 struct hash recomputed server-side from validated mandate fields (line 203) / Signer recovered from recomputed hash, not client-supplied intentHash (defence against presigned envelope attacks) / Recovered signer matches session wallet (line 223) / Server uses canonical Sigil address from deployments registry (line 179) / Server uses only chainId 421614 (no cross-chain signature acceptance)
*Hunt for these flaws:*
- Signature recovered from client-supplied intentHash instead of recomputed hash (pre-fix bug at line 165-178)
- Signer not validated against session wallet
- Form field tampering not detected (signature not re-verified after field validation)
- Cross-chain signatures accepted (wrong chainId in buildSigilTypedData)
- EIP-712 struct missing fields (e.g., agentRevocationNonceAtSigning), causing hash mismatch

#### 8.8 Error Handling: Honesty and Safe Error Detail Redaction
*Where:* `apps/verify/src/app/api/agents/my-mandates/route.ts`
*Purpose:* Verify that errors do not leak sensitive information (RPC URLs, env vars, stack traces) to clients, and that pending states honestly indicate data unavailability instead of showing fake/placeholder numbers.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Call GET /api/portfolio/summary with Plinth unavailable (e.g., RPC endpoint down), inspect response | 200 with source='pending', all numeric fields null (totalAccountValueUsd, totalRequiredMarginUsd, etc.). Code: lines 24-32 return honest pending state on error, never fake numbers | HIGH | [ ] |
| 2 | Call GET /api/agents/my-mandates with Scribe unavailable (GraphQL endpoint down), inspect error in response | 200 with source='pending', reason='scribe_unavailable', mandates=[]. Code: line 109 catches error and returns honest pending state, not fake data | HIGH | [ ] |
| 3 | Enable production mode (NODE_ENV=production), trigger an error in /api/lantern/latest (call with bad input), inspect response error detail | Generic error string (e.g., 'upstream unavailable'), NOT the underlying exception message (which might contain RPC URL). Code: safeErrorDetail() at line 20-27 redacts in production (line 23-26) | HIGH | [ ] |
| 4 | Enable development mode (NODE_ENV=development), trigger the same error, inspect response | Full error message visible in response (helps debugging). Code: line 24 returns e?.message in dev mode | MED | [ ] |
| 5 | Call GET /api/portfolio/summary when Plinth RPC call fails with a message containing 'https://arbitrum-sepolia.publicnode.com...' (RPC endpoint leak), inspect response in production | Error detail is redacted to 'upstream unavailable' or fallback string. The full RPC URL is logged server-side (console.error at line 22) but never sent to client. Code: lines 20-27 enforce this. | HIGH | [ ] |
| 6 | POST /api/agents/issue-mandate with invalid JSON in request body, inspect error response | 400 'bad_request_body' (line 89); no stack trace or detailed parsing error exposed | MED | [ ] |
| 7 | Check /api/settings/wallet response when PosternKeyRegistry is not deployed, verify no fake authenticator data is returned | source='pending' with null fields, not fake data. Code: mentioned in the summary as Audit NN-2 fix at line 5 of safe-error.ts docstring | HIGH | [ ] |

*States to verify:* Pending state returned honestly when upstream unavailable (source='pending') / No fake/placeholder numbers shown (null instead of 0 or 'N/A') / Error details redacted in production (NODE_ENV=production) / Full stack traces logged server-side (console.error) but not sent to client / RPC URLs, env vars, library versions not leaked in error messages
*Hunt for these flaws:*
- Placeholder numbers returned (e.g., 0, -1, 'N/A') instead of null when data unavailable
- Error stack trace or detailed message sent to client in production
- source field missing or inconsistent (should be 'pending', 'scribe', 'plinth', etc.)
- Error detail includes RPC endpoint URL or Upstash Redis URL
- Console.error redacted in production (should only happen in client response)

#### 8.9 Security Headers: CSP, HSTS, X-Frame-Options, and Cookie Settings
*Where:* `apps/verify/src/lib/security-headers.mjs, C:/Users/prate/Downloads/arb builder/next.config.mjs`
*Purpose:* Verify that browser security headers prevent common attacks (XSS, clickjacking, MIME-type sniffing) and that cookies are configured with secure flags.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Open browser DevTools, navigate to verify.atrium.fi, inspect Network tab for response headers | Strict-Transport-Security: max-age=63072000; includeSubDomains; preload (2-year HSTS). Code: line 26 of security-headers.mjs | HIGH | [ ] |
| 2 | Inspect Content-Security-Policy header, verify default-src='self' | CSP header includes default-src 'self', script-src 'self' (+ unsafe-inline for Next.js), style-src 'self' (+ unsafe-inline). Frame-ancestors 'none' prevents embedding. Code: lines 7-23 build CSP | HIGH | [ ] |
| 3 | Check X-Frame-Options header | X-Frame-Options: DENY (prevents clickjacking by disallowing embedding in iframes). Code: line 27 | HIGH | [ ] |
| 4 | Check X-Content-Type-Options header | X-Content-Type-Options: nosniff (prevents MIME-type sniffing attacks). Code: line 28 | HIGH | [ ] |
| 5 | Check Permissions-Policy header | Disables camera, microphone, geolocation, payment, etc. Code: lines 31-34 | MED | [ ] |
| 6 | Login and check atrium-session cookie in browser, inspect flags | Cookie has HttpOnly, Secure (HTTPS only in production), SameSite=Strict flags. Code: /api/auth/verify line 74-80 | BLOCKER | [ ] |
| 7 | Check atrium-nonce cookie (from /api/auth/nonce) | Cookie has HttpOnly, SameSite=Strict flags, 15-min maxAge. Code: /api/auth/nonce (not shown but should set httpOnly, sameSite=strict) | HIGH | [ ] |
| 8 | Attempt to access atrium-session cookie via JavaScript (e.g., document.cookie) | Cookie not visible (HttpOnly prevents JS access). Code: httpOnly: true at line 75 of verify/route.ts | HIGH | [ ] |
| 9 | Verify CSP allows Sentry error reporting, check connect-src includes *.sentry.io or /monitoring tunnel | connect-src includes /monitoring (Sentry tunnel, see line 14 and next.config.mjs comment at line 51-54). Tunnels to o<id>.ingest.sentry.io so no external Sentry domain needed in CSP. | MED | [ ] |

*States to verify:* HSTS enabled with 2-year max-age and includeSubDomains / Content-Security-Policy present and restrictive (default-src 'self') / X-Frame-Options set to DENY (no embedding) / X-Content-Type-Options set to nosniff / Permissions-Policy disables unnecessary features / Session cookies: HttpOnly, Secure, SameSite=Strict / Nonce cookies: HttpOnly, SameSite=Strict, short TTL
*Hunt for these flaws:*
- HSTS missing or max-age too short (< 1 year)
- CSP default-src allows 'unsafe-eval' or broad wildcards
- X-Frame-Options missing or set to SAMEORIGIN (allows embedding on same origin)
- Cookies missing HttpOnly flag (vulnerable to XSS token theft)
- Cookies missing SameSite flag (vulnerable to CSRF, though nonce+origin checks mitigate)
- Session cookie Secure flag off in production (HTTPS traffic could expose token)

#### 8.10 Performance: Frontend Bundle Size, Lighthouse Scores, and Console Errors
*Where:* `apps/verify/package.json`
*Purpose:* Verify that the Atrium frontend is optimized for performance, with acceptable bundle sizes, Lighthouse scores, and no silent errors in the console.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Run Lighthouse audit on verify.atrium.fi (Desktop, PageSpeed Insights or DevTools) | Performance score >= 75, Accessibility >= 90, Best Practices >= 85, SEO >= 90. Identify and fix failing audits (e.g., largest contentful paint, layout shift) | MED | [ ] |
| 2 | Inspect Network tab, main bundle size (e.g., _next/static/chunks/*.js) | Main bundle < 200 KB (gzipped). React 19 app with TailwindCSS v4 should be lean. Code: package.json lists React 19.0.0, TailwindCSS 4.0.0-beta | MED | [ ] |
| 3 | Navigate through /app/* routes (portfolio, agents, settings, transfer, etc.), open DevTools Console and check for errors or warnings | No red ERROR or yellow WARNING lines from app code (Sentry integration is OK). React strict mode warnings should be minimal. Code: next.config.mjs line 6 enables reactStrictMode | HIGH | [ ] |
| 4 | Check for layout shift (CLS) while page loads, use DevTools Performance tab or Lighthouse metric | CLS < 0.1 (good). No images without explicit width/height, no font swaps causing flash. Code: ensure fonts preloaded and images have dimensions | MED | [ ] |
| 5 | Measure Largest Contentful Paint (LCP) on landing page, should be fast (< 2.5s) | LCP < 2.5s on good connectivity. Verify Plinth/Scribe data fetching doesn't block initial paint. Code: portfolio data from /api/portfolio/summary is client-fetched, not SSR-blocked | MED | [ ] |
| 6 | Test First Input Delay (FID) or Interaction to Next Paint (INP) on /app/* routes (click buttons, fill inputs) | INP < 200ms (good). No long JS tasks blocking interactions. Code: TanStack React Query used for async data fetching to avoid blocking | MED | [ ] |
| 7 | Verify poweredByHeader is disabled in next.config.mjs | poweredByHeader: false at line 6 hides 'X-Powered-By: Next.js' header (minor security improvement) | LOW | [ ] |

*States to verify:* Lighthouse Performance score >= 75 / Main bundle size < 200 KB (gzipped) / No red errors in DevTools Console from app code / Cumulative Layout Shift < 0.1 / Largest Contentful Paint < 2.5s / Interaction to Next Paint < 200ms / No unnecessary large assets or render-blocking resources
*Hunt for these flaws:*
- Bundle size > 300 KB (app bloated, possible unused dependencies)
- Layout shift caused by unoptimized images or dynamic content insertion
- Slow initial paint due to SSR-blocking data fetch or large JS
- Silent JS errors in console (shown in red, may break interactions)
- React strict mode doubled-render warnings not investigated
- Font swap or external font load causing FOUT (flash of unstyled text)
- Sentry DSN not configured, errors not being captured

#### 8.11 Data Source Honesty: Pending vs. Real Data and Source Field Verification
*Where:* `apps/verify/src/app/api/agents/my-mandates/route.ts`
*Purpose:* Verify that the API consistently and honestly reports data source (pending, plinth, scribe) so the UI never displays real-looking numbers that are actually placeholders or from stale caches.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Call GET /api/portfolio/summary when Plinth is available, verify source field | source='plinth' (line 52 of summary/route.ts); all numeric fields populated from plinth.read.getAccount() | HIGH | [ ] |
| 2 | Call GET /api/portfolio/summary when Plinth is unavailable (e.g., crash, timeout), verify source and values | source='pending' (line 61), all numeric fields null (not zeros or fake values). Code: catch block at line 54-62 returns honest pending state | BLOCKER | [ ] |
| 3 | Call GET /api/portfolio/activity when Scribe is available, verify source field and activity count | source='scribe' (line 118); activities array populated from Scribe GraphQL query. No hardcoded or cached data. | HIGH | [ ] |
| 4 | Call GET /api/portfolio/activity when Scribe is unavailable, verify source and activities array | source='pending' (line 120), activities=[] (empty, not fake activities). Code: catch block returns honest pending state | BLOCKER | [ ] |
| 5 | Call GET /api/agents/my-mandates without DEMO_WALLET_ADDRESS env set, verify response | source='pending', reason='no_wallet_configured' (line 58), mandates=[] | HIGH | [ ] |
| 6 | Call GET /api/agents/my-mandates when Scribe is available, verify source and mandate count | source='scribe' (line 107), mandates array computed from SigilValidation - SigilRevocation events | HIGH | [ ] |
| 7 | Inspect GET /api/agents/my-mandates response structure: verify 'source' field exists and matches response content | source='pending' ↔ mandates=[], reason='scribe_unavailable'. source='scribe' ↔ mandates=[] or populated. Never source='pending' with non-empty mandates. | HIGH | [ ] |
| 8 | Check /api/portfolio/summary for pnl24hDirection field consistency: when pnl24hUsd=null, verify pnl24hDirection=null (not 'flat') | Both null or both populated; never direction != null when value == null. Code: Audit U-23 fix at line 44-48 ensures consistency | MED | [ ] |

*States to verify:* source field always present in response (pending, scribe, plinth, or other) / source field matches response content (source='pending' ↔ null/empty, source='scribe'/'plinth' ↔ populated) / No numeric fields populated when source='pending' (null, not 0 or -1) / reason field provided when source='pending' (e.g., 'scribe_unavailable', 'plinth_unavailable') / Mandate count = (SigilValidation count) - (SigilRevocation count) for active mandates / Activity list sorted by Unix timestamp (not lexical 'Xm ago' string)
*Hunt for these flaws:*
- source field missing from response
- Fake/placeholder data returned with source='pending' (e.g., totalAccountValueUsd: 0, pnl24hUsd: 0)
- Stale cache returned without indicating source
- Mandates counted incorrectly (include revoked mandates in active list)
- Activities sorted by human-readable 'Xm ago' string instead of Unix timestamp (audit KK-8 bug)
- Corrupt/null event fields not filtered (e.g., sigilValidations with agent=null)
- pnl24hDirection='flat' returned when pnl24hUsd=null (audit U-23 bug)

#### 8.12 Integration: End-to-End Auth Flow and Protected Route Access
*Where:* `apps/verify/src/middleware.ts`
*Purpose:* Verify that the complete authentication flow (nonce → SIWE verify → session cookie → protected route access) works end-to-end and that unauthenticated access is blocked.

| # | Do this | Expect (premium = correct) | Sev | Pass |
|---|---------|----------------------------|-----|------|
| 1 | Call GET /api/auth/nonce, receive nonce cookie, then POST /api/auth/verify with a valid SIWE signature, verify session cookie is set | Nonce returns 200 with atrium-nonce cookie; Verify returns 200 with atrium-session cookie and walletAddress. Both cookies httpOnly, secure, sameSite=strict. | BLOCKER | [ ] |
| 2 | After completing auth, call GET /api/portfolio/summary, verify it succeeds and returns portfolio data | 200 with portfolio data (source='plinth' or 'pending'). The session cookie is automatically sent by browser, matched via requireWalletMatch() | BLOCKER | [ ] |
| 3 | Delete the atrium-session cookie, then call GET /api/portfolio/summary | 401 Unauthorized; no session found. Code: getSession() returns null if no cookie, requireWalletMatch() returns 401 | BLOCKER | [ ] |
| 4 | Call GET /api/portfolio/summary without performing auth first (no nonce, no verify) | 401 Unauthorized | BLOCKER | [ ] |
| 5 | Auth as wallet A, then modify atrium-session cookie value (e.g., flip a bit in the base64), call GET /api/portfolio/summary | 401 or 403 Unauthorized; timingSafeEqual() detects tampering. Code: auth-session.ts line ~108 | BLOCKER | [ ] |
| 6 | Auth as wallet A, call POST /api/agents/issue-mandate without Origin header | 403 'origin_not_allowed'; mutation routes require Origin, auth middleware doesn't grant exception | HIGH | [ ] |
| 7 | Auth as wallet A, call POST /api/agents/issue-mandate from Origin='https://evil.com' | 403 'origin_not_allowed'; origin check runs before mandate validation | BLOCKER | [ ] |

*States to verify:* Nonce flow works (GET /api/auth/nonce sets cookie) / SIWE verify flow works (POST /api/auth/verify validates signature and sets session) / Protected routes check for session and reject 401 if missing / Session tamper detection works (modified cookie rejected) / Origin validation enforced on mutation routes (POST, etc.) / Wallet mismatch detected on cross-wallet session attempts
*Hunt for these flaws:*
- Session not validated on protected routes
- Nonce reused or not invalidated after verify
- SIWE domain/URI checks skipped on certain domains
- Origin validation bypassed for certain routes
- Session tampering not detected (HMAC validation skipped)
- Unauthenticated requests bypass rate limiting


---

## 9. Launch-ready GO / NO-GO gate

**The rule:** every gate below must be GREEN, and there must be **zero open BLOCKER findings** anywhere in this document, to call Atrium launch-ready. A single fabricated-number or dead-critical-flow finding is an automatic NO-GO.

| # | Gate (all must be GREEN) | Status |
|---|--------------------------|--------|
| 1 | GATE: Page Surface Coverage Must Reach 100% - All 45 actual pages (not 28 claimed) must have coverage matrix including success, error, loading, and mobile states. Blockers: /legal/*, /security/*, /internal/*, /chaos, /loadtest pages are untested | [ ] |
| 2 | GATE: API Endpoint Coverage Must Reach 100% - All 47 actual endpoints (not 24 claimed) must be tested for success response, error responses (4xx, 5xx), timeouts, and rate limiting. Blockers: /api/protocol/*, /api/research-attestation/*, /api/sumsub/*, /api/chaos/*, /api/loadtest/* untested | [ ] |
| 3 | GATE: Real-Time State Transitions - Scribe event propagation (from on-chain event to UI update) must have <5s latency SLA with test cases validating state arrival. Plinth margin updates must render as 'pending' then 'confirmed'. Vigil liquidation execution must trigger notification | [ ] |
| 4 | GATE: Liquidation Cascade End-to-End - From Vigil keeper triggering on-chain event through NotificationsList notification to user viewing liquidation details and executing recovery trade must complete without data loss or UI freezing | [ ] |
| 5 | GATE: Mandate Lifecycle - Issue → validation (Sigil) → agent acceptance → compliance monitoring → revocation → settlement must preserve audit trail and trigger notifications at each step | [ ] |
| 6 | GATE: Adapter Failover Under Load - When primary venue (e.g., Aave) returns 503, secondary (e.g., Morpho) must auto-activate within <2s with user notification. Must not lose pending orders | [ ] |
| 7 | GATE: Mobile Viewport Testing - All 45 pages must render correctly at 320px, 768px, and 1024px breakpoints. Touch gestures (swipe, tap, pinch-zoom) must not break on mobile app shell | [ ] |
| 8 | GATE: Error Recovery Flows - Timeout, 500, and 429 responses must trigger retry with exponential backoff. UI must show 'Retrying...' state. User must not see fabricated/stale data during recovery | [ ] |
| 9 | GATE: API Response Validation - All 47 endpoints must validate response schema against OpenAPI spec. Null/undefined fields must not render in UI; must show 'Data pending' instead | [ ] |
| 10 | GATE: Accessibility WCAG 2.1 AA - All interactive pages must pass axe-core scan. Keyboard-only navigation must work without mouse. Screen reader must announce all updates | [ ] |
| 11 | GATE: Performance SLAs - LCP <2.5s, FCP <1.8s, TTI <3.8s on 4G throttle (100mbps). k6 load test must pass 100 concurrent users with <5% error rate | [ ] |
| 12 | GATE: Tax Reporting Accuracy - FIFO/HIFO calculation must match manual audit for 10 test portfolios. No rounding errors >$0.01. CSV export must be audit-ready | [ ] |
| 13 | GATE: Data Honesty Verification - No fabricated TVL, APY, or user balances. All numbers must come directly from Scribe (on-chain truth) or marked as 'estimate' with caveat | [ ] |
| 14 | GATE: Notification Delivery SLA - Mandate revocation event must reach user's NotificationsList within 3 blocks (Arbitrum Sepolia ~12s). Liquidation alert must have 100% delivery confirmation | [ ] |

### 9.1 Hard NO-GO triggers (any one blocks launch)
- A screen shows a **fabricated number as real** (TVL, balance, APY, counts, fees).
- A **critical flow dead-ends**: connect, faucet, deposit, withdraw, open/close position (after the timelock), transfer, mandate, kill switch, verify-balance.
- A **silent failure**: an action appears to succeed but no tx/state change happened, or an error is swallowed with no user feedback.
- A **security finding**: auth bypass, IDOR (one wallet reads another's data), CSRF on a mutation, a signature that does not bind to its mandate, or a leaked secret.
- A **mobile-broken** core surface (any /app/* page unusable at 375px).

---

## 10. Sign-off

Launch-ready is a decision, not a vibe. Fill this in only when the gate above is fully green.

| Dimension | Reviewer | Result (PASS / FAIL) | Open blockers | Date |
|-----------|----------|----------------------|---------------|------|
| 1. Pages (all 45) |  |  |  |  |
| 2. User journeys |  |  |  |  |
| 3. On-chain + services |  |  |  |  |
| 4. API (all 50) |  |  |  |  |
| 5. Components + states |  |  |  |  |
| 6. Copy + writing |  |  |  |  |
| 7. Design + brand + a11y |  |  |  |  |
| 8. Security + performance |  |  |  |  |
| **Overall launch-ready?** |  |  |  |  |

> Note (current state, 2026-05-29): trading/open-position is scheduled and unlocks ~2026-05-31 02:20 UTC; until then mark those journey items "gated (expected)" rather than FAIL. The subgraph is syncing, so live numbers ramp from `pending` to real - re-run the data-honesty checks after it catches up.

---

*This plan was generated from the codebase, not from memory. Re-run `node scripts/build-qa-doc.mjs <workflow-output.json>` after major changes to refresh the page/API coverage and scripted cases.*
