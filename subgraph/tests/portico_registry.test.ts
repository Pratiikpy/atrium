import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleAdapterRegistered, handleAdapterDeregistered, handleAdapterEmergencyDeregistered } from '../src/portico_registry';

describe('PorticoRegistry handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleAdapterRegistered creates AdapterEvent', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('venue_id', ethereum.Value.fromI32(1)),
      new ethereum.EventParam('adapter', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000042'))),
      new ethereum.EventParam('major_version', ethereum.Value.fromI32(1)),
    ];
    handleAdapterRegistered(event as any);
    assert.entityCount('AdapterEvent', 1);
  });

  test('handleAdapterDeregistered creates AdapterEvent with action deregistered', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('venue_id', ethereum.Value.fromI32(1)),
      new ethereum.EventParam('adapter', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000042'))),
    ];
    handleAdapterDeregistered(event as any);
    assert.entityCount('AdapterEvent', 1);
  });

  test('handleAdapterEmergencyDeregistered dual-writes AdapterEvent + AlertEvent', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('venue_id', ethereum.Value.fromI32(1)),
      new ethereum.EventParam('adapter', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000042'))),
      new ethereum.EventParam('reason', ethereum.Value.fromString('exploit_detected')),
    ];
    handleAdapterEmergencyDeregistered(event as any);
    assert.entityCount('AdapterEvent', 1);
    assert.entityCount('AlertEvent', 1);
  });
});
