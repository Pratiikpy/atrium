# Postern Kill Switch + Key Registry

Two Solidity contracts that complete the Postern wallet-abstraction story.

## PosternKillSwitch

Single-button revoke for everything dangerous tied to a user's wallet:

- Every Sigil mandate the user has issued to any agent
- Every active ERC-7715 session key on the user's Postern smart wallet

One tx. One emit. User goes back to base-EOA-only control. The demo-day signature moment per PRD §22.2 patch 14.

## PosternKeyRegistry

ERC-7715 has no native key enumeration. Without a registry the Kill Switch can't list "all active keys" to revoke them.

Each Postern smart wallet records new session keys here at issuance time (`recordIssued`). The Kill Switch reads `getActiveKeys` and the registry marks them all revoked in one call.

## Why this lives in Solidity, not Stylus

Postern integrates with ERC-4337 EntryPoint v0.9 (verified in `resources/account-abstraction/contracts/core/EntryPoint.sol` line 27). The EntryPoint, paymaster, and session-key flows are Solidity-native; building this in Stylus would only add friction without a compute win.

## Files

```
postern-kill-switch/
├── foundry.toml
├── README.md
└── src/
    ├── PosternKillSwitch.sol
    └── PosternKeyRegistry.sol
```
