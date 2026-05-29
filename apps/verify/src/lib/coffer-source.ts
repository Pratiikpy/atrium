/**
 * Coffer (ERC-4626 USDC vault) read-only client for reserves API routes.
 *
 * Mirrors portfolio-source / postern-source: resolves the Coffer address from
 * the deployments registry, returns null when absent so the UI shows honest
 * pending instead of a fabricated balance. The viem client is address-cached.
 *
 * `totalAssets()` is the protocol-level REDEEMABLE figure: the underlying USDC
 * currently backing every vault share. This differs from the Scribe-indexed
 * net-deposited TVL once the vault accrues yield or takes a loss, so the
 * reserves page can show "redeemable now" honestly rather than implying
 * net-deposits == redeemable.
 */
import { loadContractAddress } from './deployments-registry';

interface CofferReadClient {
  read: {
    totalAssets: () => Promise<bigint>;
  };
}

let cachedClient: CofferReadClient | null = null;
let cachedAddress: string | null = null;
let cachedAt = 0;

async function tryGetCoffer(): Promise<CofferReadClient | null> {
  const address = await loadContractAddress('coffer');
  if (!address) {
    cachedClient = null;
    cachedAddress = null;
    return null;
  }
  if (cachedClient && cachedAddress === address && Date.now() - cachedAt < 60_000) {
    return cachedClient;
  }
  try {
    const { createPublicClient, http, getContract } = await import('viem');
    const { arbitrumSepolia } = await import('viem/chains');
    const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
    const client = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
    const coffer = getContract({
      address: address as `0x${string}`,
      abi: COFFER_ABI,
      client,
    }) as unknown as CofferReadClient;
    cachedClient = coffer;
    cachedAddress = address;
    cachedAt = Date.now();
    return coffer;
  } catch {
    return null;
  }
}

/**
 * Total redeemable underlying USDC in the vault, as a bigint of base units
 * (USDC has 6 decimals). Returns null when the Coffer is not deployed or the
 * read reverts - callers must render an honest pending, never a fake zero.
 */
export async function tryGetRedeemableAssets(): Promise<bigint | null> {
  const coffer = await tryGetCoffer();
  if (!coffer) return null;
  try {
    return await coffer.read.totalAssets();
  } catch {
    return null;
  }
}

const COFFER_ABI = [
  {
    type: 'function',
    name: 'totalAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
