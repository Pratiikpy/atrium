import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleMarginUpdated, handlePositionOpened, handlePositionClosed } from '../src/plinth';
import { MarginAccount, Position, Counter } from '../generated/schema';

describe('Plinth handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleMarginUpdated creates MarginAccount and MarginUpdate', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('user', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('collateral_value_wei', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000))),
      new ethereum.EventParam('required_margin_wei', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500000))),
      new ethereum.EventParam('margin_version', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
      new ethereum.EventParam('block_number', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))),
    ];
    handleMarginUpdated(event as any);
    assert.entityCount('MarginAccount', 1);
    assert.entityCount('MarginUpdate', 1);
  });

  test('handlePositionOpened creates Position and increments Counter', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('position_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(42))),
      new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('venue_id', ethereum.Value.fromI32(1)),
      new ethereum.EventParam('instrument_id', ethereum.Value.fromBytes(Bytes.fromHexString('0xabcdef'))),
      new ethereum.EventParam('notional_signed', ethereum.Value.fromSignedBigInt(BigInt.fromI32(1000))),
      new ethereum.EventParam('entry_price_q64', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18446744073709551))),
      new ethereum.EventParam('intent_hash', ethereum.Value.fromBytes(Bytes.fromHexString('0x0000000000000000000000000000000000000000000000000000000000000000'))),
    ];
    handlePositionOpened(event as any);
    assert.entityCount('Position', 1);
    assert.fieldEquals('Position', '42', 'entryPriceQ64', '18446744073709551');
    // Counter should exist with openPositionsCount = 1
    assert.entityCount('Counter', 1);
    assert.fieldEquals('Counter', 'global', 'openPositionsCount', '1');
  });

  test('handlePositionClosed decrements openPositionsCount, increments closedPositionsCount', () => {
    // Pre-create a position
    const pos = new Position('42');
    pos.owner = '0x0000000000000000000000000000000000000001';
    pos.venueId = 1;
    pos.instrumentId = Bytes.fromHexString('0xabcdef');
    pos.notionalSigned = BigInt.fromI32(1000);
    pos.entryPriceQ64 = BigInt.zero();
    pos.openedAtBlock = BigInt.fromI32(100);
    pos.openedAtTimestamp = BigInt.fromI32(1000);
    pos.save();

    // Pre-create counter
    const c = new Counter('global');
    c.openPositionsCount = BigInt.fromI32(1);
    c.closedPositionsCount = BigInt.zero();
    c.totalDepositsCount = BigInt.zero();
    c.totalWithdrawalsCount = BigInt.zero();
    c.totalTvlWei = BigInt.zero();
    c.totalLiquidationsCount = BigInt.zero();
    c.activeAgentsCount = BigInt.zero();
    c.cohortPartnersCount = BigInt.zero();
    c.liveKeepersCount = BigInt.zero();
    c.lastUpdated = BigInt.zero();
    c.save();

    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('position_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(42))),
      new ethereum.EventParam('realized_pnl_signed', ethereum.Value.fromSignedBigInt(BigInt.fromI32(500))),
    ];
    handlePositionClosed(event as any);
    assert.fieldEquals('Position', '42', 'realizedPnlSigned', '500');
    assert.fieldEquals('Counter', 'global', 'openPositionsCount', '0');
    assert.fieldEquals('Counter', 'global', 'closedPositionsCount', '1');
  });

  test('handlePositionClosed skips if position does not exist (load-before-create)', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('position_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(999))),
      new ethereum.EventParam('realized_pnl_signed', ethereum.Value.fromSignedBigInt(BigInt.fromI32(0))),
    ];
    handlePositionClosed(event as any);
    assert.entityCount('Position', 0);
  });
});
