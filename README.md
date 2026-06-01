# Atrium

Cross-venue portfolio margin for the EVM. One wallet posts collateral once and trades across multiple onchain venues with a single margin number.

Deployed on **Arbitrum Sepolia** and **Robinhood Chain** testnets. The Stylus (Rust) contracts compile and activate natively on both; addresses in [`docs/deployment.md`](./docs/deployment.md) (Sepolia) and [`deployments/robinhood_chain.json`](./deployments/robinhood_chain.json) (Robinhood Chain).

**[Run the live demo at verify.atrium.fi →](https://verify.atrium.fi)**

## Why it matters

A hedged trader opens a $3M perp on one venue and holds $500K of T-bills as collateral on another. To stay hedged today they post margin twice — isolated margin needs about $2M total. Atrium nets the hedge under one SPAN-style margin calculation: same risk, about $900K, roughly 55% of the collateral freed. No venue cross-margins across other venues today; Atrium is the substrate that does.

## How it works

`Coffer` (ERC-4626 vault) holds collateral once. `Plinth` (SPAN margin engine) computes one portfolio margin number across venues, netting correlated exposure. `AtriumRouter` opens a position across margin → vault → venue adapter in a single tx. `Sigil` (EIP-712 mandates) + `Postern` (session keys) make AI agents first-class users, with a one-click Kill Switch that revokes every delegation in one batched tx. `Lantern` publishes an hourly proof-of-reserves Merkle root any user can verify. The compute-heavy core (Plinth, Vigil, Coffer, Sigil) is written in **Arbitrum Stylus (Rust)**; adapters and CCIP are Solidity.

## Quick start

```bash
git clone <repo-url> atrium
cd atrium
make demo            # full stack on Linux/macOS/WSL
# OR
make demo-frontend   # frontend only, works on Windows MSVC
```

`make demo` deploys the contracts to a local Arbitrum Sepolia fork, seeds test data, and opens Verifier Mode in your browser.

**Precondition:** Stylus contracts (`plinth`, `coffer`, `sigil`, `vigil`) need a linker that resolves Stylus WASM host symbols. Linux, macOS, and WSL work; Windows MSVC does not — use `make demo-frontend` on Windows to boot the Next.js dev server against the deployed Sepolia contracts.

## Docs

| Doc | What it answers |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | High-level system architecture and security model. |
| [`docs/deployment.md`](./docs/deployment.md) | Live URLs and deployed contract addresses. |
| [`docs/development.md`](./docs/development.md) | Local development setup + cloned reference repos. |
| [`docs/resources.md`](./docs/resources.md) | The reference repos under `resources/` and what each is for. |
| [`docs/conventions/`](./docs/conventions/) | Project coding + writing conventions (security, testing, UI, writing, git). |
| [`audits/`](./audits/) | Code audit reports. |
| [`incidents/`](./incidents/) | Incident post-mortems. |
| [`runbooks/`](./runbooks/) | Operational runbooks for each service. |

## Repo layout

```
atrium/
├── apps/                      # Frontends
│   └── verify/                # Verifier Mode (Next.js)
├── contracts/                 # Smart contracts
│   ├── plinth/                # SPAN margin engine (Stylus)
│   ├── vigil/                 # Liquidation engine (Stylus)
│   ├── coffer/                # ERC-4626 vault (Stylus)
│   ├── sigil/                 # Agent mandate contract (Stylus)
│   ├── aqueduct/              # Cross-chain CCIP (Solidity)
│   ├── postern-kill-switch/   # Account-abstraction emergency revoke (Solidity)
│   ├── portico-registry/      # Adapter whitelist (Solidity)
│   ├── research-attestation/  # Backtest commitments (Solidity)
│   ├── edict/                 # Jurisdiction tiers (Solidity)
│   ├── praetor-timelock/      # Multisig + 48h timelock (Solidity)
│   └── adapters/              # Per-venue Portico adapters
├── agents/                    # Reference agents
│   ├── augur/                 # Mean-reversion
│   ├── haruspex/              # Momentum
│   └── auspex/                # Basis-trade
├── services/                  # Off-chain
│   ├── codex/                 # x402-payable API
│   ├── lantern-attestor/      # Proof-of-reserves cron
│   ├── notifier/              # Alert delivery
│   ├── vigil-keeper/          # Liquidation execution
│   └── praetor-cli/           # Deploy + ops CLI
├── subgraph/                  # The Graph indexer (Scribe)
├── tests/                     # Cross-package integration tests
├── runbooks/                  # Ops procedures
├── incidents/                 # Post-mortems
├── docs/                      # Architecture, deployment, conventions
├── audits/                    # Code audit reports
└── resources/                 # Cloned reference repos (see docs/resources.md)
```

## Status

Contracts and core services build green on `master`. The verify-app is deployed to Arbitrum Sepolia at [verify.atrium.fi](https://verify.atrium.fi). Live contract addresses are in [`docs/deployment.md`](./docs/deployment.md). Audit history lives under [`audits/`](./audits/); incident post-mortems under [`incidents/`](./incidents/).

## Build commands

```bash
make demo          # Full local stack
make contracts     # Build all Stylus + Solidity contracts
make test          # Run all test suites
make kani          # Run Kani formal verification proofs
make subgraph      # Build + deploy subgraph
make frontend      # Build Next.js apps
make deploy        # Deploy to Sepolia via Praetor CLI (multisig required)
make audit         # Run static analysis + linters
make clean         # Remove all build artifacts
```

## License

MIT for Atrium code — see [`LICENSE`](./LICENSE). Dependencies under `resources/` carry their own licenses (GPL-3.0 for EntryPoint, BUSL for Aave V3, etc.) — integration only, no forking.

## Security

See [`SECURITY.md`](./SECURITY.md). Disclose vulnerabilities to `security@atrium.fi` with PGP encryption when handling sensitive payloads.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Grants are available for accepted `IPorticoAdapter` v1.0 implementations and reference agents.
