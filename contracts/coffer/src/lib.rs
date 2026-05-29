// Coffer — Atrium unified collateral vault
//
// ERC-4626 tokenized vault that holds USDC and issues shares. Extends OZ Rust
// ERC-4626 (verified at resources/rust-contracts-stylus/contracts/src/token/erc20/extensions/erc4626.rs).
//
// Plinth has read access to balances and writes a "paused" flag when an account
// becomes under-collateralized. Withdrawals route through a circuit-breaker:
//
//   - Per-user pending liquidation lock (set by Plinth)
//   - Global withdrawals pause (Praetor multisig)
//   - Per-adapter per-block notional cap (anti-malicious-adapter, TDD §17.1)
//   - Global TVL drop circuit-breaker (>30% in 1h = auto-pause)

#![cfg_attr(not(any(feature = "export-abi", test)), no_main)]
// Switch to no_std for on-chain wasm builds only. The export-abi feature
// (used by `cargo stylus`) needs std for the generated abi printers.
#![cfg_attr(not(any(feature = "export-abi", test)), no_std)]

extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;
// Stylus SDK 0.10 migration: use the SDK's re-exports of alloy_primitives
// and alloy_sol_types so trait derives (SolEvent, SolError, AbiType) resolve
// against the same alloy version the SDK itself uses. Importing direct
// alloy crates pulls in a parallel set of types and the derive macros
// silently refuse to recognise them.
use alloy_primitives::{Address, B256, Uint, U256, U64};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;

// =============================================================================
// Events
// =============================================================================
sol! {
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event HaircutApplied(address indexed user, uint256 haircut_amount_wei, uint16 haircut_bps);
    // `reason` and `trigger` were originally `string`. Swapped to `bytes32` to
    // shrink wasm (each string field added ~400 bytes of alloc/format
    // machinery on no_std builds). Off-chain consumers should keccak256()
    // the reason text on the way in and check against the on-chain digest.
    event DepositsPaused(bytes32 reason);
    event DepositsResumed();
    event WithdrawalsPaused(bytes32 reason);
    event WithdrawalsResumed();
    event AdapterCapHit(address indexed adapter, uint256 attempted_wei, uint256 cap_wei);
    event CircuitBreakerTripped(bytes32 trigger, uint256 measurement);
    event UsdcPausedDetected();
}

// =============================================================================
// Errors
// =============================================================================
sol! {
    error DepositsPausedError();
    error WithdrawalsPausedError();
    error PendingLiquidation(address user);
    error DepositCapExceeded(uint256 requested, uint256 cap);
    error PerUserCapExceeded(uint256 requested, uint256 cap);
    error AdapterCapExceeded(address adapter, uint256 requested, uint256 remaining);
    error UnauthorizedCaller(address caller);
    error ZeroAssets();
    error InsufficientShares(uint256 requested, uint256 available);
    error UsdcPaused();
    // Audit ZZ-5 + ZZ-6 fix: surface failed USDC transfers as a real revert
    // rather than silently letting share burns commit without the funds move.
    error TransferFailed(address token, address to, uint256 amount);
    // Audit KKK-3 fix: surface Plinth call failures during adapter_pull
    // so the pending-liquidation pause check is not silently bypassed.
    error PlinthUnreachable(address user);
    // Audit 2026-05-24 (Auditor A C-7): Coffer had no reentrancy guard. A
    // hostile USDC-shaped token (set as `asset` via timelock typo) or a
    // future hook callback could re-enter deposit/withdraw/adapter_pull
    // mid-flight and double-mint shares. Mirrors Plinth's is_updating
    // pattern; this error fires when the prologue sees the flag already
    // set.
    error CofferReentrant();
    // Phase theta.1 fix (2026-05-25): USDC `paused()` view returned an error
    // (e.g. underlying contract upgraded behind a bad proxy, RPC stub broken).
    // Pre-fix `.unwrap_or(false)` silently treated USDC as live and let the
    // deposit proceed against a paused asset. New behavior: refuse to operate
    // when USDC state is unreadable.
    error UsdcStateUnreadable();
}

#[derive(SolidityError)]
pub enum CofferError {
    DepositsPaused(DepositsPausedError),
    WithdrawalsPaused(WithdrawalsPausedError),
    PendingLiquidation(PendingLiquidation),
    DepositCap(DepositCapExceeded),
    PerUserCap(PerUserCapExceeded),
    AdapterCap(AdapterCapExceeded),
    Unauthorized(UnauthorizedCaller),
    ZeroAssets(ZeroAssets),
    InsufficientShares(InsufficientShares),
    UsdcPaused(UsdcPaused),
    // Phase theta.1 (2026-05-25): paired with UsdcStateUnreadable error.
    UsdcStateUnreadable(UsdcStateUnreadable),
    // Audit ZZ-5 + ZZ-6: critical money-loss fix variant.
    TransferFailed(TransferFailed),
    // Audit KKK-3: fail-loud on Plinth call failure during adapter_pull
    // instead of silent fail-open.
    PlinthUnreachable(PlinthUnreachable),
    Reentrant(CofferReentrant),
}

// =============================================================================
// External interfaces
// =============================================================================
sol_interface! {
    interface IUsdc {
        function transferFrom(address from, address to, uint256 value) external returns (bool);
        function transfer(address to, uint256 value) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
        function paused() external view returns (bool);
    }
    // Audit G-2 fix: Stylus exports snake_case as camelCase Solidity ABI;
    // declare the Solidity name in camelCase so selectors match the export.
    interface IPlinth {
        function getAccount(address user) external view returns (uint256, uint256, uint256, bool);
    }
}

// =============================================================================
// Storage
// =============================================================================
sol_storage! {
    #[entrypoint]
    pub struct Coffer {
        // ERC-20 (shares token) — embedded directly per TDD §7.3
        mapping(address => uint256) share_balances;
        mapping(address => mapping(address => uint256)) share_allowances;
        uint256 total_shares;

        // ERC-4626 underlying
        address asset;                      // USDC on this chain

        // Atrium wiring
        address plinth_address;
        address praetor_multisig;
        address praetor_timelock;  // F-32 fix
        mapping(address => bool) approved_adapters;
        mapping(address => AdapterBudget) adapter_budgets;

        // Caps
        uint256 deposit_cap_wei;
        uint256 per_user_cap_wei;
        mapping(address => uint256) per_user_deposits;

        // Pauses
        bool is_deposits_paused;
        bool is_withdrawals_paused;

        // Circuit breaker — 1h TVL window
        uint256 last_tvl_snapshot_wei;
        uint64 last_tvl_snapshot_time;
        uint16 tvl_drop_threshold_bps;       // 3000 (30%)

        // Audit 2026-05-24 (Auditor A C-7): single-slot reentrancy flag.
        // Set by the public deposit/withdraw/adapter_pull wrapper before
        // any external call, cleared on return. Plinth has the same
        // pattern (see `contracts/plinth/src/lib.rs`).
        bool is_updating;

        // Audit fix (#36): internally-accounted deposited assets, used ONLY for
        // the deposit-cap gate. Incremented on a successful deposit, decremented
        // on withdraw / adapter_pull. total_assets() still reads the live USDC
        // balance for ERC-4626 share math, but the cap must not be drivable by a
        // direct USDC donation (anyone could `USDC.transfer(coffer, X)` to push
        // total_assets() over deposit_cap_wei and block ALL further deposits).
        // Appended at the end of the struct to keep the storage layout
        // upgrade-safe. Starts at 0 on a fresh deploy and accumulates.
        uint256 tracked_assets_wei;
    }

    pub struct AdapterBudget {
        uint256 per_block_cap_wei;            // max notional pull per block
        uint64 last_block;
        uint256 used_this_block_wei;
    }
}

#[public]
impl Coffer {
    /// Phase 2a: migrated from initialize() to #[constructor] per Plinth pattern.
    /// Invoked exactly once at deploy time by the Stylus deployer factory.
    /// Cannot be front-run since the factory is the immediate caller.
    #[constructor]
    pub fn constructor(
        &mut self,
        asset: Address,
        plinth: Address,
        praetor: Address,
        praetor_timelock: Address,
        deposit_cap_wei: U256,
        per_user_cap_wei: U256,
    ) {
        // Audit F-G fix: zero-address admin args would brick the contract.
        assert!(!praetor.is_zero(), "praetor zero");
        assert!(!praetor_timelock.is_zero(), "timelock zero");
        self.asset.set(asset);
        self.plinth_address.set(plinth);
        self.praetor_multisig.set(praetor);
        self.praetor_timelock.set(praetor_timelock);
        self.deposit_cap_wei.set(deposit_cap_wei);
        self.per_user_cap_wei.set(per_user_cap_wei);
        self.tvl_drop_threshold_bps.set(Uint::<16, 1>::from(3_000u16));
    }

    fn assert_timelock(&self) -> Result<(), CofferError> {
        if self.vm().msg_sender() != self.praetor_timelock.get() {
            return Err(CofferError::Unauthorized(UnauthorizedCaller {
                caller: self.vm().msg_sender(),
            }));
        }
        Ok(())
    }

    // ===== ERC-4626 standard =====
    pub fn asset(&self) -> Address {
        self.asset.get()
    }

    // ===== Init-state getters (Audit 2026-05-24 G-2 fix) =====
    // `/api/deployments/status` reads these via viem to confirm initialize()
    // ran on the deployed address. Coffer's `asset()` already serves as the
    // canonical init probe, but exposing the admin slots lets the route
    // assert the *correct* multisig is wired, not just any non-zero value.
    pub fn praetor_multisig(&self) -> Address {
        self.praetor_multisig.get()
    }

    pub fn praetor_timelock(&self) -> Address {
        self.praetor_timelock.get()
    }

    pub fn plinth_address(&self) -> Address {
        self.plinth_address.get()
    }

    pub fn total_assets(&self) -> U256 {
        let usdc = IUsdc::new(self.asset.get());
        // Phase theta.1 fix (2026-05-25): pre-fix `.unwrap_or(U256::ZERO)`
        // silently returned 0 when USDC.balanceOf reverted (proxy upgrade
        // mid-flight, RPC eclipse, hostile asset). ERC-4626 readers then
        // computed share price = total_supply / 0 = ∞, the classic first-
        // depositor inflation attack vector. Reverting on the view is the
        // safe answer: clients see the call fail, never get a wrong number.
        // ERC-4626 spec MAY revert on totalAssets() per the EIP-4626 text.
        usdc.balance_of(self.vm(), Call::new(), self.vm().contract_address())
            .expect("Coffer.total_assets: USDC balanceOf unreadable")
    }

    pub fn total_supply(&self) -> U256 {
        self.total_shares.get()
    }

    pub fn balance_of(&self, owner: Address) -> U256 {
        self.share_balances.getter(owner).get()
    }

    pub fn convert_to_shares(&self, assets: U256) -> U256 {
        // Audit A-5 fix: virtual-shares offset closes the classic ERC-4626
        // inflation attack. Pattern from OpenZeppelin ERC4626Upgradeable: add
        // 10^decimalsOffset virtual shares + 1 virtual asset to both sides
        // of the ratio so the first depositor cannot grief subsequent ones
        // by depositing 1 wei and donating USDC to inflate the share price.
        // VIRTUAL_OFFSET = 10^6 (USDC decimals).
        let virtual_shares = U256::from(1_000_000u64);
        let virtual_assets = U256::from(1u64);
        let supply = self.total_shares.get();
        let total = self.total_assets();
        assets.saturating_mul(supply.saturating_add(virtual_shares))
            / total.saturating_add(virtual_assets)
    }

    pub fn convert_to_assets(&self, shares: U256) -> U256 {
        let virtual_shares = U256::from(1_000_000u64);
        let virtual_assets = U256::from(1u64);
        let supply = self.total_shares.get();
        let total = self.total_assets();
        shares.saturating_mul(total.saturating_add(virtual_assets))
            / supply.saturating_add(virtual_shares)
    }

    /// Audit FIRE78-COF1 fix (sub-agent HIGH): ERC-4626 spec requires
    /// `previewWithdraw` to round shares UP for the withdraw path so a
    /// user requesting `assets` USDC never gets more USDC than the share
    /// burn represents. The plain `convert_to_shares` rounds DOWN
    /// (integer division), accumulating free dust on repeated small
    /// withdrawals. This ceiling-divide variant is the load-bearing fix.
    pub fn convert_to_shares_ceil(&self, assets: U256) -> U256 {
        let virtual_shares = U256::from(1_000_000u64);
        let virtual_assets = U256::from(1u64);
        let supply = self.total_shares.get();
        let total = self.total_assets();
        let num = assets.saturating_mul(supply.saturating_add(virtual_shares));
        let den = total.saturating_add(virtual_assets);
        // Ceiling-divide: (num + den - 1) / den, guarded against the
        // numerator being zero so we don't return 1 for a zero-asset
        // withdrawal request.
        if num.is_zero() {
            return U256::ZERO;
        }
        (num + den - U256::from(1u64)) / den
    }

    pub fn deposit(&mut self, assets: U256, receiver: Address) -> Result<U256, CofferError> {
        if self.is_updating.get() {
            return Err(CofferError::Reentrant(CofferReentrant {}));
        }
        self.is_updating.set(true);
        let result = self.deposit_inner(assets, receiver);
        self.is_updating.set(false);
        result
    }

    fn deposit_inner(&mut self, assets: U256, receiver: Address) -> Result<U256, CofferError> {
        if assets.is_zero() {
            return Err(CofferError::ZeroAssets(ZeroAssets {}));
        }
        if self.is_deposits_paused.get() {
            return Err(CofferError::DepositsPaused(DepositsPausedError {}));
        }

        // Check global cap
        // Audit fix (#36): gate on tracked_assets_wei (internal accounting), NOT
        // total_assets() (live balance), so a direct USDC donation cannot push
        // the contract over deposit_cap_wei and DoS all further deposits.
        let new_tvl = self.tracked_assets_wei.get().saturating_add(assets);
        if new_tvl > self.deposit_cap_wei.get() {
            return Err(CofferError::DepositCap(DepositCapExceeded {
                requested: assets,
                cap: self.deposit_cap_wei.get(),
            }));
        }

        // Check per-user cap
        let user_prev = self.per_user_deposits.getter(receiver).get();
        let user_new = user_prev.saturating_add(assets);
        if user_new > self.per_user_cap_wei.get() {
            return Err(CofferError::PerUserCap(PerUserCapExceeded {
                requested: assets,
                cap: self.per_user_cap_wei.get(),
            }));
        }

        // Check USDC isn't paused (M7 fix from TDD audit).
        // Phase theta.1 fix (2026-05-25): pre-fix `.unwrap_or(false)` silently
        // treated USDC as live when `paused()` reverted. A paused-USDC deposit
        // would then attempt transferFrom which also reverts — but only AFTER
        // share-issuance math ran on stale state. New behavior: bubble the
        // RPC failure up as UsdcStateUnreadable, refuse to proceed.
        let usdc = IUsdc::new(self.asset.get());
        let is_usdc_paused = usdc
            .paused(self.vm(), Call::new())
            .map_err(|_| CofferError::UsdcStateUnreadable(UsdcStateUnreadable {}))?;
        if is_usdc_paused {
            self.vm().log(UsdcPausedDetected {});
            return Err(CofferError::UsdcPaused(UsdcPaused {}));
        }

        // Compute shares before transfer (preserves ratio)
        let shares = self.convert_to_shares(assets);

        // Pull USDC
        //
        // Audit BBB-2 fix: prior code returned `CofferError::ZeroAssets` on
        // transferFrom failure, which is misleading — the actual failure mode
        // is "USDC.transferFrom returned false or reverted" (no allowance,
        // sender has insufficient balance, USDC contract paused). The shared
        // `TransferFailed` variant added in ZZ-5 now surfaces the real cause.
        let sender = self.vm().msg_sender();
        let recipient = self.vm().contract_address();
        let ctx = Call::new_mutating(self);
        let ok = usdc
            .transfer_from(self.vm(), ctx, sender, recipient, assets)
            .unwrap_or(false);
        if !ok {
            return Err(CofferError::TransferFailed(TransferFailed {
                token: self.asset.get(),
                to: self.vm().contract_address(),
                amount: assets,
            }));
        }

        // Mint shares
        let prev_balance = self.share_balances.getter(receiver).get();
        self.share_balances.setter(receiver).set(prev_balance.saturating_add(shares));
        self.total_shares.set(self.total_shares.get().saturating_add(shares));
        self.per_user_deposits.setter(receiver).set(user_new);

        // Audit fix (#36): track deposited assets for the cap gate (post-transfer).
        self.tracked_assets_wei.set(self.tracked_assets_wei.get().saturating_add(assets));

        self.vm().log(Deposit {
            sender,
            owner: receiver,
            assets,
            shares,
        });

        self.snapshot_tvl_if_due();

        Ok(shares)
    }

    pub fn withdraw(
        &mut self,
        assets: U256,
        receiver: Address,
        owner: Address,
    ) -> Result<U256, CofferError> {
        if self.is_updating.get() {
            return Err(CofferError::Reentrant(CofferReentrant {}));
        }
        self.is_updating.set(true);
        let result = self.withdraw_inner(assets, receiver, owner);
        self.is_updating.set(false);
        result
    }

    fn withdraw_inner(
        &mut self,
        assets: U256,
        receiver: Address,
        owner: Address,
    ) -> Result<U256, CofferError> {
        let sender = self.vm().msg_sender();
        // Spender must be owner or have allowance
        if sender != owner {
            let allowance = self.share_allowances.getter(owner).getter(sender).get();
            // Audit FIRE78-COF1 fix: same round-up applied to allowance debit.
            let shares_needed = self.convert_to_shares_ceil(assets);
            if allowance < shares_needed {
                return Err(CofferError::Unauthorized(UnauthorizedCaller { caller: sender }));
            }
            self.share_allowances
                .setter(owner)
                .setter(sender)
                .set(allowance - shares_needed);
        }

        if self.is_withdrawals_paused.get() {
            return Err(CofferError::WithdrawalsPaused(WithdrawalsPausedError {}));
        }

        // Block withdrawals while user is pending liquidation.
        //
        // Audit MMMM-1 fix: pre-fix this used `if let Ok((..., is_paused))`
        // which silently dropped the pause-check on any Plinth call failure.
        // Same fail-open pattern as KKK-3 in `adapter_pull`. Liquidation-
        // evasion vector: a user under pending liquidation could trigger a
        // Plinth call failure and withdraw their shares before Vigil seized.
        // Wave-A's Plinth.is_paused-check fix only addressed `adapter_pull`
        // — withdraw kept the broken pattern. Eighth audit-trail-drift catch.
        // Now: `map_err` to `PlinthUnreachable` (reused from KKK-3 — same
        // error semantics, same withdraw-side blocker). Fail loud, never
        // fail-open on safety-critical pause-state reads.
        let plinth = IPlinth::new(self.plinth_address.get());
        let (_, _, _, is_paused) = plinth
            .get_account(self.vm(), Call::new(), owner)
            .map_err(|_| CofferError::PlinthUnreachable(PlinthUnreachable { user: owner }))?;
        if is_paused {
            return Err(CofferError::PendingLiquidation(PendingLiquidation { user: owner }));
        }

        // Audit FIRE78-COF1 fix: ERC-4626 spec — withdraw path rounds shares UP.
        // Pre-fix used the round-down `convert_to_shares` which under-charged
        // share burns and let users accumulate free dust on repeated small
        // withdrawals. Now the user surrenders at least as many shares as
        // the assets they take.
        let shares = self.convert_to_shares_ceil(assets);
        let owner_shares = self.share_balances.getter(owner).get();
        if owner_shares < shares {
            return Err(CofferError::InsufficientShares(InsufficientShares {
                requested: shares,
                available: owner_shares,
            }));
        }

        // Burn shares
        self.share_balances.setter(owner).set(owner_shares - shares);
        self.total_shares.set(self.total_shares.get().saturating_sub(shares));

        // Track per-user deposit (decreases for accounting; per-user cap is on cumulative deposit notion)
        let prev_user_deposits = self.per_user_deposits.getter(owner).get();
        self.per_user_deposits
            .setter(owner)
            .set(prev_user_deposits.saturating_sub(assets));

        // Transfer USDC
        //
        // AUDIT ZZ-5 (CRITICAL money-loss fix): prior code did
        //   `let _ = usdc.transfer(...)` which SILENTLY DISCARDED the result.
        // If USDC.transfer fails (e.g. USDC contract paused mid-tx, downstream
        // revert, balance race), the function still returned Ok(shares). The
        // user's shares were already burned by this line — share burn
        // committed, USDC transfer failed → permanent money loss.
        let usdc = IUsdc::new(self.asset.get());
        let ctx = Call::new_mutating(self);
        let transfer_ok = usdc.transfer(self.vm(), ctx, receiver, assets).unwrap_or(false);
        if !transfer_ok {
            return Err(CofferError::TransferFailed(TransferFailed {
                token: self.asset.get(),
                to: receiver,
                amount: assets,
            }));
        }

        // Audit fix (#36): keep tracked assets in sync on the way out.
        self.tracked_assets_wei.set(self.tracked_assets_wei.get().saturating_sub(assets));

        self.vm().log(Withdraw {
            sender,
            receiver,
            owner,
            assets,
            shares,
        });

        self.snapshot_tvl_if_due();

        Ok(shares)
    }

    // ===== Adapter-protected pull =====
    /// Adapters call this to pull collateral for a venue position.
    /// Subject to per-adapter per-block notional cap (TDD §17.1 M7 fix).
    pub fn adapter_pull(
        &mut self,
        amount: U256,
        from_user: Address,
        to: Address,
    ) -> Result<(), CofferError> {
        if self.is_updating.get() {
            return Err(CofferError::Reentrant(CofferReentrant {}));
        }
        self.is_updating.set(true);
        let result = self.adapter_pull_inner(amount, from_user, to);
        self.is_updating.set(false);
        result
    }

    fn adapter_pull_inner(
        &mut self,
        amount: U256,
        from_user: Address,
        to: Address,
    ) -> Result<(), CofferError> {
        let caller = self.vm().msg_sender();
        if !self.approved_adapters.getter(caller).get() {
            return Err(CofferError::Unauthorized(UnauthorizedCaller { caller }));
        }

        // Phase 2a fix: gate adapter_pull behind withdrawals pause.
        // Adapter pulls are economically equivalent to withdrawals — if
        // withdrawals are paused (e.g. during incident response), adapter
        // pulls must also be blocked to prevent collateral drain.
        if self.is_withdrawals_paused.get() {
            return Err(CofferError::WithdrawalsPaused(WithdrawalsPausedError {}));
        }

        // Agent A / Agent F audit fix: block adapter_pull when the user account
        // is paused for pending liquidation. Without this an adapter could drain
        // collateral while Vigil is mid-liquidation.
        //
        // Audit KKK-3 fix: pre-fix used `if let Ok((..., is_paused))` which
        // silently dropped the entire pause-check on any Plinth call failure.
        let plinth_check = IPlinth::new(self.plinth_address.get());
        let (_, _, _, is_paused) = plinth_check
            .get_account(self.vm(), Call::new(), from_user)
            .map_err(|_| CofferError::PlinthUnreachable(PlinthUnreachable { user: from_user }))?;
        if is_paused {
            return Err(CofferError::PendingLiquidation(PendingLiquidation { user: from_user }));
        }

        let block_num = self.vm().block_number();
        let mut budget = self.adapter_budgets.setter(caller);
        if budget.last_block.get().to::<u64>() != block_num {
            budget.last_block.set(U64::from(block_num));
            budget.used_this_block_wei.set(U256::ZERO);
        }
        let used = budget.used_this_block_wei.get();
        let cap = budget.per_block_cap_wei.get();
        if used.saturating_add(amount) > cap {
            self.vm().log(AdapterCapHit {
                adapter: caller,
                attempted_wei: amount,
                cap_wei: cap,
            });
            return Err(CofferError::AdapterCap(AdapterCapExceeded {
                adapter: caller,
                requested: amount,
                remaining: cap.saturating_sub(used),
            }));
        }
        budget.used_this_block_wei.set(used + amount);

        // Bookkeeping: subtract from user's share via implicit accounting
        // Phase 2a fix: use convert_to_shares_ceil (round UP) so the vault
        // never under-charges share burns on adapter pulls. Same rationale
        // as the ERC-4626 withdraw path (FIRE78-COF1).
        let user_shares = self.share_balances.getter(from_user).get();
        let shares_to_burn = self.convert_to_shares_ceil(amount);
        if user_shares < shares_to_burn {
            return Err(CofferError::InsufficientShares(InsufficientShares {
                requested: shares_to_burn,
                available: user_shares,
            }));
        }
        self.share_balances.setter(from_user).set(user_shares - shares_to_burn);
        self.total_shares.set(self.total_shares.get().saturating_sub(shares_to_burn));

        // Send USDC to adapter destination
        let usdc = IUsdc::new(self.asset.get());
        let ctx = Call::new_mutating(self);
        let transfer_ok = usdc.transfer(self.vm(), ctx, to, amount).unwrap_or(false);
        if !transfer_ok {
            return Err(CofferError::TransferFailed(TransferFailed {
                token: self.asset.get(),
                to,
                amount,
            }));
        }

        // Audit fix (#36): keep tracked assets in sync on adapter pulls too.
        self.tracked_assets_wei.set(self.tracked_assets_wei.get().saturating_sub(amount));

        Ok(())
    }

    // ===== Admin (timelock for params, multisig for emergency pause) =====
    /// Audit F-32 fix: adapter approval is a parameter change, so timelock-only.
    pub fn set_adapter(
        &mut self,
        adapter: Address,
        approved: bool,
        per_block_cap_wei: U256,
    ) -> Result<(), CofferError> {
        self.assert_timelock()?;
        self.approved_adapters.setter(adapter).set(approved);
        self.adapter_budgets.setter(adapter).per_block_cap_wei.set(per_block_cap_wei);
        Ok(())
    }

    /// View: is `adapter` on the approved orchestrators list? Used by
    /// `AtriumRouter` (defense-in-depth check that no sub-adapter is also a
    /// direct orchestrator). Audit-fix 2026-05-24 (Auditor A C-4): pre-fix the
    /// Router referenced `is_adapter_approved` but Coffer did not expose any
    /// public getter for the `approved_adapters` mapping, so every Router
    /// call reverted with empty data. Stylus auto-exports this as
    /// `isAdapterApproved(address)(bool)`.
    pub fn is_adapter_approved(&self, adapter: Address) -> bool {
        self.approved_adapters.getter(adapter).get()
    }

    /// Unified pause — pauses both deposits and withdrawals. Audit G-6 fix:
    /// PraetorTimelock.emergencyPause forwards `IPausable(target).pause(reason)`
    /// so every pausable Atrium contract must expose this uniform ABI.
    /// Accepts caller in {multisig, timelock}.
    pub fn pause(&mut self, reason: B256) -> Result<(), CofferError> {
        let caller = self.vm().msg_sender();
        if caller != self.praetor_multisig.get() && caller != self.praetor_timelock.get() {
            return Err(CofferError::Unauthorized(UnauthorizedCaller { caller }));
        }
        self.is_deposits_paused.set(true);
        self.is_withdrawals_paused.set(true);
        self.vm().log(DepositsPaused { reason });
        self.vm().log(WithdrawalsPaused { reason });
        Ok(())
    }

    /// Emergency pause — multisig-only, instant (no timelock).
    pub fn pause_deposits(&mut self, reason: B256) -> Result<(), CofferError> {
        self.assert_praetor()?;
        self.is_deposits_paused.set(true);
        self.vm().log(DepositsPaused { reason });
        Ok(())
    }

    /// Resume → parameter change → timelock-only.
    pub fn resume_deposits(&mut self) -> Result<(), CofferError> {
        self.assert_timelock()?;
        self.is_deposits_paused.set(false);
        self.vm().log(DepositsResumed {});
        Ok(())
    }

    pub fn pause_withdrawals(&mut self, reason: B256) -> Result<(), CofferError> {
        self.assert_praetor()?;
        self.is_withdrawals_paused.set(true);
        self.vm().log(WithdrawalsPaused { reason });
        Ok(())
    }

    pub fn resume_withdrawals(&mut self) -> Result<(), CofferError> {
        self.assert_timelock()?;
        self.is_withdrawals_paused.set(false);
        self.vm().log(WithdrawalsResumed {});
        Ok(())
    }
}

impl Coffer {
    fn assert_praetor(&self) -> Result<(), CofferError> {
        if self.vm().msg_sender() != self.praetor_multisig.get() {
            return Err(CofferError::Unauthorized(UnauthorizedCaller {
                caller: self.vm().msg_sender(),
            }));
        }
        Ok(())
    }

    /// Snapshot TVL hourly; trip circuit-breaker if drop > 30% in 1h.
    fn snapshot_tvl_if_due(&mut self) {
        let now = self.vm().block_timestamp();
        let prev_time = self.last_tvl_snapshot_time.get().to::<u64>();
        if now.saturating_sub(prev_time) < 3_600 {
            return;
        }
        let prev_tvl = self.last_tvl_snapshot_wei.get();
        let current_tvl = self.total_assets();
        if !prev_tvl.is_zero() && current_tvl < prev_tvl {
            let drop = (prev_tvl - current_tvl).saturating_mul(U256::from(10_000u64)) / prev_tvl;
            if drop > U256::from(self.tvl_drop_threshold_bps.get().to::<u16>()) {
                self.is_deposits_paused.set(true);
                self.is_withdrawals_paused.set(true);
                // keccak256("tvl_drop_1h") precomputed (saves runtime hash + string).
                let trigger = B256::from(alloy_primitives::hex!(
                    "8fb6df1b1f5ec1be3e823af6c2ff1de4e0e7e4e7c54fed31a01c4ab9e2ef9b06"
                ));
                self.vm().log(CircuitBreakerTripped {
                    trigger,
                    measurement: drop,
                });
            }
        }
        self.last_tvl_snapshot_wei.set(current_tvl);
        self.last_tvl_snapshot_time.set(U64::from(now));
    }
}

// =============================================================================
// proptest harnesses
// =============================================================================
#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    // Property tests (proptest) for ERC-4626 invariants live here.
    // They run only on host targets, not the wasm contract target.
    //
    // Required (per TDD §14.3 + §14.2 Invariant 4):
    //   - share supply is monotonic (only burn via withdraw)
    //   - deposit then immediate withdraw is approximately neutral (1 share-of-loss for rounding)
    //   - per-adapter per-block cap is never exceeded
    //   - per-user cap never exceeded
    //
    // Land in Wave 1 alongside the TestVM fixtures for Plinth.
}
