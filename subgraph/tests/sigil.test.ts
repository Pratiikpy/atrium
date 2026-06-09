import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleSigilRevoked, handleSigilRevokeAll, handleIntentValidated, handleSigilOpenNotionalDecremented } from '../src/sigil';
import { SigilRevoked, SigilRevokeAll, IntentValidated, SigilOpenNotionalDecremented } from '../generated/Sigil/Sigil';

describe('Sigil handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleSigilRevoked creates SigilRevocation', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('intent_hash', ethereum.Value.fromBytes(Bytes.fromHexString('0xdeadbeef'))),
    ];
    handleSigilRevoked(changetype<SigilRevoked>(event));
    assert.entityCount('SigilRevocation', 1);
  });

  test('handleSigilRevokeAll creates SigilRevocation with agent and newNonce', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('agent', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('new_nonce', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(5))),
    ];
    handleSigilRevokeAll(changetype<SigilRevokeAll>(event));
    assert.entityCount('SigilRevocation', 1);
  });

  test('handleIntentValidated writes SigilValidation + IntentToAgent + bumps Agent counter', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('agent', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('intent_hash', ethereum.Value.fromBytes(Bytes.fromHexString('0xcafebabe'))),
    ];
    handleIntentValidated(changetype<IntentValidated>(event));
    assert.entityCount('SigilValidation', 1);
    assert.entityCount('IntentToAgent', 1);
    assert.fieldEquals('IntentToAgent', '0xcafebabe', 'agent', '0x0000000000000000000000000000000000000002');
    assert.entityCount('Counter', 1);
  });

  test('handleSigilOpenNotionalDecremented creates SubsystemDiagnosticEvent', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('agent', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('previous', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10000))),
      new ethereum.EventParam('next', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(8000))),
      new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2000))),
    ];
    handleSigilOpenNotionalDecremented(changetype<SigilOpenNotionalDecremented>(event));
    assert.entityCount('SubsystemDiagnosticEvent', 1);
  });
});
