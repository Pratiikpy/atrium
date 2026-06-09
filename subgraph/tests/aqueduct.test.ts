import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleCrossChainCredit, handleCrossChainCreditSettled, handleCrossChainCreditClaimedBack, handleEmergencyPaused, handleResumed, handleLinkBalanceLow } from '../src/aqueduct';
import { CrossChainCredit, AqueductPauseState } from '../generated/schema';
import { CrossChainCredit as CrossChainCreditEvent, CrossChainCreditSettled, CrossChainCreditClaimedBack, EmergencyPaused, Resumed, LinkBalanceLow } from '../generated/Aqueduct/Aqueduct';

describe('Aqueduct handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleCrossChainCredit creates CrossChainCredit entity', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('message_id', ethereum.Value.fromBytes(Bytes.fromHexString('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'))),
      new ethereum.EventParam('user', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('source_chain_selector', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
      new ethereum.EventParam('dest_chain_selector', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2))),
      new ethereum.EventParam('collateral_amount_wei', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000))),
      new ethereum.EventParam('expires_at_timestamp', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(9999999))),
    ];
    handleCrossChainCredit(changetype<CrossChainCreditEvent>(event));
    assert.entityCount('CrossChainCredit', 1);
    assert.fieldEquals('CrossChainCredit', '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 'isSettled', 'false');
    assert.fieldEquals('CrossChainCredit', '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 'isClaimedBack', 'false');
  });

  test('handleCrossChainCreditSettled flips isSettled to true', () => {
    const cc = new CrossChainCredit('0xaa');
    cc.user = Address.fromString('0x0000000000000000000000000000000000000001');
    cc.sourceChainSelector = BigInt.fromI32(1);
    cc.destChainSelector = BigInt.fromI32(2);
    cc.amountWei = BigInt.fromI32(500000);
    cc.expiresAtTimestamp = BigInt.fromI32(9999999);
    cc.isSettled = false;
    cc.isClaimedBack = false;
    cc.createdAtBlock = BigInt.fromI32(100);
    cc.save();

    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('message_id', ethereum.Value.fromBytes(Bytes.fromHexString('0xaa'))),
    ];
    handleCrossChainCreditSettled(changetype<CrossChainCreditSettled>(event));
    assert.fieldEquals('CrossChainCredit', '0xaa', 'isSettled', 'true');
  });

  test('handleCrossChainCreditClaimedBack flips state and records amount', () => {
    const cc = new CrossChainCredit('0xbb');
    cc.user = Address.fromString('0x0000000000000000000000000000000000000001');
    cc.sourceChainSelector = BigInt.fromI32(1);
    cc.destChainSelector = BigInt.fromI32(2);
    cc.amountWei = BigInt.fromI32(500000);
    cc.expiresAtTimestamp = BigInt.fromI32(9999999);
    cc.isSettled = false;
    cc.isClaimedBack = false;
    cc.createdAtBlock = BigInt.fromI32(100);
    cc.save();

    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('message_id', ethereum.Value.fromBytes(Bytes.fromHexString('0xbb'))),
      new ethereum.EventParam('user', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('amount_wei', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(250000))),
    ];
    handleCrossChainCreditClaimedBack(changetype<CrossChainCreditClaimedBack>(event));
    assert.fieldEquals('CrossChainCredit', '0xbb', 'isClaimedBack', 'true');
    assert.fieldEquals('CrossChainCredit', '0xbb', 'claimedBackAmountWei', '250000');
  });

  test('handleEmergencyPaused sets singleton pause state', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('by', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000099'))),
      new ethereum.EventParam('reason', ethereum.Value.fromBytes(Bytes.fromUTF8('incident'))),
    ];
    handleEmergencyPaused(changetype<EmergencyPaused>(event));
    assert.entityCount('AqueductPauseState', 1);
    assert.fieldEquals('AqueductPauseState', '0', 'isPaused', 'true');
  });

  test('handleResumed clears pause state', () => {
    const state = new AqueductPauseState('0');
    state.isPaused = true;
    state.save();

    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('by', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000099'))),
    ];
    handleResumed(changetype<Resumed>(event));
    assert.fieldEquals('AqueductPauseState', '0', 'isPaused', 'false');
  });

  test('handleLinkBalanceLow creates AlertEvent', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('balance', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))),
      new ethereum.EventParam('last_month_usage', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(5000))),
    ];
    handleLinkBalanceLow(changetype<LinkBalanceLow>(event));
    assert.entityCount('AlertEvent', 1);
  });
});
