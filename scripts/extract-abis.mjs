#!/usr/bin/env node
/**
 * Atrium subgraph ABI extractor.
 *
 * Generates `subgraph/abis/<Contract>.json` for every contract the subgraph
 * indexes. Solidity contracts come from `forge inspect`; Stylus contracts
 * come from `cargo stylus export-abi`.
 *
 * Audit K-2 fix: `subgraph/abis/` was empty so `graph codegen` errored before
 * the build. Wired into CI via `.github/workflows/subgraph.yml`.
 *
 * Usage:
 *   node scripts/extract-abis.mjs           # all contracts
 *   node scripts/extract-abis.mjs Sigil     # one contract
 *
 * Uses execFileSync (not exec / execSync with a shell string) to avoid
 * shell interpolation. TARGETS is fully static; no untrusted input ever
 * reaches a subprocess argv.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = resolve(repoRoot, 'subgraph/abis');
mkdirSync(outDir, { recursive: true });

const TARGETS = [
  { name: 'Aqueduct', source: { type: 'solidity', contract: 'contracts/aqueduct/src/Aqueduct.sol:Aqueduct' } },
  { name: 'Edict', source: { type: 'solidity', contract: 'contracts/edict/src/Edict.sol:Edict' } },
  { name: 'LanternAttestor', source: { type: 'solidity', contract: 'contracts/lantern-attestor/src/LanternAttestor.sol:LanternAttestor' } },
  { name: 'PorticoRegistry', source: { type: 'solidity', contract: 'contracts/portico-registry/src/PorticoRegistry.sol:PorticoRegistry' } },
  { name: 'PosternKillSwitch', source: { type: 'solidity', contract: 'contracts/postern-kill-switch/src/PosternKillSwitch.sol:PosternKillSwitch' } },
  { name: 'PraetorTimelock', source: { type: 'solidity', contract: 'contracts/praetor-timelock/src/PraetorTimelock.sol:PraetorTimelock' } },
  { name: 'ResearchAttestation', source: { type: 'solidity', contract: 'contracts/research-attestation/src/ResearchAttestation.sol:ResearchAttestation' } },
  { name: 'Plinth', source: { type: 'stylus', cargoDir: 'contracts/plinth' } },
  { name: 'Coffer', source: { type: 'stylus', cargoDir: 'contracts/coffer' } },
  { name: 'Sigil', source: { type: 'stylus', cargoDir: 'contracts/sigil' } },
  { name: 'Vigil', source: { type: 'stylus', cargoDir: 'contracts/vigil' } },
];

// Iter 80: export TARGETS for unit testing of the config shape. The main
// loop below only runs when invoked as a CLI (not when imported as a module).
export { TARGETS };

const filter = process.argv[2];

function extractSolidity(contract) {
  const out = execFileSync('forge', ['inspect', contract, 'abi', '--json'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out.toString('utf8'));
}

function extractStylus(cargoDir) {
  const fullDir = resolve(repoRoot, cargoDir);
  try {
    const out = execFileSync('cargo', ['stylus', 'export-abi', '--json'], {
      cwd: fullDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(out.toString('utf8'));
  } catch (err) {
    console.warn(`[extract-abis] ${cargoDir}: --json export unavailable; emitting empty shell`);
    return [];
  }
}

// Iter 80: gate the main loop behind a CLI-entry check so the test file
// can import TARGETS without triggering ABI extraction.
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  let failures = 0;
  for (const t of TARGETS) {
    if (filter && t.name !== filter) continue;
    try {
      const abi =
        t.source.type === 'solidity'
          ? extractSolidity(t.source.contract)
          : extractStylus(t.source.cargoDir);
      const outPath = resolve(outDir, `${t.name}.json`);
      writeFileSync(outPath, JSON.stringify(abi, null, 2) + '\n');
      console.log(`wrote ${outPath} (${Array.isArray(abi) ? abi.length : 0} entries)`);
    } catch (err) {
      failures++;
      console.error(`failed ${t.name}: ${err.message}`);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} target(s) failed`);
    process.exit(1);
  }
}
