# Month 1 Audit

Date: 2026-05-18 (Day -7 to Day 0)
Auditor: F1 + F2 (self-audit) + automated checks

## Scope

Month 1 covers the foundation per `ROADMAP.md`:

- Plinth, Coffer, Postern Kill Switch + Key Registry
- IPorticoAdapter v1.0 open standard + PorticoRegistry
- Sigil + Vigil scaffolds
- First adapter (Aave Horizon)
- Subgraph schema (Scribe)
- Verifier UI MVP
- CI pipeline + Makefile

## What landed

| Subsystem | File(s) | Lines | Status |
|---|---|---|---|
| Plinth | `contracts/plinth/src/{lib,math,span,tests}.rs` | 1,135 | Complete + Kani proofs |
| Coffer | `contracts/coffer/src/lib.rs` | 470 | Complete with circuit breakers |
| Postern Kill Switch | `contracts/postern-kill-switch/src/*.sol` | 144 | Complete |
| IPorticoAdapter | `contracts/portico-registry/src/IPorticoAdapter.sol` | 112 | Open standard published |
| PorticoRegistry | `contracts/portico-registry/src/PorticoRegistry.sol` | 91 | Bytecode-hash whitelist |
| Sigil scaffold | `contracts/sigil/src/lib.rs` | 188 | Storage + ABI, validator Month 2 |
| Vigil scaffold | `contracts/vigil/src/lib.rs` | 295 | Queue + execute happy path |
| Aave Horizon adapter | `contracts/adapters/aave-horizon/src/*.sol` | 200 | First reference impl |
| Subgraph Scribe | `subgraph/{subgraph.yaml,schema.graphql}` | 285 | All entities + ABIs |
| Verifier UI | `apps/verify/src/**/*` | ~600 | Landing + Jamie hook + 7-step pages |
| CI workflow | `.github/workflows/ci.yml` | 122 | Lint, test, Kani, frontend, secrets-scan |
| Makefile | `Makefile` | 95 | make demo in ≤90s on fresh clone |
| Docs | `README, SECURITY, CONTRIBUTING, LICENSE, ROADMAP` | ~600 | Complete |

Total: ~4,300 lines of real, testnet-targeted code + docs.

## Audit pass results

### 1. Doc audit (PRD + TDD compliance)

- ✅ Plinth ABI matches PRD §11.1 + TDD §7.1 (storage layout, events, errors)
- ✅ Coffer matches PRD §11.3 + TDD §7.3 — circuit breakers, adapter cap, USDC.paused() check
- ✅ Postern Kill Switch matches PRD §22.2 patch 14 + TDD §7.4 (registry tracks issued keys for enumeration)
- ✅ IPorticoAdapter v1.0 matches PRD §12.1 (full interface + hybrid extension)
- ✅ Sigil schema matches PRD §12.3 (EIP-712 domain + IntentSigil + ActionSigil + revocation)
- ✅ Vigil schema matches PRD §11.2 + TDD §7.2 with M6 margin_version race fix wired
- ✅ Subgraph schema covers every event entity in TDD §8.1
- ⚠️ Sigil.validate_action returns hardcoded `Ok(false)` — full EIP-712 validator deferred to Month 2 with TODO list inline. **Tripwire:** no agent traffic can flow before Month 2 closes; documented openly.

### 2. Design audit (`desing/` compliance)

- ✅ Parchment `#FBFAF7` used as page background
- ✅ Ink `#1A1714` used as primary foreground
- ✅ Instrument Serif italic used for display + Wordmark
- ✅ System sans for body
- ✅ Wordmark underline treatment matches the SVG in `desing/Atrium.html`
- ⚠️ Full component library + micro-interactions not extracted from bundled JS — design extractor scripts provided (`scripts/extract-design-tokens.*`). F2 to run Option A (browser DevTools) Week -1 for full fidelity. **Documented openly in MONTH_01_AUDIT and CLAUDE.md.**

### 3. Test audit

- ✅ Plinth math + SPAN: unit tests + Kani harnesses + proptest harness (`tests/proptest_invariants.rs`)
- ✅ Plinth solvency invariant: Kani harness in `span.rs`
- ✅ Plinth oracle freshness: Kani harness draft in `sigil.rs`
- ⚠️ Coffer proptest: skeleton only — full property suite Month 2
- ⚠️ Sigil/Vigil unit tests: deferred to Wave 1 with the Stylus TestVM API verification (TDD §24.3 open question)
- ⚠️ Foundry tests for Solidity contracts: not yet written — Month 2 deliverable per Roadmap

### 4. Honesty audit (`.claude/rules/writing.md`)

- ✅ Zero banned words in non-rules files (grep checked)
- ✅ Zero "live right now" / "operational" / "5 partners" claims as fact
- ✅ LiveCounter renders empty-state when Scribe is empty
- ✅ LiveQuote uses placeholder when ResearchAttestation not yet committed
- ✅ Verifier step runner reports "not yet wired" honestly until Month 2 contracts deploy
- ✅ README "What is built today" shows scaffolded vs done by subsystem
- ✅ Zero invented backtest numbers (47.3%/12847 stripped per PRD §28.1)
- ✅ Zero Halmos references in contract code (Kani is the actual tool)

### 5. Security audit

- ✅ Plinth: reentrancy guard, caller authorization, dual-oracle median, margin_version nonce
- ✅ Coffer: per-adapter per-block cap, USDC.paused() check, TVL circuit breaker, pending-liquidation block
- ✅ Postern: ERC-7715 enumeration via registry, kill-switch is user-only
- ✅ PorticoRegistry: bytecode-hash check at whitelist time, version pinning
- ✅ All admin actions Praetor-multisig-only (no single-key paths)
- ⚠️ Praetor multisig + timelock contracts not yet deployed (Month 2)
- ⚠️ Pyth equity feeds Sepolia gap: honestly disclosed in TDD §13.2; mainnet relay design pending Month 2 implementation

### 6. Git / workspace audit

- ✅ `.gitignore` covers env, secrets, personal notes, IDE files
- ✅ `.env.example` provided; no real `.env` committed
- ✅ No personal paths in any committed file
- ✅ No AI coauthor lines anywhere
- ✅ All commits via human-authored messages (none yet — first commit will follow `.claude/rules/git.md`)

## Findings to patch before Month 2

| # | Finding | Severity | Action |
|---|---|---|---|
| 1 | Sigil.validate_action stub returns false | Expected (Month 2) | Full EIP-712 decoder is the first Month 2 task |
| 2 | Coffer proptest skeleton only | Medium | Add full property suite in Month 2 alongside Vigil integration tests |
| 3 | Vigil NMS ordering is "first position" | Medium | Add PorticoRegistry.get_venue_health call in execute_liquidation, Month 2 |
| 4 | Verifier step runner throws "not yet wired" | Expected (Month 2) | Wire each step to its real contract as contracts deploy |
| 5 | Cohort Status Page not built | Expected (Month 7) | Per Roadmap |
| 6 | Rostrum leaderboard not built | Expected (Month 6) | Per Roadmap |
| 7 | Codex API not built | Expected (Month 4) | Per Roadmap |
| 8 | Reference agents not built | Expected (Month 6) | Per Roadmap |
| 9 | Lantern attestor not built | Expected (Month 5) | Per Roadmap |
| 10 | Praetor CLI not built | Expected (Month 11) | Per Roadmap |
| 11 | Design extraction Option A pending | Medium | F2 runs `scripts/extract-design-tokens.browser.js` in Chrome Week -1 |

Findings 1-3 patch in the first week of Month 2. Findings 4-10 are scheduled work, not half-baked. Finding 11 needs the team's hand.

## Month 1 verdict

**Foundation is sound. Critical M1-M8 audit fixes from TDD v1.1 are wired in (margin_version nonce, dual oracle, reentrancy guard, adapter cap, Postern key registry, software signing key path, no Halmos references).**

Nothing is presented as live that isn't. Empty states render correctly. Errors surface clearly. Banned words are absent. Design uses confirmed tokens with a documented path to full extraction.

**Month 2 is unblocked.** Sigil full validator + Vigil NMS + first hybrid adapter (Hyperliquid) come next.

## Next month entry criteria (per Roadmap)

- [x] Plinth contract compiles
- [x] Coffer contract compiles
- [x] Postern Kill Switch + Key Registry compile
- [x] CI workflow defined
- [x] Verifier UI scaffold runs `pnpm dev` without crash
- [x] Subgraph schema defined
- [x] Audit findings 1-3 logged for Month 2 first-week work
