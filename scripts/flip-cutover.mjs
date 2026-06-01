#!/usr/bin/env node
/**
 * Final flip of the 2026-05-30 cutover. Run ONLY after
 * redeploy-timelock-execute.mjs has executed all 6 ops.
 *
 * Copies the staged registry (new addresses) over the live root + verify-app
 * mirror. After this: redeploy verify-app (so the bundled mirror updates) +
 * the subgraph, then run the money-path e2e.
 */
import { readFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STAGED = resolve(REPO, 'deployments/arbitrum_sepolia.staged.json');
const ROOT = resolve(REPO, 'deployments/arbitrum_sepolia.json');
const MIRROR = resolve(REPO, 'apps/verify/public/deployments/arbitrum_sepolia.json');
const OPS = resolve(REPO, '.forge-cache/timelock-ops.json');

const doc = JSON.parse(await readFile(OPS, 'utf8'));
const pending = doc.ops.filter((o) => !o.executed);
if (pending.length > 0) {
  console.error(`Refusing to flip: ${pending.length} timelock op(s) not executed yet. Run redeploy-timelock-execute.mjs first.`);
  process.exit(2);
}
await copyFile(STAGED, ROOT);
await copyFile(STAGED, MIRROR);
console.log('Flipped: staged -> live root + mirror.');
console.log('coffer(live) =', JSON.parse(await readFile(ROOT, 'utf8')).contracts.coffer.address);
console.log('Next: redeploy verify-app + subgraph, then run the money-path e2e.');
