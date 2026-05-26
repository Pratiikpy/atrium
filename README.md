# Atrium

Cross-venue portfolio margin for the EVM. One wallet posts collateral once and trades across multiple onchain venues with a single margin number.

Currently deployed on Arbitrum Sepolia testnet. Robinhood Chain testnet support lands when the upstream SDK ships.

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
├── docs/                      # Specs, architecture, deployment
├── audits/                    # Code + integration audit reports
├── desing/                    # Visual language reference (HTML)
└── resources/                 # Cloned reference repos (see docs/resources.md)
```

## Status

Contracts and core services build green on `master`. Deployment to Arbitrum Sepolia is live for the verify-app; remaining contract activations are tracked in `docs/12-month-roadmap.md`. Audit history lives under `audits/`; incidents under `incidents/`.

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
