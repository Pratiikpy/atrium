# Arbitrum Builder Resources

Local reference repositories cloned under `resources/`. All shallow clones (`--depth 1`) to keep the workspace lightweight.

## Core toolchain

| Resource | Local path | Upstream | Checkout |
| --- | --- | --- | --- |
| Arbitrum docs | `resources/arbitrum-docs` | https://github.com/OffchainLabs/arbitrum-docs | `master` @ `c3b50f3` |
| Arbitrum SDK | `resources/arbitrum-sdk` | https://github.com/OffchainLabs/arbitrum-sdk | `main` @ `c025905` |
| Stylus CLI | `resources/cargo-stylus` | https://github.com/OffchainLabs/cargo-stylus | `main` @ `5c52087` |
| Stylus Rust SDK | `resources/stylus-sdk-rs` | https://github.com/OffchainLabs/stylus-sdk-rs | `main` @ `240197b` |

## Smart-contract base libraries

| Resource | Local path | Upstream | Checkout |
| --- | --- | --- | --- |
| OpenZeppelin Rust Contracts for Stylus | `resources/rust-contracts-stylus` | https://github.com/OpenZeppelin/rust-contracts-stylus | `main` @ `b11dd03` |
| OpenZeppelin Solidity Contracts | `resources/openzeppelin-contracts` | https://github.com/OpenZeppelin/openzeppelin-contracts | `master` @ `cd05883` |

## Oracles (Plinth + Aqueduct)

| Resource | Local path | Upstream | Checkout |
| --- | --- | --- | --- |
| Chainlink (price feeds + CCIP + Data Streams interfaces) | `resources/chainlink-brownie-contracts` | https://github.com/smartcontractkit/chainlink-brownie-contracts | `main` @ `f82d1ac` |
| Pyth Network (secondary oracle, cross-chain prices) | `resources/pyth-crosschain` | https://github.com/pyth-network/pyth-crosschain | `main` @ `5026396` |

## Wallet abstraction (Postern)

| Resource | Local path | Upstream | Checkout |
| --- | --- | --- | --- |
| ERC-4337 reference (EntryPoint + samples) | `resources/account-abstraction` | https://github.com/eth-infinitism/account-abstraction | `develop` @ `1c6b669` |

## Formal verification (Plinth CI)

| Resource | Local path | Upstream | Checkout |
| --- | --- | --- | --- |
| Halmos symbolic-execution prover | `resources/halmos` | https://github.com/a16z/halmos | `main` @ `079bb42` |

## Venue adapters (Portico)

| Resource | Local path | Upstream | Checkout |
| --- | --- | --- | --- |
| Aave V3 Core (Horizon adapter) | `resources/aave-v3-core` | https://github.com/aave/aave-v3-core | `main` @ `782f519` |
| Pendle V2 (PT/YT adapter) | `resources/pendle-core-v2-public` | https://github.com/pendle-finance/pendle-core-v2-public | `main` @ `fdcfe39` |
| Hyperliquid Contracts (HIP-3 / HIP-4 adapter) | `resources/hyperliquid-contracts` | https://github.com/hyperliquid-dex/contracts | `master` @ `d7e66aa` |
| Hyperliquid EVM Sync (state bridge utilities) | `resources/hyper-evm-sync` | https://github.com/hyperliquid-dex/hyper-evm-sync | `main` @ `d0945c6` |

## Agent layer (Sigil)

| Resource | Local path | Upstream | Checkout |
| --- | --- | --- | --- |
| ERC-8004 official contracts | `resources/erc-8004-contracts` | https://github.com/erc-8004/erc-8004-contracts | `master` @ `0463311` |
| ERC-8004 trustless-agents reference implementation | `resources/trustless-agents-erc-ri` | https://github.com/ChaosChain/trustless-agents-erc-ri | `main` @ `2e5e79d` |

## Paid agent APIs (Codex)

| Resource | Local path | Upstream | Checkout |
| --- | --- | --- | --- |
| Coinbase x402 micropayment protocol | `resources/x402` | https://github.com/coinbase/x402 | `main` @ `dd927a2` |

## Indexing (Scribe)

| Resource | Local path | Upstream | Checkout |
| --- | --- | --- | --- |
| The Graph CLI + subgraph tooling | `resources/graph-tooling` | https://github.com/graphprotocol/graph-tooling | `main` @ `921c014` |

## Docs-only references (no clonable repo available)

These resources have no public source repository to mirror locally. Track via their docs URL until/unless an SDK ships.

| Resource | Docs URL | Status | Action when SDK ships |
| --- | --- | --- | --- |
| Robinhood Chain | https://docs.robinhood.com/chain/ | No public repo as of 2026-05-18; only third-party builder projects appear in GitHub search. | Re-check `github.com/robinhood-markets` and `github.com/robinhood` quarterly. Clone immediately if/when an official SDK or contracts repo appears, and move this row into the Venue adapters section. |

## Notes

- **Aave:** Cloned `aave/aave-v3-core` instead of `aave-dao/aave-v3-origin` because the latter contains files under `certora/.../aux/` and `aux` is a Windows reserved filename, causing checkout failures on Windows hosts.
- **Hyperliquid contracts:** Local folder renamed from the upstream's generic `contracts` to `hyperliquid-contracts` for clarity in this multi-repo workspace.

## Maintenance commands

Update a single repo:

```powershell
git -C resources/<repo-name> pull --ff-only
```

Fetch full history for a shallow clone:

```powershell
git -C resources/<repo-name> fetch --unshallow
```

Re-clone everything from scratch (if a repo gets into a bad state):

```bash
cd resources
# Edit the list below to match
for repo in \
  "OffchainLabs/arbitrum-docs" \
  "OffchainLabs/arbitrum-sdk" \
  "OffchainLabs/cargo-stylus" \
  "OffchainLabs/stylus-sdk-rs" \
  "OpenZeppelin/rust-contracts-stylus" \
  "OpenZeppelin/openzeppelin-contracts" \
  "smartcontractkit/chainlink-brownie-contracts" \
  "pyth-network/pyth-crosschain" \
  "eth-infinitism/account-abstraction" \
  "a16z/halmos" \
  "aave/aave-v3-core" \
  "pendle-finance/pendle-core-v2-public" \
  "hyperliquid-dex/contracts" \
  "hyperliquid-dex/hyper-evm-sync" \
  "erc-8004/erc-8004-contracts" \
  "ChaosChain/trustless-agents-erc-ri" \
  "coinbase/x402" \
  "graphprotocol/graph-tooling" ; do
  name=$(basename "$repo")
  [ -d "$name" ] || git clone --depth 1 "https://github.com/$repo" "$name"
done
```
