import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleAttestationPublished } from '../src/lantern';

describe('Lantern handlers', () => {
  beforeEach(() => { clearStore(); });

  test('republishing same root creates a new entity row (txHash+logIndex ID)', () => {
    const root = Bytes.fromHexString('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

    // First publish
    const event1 = newMockEvent();
    event1.transaction.hash = Bytes.fromHexString('0x1111111111111111111111111111111111111111111111111111111111111111') as Bytes;
    event1.logIndex = BigInt.fromI32(0);
    event1.parameters = [
      new ethereum.EventParam('root', ethereum.Value.fromBytes(root)),
      new ethereum.EventParam('block_number', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))),
      new ethereum.EventParam('timestamp', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))),
      new ethereum.EventParam('leafCount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(5))),
      new ethereum.EventParam('ipfsCid', ethereum.Value.fromString('QmTest123')),
    ];
    handleAttestationPublished(event1 as any);

    // Second publish with same root but different tx
    const event2 = newMockEvent();
    event2.transaction.hash = Bytes.fromHexString('0x2222222222222222222222222222222222222222222222222222222222222222') as Bytes;
    event2.logIndex = BigInt.fromI32(0);
    event2.parameters = [
      new ethereum.EventParam('root', ethereum.Value.fromBytes(root)),
      new ethereum.EventParam('block_number', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200))),
      new ethereum.EventParam('timestamp', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2000))),
      new ethereum.EventParam('leafCount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(7))),
      new ethereum.EventParam('ipfsCid', ethereum.Value.fromString('QmTest456')),
    ];
    handleAttestationPublished(event2 as any);

    // Both rows should exist (different IDs)
    assert.entityCount('LanternAttestation', 2);
  });

  test('entity stores root field for query-by-root pattern', () => {
    const root = Bytes.fromHexString('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    const event = newMockEvent();
    event.transaction.hash = Bytes.fromHexString('0x3333333333333333333333333333333333333333333333333333333333333333') as Bytes;
    event.logIndex = BigInt.fromI32(2);
    event.parameters = [
      new ethereum.EventParam('root', ethereum.Value.fromBytes(root)),
      new ethereum.EventParam('block_number', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(300))),
      new ethereum.EventParam('timestamp', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3000))),
      new ethereum.EventParam('leafCount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10))),
      new ethereum.EventParam('ipfsCid', ethereum.Value.fromString('QmTest789')),
    ];
    handleAttestationPublished(event as any);

    const id = '0x3333333333333333333333333333333333333333333333333333333333333333-2';
    assert.fieldEquals('LanternAttestation', id, 'leafCount', '10');
  });
});
