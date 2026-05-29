import { AttestationPublished } from '../generated/LanternAttestor/LanternAttestor';
import { LanternAttestation } from '../generated/schema';

// Phase 4 (closes #58, SD-11): ID changed from root.toHexString() to
// txHash+logIndex. A republish of the same root now creates a new entity
// row, preserving history. Consumers query by root via `where: { root: $root }`.
export function handleAttestationPublished(event: AttestationPublished): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const a = new LanternAttestation(id);
  a.root = event.params.root;
  a.blockNumber = event.params.block_number;
  a.timestamp = event.params.timestamp;
  a.leafCount = event.params.leafCount.toI32();
  a.ipfsCid = event.params.ipfsCid;
  a.save();
}
