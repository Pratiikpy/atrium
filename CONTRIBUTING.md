# Contributing to Atrium

Atrium is open by design. Anyone can build a Portico adapter, a reference agent, or improve the protocol.

## Two ways to contribute

### 1. Build an IPorticoAdapter

The adapter interface is in `contracts/portico-registry/src/IPorticoAdapter.sol`. MIT licensed.

To submit:

1. Implement `IPorticoAdapter v1.0` for your venue.
2. Pass the 6 conformance tests in `tests/adapter-conformance/`.
3. Open a PR with the adapter contract, tests, README, and a sample transaction trace.
4. Curator review (3 reviewers from 3 independent organizations) within 30 days.
5. On acceptance: $5K ARB grant and whitelisting on PorticoRegistry.

### 2. Build a reference agent

Reference agents use Sigil mandates and Postern session keys. Open-source under MIT.

To submit:

1. Implement your strategy in Rust under `agents/<your-agent-name>/`.
2. Use the agent template at `agents/template/`.
3. Run for 30 days on testnet with public Rostrum leaderboard entry.
4. Open a PR with code, README, and 30-day performance summary.
5. Curator review within 30 days.
6. On acceptance: $5K ARB grant.

Target: 3 community adapters by Day 180; 5 community agents by Day 180.

## Code standards

- Stylus (Rust) contracts follow patterns in `contracts/plinth/src/lib.rs`
- Solidity contracts use OpenZeppelin where possible (see `resources/openzeppelin-contracts/`)
- All public-facing copy follows `docs/conventions/writing.md`
- All UI follows `docs/conventions/ui.md` and the visual language in `desing/`
- All tests follow `docs/conventions/testing.md`

## Pull request flow

1. Fork the repo and create a feature branch (`feat/your-thing`)
2. Write tests first. Kani proof if you can prove an invariant, proptest if state-dependent.
3. Implement until tests pass.
4. Run `make lint test kani` locally.
5. Open the PR with template `.github/PULL_REQUEST_TEMPLATE.md`.
6. CI must be green. At least one code review.
7. Squash merge to main.

## No AI coauthor lines

Never add `Co-authored-by: Claude` or similar to commits. See `docs/conventions/git.md`.

## License

By contributing you agree your contribution is licensed MIT.
