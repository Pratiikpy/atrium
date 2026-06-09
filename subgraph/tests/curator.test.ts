import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleGrantCreated, handleGrantClaimed, handleGrantCancelled, handleFundsReceived } from '../src/curator';
import { CuratorGrant } from '../generated/schema';
import { GrantCreated, GrantClaimed, GrantCancelled, FundsReceived } from '../generated/Curator/Curator';

describe('Curator handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleGrantCreated → handleGrantClaimed lifecycle', () => {
    const createEvent = newMockEvent();
    createEvent.parameters = [
      new ethereum.EventParam('grant_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
      new ethereum.EventParam('grantee', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50000))),
      new ethereum.EventParam('ipfs_attestation_cid', ethereum.Value.fromString('QmTest123')),
    ];
    handleGrantCreated(changetype<GrantCreated>(createEvent));
    assert.fieldEquals('CuratorGrant', '1', 'state', 'pending');

    const claimEvent = newMockEvent();
    claimEvent.parameters = [
      new ethereum.EventParam('grant_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
    ];
    handleGrantClaimed(changetype<GrantClaimed>(claimEvent));
    assert.fieldEquals('CuratorGrant', '1', 'state', 'claimed');
  });

  test('handleGrantCreated → handleGrantCancelled lifecycle', () => {
    const createEvent = newMockEvent();
    createEvent.parameters = [
      new ethereum.EventParam('grant_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2))),
      new ethereum.EventParam('grantee', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(30000))),
      new ethereum.EventParam('ipfs_attestation_cid', ethereum.Value.fromString('QmTest456')),
    ];
    handleGrantCreated(changetype<GrantCreated>(createEvent));

    const cancelEvent = newMockEvent();
    cancelEvent.parameters = [
      new ethereum.EventParam('grant_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2))),
      new ethereum.EventParam('reason', ethereum.Value.fromString('budget_exhausted')),
    ];
    handleGrantCancelled(changetype<GrantCancelled>(cancelEvent));
    assert.fieldEquals('CuratorGrant', '2', 'state', 'cancelled');
  });

  test('handleFundsReceived creates CuratorFunding', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('from', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000099'))),
      new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100000))),
      new ethereum.EventParam('new_total_funded', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500000))),
    ];
    handleFundsReceived(changetype<FundsReceived>(event));
    assert.entityCount('CuratorFunding', 1);
  });
});
