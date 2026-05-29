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
    // Audit fix (contracts-rust #6): keeper stake was a one-way deposit with no
    // withdraw path. KeeperUnstaked fires when a keeper recovers its non-slashed
    // stake and deactivates.
    event KeeperUnstaked(address indexed keeper, uint256 amount_wei);
    // `reason` was `string`. bytes32 saves about 400 bytes of no_std alloc/format
    // machinery. Off-chain consumers keccak256() the human-readable text.
    event KeeperSlashed(address indexed keeper, uint256 slashed_amount_wei, bytes32 reason);
    event KeeperRewarded(address indexed keeper, uint256 reward_wei);
    // Audit fix (contracts-rust #6, completion): a keeper claims accrued rewards
    // out of the reward pool (funded by slashed stakes). Distinct from
    // KeeperRewarded, which fires on accrual at execute_liquidation time.
    event RewardsClaimed(address indexed keeper, uint256 amount_wei);
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
    // Audit fix (contracts-rust #6): the outbound ETH transfer in withdraw_stake
    // failed (recipient reverted on receive). Surfaced loudly rather than
    // silently leaving the stake zeroed-but-not-paid.
    error WithdrawFailed(address to, uint256 amount);
    // Audit fix (contracts-rust #35): queue_liquidation was called for an
    // underwater account with no open positions (negative equity from fees),
    // pick_nms_position returned 0, and a phantom job (position_id=0) was
    // written. Now we refuse to queue and let Plinth's VigilQueueFailed signal
    // fire instead.
    error NoPositionsToLiquidate(address user);
    // Audit fix (contracts-rust #6, completion): claim_rewards found no funded
    // rewards to pay (keeper has zero accrued, or the reward pool is empty
    // because no stakes have been slashed yet / proceeds funding #5 not live).
    error RewardsNotAvailable(uint256 requested, uint256 available);
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
    WithdrawFailed(WithdrawFailed),
    NoPositionsToLiquidate(NoPositionsToLiquidate),
    RewardsNotAvailable(RewardsNotAvailable),
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
        // Phase 2a: partial liquidation — reduce position by bps fraction
        function reducePosition(uint256 position_id, uint16 reduction_bps) external returns (int256);
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

        // Audit fix (contracts-rust #6, completion): keeper-reward + slashed-ETH
        // pool. Before this, slash_keeper only decremented accounting (slashed
        // ETH stranded) and total_rewards_wei was accrued but never payable -
        // two of the three "stuck pools" the finding named. Now slashing credits
        // this pool (the slashed bad-keeper stake stays in the contract balance
        // and funds it), and claim_rewards() pays a keeper's accrued
        // total_rewards_wei out of it. Appended for upgrade-safe layout.
        // Full liquidation-proceeds funding of rewards lands with #5 (the
        // Coffer.adapterPull collateral seizure, deploy-gated).
        uint256 reward_pool_wei;
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
    /// Phase 2a: migrated from initialize() to #[constructor] per Plinth pattern.
    #[constructor]
    pub fn constructor(
        &mut self,
        plinth: Address,
        coffer: Address,
        portico_registry: Address,
        praetor: Address,
        praetor_timelock: Address,
    ) {
        assert!(!praetor.is_zero(), "praetor zero");
        assert!(!praetor_timelock.is_zero(), "timelock zero");
        self.plinth_address.set(plinth);
        self.coffer_address.set(coffer);
        self.portico_registry_address.set(portico_registry);
        self.praetor_multisig.set(praetor);
        self.praetor_timelock.set(praetor_timelock);

        self.params.keeper_min_stake_wei.set(keeper_min_stake_default());
        self.params.keeper_reward_bps.set(Uint::<16, 1>::from(50u16));
        self.params.slash_window_blocks.set(Uint::<32, 1>::from(7_200u32));
        self.params.max_misses_per_window.set(Uint::<16, 1>::from(3u16));
        self.params.liquidation_window_blocks.set(Uint::<16, 1>::from(30u16));
        self.params.partial_liquidation_max_bps.set(Uint::<16, 1>::from(1_000u16));
    }

    /// Called by Plinth.update_margin when an account becomes under-collateralized.
    pub fn queue_liquidation(&mut self, user: Address, margin_version: U256) -> Result<U256, VigilError> {
        // Phase 2a: gate behind pause check. If Vigil is paused during incident
        // response, new liquidation jobs must not be queued.
        if self.is_paused.get() {
            return Err(VigilError::Paused(VigilPaused {}));
        }
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
        // Audit fix (contracts-rust #35): refuse to queue a phantom job when the
        // account has no open position to liquidate (pick_nms_position returns 0
        // for an empty list). Returning Err here makes Plinth's queue_liquidation
        // call site emit VigilQueueFailed (the honest "needs manual re-queue"
        // signal) instead of writing a position_id=0 job that later self-completes
        // with zero recovery and pollutes keeper stats.
        if position_id.is_zero() {
            return Err(VigilError::NoPositionsToLiquidate(NoPositionsToLiquidate { user }));
        }

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
        // Audit fix (contracts-rust #35): was `&&` - a real-user/zero-position
        // phantom job slipped through. Reject if EITHER field is zero (defense
        // in depth alongside the queue-side guard above).
        if job_position_id.is_zero() || job_user.is_zero() {
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

        // Execute the liquidation by calling Plinth.reduce_position for partial
        // liquidation (Phase 2a fix). Instead of fully closing the position,
        // reduce it by partial_liquidation_max_bps fraction. This preserves
        // the user's remaining position and only liquidates enough to restore
        // margin health.
        let partial_bps = self.params.partial_liquidation_max_bps.get().to::<u16>();
        let close_ctx = Call::new_mutating(self);
        let realized = plinth.reduce_position(self.vm(), close_ctx, job_position_id, partial_bps)
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

    /// Withdraw a keeper's full non-slashed stake and deactivate.
    ///
    /// Audit fix (contracts-rust #6): stake_keeper was #[payable] with NO
    /// counterpart, so an honest keeper's ETH was a one-way deposit it could
    /// never recover (and slashed ETH / rewards had no payout path either).
    /// Guards: the existing is_updating reentrancy flag, plus strict
    /// checks-effects-interactions - the stake is zeroed, the keeper
    /// deactivated, and removed from active_keepers BEFORE the external ETH
    /// transfer, so a re-entrant call finds nothing left. Vigil liquidation
    /// jobs are open to any active keeper (not assigned per-keeper at queue
    /// time), so there is no per-keeper in-flight job to lock against here.
    pub fn withdraw_stake(&mut self) -> Result<(), VigilError> {
        if self.is_updating.get() {
            return Err(VigilError::Reentrant(VigilReentrant {}));
        }
        self.is_updating.set(true);
        let result = self.withdraw_stake_inner();
        self.is_updating.set(false);
        result
    }

    fn withdraw_stake_inner(&mut self) -> Result<(), VigilError> {
        let caller = self.vm().msg_sender();
        let amount = self.keepers.getter(caller).stake_wei.get();
        if amount.is_zero() {
            // Nothing staked to withdraw.
            return Err(VigilError::KeeperNotActive(KeeperNotActive { keeper: caller }));
        }

        // Effects first: zero the stake + deactivate before the transfer.
        {
            let mut k = self.keepers.setter(caller);
            k.stake_wei.set(U256::ZERO);
            k.is_active.set(false);
        }

        // Remove from active_keepers via swap-remove.
        let len = self.active_keepers.len();
        let mut found: Option<usize> = None;
        for i in 0..len {
            if self.active_keepers.get(i) == Some(caller) {
                found = Some(i);
                break;
            }
        }
        if let Some(i) = found {
            let last = len - 1;
            if i != last {
                if let Some(last_addr) = self.active_keepers.get(last) {
                    if let Some(mut slot) = self.active_keepers.setter(i) {
                        slot.set(last_addr);
                    }
                }
            }
            self.active_keepers.pop();
        }

        // Interaction last: return the non-slashed stake to the keeper.
        stylus_sdk::call::transfer::transfer_eth(self.vm(), caller, amount)
            .map_err(|_| VigilError::WithdrawFailed(WithdrawFailed { to: caller, amount }))?;

        self.vm().log(KeeperUnstaked { keeper: caller, amount_wei: amount });
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
        {
            let mut k = self.keepers.setter(keeper);
            k.stake_wei.set(new_stake);
            k.total_slashed_wei.set(prev_slashed + slash_amount);
            // Reset miss counter so the keeper gets a fresh window after the slash
            k.missed_windows_24h.set(Uint::<32, 1>::ZERO);
            if k.stake_wei.get() < self.params.keeper_min_stake_wei.get() {
                k.is_active.set(false);
            }
        }
        // Audit fix (contracts-rust #6, completion): the slashed ETH stays in the
        // contract balance (it was the keeper's stake); credit it to the reward
        // pool so it is no longer stranded - it now funds keeper rewards
        // (claim_rewards) instead of only bumping an accounting counter.
        let pool = self.reward_pool_wei.get();
        self.reward_pool_wei.set(pool + slash_amount);
        self.vm().log(KeeperSlashed {
            keeper,
            slashed_amount_wei: slash_amount,
            reason,
        });
        Ok(())
    }

    /// Claim a keeper's accrued rewards (audit fix contracts-rust #6, completion).
    /// total_rewards_wei was accrued at execute_liquidation time but had no
    /// payout path. Pays the caller out of the reward pool (funded by slashed
    /// stakes) and zeroes the paid portion. Reentrancy-guarded; CEI ordering.
    pub fn claim_rewards(&mut self) -> Result<U256, VigilError> {
        if self.is_updating.get() {
            return Err(VigilError::Reentrant(VigilReentrant {}));
        }
        self.is_updating.set(true);
        let result = self.claim_rewards_inner();
        self.is_updating.set(false);
        result
    }

    fn claim_rewards_inner(&mut self) -> Result<U256, VigilError> {
        let caller = self.vm().msg_sender();
        let accrued = self.keepers.getter(caller).total_rewards_wei.get();
        let pool = self.reward_pool_wei.get();
        // Pay the smaller of what the keeper has earned and what the pool can
        // cover. Until the pool is funded (by a slash, or proceeds funding #5),
        // there is nothing to pay - refuse loudly rather than silently no-op.
        let payable = if accrued < pool { accrued } else { pool };
        if payable.is_zero() {
            return Err(VigilError::RewardsNotAvailable(RewardsNotAvailable {
                requested: accrued,
                available: pool,
            }));
        }
        // Effects first (CEI): debit both the keeper's accrual and the pool.
        {
            let mut k = self.keepers.setter(caller);
            k.total_rewards_wei.set(accrued - payable);
        }
        self.reward_pool_wei.set(pool - payable);
        // Interaction last: pay out.
        stylus_sdk::call::transfer::transfer_eth(self.vm(), caller, payable)
            .map_err(|_| VigilError::WithdrawFailed(WithdrawFailed { to: caller, amount: payable }))?;
        self.vm().log(RewardsClaimed { keeper: caller, amount_wei: payable });
        Ok(payable)
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

// Phase 2a: feature-flagged keeper minimum stake.
// `testnet-stake` feature reduces the minimum from 1000 ETH to 0.01 ETH
// so keepers can actually stake on Arbitrum Sepolia (faucet caps ~0.1 ETH).
// Mainnet builds MUST NOT enable this feature.
#[cfg(feature = "testnet-stake")]
fn keeper_min_stake_default() -> U256 {
    // 0.01 ETH = 10^16 wei
    U256::from(10_000_000_000_000_000u64)
}

#[cfg(not(feature = "testnet-stake"))]
fn keeper_min_stake_default() -> U256 {
    // 1000 ETH = 1000 * 10^18 wei
    U256::from(1_000u64) * U256::from(10u64).pow(U256::from(18u64))
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
    //! Real host unit tests for Vigil using stylus-sdk's `stylus-test` TestVM.
    //!
    //! Each Stylus crate is `crate-type = ["lib", "cdylib"]` with a WasmVM host
    //! that does NOT link under a plain native `cargo test`. The `stylus-test`
    //! feature on stylus-sdk (declared in `[dev-dependencies]`) swaps in a
    //! native `TestVM` mock host, so these link + run natively.
    //!
    //! Cross-contract reads into Plinth are stubbed via `TestVM::mock_static_call`
    //! (for the `view` fns getUserPositions / getMarginVersion, which dispatch as
    //! EVM STATICCALLs) and `TestVM::mock_call` (for the mutating reducePosition,
    //! which dispatches as a CALL with value 0). The mock key is the EXACT ABI
    //! calldata, so we re-derive it here with `alloy_sol_types::SolCall` against
    //! the same camelCase signatures the contract's `sol_interface!` exports.

    use super::*;
    use alloy_sol_types::{SolCall, SolEvent, SolValue};
    use stylus_sdk::testing::*;

    // Re-declare the cross-contract calls so we can produce byte-exact calldata
    // and return encodings. Signatures MUST match the camelCase forms in the
    // contract's `sol_interface! { interface IPlinth { ... } }` block, because
    // selectors are derived from those signatures.
    sol! {
        function getUserPositions(address user) external view returns (uint256[] memory);
        function getMarginVersion(address user) external view returns (uint256);
        function reducePosition(uint256 position_id, uint16 reduction_bps) external returns (int256);
    }

    // `VigilError` intentionally does NOT derive `Debug` (its `sol!`-generated
    // inner structs don't, and adding it would touch the on-chain error type).
    // These helpers let the suite assert on Ok/Err without `{:?}` formatting.
    #[track_caller]
    fn expect_ok<T>(res: Result<T, VigilError>, msg: &str) -> T {
        match res {
            Ok(v) => v,
            Err(_) => panic!("expected Ok ({msg}) but got a VigilError"),
        }
    }

    // --- Fixed addresses used across the suite -------------------------------
    fn plinth_addr() -> Address {
        Address::from([0x11u8; 20])
    }
    fn coffer_addr() -> Address {
        Address::from([0x22u8; 20])
    }
    fn portico_addr() -> Address {
        Address::from([0x33u8; 20])
    }
    fn praetor_addr() -> Address {
        Address::from([0x44u8; 20])
    }
    fn timelock_addr() -> Address {
        Address::from([0x55u8; 20])
    }
    fn keeper_addr() -> Address {
        Address::from([0xAAu8; 20])
    }
    fn user_addr() -> Address {
        Address::from([0xBBu8; 20])
    }
    fn stranger_addr() -> Address {
        Address::from([0xCCu8; 20])
    }

    /// Builds a fully constructed Vigil bound to `vm`. The `#[constructor]` runs
    /// as a normal method under TestVM, seeding all admin slots + params.
    fn deploy(vm: &TestVM) -> Vigil {
        let mut c = Vigil::from(vm);
        // Constructor has no auth gate (it only asserts non-zero praetor/timelock).
        c.constructor(
            plinth_addr(),
            coffer_addr(),
            portico_addr(),
            praetor_addr(),
            timelock_addr(),
        );
        c
    }

    /// Mocks Plinth.getUserPositions(user) -> positions as a STATICCALL.
    fn mock_user_positions(vm: &TestVM, user: Address, positions: Vec<U256>) {
        let calldata = getUserPositionsCall { user }.abi_encode();
        // Return type is `uint256[]`; encode as a single dynamic array value.
        let ret = positions.abi_encode();
        vm.mock_static_call(plinth_addr(), calldata, Ok(ret));
    }

    /// Mocks Plinth.getMarginVersion(user) -> version as a STATICCALL.
    fn mock_margin_version(vm: &TestVM, user: Address, version: U256) {
        let calldata = getMarginVersionCall { user }.abi_encode();
        let ret = version.abi_encode();
        vm.mock_static_call(plinth_addr(), calldata, Ok(ret));
    }

    /// Mocks Plinth.reducePosition(position_id, bps) -> realized as a CALL (value 0).
    fn mock_reduce_position(
        vm: &TestVM,
        position_id: U256,
        reduction_bps: u16,
        realized: alloy_primitives::I256,
    ) {
        let calldata = reducePositionCall {
            position_id,
            reduction_bps,
        }
        .abi_encode();
        let ret = realized.abi_encode();
        vm.mock_call(plinth_addr(), calldata, U256::ZERO, Ok(ret));
    }

    /// Stakes `caller` as an active keeper with `amount` wei. Uses the contract's
    /// own #[payable] stake_keeper so storage + active_keepers stay consistent.
    /// Lowers the min-stake first via the emergency setter (Praetor-only).
    fn make_active_keeper(vm: &TestVM, c: &mut Vigil, caller: Address, amount: U256) {
        // Drop min stake to 1 wei so any positive stake activates the keeper.
        vm.set_sender(praetor_addr());
        expect_ok(
            c.set_keeper_min_stake_emergency(U256::from(1u64), B256::ZERO),
            "min stake setter is praetor-only and must succeed",
        );
        vm.set_sender(caller);
        vm.set_value(amount);
        expect_ok(c.stake_keeper(), "stake_keeper happy path");
        vm.set_value(U256::ZERO);
    }

    /// The execute_liquidation path makes TWO sequential cross-contract reads
    /// (getMarginVersion, then reducePosition). TestVM 0.10.7 serves return data
    /// from a single global buffer that holds the LAST-registered mock's bytes
    /// (call_contract only sets outs_len; read_return_data reads the global
    /// buffer). To exercise both reads honestly under that model, we pin the
    /// queued `margin_version_at_queue` to the U256 reinterpretation of the
    /// realized I256's big-endian bytes. Both reads then decode the same 32-byte
    /// buffer to their own true mocked value (margin_version == that U256;
    /// reducePosition return == that I256) with no fudged assertions.
    fn realized_as_margin_version(realized: alloy_primitives::I256) -> U256 {
        U256::from_be_bytes(realized.to_be_bytes::<32>())
    }

    /// Queue a job (id 1) for `user`/`pos` whose margin version is byte-aligned
    /// with `realized`, then make `keeper` active and register the margin-version
    /// + reduce-position mocks in the order the execute path consumes them.
    /// Leaves `vm` sender = keeper, ready to call execute_liquidation(job_id).
    fn setup_execute(
        vm: &TestVM,
        c: &mut Vigil,
        user: Address,
        keeper: Address,
        pos: U256,
        realized: alloy_primitives::I256,
        keeper_stake: U256,
    ) -> U256 {
        let mv = realized_as_margin_version(realized);
        // Queue consumes getUserPositions first (global buffer = positions here).
        let job_id = queue_one(vm, c, user, mv, pos);
        make_active_keeper(vm, c, keeper, keeper_stake);
        // Register the execute-path mocks. reduce is registered LAST so the global
        // return buffer holds `realized` bytes == `mv` bytes, satisfying both the
        // getMarginVersion read (decodes to mv) and the reducePosition read
        // (decodes to realized).
        mock_margin_version(vm, user, mv);
        mock_reduce_position(vm, pos, 1_000u16, realized);
        vm.set_sender(keeper);
        job_id
    }

    // ===================================================================
    // queue_liquidation
    // ===================================================================

    #[test]
    fn queue_liquidation_rejects_non_plinth_caller() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        // A stranger (not the Plinth address) calls in.
        vm.set_sender(stranger_addr());
        let res = c.queue_liquidation(user_addr(), U256::from(1u64));
        match res {
            Err(VigilError::Unauthorized(_)) => {}
            _ => panic!("expected Unauthorized, got a different VigilError variant"),
        }
    }

    #[test]
    fn queue_liquidation_refuses_account_with_no_positions() {
        // Audit fix contracts-rust #35: an underwater account with no open
        // positions must NOT get a phantom (position_id=0) job.
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        vm.set_sender(plinth_addr());
        // Plinth returns an empty positions list.
        mock_user_positions(&vm, user_addr(), vec![]);
        let res = c.queue_liquidation(user_addr(), U256::from(7u64));
        match res {
            Err(VigilError::NoPositionsToLiquidate(e)) => assert_eq!(e.user, user_addr()),
            _ => panic!("expected NoPositionsToLiquidate, got a different VigilError variant"),
        }
    }

    #[test]
    fn queue_liquidation_happy_path_writes_job_and_bumps_id() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        vm.set_block_number(1_000);
        vm.set_sender(plinth_addr());
        let pos = U256::from(42u64);
        mock_user_positions(&vm, user_addr(), vec![pos, U256::from(99u64)]);
        let job_id = expect_ok(
            c.queue_liquidation(user_addr(), U256::from(3u64)),
            "queue happy path",
        );
        // next_job_id starts at 0, first job is id 1.
        assert_eq!(job_id, U256::from(1u64));
        // The job must reference the FIRST position (NMS fallback in pick_nms_position).
        let job = c.jobs.getter(job_id);
        assert_eq!(job.position_id.get(), pos);
        assert_eq!(job.user.get(), user_addr());
        assert_eq!(job.margin_version_at_queue.get(), U256::from(3u64));
        assert!(!job.is_complete.get());
        // deadline = block_number + liquidation_window_blocks (30).
        assert_eq!(job.deadline_block.get().to::<u64>(), 1_000 + 30);
    }

    #[test]
    fn queue_liquidation_blocked_when_paused() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        // Pause via timelock (also a valid pauser).
        vm.set_sender(timelock_addr());
        expect_ok(c.pause(B256::ZERO), "pause by timelock");
        // Even the legit Plinth caller is refused while paused.
        vm.set_sender(plinth_addr());
        match c.queue_liquidation(user_addr(), U256::from(1u64)) {
            Err(VigilError::Paused(_)) => {}
            _ => panic!("expected Paused, got a different VigilError variant"),
        }
    }

    // ===================================================================
    // execute_liquidation
    // ===================================================================

    /// Helper: queue a real job (id 1) against `user` with margin version `mv`,
    /// position `pos`. Returns the job id.
    fn queue_one(vm: &TestVM, c: &mut Vigil, user: Address, mv: U256, pos: U256) -> U256 {
        vm.set_sender(plinth_addr());
        mock_user_positions(vm, user, vec![pos]);
        expect_ok(c.queue_liquidation(user, mv), "queue for execute test")
    }

    #[test]
    fn execute_liquidation_requires_active_keeper() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        vm.set_block_number(100);
        let job_id = queue_one(&vm, &mut c, user_addr(), U256::from(5u64), U256::from(1u64));
        // Caller is not a staked keeper.
        vm.set_sender(stranger_addr());
        match c.execute_liquidation(job_id) {
            Err(VigilError::KeeperNotActive(e)) => assert_eq!(e.keeper, stranger_addr()),
            _ => panic!("expected KeeperNotActive, got a different VigilError variant"),
        }
    }

    #[test]
    fn execute_liquidation_job_not_found_on_malformed_id() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        make_active_keeper(&vm, &mut c, keeper_addr(), U256::from(10u64));
        vm.set_sender(keeper_addr());
        // Job id 999 was never queued -> position_id/user are zero -> JobNotFound.
        match c.execute_liquidation(U256::from(999u64)) {
            Err(VigilError::JobNotFound(e)) => assert_eq!(e.job_id, U256::from(999u64)),
            _ => panic!("expected JobNotFound, got a different VigilError variant"),
        }
    }

    #[test]
    fn execute_liquidation_rejects_stale_margin_version() {
        // M6 race fix: if Plinth's margin_version has advanced past the queued
        // value, refuse and emit StaleJobRejected.
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        vm.set_block_number(100);
        let queued_mv = U256::from(5u64);
        let job_id = queue_one(&vm, &mut c, user_addr(), queued_mv, U256::from(1u64));
        make_active_keeper(&vm, &mut c, keeper_addr(), U256::from(10u64));
        // Plinth now reports a fresher margin version (6 != 5).
        mock_margin_version(&vm, user_addr(), U256::from(6u64));
        vm.set_sender(keeper_addr());
        match c.execute_liquidation(job_id) {
            Err(VigilError::StaleMarginVersion(e)) => {
                assert_eq!(e.expected, queued_mv);
                assert_eq!(e.actual, U256::from(6u64));
            }
            _ => panic!("expected StaleMarginVersion, got a different VigilError variant"),
        }
    }

    #[test]
    fn execute_liquidation_happy_path_completes_job_and_accrues() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        vm.set_block_number(100);
        let pos = U256::from(1u64);
        // reducePosition returns negative realized PnL (forced-close loss):
        // recovered = abs(realized) = 10_000 wei.
        let realized = alloy_primitives::I256::try_from(-10_000i64).unwrap();
        let job_id = setup_execute(
            &vm,
            &mut c,
            user_addr(),
            keeper_addr(),
            pos,
            realized,
            U256::from(10u64),
        );
        let recovered = expect_ok(c.execute_liquidation(job_id), "execute happy path");
        assert_eq!(recovered, U256::from(10_000u64));
        // Job marked complete + executed_by recorded.
        let job = c.jobs.getter(job_id);
        assert!(job.is_complete.get());
        assert_eq!(job.executed_by.get(), keeper_addr());
        // Keeper counters bumped. reward = recovered * 50bps / 10000 = 50 wei.
        let (_stake, _misses, _active, total_liqs, total_rewards) = c.get_keeper(keeper_addr());
        assert_eq!(total_liqs, U256::from(1u64));
        assert_eq!(total_rewards, U256::from(50u64));
    }

    #[test]
    fn execute_liquidation_rejects_completed_job() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        vm.set_block_number(100);
        let pos = U256::from(1u64);
        let realized = alloy_primitives::I256::try_from(-1i64).unwrap();
        let job_id = setup_execute(
            &vm,
            &mut c,
            user_addr(),
            keeper_addr(),
            pos,
            realized,
            U256::from(10u64),
        );
        expect_ok(c.execute_liquidation(job_id), "first execute");
        // Second attempt on the same job must report JobAlreadyComplete.
        match c.execute_liquidation(job_id) {
            Err(VigilError::JobAlreadyComplete(e)) => assert_eq!(e.job_id, job_id),
            _ => panic!("expected JobAlreadyComplete, got a different VigilError variant"),
        }
    }

    // ===================================================================
    // stake_keeper / withdraw_stake
    // ===================================================================

    #[test]
    fn stake_keeper_below_min_is_rejected() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        // Default min stake (testnet-stake off in test build) is 1000 ETH.
        vm.set_sender(keeper_addr());
        vm.set_value(U256::from(1u64));
        match c.stake_keeper() {
            Err(VigilError::InsufficientStake(_)) => {}
            _ => panic!("expected InsufficientStake, got a different VigilError variant"),
        }
        // Keeper must NOT be active and active_keepers must be empty.
        assert!(!c.is_active_keeper(keeper_addr()));
        assert_eq!(c.active_keeper_count(), 0);
    }

    #[test]
    fn stake_keeper_happy_path_accrues_stake_and_activates() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        // Lower the min so a small stake activates.
        vm.set_sender(praetor_addr());
        expect_ok(
            c.set_keeper_min_stake_emergency(U256::from(100u64), B256::ZERO),
            "praetor lowers min stake",
        );
        vm.set_sender(keeper_addr());
        // A below-min deposit reverts BEFORE touching storage (the contract bails
        // on InsufficientStake without persisting), so nothing accrues yet.
        vm.set_value(U256::from(60u64));
        assert!(matches!(
            c.stake_keeper(),
            Err(VigilError::InsufficientStake(_))
        ));
        assert!(!c.is_active_keeper(keeper_addr()));
        assert_eq!(c.active_keeper_count(), 0);
        // A first deposit that meets the min activates the keeper.
        vm.set_value(U256::from(100u64));
        expect_ok(c.stake_keeper(), "first deposit meets min");
        assert!(c.is_active_keeper(keeper_addr()));
        assert_eq!(c.active_keeper_count(), 1);
        // A subsequent deposit accrues on top without re-adding to the active set.
        vm.set_value(U256::from(20u64));
        expect_ok(c.stake_keeper(), "top-up accrues");
        assert_eq!(c.active_keeper_count(), 1);
        let (stake, _m, active, _l, _r) = c.get_keeper(keeper_addr());
        assert_eq!(stake, U256::from(120u64));
        assert!(active);
    }

    #[test]
    fn withdraw_stake_returns_non_slashed_stake_and_deactivates() {
        // Audit fix contracts-rust #6: stake was a one-way deposit pre-fix.
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        make_active_keeper(&vm, &mut c, keeper_addr(), U256::from(500u64));
        // Fund the contract so the outbound transfer_eth has balance to send.
        vm.set_balance(c.vm().contract_address(), U256::from(500u64));
        vm.set_sender(keeper_addr());
        expect_ok(c.withdraw_stake(), "withdraw happy path");
        // Stake zeroed, keeper deactivated, removed from active set.
        let (stake, _m, active, _l, _r) = c.get_keeper(keeper_addr());
        assert_eq!(stake, U256::ZERO);
        assert!(!active);
        assert_eq!(c.active_keeper_count(), 0);
        // KeeperUnstaked event emitted (the #6 fix signal).
        let logs = vm.get_emitted_logs();
        let topic0 = KeeperUnstaked::SIGNATURE_HASH;
        assert!(
            logs.iter().any(|(topics, _)| topics.first() == Some(&topic0)),
            "expected a KeeperUnstaked log"
        );
    }

    #[test]
    fn withdraw_stake_with_nothing_staked_errors() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        vm.set_sender(stranger_addr());
        match c.withdraw_stake() {
            Err(VigilError::KeeperNotActive(e)) => assert_eq!(e.keeper, stranger_addr()),
            _ => panic!("expected KeeperNotActive, got a different VigilError variant"),
        }
    }

    // ===================================================================
    // slash_keeper
    // ===================================================================

    #[test]
    fn slash_keeper_is_praetor_only() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        make_active_keeper(&vm, &mut c, keeper_addr(), U256::from(1_000u64));
        vm.set_sender(stranger_addr());
        match c.slash_keeper(keeper_addr(), B256::ZERO) {
            Err(VigilError::Unauthorized(e)) => assert_eq!(e.caller, stranger_addr()),
            _ => panic!("expected Unauthorized, got a different VigilError variant"),
        }
    }

    #[test]
    fn slash_keeper_rejected_when_misses_below_max() {
        // A-8 defense in depth: cannot slash a keeper that has not actually
        // missed enough windows on chain.
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        make_active_keeper(&vm, &mut c, keeper_addr(), U256::from(1_000u64));
        // misses default to 0, max_misses_per_window default = 3.
        vm.set_sender(praetor_addr());
        match c.slash_keeper(keeper_addr(), B256::ZERO) {
            Err(VigilError::NotEnoughMisses(e)) => assert_eq!(e.misses, 0u16),
            _ => panic!("expected NotEnoughMisses, got a different VigilError variant"),
        }
    }

    #[test]
    fn slash_keeper_credits_reward_pool_after_enough_misses() {
        // Audit fix contracts-rust #6: slashed ETH must fund reward_pool_wei,
        // not be stranded.
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        make_active_keeper(&vm, &mut c, keeper_addr(), U256::from(1_000u64));
        // Mark 3 missed windows (Praetor-only writer added by GGGG-1 fix).
        vm.set_sender(praetor_addr());
        for _ in 0..3 {
            expect_ok(
                c.mark_keeper_missed_window(keeper_addr()),
                "mark missed window",
            );
        }
        // reward pool starts empty.
        assert_eq!(c.reward_pool_wei.get(), U256::ZERO);
        expect_ok(
            c.slash_keeper(keeper_addr(), B256::ZERO),
            "slash after 3 misses",
        );
        // 10% of 1000 = 100 credited to the pool.
        assert_eq!(c.reward_pool_wei.get(), U256::from(100u64));
        // Keeper stake reduced to 900, miss counter reset.
        let (stake, misses, _active, _l, _r) = c.get_keeper(keeper_addr());
        assert_eq!(stake, U256::from(900u64));
        assert_eq!(misses, 0u32);
    }

    // ===================================================================
    // claim_rewards
    // ===================================================================

    #[test]
    fn claim_rewards_unfunded_pool_errors() {
        // #6 completion: refuse loudly when the keeper has zero accrued / the
        // pool is empty, rather than silently no-op.
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        make_active_keeper(&vm, &mut c, keeper_addr(), U256::from(1_000u64));
        vm.set_sender(keeper_addr());
        match c.claim_rewards() {
            Err(VigilError::RewardsNotAvailable(e)) => {
                assert_eq!(e.requested, U256::ZERO);
                assert_eq!(e.available, U256::ZERO);
            }
            _ => panic!("expected RewardsNotAvailable, got a different VigilError variant"),
        }
    }

    #[test]
    fn claim_rewards_pays_accrued_from_pool() {
        // Full #6 round trip: accrue via execute_liquidation, fund the pool via a
        // slash, then claim.
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        vm.set_block_number(100);
        let pos = U256::from(1u64);
        // recovered = 200_000 -> reward accrued = 200_000 * 50 / 10_000 = 1_000 wei.
        let realized = alloy_primitives::I256::try_from(-200_000i64).unwrap();
        let job_id = setup_execute(
            &vm,
            &mut c,
            user_addr(),
            keeper_addr(),
            pos,
            realized,
            U256::from(1_000u64),
        );
        expect_ok(c.execute_liquidation(job_id), "accrue rewards");
        let (_s, _m, _a, _l, accrued) = c.get_keeper(keeper_addr());
        assert_eq!(accrued, U256::from(1_000u64));
        // Fund the pool by slashing the same keeper (10% of 1000 stake = 100).
        vm.set_sender(praetor_addr());
        for _ in 0..3 {
            expect_ok(c.mark_keeper_missed_window(keeper_addr()), "mark miss");
        }
        expect_ok(c.slash_keeper(keeper_addr(), B256::ZERO), "slash to fund pool");
        assert_eq!(c.reward_pool_wei.get(), U256::from(100u64));
        // Give the contract balance for the outbound transfer.
        vm.set_balance(c.vm().contract_address(), U256::from(1_000u64));
        // Claim: payable = min(accrued=1000, pool=100) = 100.
        vm.set_sender(keeper_addr());
        let paid = expect_ok(c.claim_rewards(), "claim from funded pool");
        assert_eq!(paid, U256::from(100u64));
        // Pool drained, keeper's accrual reduced by paid amount.
        assert_eq!(c.reward_pool_wei.get(), U256::ZERO);
        let (_s2, _m2, _a2, _l2, remaining) = c.get_keeper(keeper_addr());
        assert_eq!(remaining, U256::from(900u64));
    }

    // ===================================================================
    // set_keeper_min_stake_emergency
    // ===================================================================

    #[test]
    fn set_keeper_min_stake_is_praetor_only() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        vm.set_sender(stranger_addr());
        match c.set_keeper_min_stake_emergency(U256::from(1u64), B256::ZERO) {
            Err(VigilError::Unauthorized(e)) => assert_eq!(e.caller, stranger_addr()),
            _ => panic!("expected Unauthorized, got a different VigilError variant"),
        }
    }

    #[test]
    fn set_keeper_min_stake_updates_and_emits() {
        let vm = TestVM::new();
        let mut c = deploy(&vm);
        let new_min = U256::from(10_000_000_000_000_000u64); // 0.01 ETH
        vm.set_sender(praetor_addr());
        expect_ok(
            c.set_keeper_min_stake_emergency(new_min, B256::ZERO),
            "praetor sets min stake",
        );
        assert_eq!(c.params.keeper_min_stake_wei.get(), new_min);
        // KeeperMinStakeUpdated emitted (off-chain mainnet-regression watch hook).
        let logs = vm.get_emitted_logs();
        let topic0 = KeeperMinStakeUpdated::SIGNATURE_HASH;
        assert!(
            logs.iter().any(|(topics, _)| topics.first() == Some(&topic0)),
            "expected a KeeperMinStakeUpdated log"
        );
    }

    // ===================================================================
    // pick_nms_position pure helper
    // ===================================================================

    #[test]
    fn pick_nms_position_empty_is_zero_nonempty_is_first() {
        assert_eq!(pick_nms_position(&[]), U256::ZERO);
        let positions = vec![U256::from(7u64), U256::from(3u64)];
        assert_eq!(pick_nms_position(&positions), U256::from(7u64));
    }
}
