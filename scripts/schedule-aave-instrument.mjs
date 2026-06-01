#!/usr/bin/env node
/**
 * Schedule the two venue-2 (Aave Horizon, USDC-LEND) instrument-config ops on
 * the NEW post-cutover contracts. The 2026-05-30 critical-fix redeploy swapped
 * in a new Plinth + Aave adapter that carry the fixes but not the venue-2
 * instrument config (that was set on the OLD contracts). Both setters are
 * onlyTimelock, so they go through the 48h PraetorTimelock here.
 *
 * Params are identical to the already-decided #429 config (verified live: both
 * ops eth_call-simulate clean from the timelock before scheduling).
 *
 *   1. Plinth.setInstrumentRisk(2, USDC-LEND, haircut 100bps, class 1, pyth, mockCL, active)
 *   2. AaveAdapter.addInstrument(USDC-LEND, haircut 100, im 500, mm 200)
 *
 * Records (target, calldata, scheduledAt) to .forge-cache/aave-instrument-ops.json
 * so an execute pass can recompute each id after scheduledAt + 48h.
 *
 * Usage: ATRIUM_KEYDIR=<your-key-dir> node scripts/schedule-aave-instrument.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createDecipheriv, scryptSync } from 'node:crypto';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEYDIR = process.env.ATRIUM_KEYDIR ?? join(homedir(), '.atrium');
const RPC = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
const OUT_PATH = resolve(REPO, '.forge-cache/aave-instrument-ops.json');
const CAST = process.env.CAST_BIN ?? 'cast';

const TIMELOCK = '0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4';
const PLINTH = '0xd86f579ec880eaab27dfa698ae056d1893ec7553';   // new post-cutover Plinth
const AAVE = '0xd71C5D88d62e92EE8941cAE51f8637a73111C4E1';     // new post-cutover Aave adapter
const IID = '0x128570b155efd3ba4fae8e482ebd851f483ef0bd8056503fc4e12ffd3e6ceedc'; // USDC-LEND
const PYTH = '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a'; // Pyth USDC/USD
const MOCKCL = '0x5D5e0996954114b70848587D7A7b49dEeA9c5D44';   // always-fresh $1.00 Chainlink stub

const OPS = [
  ['plinth.setInstrumentRisk(2,USDC-LEND)', PLINTH, 'setInstrumentRisk(uint8,bytes32,uint16,uint16,bytes32,address,bool)', ['2', IID, '100', '1', PYTH, MOCKCL, 'true']],
  ['aave.addInstrument(USDC-LEND)', AAVE, 'addInstrument(bytes32,uint16,uint16,uint16)', [IID, '100', '500', '200']],
];

async function loadDeployerKey() {
  const e = JSON.parse(await readFile(resolve(KEYDIR, 'lantern-key-deployer.json'), 'utf8'));
  const pass = (await readFile(resolve(KEYDIR, 'lantern-passphrase.txt'), 'utf8')).trim();
  const dk = scryptSync(pass, Buffer.from(e.salt_hex, 'hex'), 32, { N: e.scrypt_N, r: e.scrypt_r, p: e.scrypt_p, maxmem: 256 * 1024 * 1024 });
  const d = createDecipheriv('aes-256-gcm', dk, Buffer.from(e.iv_hex, 'hex'));
  d.setAuthTag(Buffer.from(e.auth_tag_hex, 'hex'));
  const plain = Buffer.concat([d.update(Buffer.from(e.ciphertext_hex, 'hex')), d.final()]);
  const pk = '0x' + plain.toString('hex'); dk.fill(0); plain.fill(0);
  return pk;
}

function cast(args) {
  const r = spawnSync(CAST, args, { encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`cast ${args[0]} failed: ${(r.stderr ?? '').slice(-600)}`);
  return r.stdout.trim();
}

async function main() {
  const pk = await loadDeployerKey();
  const out = [];
  for (const [label, target, sig, args] of OPS) {
    const data = cast(['calldata', sig, ...args]);
    // already-scheduled guard: id = keccak(abi.encode(target, data, scheduledAt)) is
    // time-dependent, so just attempt; schedule reverts AlreadyScheduled if dup.
    console.log(`\n### schedule ${label}\n  target=${target}\n  data=${data.slice(0, 26)}...`);
    const rcptJson = cast(['send', '--rpc-url', RPC, '--private-key', pk, '--json', TIMELOCK, 'schedule(address,bytes)', target, data]);
    const rcpt = JSON.parse(rcptJson);
    const scheduledAt = cast(['block', String(rcpt.blockNumber), '--field', 'timestamp', '--rpc-url', RPC]);
    console.log(`  tx=${rcpt.transactionHash} scheduledAt=${scheduledAt} executable=${Number(scheduledAt) + 172800}`);
    out.push({ label, target, data, scheduledAt, tx: rcpt.transactionHash });
    await writeFile(OUT_PATH, JSON.stringify({ timelock: TIMELOCK, delaySeconds: 172800, ops: out }, null, 2));
  }
  console.log(`\nScheduled ${out.length} ops. Executable after scheduledAt + 48h. Recorded: ${OUT_PATH}`);
}

main().catch((e) => { console.error(`\nFATAL: ${e.message ?? e}`); process.exit(1); });
