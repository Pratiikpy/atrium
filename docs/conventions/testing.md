# Testing rules

## Pyramid

From the floor up. Every layer must be green before a feature ships.

1. **Unit** — Rust `#[test]` for contract pure functions. Foundry `forge test` for Solidity helpers.
2. **Property** — `proptest` for state machines (ERC-4626 monotonicity, copy trade math).
3. **Formal** — Kani `#[kani::proof]` on pure margin math and Sigil validation. See TDD §14.2.
4. **Integration** — Foundry on Sepolia fork. Stylus contracts via `stylus_sdk::testing::TestVM`.
5. **End to end** — Playwright against deployed Sepolia. Five user journeys from TDD §9.
6. **Demo rehearsal** — Ten dress runs with random fault injection by F3 before judge day.

A feature is not done until every relevant layer passes.

## Formal verification

Kani is the Rust verifier. Halmos does not work on Stylus per its own README. See PRD §28.1 patch 1.

Required Kani proofs (per TDD §14.2):

- Solvency: `collateral >= sum(required_initial_margin)` when account marked healthy
- Oracle freshness: `now <= last_publish_time + freshness_seconds`
- Mandate expiry: `now <= intent.expires_at && action.intent_hash == hash(intent)`

Two more invariants run as `proptest` because they need contract state:

- ERC-4626 share monotonicity (Coffer)
- No reentrancy on `Plinth.update_margin`

CI badge in README must reflect the real state. Do not show green when a proof is in development.

## Foundry conventions

- One contract per file. Match the source layout.
- Use `vm.warp`, `vm.roll`, `vm.prank` for time, block, and caller.
- Test names read as sentences: `test_open_position_reverts_when_oracle_stale`.
- Negative tests cover every named error in the contract.
- Each public function has a fuzz test with at least 256 runs.

## Stylus test conventions

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::testing::*;
    // Verify the exact API in stylus-sdk-rs/0.6+ before relying on this pattern.
    // OPEN question carried over from TDD §24.3.
}
```

If `TestVM` API changes, raise an ADR before working around it.

## Integration scenarios that must exist

| Scenario | What it covers |
|---|---|
| Deposit then withdraw round trip | Coffer accounting |
| Open hedged position, recompute margin | Plinth net margin math |
| Trigger liquidation, run keeper, partial close | Vigil end to end |
| Oracle drift, Pyth and Chainlink disagree | Plinth pause path |
| CCIP send, receive on dest, settle | Aqueduct happy path |
| CCIP expired, claim back on source | Aqueduct failure path |
| Sigil mandate issued, agent acts, owner revokes | Sigil lifecycle |
| Postern Kill Switch revokes everything in one tx | Postern emergency path |
| Cohort partner deposits, dashboard updates | Scribe to UI live read |
| Backtest published on chain, UI shows real number | ResearchAttestation honesty |

## End to end on Sepolia

Playwright nightly job runs five journeys from TDD §9. Failures alert F2 on Discord webhook.

Each E2E test:

- Connects a funded test wallet via Postern passkey
- Walks the journey on real Sepolia
- Asserts on Arbiscan tx receipt, not just UI text
- Cleans up state at the end so the next run starts fresh

Tests must work on a clean clone. `make demo` script wires this up in ≤ 90 seconds.

## Demo rehearsal log

Per PRD §26.2. F3 runs ten dry runs of the 5-minute judge pitch with random fault injection (oracle drift, keeper offline, wifi drop, etc.). Each rehearsal records:

- Date, run number
- Fault injected
- Recovery time
- Observed issues
- Was the 6 minute budget met

Acceptance: at least 9 of 10 finish under 6 minutes with no judge facing surprise.

## What counts as a passing test

- Returns 0 from CI
- Does not skip with `#[ignore]` without a written reason and an issue link
- Does not silently catch a panic to make the run green
- Asserts on real return values, not just absence of revert

## What does not count as testing

- Manual console.log of an output
- A screenshot of a UI without an assertion
- "It works on my machine"
- Mocked dependencies that paper over a real failure mode

## When the test fails

- Reproduce locally first
- Capture the seed if it is fuzz or property
- File the failure under `/incidents/` if it is post deploy
- Fix the root cause, not the symptom
- Add a regression test that would catch the same failure next time

## Coverage targets

| Surface | Target |
|---|---|
| Stylus contract pure functions | ≥ 90% line coverage |
| Solidity contracts | ≥ 85% line coverage |
| Off chain services (Codex, Lantern, Augur) | ≥ 70% line coverage |
| Frontend critical paths | All 5 journeys in §9 covered by E2E |

Coverage is a floor, not a ceiling. Coverage cannot replace meaningful assertions.

## Demo day specific

The Kani CI badge, the Verifier Mode flows, and the three reference agents must all be green on submission day. Any one of these red is a hard stop. Pull the deploy and fix before submitting.
