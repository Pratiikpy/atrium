# Plinth

SPAN-style portfolio margin engine. Stylus contract (Rust → WASM) on Arbitrum.

## What it does

Computes required margin for an account given all its open positions across multiple onchain venues. Nets correlated positions per SPAN-style scenario matrix.

Headline:

> A hedged position that posts $2M of collateral on isolated venue margin posts ~$900K under Plinth.

## Why Stylus

The SPAN scenario matrix is a triple-nested loop over (scenarios × correlation classes × positions). Per Arbitrum's published Stylus benchmarks (`resources/arbitrum-docs/docs/stylus/concepts/gas-metering.mdx`), compute-heavy loops are 10–100× cheaper on Stylus than Solidity. SPAN matrix lands near the high end of that range.

## Public ABI

| Function | Purpose | Caller |
|---|---|---|
| `initialize(...)` | One-shot wiring | Deployer (Praetor) |
| `open_position(venue, instrument, notional, action_sigil, intent_sigil)` | Open a position; recomputes margin | User, registered adapter, agent via Sigil |
| `close_position(position_id)` | Close a position; recomputes margin | Owner or Vigil |
| `update_margin(user)` | Recompute margin; queues Vigil if shortfall | Owner, adapter, keeper, Praetor |
| `get_account(user)` | Read snapshot (collateral, required, version, paused) | Anyone |
| `get_position(id)` | Read a position | Anyone |
| `get_user_positions(user)` | Position ids for a user | Anyone |
| `get_margin_version(user)` | Version nonce for Vigil race-fix | Anyone |
| `set_instrument_risk(...)` | Configure a tradeable instrument | Praetor only |
| `pause(reason) / resume()` | Emergency stop | Praetor only |

## Storage layout

ERC-7201 namespaced. See `src/lib.rs` `sol_storage!` block.

Critical fields per account:

- `collateral_value_wei`, read from Coffer
- `required_margin_wei`, computed by SPAN
- `margin_version`, monotonic nonce, prevents Vigil race
- `is_paused`, set on under-collateralization

## Invariants (Kani + proptest)

1. **Solvency**, `required_margin` is non-negative (constructed from U256)
2. **Oracle freshness**, `block_timestamp - last_publish_time <= freshness_seconds`
3. **Mandate expiry**, `block_timestamp <= intent.expires_at` (proven in Sigil)
4. **Monotonic notional**, doubling a position's size cannot decrease required margin
5. **No reentrancy**, `is_updating` guard around every state mutation

Run proofs:

```bash
cargo kani --workspace
```

## Gas budgets

Targets (to be measured + published on `loadtest.atrium.fi`):

| Operation | Target gas | Status |
|---|---|---|
| `open_position` (1 new, account has 5 existing) | ≤ 120K | Measured Wave-1 |
| `update_margin` (10 positions, 7 scenarios) | ≤ 80K | Measured Wave-1 |
| `close_position` | ≤ 90K | Measured Wave-1 |
| `get_account` (view) | ≤ 25K | Measured Wave-1 |

If any target misses by >2× after Stylus optimization, raise an ADR before shipping.

## Dependencies

| Dep | Crate | Why |
|---|---|---|
| Stylus SDK | `stylus-sdk = "0.6"` | Host calls, storage macros |
| Alloy primitives | `alloy-primitives = "0.8"` | Address, U256, I256, FixedBytes |
| Alloy sol-types | `alloy-sol-types = "0.8"` | Event + error macros |
| OZ Stylus (Coffer side) | `openzeppelin-stylus = "0.2"` | Coffer's ERC-4626 base |

## Build

```bash
cargo stylus check       # validates the contract is Stylus-deployable
cargo stylus deploy --network arbitrum-sepolia --private-key $DEPLOYER_PRIVATE_KEY
```

## Open questions (carried from TDD §24.3)

- Stylus `TestVM` API exact shape, verified Wave -1, may require harness adjustments
- SPAN scenario count, currently 7. May expand to 11 after Archive backtest tuning
- Diversification credit between correlation classes, none in v1, planned for v2

## Files

```
plinth/
├── Cargo.toml
├── README.md (this)
└── src/
    ├── lib.rs          # ABI, storage, control flow
    ├── math.rs         # Pure math (median, normalize, PnL) + Kani proofs
    ├── span.rs         # SPAN scenario matrix + Kani proofs
    └── tests.rs        # Integration tests via TestVM
```
