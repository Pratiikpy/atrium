import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 065-FE10 regression. The Merkle SVG used to hardcode four hash-shaped leaf
 * labels ("0x01…".."0x04…") synthesized from the map index, sat beside real
 * Scribe leafCount/depth, and never read sampleNodes, fabricated hashes shown
 * as real attested leaves. Lock the fix at the source level.
 */
describe('merkle-structure card', () => {
  const src = readFileSync(
    path.resolve(process.cwd(), 'src/components/reserves/merkle-structure.tsx'),
    'utf8',
  );

  it('does not synthesize hash-shaped leaf labels from the array index', () => {
    // The exact fabrication pattern: 0x{(i + 1).toString(16)...}.
    expect(src).not.toMatch(/0x\{\(i \+ 1\)\.toString\(16\)/);
    expect(src).not.toMatch(/>0x\{/);
  });

  it('reads real leaf data from sampleNodes', () => {
    expect(src).toMatch(/sampleNodes/);
  });
});
