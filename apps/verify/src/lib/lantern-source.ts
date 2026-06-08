/**
 * LanternAttestor on-chain read client for the proof-of-reserves API.
 *
 * Mirrors coffer-source: resolves the LanternAttestor address from the
 * deployments registry and reads it directly via viem, returning null when
 * absent or on any read failure (callers render honest pending, never a fake).
 *
 * WHY THIS EXISTS (found via live QA 2026-06-08): the flagship PoR
 * (/api/reserves/summary) reads attestation FRESHNESS only from the Scribe
 * subgraph. Scribe runs on the Graph Studio free tier, whose outages are a
 * structural reality (rate-limiting, re-sync after a subgraph redeploy). A
 * Studio outage took the flagship PoR dark ("Scribe unavailable; freshness
 * unknown") for minutes DESPITE a fresh on-chain attestation existing. The
 * attestation root + block ARE on-chain (the source of truth Scribe merely
 * indexes), so PoR freshness should survive a subgraph outage by reading the
 * contract directly. This is that fallback.
 *
 * The contract stores only `latest_block` (uint64) + `latest_root` (bytes32) as
 * getters; the timestamp/leafCount/tvl live in the AttestationPublished event,
 * not storage. So this fallback recovers FRESHNESS (via the block's timestamp)
 * and the root, but not tvl/leafCount - which the route surfaces as null
 * (honest), exactly as it would when Scribe is down.
 */
import { loadContractAddress } from './deployments-registry';

const LANTERN_ABI = [
  { type: 'function', name: 'latest_block', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { type: 'function', name: 'latest_root', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bytes32' }] },
] as const;

export interface LanternOnchainAttestation {
  /** The Arbitrum block the reserves Merkle tree was snapshotted at. */
  blockNumber: bigint;
  /** The latest published Merkle root. */
  root: `0x${string}`;
  /** Unix seconds: the timestamp of `blockNumber`, used for freshness. */
  timestampSec: number;
}

/**
 * Read the latest on-chain attestation directly from LanternAttestor. Returns
 * null when the contract is not deployed, no attestation has been published
 * (latest_block == 0), or any RPC read fails - so the caller falls through to
 * the same honest "pending" it would show with no fallback.
 */
export async function tryGetLanternAttestationOnchain(): Promise<LanternOnchainAttestation | null> {
  const address = await loadContractAddress('lantern-attestor');
  if (!address) return null;
  try {
    const { createPublicClient, http, getContract } = await import('viem');
    const { arbitrumSepolia } = await import('viem/chains');
    const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
    const client = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
    const lantern = getContract({ address: address as `0x${string}`, abi: LANTERN_ABI, client });
    const [blockNumber, root] = await Promise.all([
      lantern.read.latest_block() as Promise<bigint>,
      lantern.read.latest_root() as Promise<`0x${string}`>,
    ]);
    // No attestation published yet -> honest pending, not a fabricated fresh.
    if (blockNumber === 0n) return null;
    // The block's own timestamp gives accurate freshness (now - blockTs),
    // matching the Scribe path's timestamp semantics.
    const block = await client.getBlock({ blockNumber });
    return { blockNumber, root, timestampSec: Number(block.timestamp) };
  } catch {
    return null;
  }
}
