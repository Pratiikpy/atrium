import { test, assert, clearStore, newMockEvent, describe, beforeEach } from 'matchstick-as';
import { BigInt, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { handleBacktestPublished } from '../src/research';
import { BacktestPublished } from '../generated/ResearchAttestation/ResearchAttestation';

describe('Research handlers', () => {
  beforeEach(() => { clearStore(); });

  test('handleBacktestPublished creates BacktestAttestation', () => {
    const event = newMockEvent();
    event.parameters = [
      new ethereum.EventParam('ipfs_hash', ethereum.Value.fromBytes(Bytes.fromHexString('0xdeadbeefcafe'))),
      new ethereum.EventParam('trades_count', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(150))),
      new ethereum.EventParam('collateral_delta_bps', ethereum.Value.fromSignedBigInt(BigInt.fromI32(320))),
      new ethereum.EventParam('timestamp_seconds', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1700000000))),
      new ethereum.EventParam('notebook_url', ethereum.Value.fromString('https://colab.research.google.com/test')),
    ];
    handleBacktestPublished(changetype<BacktestPublished>(event));
    assert.entityCount('BacktestAttestation', 1);
  });
});
