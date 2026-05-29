/**
 * setup-coffer-adapters — Task #337: schedule Coffer.setAdapter(router, true, cap)
 * via PraetorTimelock for the AtriumRouter.
 *
 * Coffer.set_adapter is timelock-gated (assert_timelock). The Stylus ABI exports
 * it as setAdapter(address,bool,uint256). We schedule one timelock tx that approves
 * the AtriumRouter as an orchestrator on Coffer.
 *
 * Usage:
 *   npx tsx services/praetor-cli/src/commands/setup-coffer-adapters.ts --mode dry-run
 *   npx tsx services/praetor-cli/src/commands/setup-coffer-adapters.ts --mode schedule
 *   npx tsx services/praetor-cli/src/commands/setup-coffer-adapters.ts --mode execute
 */
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';

const { values } = parseArgs({
  options: {
    mode: { type: 'string', default: 'dry-run' },
    'per-block-cap': { type: 'string', default: '10000000000' }, // 10_000 USDC (6 decimals)
    'rpc-url': { type: 'string' },
  },
  strict: true,
});

const OPS_FILE = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../data/timelock-337-ops.json');
const DEPLOYMENTS_FILE = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../../../deployments/arbitrum_sepolia.json');

interface OpsEntry {
  label: string;
  target: string;
  calldata: string;
  opId: string | null;
  txHash: string | null;
  scheduledTimestamp: number | null;
}

function loadDeployments() {
  const raw = readFileSync(DEPLOYMENTS_FILE, 'utf-8');
  return JSON.parse(raw) as { contracts: Record<string, { address: string }> };
}

function encodeSetAdapter(adapterAddr: `0x${string}`, approved: boolean, perBlockCap: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: [{
      type: 'function',
      name: 'setAdapter',
      inputs: [
        { name: 'adapter', type: 'address' },
        { name: 'approved', type: 'bool' },
        { name: 'per_block_cap_wei', type: 'uint256' },
      ],
      outputs: [],
    }],
    functionName: 'setAdapter',
    args: [adapterAddr, approved, perBlockCap],
  });
}

async function main() {
  const mode = values.mode as 'schedule' | 'execute' | 'dry-run';
  const perBlockCap = BigInt(values['per-block-cap'] ?? '10000000000');
  const deployments = loadDeployments();
  const cofferAddr = deployments.contracts['coffer']?.address as `0x${string}`;
  const routerAddr = deployments.contracts['atrium-router']?.address as `0x${string}`;
  const timelockAddr = deployments.contracts['praetor-timelock']?.address as `0x${string}`;

  if (!cofferAddr) { console.error('ERROR: coffer not in deployments.'); process.exit(1); }
  if (!routerAddr) { console.error('ERROR: atrium-router not in deployments.'); process.exit(1); }
  if (!timelockAddr) { console.error('ERROR: praetor-timelock not in deployments.'); process.exit(1); }

  console.log(`[setup-coffer-adapters] mode=${mode}`);
  console.log(`[setup-coffer-adapters] coffer=${cofferAddr}`);
  console.log(`[setup-coffer-adapters] router (to approve)=${routerAddr}`);
  console.log(`[setup-coffer-adapters] per_block_cap=${perBlockCap} (${Number(perBlockCap) / 1e6} USDC)`);

  // Coffer.setAdapter(router, true, cap) — approve the Router as orchestrator
  const calldata = encodeSetAdapter(routerAddr, true, perBlockCap);
  console.log(`[setup-coffer-adapters] inner calldata: ${calldata}`);

  if (mode === 'dry-run') {
    console.log('\n--- DRY RUN ---');
    console.log(`Would schedule PraetorTimelock.schedule(${cofferAddr}, <setAdapter calldata>)`);
    console.log('This approves AtriumRouter on Coffer with the specified per-block cap.');
    console.log('No transactions signed. Use --mode schedule to execute.');
    return;
  }

  if (mode === 'schedule') {
    console.log(`\n  Scheduling Coffer.setAdapter(router, true, ${perBlockCap})...`);
    const entry: OpsEntry = {
      label: 'coffer-setAdapter-router',
      target: cofferAddr,
      calldata,
      opId: null,
      txHash: null,
      scheduledTimestamp: null,
    };

    const cmd = [
      'npx', 'tsx', resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'timelock-schedule.ts'),
      '--target', cofferAddr,
      '--calldata-hex', calldata,
      '--timelock-address', timelockAddr,
    ].join(' ');

    try {
      const output = execSync(cmd, { encoding: 'utf-8', env: process.env });
      console.log(output);
      const opMatch = output.match(/op-id:\s*(0x[0-9a-f]{64})/i);
      if (opMatch) entry.opId = opMatch[1];
      entry.scheduledTimestamp = Math.floor(Date.now() / 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: ${msg.slice(0, 200)}`);
    }

    mkdirSync(dirname(OPS_FILE), { recursive: true });
    writeFileSync(OPS_FILE, JSON.stringify([entry], null, 2));
    console.log(`\n[setup-coffer-adapters] Wrote ${OPS_FILE}`);
    return;
  }

  if (mode === 'execute') {
    if (!existsSync(OPS_FILE)) {
      console.error(`ERROR: ${OPS_FILE} not found. Run --mode schedule first.`);
      process.exit(1);
    }
    const ops: OpsEntry[] = JSON.parse(readFileSync(OPS_FILE, 'utf-8'));
    for (const entry of ops) {
      if (!entry.opId) {
        console.log(`  SKIP ${entry.label}: no op-id recorded.`);
        continue;
      }
      console.log(`\n  Executing timelock for ${entry.label} (op-id=${entry.opId})...`);
      const cmd = [
        'npx', 'tsx', resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'timelock-execute.ts'),
        '--op-id', entry.opId,
        '--target', entry.target,
        '--calldata-hex', entry.calldata,
        '--scheduled-timestamp', String(entry.scheduledTimestamp ?? 0),
        '--timelock-address', timelockAddr,
      ].join(' ');
      try {
        const output = execSync(cmd, { encoding: 'utf-8', env: process.env });
        console.log(output);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  FAILED: ${msg.slice(0, 200)}`);
      }
    }
    return;
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
