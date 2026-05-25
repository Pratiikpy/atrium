# Tripwire 2026-05-25: Aave Horizon runs against a MockAavePool on Sepolia

> Aave Horizon adapter on Arbitrum Sepolia points at an
> Atrium-deployed MockAavePool (0x2e1360faE80c7937e684067450202D921F72555B),
> not a real Aave V3 deployment. There is no Aave V3 on Arbitrum
> Sepolia testnet, so any "open Aave Horizon position" demo on
> Year-1 testnet round-trips USDC against the mock. Real Aave V3
> lending lands at the mainnet flip (Year-2).

## What the mock does

- `supply(asset, amount, onBehalfOf, refCode)` pulls `amount` of `asset`
  via transferFrom and credits an internal `supplied[asset][onBehalfOf]`
  balance.
- `withdraw(asset, amount, to)` decrements `supplied[asset][caller]` and
  transfers `amount` of `asset` to `to`. Reverts on insufficient supplied.
- `getReserveData(asset)` returns the 15-tuple the adapter expects, with
  `liquidityIndex` (slot 1) seeded at 1e27 and drifting up 5 bps per call
  so the adapter's venue-health view shows movement.
- No interest accrues to suppliers. Round-trip is 1:1.

## What the adapter does post-swap

- AaveHorizonAdapterV11 redeployed at 0x826dc4FE429d0Df6454E11dAeA10f2975b551042
  with constructor pool = MockAavePool address.
- Same bytecode as the 2026-05-24 v1.1 redeploy (auditor C-6 fix). Only
  the constructor pool arg differs.
- Coffer.setAdapter(NEW, true) + PorticoRegistry.deregisterAdapter(2) +
  PorticoRegistry.registerAdapter(2, NEW, ...) scheduled on
  PraetorTimelock 2026-05-25T19:30Z. Executable 2026-05-27T19:30Z.

## Timeline

- 2026-05-26T15:43Z: Original PhaseB3 batch executes. PorticoRegistry
  briefly points at the pool=deployer placeholder v1.1 at 0xa68361.
  Aave Horizon "live" in the UI but open_position effectively no-ops
  (since the placeholder pool is an EOA, not a real Aave Pool, so
  supply() reverts at the call boundary).
- 2026-05-27T19:30Z: New batch executes. Registry swap completes; UI
  flips to v1.1.1 at 0x826dc4 backed by MockAavePool; open_position
  actually moves USDC into the mock and out on close.

## Why this is fine for Year-1 testnet

- Aave Horizon was scoped Phase-1 in PRD §1.1 because cross-margin
  against safe-yield collateral is a headline use case. Stubbing the
  venue keeps the cross-margin demo working end-to-end without lying
  about real Aave liquidity.
- The mock is non-rebasing 1:1 — no synthetic yield is reported as
  earned. The adapter's getReserveData call shows a drifting liquidity
  index, but Coffer accounting never reads it: only the principal
  withdrawn matters for cross-margin.
- /security page renders the disclosure: "Aave Horizon on Sepolia
  runs against an Atrium-deployed MockAavePool. Real Aave V3 lending
  lands at the mainnet flip."

## Why not Aave V3 on mainnet via CCIP

- CCIP would add ~$3/cross-chain fee per open + close, ~1-3 min latency,
  and a new failure mode (CCIP message expiry). For testnet
  demonstration that's worse UX for no real lending payoff (Aave-Sepolia
  positions are still synthetic).
- Reserved for Year-2 when the protocol moves to mainnet and the cross-
  chain spend is real.
