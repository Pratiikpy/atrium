/**
 * Scribe (subgraph) health checker.
 *
 * Reads Scribe `_meta { block { number } }` and chain `eth_blockNumber`
 * in parallel. Returns lag in blocks. isStale = lagBlocks > 100.
 *
 * Threshold rationale: Arbitrum L2 produces blocks every ~0.25s, so 100
 * blocks ≈ 25 seconds of lag. Beyond that, data shown to users may be
 * materially stale (e.g. a liquidation happened but isn't reflected yet).
 */

export interface ScribeHealth {
  indexedBlock: number;
  chainBlock: number;
  lagBlocks: number;
  isStale: boolean;
}

const TIMEOUT_MS = 3000;
const STALE_THRESHOLD = 100;

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
