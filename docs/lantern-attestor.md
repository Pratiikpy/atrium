# Lantern Attestor — Share-Redemption-Aware Design

## Overview

The Lantern attestor publishes hourly Merkle roots attesting to each user's redeemable asset balance in the Coffer vault.

## Trust Model

| Source | Role | Trust Level |
|--------|------|-------------|
| Scribe (The Graph) | Provides user list (who has ever deposited) | Low — used only for enumeration |
| RPC (Arbitrum Sepolia) | Provides authoritative balance via `convertToAssets(balanceOf(user))` | High — on-chain state |
| Lantern signer | Signs the Merkle root before on-chain publish | Trusted operator key |

## Architecture (Phase 6)

```
Scribe ──[user list]──► Lantern ──[RPC multicall]──► Coffer contract
                            │                              │
                            │◄─── balanceOf(user) ─────────┘
                            │◄─── convertToAssets(shares) ──┘
                            │
                            ▼
                     buildTree(leaves)
                            │
                            ▼
                  publish(root, blockNumber, leafCount, ipfsCid, sig)
```

## Key Design Decisions

1. **Every leaf is RPC-sourced**: No Scribe balance data is used for leaf values. This eliminates indexing lag as a source of stale attestations.

2. **Batched multicall**: Users are processed in batches of 100, with 5 concurrent batches. This bounds RPC cost to ~50 multicalls per tick for 500 users.

3. **Share redemption awareness**: `convertToAssets(balanceOf(user))` accounts for vault share price accrual. A user's attestable balance grows as the vault earns yield, even without new deposits.

4. **Graceful degradation**: If a multicall batch fails, those users are skipped (logged). The attestation proceeds with available data rather than aborting entirely.

## Rate Limit Budget

- Arbitrum Sepolia public RPC: ~100 req/s
- Per tick (1000 users): ~20 multicall requests = 0.2s at 100 req/s
- Per tick (10000 users): ~200 multicall requests = 2s at 100 req/s
- Tick interval: 1 hour → well within budget
