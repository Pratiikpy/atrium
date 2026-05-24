import { TierAssigned } from '../generated/Edict/Edict';
import { TierAssignment } from '../generated/schema';

export function handleTierAssigned(event: TierAssigned): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const t = new TierAssignment(id);
  t.user = event.params.user;
  t.tier = event.params.tier;
  t.assignedBy = event.params.assigned_by;
  t.blockNumber = event.block.number;
  t.timestamp = event.block.timestamp;
  t.save();
}
