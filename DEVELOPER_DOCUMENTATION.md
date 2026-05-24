# Developer Documentation

Hey Open House London builders. This workspace includes local copies of the core Arbitrum, Stylus, and OpenZeppelin repositories under `resources/`. Start with the links below; most common setup and build questions should be covered here.

## Start Here

| Topic | Public docs | Local reference |
| --- | --- | --- |
| Developer Docs - Get started with Arbitrum | https://docs.arbitrum.io/ | `resources/arbitrum-docs/docs/get-started/overview.mdx` |
| Developer Docs - Get started with Robinhood Chain | https://docs.robinhood.com/chain/ | External docs only |
| A gentle introduction to Arbitrum | https://docs.arbitrum.io/intro/ | `resources/arbitrum-docs/docs/intro/intro.mdx` |
| Quickstart: Build a decentralized app (Solidity) | https://docs.arbitrum.io/build-decentralized-apps/quickstart-solidity-remix | `resources/arbitrum-docs/docs/build-decentralized-apps/01-quickstart-solidity-remix.mdx` |
| Quickstart: write a smart contract in Rust using Stylus | https://docs.arbitrum.io/stylus/quickstart | `resources/arbitrum-docs/docs/stylus/quickstart.mdx` |
| A gentle introduction: Stylus | https://docs.arbitrum.io/stylus/gentle-introduction | `resources/arbitrum-docs/docs/stylus/gentle-introduction.mdx` |
| How to run a local Nitro dev node | https://docs.arbitrum.io/run-arbitrum-node/run-nitro-dev-node | `resources/arbitrum-docs/docs/run-arbitrum-node/05-run-nitro-dev-node.mdx` |
| Quickstart: Arbitrum bridge | https://docs.arbitrum.io/arbitrum-bridge/quickstart | `resources/arbitrum-docs/docs/arbitrum-bridge/01-quickstart.mdx` |
| Third party docs: RPCs, Indexers, Oracles, etc. | https://docs.arbitrum.io/for-devs/third-party-docs/contribute | External docs only |
| Arbitrum FAQ | https://docs.arbitrum.io/learn-more/faq | `resources/arbitrum-docs/docs/learn-more/faq.mdx` |

## Local Resource Repositories

See `RESOURCES.md` for the full list of cloned repos and their checkout commits.

Key local paths:

- `resources/arbitrum-docs` - Arbitrum developer documentation
- `resources/arbitrum-sdk` - Arbitrum TypeScript SDK
- `resources/cargo-stylus` - Stylus CLI
- `resources/stylus-sdk-rs` - Stylus Rust SDK
- `resources/rust-contracts-stylus` - OpenZeppelin Rust contracts for Stylus
- `resources/openzeppelin-contracts` - OpenZeppelin Solidity contracts

## Faucets

**Ethereum Sepolia** — claim testnet ETH on Sepolia, then bridge it to Arbitrum Sepolia using the bridge.

- https://sepoliafaucet.com/
- https://arbitrum.faucet.dev/
- https://www.infura.io/faucet/sepolia
- https://sepolia-faucet.pk910.de/

**Arbitrum Sepolia** — claim testnet ETH directly on Arbitrum Sepolia:

- https://arbitrum.faucet.dev/
- https://faucet.quicknode.com/arbitrum/sepolia
- https://www.l2faucet.com/arbitrum

**Arbitrum Sepolia USDC**:

- https://faucet.circle.com/

**Robinhood Chain testnet**:

- https://faucet.testnet.chain.robinhood.com/

## RPC Endpoints

Arbitrum One mainnet:

- https://arb1.arbitrum.io/rpc
- https://rpc.ankr.com/arbitrum
- https://arbitrum.llamarpc.com

## Useful Tools for Builders

The cloned upstreams below are mirrored locally under `resources/`; see `RESOURCES.md` for paths and pinned commits.

- Arbitrum Docs — https://docs.arbitrum.io/
- Arbitrum SDK — https://github.com/OffchainLabs/arbitrum-sdk
- Stylus Docs — https://docs.arbitrum.io/stylus
- Stylus By Example — https://stylus-by-example.org *(external only, not mirrored)*
- Stylus CLI (`cargo-stylus`) — https://github.com/OffchainLabs/cargo-stylus
- Stylus Rust SDK — https://github.com/OffchainLabs/stylus-sdk-rs
- OpenZeppelin Rust Contracts for Stylus — https://github.com/OpenZeppelin/rust-contracts-stylus
- OpenZeppelin Solidity Contracts — https://github.com/OpenZeppelin/openzeppelin-contracts

## Suggested Reading Order

1. Read `A gentle introduction to Arbitrum` for the mental model.
2. Use `Get started with Arbitrum` to choose the right build path.
3. Follow `Quickstart: Build a decentralized app (Solidity)` if you are deploying Solidity contracts.
4. Use `Get started with Robinhood Chain` when targeting Robinhood Chain testnet details such as network setup, faucet, RPC endpoints, and wallet configuration.
