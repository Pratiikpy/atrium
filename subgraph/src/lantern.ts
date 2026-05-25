import { AttestationPublished } from '../generated/LanternAttestor/LanternAttestor';
import { LanternAttestation } from '../generated/schema';

// Phase zeta.1 (2026-05-25): handler picks up leafCount + ipfsCid from the
// extended event payload. Prior shape only carried (root, block_number,
// timestamp), so leafCount was hardcoded to 0 and ipfsCid was unset, which
// bricked /api/lantern/verify-inclusion (Verifier Step 6).
export function handleAttestationPublished(event: AttestationPublished): void {
  const id = event.params.root.toHexString();
  const a = new LanternAttestation(id);
  a.root = event.params.root;
  a.blockNumber = event.params.block_number;
  a.timestamp = event.params.timestamp;
  a.leafCount = event.params.leafCount;
  a.ipfsCid = event.params.ipfsCid;
  a.save();
}
