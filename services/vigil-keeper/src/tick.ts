/**
 * Single-iteration vigil-keeper tick.
 *
 * Polls Scribe for paused MarginAccounts (Plinth.is_paused = true means
 * the account hit a liquidation trigger via update_margin or a chaos drift)
 * and reports what a real keeper would do. Currently logs only - real
 * execute_liquidation calls require the keeper EOA to be Vigil-staked,
 * and the on-chain min_stake is hardcoded to 1000 ETH per
 * contracts/vigil/src/lib.rs:206 (testnet faucet caps at ~0.1 ETH).
 *
 * Year-1 testnet scope:
 *   - Service ships, GHA cron fires every 5 min.
 *   - Each tick prints the observed paused-account set + intended action.
 *   - When the keeper EOA acquires the required stake (Year-2 protocol
 *     change: Vigil needs `set_keeper_min_stake(...)` admin fn that the
 *     current contract does not have), this file flips two log lines into
 *     real viem writeContract calls and Journey 4 of TDD §9 goes live.
 *
 * KEEPER_PRIVATE_KEY env: a fresh EOA isolated from the deployer per the
 * 2026-05-24 leak incident. For the dry-run phase only the public address
 * is needed - the key isn't used to sign anything until Vigil min_stake
 * lands and the EOA is staked. Until then, KEEPER_PRIVATE_KEY can be unset
 * and the tick falls through to a public-RPC read-only mode.
 */

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { fetchPausedAccounts } from './lib/scribe.js';
import { checkScribeHealth } from './lib/scribe-health.js';
import { heartbeat } from './heartbeat.js';
import { jobsToExecute, type QueuedJob } from './liquidation.js';

interface DeploymentRegistry {
  contracts: {
    vigil?: { address: string };
    plinth?: { address: string };
  };
}

async function loadRegistry(url: string): Promise<DeploymentRegistry> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`registry fetch ${r.status}`);
  return (await r.json()) as DeploymentRegistry;
}

export async function tickOnce(): Promise<void> {
  const tickStart = Date.now();
  const ts = new Date(tickStart).toISOString();

  // Audit fix (#56): signal liveness so the dead-keeper alarm can fire. The
  // heartbeat no-ops when HONEYBADGER_HEARTBEAT_URL is unset.
  await heartbeat('vigil-keeper');

  const scribeUrl = process.env.SCRIBE_URL;
  if (!scribeUrl) {
    console.log(JSON.stringify({ ts, event: 'skip', reason: 'SCRIBE_URL not set' }));
    return;
  }

  // Phase 4 (SD-4): Check Scribe health before fetching paused accounts.
  try {
    const health = await checkScribeHealth(scribeUrl);
    if (health.isStale) {
      console.log(JSON.stringify({ ts, event: 'skip', reason: 'scribe_stale', lagBlocks: health.lagBlocks }));
      return;
    }
  } catch (err) {
    console.log(JSON.stringify({ ts, event: 'skip', reason: 'scribe_health_failed', detail: err instanceof Error ? err.message : String(err) }));
    return;
  }

  const registryUrl = process.env.DEPLOYMENT_REGISTRY_URL
    ?? 'https://verify.useatrium.me/deployments/arbitrum_sepolia.json';
  const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';

  let registry: DeploymentRegistry;
  try {
    registry = await loadRegistry(registryUrl);
  } catch (err) {
    console.log(JSON.stringify({
      ts, event: 'skip', reason: 'registry_unreachable',
      detail: err instanceof Error ? err.message : String(err),
    }));
    return;
  }
  const vigilAddr = registry.contracts.vigil?.address as `0x${string}` | undefined;
  if (!vigilAddr) {
    console.log(JSON.stringify({ ts, event: 'skip', reason: 'vigil not in registry' }));
    return;
  }

  // Read keeper-side state.
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpc),
  });
  const activeKeeperCount = await publicClient.readContract({
    address: vigilAddr,
    abi: [{ type: 'function', name: 'activeKeeperCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint32' }] }] as const,
    functionName: 'activeKeeperCount',
  }) as number;

  // Subgraph: paused accounts.
  let paused;
  try {
    paused = await fetchPausedAccounts(scribeUrl);
  } catch (err) {
    console.log(JSON.stringify({
      ts, event: 'skip', reason: 'scribe_unreachable',
      detail: err instanceof Error ? err.message : String(err),
    }));
    return;
  }

  console.log(JSON.stringify({
    ts,
    event: 'tick',
    vigilAddr,
    activeKeeperCount,
    pausedAccountCount: paused.length,
    pausedAccounts: paused.map((a) => ({ user: a.user, marginVersion: a.marginVersion })),
  }));

  if (paused.length === 0) {
    return;
  }

  // Phase 4 (SD-16): RPC cross-validation. For each paused account, confirm
  // isPaused == true on-chain before queuing. Prevents executing against
  // accounts that have already been resumed but Scribe hasn't caught up.
  const plinthAddr = registry.contracts.plinth?.address as `0x${string}` | undefined;
  const validatedPaused: typeof paused = [];
  if (plinthAddr) {
    const plinthAbi = [
      { type: 'function', name: 'getAccount', stateMutability: 'view',
        inputs: [{ type: 'address' }],
        outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }] },
    ] as const;
    for (const acct of paused) {
      try {
        const result = await publicClient.readContract({
          address: plinthAddr,
          abi: plinthAbi,
          functionName: 'getAccount',
          args: [acct.user as `0x${string}`],
        }) as [bigint, bigint, bigint, boolean];
        const [, , onChainVersion, isPaused] = result;
        if (!isPaused) {
          console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'rpc_mismatch_not_paused', user: acct.user }));
          continue;
        }
        if (onChainVersion.toString() !== acct.marginVersion) {
          console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'rpc_mismatch_version', user: acct.user, scribe: acct.marginVersion, onChain: onChainVersion.toString() }));
          continue;
        }
        validatedPaused.push(acct);
      } catch {
        // RPC failure, include the account (fail-open for liveness)
        validatedPaused.push(acct);
      }
    }
  } else {
    validatedPaused.push(...paused);
  }

  if (validatedPaused.length === 0) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'all_accounts_cleared_by_rpc' }));
    return;
  }

  // When the keeper is staked, EXECUTE already-queued jobs (Plinth queued
  // them in update_margin). Phase eta.2 (2026-05-25) added
  // Vigil.set_keeper_min_stake_emergency so a 0.01 ETH stake is reachable on
  // testnet. Until the founder completes redeploy + restake, activeKeeperCount
  // stays at 0 and this path falls through to logs-only.
  const keeperKey = process.env.KEEPER_PRIVATE_KEY;
  const keeperReady = !!keeperKey && /^0x[0-9a-fA-F]{64}$/.test(keeperKey) && activeKeeperCount > 0;

  if (!keeperReady) {
    for (const acct of validatedPaused) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        event: 'liquidatable',
        user: acct.user,
        marginVersion: acct.marginVersion,
        action: 'would_execute',
        blocker: keeperKey ? 'no_active_keeper_on_chain' : 'no_keeper_key_set',
      }));
    }
    return;
  }

  // Real execution path. Plinth (not the keeper) queues liquidations inside
  // update_margin, so the keeper's job is purely to EXECUTE already-queued
  // jobs once their deadline block passes.
  //
  // 083-BE10 fix (2026-05-30): pre-fix the keeper called queueLiquidation from
  // the keeper EOA. Vigil gates queue_liquidation to plinth_address
  // (contracts/vigil/src/lib.rs:253), so every queue write reverted
  // Unauthorized and executeLiquidation was never reached, the only on-chain
  // liquidation path the keeper shipped was non-functional. Now the keeper
  // discovers queued jobs from the on-chain LiquidationTriggered logs (the
  // subgraph has no queryable pending-job entity), reads jobs(job_id) for live
  // completion + deadline, and executes the ones whose deadline has passed for
  // a confirmed-underwater account.
  const account = privateKeyToAccount(keeperKey as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: arbitrumSepolia, transport: http(rpc) });
  const vigilAbi = [
    { type: 'function', name: 'jobs', stateMutability: 'view',
      inputs: [{ type: 'uint256' }],
      outputs: [
        { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }, { type: 'uint256' },
        { type: 'uint64' }, { type: 'uint8' }, { type: 'bool' }, { type: 'address' },
      ] },
    { type: 'function', name: 'executeLiquidation', stateMutability: 'nonpayable',
      inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }] },
    { type: 'event', name: 'LiquidationTriggered', inputs: [
        { type: 'uint256', name: 'job_id', indexed: true },
        { type: 'uint256', name: 'position_id', indexed: true },
        { type: 'uint64',  name: 'deadline_block' },
        { type: 'uint8',   name: 'priority' },
      ] },
  ] as const;

  const currentBlock = await publicClient.getBlockNumber();
  // Bounded getLogs window so the range stays within public-RPC limits. A
  // queued job's deadline is only a handful of blocks out, so a lookback that
  // comfortably covers the cron interval + deadline window is enough.
  const lookback = BigInt(process.env.KEEPER_LOG_LOOKBACK_BLOCKS ?? '10000');
  const fromBlock = currentBlock > lookback ? currentBlock - lookback : 0n;
  const triggeredEvent = vigilAbi[2];
  let triggeredLogs;
  try {
    triggeredLogs = await publicClient.getLogs({
      address: vigilAddr,
      event: triggeredEvent,
      fromBlock,
      toBlock: currentBlock,
    });
  } catch (err) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(), event: 'skip', reason: 'getlogs_failed',
      detail: err instanceof Error ? err.message : String(err),
    }));
    return;
  }

  // Read live job state for each discovered job_id, then select executables.
  const pausedUsers = new Set(validatedPaused.map((a) => a.user.toLowerCase()));
  const jobs: QueuedJob[] = [];
  const seenJobIds = new Set<string>();
  for (const log of triggeredLogs) {
    const jobId = (log as unknown as { args: { job_id?: bigint } }).args?.job_id;
    if (jobId === undefined || seenJobIds.has(jobId.toString())) continue;
    seenJobIds.add(jobId.toString());
    try {
      const job = (await publicClient.readContract({
        address: vigilAddr, abi: vigilAbi, functionName: 'jobs', args: [jobId],
      })) as readonly [bigint, string, bigint, bigint, bigint, number, boolean, string];
      jobs.push({ jobId, user: job[1], deadlineBlock: job[4], isComplete: job[6] });
    } catch {
      // Skip jobs we can't read this tick; next tick retries.
    }
  }

  const executable = jobsToExecute(jobs, currentBlock, pausedUsers);
  if (executable.length === 0) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(), event: 'no_executable_jobs',
      discoveredJobs: jobs.length, pausedAccounts: validatedPaused.length,
    }));
    return;
  }

  // Cap per-tick liquidation throughput so a runaway sweep cannot burn the
  // keeper's gas budget in one shot.
  const PER_TICK_CAP = 25;
  let executed = 0;
  for (const jobId of executable) {
    if (executed >= PER_TICK_CAP) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(), event: 'liquidation_skipped_cap_reached',
        capped_at: PER_TICK_CAP, remaining: executable.length - executed,
      }));
      break;
    }
    try {
      const execTx = await walletClient.writeContract({
        address: vigilAddr, abi: vigilAbi, functionName: 'executeLiquidation', args: [jobId],
      });
      executed++;
      console.log(JSON.stringify({
        ts: new Date().toISOString(), event: 'liquidation_executed',
        jobId: jobId.toString(), tx: execTx,
        arbiscan: `https://sepolia.arbiscan.io/tx/${execTx}`,
      }));
    } catch (err) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(), event: 'liquidation_failed',
        jobId: jobId.toString(), error: err instanceof Error ? err.message : String(err),
      }));
    }
  }
}

// Stand-alone invocation path: `pnpm --filter @atrium/vigil-keeper tick`
// or `pnpm --filter @atrium/vigil-keeper tsx src/tick.ts`. Used by the GHA
// cron workflow.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('tick.ts')) {
  void tickOnce().then(
    () => process.exit(0),
    (err) => {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        event: 'fatal',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      }));
      process.exit(1);
    },
  );
}
