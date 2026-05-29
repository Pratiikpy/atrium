# Doppler — Atrium secrets management

Doppler replaces all `.env` files. Every secret is injected at runtime via `doppler run --`.

## Project structure

| Project | Environment |
|---------|-------------|
| `atrium-dev` | Local development + feature branches |
| `atrium-staging` | Staging (Vercel preview, GHA CI) |
| `atrium-prod` | Production (Vercel production, DO daemons) |

## Configs per project

Each project has 8 configs:

| Config | Service | Notes |
|--------|---------|-------|
| `verify-app` | Next.js frontend (apps/verify) | NEXT_PUBLIC_* vars + server-side secrets |
| `notifier` | Notification daemon (services/notifier) | KV tokens, subgraph URL, internal key |
| `vigil-keeper` | Liquidation keeper (services/vigil-keeper) | Deployer/keeper key, RPC |
| `lantern-attestor` | Proof-of-reserves cron (services/lantern-attestor) | Signing key passphrase, RPC |
| `tablet` | Portfolio API (services/tablet) | DB URL, RPC |
| `codex` | x402-payable API (services/codex) | HMAC key, x402 creds, Redis, DB |
| `agents` | Reference agents (agents/) | Instrument IDs, RPC, session keys |
| `praetor-cli` | Deploy + ops CLI (services/praetor-cli) | Deployer key, multisig addr, RPC |

## Usage

```bash
# Local dev — run any service with secrets injected
doppler run --project atrium-dev --config verify-app -- pnpm dev

# CI — single DOPPLER_TOKEN repo secret, config selected per job
doppler run -- make test
```

## Adding a new secret

1. Add placeholder to `.env.example` with a comment explaining purpose.
2. Add real value to the appropriate Doppler config(s).
3. Update `ops/doppler/secrets-inventory.md`.
4. Never commit real values to any tracked file.
