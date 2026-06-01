# Secrets inventory, Doppler config mapping

Every env var used across the project, organized by Doppler config.

Source files walked: `.env.example` (root), `agents/.env.example`.
No per-service `.env.example` files exist yet, services inherit from root.

---

## verify-app

| Variable | Purpose | Source |
|----------|---------|--------|
| `ARBITRUM_SEPOLIA_RPC_URL` | RPC endpoint for contract reads | root .env.example |
| `ARBITRUM_SEPOLIA_RPC` | Alias (no _URL suffix) for verify-app runtime | root .env.example |
| `NEXT_PUBLIC_USDC_ADDRESS` | Testnet USDC contract address (browser-side) | root .env.example |
| `SENTRY_DSN` | Sentry error tracking (server-side, via instrumentation.ts) | Vercel env |
| `ATRIUM_INTERNAL_KEY` | Bearer token for notifier → prefs API handshake | root .env.example |
| `SUMSUB_WEBHOOK_SECRET` | KYC webhook signature verification | root .env.example |
| `EDICT_CONTRACT_ADDR` | Edict contract for tier assignment on KYC pass | root .env.example |
| `CHAOS_PRIVATE_KEY` | Chaos drill EOA (Verifier Mode step 4) | root .env.example |
| `CHAOS_DEMO_KEEPER` | Demo keeper address for keeper_offline fault | root .env.example |
| `DEMO_WALLET_ADDRESS` | Default demo wallet for anonymous portfolio views | root .env.example |
| `PRAETOR_MULTISIG_ADDRESS` | Multisig address for admin displays | root .env.example |
| `PRAETOR_MULTISIG_KEY` | Signing key for direct praetor txs | root .env.example |
| `UPSTASH_REDIS_REST_URL` | Redis for x402 replay dedup (Vercel deploy) | root .env.example |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token | root .env.example |

## notifier

| Variable | Purpose | Source |
|----------|---------|--------|
| `ARBITRUM_SEPOLIA_RPC` | RPC for event polling | root .env.example |
| `ATRIUM_INTERNAL_KEY` | Bearer for prefs API calls | root .env.example |
| `NOTIFIER_INTERNAL_KEY` | Alias used in GHA workflow | root .env.example |
| `ATRIUM_KV_REST_URL` | Vercel KV for last-block cursor | root .env.example |
| `ATRIUM_KV_REST_TOKEN` | KV auth token | root .env.example |
| `NOTIFIER_FROM_BLOCK` | Starting block for event scan | root .env.example |
| `SCRIBE_URL` | Subgraph URL for alert queries | root .env.example |
| `PREFS_API_URL` | Prefs API endpoint | root .env.example |

## vigil-keeper

| Variable | Purpose | Source |
|----------|---------|--------|
| `ARBITRUM_SEPOLIA_RPC_URL` | RPC for liquidation monitoring | root .env.example |
| `DEPLOYER_PRIVATE_KEY` | Keeper signing key (rotate to dedicated EOA) | root .env.example |

## lantern-attestor

| Variable | Purpose | Source |
|----------|---------|--------|
| `ARBITRUM_SEPOLIA_RPC_URL` | RPC for balance reads | root .env.example |
| `LANTERN_KEY_PATH` | Path to encrypted signing key | root .env.example |
| `LANTERN_KEY_PASSPHRASE` | Passphrase for key decryption | root .env.example |

## tablet

| Variable | Purpose | Source |
|----------|---------|--------|
| `ARBITRUM_SEPOLIA_RPC_URL` | RPC for portfolio reads | root .env.example |
| `DATABASE_URL` | Postgres connection string | root .env.example |

## codex

| Variable | Purpose | Source |
|----------|---------|--------|
| `COINBASE_X402_API_URL` | x402 facilitator endpoint | root .env.example |
| `COINBASE_X402_API_KEY` | x402 API key | root .env.example |
| `CODEX_HMAC_KEY` | Response signing key | root .env.example |
| `CODEX_KEY_ID` | HMAC key version identifier | root .env.example |
| `CODEX_PAY_TO_ADDRESS` | Payment recipient (multisig, NOT deployer) | root .env.example |
| `CODEX_USDC_ADDRESS` | USDC contract for payment verification | root .env.example |
| `CODEX_MIN_PAYMENT_USDC_WEI` | Minimum payment threshold | root .env.example |
| `UPSTASH_REDIS_REST_URL` | Redis for replay dedup + idempotency | root .env.example |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token | root .env.example |
| `DATABASE_URL` | Postgres (alt deploy path) | root .env.example |

## agents

| Variable | Purpose | Source |
|----------|---------|--------|
| `CODEX_URL` | Codex API gateway URL | agents/.env.example |
| `HARUSPEX_INSTRUMENT_ID` | Instrument for Haruspex strategy | agents/.env.example |
| `AUSPEX_INSTRUMENT_ID` | Instrument for Auspex strategy | agents/.env.example |
| `ARBITRUM_SEPOLIA_RPC` | RPC override | agents/.env.example |
| `RUST_LOG` | Log level | agents/.env.example |
| `AGENT_AUGUR_ADDRESS` | Augur session-key EOA | root .env.example |
| `AGENT_HARUSPEX_ADDRESS` | Haruspex session-key EOA | root .env.example |
| `AGENT_AUSPEX_ADDRESS` | Auspex session-key EOA | root .env.example |
| `CRON_SECRET` | Vercel cron auth for agent ticks | root .env.example |

## praetor-cli

| Variable | Purpose | Source |
|----------|---------|--------|
| `DEPLOYER_PRIVATE_KEY` | Deployer EOA private key | root .env.example |
| `PRAETOR_MULTISIG_ADDRESS` | Gnosis Safe address | root .env.example |
| `PRAETOR_MULTISIG_KEY` | Multisig signer key | root .env.example |
| `ARBITRUM_SEPOLIA_RPC_URL` | RPC for deploy transactions | root .env.example |
| `ETHEREUM_SEPOLIA_RPC_URL` | RPC for cross-chain (Aqueduct) | root .env.example |
| `POLYGON_AMOY_RPC_URL` | RPC for Polygon Amoy | root .env.example |
| `ARBISCAN_API_KEY` | Contract verification | root .env.example |
| `GRAPH_STUDIO_DEPLOY_KEY` | Subgraph deployment | root .env.example |
| `FLY_API_TOKEN` | Fly.io deployment (if used) | root .env.example |
| `PIMLICO_API_KEY` | Bundler for account abstraction | root .env.example |
| `PIMLICO_RPC_URL` | Bundler RPC | root .env.example |

---

## Cross-cutting secrets (shared across multiple configs)

| Variable | Configs | Notes |
|----------|---------|-------|
| `ARBITRUM_SEPOLIA_RPC_URL` | All | Public node OK for testnet; paid Alchemy/Infura for prod |
| `DEPLOYER_PRIVATE_KEY` | vigil-keeper, praetor-cli | **Must rotate** per incident #25. New EOA in `atrium-prod` only. |
| `UPSTASH_REDIS_REST_*` | verify-app, codex | Same Redis instance, same tokens |
| `PRAETOR_MULTISIG_*` | verify-app, praetor-cli | Same Safe address + signer |
