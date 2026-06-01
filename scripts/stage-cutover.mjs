#!/usr/bin/env node
/**
 * D6 of the 2026-05-30 cutover (cutover style a):
 *  - Build deployments/arbitrum_sepolia.staged.json = old registry + the 7 new
 *    addresses. This is what gets copied over root+mirror AFTER the 6 timelock
 *    ops execute (~48h).
 *  - Restore the live root + verify-app mirror to the OLD addresses (from the
 *    D1 backup) so the app stays consistent on current contracts until the flip.
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(REPO, 'deployments/arbitrum_sepolia.json');
const MIRROR = resolve(REPO, 'apps/verify/public/deployments/arbitrum_sepolia.json');
const STAMP = '20260530-170322';
const ROOT_BAK = `${ROOT}.${STAMP}.bak`;
const MIRROR_BAK = `${MIRROR}.${STAMP}.bak`;
const STAGED = resolve(REPO, 'deployments/arbitrum_sepolia.staged.json');

const NEW = {
  coffer: '0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3',
  sigil: '0xdba97d39ff790e69c3526bb0c0b99a38f686d6d9',
  vigil: '0x5ccd3422f430f6d034ff46715b41509de9d0deed',
  plinth: '0xd86f579ec880eaab27dfa698ae056d1893ec7553',
  'atrium-router': '0xF593e012196BDe8A58Ccdbf685f7A74fD3bD35e0',
  'adapter-aave-horizon': '0xd71C5D88d62e92EE8941cAE51f8637a73111C4E1',
  'aqueduct-receiver': '0x49Bd2AF2d2ee1844235bb6500Ba4EC6F24704b42',
};

const base = JSON.parse(await readFile(ROOT_BAK, 'utf8'));
for (const [k, address] of Object.entries(NEW)) {
  base.contracts[k] = { ...base.contracts[k], address, note: '2026-05-30 critical-fix redeploy. STAGED: live only after the 6 timelock ops execute (~48h) + this file is copied over root+mirror.' };
}
base.lastUpdated = new Date().toISOString();
base._staged = 'Staged for the 2026-05-30 cutover. Root+mirror stay on OLD addresses until the timelock ops in .forge-cache/timelock-ops.json execute, then copy this over root+mirror and redeploy verify-app + subgraph.';
await writeFile(STAGED, JSON.stringify(base, null, 2) + '\n');

await copyFile(ROOT_BAK, ROOT);
await copyFile(MIRROR_BAK, MIRROR);

console.log(`staged -> ${STAGED}`);
console.log('live root + mirror restored to OLD (cutover a).');
console.log('coffer(live) =', JSON.parse(await readFile(ROOT, 'utf8')).contracts.coffer.address);
console.log('coffer(staged) =', JSON.parse(await readFile(STAGED, 'utf8')).contracts.coffer.address);
