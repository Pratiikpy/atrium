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
// Host unit tests (TestVM)
// =============================================================================
//
// These run natively under `cargo test` thanks to the `stylus-test` dev-dep
// feature (Cargo.toml), which swaps the on-chain WasmVM host for the in-memory
// TestVM mock. Cross-contract reads/writes (USDC.balanceOf / paused /
// transfer / transferFrom, Plinth.getAccount) are stubbed with
// vm.mock_static_call (view) / vm.mock_call (write) using EXACT abi-encoded
// calldata so selectors match the sol_interface! expansion.
//
// TestVM CAVEAT (verified against stylus-test 0.10.7 src/vm.rs):
//   The mock host keeps a SINGLE global `return_data` buffer. Each mock_call /
//   mock_static_call registration overwrites it, and `read_return_data` (which
//   the SDK uses to fetch every call's return bytes) reads THAT buffer, not the
//   per-(to,calldata) matched entry. Consequently a contract function that
//   issues two cross-contract calls needing DIFFERENT return values (e.g. a
//   happy-path deposit needs USDC.paused()==false AND USDC.transferFrom()==true
//   in the same call) cannot be mocked to fully succeed: the second value
//   overwrites the first. We therefore exercise:
//     - pure share math (convert_*) + virtual-offset, seeding vault state via
//       the contract's own (test-visible) storage fields,
//     - every REVERT path (each reverts at/ before the conflicting 2nd call),
//   and assert real invariants throughout. The full happy-path *success* of
//   deposit/withdraw/adapter_pull is covered by Foundry e2e against live
//   contracts, not here (see `gaps`). No assertion is weakened to pass.
#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use super::*;
    use alloy_sol_types::SolCall;
    use stylus_sdk::testing::TestVM;

    // CofferError intentionally does not derive Debug (it's a SolidityError ABI
    // enum), so Result::unwrap / {:?} are unavailable. These helpers give
    // unwrap-with-context and a stable label for asserts without touching the
    // production type.
    fn ok<T>(r: Result<T, CofferError>) -> T {
        match r {
            Ok(v) => v,
            Err(e) => panic!("expected Ok, got Err({})", err_label(&e)),
        }
    }

    fn err_label(e: &CofferError) -> &'static str {
        match e {
            CofferError::DepositsPaused(_) => "DepositsPaused",
            CofferError::WithdrawalsPaused(_) => "WithdrawalsPaused",
            CofferError::PendingLiquidation(_) => "PendingLiquidation",
            CofferError::DepositCap(_) => "DepositCap",
            CofferError::PerUserCap(_) => "PerUserCap",
            CofferError::AdapterCap(_) => "AdapterCap",
            CofferError::Unauthorized(_) => "Unauthorized",
            CofferError::ZeroAssets(_) => "ZeroAssets",
            CofferError::InsufficientShares(_) => "InsufficientShares",
            CofferError::UsdcPaused(_) => "UsdcPaused",
            CofferError::UsdcStateUnreadable(_) => "UsdcStateUnreadable",
            CofferError::TransferFailed(_) => "TransferFailed",
            CofferError::PlinthUnreachable(_) => "PlinthUnreachable",
            CofferError::Reentrant(_) => "Reentrant",
        }
    }

    fn label_of<T>(r: &Result<T, CofferError>) -> &'static str {
        match r {
            Ok(_) => "Ok",
            Err(e) => err_label(e),
        }
    }

    // Mirror the cross-contract signatures EXACTLY (same camelCase names the
    // sol_interface! blocks declare) so abi_encode() yields matching selectors.
    sol! {
        function balanceOf(address account) external view returns (uint256);
        function paused() external view returns (bool);
        function transfer(address to, uint256 value) external returns (bool);
        function transferFrom(address from, address to, uint256 value) external returns (bool);
        function getAccount(address user) external view returns (uint256, uint256, uint256, bool);
    }

    // ---- fixed test addresses ----
    fn usdc_addr() -> Address { Address::from([0x11u8; 20]) }
    fn plinth_addr() -> Address { Address::from([0x22u8; 20]) }
    fn praetor() -> Address { Address::from([0x33u8; 20]) }
    fn timelock() -> Address { Address::from([0x44u8; 20]) }
    fn coffer_addr() -> Address { Address::from([0xC0u8; 20]) }
    fn alice() -> Address { Address::from([0xA1u8; 20]) }
    fn bob() -> Address { Address::from([0xB0u8; 20]) }
    fn adapter() -> Address { Address::from([0xADu8; 20]) }

    const HUGE: u64 = u64::MAX;

    /// Build an initialized Coffer wired to mocked USDC + Plinth.
    fn fresh(vm: &TestVM, deposit_cap: U256, per_user_cap: U256) -> Coffer {
        vm.set_contract_address(coffer_addr());
        let mut c = Coffer::from(vm);
        c.constructor(
            usdc_addr(),
            plinth_addr(),
            praetor(),
            timelock(),
            deposit_cap,
            per_user_cap,
        );
        c
    }

    // ---- mock registration helpers (single-value returns) ----
    // NB: because of the single-buffer caveat, whichever of these is called
    // LAST sets the global return buffer every cross-contract call will read.
    fn mock_usdc_paused(vm: &TestVM, paused: bool) {
        let data = pausedCall {}.abi_encode();
        let ret = pausedCall::abi_encode_returns(&paused);
        vm.mock_static_call(usdc_addr(), data, Ok(ret));
    }
    fn mock_usdc_paused_revert(vm: &TestVM) {
        let data = pausedCall {}.abi_encode();
        vm.mock_static_call(usdc_addr(), data, Err(vec![0xde, 0xad]));
    }
    fn mock_usdc_balance(vm: &TestVM, who: Address, bal: U256) {
        let data = balanceOfCall { account: who }.abi_encode();
        let ret = balanceOfCall::abi_encode_returns(&bal);
        vm.mock_static_call(usdc_addr(), data, Ok(ret));
    }
    fn mock_usdc_transfer_from(vm: &TestVM, from: Address, to: Address, value: U256, success: bool) {
        let data = transferFromCall { from, to, value }.abi_encode();
        let ret = transferFromCall::abi_encode_returns(&success);
        vm.mock_call(usdc_addr(), data, U256::ZERO, Ok(ret));
    }
    // Kept for the (un-mockable here) happy-path transfer leg — see the caveat
    // at the top of this module. Foundry e2e exercises USDC.transfer success.
    #[allow(dead_code)]
    fn mock_usdc_transfer(vm: &TestVM, to: Address, value: U256, success: bool) {
        let data = transferCall { to, value }.abi_encode();
        let ret = transferCall::abi_encode_returns(&success);
        vm.mock_call(usdc_addr(), data, U256::ZERO, Ok(ret));
    }
    /// Plinth.getAccount -> (equity, im, mm, is_paused). Only the bool is read.
    fn mock_plinth_account(vm: &TestVM, user: Address, is_paused: bool) {
        let data = getAccountCall { user }.abi_encode();
        let ret = getAccountCall::abi_encode_returns_tuple(&(
            U256::ZERO, U256::ZERO, U256::ZERO, is_paused,
        ));
        vm.mock_static_call(plinth_addr(), data, Ok(ret));
    }
    fn mock_plinth_revert(vm: &TestVM, user: Address) {
        let data = getAccountCall { user }.abi_encode();
        vm.mock_static_call(plinth_addr(), data, Err(vec![0xba, 0xad]));
    }

    /// Seed vault accounting directly via the (test-visible) storage fields so
    /// we don't depend on a happy-path deposit (which is un-mockable, see
    /// caveat). `live_usdc` becomes the mocked balanceOf the vault reports.
    fn seed_vault(
        vm: &TestVM,
        c: &mut Coffer,
        total_shares: U256,
        live_usdc: U256,
        tracked: U256,
    ) {
        c.total_shares.set(total_shares);
        c.tracked_assets_wei.set(tracked);
        mock_usdc_balance(vm, coffer_addr(), live_usdc);
    }

    // =====================================================================
    // ERC-4626 share math — deposit mints shares, supply is monotonic.
    // convert_to_shares is the exact function deposit() uses to size the mint,
    // so asserting its monotonic, positive behavior validates the mint logic
    // without needing the (un-mockable) full deposit success path.
    // =====================================================================
    #[test]
    fn convert_to_shares_is_monotonic_and_positive() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));

        // Empty vault: first depositor. shares = assets*(0+1e6)/(0+1).
        seed_vault(&vm, &mut c, U256::ZERO, U256::ZERO, U256::ZERO);
        let s_small = c.convert_to_shares(U256::from(1u64));
        let s_big = c.convert_to_shares(U256::from(1_000u64));
        assert!(s_small > U256::ZERO, "1 wei deposit still mints shares");
        assert!(s_big > s_small, "more assets -> strictly more shares");
        assert_eq!(s_small, U256::from(1_000_000u64), "virtual offset = 1e6/wei on empty vault");

        // Seeded vault (1,000 shares vs 1,000 USDC): ratio ~1:1 plus offset.
        seed_vault(
            &vm, &mut c,
            U256::from(1_000_000_000u64),  // 1,000 shares (6dp)
            U256::from(1_000_000_000u64),  // 1,000 USDC
            U256::from(1_000_000_000u64),
        );
        let a = c.convert_to_shares(U256::from(100_000_000u64));
        let b = c.convert_to_shares(U256::from(200_000_000u64));
        assert!(b > a, "monotonic in seeded vault");
        assert!(a > U256::ZERO);
    }

    // =====================================================================
    // First-deposit virtual-shares offset blunts the inflation grief.
    // Classic attack: attacker mints ~1 share for 1 wei, then DONATES USDC to
    // inflate share price so the next depositor rounds to 0 shares. The 1e6
    // virtual-share offset must keep the victim's mint well above zero.
    // =====================================================================
    #[test]
    fn virtual_offset_blunts_first_depositor_inflation() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));

        // Post-attack state: attacker holds 1e6 shares (the offset mint for 1
        // wei), and has donated 10 USDC directly so live balance = 1 + 10e6.
        let donation = U256::from(10_000_000u64); // 10 USDC
        seed_vault(
            &vm, &mut c,
            U256::from(1_000_000u64),          // attacker's 1e6 shares
            U256::from(1u64) + donation,       // 1 wei + donation live
            U256::from(1u64),                  // only 1 wei was ever deposited
        );

        // Victim deposits 1 USDC. With the offset they must NOT round to 0.
        let victim_assets = U256::from(1_000_000u64); // 1 USDC
        let s_vic = c.convert_to_shares(victim_assets);
        assert!(s_vic > U256::ZERO, "victim not griefed to 0 shares: {s_vic}");

        // And the victim's shares must redeem for a meaningful fraction of what
        // they put in — bounded loss, not ~100% (the attack's goal).
        // Simulate the victim's post-deposit redemption value.
        let new_supply = U256::from(1_000_000u64) + s_vic;
        let new_live = U256::from(1u64) + donation + victim_assets;
        c.total_shares.set(new_supply);
        mock_usdc_balance(&vm, coffer_addr(), new_live);
        let redeemable = c.convert_to_assets(s_vic);
        assert!(
            redeemable >= victim_assets / U256::from(2u64),
            "victim retains >50% value: in={victim_assets} out={redeemable}"
        );
    }

    // =====================================================================
    // convert_to_shares / convert_to_assets round-trip is approx-neutral
    // (floor division can only lose, never create value), and the ceil
    // variant rounds UP by at most 1.
    // =====================================================================
    #[test]
    fn convert_round_trip_is_approx_neutral() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        seed_vault(
            &vm, &mut c,
            U256::from(1_000_000_000u64),
            U256::from(1_000_000_000u64),
            U256::from(1_000_000_000u64),
        );

        let assets = U256::from(123_456_789u64);
        let shares = c.convert_to_shares(assets);
        let back = c.convert_to_assets(shares);
        assert!(back <= assets, "round-trip never creates value");
        let lost = assets - back;
        assert!(lost <= U256::from(2u64), "round-trip loss bounded (<=2 wei): {lost}");

        let ceil = c.convert_to_shares_ceil(assets);
        assert!(ceil >= shares, "ceil >= floor");
        assert!(ceil - shares <= U256::from(1u64), "ceil within 1 of floor");
        assert_eq!(c.convert_to_shares_ceil(U256::ZERO), U256::ZERO, "0 assets -> 0 shares");
    }

    // =====================================================================
    // #36 fix: deposit cap gates on tracked_assets_wei, NOT live balance.
    // A direct USDC donation (live balance jump) must not push the contract
    // over deposit_cap and DoS further deposits. The cap check runs BEFORE any
    // cross-contract call, so we can assert both branches cleanly.
    // =====================================================================
    #[test]
    fn deposit_cap_uses_tracked_assets_not_live_balance() {
        let vm = TestVM::new();
        let cap = U256::from(100_000_000u64); // 100 USDC
        let mut c = fresh(&vm, cap, U256::from(HUGE));

        // tracked = 40 USDC, but a whale DONATED 1,000 USDC: live >> cap.
        let tracked = U256::from(40_000_000u64);
        let donation = U256::from(1_000_000_000u64);
        seed_vault(&vm, &mut c, U256::ZERO, tracked + donation, tracked);

        // A 50 USDC deposit: tracked would be 90 <= 100 -> must PASS the cap.
        // It will still revert later at the (un-mockable) USDC paused/transfer
        // stage, so we assert it is NOT a DepositCap error. Pre-#36 (gating on
        // live balance) this WOULD have been DepositCap.
        vm.set_sender(bob());
        mock_usdc_paused(&vm, false); // let it past the paused gate...
        let r = c.deposit(U256::from(50_000_000u64), bob());
        assert!(
            !matches!(r, Err(CofferError::DepositCap(_))),
            "donation must not trip the cap (#36); got {}",
            label_of(&r)
        );

        // A 70 USDC deposit: tracked would be 110 > 100 -> MUST be DepositCap.
        let over = c.deposit(U256::from(70_000_000u64), bob());
        assert!(
            matches!(over, Err(CofferError::DepositCap(_))),
            "tracked cap enforced: {}",
            label_of(&over)
        );
    }

    // =====================================================================
    // Per-user cap enforced. The check reads per_user_deposits[receiver] and
    // runs before any cross-contract call, so both branches assert cleanly.
    // =====================================================================
    #[test]
    fn per_user_cap_enforced() {
        let vm = TestVM::new();
        let per_user = U256::from(50_000_000u64); // 50 USDC per user
        let mut c = fresh(&vm, U256::from(HUGE), per_user);
        seed_vault(&vm, &mut c, U256::ZERO, U256::ZERO, U256::ZERO);

        // Alice already at her cap.
        c.per_user_deposits.setter(alice()).set(per_user);

        // 1 more wei for alice -> over per-user cap (fires before any call).
        vm.set_sender(alice());
        let over = c.deposit(U256::from(1u64), alice());
        assert!(
            matches!(over, Err(CofferError::PerUserCap(_))),
            "per-user cap enforced: {}",
            label_of(&over)
        );

        // A different receiver (bob) at 0 is unaffected by alice's cap: a 50
        // USDC deposit must NOT be PerUserCap (it reverts later at USDC stage).
        vm.set_sender(bob());
        mock_usdc_paused(&vm, false);
        let r = c.deposit(per_user, bob());
        assert!(
            !matches!(r, Err(CofferError::PerUserCap(_))),
            "per-user cap is per-receiver; got {}",
            label_of(&r)
        );
    }

    // =====================================================================
    // Per-adapter per-block cap enforced on adapter_pull, and the budget
    // RESETS across blocks. The cap check runs after getAccount but before the
    // USDC transfer, so an over-cap pull reverts AdapterCap with no transfer —
    // fully mockable (getAccount(not-paused) is the only call reached).
    // =====================================================================
    #[test]
    fn adapter_per_block_cap_enforced() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        // Give alice collateral so the share-burn accounting isn't the blocker.
        seed_vault(&vm, &mut c, U256::from(10_000_000_000u64), U256::from(10_000_000_000u64), U256::from(10_000_000_000u64));
        c.share_balances.setter(alice()).set(U256::from(10_000_000_000u64));

        // Approve adapter with a 100 USDC/block cap (timelock-only).
        let per_block = U256::from(100_000_000u64);
        vm.set_sender(timelock());
        ok(c.set_adapter(adapter(), true, per_block));

        // Block 10: simulate 80 USDC already used this block.
        vm.set_block_number(10);
        {
            let mut b = c.adapter_budgets.setter(adapter());
            b.last_block.set(U64::from(10u64));
            b.used_this_block_wei.set(U256::from(80_000_000u64));
        }

        vm.set_sender(adapter());
        mock_plinth_account(&vm, alice(), false); // not pending liq (last mock)

        // 30 more -> 80+30 = 110 > 100 -> AdapterCap (no transfer reached).
        let over = c.adapter_pull(U256::from(30_000_000u64), alice(), bob());
        match over {
            Err(CofferError::AdapterCap(e)) => {
                // remaining must reflect the in-block usage (100-80 = 20).
                assert_eq!(e.remaining, U256::from(20_000_000u64), "remaining = cap - used");
            }
            other => panic!("expected AdapterCap, got {}", label_of(&other)),
        }
    }

    #[test]
    fn adapter_budget_resets_next_block() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        seed_vault(&vm, &mut c, U256::from(10_000_000_000u64), U256::from(10_000_000_000u64), U256::from(10_000_000_000u64));
        c.share_balances.setter(alice()).set(U256::from(10_000_000_000u64));

        // Cap 20 USDC/block. Used 80 at block 5 (a previous block).
        vm.set_sender(timelock());
        ok(c.set_adapter(adapter(), true, U256::from(20_000_000u64)));
        {
            let mut b = c.adapter_budgets.setter(adapter());
            b.last_block.set(U64::from(5u64));
            b.used_this_block_wei.set(U256::from(80_000_000u64));
        }

        // New block 6: budget must RESET to 0 used. A 30 USDC pull (> cap 20)
        // therefore reports remaining == FULL cap (20), proving the reset.
        // If the stale 80 carried over, remaining would saturate to 0.
        vm.set_block_number(6);
        vm.set_sender(adapter());
        mock_plinth_account(&vm, alice(), false);
        let r = c.adapter_pull(U256::from(30_000_000u64), alice(), bob());
        match r {
            Err(CofferError::AdapterCap(e)) => {
                assert_eq!(
                    e.remaining,
                    U256::from(20_000_000u64),
                    "budget reset: remaining == full cap, not saturated 0"
                );
            }
            other => panic!("expected AdapterCap, got {}", label_of(&other)),
        }
    }

    #[test]
    fn adapter_pull_rejects_unauthorized_caller() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        // No approved adapter: a random caller is rejected (first check).
        vm.set_sender(bob());
        let r = c.adapter_pull(U256::from(1u64), alice(), bob());
        assert!(
            matches!(r, Err(CofferError::Unauthorized(_))),
            "unapproved caller rejected: {}",
            label_of(&r)
        );
    }

    #[test]
    fn adapter_pull_respects_withdrawals_paused() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        vm.set_sender(timelock());
        ok(c.set_adapter(adapter(), true, U256::from(HUGE)));

        // Multisig pauses withdrawals (instant, no timelock).
        vm.set_sender(praetor());
        ok(c.pause_withdrawals(B256::ZERO));

        vm.set_sender(adapter());
        let r = c.adapter_pull(U256::from(1u64), alice(), bob());
        assert!(
            matches!(r, Err(CofferError::WithdrawalsPaused(_))),
            "adapter_pull blocked while withdrawals paused: {}",
            label_of(&r)
        );
    }

    #[test]
    fn adapter_pull_respects_plinth_pending_liquidation() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        seed_vault(&vm, &mut c, U256::from(1_000_000_000u64), U256::from(1_000_000_000u64), U256::from(1_000_000_000u64));
        c.share_balances.setter(alice()).set(U256::from(1_000_000_000u64));

        vm.set_sender(timelock());
        ok(c.set_adapter(adapter(), true, U256::from(HUGE)));

        // Plinth reports alice paused (pending liquidation) -> blocked before
        // the budget check and before any transfer.
        vm.set_sender(adapter());
        mock_plinth_account(&vm, alice(), true);
        let r = c.adapter_pull(U256::from(1_000_000u64), alice(), bob());
        assert!(
            matches!(r, Err(CofferError::PendingLiquidation(_))),
            "adapter_pull blocked for pending-liq user: {}",
            label_of(&r)
        );
    }

    #[test]
    fn adapter_pull_fails_loud_when_plinth_unreachable() {
        // KKK-3: a Plinth call failure must NOT silently bypass the pause check.
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        seed_vault(&vm, &mut c, U256::from(1_000_000_000u64), U256::from(1_000_000_000u64), U256::from(1_000_000_000u64));
        c.share_balances.setter(alice()).set(U256::from(1_000_000_000u64));

        vm.set_sender(timelock());
        ok(c.set_adapter(adapter(), true, U256::from(HUGE)));

        vm.set_sender(adapter());
        mock_plinth_revert(&vm, alice());
        let r = c.adapter_pull(U256::from(1_000_000u64), alice(), bob());
        assert!(
            matches!(r, Err(CofferError::PlinthUnreachable(_))),
            "Plinth unreachable must fail loud, not fail-open: {}",
            label_of(&r)
        );
    }

    // =====================================================================
    // USDC paused() == true  -> UsdcPaused.
    // USDC paused() reverts   -> UsdcStateUnreadable (Phase theta.1: refuse to
    // operate against unknown USDC state instead of fail-open).
    // Both revert at/ before the conflicting transferFrom, so fully mockable.
    // =====================================================================
    #[test]
    fn deposit_refuses_when_usdc_paused() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        seed_vault(&vm, &mut c, U256::ZERO, U256::ZERO, U256::ZERO);
        mock_usdc_paused(&vm, true); // last mock -> paused() reads true
        vm.set_sender(alice());
        let r = c.deposit(U256::from(1_000_000u64), alice());
        assert!(
            matches!(r, Err(CofferError::UsdcPaused(_))),
            "paused USDC must block deposit: {}",
            label_of(&r)
        );
        assert_eq!(c.total_supply(), U256::ZERO, "no shares minted on paused USDC");
    }

    #[test]
    fn deposit_refuses_when_usdc_state_unreadable() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        seed_vault(&vm, &mut c, U256::ZERO, U256::ZERO, U256::ZERO);
        mock_usdc_paused_revert(&vm); // paused() reverts
        vm.set_sender(alice());
        let r = c.deposit(U256::from(1_000_000u64), alice());
        assert!(
            matches!(r, Err(CofferError::UsdcStateUnreadable(_))),
            "unreadable USDC paused() must refuse, not fail-open: {}",
            label_of(&r)
        );
        assert_eq!(c.total_supply(), U256::ZERO);
    }

    // =====================================================================
    // transferFrom returning false surfaces TransferFailed, never a silent
    // mint (audit ZZ-5/BBB-2). paused() reads the same (false=zero) buffer, so
    // this one IS fully mockable: register transferFrom(false) last; the zero
    // buffer also decodes paused()=false, letting the flow reach the transfer.
    // =====================================================================
    #[test]
    fn deposit_surfaces_transfer_failed() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        seed_vault(&vm, &mut c, U256::ZERO, U256::ZERO, U256::ZERO);
        vm.set_sender(alice());
        // transferFrom(false) registered LAST -> buffer is the bool-false word,
        // which paused() also reads as false (good) and transferFrom reads as
        // false (-> TransferFailed).
        mock_usdc_balance(&vm, coffer_addr(), U256::ZERO);
        mock_usdc_transfer_from(&vm, alice(), coffer_addr(), U256::from(1_000_000u64), false);
        let r = c.deposit(U256::from(1_000_000u64), alice());
        assert!(
            matches!(r, Err(CofferError::TransferFailed(_))),
            "failed transferFrom must revert TransferFailed: {}",
            label_of(&r)
        );
        assert_eq!(c.total_supply(), U256::ZERO, "no shares on failed pull");
    }

    #[test]
    fn deposit_rejects_zero_assets() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        vm.set_sender(alice());
        let r = c.deposit(U256::ZERO, alice());
        assert!(matches!(r, Err(CofferError::ZeroAssets(_))), "{}", label_of(&r));
    }

    #[test]
    fn deposit_rejects_when_deposits_paused() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        // Multisig emergency-pauses deposits.
        vm.set_sender(praetor());
        ok(c.pause_deposits(B256::ZERO));
        vm.set_sender(alice());
        let r = c.deposit(U256::from(1_000_000u64), alice());
        assert!(
            matches!(r, Err(CofferError::DepositsPaused(_))),
            "paused deposits rejected: {}",
            label_of(&r)
        );
    }

    // =====================================================================
    // withdraw: pending-liquidation block + insufficient-shares + unreachable
    // Plinth all revert at/ before the conflicting USDC transfer.
    // =====================================================================
    #[test]
    fn withdraw_blocked_for_pending_liquidation() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        seed_vault(&vm, &mut c, U256::from(1_000_000_000u64), U256::from(1_000_000_000u64), U256::from(1_000_000_000u64));
        c.share_balances.setter(alice()).set(U256::from(1_000_000_000u64));

        vm.set_sender(alice());
        mock_plinth_account(&vm, alice(), true); // pending liquidation
        let r = c.withdraw(U256::from(100_000_000u64), alice(), alice());
        assert!(
            matches!(r, Err(CofferError::PendingLiquidation(_))),
            "pending-liq blocks withdraw: {}",
            label_of(&r)
        );
    }

    #[test]
    fn withdraw_fails_loud_when_plinth_unreachable() {
        // MMMM-1: withdraw must not fail-open on a Plinth read failure.
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        seed_vault(&vm, &mut c, U256::from(1_000_000_000u64), U256::from(1_000_000_000u64), U256::from(1_000_000_000u64));
        c.share_balances.setter(alice()).set(U256::from(1_000_000_000u64));

        vm.set_sender(alice());
        mock_plinth_revert(&vm, alice());
        let r = c.withdraw(U256::from(100_000_000u64), alice(), alice());
        assert!(
            matches!(r, Err(CofferError::PlinthUnreachable(_))),
            "withdraw must fail loud on Plinth read failure: {}",
            label_of(&r)
        );
    }

    #[test]
    fn withdraw_rejects_insufficient_shares() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        // Vault has 1,000 USDC of shares but alice owns only a tiny slice.
        seed_vault(&vm, &mut c, U256::from(1_000_000_000u64), U256::from(1_000_000_000u64), U256::from(1_000_000_000u64));
        c.share_balances.setter(alice()).set(U256::from(1u64)); // ~nothing

        vm.set_sender(alice());
        mock_plinth_account(&vm, alice(), false); // not paused
        // Ask to withdraw 500 USDC -> needs ~500e6 shares, alice has 1.
        let r = c.withdraw(U256::from(500_000_000u64), alice(), alice());
        assert!(
            matches!(r, Err(CofferError::InsufficientShares(_))),
            "over-withdraw rejected: {}",
            label_of(&r)
        );
    }

    #[test]
    fn withdraw_third_party_without_allowance_rejected() {
        // sender != owner and no share allowance -> Unauthorized.
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        seed_vault(&vm, &mut c, U256::from(1_000_000_000u64), U256::from(1_000_000_000u64), U256::from(1_000_000_000u64));
        c.share_balances.setter(alice()).set(U256::from(1_000_000_000u64));

        vm.set_sender(bob()); // bob tries to pull alice's funds
        let r = c.withdraw(U256::from(100_000_000u64), bob(), alice());
        assert!(
            matches!(r, Err(CofferError::Unauthorized(_))),
            "no-allowance third-party withdraw rejected: {}",
            label_of(&r)
        );
    }

    // =====================================================================
    // Admin auth surface.
    // =====================================================================
    #[test]
    fn set_adapter_is_timelock_only() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        // Multisig (not timelock) cannot set adapters (parameter change).
        vm.set_sender(praetor());
        let r = c.set_adapter(adapter(), true, U256::from(1u64));
        assert!(matches!(r, Err(CofferError::Unauthorized(_))), "{}", label_of(&r));
        // Stranger cannot either.
        vm.set_sender(bob());
        let r2 = c.set_adapter(adapter(), true, U256::from(1u64));
        assert!(matches!(r2, Err(CofferError::Unauthorized(_))), "{}", label_of(&r2));
        // Timelock can; the approval + cap persist.
        vm.set_sender(timelock());
        ok(c.set_adapter(adapter(), true, U256::from(7u64)));
        assert!(c.is_adapter_approved(adapter()), "adapter approved after timelock call");
    }

    #[test]
    fn pause_accepts_multisig_or_timelock_but_not_stranger() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));

        // Stranger rejected.
        vm.set_sender(bob());
        let r = c.pause(B256::ZERO);
        assert!(matches!(r, Err(CofferError::Unauthorized(_))), "{}", label_of(&r));

        // Multisig pauses both.
        vm.set_sender(praetor());
        ok(c.pause(B256::ZERO));
        assert!(c.is_deposits_paused.get(), "deposits paused by multisig");
        assert!(c.is_withdrawals_paused.get(), "withdrawals paused by multisig");

        // Timelock also allowed (resume is timelock-only).
        vm.set_sender(timelock());
        ok(c.resume_deposits());
        ok(c.resume_withdrawals());
        assert!(!c.is_deposits_paused.get());
        assert!(!c.is_withdrawals_paused.get());
    }

    #[test]
    fn resume_is_timelock_only() {
        let vm = TestVM::new();
        let mut c = fresh(&vm, U256::from(HUGE), U256::from(HUGE));
        vm.set_sender(praetor());
        ok(c.pause_deposits(B256::ZERO));
        // Multisig cannot resume (resume is a parameter change -> timelock).
        let r = c.resume_deposits();
        assert!(matches!(r, Err(CofferError::Unauthorized(_))), "multisig cannot resume: {}", label_of(&r));
        vm.set_sender(timelock());
        ok(c.resume_deposits());
        assert!(!c.is_deposits_paused.get());
    }

    #[test]
    fn constructor_wires_admin_slots() {
        let vm = TestVM::new();
        let c = fresh(&vm, U256::from(123u64), U256::from(45u64));
        assert_eq!(c.asset(), usdc_addr());
        assert_eq!(c.plinth_address(), plinth_addr());
        assert_eq!(c.praetor_multisig(), praetor());
        assert_eq!(c.praetor_timelock(), timelock());
        assert_eq!(c.total_supply(), U256::ZERO);
    }
}
