# Code4rena submission pack — Atrium testnet contracts

**Purpose:** `human_left.md` #10 supplement. F3 submits this pack at `code4rena.com/start`. The sub-agent audit campaign (Fires 76–82) already surfaced 59 findings and closed 17/15 HIGH; this public listing is the belt-and-suspenders supplement that adds human reviewers with different blind spots.

**Reward pool:** $20K (from Open House London prize, if it lands per PRD §17). If the prize misses, scope down to a single-day spotlight contest.

---

## Scope

In scope (mainnet-bound code paths):

- `contracts/atrium-router/src/AtriumRouter.sol` — 200 lines, the orchestrator
- `contracts/curator/src/Curator.sol` — 200 lines
- `contracts/aqueduct/src/Aqueduct.sol` — 350 lines
- `contracts/aqueduct/src/AqueductReceiver.sol` — 200 lines
- `contracts/aqueduct/src/AqueductClaimback.sol` — 100 lines
- `contracts/portico-registry/src/PorticoRegistry.sol` — 150 lines
- `contracts/praetor-timelock/src/PraetorTimelock.sol` — 100 lines
- `contracts/postern-kill-switch/src/PosternKillSwitch.sol` — 150 lines
- `contracts/postern-kill-switch/src/PosternKeyRegistry.sol` — 100 lines
- `contracts/edict/src/Edict.sol` — 150 lines
- `contracts/rostrum/src/Rostrum.sol` — 280 lines
- `contracts/lantern-attestor/src/LanternAttestor.sol` — 80 lines
- `contracts/research-attestation/src/ResearchAttestation.sol` — 50 lines
- 7 adapters in `contracts/adapters/*/src/*.sol` — ~250 lines each

Out of scope:
- Stylus crates (`contracts/plinth`, `contracts/coffer`, `contracts/vigil`, `contracts/sigil`) — separate Kani+proptest run, included in repo for context
- Test files (`tests/foundry/*`) — context only
- Frontend, services, subgraph — separate audit scopes

**Total in-scope LOC:** ~3,500 lines of Solidity.

---

## Severity rubric

Use Code4rena's standard severity matrix:

- **HIGH:** loss of user funds, broken core invariant, governance bypass
- **MEDIUM:** loss of fees, weakened defense-in-depth, denial of service against subset
- **LOW:** gas griefing, missing event, comment clarity

**Important:** the sub-agent audit campaign already surfaced 59 findings. Report only NEW issues. If a finding rediscovers a known closure (FIRE76-* through FIRE78-*), cite the existing fix and explain why the finding is distinct (or admit dup).

---

## Pre-existing audit register

Public at `docs/AUDIT_FINDINGS.md`. Wardens MUST read this before submitting findings. The register documents every prior closure with file:line citations and `Audit FIRE##-ID fix` comments at the patch sites.

Known unfixed at the time of this listing:

| ID | Severity | Why open |
|---|---|---|
| FIRE76-4 (partial, Polymarket+HL EIP-712 typehash bind) | HIGH | Fixed Fire 80; off-chain validators still need to update signing payload |
| Stylus integration items | Various | Stylus-side code lives in `contracts/{plinth,coffer,vigil,sigil}` — audited by Kani+proptest separately |

---

## Audit-pattern lenses already swept

The audit register documents 8 systematic lenses applied:

1. SSSS lens — every audit closure needs an asserting test
2. `/*param*/` grep — mock-level drift in test fixtures
3. Audit-pattern by name — DDD-5, MMM-10, LLL-1, NNNN-1 constructor zero-checks
4. Event-emit completeness — every state-changing setter emits
5. Sibling-comparison — diff sister contracts to find drift
6. Reader-without-writer — every state read needs an explicit writer
7. Partial-coverage — every fix to one entry point needs the same fix on parallel entry points
8. Test-coverage-gap — every new behavior needs an asserting test, not "regression-stays-green"

Wardens are encouraged to identify a **9th lens** the campaign missed. Novel methodology bugs are explicitly in scope.

---

## Bounty allocation

Of the $20K pool:

- 70% → HIGH findings
- 25% → MEDIUM findings
- 5% → judges' QA + tooling improvements (e.g., a script that automates one of the lenses above)

Splits at Code4rena's standard allocation rules. We won't quibble.

---

## Contact during the contest

- **Sponsor address:** `sponsor@atrium.fi` (auto-routes to F3)
- **Discord channel:** `#atrium-c4r-contest` (created on listing day)
- **Office hours:** F1 + F2 + F3 each commit 2 hr/day during the contest window for warden Q&A

We answer:
- Architecture clarifications
- Stylus vs Solidity interface questions
- Sub-agent audit register questions

We don't answer:
- "Is this a bug?" — submit the finding and let judges decide
- Code review of work-in-progress
- Anything that would advantage one warden over others

---

## Post-contest

1. Triage every finding within 7 days of contest close
2. Public response: confirm / refute / "known via FIRE##" / "Year-2 scope"
3. Fix wave: HIGH within 14 days, MEDIUM within 30 days, LOW within 60
4. Regression tests pinned for every confirmed finding (SSSS lens)
5. Public post on `mirror.atrium.fi`: "Atrium Code4rena contest — N findings, M fixed"

The sub-agent campaign + this public contest is the dual coverage that gets us to mainnet-flip-ready in Year-2.
