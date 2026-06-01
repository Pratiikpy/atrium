import {
  GrantCreated,
  GrantClaimed,
  GrantCancelled,
  FundsReceived,
} from '../generated/Curator/Curator';
import { CuratorGrant, CuratorFunding } from '../generated/schema';

/**
 * Curator grant lifecycle indexer.
 *
 * Pre-fix the Curator contract emitted 4 events on-chain (GrantCreated,
 * GrantClaimed, GrantCancelled, FundsReceived) but Scribe never saw them.
 * The verify-app Cohort/Curator page had no way to surface grant history
 *, every dashboard read fell through to "0 grants" even when the chain
 * actually held an active grant.
 *
 * Grant state is encoded as a string enum: 'pending' → 'claimed' or
 * 'cancelled'. The CuratorGrant entity is mutable so we can update state
 * in place; the CuratorFunding entity is immutable (each funding event
 * is a permanent record).
 */
export function handleGrantCreated(event: GrantCreated): void {
  const id = event.params.grant_id.toString();
  const g = new CuratorGrant(id);
  g.grantee = event.params.grantee;
  g.amountWei = event.params.amount;
  g.ipfsAttestationCid = event.params.ipfs_attestation_cid;
  g.state = 'pending';
  g.createdAtBlock = event.block.number;
  g.createdAtTimestamp = event.block.timestamp;
  g.claimedAtBlock = null;
  g.claimedAtTimestamp = null;
  g.cancelledAtBlock = null;
  g.cancelledAtTimestamp = null;
  g.cancelReason = null;
  g.save();
}

export function handleGrantClaimed(event: GrantClaimed): void {
  const id = event.params.grant_id.toString();
  const g = CuratorGrant.load(id);
  if (g == null) {
    // Defensive: a Claim without a prior Create indicates a chain reorg
    // or a startBlock misconfig. Skip rather than create an orphan record
    //, Scribe's reorg-protection will replay the Create when re-indexed.
    return;
  }
  g.state = 'claimed';
  g.claimedAtBlock = event.block.number;
  g.claimedAtTimestamp = event.block.timestamp;
  g.save();
}

export function handleGrantCancelled(event: GrantCancelled): void {
  const id = event.params.grant_id.toString();
  const g = CuratorGrant.load(id);
  if (g == null) {
    return;
  }
  g.state = 'cancelled';
  g.cancelledAtBlock = event.block.number;
  g.cancelledAtTimestamp = event.block.timestamp;
  g.cancelReason = event.params.reason;
  g.save();
}

export function handleFundsReceived(event: FundsReceived): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const f = new CuratorFunding(id);
  f.from = event.params.from;
  f.amountWei = event.params.amount;
  f.newTotalFundedWei = event.params.new_total_funded;
  f.blockNumber = event.block.number;
  f.timestamp = event.block.timestamp;
  f.save();
}
