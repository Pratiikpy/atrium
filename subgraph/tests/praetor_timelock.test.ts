import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleScheduled, handleExecuted, handleCancelled } from '../src/praetor_timelock';
import { TimelockSchedule } from '../generated/schema';

describe('PraetorTimelock handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleScheduled creates TimelockSchedule', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('id', ethereum.Value.fromBytes(Bytes.fromHexString('0xaabb'))),
      new ethereum.EventParam('target', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('data', ethereum.Value.fromBytes(Bytes.fromHexString('0x1234'))),
      new ethereum.EventParam('scheduled_at', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000))),
    ];
    handleScheduled(event as any);
    assert.entityCount('TimelockSchedule', 1);
    assert.fieldEquals('TimelockSchedule', '0xaabb', 'scheduledAt', '1000000');
  });

  test('handleExecuted sets executedAt', () => {
    const s = new TimelockSchedule('0xaabb');
    s.target = Address.fromString('0x0000000000000000000000000000000000000001');
    s.data = Bytes.fromHexString('0x1234');
    s.scheduledAt = BigInt.fromI32(1000000);
    s.save();

    const event = newMockEvent();
    event.block.timestamp = BigInt.fromI32(1100000);
    event.parameters = [
      new ethereum.EventParam('id', ethereum.Value.fromBytes(Bytes.fromHexString('0xaabb'))),
    ];
    handleExecuted(event as any);
    assert.fieldEquals('TimelockSchedule', '0xaabb', 'executedAt', '1100000');
  });

  test('handleCancelled sets cancelledAt', () => {
    const s = new TimelockSchedule('0xccdd');
    s.target = Address.fromString('0x0000000000000000000000000000000000000001');
    s.data = Bytes.fromHexString('0x5678');
    s.scheduledAt = BigInt.fromI32(1000000);
    s.save();

    const event = newMockEvent();
    event.block.timestamp = BigInt.fromI32(1050000);
    event.parameters = [
      new ethereum.EventParam('id', ethereum.Value.fromBytes(Bytes.fromHexString('0xccdd'))),
    ];
    handleCancelled(event as any);
    assert.fieldEquals('TimelockSchedule', '0xccdd', 'cancelledAt', '1050000');
  });
});
