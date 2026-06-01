# Sentry Grouping Rules, Atrium

Phase 12 config-as-code reference for Sentry issue grouping.

## Custom Fingerprint Rules

Add these in **Sentry → Settings → Projects → atrium-verify → Issue Grouping → Fingerprint Rules**:

```
# Group all RPC timeout errors together regardless of provider URL
error.type:FetchError message:"timeout*" -> rpc-timeout

# Group wallet connection errors
error.type:ConnectorNotFoundError -> wallet-connector-missing

# Group subgraph query failures
message:"subgraph*" -> subgraph-query-failure

# Group SIWE verification failures
path:"/api/auth/verify" -> siwe-verify-failure

# Group rate-limit responses
status:429 -> rate-limited
```

## Stack Trace Rules

Add in **Settings → Issue Grouping → Stack Trace Rules**:

```
# Ignore frames from wallet libraries (noisy, not actionable)
family:javascript package:@walletconnect/** -group
family:javascript package:@reown/** -group

# Ignore Next.js internals
family:javascript package:next/** -group
```

## Tags for Filtering

Phase 12 adds these custom tags automatically:
- `chain_id`, The chain ID (421614 for Arbitrum Sepolia)
- `wallet_truncated_first_4`, First 6 chars of connected wallet (e.g., `0x1a2b`)
- `route_kind`, `browser` or `server`

## Maintenance

Review grouping rules monthly. If a new class of error emerges that creates >10 duplicate issues, add a fingerprint rule.
