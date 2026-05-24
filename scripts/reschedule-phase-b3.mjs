#!/usr/bin/env node
/**
 * Phase beta.3 corrected timelock-batch scheduler.
 *
 * Replaces script/PhaseB3-Schedule.s.sol which was missing the
 * Coffer.set_adapter() + adapter.setAuthorizedCaller() calls that
 * AtriumRouter needs to actually move user funds. The auditor's
 * finding (#335 + #337 in the 2026-05-24 sweep) was that every
 * router-mediated open_position would revert UnauthorizedCaller
 * because:
 *   - Coffer.set_adapter was never scheduled, so
 *     coffer.adapter_pull(...) rejects every adapter caller.
 *   - The 9 venue adapters never had setAuthorizedCaller(router, true)
 *     scheduled, so the adapter.open() entry point rejects the Router.
 *
 * This script schedules the full corrected batch:
 *   - 9x Coffer.set_adapter(adapter, true)
 *   - 9x <adapter>.setAuthorizedCaller(router, true)
 *   - 10x PorticoRegistry.registerAdapter(venue_id, adapter, codehash, 1)
 *   - 3x Aqueduct wiring (setAqueductOnDest, setAllowedSource, setClaimbackRegistry)
 *
 * Total: 31 scheduled actions, all executable T+48h after this run.
 *
 * Usage:
 *   ATRIUM_KEYDIR=/c/Users/prate/.atrium node scripts/reschedule-phase-b3.mjs
 *
 * Note: must run AFTER scripts/redeploy-stylus.mjs so deployments
 * registry has the new Coffer address.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDecipheriv, scryptSync } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const KEYDIR = process.env.ATRIUM_KEYDIR ?? 'C:/Users/prate/.atrium';
const RPC = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
const REGISTRY_PATH = resolve(REPO_ROOT, 'deployments/arbitrum_sepolia.json');
const SCHEDULE_PATH = resolve(REPO_ROOT, '.forge-cache/phase-b3-schedule-corrected.json');

const ETH_SEPOLIA_SELECTOR = '16015286601757825753'; // CCIP chain selector

// Adapter venue ids per script/PhaseB3-Schedule.s.sol — preserve the
// mapping the existing PorticoRegistry knows about.
const VENUES = [
  { id: 1, slug: 'adapter-hyperliquid', name: 'HL HIP-3' },
  { id: 2, slug: 'adapter-aave-horizon', name: 'Aave Horizon' },
  { id: 3, slug: 'adapter-pendle', name: 'Pendle V2' },
  { id: 4, slug: 'adapter-curve', name: 'Curve' },
  { id: 5, slug: 'adapter-trade-xyz', name: 'Trade.xyz' },
  { id: 6, slug: 'adapter-polymarket', name: 'Polymarket' },
  { id: 7, slug: 'adapter-hyperliquid', name: 'HL HIP-4' }, // same contract as id 1
  { id: 8, slug: 'adapter-gmx', name: 'GMX V2' },
  { id: 9, slug: 'adapter-synthetix', name: 'Synthetix V3' },
  { id: 10, slug: 'adapter-morpho', name: 'Morpho Blue' },
];

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
  const pk = '0x' + plain.toString('hex');
  derivedKey.fill(0);
  plain.fill(0);
  return { pk, address: envelope.public_address };
}

const CAST_BIN = process.env.CAST_BIN ?? (process.platform === 'win32'
  ? 'C:/Users/prate/.foundry/bin/cast.exe'
  : 'cast');

function cast(args, opts = {}) {
  console.log(`\n$ cast ${args.join(' ')}`);
  const r = spawnSync(CAST_BIN, args, {
    stdio: opts.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    env: process.env,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`cast exit ${r.status}: ${r.stderr ?? ''}`);
  return r;
}

async function main() {
  const { pk, address: deployer } = await loadDeployerKey();
  const registry = JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
  const get = (slug) => {
    const a = registry.contracts[slug]?.address;
    if (!a) throw new Error(`missing slug ${slug} in registry`);
    return a;
  };

  const timelock = get('praetor-timelock');
  const portico = get('portico-registry');
  const coffer = get('coffer');
  const router = get('atrium-router');
  const aqueduct = get('aqueduct');
  const aqueductReceiver = get('aqueduct-receiver');
  const aqueductClaimback = get('aqueduct-claimback');

  console.log(`Deployer:        ${deployer}`);
  console.log(`PraetorTimelock: ${timelock}`);
  console.log(`Coffer:          ${coffer}`);
  console.log(`AtriumRouter:    ${router}`);
  console.log(`PorticoRegistry: ${portico}`);

  const schedules = [];

  function scheduleAction(label, target, data) {
    const r = cast(
      ['send', '--rpc-url', RPC, '--private-key', pk, timelock,
       'schedule(address,bytes)(bytes32)', target, data],
      { captureOutput: true },
    );
    const txHashMatch = r.stdout.match(/transactionHash\s+(0x[a-fA-F0-9]{64})/);
    schedules.push({
      label,
      target,
      data,
      tx: txHashMatch?.[1] ?? null,
      scheduledAt: new Date().toISOString(),
    });
    console.log(`scheduled: ${label} (tx ${txHashMatch?.[1] ?? '?'})`);
  }

  // Block 1: Coffer.set_adapter(adapter, true) — auditor C-7 fix.
  // Use Stylus camelCase ABI (setAdapter, not set_adapter).
  for (const v of VENUES) {
    const adapter = get(v.slug);
    const data = cast(
      ['calldata', 'setAdapter(address,bool)', adapter, 'true'],
      { captureOutput: true },
    ).stdout.trim();
    scheduleAction(`Coffer.setAdapter(${v.name}, true)`, coffer, data);
  }

  // Block 2: <adapter>.setAuthorizedCaller(router, true) — auditor C-3 fix.
  // Each adapter exposes the same Solidity selector regardless of vendor.
  for (const v of VENUES) {
    const adapter = get(v.slug);
    const data = cast(
      ['calldata', 'setAuthorizedCaller(address,bool)', router, 'true'],
      { captureOutput: true },
    ).stdout.trim();
    scheduleAction(`${v.name}.setAuthorizedCaller(router, true)`, adapter, data);
  }

  // Block 3: PorticoRegistry.registerAdapter(venue_id, adapter, codehash, 1).
  for (const v of VENUES) {
    const adapter = get(v.slug);
    const codehashR = cast(['codesize', adapter, '--rpc-url', RPC], { captureOutput: true });
    // Use actual extcodehash via cast rpc.
    const ech = cast(['rpc', 'eth_getCode', adapter, 'latest', '--rpc-url', RPC], { captureOutput: true });
    // Derive keccak256 of code:
    const codeMatch = ech.stdout.trim().replace(/^"|"$/g, '');
    const codehash = cast(['keccak', codeMatch], { captureOutput: true }).stdout.trim();
    const data = cast(
      ['calldata', 'registerAdapter(uint8,address,bytes32,uint256)',
       String(v.id), adapter, codehash, '1'],
      { captureOutput: true },
    ).stdout.trim();
    scheduleAction(`PorticoRegistry.registerAdapter(${v.name})`, portico, data);
  }

  // Block 4: Aqueduct wiring — 3 actions per the original PhaseB3 list.
  const destData = cast(
    ['calldata', 'setAqueductOnDest(uint64,address)', ETH_SEPOLIA_SELECTOR, aqueductReceiver],
    { captureOutput: true },
  ).stdout.trim();
  scheduleAction('Aqueduct.setAqueductOnDest', aqueduct, destData);

  const srcData = cast(
    ['calldata', 'setAllowedSource(uint64,address)', ETH_SEPOLIA_SELECTOR, aqueduct],
    { captureOutput: true },
  ).stdout.trim();
  scheduleAction('AqueductReceiver.setAllowedSource', aqueductReceiver, srcData);

  const cbData = cast(
    ['calldata', 'setClaimbackRegistry(address)', aqueductClaimback],
    { captureOutput: true },
  ).stdout.trim();
  scheduleAction('Aqueduct.setClaimbackRegistry', aqueduct, cbData);

  // Persist the full batch for the matching execute script.
  const batch = {
    scheduledBy: deployer,
    scheduledAt: new Date().toISOString(),
    timelock,
    executableAfter: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    actions: schedules,
  };
  await writeFile(SCHEDULE_PATH, JSON.stringify(batch, null, 2));

  console.log(`\n=== ${schedules.length} actions scheduled. Persisted to ${SCHEDULE_PATH} ===`);
  console.log(`=== Execute on or after: ${batch.executableAfter} ===`);
}

main().catch((err) => {
  console.error(`FATAL: ${err.message ?? err}`);
  process.exit(1);
});
