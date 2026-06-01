/**
 * Scribe health check for lantern-attestor.
 *
 * If lagBlocks > 50 (~12s on Arbitrum L2), the Scribe data is too stale
 * to build a trustworthy Merkle tree, abort the publish and alert.
 * Threshold: 50 blocks ≈ 12.5s. Lantern publishes hourly, so even a
 * 12s lag means the tree could miss a deposit that landed 12s ago.
 * For POR integrity, we abort rather than publish a stale tree.
 */

export interface ScribeHealth {
  indexedBlock: number;
  chainBlock: number;
  lagBlocks: number;
  isStale: boolean;
}

const TIMEOUT_MS = 3000;
const STALE_THRESHOLD = 50;

export async function checkScribeHealth(scribeUrl: string): Promise<ScribeHealth> {
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';

  const [scribeRes, chainRes] = await Promise.all([
    fetch(scribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ _meta { block { number } } }' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }),
    fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }),
  ]);

  const scribeJson = (await scribeRes.json()) as { data?: { _meta?: { block?: { number?: number } } } };
  const chainJson = (await chainRes.json()) as { result?: string };

  const indexedBlock = scribeJson.data?._meta?.block?.number ?? 0;
  const chainBlock = chainJson.result ? parseInt(chainJson.result, 16) : 0;
  const lagBlocks = Math.max(0, chainBlock - indexedBlock);

  return { indexedBlock, chainBlock, lagBlocks, isStale: lagBlocks > STALE_THRESHOLD };
}
