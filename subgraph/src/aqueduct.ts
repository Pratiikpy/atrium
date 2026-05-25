import {
  CrossChainCredit as CCEvent,
  CrossChainCreditSettled as CCSettledEvent,
  CrossChainCreditClaimedBack as CCClaimedBackEvent,
  EmergencyPaused as EmergencyPausedEvent,
  Resumed as ResumedEvent,
  LinkBalanceLow as LinkBalanceLowEvent,
} from '../generated/Aqueduct/Aqueduct';
import {
  CrossChainCredit,
  AqueductPauseState,
  AlertEvent,
} from '../generated/schema';
import { BigInt } from '@graphprotocol/graph-ts';

// Audit K-3 fix: cross-chain credit lifecycle now flips state on settle and
// claim-back. The pause state is a singleton entity keyed by "0".

const PAUSE_STATE_ID = '0';

function loadOrCreatePauseState(): AqueductPauseState {
  let state = AqueductPauseState.load(PAUSE_STATE_ID);
  if (state == null) {
    state = new AqueductPauseState(PAUSE_STATE_ID);
    state.isPaused = false;
  }
  return state;
}

export function handleCrossChainCredit(event: CCEvent): void {
  const id = event.params.message_id.toHexString();
  const cc = new CrossChainCredit(id);
  cc.user = event.params.user;
  // Both selectors come through as BigInt already (The Graph maps uint64
  // to BigInt). No fromI64 conversion needed.
  cc.sourceChainSelector = event.params.source_chain_selector;
  cc.destChainSelector = event.params.dest_chain_selector;
  cc.amountWei = event.params.collateral_amount_wei;
  cc.expiresAtTimestamp = event.params.expires_at_timestamp;
  cc.isSettled = false;
  cc.isClaimedBack = false;
  cc.createdAtBlock = event.block.number;
  cc.save();
}

export function handleCrossChainCreditSettled(event: CCSettledEvent): void {
  const id = event.params.message_id.toHexString();
  const cc = CrossChainCredit.load(id);
  if (cc == null) return;
  cc.isSettled = true;
  cc.settledAtBlock = event.block.number;
  cc.save();
}

export function handleCrossChainCreditClaimedBack(event: CCClaimedBackEvent): void {
  const id = event.params.message_id.toHexString();
  const cc = CrossChainCredit.load(id);
  if (cc == null) return;
  cc.isClaimedBack = true;
  cc.claimedBackAmountWei = event.params.amount_wei;
  cc.claimedBackAtBlock = event.block.number;
  cc.save();
}

export function handleEmergencyPaused(event: EmergencyPausedEvent): void {
  const state = loadOrCreatePauseState();
  state.isPaused = true;
  state.lastPausedBy = event.params.by;
  state.lastPausedReason = event.params.reason;
  state.lastPausedAtBlock = event.block.number;
  state.save();
}

export function handleResumed(event: ResumedEvent): void {
  const state = loadOrCreatePauseState();
  state.isPaused = false;
  state.lastResumedBy = event.params.by;
  state.lastResumedAtBlock = event.block.number;
  state.save();
}

// Tier-1 ops alert. Note: Aqueduct currently emits LinkBalanceLow on every
// send while balance < threshold. The verify-app ops surface deduplicates
// client-side by checking whether the previous alert is in the same hour.
// A future contract iteration could move the dedup into Solidity (only emit
// on threshold-crossing edge) but that's a separate change.
export function handleLinkBalanceLow(event: LinkBalanceLowEvent): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const a = new AlertEvent(id);
  a.kind = 'link_balance_low';
  a.contract = 'Aqueduct';
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.linkBalanceWei = event.params.balance;
  a.link30dUsageWei = event.params.last_month_usage;
  a.save();
}
