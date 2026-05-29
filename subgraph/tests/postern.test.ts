import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleKillSwitchActivated, handleSigilRevokeSkipped, handleSessionKeyIssued, handleSessionKeyRevoked, handleSessionKeyExpiredCleaned } from '../src/postern';
import { PosternSessionKey } from '../generated/schema';

describe('Postern handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleKillSwitchActivated creates KillSwitchEvent', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('user', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('sigil_agents_revoked', ethereum.Value.fromI32(3)),
      new ethereum.EventParam('session_keys_cancelled', ethereum.Value.fromI32(2)),
    ];
    handleKillSwitchActivated(event as any);
    assert.entityCount('KillSwitchEvent', 1);
  });

  test('handleSigilRevokeSkipped creates SubsystemDiagnosticEvent', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('user', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('agent', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('reason', ethereum.Value.fromBytes(Bytes.fromHexString('0x01'))),
    ];
    handleSigilRevokeSkipped(event as any);
    assert.entityCount('SubsystemDiagnosticEvent', 1);
  });

  test('session-key lifecycle: issued → revoked', () => {
    const userAddr = Address.fromString('0x0000000000000000000000000000000000000001');
    const keyAddr = Address.fromString('0x0000000000000000000000000000000000000099');

    const issueEvent = newMockEvent();
    issueEvent.parameters = [
      new ethereum.EventParam('user', ethereum.Value.fromAddress(userAddr)),
      new ethereum.EventParam('sessionKey', ethereum.Value.fromAddress(keyAddr)),
      new ethereum.EventParam('expiresAt', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(9999999))),
    ];
    handleSessionKeyIssued(issueEvent as any);
    const skId = '0x0000000000000000000000000000000000000001-0x0000000000000000000000000000000000000099';
    assert.fieldEquals('PosternSessionKey', skId, 'state', 'active');

    const revokeEvent = newMockEvent();
    revokeEvent.parameters = [
      new ethereum.EventParam('user', ethereum.Value.fromAddress(userAddr)),
      new ethereum.EventParam('sessionKey', ethereum.Value.fromAddress(keyAddr)),
    ];
    handleSessionKeyRevoked(revokeEvent as any);
    assert.fieldEquals('PosternSessionKey', skId, 'state', 'revoked');
  });

  test('session-key lifecycle: issued → expired_cleaned', () => {
    const userAddr = Address.fromString('0x0000000000000000000000000000000000000001');
    const keyAddr = Address.fromString('0x0000000000000000000000000000000000000088');

    const issueEvent = newMockEvent();
    issueEvent.parameters = [
      new ethereum.EventParam('user', ethereum.Value.fromAddress(userAddr)),
      new ethereum.EventParam('sessionKey', ethereum.Value.fromAddress(keyAddr)),
      new ethereum.EventParam('expiresAt', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))),
    ];
    handleSessionKeyIssued(issueEvent as any);

    const expireEvent = newMockEvent();
    expireEvent.parameters = [
      new ethereum.EventParam('user', ethereum.Value.fromAddress(userAddr)),
      new ethereum.EventParam('sessionKey', ethereum.Value.fromAddress(keyAddr)),
    ];
    handleSessionKeyExpiredCleaned(expireEvent as any);
    const skId = '0x0000000000000000000000000000000000000001-0x0000000000000000000000000000000000000088';
    assert.fieldEquals('PosternSessionKey', skId, 'state', 'expired');
  });
});
