/**
 * praetor timelock-schedule, schedules a tx via PraetorTimelock.schedule(target, calldata).
 *
 * Usage:
 *   npx tsx services/praetor-cli/src/commands/timelock-schedule.ts \
 *     --target 0x... --calldata-hex 0x... [--delay 172800] [--dry-run]
 *
 * Outputs the scheduled op-id (bytes32) so timelock-execute can consume it.
 */
import { createPublicClient, createWalletClient, http, encodeFunctionData, keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { parseArgs } from 'node:util';

const PRAETOR_TIMELOCK_ABI = [
  {
    type: 'function',
    name: 'schedule',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'target', type: 'address' }, { name: 'data', type: 'bytes' }],
    outputs: [{ name: 'id', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'scheduledAt',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ type: 'uint64' }],
  },
] as const;

const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    'calldata-hex': { type: 'string' },
    delay: { type: 'string', default: '172800' },
    'dry-run': { type: 'boolean', default: false },
    'timelock-address': { type: 'string' },
    'rpc-url': { type: 'string' },
  },
  strict: true,
});

async function main() {
  const target = values.target as `0x${string}`;
  const calldataHex = values['calldata-hex'] as `0x${string}`;
  const dryRun = values['dry-run'] ?? false;
  const timelockAddr = (values['timelock-address'] ?? '0x0dAd24d7feb2bB797e0f69e02c2F32104FCF22d4') as `0x${string}`;
  const rpcUrl = values['rpc-url'] ?? process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';

  if (!target || !calldataHex) {
    console.error('ERROR: --target and --calldata-hex are required.');
    process.exit(1);
  }

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport });

  // Compute the expected op-id (keccak256(abi.encode(target, data, block.timestamp)))
  // We can't know block.timestamp ahead of time, so we simulate.
  console.log(`[timelock-schedule] target=${target}`);
  console.log(`[timelock-schedule] calldata=${calldataHex.slice(0, 66)}...`);
  console.log(`[timelock-schedule] delay=${values.delay}s (48h=${172800}s)`);

  if (dryRun) {
    console.log('[timelock-schedule] DRY RUN, simulating schedule call...');
    try {
      const { result } = await publicClient.simulateContract({
        address: timelockAddr,
        abi: PRAETOR_TIMELOCK_ABI,
        functionName: 'schedule',
        args: [target, calldataHex],
        account: '0x0000000000000000000000000000000000000001', // dummy
      });
      console.log(`[timelock-schedule] Simulated op-id: ${result}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[timelock-schedule] Simulation reverted (expected if not multisig): ${msg.slice(0, 200)}`);
    }
    console.log('[timelock-schedule] DRY RUN complete. No tx signed.');
    return;
  }

  // Real execution requires DEPLOYER_PRIVATE_KEY
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
    functionName: 'schedule',
    args: [target, calldataHex],
  });

  console.log(`[timelock-schedule] Tx submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`[timelock-schedule] Confirmed in block ${receipt.blockNumber}`);

  // Extract op-id from Scheduled event log
  const scheduledTopic = keccak256(new TextEncoder().encode('Scheduled(bytes32,address,bytes,uint64)'));
  const scheduledLog = receipt.logs.find((l) => l.topics[0] === scheduledTopic);
  if (scheduledLog?.topics[1]) {
    console.log(`[timelock-schedule] op-id: ${scheduledLog.topics[1]}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
