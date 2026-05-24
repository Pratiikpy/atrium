import { Scheduled, Executed, Cancelled, EmergencyPaused } from '../generated/PraetorTimelock/PraetorTimelock';
import { TimelockSchedule, AlertEvent } from '../generated/schema';

export function handleScheduled(event: Scheduled): void {
  const id = event.params.id.toHexString();
  const s = new TimelockSchedule(id);
  s.target = event.params.target;
  s.data = event.params.data;
  s.scheduledAt = event.params.scheduled_at;
  s.save();
}

export function handleExecuted(event: Executed): void {
  const id = event.params.id.toHexString();
  const s = TimelockSchedule.load(id);
  if (!s) return;
  s.executedAt = event.block.timestamp;
  s.save();
}

export function handleCancelled(event: Cancelled): void {
  const id = event.params.id.toHexString();
  const s = TimelockSchedule.load(id);
  if (!s) return;
  s.cancelledAt = event.block.timestamp;
  s.save();
}

/**
 * Ops alert. The Praetor multisig's instant-pause path bypasses the 48h
 * timelock — used for incident response. Without indexing, the bypass had
 * no operator visibility (audit human_left.md #26 noted this as HIGH; the
 * gap survived multiple subsequent iterations because the per-source
 * matching bug in check-event-indexing.mjs masked it). Feeds the
 * AlertEvent timeline so PagerDuty / Discord can subscribe to the same
 * single source as other ops alerts.
 */
export function handleEmergencyPaused(event: EmergencyPaused): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const a = new AlertEvent(id);
  a.kind = 'emergency_pause_invoked';
  a.contract = 'PraetorTimelock';
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  // Reuse `adapter` for the paused target — semantically it's the
  // address being affected by the action, which is the same shape as
  // adapter_emergency_deregistered above.
  a.adapter = event.params.target;
  a.reason = event.params.reason;
  a.save();
}
