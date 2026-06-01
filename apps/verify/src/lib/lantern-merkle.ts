import { keccak256, encodeAbiParameters, parseAbiParameters, type Hex } from 'viem';

/**
 * Lantern Merkle verification (079-BE6 fix).
 *
 * Pre-fix the "Verified" badge was produced by a wallet-address find() over an
 * unverified IPFS JSON, the attested root was never compared, the tree never
 * re-hashed, no proof checked. This module does the real thing, mirroring the
 * attestor's hashing byte-for-byte (services/lantern-attestor/src/merkle.ts):
 *   - leaf  = keccak256(keccak256(abi.encode(address,uint256,bytes32)))  [double-hash, OZ]
 *   - node  = keccak256(sortedConcat(left,right))                        [sorted pairs]
 *   - leaves padded with 32-byte zero leaves to the next power of two
 *
 * Honest verification = recompute the root from the published leaves, confirm
 * it equals the on-chain attested root, AND confirm the wallet's leaf folds up
 * its sibling path to that same root.
 */

export interface RawLeaf {
  user: string;
  balanceWei: string;
  salt: string;
}

const ZERO32 = `0x${'00'.repeat(32)}` as Hex;

export function hashLeaf(leaf: RawLeaf): Hex {
  const encoded = encodeAbiParameters(parseAbiParameters('address, uint256, bytes32'), [
    leaf.user as Hex,
    BigInt(leaf.balanceWei),
    leaf.salt as Hex,
  ]);
  return keccak256(keccak256(encoded));
}

// Sorted-pair keccak256. Equal-length lowercase hex compares identically to
// the attestor's Buffer.compare of the raw 32-byte words.
function hashPair(a: Hex, b: Hex): Hex {
  const [lo, hi] = a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a];
  return keccak256(`0x${lo.slice(2)}${hi.slice(2)}` as Hex);
}

function paddedLeafLayer(leaves: RawLeaf[]): Hex[] {
  const layer = leaves.map(hashLeaf);
  let target = 1;
  while (target < layer.length) target <<= 1;
  while (layer.length < target) layer.push(ZERO32);
  return layer;
}

export function computeRoot(leaves: RawLeaf[]): Hex {
  if (leaves.length === 0) return ZERO32;
  let layer = paddedLeafLayer(leaves);
  while (layer.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < layer.length; i += 2) next.push(hashPair(layer[i], layer[i + 1]));
    layer = next;
  }
  return layer[0];
}

export interface InclusionResult {
  included: boolean;
  recomputedRoot: Hex;
  rootMatches: boolean;
  leafIndex: number | null;
}

/**
 * Verify that `wallet` is included in the published `leaves` whose root equals
 * the on-chain `attestedRoot`. `included` is true only when the recomputed
 * root matches the attested root AND the wallet's leaf folds up to that root.
 */
export function verifyInclusion(leaves: RawLeaf[], wallet: string, attestedRoot: string): InclusionResult {
  if (leaves.length === 0) {
    return { included: false, recomputedRoot: ZERO32, rootMatches: false, leafIndex: null };
  }
  const walletLc = wallet.toLowerCase();
  const leafIndex = leaves.findIndex((l) => l.user.toLowerCase() === walletLc);

  // Fold the wallet leaf up its sibling path while reducing the layer to root.
  let layer = paddedLeafLayer(leaves);
  let idx = leafIndex >= 0 ? leafIndex : 0;
  let node = layer[idx];
  while (layer.length > 1) {
    const sibling = layer[idx % 2 === 1 ? idx - 1 : idx + 1];
    node = hashPair(node, sibling);
    const next: Hex[] = [];
    for (let i = 0; i < layer.length; i += 2) next.push(hashPair(layer[i], layer[i + 1]));
    layer = next;
    idx = Math.floor(idx / 2);
  }
  const recomputedRoot = layer[0];
  const rootMatches = recomputedRoot.toLowerCase() === attestedRoot.toLowerCase();
  const proofReachesRoot = node.toLowerCase() === recomputedRoot.toLowerCase();
  return {
    included: rootMatches && leafIndex >= 0 && proofReachesRoot,
    recomputedRoot,
    rootMatches,
    leafIndex: leafIndex >= 0 ? leafIndex : null,
  };
}
