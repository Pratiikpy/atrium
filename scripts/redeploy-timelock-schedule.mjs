#!/usr/bin/env node
/**
 * Schedule the 2026-05-30 cutover's 48h-timelock ops (deployer EOA = multisig).
 *
 * Every cross-wiring + registration on the new contracts is onlyTimelock, so
 * they are scheduled here (starts the 48h clock) and executed by
 * redeploy-timelock-execute.mjs on/after schedule_timestamp + 48h.
 *
 * Records each op's (target, calldata, scheduledAt) to .forge-cache/timelock-ops.json
 * so execute() can recompute the exact id.
 *
 * Usage: ATRIUM_KEYDIR=<your-key-dir> node scripts/redeploy-timelock-schedule.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createDecipheriv, scryptSync } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const KEYDIR = process.env.ATRIUM_KEYDIR ?? join(homedir(), '.atrium');
const RPC = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
const OUT_PATH = resolve(REPO_ROOT, '.forge-cache/timelock-ops.json');
const CAST = process.env.CAST_BIN ?? 'cast';

const TIMELOCK = '0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4';
const COFFER = '0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3';
const ROUTER = '0xF593e012196BDe8A58Ccdbf685f7A74fD3bD35e0';
const AAVE = '0xd71C5D88d62e92EE8941cAE51f8637a73111C4E1';
const RECEIVER = '0x49Bd2AF2d2ee1844235bb6500Ba4EC6F24704b42';
const PORTICO = '0x9a9af6e50491cd4694699d48564bbff18f9b40bc';
const AQUEDUCT = '0x6139449bf43f44385d08640b2e6fd2b82cb87ec2';
const AAVE_CODEHASH = '0x42cf8f1d639275fed98e0ed8df029ec9e836c0d9c77e116199b3a9ab1961b4d5';
const SEL = '16015286601757825753';   // ETH Sepolia CCIP selector
const CAP = '100000000000';           // 100k USDC per-block orchestrator cap

// Execute order matters: deregister(2) before register(2).
const OPS = [
  ['coffer.setAdapter(router)', COFFER, 'setAdapter(address,bool,uint256)', [ROUTER, 'true', CAP]],
  ['aave.setAuthorizedCaller(router)', AAVE, 'setAuthorizedCaller(address,bool)', [ROUTER, 'true']],
  ['portico.deregisterAdapter(2)', PORTICO, 'deregisterAdapter(uint8)', ['2']],
  ['portico.registerAdapter(2,newAave)', PORTICO, 'registerAdapter(uint8,address,bytes32,uint256)', ['2', AAVE, AAVE_CODEHASH, '1']],
  ['aqueduct.setAqueductOnDest(receiver)', AQUEDUCT, 'setAqueductOnDest(uint64,address)', [SEL, RECEIVER]],
  ['receiver.setAllowedSource(aqueduct)', RECEIVER, 'setAllowedSource(uint64,address)', [SEL, AQUEDUCT]],
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
    console.log(`\n### schedule ${label}\n  target=${target}\n  data=${data.slice(0, 26)}...`);
    const rcptJson = cast(['send', '--rpc-url', RPC, '--private-key', pk, '--json', TIMELOCK, 'schedule(address,bytes)', target, data]);
    const rcpt = JSON.parse(rcptJson);
    const blockNum = rcpt.blockNumber;
    const scheduledAt = cast(['block', String(blockNum), '--field', 'timestamp', '--rpc-url', RPC]);
    console.log(`  tx=${rcpt.transactionHash} block=${blockNum} scheduledAt=${scheduledAt}`);
    out.push({ label, target, data, scheduledAt, tx: rcpt.transactionHash });
    await writeFile(OUT_PATH, JSON.stringify({ timelock: TIMELOCK, delaySeconds: 172800, ops: out }, null, 2));
  }
  console.log(`\nScheduled ${out.length} ops. Executable after scheduledAt + 48h.`);
  console.log(`Recorded: ${OUT_PATH}`);
}

main().catch((e) => { console.error(`\nFATAL: ${e.message ?? e}`); process.exit(1); });
