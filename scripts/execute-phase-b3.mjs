#!/usr/bin/env node
/**
 * Phase beta.5 timelock executor.
 *
 * Reads `.forge-cache/phase-b3-schedule-corrected.json` (written by
 * scripts/reschedule-phase-b3.mjs) and calls
 * `PraetorTimelock.execute(target, data, scheduled_timestamp)` for each
 * action. The scheduled_timestamp is recovered from the block timestamp
 * of the schedule tx (per PraetorTimelock.schedule which uses
 * block.timestamp as the id-deriving salt).
 *
 * Safe to re-run; PraetorTimelock rejects double-execution with
 * AlreadyExecuted, which this script catches and skips.
 *
 * Usage:
 *   ATRIUM_KEYDIR=/c/Users/prate/.atrium node scripts/execute-phase-b3.mjs
 *
 * Run on or after the executableAfter timestamp in the schedule json.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDecipheriv, scryptSync } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const KEYDIR = process.env.ATRIUM_KEYDIR ?? 'C:/Users/prate/.atrium';
const RPC = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
const SCHEDULE_PATH = resolve(REPO_ROOT, '.forge-cache/phase-b3-schedule-corrected.json');
const EXECUTED_PATH = resolve(REPO_ROOT, '.forge-cache/phase-b3-executed.json');
const CAST_BIN = process.env.CAST_BIN ?? (process.platform === 'win32'
  ? 'C:/Users/prate/.foundry/bin/cast.exe'
  : 'cast');

async function loadDeployerKey() {
  const envelope = JSON.parse(await readFile(resolve(KEYDIR, 'lantern-key-deployer.json'), 'utf8'));
  const passphrase = (await readFile(resolve(KEYDIR, 'lantern-passphrase.txt'), 'utf8')).trim();
  const salt = Buffer.from(envelope.salt_hex, 'hex');
  const iv = Buffer.from(envelope.iv_hex, 'hex');
  const authTag = Buffer.from(envelope.auth_tag_hex, 'hex');
  const ciphertext = Buffer.from(envelope.ciphertext_hex, 'hex');
  const derivedKey = scryptSync(passphrase, salt, 32, {
    N: envelope.scrypt_N, r: envelope.scrypt_r, p: envelope.scrypt_p,
    maxmem: 256 * 1024 * 1024,
  });
  const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return '0x' + plain.toString('hex');
}

// Synchronous backoff between sends — the deployer EOA is shared with the
// Lantern cron, so a cron tick can bump the nonce mid-batch.
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function redact(s) {
  return s.replace(/(--private-key(?:-path)?[\s=])(0x[0-9a-fA-F]+|\S+)/g, '$1***REDACTED***')
          .replace(/0x[0-9a-fA-F]{64}/g, '0x***REDACTED***');
}

function cast(args, opts = {}) {
  const pretty = args.map(redact).join(' ');
  console.log(`\n$ cast ${pretty}`);
  const r = spawnSync(CAST_BIN, args, {
    stdio: opts.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    env: process.env,
  });
  if (r.error) throw r.error;
  return r;
}

async function rpcCall(method, params) {
  const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
  const res = await fetch(RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function main() {
  const schedule = JSON.parse(await readFile(SCHEDULE_PATH, 'utf8'));
  const nowMs = Date.now();
  const executableAfter = new Date(schedule.executableAfter).getTime();
  if (nowMs < executableAfter) {
    const waitH = Math.ceil((executableAfter - nowMs) / 3600 / 1000);
    console.warn(`Timelock window opens in ~${waitH}h (executableAfter=${schedule.executableAfter}). Continuing anyway; PraetorTimelock will revert TimelockNotExpired on early calls.`);
  }

  const pk = await loadDeployerKey();
  const timelock = schedule.timelock;
  const executed = [];

  for (const [i, action] of schedule.actions.entries()) {
    console.log(`\n[${i + 1}/${schedule.actions.length}] ${action.label}`);
    // Look up block timestamp of the schedule tx.
    const receipt = await rpcCall('eth_getTransactionReceipt', [action.tx]);
    if (!receipt || receipt.status !== '0x1') {
      console.error(`  skip: schedule tx not confirmed or reverted (status ${receipt?.status})`);
      continue;
    }
    const block = await rpcCall('eth_getBlockByNumber', [receipt.blockNumber, false]);
    const scheduledTs = parseInt(block.timestamp, 16);
    console.log(`  schedule tx block ${parseInt(receipt.blockNumber, 16)} ts ${scheduledTs}`);

    let r;
    for (let attempt = 1; attempt <= 6; attempt++) {
      r = cast([
        'send', '--rpc-url', RPC, '--private-key', pk, timelock,
        'execute(address,bytes,uint64)', action.target, action.data, String(scheduledTs),
      ], { captureOutput: true });
      if (r.status === 0) break;
      const errText = (r.stderr ?? '') + (r.stdout ?? '');
      if (/nonce too low|already known|replacement transaction underpriced/i.test(errText) && attempt < 6) {
        console.log(`  nonce clash (attempt ${attempt}/6); retrying in 5s...`);
        sleepSync(5000);
        continue;
      }
      break; // success, non-nonce error, or last attempt — handled below
    }
    if (r.status !== 0) {
      const stderr = r.stderr ?? '';
      if (/AlreadyExecuted/i.test(stderr)) {
        console.log(`  already executed, skipping`);
        executed.push({ ...action, executedAt: 'previously', skipped: true });
        continue;
      }
      if (/TimelockNotExpired/i.test(stderr)) {
        console.error(`  timelock window not yet open; halting batch`);
        break;
      }
      console.error(`  execute failed: ${stderr.slice(0, 300)}`);
      executed.push({ ...action, executedAt: null, failure: stderr.slice(0, 300) });
      continue;
    }
    const txHashMatch = (r.stdout ?? '').match(/transactionHash\s+(0x[a-fA-F0-9]{64})/);
    executed.push({
      ...action,
      executeTx: txHashMatch?.[1] ?? null,
      executedAt: new Date().toISOString(),
    });
    console.log(`  executed ok (tx ${txHashMatch?.[1] ?? '?'})`);
  }

  await writeFile(EXECUTED_PATH, JSON.stringify({
    executedBy: schedule.scheduledBy,
    executedAt: new Date().toISOString(),
    actions: executed,
  }, null, 2));

  const succeeded = executed.filter((a) => a.executeTx).length;
  const skipped = executed.filter((a) => a.skipped).length;
  const failed = executed.filter((a) => a.failure).length;
  console.log(`\n=== Phase beta.5 execute summary ===`);
  console.log(`succeeded: ${succeeded}`);
  console.log(`skipped (already-executed): ${skipped}`);
  console.log(`failed:    ${failed}`);
  console.log(`persisted: ${EXECUTED_PATH}`);
}

main().catch((err) => { console.error(`FATAL: ${err.message ?? err}`); process.exit(1); });
