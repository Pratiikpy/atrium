# Incident — keeper failure

Trigger: `vigil.keeper.miss.count` > 0, or fewer than 2 of 3 keepers reporting healthy.

## Response

1. **Check which keeper is down.** `praetor keepers list` shows last action block per keeper.
2. **Investigate root cause:**
   - VPS health: SSH in, check process logs, disk space, memory.
   - RPC: is the RPC URL responsive?
   - Wallet: does the keeper wallet have enough native ETH for gas?
   - Stake: is the keeper still meeting `keeper_min_stake_wei`?
3. **Bring the keeper back:**
   - Restart the keeper binary.
   - Watch for the next `KeeperStaked` or successful `LiquidationExecuted` event.
4. **If the keeper is unrecoverable:**
   - `praetor keepers slash --keeper <addr> --reason "unrecoverable_failure"`
   - Bring up a replacement keeper on a new VPS.
   - Update Cohort partners that one keeper rotated.
5. **If fewer than 2 keepers are healthy at any time:**
   - Praetor multisig invokes `Plinth.pause("keeper redundancy lost")` until at least 2 are back.
   - Withdrawals still work; new positions are paused.
6. **Communicate** via Lantern dashboard banner and Mirror post.
7. **Post-mortem** within 7 days.
