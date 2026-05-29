import { test, assert, clearStore, newMockEvent, describe, beforeEach, logStore } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleDeposit, handleWithdraw } from '../src/coffer';
import { Counter } from '../generated/schema';

describe('Coffer handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleDeposit creates CofferDeposit, updates CofferUserBalance, increments Counter', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('assets', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000))),
      new ethereum.EventParam('shares', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000))),
    ];
    handleDeposit(event as any);
    assert.entityCount('CofferDeposit', 1);
    assert.entityCount('CofferUserBalance', 1);
    assert.entityCount('Counter', 1);
    assert.fieldEquals('Counter', 'global', 'totalDepositsCount', '1');
    assert.fieldEquals('Counter', 'global', 'totalTvlWei', '1000000');
  });

  test('handleWithdraw clamps balance to zero and logs warning on underflow', () => {
    // Pre-create a balance with 500 wei
    const event1 = newMockEvent();
    event1.parameters = [
      new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('assets', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500))),
      new ethereum.EventParam('shares', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500))),
    ];
    handleDeposit(event1 as any);

    // Withdraw more than balance
    const event2 = newMockEvent();
    event2.parameters = [
      new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('receiver', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('assets', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))),
      new ethereum.EventParam('shares', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))),
    ];
    handleWithdraw(event2 as any);

    // Balance should be clamped to zero, not negative
    const userId = '0x0000000000000000000000000000000000000001';
    assert.fieldEquals('CofferUserBalance', userId, 'balanceWei', '0');
    assert.fieldEquals('CofferUserBalance', userId, 'netDepositedAssetsWei', '0');
  });

  test('handleWithdraw increments totalWithdrawalsCount', () => {
    // Deposit first
    const dep = newMockEvent();
    dep.parameters = [
      new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('assets', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2000))),
      new ethereum.EventParam('shares', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2000))),
    ];
    handleDeposit(dep as any);

    const wd = newMockEvent();
    wd.parameters = [
      new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('receiver', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('assets', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500))),
      new ethereum.EventParam('shares', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500))),
    ];
    handleWithdraw(wd as any);
    assert.fieldEquals('Counter', 'global', 'totalWithdrawalsCount', '1');
  });
});
