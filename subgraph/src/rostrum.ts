import { BigInt } from '@graphprotocol/graph-ts';
import {
  FollowStarted,
  FollowEnded,
  MirrorTradeFilled,
  MirrorTradeFailed,
  LeaderDeboosted,
  ActionRecorded,
  ReputationUpdated,
} from '../generated/Rostrum/Rostrum';
import {
  RostrumFollow,
  RostrumMirrorTrade,
  RostrumLeaderDeboost,
  RostrumAgentAction,
  RostrumReputation,
} from '../generated/schema';
import { setReputation } from './_shared/agent_aggregate';

/**
 * Rostrum copy-trade indexer.
 *
 * Pre-fix the Rostrum contract was fully shipped (all 7 events fire from
 * real code paths) but had no subgraph wiring, the entire copy-trade
 * subsystem was invisible to the verify-app leaderboard.
 *
 * Design note: RostrumFollow is mutable (FollowStarted creates, FollowEnded
 * flips state). RostrumMirrorTrade is immutable per-trade. Reputation is
 * mutable with previous-score tracked so the agent profile can render
 * deltas without joining history.
 */

function followId(follower: string, leader: string): string {
  return follower.toLowerCase() + '-' + leader.toLowerCase();
}

export function handleFollowStarted(event: FollowStarted): void {
  const id = followId(event.params.follower.toHexString(), event.params.leader.toHexString());
  // Upsert: re-following after an FollowEnded should reset state, not error.
  let f = RostrumFollow.load(id);
  if (f == null) {
    f = new RostrumFollow(id);
  }
  f.follower = event.params.follower;
  f.leader = event.params.leader;
  f.allocationBps = event.params.allocation_bps;
  f.expiresAt = event.params.expires_at;
  f.state = 'active';
  f.startedAtBlock = event.block.number;
  f.startedAtTimestamp = event.block.timestamp;
  f.endedAtBlock = null;
  f.endedAtTimestamp = null;
  f.endedReason = null;
  f.save();
}

export function handleFollowEnded(event: FollowEnded): void {
  const id = followId(event.params.follower.toHexString(), event.params.leader.toHexString());
  const f = RostrumFollow.load(id);
  if (f == null) {
    // Defensive: an End without a Start indicates a chain reorg or startBlock
    // misconfig. Skip rather than create an orphan record.
    return;
  }
  f.state = 'ended';
  f.endedAtBlock = event.block.number;
  f.endedAtTimestamp = event.block.timestamp;
  f.endedReason = event.params.reason;
  f.save();
}

export function handleMirrorTradeFilled(event: MirrorTradeFilled): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const t = new RostrumMirrorTrade(id);
  t.follower = event.params.follower;
  t.leader = event.params.leader;
  t.leaderPositionId = event.params.leader_position_id;
  t.state = 'filled';
  t.followerNotionalSigned = event.params.follower_notional_signed;
  t.reason = null;
  t.blockNumber = event.block.number;
  t.timestamp = event.block.timestamp;
  t.save();
}

export function handleMirrorTradeFailed(event: MirrorTradeFailed): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const t = new RostrumMirrorTrade(id);
  t.follower = event.params.follower;
  t.leader = event.params.leader;
  t.leaderPositionId = event.params.leader_position_id;
  t.state = 'failed';
  t.followerNotionalSigned = null;
  t.reason = event.params.reason;
  t.blockNumber = event.block.number;
  t.timestamp = event.block.timestamp;
  t.save();
}

export function handleLeaderDeboosted(event: LeaderDeboosted): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const d = new RostrumLeaderDeboost(id);
  d.leader = event.params.leader;
  d.reason = event.params.reason;
  d.blockNumber = event.block.number;
  d.timestamp = event.block.timestamp;
  d.save();
}

export function handleActionRecorded(event: ActionRecorded): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const a = new RostrumAgentAction(id);
  a.agent = event.params.agent;
  a.actionKind = event.params.action_kind;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.save();
}

export function handleReputationUpdated(event: ReputationUpdated): void {
  const id = event.params.agent.toHexString();
  let r = RostrumReputation.load(id);
  if (r == null) {
    r = new RostrumReputation(id);
    r.agent = event.params.agent;
  }
  // The Graph maps Solidity uint64 to BigInt, no fromU64 conversion needed.
  r.previousScore = event.params.previous;
  r.currentScore = event.params.next;
  r.lastUpdatedAtBlock = event.block.number;
  r.lastUpdatedAtTimestamp = event.block.timestamp;
  r.save();
  // Silent-failure fix (iteration 16), comment corrected iteration 47.
  // Mirror the score into the Agent aggregate so the leaderboards see it.
  // Agent.reputationScore is Int! (i32, max ~2.1B). The iter-16 comment
  // CLAIMED Rostrum.sol caps scores at REPUTATION_MAX=1_000_000, that
  // was wrong; no such on-chain cap exists. The 2B clamp below is a pure
  // AssemblyScript representation safety net (uint64 → i32 narrowing),
  // not a domain bound. If a real REPUTATION_MAX constant lands in
  // Rostrum.sol later, surface it here.
  // next is a BigInt now (uint64 from Solidity → BigInt in The Graph).
  // Compare via BigInt and narrow to i32 only for the schema field.
  const cap = BigInt.fromI64(2_000_000_000);
  const clamped: i32 = event.params.next.gt(cap) ? <i32>cap.toI64() : event.params.next.toI32();
  setReputation(event.params.agent, clamped, event.block.timestamp);
}
