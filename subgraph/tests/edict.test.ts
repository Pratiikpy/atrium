import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleTierAssigned } from '../src/edict';
import { TierAssigned } from '../generated/Edict/Edict';

describe('Edict handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleTierAssigned creates TierAssignment', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('user', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000001'))),
      new ethereum.EventParam('tier', ethereum.Value.fromI32(2)),
      new ethereum.EventParam('assigned_by', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000099'))),
    ];
    handleTierAssigned(changetype<TierAssigned>(event));
    assert.entityCount('TierAssignment', 1);
  });
});
