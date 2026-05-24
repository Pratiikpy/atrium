import { Bytes, BigInt } from '@graphprotocol/graph-ts';
import { Agent } from '../../generated/schema';

/**
 * Agent entity aggregate writer.
 *
 * The `Agent` entity is defined in schema.graphql and queried by three
 * verify-app surfaces (rostrum-leaderboard, agents/leaderboard,
 * portfolio/activity), but pre-fix no handler ever wrote it — the
 * leaderboards silently returned empty arrays forever. Found by the
 * iteration-16 silent-failure audit.
 *
 * Aggregation rules (which handler calls which function):
 *
 *   - Sigil.handleIntentValidated → recordAction(agent, timestamp)
 *     Bumps `totalActionsCount` and updates `lastActionTimestamp`.
 *
 *   - Rostrum.handleReputationUpdated → setReputation(agent, score)
 *     Copies the current score (also stored authoritatively in
 *     RostrumReputation; the Agent rollup is a denormalized read path).
 *
 * Known gap (documented honestly per CLAUDE.md "honesty over hype"):
 * `totalPnlSigned` requires binding agent → position → realized PnL.
 * Plinth.PositionOpened/Closed events carry the position OWNER, not the
 * AGENT that triggered the action. The link runs through Sigil.intent_hash:
 * IntentValidated emits (owner, agent, intent_hash), and the eventual
 * PositionOpened can be matched to that intent via Plinth's action_sigil
 * payload — but that mapping isn't currently indexed. Year-1 leaves
 * totalPnlSigned at the default 0 with this gap noted; the
 * verify-app leaderboards advertise themselves as "actions + reputation
 * leaderboard" rather than "PnL leaderboard" until the gap closes.
 */

export function recordAction(agentAddr: Bytes, timestamp: BigInt): void {
  const id = agentAddr.toHexString();
  let a = Agent.load(id);
  if (a == null) {
    a = new Agent(id);
    a.totalActionsCount = BigInt.zero();
    a.totalPnlSigned = BigInt.zero();
    a.reputationScore = 0;
    a.lastActionTimestamp = timestamp;
  }
  a.totalActionsCount = a.totalActionsCount.plus(BigInt.fromI32(1));
  a.lastActionTimestamp = timestamp;
  a.save();
}

export function setReputation(agentAddr: Bytes, score: i32, timestamp: BigInt): void {
  const id = agentAddr.toHexString();
  let a = Agent.load(id);
  if (a == null) {
    // Reputation can flip before any action is recorded (admin-set initial
    // reputation, or backfilled from off-chain attestations). Create the
    // entity with zero action count so it's still queryable.
    a = new Agent(id);
    a.totalActionsCount = BigInt.zero();
    a.totalPnlSigned = BigInt.zero();
    a.lastActionTimestamp = timestamp;
  }
  a.reputationScore = score;
  a.save();
}
