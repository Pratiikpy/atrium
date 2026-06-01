/**
 * Lantern leaf builder (Vercel api/ path), share-redemption-aware.
 *
 * Mirror of src/leaves.ts. Every leaf's balance is sourced on-chain via
 * Coffer.convertToAssets(balanceOf(user)), NOT the subgraph's net-deposit
 * `balanceWei`. Scribe only provides the user list; balance authority is the
 * EVM. Batches of 100 users, 5 concurrent multicalls.
 */
import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import type { Leaf } from './_merkle.js';

const BATCH_SIZE = 100;
const CONCURRENCY = 5;

const COFFER_ABI = [
  {
    type: 'function',
    name: 'convertToAssets',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

interface UserSalt {
  user: string;
  salt: string;
}

export async function buildLeaves(users: UserSalt[], cofferAddress: string): Promise<Leaf[]> {
  if (!cofferAddress || users.length === 0) return [];

  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
  const client = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });

  const leaves: Leaf[] = [];
  const batches: UserSalt[][] = [];
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    batches.push(users.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((batch) => processBatch(client, batch, cofferAddress)));
    for (const batchLeaves of results) {
      leaves.push(...batchLeaves);
    }
  }

  return leaves.filter((l) => l.balanceWei > 0n);
}

async function processBatch(
  client: ReturnType<typeof createPublicClient>,
  batch: UserSalt[],
  cofferAddress: string,
): Promise<Leaf[]> {
  const results: Leaf[] = [];

  const balanceCalls = batch.map((u) => ({
    address: cofferAddress as `0x${string}`,
    abi: COFFER_ABI,
    functionName: 'balanceOf' as const,
    args: [u.user as `0x${string}`] as const,
  }));

  try {
    const shares = await client.multicall({ contracts: balanceCalls } as any);

    const assetCalls = (shares as any[])
      .map((s: any, idx: number) => {
        const val = s.status === 'success' ? (s.result as bigint) : 0n;
        return { idx, shares: val };
      })
      .filter((x) => x.shares > 0n)
      .map((x) => ({
        address: cofferAddress as `0x${string}`,
        abi: COFFER_ABI,
        functionName: 'convertToAssets' as const,
        args: [x.shares] as const,
        _idx: x.idx,
      }));

    if (assetCalls.length > 0) {
      const assets = (await client.multicall({
        contracts: assetCalls.map(({ _idx, ...c }) => c),
      } as any)) as any[];

      for (let j = 0; j < assetCalls.length; j++) {
        const originalIdx = assetCalls[j]._idx;
        const assetVal = assets[j].status === 'success' ? (assets[j].result as bigint) : 0n;
        results.push({
          user: batch[originalIdx].user as `0x${string}`,
          balanceWei: assetVal,
          salt: batch[originalIdx].salt as `0x${string}`,
        });
      }
    }

    for (let i = 0; i < batch.length; i++) {
      const shareVal = (shares as any[])[i].status === 'success' ? ((shares as any[])[i].result as bigint) : 0n;
      if (shareVal === 0n) {
        results.push({ user: batch[i].user as `0x${string}`, balanceWei: 0n, salt: batch[i].salt as `0x${string}` });
      }
    }
  } catch (err) {
    console.warn(`[lantern] multicall batch failed, skipping ${batch.length} users:`, err);
  }

  return results;
}
