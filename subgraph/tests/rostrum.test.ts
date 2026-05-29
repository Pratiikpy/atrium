import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleFollowStarted, handleFollowEnded, handleMirrorTradeFilled, handleMirrorTradeFailed, handleLeaderDeboosted, handleActionRecorded, handleReputationUpdated } from '../src/rostrum';
import { RostrumFollow } from '../generated/schema';

describe('Rostrum handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleFollowStarted creates RostrumFollow with state active', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('follower', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('leader', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('allocation_bps', ethereum.Value.fromI32(5000)),
      new ethereum.EventParam('expires_at', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(9999999))),
    ];
    handleFollowStarted(event as any);
    assert.entityCount('RostrumFollow', 1);
    const id = '0x0000000000000000000000000000000000000001-0x0000000000000000000000000000000000000002';
    assert.fieldEquals('RostrumFollow', id, 'state', 'active');
  });

  test('handleFollowEnded flips state to ended', () => {
    const id = '0x0000000000000000000000000000000000000001-0x0000000000000000000000000000000000000002';
    const f = new RostrumFollow(id);
    f.follower = Address.fromString('0x0000000000000000000000000000000000000001');
    f.leader = Address.fromString('0x0000000000000000000000000000000000000002');
    f.allocationBps = 5000;
    f.expiresAt = BigInt.fromI32(9999999);
    f.state = 'active';
    f.startedAtBlock = BigInt.fromI32(100);
    f.startedAtTimestamp = BigInt.fromI32(1000);
    f.save();

    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('follower', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('leader', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('reason', ethereum.Value.fromString('user_cancelled')),
    ];
    handleFollowEnded(event as any);
    assert.fieldEquals('RostrumFollow', id, 'state', 'ended');
  });

  test('handleMirrorTradeFilled creates per-trade record', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('follower', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('leader', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('leader_position_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(42))),
      new ethereum.EventParam('follower_notional_signed', ethereum.Value.fromSignedBigInt(BigInt.fromI32(1000))),
    ];
    handleMirrorTradeFilled(event as any);
    assert.entityCount('RostrumMirrorTrade', 1);
  });

  test('handleMirrorTradeFailed records reason', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('follower', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('leader', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('leader_position_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(42))),
      new ethereum.EventParam('reason', ethereum.Value.fromString('insufficient_margin')),
    ];
    handleMirrorTradeFailed(event as any);
    assert.entityCount('RostrumMirrorTrade', 1);
  });

  test('handleLeaderDeboosted creates deboost record', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('leader', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('reason', ethereum.Value.fromString('poor_performance')),
    ];
    handleLeaderDeboosted(event as any);
    assert.entityCount('RostrumLeaderDeboost', 1);
  });

  test('handleActionRecorded creates agent action', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('agent', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('action_kind', ethereum.Value.fromString('open_position')),
    ];
    handleActionRecorded(event as any);
    assert.entityCount('RostrumAgentAction', 1);
  });

  test('handleReputationUpdated tracks previous score', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('agent', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000002'))),
      new ethereum.EventParam('previous', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500))),
      new ethereum.EventParam('next', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(750))),
    ];
    handleReputationUpdated(event as any);
    assert.entityCount('RostrumReputation', 1);
    assert.fieldEquals('RostrumReputation', '0x0000000000000000000000000000000000000002', 'previousScore', '500');
    assert.fieldEquals('RostrumReputation', '0x0000000000000000000000000000000000000002', 'currentScore', '750');
  });
});
