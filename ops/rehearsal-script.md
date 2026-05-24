# Demo rehearsal script (5-minute Buildathon judge pitch)

**Purpose:** `human_left.md` #7. Run this 10 times before Day 17. Each run: log in `rehearsals/dress-run-N.md` with date, run number, fault injected, recovery time, observed issues, 6-min budget met (Y/N).

**Acceptance per PRD §26.2:** at least 9 of 10 runs finish under 6 minutes with no judge-facing surprise.

---

## Setup (60 sec before judges enter)

- Laptop on power
- Verifier Mode open: `verify.atrium.fi`
- Test wallet pre-connected via Postern passkey
- Loom backup tab open in second browser
- Phone with QR sticker visible
- F1 driving the demo, F2 watching for UI issues, F3 watching the timer

---

## Script (5 min)

### 0:00 — 0:30 · The wedge

"Jamie is a senior trader. She runs a hedged book — long HIP-3 perps on Hyperliquid, short Pendle YT for the carry, T-bill collateral on Aave Horizon. Today she posts collateral at each venue separately. She's over-collateralized by 47% versus what a unified margin system would require. Atrium gives her one wallet, one margin number, three venues."

**On-screen:** the landing page hero. Don't scroll.

### 0:30 — 1:30 · Verifier Step 1 (deposit)

Click "Step 1: Deposit USDC". Show the test wallet sign via Postern passkey (no MetaMask popup — judge sees the smooth UX). Coffer.deposit emits the share-mint event. Verifier surface a tx hash with Arbiscan link.

"This is one tx. Postern passkey login means no seed phrase, no extension, install-as-PWA-and-go. Coinbase Smart Wallet under the hood, Pimlico bundler pays the gas."

### 1:30 — 2:30 · Verifier Step 2 (open hedged position)

Click "Step 2: Open Hedged Position". This is the load-bearing step — AtriumRouter orchestrates:
1. Plinth records margin
2. PorticoRegistry resolves the adapter
3. Coffer.adapter_pull moves the approved margin to the adapter
4. Adapter opens venue position

Verifier shows all 4 tx receipts inline with Arbiscan links + a real-time margin readout.

"One tx, four contracts touched atomically. Pre-Wave-74 the adapter wasn't even reachable — Plinth recorded margin without ever calling the adapter. We caught and fixed that. Audit trail is in docs/AUDIT_FINDINGS.md."

### 2:30 — 3:15 · Verifier Step 3 (cross-venue read)

Click "Step 3: Unified margin". The Verifier surfaces the SAME `getAccount(jamie)` from Plinth showing:
- Collateral: $X
- Required (across all 3 venues): $Y
- Buying power: $X − $Y
- All numbers from on-chain Scribe queries, no config files

"This is the headline product number. One read, one number. Pre-Atrium Jamie reads three dashboards and does the math by hand."

### 3:15 — 4:00 · Verifier Step 4 (Lantern proof-of-reserves)

Click "Step 4: Verify your balance". Open the Lantern attestation modal. Enter Jamie's address. Paste her Merkle proof (auto-populated from Scribe). The on-chain verifier returns `true`.

"Every hour, Lantern publishes a Merkle root of every Coffer balance to Arbiscan. Anyone — any judge, any partner, any auditor — can verify their own balance against the published root in 30 seconds. Pre-Fire-77 the verifier was vulnerable to a second-preimage attack; we caught it via the sub-agent audit and shipped the double-hash fix."

### 4:00 — 4:45 · Verifier Step 5 (Kill Switch)

Click "Step 5: Kill Switch". A confirm dialog appears. Click confirm. Postern Kill Switch revokes every Sigil mandate + every active session key in one batched tx. Show the resulting events on Arbiscan.

"AI agents are first-class users via Sigil EIP-712 mandates. If Jamie's agent goes rogue, one button revokes everything. Tested resilient to per-agent failure — one bad agent doesn't block the others or the session key cancellation."

### 4:45 — 5:00 · Close

"5 minutes. 1 wallet. 3 venues. 9 Kani-verified invariants. 15 sub-agent audits. The code is in the repo, the proofs are in CI, the dashboard numbers are on chain. Atrium. Thank you."

---

## Chaos Mode injection table (random, F3 picks)

Roll a d10 before each rehearsal. Inject the fault at the listed step. Recovery must finish within the 6-minute budget.

| Roll | Fault | Inject at | Expected recovery |
|---|---|---|---|
| 1 | Chainlink ETH/USD feed returns stale data | Step 3 | Plinth reverts with `OracleStaleError`; Verifier shows "Oracle paused. Switch to backup feed via Praetor multisig (48h)." |
| 2 | Pyth feed disagrees with Chainlink by 100bps | Step 3 | `OracleDisagreementError`; Verifier shows the disagreement diff. |
| 3 | Aqueduct CCIP delivery delays | Step 2 (Polymarket hedge) | Verifier shows "Cross-chain pending"; Step 3 still works (only the cross-chain leg is delayed). |
| 4 | Lantern attestation cron fails | Step 4 | Verifier shows "Last attestation 2h ago" with timestamp; manual `praetor lantern publish-now` recovers. |
| 5 | Sigil mandate expired mid-demo | Step 5 | Click Kill Switch anyway; cancels session keys even if mandate already revoked. |
| 6 | Codex Workers isolate rate-limits us | Step 3 | Verifier shows 429 + retry-after; Auto-retries in 3s. |
| 7 | Subgraph reindex lag | Step 4 | Verifier shows "Scribe sync 5 blocks behind"; clarifies that on-chain reads are authoritative. |
| 8 | One of 3 keepers offline | Step 2 | Verifier shows "2 of 3 keepers active"; HONEST count per PRD §1.3. |
| 9 | Curator grant page shows zero | Step 0 (between hero and Step 1) | Honest: "0 grants funded yet — FLOOR scenario." No invented numbers. |
| 10 | Wifi drops at Step 2 | Step 2 | Pull the QR sticker, judge scans it, falls back to the Loom video within 30s. |

---

## Post-rehearsal log

Each rehearsal log entry (`rehearsals/dress-run-N.md`):

```markdown
# Dress run N

- Date: 2026-MM-DD
- Run number: N of 10
- Fault injected: [from table above, or "none"]
- Recovery time: M:SS (must be within 6:00 total budget)
- Observed issues: [bullet list]
- 6-min budget met: Y / N
- Notes for next run: [anything to adjust]
- Signed: [F1, F2, F3 names]
```

After all 10 runs:
- If 9+ meet budget → Day 17 demo is GREEN.
- If 8 meet budget → run two more rehearsals, target 11 of 12.
- If 7 or fewer → STOP. Schedule a Day −7 emergency review per PRD §26.3 tripwire.
