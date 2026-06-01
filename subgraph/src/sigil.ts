import { BigInt } from '@graphprotocol/graph-ts';
import {
  SigilRevoked,
  SigilRevokeAll,
  IntentValidated,
  SigilOpenNotionalDecremented,
} from '../generated/Sigil/Sigil';
import { SigilRevocation, SigilValidation, SubsystemDiagnosticEvent, IntentToAgent } from '../generated/schema';
import { recordAction } from './_shared/agent_aggregate';
import { incrementCounter } from './_shared/counter';

export function handleSigilRevoked(event: SigilRevoked): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const r = new SigilRevocation(id);
  r.owner = event.params.owner;
  r.intentHash = event.params.intent_hash;
  r.txHash = event.transaction.hash;
  r.blockNumber = event.block.number;
  r.timestamp = event.block.timestamp;
  r.save();
}

export function handleSigilRevokeAll(event: SigilRevokeAll): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const r = new SigilRevocation(id);
  r.owner = event.params.owner;
  r.agent = event.params.agent;
  r.newNonce = event.params.new_nonce;
  r.txHash = event.transaction.hash;
  r.blockNumber = event.block.number;
  r.timestamp = event.block.timestamp;
  r.save();
}

// Audit K-5 fix: G-3 emits IntentValidated on every successful Sigil
// validation. This is the positive-proof entity for the Verifier Mode
// "agent acted under mandate" panel.
export function handleIntentValidated(event: IntentValidated): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const v = new SigilValidation(id);
  v.owner = event.params.owner;
  v.agent = event.params.agent;
  v.intentHash = event.params.intent_hash;
  v.blockNumber = event.block.number;
  v.timestamp = event.block.timestamp;
  v.txHash = event.transaction.hash;
  v.save();

  // Phase 4 (SD-23): Write IntentToAgent mapping for PnL attribution
  const intentId = event.params.intent_hash.toHexString();
  const mapping = new IntentToAgent(intentId);
  mapping.agent = event.params.agent;
  mapping.owner = event.params.owner;
  mapping.createdAt = event.block.timestamp;
  mapping.save();

  // Silent-failure fix (iteration 16): bump the Agent aggregate so the
  // verify-app leaderboards (rostrum-leaderboard, agents/leaderboard) have
  // a real data source. Pre-fix the Agent entity was schema-defined but
  // never written.
  recordAction(event.params.agent, event.block.timestamp);

  // Phase 4: Counter, increment activeAgentsCount (approximation: each
  // new agent validation bumps the count; the Agent entity creation in
  // recordAction is the authoritative signal for distinct agents).
  incrementCounter('activeAgentsCount', BigInt.fromI32(1), event.block.timestamp);
}

// Tier-2 defensive observability. Plinth-driven credit-line decrement
// (audit HHH-4). Surfaces the per-mandate open-notional accounting so the
// verify-app mandate-usage cap dashboard can render `next/cap` without
// reading the contract storage on every page load.
export function handleSigilOpenNotionalDecremented(event: SigilOpenNotionalDecremented): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const d = new SubsystemDiagnosticEvent(id);
  d.kind = 'sigil_open_notional_decremented';
  d.contract = 'Sigil';
  d.blockNumber = event.block.number;
  d.timestamp = event.block.timestamp;
  d.agent = event.params.agent;
  d.previousNotionalWei = event.params.previous;
  d.nextNotionalWei = event.params.next;
  d.amountWei = event.params.amount;
  d.save();
}
