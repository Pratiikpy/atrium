/**
 * praetor timelock-execute, executes a scheduled tx via PraetorTimelock.execute(target, data, scheduled_timestamp).
 *
 * Usage:
 *   npx tsx services/praetor-cli/src/commands/timelock-execute.ts \
 *     --op-id 0x... --target 0x... --calldata-hex 0x... --scheduled-timestamp <unix> [--dry-run]
 *
 * Validates that 48h has elapsed; refuses if too early.
 */
import { createPublicClient, createWalletClient, http, keccak256 } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { parseArgs } from 'node:util';

const TIMELOCK_DURATION = 172800n; // 48h in seconds

const PRAETOR_TIMELOCK_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'scheduled_timestamp', type: 'uint64' },
    ],
    outputs: [{ name: 'return_data', type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'scheduledAt',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'executed',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

const { values } = parseArgs({
  options: {
    'op-id': { type: 'string' },
    target: { type: 'string' },
    'calldata-hex': { type: 'string' },
    'scheduled-timestamp': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'timelock-address': { type: 'string' },
    'rpc-url': { type: 'string' },
  },
  strict: true,
});

async function main() {
  const opId = values['op-id'] as `0x${string}`;
  const target = values.target as `0x${string}`;
  const calldataHex = values['calldata-hex'] as `0x${string}`;
  const scheduledTimestamp = BigInt(values['scheduled-timestamp'] ?? '0');
  const dryRun = values['dry-run'] ?? false;
  const timelockAddr = (values['timelock-address'] ?? '0x0dAd24d7feb2bB797e0f69e02c2F32104FCF22d4') as `0x${string}`;
  const rpcUrl = values['rpc-url'] ?? process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';

  if (!target || !calldataHex || !scheduledTimestamp) {
    console.error('ERROR: --target, --calldata-hex, and --scheduled-timestamp are required.');
    process.exit(1);
  }

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport });

  // Verify the op is scheduled and 48h has elapsed
  if (opId) {
    const scheduledAt = await publicClient.readContract({
      address: timelockAddr,
      abi: PRAETOR_TIMELOCK_ABI,
      functionName: 'scheduledAt',
      args: [opId],
    });
    if (scheduledAt === 0n) {
      console.error(`ERROR: op-id ${opId} is not scheduled on the timelock.`);
      process.exit(1);
    }
    const alreadyExecuted = await publicClient.readContract({
      address: timelockAddr,
      abi: PRAETOR_TIMELOCK_ABI,
      functionName: 'executed',
      args: [opId],
    });
    if (alreadyExecuted) {
      console.error(`ERROR: op-id ${opId} has already been executed.`);
      process.exit(1);
    }
    const readyAt = scheduledAt + TIMELOCK_DURATION;
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < readyAt) {
      const remaining = Number(readyAt - now);
      const hours = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      console.error(`ERROR: Timelock not expired. ${hours}h ${mins}m remaining (ready at ${readyAt}).`);
      process.exit(1);
    }
    console.log(`[timelock-execute] op-id ${opId}, timelock expired, ready to execute.`);
  }

  console.log(`[timelock-execute] target=${target}`);
  console.log(`[timelock-execute] scheduled_timestamp=${scheduledTimestamp}`);

  if (dryRun) {
    console.log('[timelock-execute] DRY RUN, simulating execute call...');
    try {
      await publicClient.simulateContract({
        address: timelockAddr,
        abi: PRAETOR_TIMELOCK_ABI,
        functionName: 'execute',
        args: [target, calldataHex, scheduledTimestamp],
        account: '0x0000000000000000000000000000000000000001',
      });
      console.log('[timelock-execute] Simulation succeeded.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[timelock-execute] Simulation reverted: ${msg.slice(0, 200)}`);
    }
    console.log('[timelock-execute] DRY RUN complete. No tx signed.');
    return;
  }

  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    console.error('ERROR: DEPLOYER_PRIVATE_KEY env var required for non-dry-run execution.');
    process.exit(1);
  }

  const account = privateKeyToAccount(pk as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: arbitrumSepolia, transport });

  const hash = await walletClient.writeContract({
    address: timelockAddr,
    abi: PRAETOR_TIMELOCK_ABI,
    functionName: 'execute',
    args: [target, calldataHex, scheduledTimestamp],
  });

  console.log(`[timelock-execute] Tx submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`[timelock-execute] Confirmed in block ${receipt.blockNumber}. Done.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
