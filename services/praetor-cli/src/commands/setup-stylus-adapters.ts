/**
 * setup-stylus-adapters, Task #335: schedule setAuthorizedCaller(AtriumRouter, true)
 * on every v1.1 adapter via PraetorTimelock.
 *
 * Usage:
 *   npx tsx services/praetor-cli/src/commands/setup-stylus-adapters.ts --mode dry-run
 *   npx tsx services/praetor-cli/src/commands/setup-stylus-adapters.ts --mode schedule
 *   npx tsx services/praetor-cli/src/commands/setup-stylus-adapters.ts --mode execute
 *
 * --mode schedule: encodes calldata, calls timelock-schedule per adapter, writes ops JSON.
 * --mode execute:  reads ops JSON from prior schedule run, calls timelock-execute per op.
 * --mode dry-run:  prints what would happen without signing.
 */
import { createPublicClient, http, encodeFunctionData, keccak256 } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';

const { values } = parseArgs({
  options: {
    mode: { type: 'string', default: 'dry-run' },
    'rpc-url': { type: 'string' },
  },
  strict: true,
});

const OPS_FILE = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../data/timelock-335-ops.json');
const DEPLOYMENTS_FILE = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../../../deployments/arbitrum_sepolia.json');

// Adapter slugs that need setAuthorizedCaller
const ADAPTER_SLUGS = [
  'adapter-aave-horizon',
  'adapter-curve',
  'adapter-gmx',
  'adapter-hyperliquid',
  'adapter-morpho',
  'adapter-pendle',
  'adapter-polymarket',
  'adapter-synthetix',
  'adapter-trade-xyz',
] as const;

interface OpsEntry {
  slug: string;
  adapter: string;
  calldata: string;
  opId: string | null;
  txHash: string | null;
  scheduledTimestamp: number | null;
}

function loadDeployments() {
  const raw = readFileSync(DEPLOYMENTS_FILE, 'utf-8');
  return JSON.parse(raw) as { contracts: Record<string, { address: string }> };
}

function encodeSetAuthorizedCaller(routerAddr: `0x${string}`): `0x${string}` {
  return encodeFunctionData({
    abi: [{
      type: 'function',
      name: 'setAuthorizedCaller',
      inputs: [{ name: 'caller', type: 'address' }, { name: 'authorized', type: 'bool' }],
      outputs: [],
    }],
    functionName: 'setAuthorizedCaller',
    args: [routerAddr, true],
  });
}

async function main() {
  const mode = values.mode as 'schedule' | 'execute' | 'dry-run';
  const deployments = loadDeployments();
  const routerAddr = deployments.contracts['atrium-router']?.address as `0x${string}`;
  const timelockAddr = deployments.contracts['praetor-timelock']?.address as `0x${string}`;

  if (!routerAddr) { console.error('ERROR: atrium-router not in deployments.'); process.exit(1); }
  if (!timelockAddr) { console.error('ERROR: praetor-timelock not in deployments.'); process.exit(1); }

  console.log(`[setup-stylus-adapters] mode=${mode}`);
  console.log(`[setup-stylus-adapters] router=${routerAddr}`);
  console.log(`[setup-stylus-adapters] timelock=${timelockAddr}`);

  const calldata = encodeSetAuthorizedCaller(routerAddr);
  console.log(`[setup-stylus-adapters] calldata (same for all): ${calldata}`);

  if (mode === 'dry-run') {
    console.log('\n--- DRY RUN: would schedule setAuthorizedCaller on these adapters ---');
    for (const slug of ADAPTER_SLUGS) {
      const addr = deployments.contracts[slug]?.address ?? 'NOT_DEPLOYED';
      console.log(`  ${slug}: ${addr}`);
    }
    console.log('\nNo transactions signed. Use --mode schedule to execute.');
    return;
  }

  if (mode === 'schedule') {
    const ops: OpsEntry[] = [];
    for (const slug of ADAPTER_SLUGS) {
      const addr = deployments.contracts[slug]?.address;
      if (!addr) {
        console.warn(`  SKIP ${slug}: not in deployments`);
        ops.push({ slug, adapter: '', calldata: '', opId: null, txHash: null, scheduledTimestamp: null });
        continue;
      }
      console.log(`\n  Scheduling setAuthorizedCaller on ${slug} (${addr})...`);
      // Phase 2b changed all 9 adapters to onlyTimelock for setAuthorizedCaller
      // (MASTER_PLAN §6.2, 48h veto window applies to authorization changes).
      // This timelock-schedule path is the correct production workflow.
      const entry: OpsEntry = {
        slug,
        adapter: addr,
        calldata,
        opId: null,
        txHash: null,
        scheduledTimestamp: null,
      };
      // Shell out to timelock-schedule for each
      const cmd = [
        'npx', 'tsx', resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'timelock-schedule.ts'),
        '--target', addr,
        '--calldata-hex', calldata,
        '--timelock-address', timelockAddr,
      ].join(' ');
      try {
        const output = execSync(cmd, { encoding: 'utf-8', env: process.env });
        console.log(output);
        // Parse op-id from output
        const opMatch = output.match(/op-id:\s*(0x[0-9a-f]{64})/i);
        if (opMatch) entry.opId = opMatch[1];
        const tsMatch = output.match(/block\s+(\d+)/);
        entry.scheduledTimestamp = Math.floor(Date.now() / 1000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  FAILED ${slug}: ${msg.slice(0, 200)}`);
      }
      ops.push(entry);
    }

    // Write ops file
    mkdirSync(dirname(OPS_FILE), { recursive: true });
    writeFileSync(OPS_FILE, JSON.stringify(ops, null, 2));
    console.log(`\n[setup-stylus-adapters] Wrote ${OPS_FILE}`);
    return;
  }

  if (mode === 'execute') {
    if (!existsSync(OPS_FILE)) {
      console.error(`ERROR: ${OPS_FILE} not found. Run --mode schedule first.`);
      process.exit(1);
    }
    const ops: OpsEntry[] = JSON.parse(readFileSync(OPS_FILE, 'utf-8'));
    for (const entry of ops) {
      if (!entry.adapter || !entry.opId) {
        console.log(`  SKIP ${entry.slug}: no op-id recorded.`);
        continue;
      }
      console.log(`\n  Executing timelock for ${entry.slug} (op-id=${entry.opId})...`);
      const cmd = [
        'npx', 'tsx', resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'timelock-execute.ts'),
        '--op-id', entry.opId,
        '--target', entry.adapter,
        '--calldata-hex', entry.calldata,
        '--scheduled-timestamp', String(entry.scheduledTimestamp ?? 0),
        '--timelock-address', timelockAddr,
      ].join(' ');
      try {
        const output = execSync(cmd, { encoding: 'utf-8', env: process.env });
        console.log(output);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  FAILED ${entry.slug}: ${msg.slice(0, 200)}`);
      }
    }
    return;
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
