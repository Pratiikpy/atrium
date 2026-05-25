# Judge-day runbook — Atrium 5-minute demo

PRD §27.1 + §26.1. The 5 minutes the judges will see. Read this aloud
when rehearsing; click exactly what is described; do not improvise.

## Hard constraints

- Total wall-clock: ≤ 5:00 plus ≤ 1:00 Q&A budget. Stop at 6:00 even
  if a beat is missing — the back-half is more credible than the
  front-half running long.
- Speaker: F1 by default. F2 + F3 are at laptops as silent runners.
- F2 owns chaos injection. F3 owns the timer + the recording light.

## Pre-flight (T-15 min, NOT in front of judges)

1. Open `https://verify.atrium.fi/verify/1` in a fresh Chrome window
   (no extensions). Sign in with the Postern passkey for the
   demo wallet.
2. Confirm the wallet has ≥ 100 USDC + 0.05 ETH on Arbitrum Sepolia.
   Faucet route `/faucet` if low.
3. Open `https://verify.atrium.fi/lantern` in a second tab.
4. Open `https://sepolia.arbiscan.io` in a third tab.
5. Confirm `verify.atrium.fi/verify/1` shows `Connect with Postern`,
   not an error screen. If the Kani badge in the top-right is red,
   STOP — switch to the Loom backup (`rehearsals/loom-recording-outline.md`).
6. F2 confirms `CHAOS_PRIVATE_KEY` is set on the Vercel project. Test
   inject + restore once. Restore.
7. F3 hits Record on whatever screen-recorder the venue captured the
   feed on. The recording is the artefact that goes to judges who
   ran out of time.

## The 5-minute script

### Beat 0 — 0:00 to 0:30 — The hook

> **F1:** Jamie runs a $50K options book on Hyperliquid and another
> $50K cash on Aave. Today, her broker treats those as $100K of
> collateral. Atrium nets them. One wallet, one margin number, one
> liquidation surface. **Verifier mode is the proof.**

(F1 clicks `https://verify.atrium.fi`. Hero loads.)

### Beat 1 — 0:30 to 1:00 — Verifier loads

(F1 clicks `Verifier mode → Step 1: deposit`.)

> **F1:** Real Arbitrum Sepolia. No mocks on the path you're about
> to see. The Kani badge in the corner links to a live CI proof of
> Plinth's solvency invariant.

(F1 hovers Kani badge so judges see the link tooltip; does NOT click.)

### Beat 2 — 1:00 to 1:30 — Deposit

(F1 clicks `Deposit 100 USDC`. Wallet prompt appears.)

> **F1:** One signature. ERC-4626 deposit. Coffer mints shares.

(F1 signs. Tx hash appears. F1 reads the first 8 chars + last 4.)

> **F1:** That's a real on-chain tx. Arbiscan link is right there.

(F1 hovers the Arbiscan link; doesn't navigate.)

### Beat 3 — 1:30 to 2:30 — Open hedged + show margin saving

(F1 clicks `Step 2: open hedged position`.)

> **F1:** Two parallel positions. Long on Trade.xyz, short on
> Hyperliquid. Same instrument. Net delta zero.

(F1 fills both forms, clicks submit. Two tx hashes appear.)

> **F1:** The Plinth margin tile updates live. With cross-margin,
> the required collateral is **$1.2K** — without it, **$8.5K**.
> That's the 47%-collateral-saving figure on the landing page;
> here you're watching it happen on chain.

(F1 points at the margin number, does NOT zoom.)

### Beat 4 — 2:30 to 3:30 — Chaos mode

(F2 silently hits `/api/chaos/inject?fault=oracle_drift` from a side
terminal — no UI clicks from F1's screen.)

(F1's UI: the venue status pill flips to amber "Plinth paused —
oracle drift".)

> **F1:** Watch what happens when Chainlink and Pyth disagree by
> more than 50bps. Plinth pauses. Vigil queues a liquidation if any
> account crosses the threshold. The pause is multisig-instant —
> the resume needs 48h timelock. Asymmetry by design.

(F2 hits `/api/chaos/restore?fault=oracle_drift` after F1 says
"timelock". The UI shows "resume pending — 48h window".)

> **F1:** Honest restore takes 48h. Demo doesn't fake it.

### Beat 5 — 3:30 to 4:00 — Reserves proof

(F1 switches to the Lantern tab.)

> **F1:** Every hour Lantern publishes a Merkle root of every share
> holder's balance. Here's the latest — block N, root hash, IPFS CID
> for the full tree. Anyone can verify their inclusion.

(F1 clicks his own wallet's Merkle proof, shows the path.)

### Beat 6 — 4:00 to 4:30 — Kill switch

(F1 returns to `/verify/7`.)

> **F1:** One button. Revokes every Sigil mandate and every Postern
> session key in a single tx. If a delegated agent goes rogue —
> click here.

(F1 clicks `Activate kill switch`. Confirm dialog. F1 confirms.
One tx hash. F1 reads it.)

### Beat 7 — 4:30 to 5:00 — Close

> **F1:** What you just saw: a 100 USDC deposit, a hedged open,
> a chaos drill, a reserves proof, a kill switch. All real on
> Arbitrum Sepolia. No fake data, no mocked path.
>
> Three asks:
> 1. Join the cohort. Five test partners, two slots open.
> 2. Try Verifier mode yourself — QR on the card.
> 3. Audit our code. Public on day 1.

(F1 holds the QR card up for 3 seconds.)

### Q&A — 5:00 to 6:00

Anticipated questions + scripted answers in `rehearsals/qa-prep.md`.

## Recovery scripts

### If the wallet doesn't connect at Beat 1

Switch tabs to the Loom (third browser tab kept hidden).
F1 narrates over the Loom from the start.

### If a tx reverts mid-demo

> **F1:** That tx reverted — testnet's RPC is congested. Skip to
> the next beat and circle back.

F2 silently submits the failed tx via a side terminal; the recording
captures it on Arbiscan even if the demo UI didn't show it.

### If `verify.atrium.fi` 404s

F1 says "We saw the same outage in rehearsal — Loom backup". F3 raises
laptop-with-Loom to the judges' line of sight.

### If chaos doesn't fire

F2 says "skipping chaos beat — falling through to reserves." F1 cuts
Beat 4 entirely; Beat 5 starts at 2:30 instead of 3:30, reclaims the
30 seconds.

## What NOT to do

- Do NOT promise mainnet date. We say "Year-2 mainnet flip" if asked.
- Do NOT claim Wintermute / Selini / Auros / Galaxy as cohort partners
  (no consent — strip from any slide).
- Do NOT click into Arbiscan during the demo; the tab switch eats 8s
  and breaks the rhythm.
- Do NOT improvise. If a judge interrupts, finish the beat, then
  answer in Q&A.
