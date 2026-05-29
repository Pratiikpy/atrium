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

import { createPublicClient, createWalletClient, http, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { fetchPausedAccounts } from './lib/scribe.js';
import { checkScribeHealth } from './lib/scribe-health.js';
import { heartbeat } from './heartbeat.js';

// Phase theta.3: precomputed topic0 for the Vigil LiquidationTriggered
// event. Used to decode job_id from the queueLiquidation receipt and fire
// executeLiquidation in the same tick.
const LIQUIDATION_TRIGGERED_TOPIC = keccak256(
  toBytes('LiquidationTriggered(uint256,uint256,uint64,uint8)'),
);

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
    ?? 'https://verify.atrium.fi/deployments/arbitrum_sepolia.json';
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
        // RPC failure — include the account (fail-open for liveness)
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

  // Per-account: call Vigil.queueLiquidation + executeLiquidation when the
  // keeper is staked. Phase eta.2 (2026-05-25) added Vigil.set_keeper_min_
  // stake_emergency so a 0.01 ETH stake is reachable on testnet. Until the
  // founder completes redeploy + restake, activeKeeperCount stays at 0 and
  // this path falls through to logs-only.
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

  // Real execution path. Each paused account: queue + wait for receipt +
  // decode job_id from LiquidationTriggered + execute. queueLiquidation is
  // idempotent (returns existing job_id if one is already queued for this
  // account+version), so retrying across ticks is safe. executeLiquidation
  // is wrapped in the Vigil reentrancy + pause guard (audit A C-5 + E).
  //
  // Phase theta.3 fix (2026-05-25): pre-fix the keeper queued the job and
  // returned without firing executeLiquidation. The comment claimed "next
  // tick picks up the queued job via the subgraph" but the subgraph has no
  // PendingLiquidationJob entity and the next-tick logic was never wired.
  // Result: queued positions accumulated forever, no liquidation ever fired,
  // /vigil dashboard reported zero recovered collateral.
  // Now: wait one receipt per account, decode the LiquidationTriggered event
  // for job_id, fire executeLiquidation in the same tick. ~6-10s per account
  // on Sepolia; the cron's 5-min budget covers ~25 liquidations comfortably.
  const account = privateKeyToAccount(keeperKey as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: arbitrumSepolia, transport: http(rpc) });
  const publicReadClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
  const vigilAbi = [
    { type: 'function', name: 'queueLiquidation', stateMutability: 'nonpayable',
      inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'executeLiquidation', stateMutability: 'nonpayable',
      inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }] },
    { type: 'event', name: 'LiquidationTriggered', inputs: [
        { type: 'uint256', name: 'job_id', indexed: true },
        { type: 'uint256', name: 'position_id', indexed: true },
        { type: 'uint64',  name: 'deadline_block' },
        { type: 'uint8',   name: 'priority' },
      ] },
  ] as const;

  // Cap per-tick liquidation throughput so a runaway pause-sweep cannot
  // burn the keeper's gas budget in one shot. Logged + skipped after the cap.
  const PER_TICK_CAP = 25;
  let executed = 0;

  for (const acct of validatedPaused) {
    if (executed >= PER_TICK_CAP) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        event: 'liquidation_skipped_cap_reached',
        capped_at: PER_TICK_CAP,
        remaining_accounts: validatedPaused.length - executed,
      }));
      break;
    }
    try {
      const queueTx = await walletClient.writeContract({
        address: vigilAddr,
        abi: vigilAbi,
        functionName: 'queueLiquidation',
        args: [acct.user as `0x${string}`, BigInt(acct.marginVersion)],
      });
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        event: 'liquidation_queued',
        user: acct.user,
        marginVersion: acct.marginVersion,
        tx: queueTx,
        arbiscan: `https://sepolia.arbiscan.io/tx/${queueTx}`,
      }));

      // Wait for the receipt + decode job_id from the LiquidationTriggered log.
      const receipt = await publicReadClient.waitForTransactionReceipt({
        hash: queueTx,
        timeout: 60_000,
      });
      const triggeredLog = receipt.logs.find(
        (l) =>
          l.address.toLowerCase() === vigilAddr.toLowerCase() &&
          l.topics[0] === LIQUIDATION_TRIGGERED_TOPIC,
      );
      if (!triggeredLog || !triggeredLog.topics[1]) {
        console.log(JSON.stringify({
          ts: new Date().toISOString(),
          event: 'liquidation_jobid_missing',
          user: acct.user,
          marginVersion: acct.marginVersion,
          detail: 'queueLiquidation receipt had no LiquidationTriggered log; skipping execute.',
        }));
        continue;
      }
      const jobId = BigInt(triggeredLog.topics[1]);

      const execTx = await walletClient.writeContract({
        address: vigilAddr,
        abi: vigilAbi,
        functionName: 'executeLiquidation',
        args: [jobId],
      });
      executed++;
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        event: 'liquidation_executed',
        user: acct.user,
        marginVersion: acct.marginVersion,
        jobId: jobId.toString(),
        tx: execTx,
        arbiscan: `https://sepolia.arbiscan.io/tx/${execTx}`,
      }));
    } catch (err) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        event: 'liquidation_failed',
        user: acct.user,
        marginVersion: acct.marginVersion,
        error: err instanceof Error ? err.message : String(err),
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
