import { BacktestPublished } from '../generated/ResearchAttestation/ResearchAttestation';
import { BacktestAttestation } from '../generated/schema';

export function handleBacktestPublished(event: BacktestPublished): void {
  const id = event.params.ipfs_hash.toHexString();
  const ba = new BacktestAttestation(id);
  ba.ipfsHash = event.params.ipfs_hash;
  ba.tradesCount = event.params.trades_count;
  // Convert int256 to i32 via toI32() — values fit comfortably in 32 bits for bps
  ba.collateralDeltaBps = event.params.collateral_delta_bps.toI32();
  ba.timestampSeconds = event.params.timestamp_seconds;
  ba.notebookUrl = event.params.notebook_url;
  ba.blockNumber = event.block.number;
  ba.save();
}
