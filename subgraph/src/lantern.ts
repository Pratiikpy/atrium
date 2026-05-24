import { AttestationPublished } from '../generated/LanternAttestor/LanternAttestor';
import { LanternAttestation } from '../generated/schema';

export function handleAttestationPublished(event: AttestationPublished): void {
  const id = event.params.root.toHexString();
  const a = new LanternAttestation(id);
  a.root = event.params.root;
  a.blockNumber = event.params.block_number;
  a.timestamp = event.params.timestamp;
  a.leafCount = 0; // populated by Lantern off-chain via direct attestor write
  a.save();
}
