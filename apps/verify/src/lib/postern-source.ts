/**
 * PosternKeyRegistry read-only client for the session-keys API route.
 *
 * Mirrors `portfolio-source.ts`: resolves the registry address from
 * `deployments/arbitrum_sepolia.json` and returns null when it is absent,
 * so the UI shows an honest pending state instead of inventing keys. Once
 * the registry is in the registry file (it is, at postern-key-registry) this
 * lights up automatically.
 *
 * The viem public client is cached by resolved address (an address rotation
 * invalidates it immediately); the per-user reads always run fresh, since
 * session-key state is per wallet and changes on every issuance/revocation.
 */
import { loadContractAddress } from './deployments-registry';

export interface SessionKey {
  address: string;
  /** Unix seconds. */
  expiresAtUnix: number;
  expired: boolean;
}

interface RegistryReadClient {
  read: {
    getActiveKeys: (args: [string]) => Promise<readonly string[]>;
    expiresAt: (args: [string, string]) => Promise<bigint>;
  };
}

let cachedClient: RegistryReadClient | null = null;
let cachedAddress: string | null = null;
let cachedAt = 0;

async function tryGetRegistry(): Promise<RegistryReadClient | null> {
  const address = await loadContractAddress('postern-key-registry');
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
    const registry = getContract({
      address: address as `0x${string}`,
      abi: REGISTRY_ABI,
      client,
    }) as unknown as RegistryReadClient;
    cachedClient = registry;
    cachedAddress = address;
    cachedAt = Date.now();
    return registry;
  } catch {
    return null;
  }
}

export interface SessionKeysResult {
  keys: SessionKey[];
  source: 'registry' | 'pending';
}

/**
 * Reads a user's active session keys + their expiries from the on-chain
 * registry. Returns `source: 'pending'` (empty list) when the registry is
 * not deployed, the wallet is absent, or the read reverts - never a fake key.
 */
export async function tryGetSessionKeys(user: string | null): Promise<SessionKeysResult> {
  if (!user) return { keys: [], source: 'pending' };
  const registry = await tryGetRegistry();
  if (!registry) return { keys: [], source: 'pending' };
  try {
    const active = await registry.read.getActiveKeys([user]);
    const nowSec = Math.floor(Date.now() / 1000);
    const keys = await Promise.all(
      active.map(async (address) => {
        let expiresAtUnix = 0;
        try {
          expiresAtUnix = Number(await registry.read.expiresAt([user, address]));
        } catch {
          expiresAtUnix = 0;
        }
        return {
          address,
          expiresAtUnix,
          expired: expiresAtUnix > 0 ? expiresAtUnix <= nowSec : false,
        } satisfies SessionKey;
      }),
    );
    return { keys, source: 'registry' };
  } catch {
    return { keys: [], source: 'pending' };
  }
}

const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'getActiveKeys',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'expiresAt',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'sessionKey', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
