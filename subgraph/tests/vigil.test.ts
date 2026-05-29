import { test, assert, clearStore, newMockEvent, describe, beforeEach, createMockedFunction } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleLiquidationExecuted } from '../src/vigil';

describe('Vigil handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleLiquidationExecuted creates LiquidationEvent and increments Counter', () => {
    const vigilAddr = Address.fromString('0x08f3d3a878a75aa454be6bd07f0b74d3e6e46dc8');
    const userAddr = Address.fromString('0x0000000000000000000000000000000000000042');

    // Mock Vigil.jobs(job_id) view call
    // Returns tuple: (position_id: uint256, user: address, max_liquidation_bps: uint8, ...)
    createMockedFunction(vigilAddr, 'jobs', 'jobs(uint256):(uint256,address,uint8)')
      .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))])
      .returns([
        ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(99)),
        ethereum.Value.fromAddress(userAddr),
        ethereum.Value.fromI32(50),
      ]);

    const event = newMockEvent();
    event.address = vigilAddr;
    event.parameters = [
      new ethereum.EventParam('job_id', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
      new ethereum.EventParam('keeper', ethereum.Value.fromAddress(Address.fromString('0x0000000000000000000000000000000000000099'))),
      new ethereum.EventParam('recovered_collateral_wei', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(5000))),
      new ethereum.EventParam('actual_liquidation_bps', ethereum.Value.fromI32(25)),
    ];
    handleLiquidationExecuted(event as any);

    assert.entityCount('LiquidationEvent', 1);
    assert.entityCount('Keeper', 1);
    assert.entityCount('Counter', 1);
    assert.fieldEquals('Counter', 'global', 'totalLiquidationsCount', '1');
  });
});
