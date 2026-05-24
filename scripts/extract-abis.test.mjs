#!/usr/bin/env node
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import { TARGETS } from './extract-abis.mjs';

/**
 * Iter 80 audit fix: pins the TARGETS config shape so a future
 * contributor adding a new contract can't accidentally break the
 * extractor by misshapen entry.
 */

describe('TARGETS — shape contract', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(TARGETS));
    assert.ok(TARGETS.length > 0);
  });

  it('every entry has name + source.type', () => {
    for (const t of TARGETS) {
      assert.equal(typeof t.name, 'string', `target name must be string`);
      assert.ok(t.name.length > 0, `target name must be non-empty`);
      assert.ok(['solidity', 'stylus'].includes(t.source.type),
        `${t.name}: source.type must be solidity or stylus, got ${t.source.type}`);
    }
  });

  it('solidity entries have source.contract "<path>:<name>" shape', () => {
    for (const t of TARGETS.filter((x) => x.source.type === 'solidity')) {
      assert.match(t.source.contract, /^contracts\/.+\.sol:[A-Z]\w+$/,
        `${t.name}: source.contract must be path.sol:Name`);
      // Convention: the part after the colon matches t.name. A typo here
      // would silently extract the wrong contract's ABI.
      const afterColon = t.source.contract.split(':')[1];
      assert.equal(afterColon, t.name,
        `${t.name}: contract identifier after ':' should equal t.name`);
    }
  });

  it('stylus entries have source.cargoDir under contracts/', () => {
    for (const t of TARGETS.filter((x) => x.source.type === 'stylus')) {
      assert.match(t.source.cargoDir, /^contracts\/[\w-]+$/,
        `${t.name}: source.cargoDir must be contracts/<slug>`);
    }
  });

  it('includes the 4 Stylus contracts (Plinth, Coffer, Sigil, Vigil)', () => {
    // These four are the load-bearing Stylus contracts; their absence
    // would silently leave the subgraph without their ABIs and break
    // `pnpm codegen`. Pin them explicitly.
    const stylus = TARGETS.filter((t) => t.source.type === 'stylus').map((t) => t.name);
    assert.ok(stylus.includes('Plinth'));
    assert.ok(stylus.includes('Coffer'));
    assert.ok(stylus.includes('Sigil'));
    assert.ok(stylus.includes('Vigil'));
  });

  it('all target names are unique', () => {
    const seen = new Set();
    for (const t of TARGETS) {
      assert.ok(!seen.has(t.name), `duplicate target name: ${t.name}`);
      seen.add(t.name);
    }
  });

  it('target names are PascalCase', () => {
    for (const t of TARGETS) {
      assert.match(t.name, /^[A-Z][A-Za-z0-9]+$/,
        `${t.name}: must be PascalCase to match subgraph CONTRACT_TO_SOURCE keys`);
    }
  });
});
