import { AdapterRegistered, AdapterDeregistered, AdapterEmergencyDeregistered } from '../generated/PorticoRegistry/PorticoRegistry';
import { AdapterEvent, AlertEvent } from '../generated/schema';

export function handleAdapterRegistered(event: AdapterRegistered): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const a = new AdapterEvent(id);
  a.venueId = event.params.venue_id;
  a.adapter = event.params.adapter;
  a.majorVersion = event.params.major_version;
  a.action = 'registered';
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.save();
}

export function handleAdapterDeregistered(event: AdapterDeregistered): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const a = new AdapterEvent(id);
  a.venueId = event.params.venue_id;
  a.adapter = event.params.adapter;
  a.action = 'deregistered';
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.save();
}

// Tier-1 ops alert. Emergency deregister is rare but always incident-response.
// Dual-write to both AdapterEvent (so the adapter timeline shows the
// deregister) AND AlertEvent (so the ops timeline shows the incident).
export function handleAdapterEmergencyDeregistered(event: AdapterEmergencyDeregistered): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const a = new AdapterEvent(id);
  a.venueId = event.params.venue_id;
  a.adapter = event.params.adapter;
  a.action = 'emergency_deregistered';
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.save();

  const alertId = id + '-alert';
  const alert = new AlertEvent(alertId);
  alert.kind = 'adapter_emergency_deregistered';
  alert.contract = 'PorticoRegistry';
  alert.blockNumber = event.block.number;
  alert.timestamp = event.block.timestamp;
  alert.venueId = event.params.venue_id;
  alert.adapter = event.params.adapter;
  alert.reason = event.params.reason;
  alert.save();
}
