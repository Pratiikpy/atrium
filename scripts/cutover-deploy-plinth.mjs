// Cutover: deploy the new Plinth (-> new fixed Sigil) via the atrium-stylus
// docker image (cargo-stylus 0.10.7 has #[constructor] support; local 0.5.11
// does not). Mirrors scripts/redeploy-stylus.mjs cargoStylus(). 2026-06-04.
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// read deployer key from .env
const env = Object.fromEntries(readFileSync(resolve(REPO, '.env'), 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const KEY = env.DEPLOYER_PRIVATE_KEY || env.PRIVATE_KEY || env.ARBITRUM_DEPLOYER_KEY;
const RPC = env.ARBITRUM_SEPOLIA_RPC_URL || env.ARBITRUM_SEPOLIA_RPC || 'https://arbitrum-sepolia.publicnode.com';
if (!KEY) throw new Error('no deployer key in .env');

const A = {
  coffer: '0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3',
  vigil: '0x5ccd3422f430f6d034ff46715b41509de9d0deed',
  sigil: '0x3b58b39579dbbf4fcab5e2a3331812dc86b1f193', // NEW fixed Sigil
  registry: '0x9a9af6e50491cd4694699d48564bbff18f9b40bc',
  chainlink: '0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165',
  pyth: '0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF',
  praetor: '0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42',
  timelock: '0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4',
  math: '0xc53dbfc0c35291f79e7d8d876603ab35ab97ddab',
  oracle: '0x66064d18722f50e055d74daf51a13fd8e331f0b7',
};
const ctor = [A.coffer, A.vigil, A.sigil, A.registry, A.chainlink, A.pyth, A.praetor, A.timelock, A.math, A.oracle];

const inner = `cargo stylus deploy --endpoint ${RPC} --private-key ${KEY} --no-verify --max-fee-per-gas-gwei 0.2 --constructor-args ${ctor.join(' ')}`;
const args = ['run', '--rm', '-v', `${REPO}:/workspace`, '-w', '/workspace/contracts/plinth', 'atrium-stylus', 'bash', '-c', inner];
console.log('docker run ... atrium-stylus cargo stylus deploy (Plinth -> new Sigil', A.sigil + ')');
const r = spawnSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const out = (r.stdout || '') + '\n' + (r.stderr || '');
const clean = out.replace(/\x1b\[[0-9;]*m/g, '');
process.stdout.write(clean.split('\n').filter((l) => /error|deployed code at|activated|tx hash|constructor|Caused by|fragment/i.test(l)).slice(-12).join('\n') + '\n');
const m = clean.match(/deployed code at address[:\s]*(0x[a-fA-F0-9]{40})/i);
console.log('\nNEW LIVE PLINTH:', m ? m[1] : '(deploy did not report an address; see output above)');
