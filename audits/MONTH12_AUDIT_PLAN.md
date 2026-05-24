# Month-12 Parallel Sub-Agent Audit Plan

**When:** Day 331–365 (per `ATRIUM_12_MONTH_ROADMAP.md`).
**Trigger:** all Phase-1 + conditional Phase-2 subsystems shipped, Code4rena contest closed, 10 demo rehearsals complete.
**Goal:** independent multi-agent review across all 18 subsystems before testnet launch.

---

## Why parallel sub-agents

Single-thread review by the founders has known blindspots: the code-coverage sweep methodology (Waves SSSS–EEEEE) found 10 NEW bugs that 8 prior audit waves missed. Independent agents reading the same code with different lenses keep finding what the prior pass missed. The sub-agent audit is the last line of defense before users see this.

## Subsystem matrix

| # | Subsystem | Sub-agent type | Audit brief |
|---|---|---|---|
| 1 | Plinth | `code-reviewer` | SPAN math correctness; Stylus storage layout; gas budget vs TDD §G2 |
| 2 | Vigil | `code-reviewer` | Liquidation queue ordering; NMS adherence; keeper-slash flow |
| 3 | Stoa (if shipped) | `code-reviewer` | Black-Scholes Greeks; conditional on Trailblazer-AI grant |
| 4 | Portico framework + 7 adapters | `code-reviewer` | IPorticoAdapter v1.0 spec compliance; per-adapter venue handling |
| 5 | Aqueduct + Receiver + Claimback | `security-reviewer` | CCIP integration; double-spend defense; replay protection; GGG-1/2 + DDDD-1 + CCCC-1 lock-in |
| 6 | Sigil | `code-reviewer` | EIP-712 schema correctness; record_close decrement (HHH-4); G-8 cross-chain replay |
| 7 | Postern (KillSwitch + KeyRegistry) | `security-reviewer` | Session-key lifecycle; kill-switch resilience (MMM-6); zero-deps (MMM-10) |
| 8 | Rostrum | `code-reviewer` | Copy-trade math; reentrancy guard (DDD-4); reputation cache; deboost flow |
| 9 | Coffer | `security-reviewer` | ERC-4626 invariants; adapter-pull authz (KKK-3); pause-bypass coverage |
| 10 | Edict | `code-reviewer` | Tier ladder; Sumsub callback; jurisdictional gating |
| 11 | LanternAttestor + ResearchAttestation | `code-reviewer` | Merkle proof verifier; backtest commitment; BBBBB-1 zero-checks |
| 12 | PraetorTimelock | `security-reviewer` | Schedule/execute/cancel; LLL-4 + LLL-5 EOA-target rejection |
| 13 | PorticoRegistry | `code-reviewer` | Bytecode-hash pinning; venue lifecycle (re-register flow) |
| 14 | AtriumRouter | `security-reviewer` | Plinth → Coffer → Adapter chain; orchestrator authz (EEEE-1) |
| 15 | Curator | `code-reviewer` | Grant lifecycle; transfer-fail rollback; F-32 timelock-gated funding |
| 16 | Codex | `code-reviewer` | x402 payment middleware; HMAC signing; 10 endpoints; BBBB-5 lock-in |
| 17 | Scribe (subgraph) | `code-reviewer` | Schema completeness; handler coverage; PosternKeyEvent (KKKK-1) |
| 18 | Archive | `code-reviewer` | Backtest reproducibility; seed pinning |
| 19 | Tablet | `code-reviewer` | UK CGT (HMRC HS284); US Form 8949; DE FIFO — vs reference portfolio |
| 20 | Praetor CLI | `code-reviewer` | All commands wired; cast-calldata format; deploy waves |
| 21 | apps/verify | `code-reviewer` | Design parity vs `desing/`; a11y; mobile; copy follows `writing.md` |
| 22 | e2e | `e2e-runner` | All 5 PRD §9 user journeys on deployed Sepolia |

22 audits total (the 18 PRD subsystems + AtriumRouter + Curator added Year-1 + Praetor CLI as separate area + apps/verify as the demo surface + e2e as a cross-cutting reviewer).

## Launch protocol

```bash
# From repo root, after Day 330 freeze:
make audits-prepare    # Bundles the latest source, tests, deploy addresses
                       # into ./audits/month12-input/ for the agents to read.

# Then launch in parallel via the Agent tool (single message, 22 tool uses).
# Each agent gets:
#   - The audit brief above
#   - Read access to ./audits/month12-input/
#   - Output destination: ./audits/month12-output/<subsystem>.md
#   - "Report only HIGH and MEDIUM-severity findings. Don't repeat the prior
#      audit register; surface NEW issues. If clean, write 'No new findings.'"

# Day-360 rollup: read all 22 outputs, dedupe, severity-rank, file as
# `incidents/month12-rollup.md`. Fix wave runs Day 360–365.
```

## Sub-agent guardrails

To prevent the agents from drifting into "I'm going to redesign Plinth":

1. **Read-only.** Agents must NOT write to repo source. Findings go to `audits/month12-output/`.
2. **Scope-fenced.** Each agent reviews ONE subsystem. Cross-cutting concerns (e.g. "Coffer's adapter_pull issue affects Plinth's solvency proof") go in a separate `audits/month12-output/_cross-cutting.md`.
3. **Honest empty result.** If the subsystem is clean, the report says so. Don't invent findings.
4. **Severity bar.** HIGH = ship-blocker; MEDIUM = fix-before-launch; LOW = file for Year-2.
5. **Reference the audit register.** If a finding rediscovers a known closure (e.g. JJJ-9), the agent must cite the existing fix and explain why their finding is distinct (or admit the finding is dup).

## Rollup → fix wave

Day 360 morning: read all 22 outputs. Group by:

| Severity | Action |
|---|---|
| HIGH (ship-blocker) | Fix Day 360–362 |
| MEDIUM (fix-before-launch) | Fix Day 363–364 |
| LOW (file Year-2) | Append to `human_left.md` with severity tag |

Day 365: re-run `make test` + `make kani`. If green, ship the testnet launch announcement.

## Trip-wire

If HIGH findings exceed 5 across the 22 audits, **the launch slides 14 days**. PRD §26.3 format applies. Honest announcement same day.

---

**This plan is locked at Month 12. The audit launches are the single most expensive operation of Year-1 — they're worth doing right.**
