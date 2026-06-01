# Founder actions — the road to a winning submission

Last updated 2026-05-31. Everything an AI agent could do autonomously is done:
the full audit (`map.md`) found 18 critical defects, **all 18 are fixed at the
root with regression tests, committed (3ac2796), and verified green**
(forge 715/715, verify-app tsc + vitest, Stylus host tests, services + python
suites). The fixed contracts are deployed to Arbitrum Sepolia and staged.

This file is the short list of things **only you (the founder) can do**, or that
are **time-gated** on the 48h timelock. Ordered by impact on the prize.

---

## 1. THE CUTOVER — make the live app actually work (time-gated, turnkey)

The live addresses still run the OLD buggy bytecode. The fixed set is staged in
`deployments/arbitrum_sepolia.staged.json`. Until you flip it, the demo money
paths revert. This is the single highest-impact action.

**Earliest executable: ~2026-06-01 17:00 IST** (6 timelock ops in
`.forge-cache/timelock-ops.json`; full detail in `human_left.md`). After that:

```powershell
$env:ATRIUM_KEYDIR="C:/Users/prate/.atrium"
node scripts/redeploy-timelock-execute.mjs   # executes the 6 ops in order (refuses early)
node scripts/flip-cutover.mjs                # staged -> live root + verify-app mirror
# then: redeploy the verify-app (Vercel) so the bundled mirror updates, and the subgraph
```

Then run the **money-path e2e from the real UI with a wallet** — deposit, Aave
trade open/close, transfer, mandate issue+use, emergency-close, faucet — and
capture proof each one WORKS (not just submits). That click-through, recorded,
is your demo.

> An agent can run the two scripts for you after the window opens (you granted
> broadcast permission), but **you** should drive the final UI walk + recording.

---

## 2. DEMO VIDEO / LOOM (only you can record this)

Judges often score from a 2-4 min video, not a live click. Record after the
cutover: the 55%-collateral-freed cross-margin moment, the agent-mandate flow,
the one-click kill switch, the live proof-of-reserves inclusion check. Script
skeleton in `rehearsals/judge-runbook.md`. **This is a top-3 lever — do not skip it.**

---

## 3. SECURITY SIGNAL — rotate the leaked deployer key + start the multisig

The single deployer EOA is admin of every contract and that key leaked once
(2026-05-24) and was never rotated. A contract-quality judge will flag it.

- Generate a fresh deployer EOA offline; stand up a 3-of-5 Gnosis Safe.
- One-time admin-transfer setters exist on Coffer / Router / PorticoRegistry;
  the same pattern still needs adding to plinth / sigil / vigil / aqueduct /
  lantern / postern / rostrum / adapters before the Safe handoff (`human_left.md`).
- `praetor-cli` produces the real Safe payloads.

Minimum for the hackathon: rotate the key + transfer the contracts that already
have setters, and state the rest honestly as the documented Year-2 step (the
one-pager already does).

---

## 4. VERIFY CONTRACTS ON ARBISCAN (judges check the explorer)

Verify the deployed (post-cutover) contract source on Arbiscan / Sourcify so
judges see green "Verified" + readable source. Needs an Arbiscan API key in
`.env` (`forge verify-contract` / Sourcify for the Solidity set; Stylus verify
via cargo-stylus). ~30 min once the cutover addresses are live.

---

## 5. OPPORTUNITY — Robinhood Chain (a second reserved prize lane)

**1 of 3 overall prizes is reserved for Robinhood Chain**; 1 of 3 for Arbitrum
(you have that). If the Robinhood Chain testnet + SDK is reachable now, even a
minimal Atrium deploy there opens a second reserved lane. Worth 10 minutes to
check whether the SDK shipped (the PRD assumed "when the SDK ships").

---

## Optional / non-blocking polish (an agent can do these; low demo impact)

These are real HIGH/MEDIUM items from `map.md` that do NOT touch the core demo
money paths. Deliberately not changed right before submission to avoid
regressions; pick them up if there is time:

- Rostrum duplicate-follow dedup + `mirrorOpen` Plinth-auth (copy-trading feature).
- Notifier: deliver system-wide alerts that have no `user` field (e.g. usdc_paused).
- Dockerfiles (`agents`, `stylus`) run as root — add a non-root `USER` (agents
  also ship via Vercel, so not deploy-blocking).
- Subgraph `CohortPartner` has no writer (Cohort surfaces render empty, honestly).
- The other 7 venue adapters are dormant; activating them needs each venue's
  peer constructor args (not in the repo) + a redeploy + timelock registration.

---

## What you do NOT need to worry about

- All 18 audited criticals — fixed, tested, committed.
- Fake/placeholder numbers shown as real — gone (honest `0`/`pending` everywhere).
- The core contracts (SPAN margin, ERC-4626 vault, dual-oracle, EIP-712 mandates,
  replay guard, re-credit on close) — sound and tested.
- The frontend money paths — fixed at the code layer; they go live on the
  verify-app redeploy after the cutover.
