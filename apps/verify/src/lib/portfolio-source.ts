/**
 * Plinth read-only client for portfolio API routes.
 *
 * Returns null when the contract address is not in
 * `deployments/arbitrum_sepolia.json` (audit J-C2 honesty: surface "pending"
 * to the UI instead of inventing data). Once Plinth deploys, this lights up
 * automatically.
 *
 * Wave-II refactor + fix:
 *   - Registry path-walk now lives in `lib/deployments-registry.ts`
 *     (audit HH-2 tested, zero-address sentinel rejected).
 *   - Cache key now includes the resolved Plinth address. The prior cache
 *     was time-only, if Praetor rotated Plinth's address mid-deploy,
 *     subsequent reads served stale data against the OLD contract for 60s.
 *     Now any address change invalidates the cache immediately.
 */
import { loadContractAddress } from './deployments-registry';

interface PlinthReadClient {
  read: {
    getAccount: (args: [string]) => Promise<[bigint, bigint, bigint, boolean]>;
  };
}

let cachedClient: PlinthReadClient | null = null;
let cachedAddress: string | null = null;
let cachedAt = 0;

export async function tryGetPlinth(): Promise<PlinthReadClient | null> {
  const plinthAddress = await loadContractAddress('plinth');
  if (!plinthAddress) {
    // Address gone (rare but possible, e.g. registry file deleted mid-rotation).
    // Clear the cache so the next deploy doesn't read through a stale client.
    cachedClient = null;
    cachedAddress = null;
    return null;
  }

  // Cache hit only if BOTH the time window holds AND the address still
  // matches what we cached. Address rotation invalidates immediately.
  if (cachedClient && cachedAddress === plinthAddress && Date.now() - cachedAt < 60_000) {
    return cachedClient;
  }

  try {
    const { createPublicClient, http, getContract } = await import('viem');
    const { arbitrumSepolia } = await import('viem/chains');
    const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
    const client = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
    const plinth = getContract({
      address: plinthAddress as `0x${string}`,
      abi: PLINTH_ABI,
      client,
    }) as unknown as PlinthReadClient;
    cachedClient = plinth;
    cachedAddress = plinthAddress;
    cachedAt = Date.now();
    return plinth;
  } catch {
    return null;
  }
}

const PLINTH_ABI = [
  {
    type: 'function',
    name: 'getAccount',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'collateral', type: 'uint256' },
      { name: 'required', type: 'uint256' },
      { name: 'notional', type: 'uint256' },
      { name: 'paused', type: 'bool' },
    ],
  },
] as const;

// --- Coffer collateral: the FIX for the share-vs-asset display bug ---
// Plinth caches coffer.balance_of (raw ERC-4626 SHARES) as collateral, which
// (a) goes stale until a recompute and (b) on a small vault is ~1e6x the asset
// value, so formatting shares as USD rendered a $1.45 deposit as $1,450,000. The
// vault page reads convertToAssets directly and is correct; the portfolio must
// too. Reading the Coffer LIVE also fixes the deposit-staleness (no cached value).
const COFFER_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'convertToAssets', stateMutability: 'view', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

/** Live USDC asset value of a wallet's Coffer position (convertToAssets of its
 *  share balance). Returns null if the Coffer address or RPC is unavailable
 *  (caller surfaces "pending"); 0n if the wallet holds no shares. */
export async function tryGetCofferCollateralAssets(wallet: string): Promise<bigint | null> {
  const cofferAddress = await loadContractAddress('coffer');
  if (!cofferAddress) return null;
  try {
    const { createPublicClient, http } = await import('viem');
    const { arbitrumSepolia } = await import('viem/chains');
    const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
    const client = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
    const shares = (await client.readContract({ address: cofferAddress as `0x${string}`, abi: COFFER_ABI, functionName: 'balanceOf', args: [wallet as `0x${string}`] })) as bigint;
    if (shares === 0n) return 0n;
    return (await client.readContract({ address: cofferAddress as `0x${string}`, abi: COFFER_ABI, functionName: 'convertToAssets', args: [shares] })) as bigint;
  } catch {
    return null;
  }
}
