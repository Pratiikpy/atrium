/**
 * Liquidation job selection (083-BE10).
 *
 * Plinth (not the keeper) queues liquidations inside `update_margin`
 * (contracts/plinth/src/lib.rs calls Vigil.queue_liquidation, which Vigil
 * gates to plinth_address). The keeper's only on-chain job is to EXECUTE
 * already-queued jobs once their deadline block has passed, it must never
 * call queueLiquidation itself (that path reverts Unauthorized for any
 * non-Plinth caller).
 *
 * This module is pure so the selection logic is unit-testable without a chain.
 */

export interface QueuedJob {
  jobId: bigint;
  /** Vigil.jobs(jobId).user, the underwater account. */
  user: string;
  /** Vigil.jobs(jobId).deadline_block, execution allowed at/after this block. */
  deadlineBlock: bigint;
  /** Vigil.jobs(jobId).is_complete, already executed. */
  isComplete: boolean;
}

/**
 * Pick the job ids the keeper should execute this tick: not already complete,
 * deadline block reached, and for an account confirmed underwater (in
 * `pausedUsers`). De-duplicates job ids.
 */
export function jobsToExecute(
  jobs: QueuedJob[],
  currentBlock: bigint,
  pausedUsers: Set<string>,
): bigint[] {
  const seen = new Set<string>();
  const out: bigint[] = [];
  for (const j of jobs) {
    if (j.isComplete) continue;
    if (currentBlock < j.deadlineBlock) continue;
    if (!pausedUsers.has(j.user.toLowerCase())) continue;
    const key = j.jobId.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(j.jobId);
  }
  return out;
}
