#!/usr/bin/env node
/**
 * Solidity redeploy for the 2026-05-30 critical-fix pass.
 *
 * Deploys AtriumRouter + AaveHorizonAdapterV11 + AqueductReceiver via
 * `forge create` with explicit --constructor-args, wired to the freshly
 * redeployed Stylus Coffer/Plinth (read from the Stylus checkpoint).
 *
 * Why this exists: praetor-cli's forge_create passes NO --constructor-args,
 * so it cannot deploy these (all have required constructor args). This mirrors
 * redeploy-stylus.mjs's in-process key decrypt + log redaction so the deployer
 * key never lands in stdout / scrollback.
 *
 * Usage: ATRIUM_KEYDIR=C:/Users/prate/.atrium node scripts/redeploy-solidity.mjs
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
const CHECKPOINT_PATH = resolve(REPO_ROOT, '.forge-cache/stylus-redeploy-checkpoint.json');
const OUT_PATH = resolve(REPO_ROOT, '.forge-cache/solidity-redeploy.json');
const FORGE_BIN = process.env.FORGE_BIN ?? (process.platform === 'win32'
  ? 'C:/Users/prate/.foundry/bin/forge.exe'
  : 'forge');

// Known peers (Arbitrum Sepolia).
const REGISTRY = '0x9a9af6e50491cd4694699d48564bbff18f9b40bc';   // PorticoRegistry (unchanged)
const TIMELOCK = '0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4';   // PraetorTimelock
const USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';
const MOCK_AAVE_POOL = '0x2e1360faE80c7937e684067450202D921F72555B'; // live aave adapter's pool
const CCIP_ROUTER = '0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165';    // live receiver's router

async function loadDeployerKey() {
  const envelope = JSON.parse(await readFile(resolve(KEYDIR, 'lantern-key-deployer.json'), 'utf8'));
  const passphrase = (await readFile(resolve(KEYDIR, 'lantern-passphrase.txt'), 'utf8')).trim();
  if (envelope.kdf !== 'scrypt') throw new Error(`unsupported kdf ${envelope.kdf}`);
  const derivedKey = scryptSync(passphrase, Buffer.from(envelope.salt_hex, 'hex'), 32, {
    N: envelope.scrypt_N, r: envelope.scrypt_r, p: envelope.scrypt_p, maxmem: 256 * 1024 * 1024,
  });
  const decipher = createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(envelope.iv_hex, 'hex'));
  decipher.setAuthTag(Buffer.from(envelope.auth_tag_hex, 'hex'));
  const plain = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext_hex, 'hex')), decipher.final()]);
  const pk = '0x' + plain.toString('hex');
  derivedKey.fill(0); plain.fill(0);
  return { pk, address: envelope.public_address };
}

function redact(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    let v = args[i];
    if (typeof v === 'string') v = v.replace(/0x[0-9a-fA-F]{64}/g, '0x***REDACTED***');
    out.push(v);
    if (args[i] === '--private-key') { out[out.length - 1] = v; out.push('***REDACTED***'); i++; }
  }
  return out;
}

function forgeCreate(name, path, ctorArgs, pk) {
  const args = ['create', path, '--rpc-url', RPC, '--private-key', pk, '--broadcast',
    '--constructor-args', ...ctorArgs];
  console.log(`\n### ${name} ###\n$ forge ${redact(args).join(' ')}`);
  const r = spawnSync(FORGE_BIN, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (r.error) throw r.error;
  const out = (r.stdout ?? '') + '\n' + (r.stderr ?? '');
  if (r.status !== 0) throw new Error(`forge create ${name} failed:\n${out.slice(-1200)}`);
  const m = out.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);
  if (!m) throw new Error(`could not parse ${name} address:\n${out.slice(-1200)}`);
  const tx = out.match(/Transaction hash:\s*(0x[a-fA-F0-9]{64})/)?.[1] ?? null;
  console.log(`-> ${name}: ${m[1]}`);
  return { address: m[1], tx };
}

async function main() {
  const cp = JSON.parse(await readFile(CHECKPOINT_PATH, 'utf8'));
  const coffer = cp.coffer?.address;
  const plinth = cp.plinth?.address;
  if (!coffer || !plinth) throw new Error('coffer/plinth missing from Stylus checkpoint; run redeploy-stylus.mjs first');
  const { pk, address: deployer } = await loadDeployerKey();
  console.log(`Deployer: ${deployer}\nCoffer: ${coffer}\nPlinth: ${plinth}`);

  const out = existsSync(OUT_PATH) ? JSON.parse(await readFile(OUT_PATH, 'utf8')) : {};

  const plan = [
    ['atrium-router', 'contracts/atrium-router/src/AtriumRouter.sol:AtriumRouter',
      [plinth, coffer, REGISTRY, deployer, TIMELOCK]],
    ['adapter-aave-horizon', 'contracts/adapters/aave-horizon/src/AaveHorizonAdapterV11.sol:AaveHorizonAdapterV11',
      [MOCK_AAVE_POOL, USDC, coffer, deployer, TIMELOCK]],
    ['aqueduct-receiver', 'contracts/aqueduct/src/AqueductReceiver.sol:AqueductReceiver',
      [CCIP_ROUTER, USDC, coffer, deployer, TIMELOCK]],
  ];

  for (const [name, path, ctorArgs] of plan) {
    if (out[name]?.address) { console.log(`\n${name} already deployed: ${out[name].address}`); continue; }
    out[name] = { ...forgeCreate(name, path, ctorArgs, pk), deployed_at: new Date().toISOString() };
    await writeFile(OUT_PATH, JSON.stringify(out, null, 2));
  }

  console.log(`\nSolidity redeploy complete. Addresses: ${OUT_PATH}`);
  for (const [name] of plan) console.log(`  ${name}: ${out[name].address}`);
}

main().catch((err) => { console.error(`\nFATAL: ${err.message ?? err}`); process.exit(1); });
