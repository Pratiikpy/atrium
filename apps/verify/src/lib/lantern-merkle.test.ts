import { describe, it, expect } from 'vitest';
import { computeRoot, hashLeaf, verifyInclusion, type RawLeaf } from './lantern-merkle';

const salt = (n: number) => (`0x${n.toString(16).padStart(64, '0')}`) as `0x${string}`;
const addr = (c: string) => (`0x${c.repeat(40)}`) as `0x${string}`;

const LEAVES: RawLeaf[] = [
  { user: addr('a'), balanceWei: '1000000', salt: salt(1) },
  { user: addr('b'), balanceWei: '2500000', salt: salt(2) },
  { user: addr('c'), balanceWei: '500000', salt: salt(3) },
];

/**
 * 079-BE6 regression. Pre-fix verification was a wallet-address find() that
 * ignored the root entirely, a "Verified" badge backed by nothing. The fix
 * recomputes the root and checks the wallet's inclusion proof against the
 * on-chain attested root.
 */
describe('lantern-merkle verifyInclusion', () => {
  const root = computeRoot(LEAVES);

  it('single-leaf root equals the leaf hash (sanity)', () => {
    const single = [LEAVES[0]];
    expect(computeRoot(single)).toBe(hashLeaf(LEAVES[0]));
  });

  it('verifies a present wallet against the correct attested root', () => {
    const res = verifyInclusion(LEAVES, addr('b'), root);
    expect(res.included).toBe(true);
    expect(res.rootMatches).toBe(true);
    expect(res.leafIndex).toBe(1);
  });

  it('REJECTS a present wallet when the attested root does not match (the core bug)', () => {
    // Pre-fix this returned ok purely on the address match. A wrong/tampered
    // root must fail even though the wallet IS in the leaves.
    const wrongRoot = ('0x' + 'de'.repeat(32)) as `0x${string}`;
    const res = verifyInclusion(LEAVES, addr('a'), wrongRoot);
    expect(res.rootMatches).toBe(false);
    expect(res.included).toBe(false);
  });

  it('REJECTS a wallet that is not in the tree even when the root matches', () => {
    const res = verifyInclusion(LEAVES, addr('f'), root);
    expect(res.included).toBe(false);
    expect(res.leafIndex).toBeNull();
  });

  it('detects a tampered leaf (balance changed) via root mismatch', () => {
    const tampered = LEAVES.map((l, i) => (i === 1 ? { ...l, balanceWei: '999999999' } : l));
    // The attested root was computed over the ORIGINAL leaves; the tampered
    // set recomputes to a different root, so inclusion fails.
    const res = verifyInclusion(tampered, addr('b'), root);
    expect(res.rootMatches).toBe(false);
    expect(res.included).toBe(false);
  });
});
