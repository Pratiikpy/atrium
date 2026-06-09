import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handlePositionOpenedViaRouter, handlePositionClosedViaRouter } from '../src/atrium_router';
import { PositionOpenedViaRouter, PositionClosedViaRouter } from '../generated/AtriumRouter/AtriumRouter';

describe('AtriumRouter handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handlePositionOpenedViaRouter creates RouterPositionEvent with action open', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('user', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('venue_id', ethereum.Value.fromI32(1)),
      new ethereum.EventParam('instrument_id', ethereum.Value.fromBytes(Bytes.fromHexString('0xabcd'))),
      new ethereum.EventParam('notional_signed', ethereum.Value.fromSignedBigInt(BigInt.fromI32(5000))),
      new ethereum.EventParam('plinth_position_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10))),
      new ethereum.EventParam('venue_position_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(20))),
    ];
    handlePositionOpenedViaRouter(changetype<PositionOpenedViaRouter>(event));
    assert.entityCount('RouterPositionEvent', 1);
  });

  test('handlePositionClosedViaRouter creates RouterPositionEvent with action close', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('user', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('venue_id', ethereum.Value.fromI32(1)),
      new ethereum.EventParam('plinth_position_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10))),
      new ethereum.EventParam('venue_position_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(20))),
      new ethereum.EventParam('realized_pnl_signed', ethereum.Value.fromSignedBigInt(BigInt.fromI32(500))),
    ];
    handlePositionClosedViaRouter(changetype<PositionClosedViaRouter>(event));
    assert.entityCount('RouterPositionEvent', 1);
  });
});
