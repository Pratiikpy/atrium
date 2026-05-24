#!/usr/bin/env node
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import { CRATES } from './run-kani.mjs';

/**
 * Iter 80: pins run-kani's CRATES list so a contributor adding a new
 * Stylus crate (or removing an existing one) can't silently leave the
 * Kani-proof suite unrun.
 */

describe('run-kani CRATES — config shape', () => {
  it('is a non-empty array of relative paths', () => {
    assert.ok(Array.isArray(CRATES));
    assert.ok(CRATES.length > 0);
    for (const c of CRATES) {
      assert.equal(typeof c, 'string');
      assert.match(c, /^contracts\/[\w-]+$/, `${c}: must be contracts/<slug>`);
    }
  });

  it('includes Plinth + Sigil (the two contracts with #[kani::proof] today)', () => {
    // Iter 53→80 audit-fix grep finds #[kani::proof] only in plinth + sigil.
    // If a future iter adds proofs to coffer/vigil, this test fails so the
    // CRATES list update is forced.
    assert.ok(CRATES.includes('contracts/plinth'));
    assert.ok(CRATES.includes('contracts/sigil'));
  });

  it('every CRATES entry is unique', () => {
    const seen = new Set();
    for (const c of CRATES) {
      assert.ok(!seen.has(c), `duplicate crate: ${c}`);
      seen.add(c);
    }
  });
});
