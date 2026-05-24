# Stanford Law Crypto Clinic — consult question list

**Purpose:** `human_left.md` #5. F3 books a 30-min slot at https://law.stanford.edu/codex/legal-clinic/ and walks through these questions. Save the resulting memo as `legal/jurisdictional-note-v1.pdf` (gitignored).

**Context to send the clinic before the call** (TL;DR for the lawyer):

> Atrium is a non-custodial DeFi protocol on Arbitrum testnet. We aggregate margin across 7 onchain venues (Hyperliquid, Aave Horizon, Pendle, Trade.xyz, Curve, Polymarket, RH-Chain when SDK ships). 3-founder team, $0 founder capital, Year-1 testnet only. We need a baseline jurisdictional read before any mainnet decision and before any public launch.

---

## Questions (rank order — most important first)

### 1. Year-1 testnet posture

- Is a testnet-only product with no real-money TVL exposed to securities, commodities, or money-transmission claims under US, UK, or EU regulation?
- If the answer is "depends on facts," what are the specific facts that would tip it (e.g., named tokens, fiat off-ramps, regulated venues touched)?
- What's the safe public-language framing for "this is testnet, $0 risk, no token"?

### 2. ERC-8004 agent mandates

- Sigil's EIP-712 mandates let third-party AI agents trade on a user's behalf with revocable consent. Is this a regulated activity?
- If Atrium hosts a marketplace of named agents (Rostrum), does that change the answer?
- What disclosure is required at the agent-onboarding screen?

### 3. Lantern proof-of-reserves

- We publish hourly Merkle roots of all user balances on chain. Is this enough to claim "proof of reserves" publicly without misleading users?
- What disclaimer language do we need on `lantern.atrium.fi`?
- Does this trigger any audit-firm relationship requirement under the upcoming MiCA framework?

### 4. Curator grants

- We disburse up to $50K in ARB grants to community builders via the Curator contract. Are grantees employees, contractors, or recipients?
- Tax-treatment for the grantee (US + UK + DE)?
- Do we need a grantee agreement template?

### 5. Tablet tax exports

- Tablet generates UK CGT + US Form 8949 + DE FIFO exports from on-chain trade history. Are we operating as a tax advisor by shipping this?
- What disclaimer language ("this is not tax advice; consult a qualified adviser") is required?
- Liability if the math is wrong?

### 6. Mainnet flip gate

- What's the minimum legal-stack for a mainnet launch?
  - Entity structure (Cayman SPV? Delaware LLC + foreign subs?)
  - Token vs no-token decision
  - Sanctions / OFAC screening at deposit time
  - Geo-blocking (block US? block sanctioned jurisdictions?)
- We assume Year-2 not Year-1. Confirm the assumption is sound.

### 7. Cohort partner agreements

- 5–8 named firms test our testnet. Do we need an LOI? What clauses are load-bearing?
- Should the LOI be public (on cohort.atrium.fi) or kept private?

### 8. Press claims

- We say "47% collateral savings" with a backtest CID published on chain via ResearchAttestation. Is the on-chain commitment enough, or do we need disclaimers per FTC endorsement guidelines (US) / ASA (UK)?

---

## Time budget (30 min total)

- Q1 (testnet posture) — 8 min (most important; foundational)
- Q6 (mainnet gate) — 6 min (Year-2 decision shape)
- Q2 (agent mandates) — 4 min
- Q3 (Lantern PoR) — 4 min
- Q4 (Curator grants) — 3 min
- Q5 (Tablet exports) — 3 min
- Q7 (Cohort LOI) — 1 min
- Q8 (press claims) — 1 min

If the lawyer wants to spend more time on Q1, let them — that's the load-bearing answer.

---

## After the call

1. Type up the memo. Don't paraphrase — capture the lawyer's exact language for any "depends on" or "I'd recommend" statement.
2. Save as `legal/jurisdictional-note-v1.pdf`.
3. Mark `human_left.md` #5 closed.
4. Update PRD §28 honesty appendix with any claim the lawyer flagged.
5. If the lawyer recommended geo-blocking, file an issue to wire it into Edict's tier ladder before mainnet flip (Year-2 work; not Day-17 blocker).
