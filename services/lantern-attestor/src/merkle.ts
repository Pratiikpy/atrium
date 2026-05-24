import keccak256 from 'keccak256';
import { encodeAbiParameters, parseAbiParameters } from 'viem';

export interface Leaf {
  user: `0x${string}`;
  balanceWei: bigint;
  salt: `0x${string}`;
}

export interface Tree {
  leaves: Leaf[];
  hashedLeaves: Buffer[];
  layers: Buffer[][];
  root: Buffer;
}

export function buildTree(leaves: Leaf[]): Tree {
  const hashedLeaves = leaves.map(hashLeaf).map((b) => Buffer.from(b.slice(2), 'hex'));
  // Pad with zero leaves to next power of two for deterministic depth
  const target = nextPowerOfTwo(hashedLeaves.length);
  while (hashedLeaves.length < target) {
    hashedLeaves.push(Buffer.alloc(32, 0));
  }
  const layers: Buffer[][] = [hashedLeaves];
  // Audit U-32: @types/node v22+ made Buffer generic over its underlying
  // buffer type. `hashedLeaves` is inferred Buffer<ArrayBuffer>[] but
  // `next` is declared `Buffer[]` (i.e. Buffer<ArrayBufferLike>[]).
  // Explicit type annotation here unifies the two on the wider form so
  // the loop's `current = next` assignment typechecks.
  let current: Buffer[] = hashedLeaves;
  while (current.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(hashPair(current[i], current[i + 1]));
    }
    layers.push(next);
    current = next;
  }
  return { leaves, hashedLeaves, layers, root: current[0] };
}

export function rootOf(tree: Tree): `0x${string}` {
  return `0x${tree.root.toString('hex')}`;
}

export function inclusionProof(tree: Tree, leafIndex: number): { path: `0x${string}`[]; positions: ('left' | 'right')[] } {
  const path: `0x${string}`[] = [];
  const positions: ('left' | 'right')[] = [];
  let idx = leafIndex;
  for (let layer = 0; layer < tree.layers.length - 1; layer++) {
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    path.push(`0x${tree.layers[layer][siblingIdx].toString('hex')}`);
    positions.push(isRight ? 'left' : 'right');
    idx = Math.floor(idx / 2);
  }
  return { path, positions };
}

function hashLeaf(leaf: Leaf): `0x${string}` {
  // Audit FIRE77-L1 fix (sub-agent HIGH): double-hash leaves to domain-
  // separate from interior nodes. The on-chain `LanternAttestor.verifyInclusion`
  // applies a matching second hash before walking the proof. Without this
  // pairing, an attacker could pass a 32-byte interior node as `leaf` with
  // the remaining ancestor siblings and verify against the same root,
  // forging an inclusion proof. OZ MerkleProof convention (MerkleProof.sol
  // §27-29 in resources/openzeppelin-contracts/).
  const encoded = encodeAbiParameters(
    parseAbiParameters('address, uint256, bytes32'),
    [leaf.user, leaf.balanceWei, leaf.salt]
  );
  const firstHash = keccak256(Buffer.from(encoded.slice(2), 'hex'));
  const secondHash = keccak256(firstHash);
  return `0x${secondHash.toString('hex')}`;
}

function hashPair(left: Buffer, right: Buffer): Buffer {
  const sorted = Buffer.compare(left, right) <= 0 ? Buffer.concat([left, right]) : Buffer.concat([right, left]);
  return keccak256(sorted);
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
