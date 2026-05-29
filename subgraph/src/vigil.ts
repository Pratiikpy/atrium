import { BigInt } from '@graphprotocol/graph-ts';
import {
  LiquidationTriggered,
  LiquidationExecuted,
  KeeperStaked,
  KeeperSlashed,
  KeeperMissedWindow,
  KeeperRewarded,
  StaleJobRejected,
} from '../generated/Vigil/Vigil';
import { Vigil } from '../generated/Vigil/Vigil';
import { LiquidationEvent, Keeper, SubsystemDiagnosticEvent } from '../generated/schema';
import { incrementCounter, setCounterField } from './_shared/counter';

export function handleLiquidationTriggered(event: LiquidationTriggered): void {
  // Triggered → not yet executed. The Executed handler creates the LiquidationEvent.
}

export function handleLiquidationExecuted(event: LiquidationExecuted): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const liq = new LiquidationEvent(id);
  liq.positionId = BigInt.fromU64(event.params.job_id.toU64());
  liq.keeper = event.params.keeper;
  liq.recoveredCollateralWei = event.params.recovered_collateral_wei;
  liq.actualLiquidationBps = event.params.actual_liquidation_bps;
  liq.blockNumber = event.block.number;
  liq.timestamp = event.block.timestamp;
  liq.txHash = event.transaction.hash;
  // Phase 2c: resolve user from Vigil.jobs(job_id).user view call.
  const vigilContract = Vigil.bind(event.address);
  const jobResult = vigilContract.try_jobs(event.params.job_id);
  if (!jobResult.reverted) {
    // jobs() returns (position_id, user, ...) — value1 = user address
    liq.user = jobResult.value.value1;
    liq.account = jobResult.value.value1.toHexString();
  } else {
    liq.user = event.params.keeper; // fallback: keeper address if view reverts
    liq.account = '';
  }
  liq.save();

  // Bump keeper counters
  const keeperId = event.params.keeper.toHexString();
  let k = Keeper.load(keeperId);
  if (!k) {
    k = new Keeper(keeperId);
    k.stakeWei = BigInt.zero();
    k.missedWindows24h = 0;
    k.isActive = true;
    k.totalLiquidationsExecuted = BigInt.zero();
    k.totalRewardsWei = BigInt.zero();
    k.totalSlashedWei = BigInt.zero();
  }
  k.totalLiquidationsExecuted = k.totalLiquidationsExecuted.plus(BigInt.fromI32(1));
  k.lastActionTimestamp = event.block.timestamp;
  k.save();

  // Phase 4: Counter writes (SD-10)
  incrementCounter('totalLiquidationsCount', BigInt.fromI32(1), event.block.timestamp);
}

export function handleKeeperStaked(event: KeeperStaked): void {
  const keeperId = event.params.keeper.toHexString();
  let k = Keeper.load(keeperId);
  const wasActive = k != null ? k.isActive : false;
  if (!k) {
    k = new Keeper(keeperId);
    k.stakeWei = BigInt.zero();
    k.missedWindows24h = 0;
    k.isActive = true;
    k.totalLiquidationsExecuted = BigInt.zero();
    k.totalRewardsWei = BigInt.zero();
    k.totalSlashedWei = BigInt.zero();
  }
  k.stakeWei = k.stakeWei.plus(event.params.stake_amount_wei);
  // Staking always reactivates the keeper
  k.isActive = true;
  k.save();

  // Phase 4: rebuild liveKeepersCount if activation state changed
  if (!wasActive) {
    incrementCounter('liveKeepersCount', BigInt.fromI32(1), event.block.timestamp);
  }
}

export function handleKeeperSlashed(event: KeeperSlashed): void {
  const keeperId = event.params.keeper.toHexString();
  const k = Keeper.load(keeperId);
  if (!k) return;
  const wasActive = k.isActive;
  k.totalSlashedWei = k.totalSlashedWei.plus(event.params.slashed_amount_wei);
  k.stakeWei = k.stakeWei.minus(event.params.slashed_amount_wei);
  if (k.stakeWei.lt(BigInt.fromString('1000000000000000000000'))) {
    k.isActive = false;
  }
  // Audit GGGG-1 + KKKK-1: slash resets miss count to 0 per
  // `vigil/lib.rs:386` (`k.missed_windows_24h.set(U256::ZERO)` inside
  // slash_keeper). Mirror the reset here so dashboards reflect the post-
  // slash state immediately rather than waiting for the next miss event.
  k.missedWindows24h = 0;
  k.save();

  // Phase 4: decrement liveKeepersCount if keeper became inactive
  if (wasActive && !k.isActive) {
    incrementCounter('liveKeepersCount', BigInt.fromI32(-1), event.block.timestamp);
  }
}

// Audit KKKK-1: handler paired with `Vigil.mark_keeper_missed_window`
// (GGGG-1 fix). Praetor multisig calls the on-chain function; this writes
// the new miss count into the Keeper entity so the dashboard surfaces
// "keeper at N of max_misses" before the slash threshold lands.
export function handleKeeperMissedWindow(event: KeeperMissedWindow): void {
  const keeperId = event.params.keeper.toHexString();
  let k = Keeper.load(keeperId);
  if (!k) {
    // Mark called before stake — defensive create so the count survives
    // even if event ordering is unusual.
    k = new Keeper(keeperId);
    k.stakeWei = BigInt.zero();
    k.missedWindows24h = 0;
    k.isActive = false;
    k.totalLiquidationsExecuted = BigInt.zero();
    k.totalRewardsWei = BigInt.zero();
    k.totalSlashedWei = BigInt.zero();
  }
  // schema.graphql declares this as Int (i32); the param comes through
  // as BigInt because The Graph maps every Solidity uint < uint256 the
  // same way. Narrow with .toI32().
  k.missedWindows24h = event.params.new_miss_count.toI32();
  k.save();
}

// Tier-2 defensive observability. Per-liquidation keeper reward.
// Dual-write: aggregates into Keeper.totalRewardsWei (cumulative dashboard) +
// SubsystemDiagnosticEvent (per-reward audit trail).
export function handleKeeperRewarded(event: KeeperRewarded): void {
  const keeperId = event.params.keeper.toHexString();
  let k = Keeper.load(keeperId);
  if (k != null) {
    k.totalRewardsWei = k.totalRewardsWei.plus(event.params.reward_wei);
    k.lastActionTimestamp = event.block.timestamp;
    k.save();
  }
  // Always log the per-reward record even if Keeper entity doesn't exist
  // yet — the reward IS the source of truth, the aggregate is derived.
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const d = new SubsystemDiagnosticEvent(id);
  d.kind = 'keeper_rewarded';
  d.contract = 'Vigil';
  d.blockNumber = event.block.number;
  d.timestamp = event.block.timestamp;
  d.keeper = event.params.keeper;
  d.amountWei = event.params.reward_wei;
  d.save();
}

// Tier-2 defensive observability. Stale-version push attempt: a keeper
// tried to execute a liquidation against an outdated margin_version.
// Indicates the keeper is running stale state — surfaces a keeper-health
// signal before it cascades into missed-window slashing.
export function handleStaleJobRejected(event: StaleJobRejected): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const d = new SubsystemDiagnosticEvent(id);
  d.kind = 'keeper_stale_job_rejected';
  d.contract = 'Vigil';
  d.blockNumber = event.block.number;
  d.timestamp = event.block.timestamp;
  d.jobId = event.params.job_id;
  d.expectedVersion = event.params.expected_version;
  d.actualVersion = event.params.actual_version;
  d.save();
}
