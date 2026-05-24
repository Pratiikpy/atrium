# Atrium

Cross-venue portfolio margin for the EVM. One wallet posts collateral once and trades across multiple onchain venues with one margin number.

Year-1 testnet on Arbitrum Sepolia. Robinhood Chain testnet when the SDK ships.

## Quick start

```bash
# Clone + install
git clone <repo-url> atrium
cd atrium
make demo            # full stack: contracts + frontend (Linux/macOS/WSL)
# OR
make demo-frontend   # frontend only (works on Windows MSVC too)
```

`make demo` deploys all contracts to a local Sepolia fork, seeds test data, and opens Verifier Mode in your browser. Target: ≤90 seconds on a fresh clone of `main`.

**Precondition**: Stylus contracts (`plinth`, `coffer`, `sigil`, `vigil`) need a linker that resolves the Stylus WASM host symbols. Linux, macOS, and WSL work; Windows MSVC currently does not — see `human_left.md` #11. If you are on Windows without WSL, use `make demo-frontend`, which boots the apps/verify Next.js dev server against the already-deployed Sepolia contracts and serves the Verifier UI immediately.

## Source of truth

| File | What it says |
|---|---|
| [ATRIUM_PRD.md](./ATRIUM_PRD.md) | Product spec. What and why. |
| [TECH_DESIGN.md](./TECH_DESIGN.md) | Technical design. How it works. |
| [RESOURCES.md](./RESOURCES.md) | Cloned reference repos in `resources/`. |
| [CLAUDE.md](./CLAUDE.md) | Working rules for the team. |

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
│   ├── postern-kill-switch/   # Wallet abstraction emergency (Solidity)
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
│   └── praetor-cli/           # Deploy + ops CLI
├── subgraph/                  # The Graph indexer (Scribe)
├── tests/                     # Cross-package integration tests
├── runbooks/                  # Ops procedures
├── incidents/                 # Post-mortems
├── docs/                      # Implementation guides
├── desing/                    # Visual language (HTML)
├── resources/                 # Cloned reference repos
└── .claude/rules/             # Working rules
```

## What is built today

Status as of buildathon Day -7 (May 18, 2026). Numbers track the live dashboard, never aspirational.

After 11 audit waves (F through K, 83 patches) the codebase status is:

| Subsystem | Source built | Deployed to Sepolia | Notes |
|---|---|---|---|
| Plinth, Coffer, Sigil, Vigil (Stylus) | ✅ | ❌ Month 1 W2 | full SPAN engine, ERC-4626, EIP-712 mandates with real ecrecover via precompile 0x01, liquidator with NMS ordering |
| Aqueduct + AqueductReceiver + AqueductClaimback | ✅ | ❌ Month 3 | CCIP with reorg-safe nonces, delivery-ack registry, uniform `pause(string)` ABI |
| Portico adapters (Aave Horizon, Hyperliquid, Pendle V2, Curve, Trade.xyz, Polymarket) | ✅ | ❌ Months 2-4 | all 6 with `ReentrancyGuard`, EIP-712 attestation domain binding (Hyperliquid + Polymarket), originator from venue_payload (no `tx.origin`) |
| Postern Kill Switch + PosternKeyRegistry | ✅ | ❌ Month 1 W2 | ERC-4337 session keys, Kill Switch routes through `Sigil.revoke_all_on_behalf_of` |
| PraetorTimelock + ResearchAttestation + LanternAttestor + Edict + PorticoRegistry + Rostrum | ✅ | ❌ Month 1 W2 | 48h timelock, copy-trade mirror engine, jurisdiction tiers, all admin paths timelock-gated |
| Verifier Mode UI (apps/verify) | ✅ | ✅ | per-step deployment-status banner, six required UI states, real Kani badge fetching CI |
| CI pipeline (Foundry + Kani + Lighthouse + gitleaks + Playwright e2e) | ✅ | ✅ | 6 workflows; Kani publishes status JSON to apps/verify/public/kani-status.json |
| Scribe subgraph (12 data sources, 14 entities) | ✅ | ❌ Month 4 | event signatures + handlers verified against current contract ABIs |
| Codex x402 API | ✅ | ❌ Month 5 | viem on-chain USDC Transfer-log verification with 12 confirms; D1-backed replay dedup |
| Lantern attestor service | ✅ | ❌ Month 6 | AES-256-GCM + scrypt key envelope (min N=2^17); refuses key paths inside repo tree |
| Praetor CLI (deploy / verify / multisig) | ✅ | ✅ runnable | real forge create + cargo stylus deploy, keystore preferred over raw key argv |
| Tablet tax exports (UK CGT / US 8949 / DE FIFO) | ✅ | n/a | two-pass HMRC matching, IRC §1091 wash-sale with basis bump, RFC-4180 CSV |
| Augur / Haruspex / Auspex agents | ✅ template | ❌ Months 7-8 | agent template with compile-time Sigil envelope encoders (3 tests passing) |
| Cohort Status Page | UI ✅ scaffold | ❌ Month 7 | live Scribe query; renders 0 partners when 0 |
| Rostrum leaderboard | ✅ | ❌ Month 9 | mirror-trade math, deboost on miss |
| Mobile PWA | ✅ | ❌ Month 8 | manifest present, 192/512 PNG icons pending |

"Source built" = code lives in the repo and compiles on Linux/macOS/WSL. "Deployed to Sepolia" = contract address recorded in `deployments/arbitrum_sepolia.json`. Mismatch is the buildathon work plan: Months 1-2 land deploys; everything in `Months 3-12` is incremental.

The 12-month build plan is in `docs/ROADMAP.md`. Audit findings register at `docs/AUDIT_FINDINGS.md` documents every patch landed across this session.

## Build commands

```bash
make demo          # Full local stack in 90 seconds
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

MIT for Atrium code. See `LICENSE`. Some dependencies in `resources/` use other licenses (GPL-3.0 for EntryPoint, BUSL for Aave V3) — integration only, no forking.

## Security

See [SECURITY.md](./SECURITY.md). Disclose vulnerabilities to security@atrium.fi (PGP key in the file).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Curator grants pay $5K ARB for accepted IPorticoAdapter v1.0 implementations and reference agents.
