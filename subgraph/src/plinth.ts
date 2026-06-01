import { BigInt, Bytes, store } from '@graphprotocol/graph-ts';
import {
  MarginUpdated,
  PositionOpened,
  PositionClosed,
  AccountPaused,
  AccountResumed,
  PlinthPaused,
  PlinthResumed,
  OracleDisagreement,
  VigilQueueFailed,
} from '../generated/Plinth/Plinth';
import {
  MarginAccount,
  Position,
  MarginUpdate,
  PlinthPauseState,
  AlertEvent,
  IntentToAgent,
} from '../generated/schema';
import { incrementCounter } from './_shared/counter';

const PLINTH_PAUSE_STATE_ID = '0';

function loadOrCreatePlinthPauseState(): PlinthPauseState {
  let state = PlinthPauseState.load(PLINTH_PAUSE_STATE_ID);
  if (state == null) {
    state = new PlinthPauseState(PLINTH_PAUSE_STATE_ID);
    state.isGloballyPaused = false;
  }
  return state;
}

/**
 * Scribe mapping, Plinth events.
 *
 * Indexes every margin update, position open, position close, and account
 * pause from the Plinth contract. Frontend reads from these entities.
 *
 * No off-chain enrichment, schema is a faithful mirror of contract events
 * per the "honesty over hype" rule.
 */

export function handleMarginUpdated(event: MarginUpdated): void {
  const userId = event.params.user.toHexString();
  let acc = MarginAccount.load(userId);
  if (!acc) {
    acc = new MarginAccount(userId);
    acc.user = event.params.user;
    acc.isPaused = false;
  }
  acc.collateralValueWei = event.params.collateral_value_wei;
  acc.requiredMarginWei = event.params.required_margin_wei;
  acc.marginVersion = event.params.margin_version;
  // The Graph generates BigInt for uint64 + uint256 Solidity types alike,
  // so the param is already a BigInt, no fromU64 conversion needed.
  acc.lastUpdateBlock = event.params.block_number;
  acc.save();

  // Append a MarginUpdate event entity (immutable history)
  const updateId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const update = new MarginUpdate(updateId);
  update.account = userId;
  update.blockNumber = event.block.number;
  update.timestamp = event.block.timestamp;
  update.collateralValueWei = event.params.collateral_value_wei;
  update.requiredMarginWei = event.params.required_margin_wei;
  update.marginVersion = event.params.margin_version;
  update.save();
}

export function handlePositionOpened(event: PositionOpened): void {
  const ownerId = event.params.owner.toHexString();

  // Ensure account exists (margin event may follow later)
  let acc = MarginAccount.load(ownerId);
  if (!acc) {
    acc = new MarginAccount(ownerId);
    acc.user = event.params.owner;
    acc.collateralValueWei = BigInt.zero();
    acc.requiredMarginWei = BigInt.zero();
    acc.marginVersion = BigInt.zero();
    acc.lastUpdateBlock = event.block.number;
    acc.isPaused = false;
    acc.save();
  }

  const positionId = event.params.position_id.toString();
  const pos = new Position(positionId);
  pos.owner = ownerId;
  pos.venueId = event.params.venue_id;
  pos.instrumentId = event.params.instrument_id;
  pos.notionalSigned = event.params.notional_signed;
  pos.entryPriceQ64 = event.params.entry_price_q64;
  pos.openedAtBlock = event.block.number;
  pos.openedAtTimestamp = event.block.timestamp;
  pos.save();

  // Phase 13a: write IntentToAgent mapping for Agent.totalPnlSigned join
  const intentHash = event.params.intent_hash;
  if (intentHash.notEqual(Bytes.fromHexString('0x0000000000000000000000000000000000000000000000000000000000000000'))) {
    const intentId = intentHash.toHexString();
    let mapping = IntentToAgent.load(intentId);
    if (!mapping) {
      mapping = new IntentToAgent(intentId);
      mapping.agent = event.params.owner; // agent resolved from intent; owner is placeholder until Sigil emits
      mapping.owner = event.params.owner;
      mapping.createdAt = event.block.timestamp;
      mapping.save();
    }
  }

  // Phase 4: Counter writes (closes #44 ghost-entity, SD-10)
  incrementCounter('openPositionsCount', BigInt.fromI32(1), event.block.timestamp);
}

export function handlePositionClosed(event: PositionClosed): void {
  const positionId = event.params.position_id.toString();
  const pos = Position.load(positionId);
  if (!pos) return;
  pos.closedAtBlock = event.block.number;
  pos.closedAtTimestamp = event.block.timestamp;
  pos.realizedPnlSigned = event.params.realized_pnl_signed;
  pos.save();

  // Phase 4: Counter writes
  incrementCounter('openPositionsCount', BigInt.fromI32(-1), event.block.timestamp);
  incrementCounter('closedPositionsCount', BigInt.fromI32(1), event.block.timestamp);

  // TODO (Phase 2a follow-up, SD-23): When Plinth emits intent_hash on
  // PositionClosed, look up IntentToAgent(intentHash) to get agent, then
  // update Agent(agent).totalPnlSigned += realized_pnl_signed. Currently
  // Plinth does not emit intent_hash on position events, deferral documented.
}

export function handleAccountPaused(event: AccountPaused): void {
  const userId = event.params.user.toHexString();
  const acc = MarginAccount.load(userId);
  if (!acc) return;
  acc.isPaused = true;
  acc.save();
}

export function handleAccountResumed(event: AccountResumed): void {
  const userId = event.params.user.toHexString();
  const acc = MarginAccount.load(userId);
  if (!acc) return;
  acc.isPaused = false;
  acc.save();
}

// Audit K-4 fix: track Plinth global pause state (emitted by G-6 pause(string)).
export function handlePlinthPaused(event: PlinthPaused): void {
  const state = loadOrCreatePlinthPauseState();
  state.isGloballyPaused = true;
  // Wave A.7: reason is now bytes32 (keccak256 of human text). Store as hex
  // string for the schema's `String` type; off-chain consumers decode/match.
  state.lastReason = event.params.reason.toHexString();
  state.lastPausedAtBlock = event.block.number;
  state.save();
}

export function handlePlinthResumed(event: PlinthResumed): void {
  const state = loadOrCreatePlinthPauseState();
  state.isGloballyPaused = false;
  state.lastResumedAtBlock = event.block.number;
  state.save();
}

// Tier-1 ops-alert events. Surface to AlertEvent so the verify-app's
// ops timeline picks them up from a single query.

export function handleOracleDisagreement(event: OracleDisagreement): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const a = new AlertEvent(id);
  a.kind = 'oracle_disagreement';
  a.contract = 'Plinth';
  a.txHash = event.transaction.hash;
  a.detail = 'Chainlink/Pyth price divergence exceeded tolerance';
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.chainlinkPriceQ64 = event.params.chainlink_price;
  a.pythPriceQ64 = event.params.pyth_price;
  a.toleranceBps = event.params.tolerance_bps;
  a.save();
}

export function handleVigilQueueFailed(event: VigilQueueFailed): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const a = new AlertEvent(id);
  a.kind = 'vigil_queue_failed';
  a.contract = 'Plinth';
  a.txHash = event.transaction.hash;
  a.detail = 'Vigil liquidation queue submission failed';
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.user = event.params.user;
  a.marginVersion = event.params.margin_version;
  a.save();
}
