#!/usr/bin/env node
/**
 * Run Kani proofs for every Stylus crate that has them.
 *
 * Audit K-7 fix: `cargo kani --workspace` from the repo root runs zero proofs
 * because the Stylus crates are excluded from the workspace (per the
 * Windows-MSVC blocker note in `human_left.md` #11). Iterating per-crate
 * matches what CI does and what `cargo kani setup && cargo kani` expects.
 *
 * Uses execFileSync (no shell interpolation). CRATES is fully static; no
 * untrusted input ever reaches a subprocess argv.
 */
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CRATES = ['contracts/plinth', 'contracts/sigil'];

// Iter 80: export CRATES for unit-test verification of the config shape.
// The kani-run loop only fires when invoked as a CLI.
export { CRATES };

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  let failed = 0;
  for (const crate of CRATES) {
    console.log(`\n=== kani ${crate} ===`);
    try {
      execFileSync('cargo', ['kani'], {
        cwd: resolve(repoRoot, crate),
        stdio: 'inherit',
      });
    } catch (err) {
      failed++;
      console.error(`kani failed for ${crate}`);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} of ${CRATES.length} kani targets failed`);
    process.exit(1);
  }
  console.log(`\nall ${CRATES.length} kani targets passed`);
}
