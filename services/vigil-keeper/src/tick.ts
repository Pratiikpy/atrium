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

import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { fetchPausedAccounts } from './lib/scribe.js';

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

  const scribeUrl = process.env.SCRIBE_URL;
  if (!scribeUrl) {
    console.log(JSON.stringify({ ts, event: 'skip', reason: 'SCRIBE_URL not set' }));
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

  // Per-account: would call Vigil.executeLiquidation if staked. The keeper
  // EOA needs is_active = true on Vigil; today the 1000 ETH min_stake
  // makes that unreachable on testnet (see file docstring + human_left.md).
  for (const acct of paused) {
    const action = process.env.KEEPER_PRIVATE_KEY
      ? 'would_execute (staking pending)'
      : 'would_execute (no keeper key set)';
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      event: 'liquidatable',
      user: acct.user,
      marginVersion: acct.marginVersion,
      action,
      blocker: 'vigil_min_stake_unreachable',
    }));
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
