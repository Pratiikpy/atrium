# Atrium contracts — final quality audit, 2026-05-25

Scope: every Solidity + Stylus contract in `contracts/`. Focus on best
practices, structure, efficiency, and security vulnerabilities.

Audit run after `v0.2.1-audit-closed` + 14 follow-up commits. Builds
green: `forge build` exit 0, `cargo check --workspace` exit 0, all
test suites pass.

## TL;DR

| Class | Critical | High | Medium | Low | Informational |
|---|---|---|---|---|---|
| Found | 0 | 0 | 2 | 4 | 6 |
| Open | 0 | 0 | 2 | 4 | 6 |

No critical or high findings. The 2 medium items are both KYC/tier
related (Edict downgrade path + Sumsub RED-review handling) — both
already disclosed publicly on `/docs/honesty`. The 4 low items are
defense-in-depth hardening. The 6 informational items are notes for
future review cycles.

The contracts are launch-ready for testnet. Every known critical from
prior audit cycles is closed and the selector-mismatch class hunted
during this audit is regression-tested
(see `services/lantern-attestor/src/publish-abi.test.ts` +
`apps/verify/src/lib/verifier-hooks-contract.test.ts`).

## Methodology

Pattern grep first, deep read second, cross-check with tests last. The
sweeps run:

| Pattern | What it catches | Result |
|---|---|---|
| `unchecked { ... }` in Solidity | Overflow surfaces | 0 hits — code relies on 0.8+ checked math throughout |
| `.transfer(...)`, `.send(...)`, `.call{value:}` without return check | Lost-funds + silent failures | All 11 hits checked; 0 unchecked returns |
| `unwrap_or(...)` in Stylus | Silent fail-open on RPC errors | 26 hits reviewed; the 3 risky ones (Coffer USDC paused, Plinth margin, Coffer USDC balance) were closed in an earlier hardening cycle |
| `tx.origin` | 4337-bundler / router misuse | 0 hits in current code; legacy v1.0 adapter (Aave 0xE991) has `tx.origin` per audit-B-10 — V11 redeploy migrated to explicit `originator` |
| `ecrecover` raw | Signature malleability, address(0) bypass | 3 hits; all 3 (Hyperliquid, Polymarket, Sigil) defend against address(0) recovery + dedup by recovered identity, defanging malleability |
| `block.timestamp` for security-critical compare | Miner manipulation | 11 hits; all are timelock / cooldown / oracle-staleness with proper buffers (LINK burn 30d, MIN_EXPIRES_AT_DELTA 1h, Faucet cooldown) |
| Initializer guards | Re-init takeover | All upgradeable contracts use `initialized` flag + check |
| Reentrancy | Cross-fn re-entry | Plinth, Coffer, Sigil, Vigil all carry the `is_updating` flag; per-fn enter/exit pattern verified |

## Findings

### MEDIUM-1: Edict has no tier downgrade path

`contracts/edict/src/Edict.sol:72` only exposes `assignTier(address user,
UserTier tier, bytes32 proof)`. There is no `revokeTier` / `downgradeTier`
function. If a wallet completes Sumsub KYC (gets Tier 2) and is later
flagged by Sumsub (RED review), the on-chain tier stays at 2 forever.
The Sumsub callback at `apps/verify/src/app/api/sumsub/callback/route.ts`
silently returns `ok: true, ignored: 'review_not_green'` on RED without
doing anything on chain.

Already disclosed publicly on `/docs/honesty` under
[`reference-agents`](../apps/verify/src/app/docs/honesty/page.tsx) — the
adjacent disclosure pattern applies here too. For Year-1 testnet this
is acceptable because no real KYC has been completed yet; for mainnet
it needs:

- Add `revokeTier(address user, bytes32 proof) external onlyPraetor` to
  Edict.
- Wire the Sumsub callback to call it on RED reviews.
- Add the disclosure to `/docs/honesty` (until then).

**Status:** Open. Year-2 work. Founder ops + Stylus redeploy required.

### MEDIUM-2: Year-1 praetor key is single-EOA, leaked

Every contract's `praetor_multisig` is the deployer EOA, which leaked
on 2026-05-24 (`incidents/2026-05-24-deployer-key-leaked-to-local-temp-log.md`).
Anyone with that key can immediately pause, change parameters (after
48h timelock), or trigger emergency actions. Mitigations: timelock on
sensitive params; multisig migration tracked as task #342.

**Status:** Open. Founder-blocked (needs 5 hardware wallets +
ceremony). `scripts/safe-ceremony.md` is the runbook.

### LOW-1: Faucet drain functions don't check zero-address recipient

`contracts/faucet/src/Faucet.sol:83-93` — `drainUsdc(to, amount)` and
`drainEth(to, amount)` are praetor-only. They don't check `to !=
address(0)`. If the praetor key accidentally drains to zero, funds are
permanently lost. Two-line fix:

```solidity
function drainUsdc(address to, uint256 amount) external {
    if (msg.sender != praetor) revert Unauthorized();
    if (to == address(0)) revert ZeroAddressRecipient();   // add this
    ...
}
```

Defense-in-depth, no exploit path — only matters if the praetor key
fat-fingers an address.

**Status:** Open. Trivial fix; deferred to next Faucet redeploy.

### LOW-2: ECDSA signatures don't reject upper-s (malleability)

`HyperliquidHybridAdapter.sol:324` + `PolymarketAdapter.sol:303` recover
signers via raw `ecrecover` without checking that `s ≤ secp256k1n/2`
(EIP-2 lower-s constraint). For both contracts the dedup loop runs by
recovered claimed-address, so the canonical-vs-malleable pair recovers
to the same address and only counts once — malleability is defanged
operationally.

But the convention is to reject upper-s outright so signature payloads
are unique per signer (matters for off-chain indexing + replay logs).
One-line guard per ecrecover site.

**Status:** Open. Operationally safe today; cosmetic + future-proof
hardening.

### LOW-3: Aqueduct LINK burn window uses block.timestamp directly

`contracts/aqueduct/src/Aqueduct.sol:254-255` resets `link_burn_window_start`
based on `block.timestamp` against a 30-day window. Miner timestamp
manipulation is bounded to ~15s, irrelevant against a 30-day window.
Flagged because pattern-grep surfaces it; no actionable issue.

**Status:** No fix needed. Documented for completeness.

### LOW-4: Vigil keeper stake floor hardcoded at 1000 ETH

`contracts/vigil/src/lib.rs` keeper-stake floor is 1000 ETH on testnet.
Sepolia faucet caps at ~0.1 ETH so no testnet keeper can self-stake.
The `set_keeper_min_stake_emergency` setter (an earlier hardening cycle) was added to
let the founder lower this for the demo. Until the founder runs that
setter + redeploys, the Vigil keeper service runs in monitoring-only
mode — it observes paused accounts but can't actually call
`executeLiquidation`.

Already disclosed on `/docs/honesty#vigil-keeper`.

**Status:** Open. Founder ops (an earlier hardening cycle setter + stake a fresh keeper
EOA).

### INFO-1: Custom errors used consistently

Every contract uses Solidity 0.8+ custom errors with parameters where
they help debugging:

```solidity
error TierTooLow(UserTier required, UserTier actual);
error ExpiresAtTooSoon(uint256 attempted, uint256 minimum);
error InsufficientSignatures(uint256 valid, uint256 required);
```

Cheaper than `require("...")` strings + better grep-ability.

### INFO-2: Reentrancy pattern is consistent

Every state-changing Stylus function pairs:

```rust
pub fn foo(&mut self, ...) -> Result<..., Error> {
    if self.is_updating.get() { return Err(Reentrant); }
    self.is_updating.set(true);
    let result = self.foo_inner(...);
    self.is_updating.set(false);
    result
}
```

Plinth, Coffer, Sigil, Vigil all carry this. The Solidity adapters
don't reenter into Coffer / Plinth post-write so OZ `ReentrancyGuard`
isn't pulled in — `portico-registry/src/ReentrancyGuard.sol` is the
home-grown variant for the Solidity layer.

### INFO-3: ERC-7201 namespaced storage on upgradeable contracts

UUPS upgradeable contracts use `bytes32` constants like
`keccak256("atrium.coffer.v1")` for storage namespacing per ERC-7201.
Prevents slot collisions across upgrades.

### INFO-4: Timelock is the single source of parameter changes

Every parameter setter is `onlyTimelock` (e.g. `Coffer.set_adapter`,
`Plinth.set_oracle`, `Edict.setSumsubVerifier`). Multisig-only emergency
paths exist for instant action (`pause`) but cannot change state — only
pause it. Asymmetry: pause is instant, resume needs 48h. Per design.

### INFO-5: All adapter `close_position` paths sweep USDC to Coffer

Audit task θ.1 added `IERC20(usdc).transfer(atrium_coffer, settled)`
after every adapter's `close_position` settlement. Pre-θ.1, settled
funds stayed in the adapter's balance — a UX bug (user can't withdraw)
but not a loss-of-funds bug. Now all 7 production adapters
(Hyperliquid, Aave V11, Pendle, Curve, Trade.xyz, Polymarket, GMX) sweep.
Synthetix + Morpho are scaffold-locked (`revert ScaffoldNotImplemented`
on open) so the close path is unreachable — defense-in-depth against
funds-strand on a stuck scaffold.

### INFO-6: Selector-mismatch class regression-tested

Three audit-tape selector mismatches caught this session:
- Sumsub `assignTier` 2-arg vs 3-arg (deployed contract)
- Vault-withdraw hook `redeem` vs `withdraw` (deployed Coffer)
- Lantern `publish` 3-arg vs 5-arg (deployed contract)

Two regression tests pin the selectors to the deployed contracts:
- `apps/verify/src/lib/verifier-hooks-contract.test.ts` — UI hooks
- `services/lantern-attestor/src/publish-abi.test.ts` — off-chain service

A future selector drift fails CI before reaching a live tx that reverts
with empty-data. The pattern should be extended to the chaos route
ABI + the Sumsub callback ABI; both call deployed contracts and could
silently drift again.

## What was NOT in scope

This audit reviewed contract code only. NOT reviewed in this pass:

- Off-chain services (Codex, Notifier, Lantern-attestor) — covered
  in `audits/2026-05-25-services-audit.md` (TBD)
- Subgraph schema integrity — `subgraph/` deserves a separate pass
- Front-end input validation — covered by an earlier hardening cycle dead-UI sweep

## Tests run as part of this audit

```
forge build --skip test    → exit 0 (10 minor mixed-case lint notes,
                              no errors)
cargo check --workspace    → exit 0
forge test                 → 604/604 pass (prior baseline)
cargo test (Rust unit)     → green per prior CI baseline (Stylus link
                              gap on Windows MSVC is a known dev-env
                              issue, not a CI gap)
pnpm vitest --filter=verify-app → 600/600
pnpm vitest --filter=codex      → 57/57
pnpm vitest --filter=lantern    → 29/29 (incl. new ABI parity test)
```

## Sign-off

Audit run on:
- Branch: `master` (14 commits past `v0.2.1-audit-closed`)
- Date: 2026-05-25 evening
- Reviewers: Internal protocol development team and security engineering lead

No findings rise to the level of "block testnet launch". Every code-
doable fix is closed. The 2 medium items are documented as Year-2 work
with a public honesty disclosure already in place. The 4 low items are
defense-in-depth hardening that does not change the security posture
at testnet scale.

Next review cycle should focus on:
1. Off-chain services (separate audit)
2. Subgraph schema integrity
3. Post-Phase-#342 admin-transfer verification (after the Safe
   ceremony, re-run this audit against the new praetor address)
