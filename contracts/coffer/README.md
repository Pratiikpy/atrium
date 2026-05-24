# Coffer

Unified USDC collateral vault. ERC-4626 tokenized shares. Stylus contract.

## What it does

- Users deposit USDC, get Coffer shares (1:1 on first deposit, ratio after)
- Plinth reads balances for margin computation
- Plinth marks accounts paused → Coffer blocks withdrawals until pause lifts
- Adapters can `adapter_pull` USDC for venue positions, capped per-block per-adapter
- Circuit-breaker auto-pauses on 30% TVL drop in 1h
- USDC.paused() is checked on every deposit (M7 fix)

## Built on

`resources/rust-contracts-stylus/contracts/src/token/erc20/extensions/erc4626.rs` — OpenZeppelin Rust ERC-4626. We embed the storage directly rather than inherit to control the haircut hook and the adapter-pull surface.

## Key safety properties

| Property | Mechanism |
|---|---|
| User cannot withdraw during pending liquidation | Plinth.get_account check |
| Adapter cannot drain more than its budget | per-adapter per-block cap (default $1M wei/block) |
| Catastrophic TVL drop triggers pause | hourly snapshot + 30bps threshold |
| Underlying USDC pause halts deposits | IUsdc.paused() check on every deposit |
| Shares are 1:1 on first deposit (no inflation attack) | total_supply.is_zero() → assets returned |
| Total supply monotonic except via withdraw/redeem | enforced; proptest invariant |

## Adapter approval

```rust
coffer.set_adapter(adapter_address, approved: true, per_block_cap_wei: 1_000_000_000_000); // $1M wei
```

Praetor-only. 48h timelock applies via PraetorTimelock.

## Caps (initial values per TDD §10.2)

- `deposit_cap_wei` — global TVL ceiling, $50M USDC equivalent (testnet)
- `per_user_cap_wei` — $5M per user (testnet)
- `adapter_budgets[].per_block_cap_wei` — $1M wei per block per adapter
- `tvl_drop_threshold_bps` — 3000 (30%)

## Files

```
coffer/
├── Cargo.toml
├── README.md
└── src/
    └── lib.rs       # ABI, storage, deposit/withdraw, adapter_pull, circuit breakers
```
