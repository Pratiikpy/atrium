#!/usr/bin/env node
/**
 * Execute the 2026-05-30 cutover's timelock ops AFTER the 48h window.
 *
 * Reads .forge-cache/timelock-ops.json (written by redeploy-timelock-schedule.mjs),
 * refuses until every op's scheduledAt + 48h has elapsed, then calls
 * PraetorTimelock.execute(target, data, scheduledAt) in order (deregister
 * before register). Marks each executed so re-runs are safe.
 *
 * After this succeeds, run: node scripts/flip-cutover.mjs  (copies staged
 * registry over root+mirror), then redeploy verify-app + subgraph, then e2e.
 *
 * Usage: ATRIUM_KEYDIR=<your-key-dir> node scripts/redeploy-timelock-execute.mjs
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
const OPS_PATH = resolve(REPO, '.forge-cache/timelock-ops.json');
const CAST = process.env.CAST_BIN ?? 'cast';
const DELAY = 172800; // 48h

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
  const doc = JSON.parse(await readFile(OPS_PATH, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const notReady = doc.ops.filter((o) => now < Number(o.scheduledAt) + DELAY);
  if (notReady.length > 0) {
    const wait = Math.max(...notReady.map((o) => Number(o.scheduledAt) + DELAY - now));
    console.error(`Timelock not elapsed for ${notReady.length} op(s). Earliest executable in ~${Math.ceil(wait / 3600)}h. Aborting (no partial execute).`);
    process.exit(2);
  }
  const pk = await loadDeployerKey();
  for (const op of doc.ops) {
    if (op.executed) { console.log(`skip (already executed): ${op.label}`); continue; }
    console.log(`\n### execute ${op.label}\n  target=${op.target} scheduledAt=${op.scheduledAt}`);
    const out = cast(['send', '--rpc-url', RPC, '--private-key', pk, '--json', doc.timelock,
      'execute(address,bytes,uint64)', op.target, op.data, String(op.scheduledAt)]);
    op.executed = true;
    op.executeTx = JSON.parse(out).transactionHash;
    console.log(`  executed tx=${op.executeTx}`);
    await writeFile(OPS_PATH, JSON.stringify(doc, null, 2));
  }
  console.log('\nAll timelock ops executed. Next: node scripts/flip-cutover.mjs, then redeploy verify-app + subgraph, then run the money-path e2e.');
}

main().catch((e) => { console.error(`\nFATAL: ${e.message ?? e}`); process.exit(1); });
