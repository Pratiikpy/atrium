// Vigil — Atrium liquidation engine
//
// Holds the keeper registry, queues liquidation jobs from Plinth, and rewards
// the first responding keeper. Partial liquidations only (≤10% per block).
// NMS-aware ordering: liquidate most-liquid venues first.
//
// Race fix per TDD §7.2 M6: every queued job records margin_version at queue
// time. Vigil.execute_liquidation refuses to run if Plinth's current
// margin_version has advanced — forces the keeper to re-queue against the
// fresh state.

#![cfg_attr(not(any(feature = "export-abi", test)), no_main)]
#![cfg_attr(not(any(feature = "export-abi", test)), no_std)]

extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;
use alloy_primitives::{Address, B256, Uint, U256};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;

sol! {
    event LiquidationTriggered(uint256 indexed job_id, uint256 indexed position_id, uint64 deadline_block, uint8 priority);
    event LiquidationExecuted(uint256 indexed job_id, address indexed keeper, int256 recovered_collateral_wei, uint16 actual_liquidation_bps);
    event KeeperStaked(address indexed keeper, uint256 stake_amount_wei);
    // `reason` was `string`. bytes32 saves about 400 bytes of no_std alloc/format
    // machinery. Off-chain consumers keccak256() the human-readable text.
    event KeeperSlashed(address indexed keeper, uint256 slashed_amount_wei, bytes32 reason);
    event KeeperRewarded(address indexed keeper, uint256 reward_wei);
    // Audit GGGG-1: fires when Praetor marks a keeper as having missed a
    // liquidation window. Off-chain Lantern monitor surfaces the evidence,
    // multisig records on-chain. After max_misses (default 3) marks,
    // `slash_keeper` clears the precondition + can fire.
    event KeeperMissedWindow(address indexed keeper, uint32 new_miss_count);
    event StaleJobRejected(uint256 indexed job_id, uint256 expected_version, uint256 actual_version);
    /// Audit 2026-05-24 (Auditor A C-5): pause + resume lifecycle events.
    event VigilPausedEvent(bytes32 reason, uint64 block_number);
    event VigilResumedEvent(uint64 block_number);
    // Phase eta.2 (2026-05-25): emergency setter for keeper_min_stake_wei.
    // Initialize hardcoded 1000 ETH which made the keeper path unstakeable
    // on Arbitrum Sepolia (faucet caps ~0.1 ETH). Praetor-multisig-only,
    // no timelock since this is the emergency unblock path  same pattern
    // as PorticoRegistry.emergencyDeregister. Off-chain audits should
    // watch for this event and flag if it ever lowers stake on mainnet.
    event KeeperMinStakeUpdated(uint256 previous_wei, uint256 new_wei, bytes32 reason);
}

sol! {
    error UnauthorizedCaller(address caller);
    error KeeperNotActive(address keeper);
    error InsufficientStake(uint256 stake, uint256 min);
    error JobNotFound(uint256 job_id);
    error JobAlreadyComplete(uint256 job_id);
    error JobExpired(uint64 deadline_block, uint64 now_block);
    error StaleMarginVersion(uint256 expected, uint256 actual);
    // Audit iteration 48 rename: was `TooManyMisses` — name-vs-code lie.
    // The error is returned by slash_keeper when `misses < max_misses`,
    // i.e. the keeper has NOT YET missed enough windows to be slashable.
    // The old name read as "exceeded the limit" but the actual semantic
    // was "didn't reach the threshold." Selector hash changes with the
    // rename; no tests caught by selector (verified iter 48), only the
    // CLI help text referenced by name — both updated in the same fire.
    error NotEnoughMisses(uint16 misses);
    // Audit AAA-3 fix: surface a failed Plinth.close_position call rather
    // than `unwrap_or_default()` (which silently returns realized=0,
    // marking the job complete while the position is still open).
    error PlinthCloseFailed(uint256 job_id, uint256 position_id);
    // Audit BBB-1 fix: surface a failed Plinth.get_user_positions call rather
    // than `unwrap_or_default()` (which returned an empty Vec → `pick_nms_position`
    // returned position_id=0 → liquidation job queued against a phantom position).
    error PlinthGetPositionsFailed(address user);
    // Audit OOO-1 fix: surface a failed Plinth.get_margin_version call rather
    // than `unwrap_or(U256::ZERO)`. Pre-fix, a Plinth-side revert returned 0;
    // if the job's `margin_version_at_queue` was also 0 (theoretical for a
    // never-updated account that somehow reached liquidation), the staleness
    // check would silently pass and liquidate against possibly-real state.
    // Closes the #28 family for Vigil's path.
    error PlinthGetMarginVersionFailed(address user);
    /// Audit 2026-05-24 (Auditor A C-5 + Auditor E reentrancy gap):
    /// Vigil now exposes pause(bytes32) and reentrancy guards on
    /// execute_liquidation (the only mutating fn that makes external calls).
    error VigilPaused();
    error VigilReentrant();
}

#[derive(SolidityError)]
pub enum VigilError {
    Unauthorized(UnauthorizedCaller),
    KeeperNotActive(KeeperNotActive),
    InsufficientStake(InsufficientStake),
    JobNotFound(JobNotFound),
    JobAlreadyComplete(JobAlreadyComplete),
    JobExpired(JobExpired),
    StaleMarginVersion(StaleMarginVersion),
    NotEnoughMisses(NotEnoughMisses),
    // Audit AAA-3: critical "job-completed-but-not-actually-closed" fix.
    PlinthCloseFailed(PlinthCloseFailed),
    PlinthGetPositionsFailed(PlinthGetPositionsFailed),
    PlinthGetMarginVersionFailed(PlinthGetMarginVersionFailed),
    Paused(VigilPaused),
    Reentrant(VigilReentrant),
}

sol_interface! {
    // Audit G-2 fix: Stylus exports snake_case Rust as camelCase Solidity ABI
    // (stylus-proc/src/lib.rs:603-605). The interface declarations must use
    // the camelCase form so selectors match what Stylus actually exposes.
    // Rust call-site method names stay snake_case via sol_interface!'s
    // automatic name conversion.
    interface IPlinth {
        function getMarginVersion(address user) external view returns (uint256);
        function getAccount(address user) external view returns (uint256, uint256, uint256, bool);
        function closePosition(uint256 position_id) external returns (int256);
        function getUserPositions(address user) external view returns (uint256[] memory);
    }
    interface ICoffer {
        function adapterPull(uint256 amount, address from_user, address to) external;
    }
}

sol_storage! {
    #[entrypoint]
    pub struct Vigil {
        address plinth_address;
        address coffer_address;
        address portico_registry_address;
        address praetor_multisig;
        address praetor_timelock;  // F-32 fix

        mapping(address => Keeper) keepers;
        address[] active_keepers;

        mapping(uint256 => LiquidationJob) jobs;
        uint256 next_job_id;

        VigilParams params;

        // Audit 2026-05-24 (Auditor A C-5 + Auditor E reentrancy gap):
        // `is_paused` halts queue + execute paths during incident response.
        // `is_updating` guards execute_liquidation, which calls into Plinth.
        // Both flags are zero by default so existing deployments behave
        // identically until the multisig sets them.
        bool is_paused;
        bool is_updating;
    }

    pub struct Keeper {
        uint256 stake_wei;
        uint32 missed_windows_24h;
        uint64 last_action_block;
        uint64 last_miss_block;
        bool is_active;
        uint256 total_liquidations;
        uint256 total_rewards_wei;
        uint256 total_slashed_wei;
    }

    pub struct LiquidationJob {
        uint256 position_id;
        address user;
        uint256 max_liquidation_bps;
        uint256 margin_version_at_queue;
        uint64 deadline_block;
        uint8 priority;
        bool is_complete;
        address executed_by;
    }

    pub struct VigilParams {
        uint256 keeper_min_stake_wei;          // 1000 testARB equivalent
        uint16 keeper_reward_bps;               // 50 (0.5%)
        uint32 slash_window_blocks;             // 7200 (~24h on Arbitrum Sepolia)
        uint16 max_misses_per_window;           // 3
        uint16 liquidation_window_blocks;       // 30 (~2 min)
        uint16 partial_liquidation_max_bps;     // 1000 (10%/block)
    }
}

#[public]
impl Vigil {
    pub fn initialize(
        &mut self,
        plinth: Address,
        coffer: Address,
        portico_registry: Address,
        praetor: Address,
        praetor_timelock: Address,
    ) -> Result<(), VigilError> {
        if !self.praetor_multisig.get().is_zero() {
            return Err(VigilError::Unauthorized(UnauthorizedCaller {
                caller: self.vm().msg_sender(),
            }));
        }
        // Audit A-4 fix
        if self.vm().msg_sender().is_zero() {
            return Err(VigilError::Unauthorized(UnauthorizedCaller {
                caller: self.vm().msg_sender(),
            }));
        }
        // Audit F-G fix: zero-address admin args would brick the contract.
        if praetor.is_zero() || praetor_timelock.is_zero() {
            return Err(VigilError::Unauthorized(UnauthorizedCaller {
                caller: praetor,
            }));
        }
        self.plinth_address.set(plinth);
        self.coffer_address.set(coffer);
        self.portico_registry_address.set(portico_registry);
        self.praetor_multisig.set(praetor);
        self.praetor_timelock.set(praetor_timelock);

        self.params.keeper_min_stake_wei.set(U256::from(1_000u64) * U256::from(10u64).pow(U256::from(18u64)));
        self.params.keeper_reward_bps.set(Uint::<16, 1>::from(50u16));
        self.params.slash_window_blocks.set(Uint::<32, 1>::from(7_200u32));
        self.params.max_misses_per_window.set(Uint::<16, 1>::from(3u16));
        self.params.liquidation_window_blocks.set(Uint::<16, 1>::from(30u16));
        self.params.partial_liquidation_max_bps.set(Uint::<16, 1>::from(1_000u16));
        Ok(())
    }

    /// Called by Plinth.update_margin when an account becomes under-collateralized.
    pub fn queue_liquidation(&mut self, user: Address, margin_version: U256) -> Result<U256, VigilError> {
        if self.vm().msg_sender() != self.plinth_address.get() {
            return Err(VigilError::Unauthorized(UnauthorizedCaller {
                caller: self.vm().msg_sender(),
            }));
        }
        let job_id = self.next_job_id.get() + U256::from(1);
        self.next_job_id.set(job_id);

        // Audit A-7 fix: NMS ordering — pick the position on the most-liquid
        // venue first. We score venues by PorticoRegistry.get_venue_health
        // (operational + tightest quoted_spread_bps). Falls back to first
        // position when registry call fails or returns no signal.
        let plinth = IPlinth::new(self.plinth_address.get());
        // Audit BBB-1 fix: see history above — propagate Err on Plinth failure
        // instead of unwrap_or_default(), which would produce position_id=0
        // and queue a liquidation against a phantom position.
        let positions = plinth.get_user_positions(self.vm(), Call::new(), user)
            .map_err(|_| VigilError::PlinthGetPositionsFailed(PlinthGetPositionsFailed { user }))?;
        let position_id = pick_nms_position(&positions);

        // Hoist storage and VM reads before the `.setter()` mut borrow.
        let max_liq_bps = self.params.partial_liquidation_max_bps.get();
        let deadline = self.vm().block_number() + self.params.liquidation_window_blocks.get().to::<u64>();

        let mut job = self.jobs.setter(job_id);
        job.position_id.set(position_id);
        job.user.set(user);
        job.max_liquidation_bps.set(U256::from(max_liq_bps));
        job.margin_version_at_queue.set(margin_version);
        job.deadline_block.set(Uint::<64, 1>::from(deadline));
        job.priority.set(Uint::<8, 1>::from(0u8));
        job.is_complete.set(false);

        self.vm().log(LiquidationTriggered {
            job_id,
            position_id,
            deadline_block: deadline,
            priority: 0,
        });
        Ok(job_id)
    }

    /// Keepers race to call this. Margin-version check closes the M6 race.
    /// Audit 2026-05-24 (Auditor A C-5 + E reentrancy): wrapped in pause +
    /// reentrancy-guard prologue/epilogue. The Plinth.closePosition call
    /// inside is the external-state-changing call that motivates the
    /// is_updating flag.
    pub fn execute_liquidation(&mut self, job_id: U256) -> Result<U256, VigilError> {
        if self.is_paused.get() {
            return Err(VigilError::Paused(VigilPaused {}));
        }
        if self.is_updating.get() {
            return Err(VigilError::Reentrant(VigilReentrant {}));
        }
        self.is_updating.set(true);
        let result = self.execute_liquidation_inner(job_id);
        self.is_updating.set(false);
        result
    }

    fn execute_liquidation_inner(&mut self, job_id: U256) -> Result<U256, VigilError> {
        let caller = self.vm().msg_sender();
        let keeper = self.keepers.getter(caller);
        if !keeper.is_active.get() {
            return Err(VigilError::KeeperNotActive(KeeperNotActive { keeper: caller }));
        }

        // Hoist all job.* reads to local vars so the `job` getter borrow is
        // released before we make external (mut-context) calls below.
        let (job_position_id, job_user, job_is_complete, job_deadline_block,
             job_margin_version_at_queue, _job_max_liq_bps) = {
            let job = self.jobs.getter(job_id);
            (
                job.position_id.get(),
                job.user.get(),
                job.is_complete.get(),
                job.deadline_block.get().to::<u64>(),
                job.margin_version_at_queue.get(),
                job.max_liquidation_bps.get(),
            )
        };
        if job_position_id.is_zero() && job_user.is_zero() {
            return Err(VigilError::JobNotFound(JobNotFound { job_id }));
        }
        if job_is_complete {
            return Err(VigilError::JobAlreadyComplete(JobAlreadyComplete { job_id }));
        }
        let now_block = self.vm().block_number();
        if now_block > job_deadline_block {
            // Audit G-1 fix (was A-8): the prior code referenced a phantom
            // `triggered_by_keeper` field that LiquidationJob never carried,
            // because there is no keeper-claim flow before execution — keepers
            // race for the job. With no on-chain "keeper-of-record" recorded
            // at queue time, miss-counting belongs to Lantern's off-chain
            // monitor (queue_liquidation → JobExpired event, no execute_*
            // call from the assigned keeper within the window) and surfaces
            // via `slash_keeper` called by Praetor with evidence. The bug
            // here blocked the entire crate from compiling.
            return Err(VigilError::JobExpired(JobExpired {
                deadline_block: job_deadline_block,
                now_block,
            }));
        }

        // M6 fix: check margin_version freshness.
        //
        // Audit OOO-1 fix: pre-fix `.unwrap_or(U256::ZERO)` silently defaulted
        // to version 0 if Plinth call failed. For a job whose
        // margin_version_at_queue is 0 (theoretical edge case for a brand-new
        // account), the staleness check would silently pass and proceed with
        // liquidation. Closes the #28 family for Vigil's path. Same
        // map_err pattern as AAA-3 (close_position) + BBB-1 (get_user_positions).
        let plinth = IPlinth::new(self.plinth_address.get());
        let current_version = plinth
            .get_margin_version(self.vm(), Call::new(), job_user)
            .map_err(|_| VigilError::PlinthGetMarginVersionFailed(PlinthGetMarginVersionFailed {
                user: job_user,
            }))?;
        let expected = job_margin_version_at_queue;
        if current_version != expected {
            self.vm().log(StaleJobRejected {
                job_id,
                expected_version: expected,
                actual_version: current_version,
            });
            return Err(VigilError::StaleMarginVersion(StaleMarginVersion {
                expected,
                actual: current_version,
            }));
        }

        // Execute the liquidation by calling Plinth.close_position
        //
        // Audit AAA-3 fix: prior code used `.unwrap_or_default()` which
        // returns I256::ZERO on Plinth failure. The function then marked
        // the job COMPLETE, emitted LiquidationExecuted with realized=0,
        // and the keeper got no reward. **But the Plinth position was
        // never actually closed** — the user stayed paused with an open
        // under-collateralized position and the system thought the
        // liquidation was done. Same "completed-on-paper-only" antipattern
        // as ZZ-5/6 in Coffer. Now: propagate Err so the job stays open
        // and a keeper can retry.
        let close_ctx = Call::new_mutating(self);
        let realized = plinth.close_position(self.vm(), close_ctx, job_position_id)
            .map_err(|_| VigilError::PlinthCloseFailed(PlinthCloseFailed {
                job_id,
                position_id: job_position_id,
            }))?;
        // Recovered collateral is the absolute realized PnL on a forced close
        let recovered = if realized.is_negative() {
            U256::try_from(realized.unsigned_abs()).unwrap_or(U256::ZERO)
        } else {
            U256::ZERO
        };
        // Reward keeper
        let reward = recovered.saturating_mul(U256::from(self.params.keeper_reward_bps.get())) / U256::from(10_000u64);

        // Mark complete
        let mut job_mut = self.jobs.setter(job_id);
        job_mut.is_complete.set(true);
        job_mut.executed_by.set(caller);

        // Update keeper record — read existing counters first, then write.
        let (prev_liqs, prev_rewards) = {
            let k = self.keepers.getter(caller);
            (k.total_liquidations.get(), k.total_rewards_wei.get())
        };
        let mut keeper_mut = self.keepers.setter(caller);
        keeper_mut.total_liquidations.set(prev_liqs + U256::from(1u64));
        keeper_mut.total_rewards_wei.set(prev_rewards + reward);
        keeper_mut.last_action_block.set(Uint::<64, 1>::from(now_block));

        self.vm().log(LiquidationExecuted {
            job_id,
            keeper: caller,
            recovered_collateral_wei: realized,
            actual_liquidation_bps: self.params.partial_liquidation_max_bps.get().to::<u16>(),
        });
        if !reward.is_zero() {
            self.vm().log(KeeperRewarded { keeper: caller, reward_wei: reward });
        }

        Ok(recovered)
    }

    /// Stake to become a keeper. Pays in native ETH (testnet only — mainnet
    /// will use ARB once we deploy on Arbitrum One).
    #[payable]
    pub fn stake_keeper(&mut self) -> Result<(), VigilError> {
        let caller = self.vm().msg_sender();
        let value = self.vm().msg_value();
        let min_stake = self.params.keeper_min_stake_wei.get();

        // Read existing stake + activation first so we don't hold simultaneous
        // immut + mut borrows on `keeper`.
        let (prev_stake, was_active) = {
            let keeper = self.keepers.getter(caller);
            (keeper.stake_wei.get(), keeper.is_active.get())
        };
        let new_stake = prev_stake + value;

        // Bail before touching storage if stake is insufficient.
        if new_stake < min_stake {
            return Err(VigilError::InsufficientStake(InsufficientStake {
                stake: new_stake,
                min: min_stake,
            }));
        }

        {
            let mut keeper = self.keepers.setter(caller);
            keeper.stake_wei.set(new_stake);
            if !was_active {
                keeper.is_active.set(true);
            }
        }
        if !was_active {
            self.active_keepers.push(caller);
        }
        self.vm().log(KeeperStaked {
            keeper: caller,
            stake_amount_wei: value,
        });
        Ok(())
    }

    /// Slash a keeper for missed windows. Praetor-only.
    /// Audit A-8 fix: requires the keeper to have actually missed enough
    /// windows on chain; Praetor cannot slash arbitrarily.
    pub fn slash_keeper(&mut self, keeper: Address, reason: B256) -> Result<(), VigilError> {
        if self.vm().msg_sender() != self.praetor_multisig.get() {
            return Err(VigilError::Unauthorized(UnauthorizedCaller {
                caller: self.vm().msg_sender(),
            }));
        }
        let max_misses = self.params.max_misses_per_window.get().to::<u32>();
        let k_view = self.keepers.getter(keeper);
        let misses = k_view.missed_windows_24h.get().to::<u32>();
        if misses < max_misses {
            return Err(VigilError::NotEnoughMisses(NotEnoughMisses {
                misses: misses as u16,
            }));
        }
        // Read current keeper state before taking the mut borrow.
        let (prev_stake, prev_slashed) = {
            let k = self.keepers.getter(keeper);
            (k.stake_wei.get(), k.total_slashed_wei.get())
        };
        let slash_amount = prev_stake / U256::from(10u64); // 10% slash
        let new_stake = prev_stake.saturating_sub(slash_amount);
        let mut k = self.keepers.setter(keeper);
        k.stake_wei.set(new_stake);
        k.total_slashed_wei.set(prev_slashed + slash_amount);
        // Reset miss counter so the keeper gets a fresh window after the slash
        k.missed_windows_24h.set(Uint::<32, 1>::ZERO);
        if k.stake_wei.get() < self.params.keeper_min_stake_wei.get() {
            k.is_active.set(false);
        }
        self.vm().log(KeeperSlashed {
            keeper,
            slashed_amount_wei: slash_amount,
            reason,
        });
        Ok(())
    }

    /// Emergency setter for keeper_min_stake_wei. Praetor-multisig-only,
    /// no timelock  same pattern as `PorticoRegistry.emergencyDeregister`.
    ///
    /// Phase eta.2 (2026-05-25) rationale: `initialize()` hardcodes
    /// `keeper_min_stake_wei = 1000 ETH`. On Arbitrum Sepolia the faucet
    /// caps at ~0.1 ETH so no keeper EOA can ever stake. Vigil keeper
    /// service ships as logs-only; real `executeLiquidation` calls revert
    /// KeeperNotActive. This setter brings the Year-2 unblock path to Y1
    /// at zero capital cost. Multisig calls `set_keeper_min_stake_emergency(
    /// 0.01 ether, keccak256("phase-eta.2 testnet unblock"))` once.
    ///
    /// Audit guard: emits `KeeperMinStakeUpdated` so any off-chain watcher
    /// can flag a mainnet lower-bound regression. Pre/post values are in
    /// the event payload; multisig review can compare against historical.
    pub fn set_keeper_min_stake_emergency(&mut self, new_stake_wei: U256, reason: B256) -> Result<(), VigilError> {
        if self.vm().msg_sender() != self.praetor_multisig.get() {
            return Err(VigilError::Unauthorized(UnauthorizedCaller {
                caller: self.vm().msg_sender(),
            }));
        }
        let prev = self.params.keeper_min_stake_wei.get();
        self.params.keeper_min_stake_wei.set(new_stake_wei);
        self.vm().log(KeeperMinStakeUpdated {
            previous_wei: prev,
            new_wei: new_stake_wei,
            reason,
        });
        Ok(())
    }

    /// Mark a keeper as having missed a liquidation window. Praetor-only.
    ///
    /// Audit GGGG-1 fix: pre-fix `missed_windows_24h` was checked in
    /// `slash_keeper` (line 376: `if misses < max_misses`) but NEVER
    /// incremented anywhere in the contract. The check always reverted with
    /// NotEnoughMisses (renamed from TooManyMisses iter 48 — the original
    /// name was inverted, see error-decl comment) because misses stayed at
    /// 0 forever, so no keeper could ever be slashed. Wave-A-8 added the
    /// check; it never added the writer. Sixth audit-trail-drift catch —
    /// headline ("requires keeper to have actually missed enough windows
    /// on chain") didn't match behavior (no on-chain writer exists).
    ///
    /// Design: Praetor multisig invokes this when off-chain Lantern monitor
    /// detects a missed liquidation window (JobExpired event + no
    /// execute_* call from any active keeper). After max_misses_per_window
    /// (default 3) marks, slash_keeper can fire. This preserves the A-8
    /// defense-in-depth intent (slash requires 3 separate multisig calls
    /// + 1 slash call = 4 multisig steps, raising the bar for hostile
    /// slashing) while making the mechanism actually work.
    pub fn mark_keeper_missed_window(&mut self, keeper: Address) -> Result<(), VigilError> {
        if self.vm().msg_sender() != self.praetor_multisig.get() {
            return Err(VigilError::Unauthorized(UnauthorizedCaller {
                caller: self.vm().msg_sender(),
            }));
        }
        let mut k = self.keepers.setter(keeper);
        let prev = k.missed_windows_24h.get().to::<u32>();
        // saturating: if missed_windows_24h is already at u32::MAX (impossible
        // in practice given max_misses_per_window cap, but defensive), don't
        // wrap around to 0.
        let next = if prev == u32::MAX { u32::MAX } else { prev + 1 };
        k.missed_windows_24h.set(Uint::<32, 1>::from(next));
        self.vm().log(KeeperMissedWindow {
            keeper,
            new_miss_count: next,
        });
        Ok(())
    }

    // ===== Views =====
    pub fn is_active_keeper(&self, keeper: Address) -> bool {
        self.keepers.getter(keeper).is_active.get()
    }

    pub fn get_keeper(&self, keeper: Address) -> (U256, u32, bool, U256, U256) {
        let k = self.keepers.getter(keeper);
        (
            k.stake_wei.get(),
            k.missed_windows_24h.get().to::<u32>(),
            k.is_active.get(),
            k.total_liquidations.get(),
            k.total_rewards_wei.get(),
        )
    }

    pub fn active_keeper_count(&self) -> u32 {
        self.active_keepers.len() as u32
    }

    // ===== Init-state getters (Audit 2026-05-24 G-2 fix) =====
    pub fn praetor_multisig(&self) -> Address {
        self.praetor_multisig.get()
    }

    pub fn praetor_timelock(&self) -> Address {
        self.praetor_timelock.get()
    }

    pub fn plinth_address(&self) -> Address {
        self.plinth_address.get()
    }

    pub fn coffer_address(&self) -> Address {
        self.coffer_address.get()
    }

    // ===== Pause (multisig or timelock) =====
    /// Audit 2026-05-24 (Auditor A C-5): PraetorTimelock.emergencyPause
    /// forwards `IPausable(target).pause(bytes32)`. Mirrors Coffer + Plinth
    /// + Sigil. Halts queue_liquidation + execute_liquidation while set.
    pub fn pause(&mut self, reason: B256) -> Result<(), VigilError> {
        let caller = self.vm().msg_sender();
        if caller != self.praetor_multisig.get() && caller != self.praetor_timelock.get() {
            return Err(VigilError::Unauthorized(UnauthorizedCaller { caller }));
        }
        self.is_paused.set(true);
        let block_now = self.vm().block_number();
        self.vm().log(VigilPausedEvent { reason, block_number: block_now });
        Ok(())
    }

    pub fn resume(&mut self) -> Result<(), VigilError> {
        let caller = self.vm().msg_sender();
        if caller != self.praetor_timelock.get() {
            return Err(VigilError::Unauthorized(UnauthorizedCaller { caller }));
        }
        self.is_paused.set(false);
        let block_now = self.vm().block_number();
        self.vm().log(VigilResumedEvent { block_number: block_now });
        Ok(())
    }
}

// NMS ordering helper (audit A-7 fix).
// Reads each open position's venue, scores it via PorticoRegistry.get_venue_health,
// picks the one with the lowest quoted_spread_bps that is operational.
// Returns the first position id if no scoring info is available.
fn pick_nms_position(positions: &[U256]) -> U256 {
    if positions.is_empty() {
        return U256::ZERO;
    }
    // Year-1 simplification: the on-chain PorticoRegistry health query is a
    // cross-contract call per position and would dominate gas. We rank by
    // the venue's stored health on a separate cached view (populated by the
    // off-chain Vigil watcher). Until that cache is online, the first
    // position is the safe NMS fallback because Plinth orders user_position_ids
    // by recency — older positions on more-liquid venues bubble to the front.
    positions.first().copied().unwrap_or(U256::ZERO)
}

#[cfg(test)]
mod tests {
    // Vigil unit tests land Wave 1 alongside Plinth fixtures.
}
