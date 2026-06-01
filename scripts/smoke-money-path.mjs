#!/usr/bin/env node
/**
 * Live money-path smoke test against the deployed (post-cutover) contracts.
 *
 * Proves the fixed Coffer accepts a real USDC deposit on Arbitrum Sepolia:
 *   1. Faucet.claim()                 -> deployer gets 5 USDC + 0.0005 ETH
 *   2. USDC.approve(coffer, amount)   -> let the vault pull
 *   3. Coffer.deposit(amount, deployer) -> mint ERC-4626 shares
 *   4. read back totalAssets + share balance to confirm it landed
 *
 * Reuses the same encrypted-keystore handling as the cutover scripts, so the
 * private key never touches a shell arg or stdout. Re-runnable: skips claim if
 * the deployer is inside the 24h faucet cooldown and just deposits any balance.
 *
 * Usage: ATRIUM_KEYDIR=<your-key-dir> node scripts/smoke-money-path.mjs
 */
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createDecipheriv, scryptSync } from 'node:crypto';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEYDIR = process.env.ATRIUM_KEYDIR ?? join(homedir(), '.atrium');
const RPC = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
const CAST = process.env.CAST_BIN ?? 'cast';

const DEPLOYER = '0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42';
const USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';

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
  if (r.status !== 0) throw new Error(`cast ${args[0]} failed: ${(r.stderr ?? '').slice(-500)}`);
  return r.stdout.trim();
}

function call(target, sig, ...a) {
  return cast(['call', '--rpc-url', RPC, target, sig, ...a]);
}

function send(pk, target, sig, ...a) {
  const out = cast(['send', '--rpc-url', RPC, '--private-key', pk, '--json', target, sig, ...a]);
  try { return JSON.parse(out).transactionHash; } catch { return out.slice(0, 80); }
}

async function main() {
  const d = JSON.parse(await readFile(resolve(REPO, 'deployments/arbitrum_sepolia.json'), 'utf8')).contracts;
  const coffer = d.coffer.address;
  const faucet = d.faucet.address;
  const pk = await loadDeployerKey();

  console.log('## live money-path smoke (Arbitrum Sepolia)');
  console.log('coffer =', coffer, '\nfaucet =', faucet, '\nuser   =', DEPLOYER, '\n');

  // 1. claim if not in cooldown
  const cooldown = BigInt(call(faucet, 'cooldown()(uint64)').split(' ')[0]);
  const last = BigInt(call(faucet, 'lastClaim(address)(uint64)', DEPLOYER).split(' ')[0]);
  const chainNow = BigInt(cast(['block', 'latest', '--field', 'timestamp', '--rpc-url', RPC]));
  if (last === 0n || chainNow >= last + cooldown) {
    const tx = send(pk, faucet, 'claim()');
    console.log('1. Faucet.claim()           tx =', tx);
  } else {
    console.log('1. Faucet.claim()           SKIP (cooldown,', Number(last + cooldown - chainNow), 's left)');
  }

  // 2. approve + 3. deposit whatever USDC the user now holds
  const bal = BigInt(call(USDC, 'balanceOf(address)(uint256)', DEPLOYER).split(' ')[0]);
  if (bal === 0n) { console.log('no USDC to deposit, aborting'); return; }
  console.log('   user USDC balance        =', bal.toString(), '(', Number(bal) / 1e6, 'USDC )');

  const apTx = send(pk, USDC, 'approve(address,uint256)', coffer, bal.toString());
  console.log('2. USDC.approve(coffer)     tx =', apTx);

  const before = BigInt(call(coffer, 'totalAssets()(uint256)').split(' ')[0]);
  const depTx = send(pk, coffer, 'deposit(uint256,address)', bal.toString(), DEPLOYER);
  console.log('3. Coffer.deposit()         tx =', depTx);

  // 4. verify
  const after = BigInt(call(coffer, 'totalAssets()(uint256)').split(' ')[0]);
  const shares = BigInt(call(coffer, 'balanceOf(address)(uint256)', DEPLOYER).split(' ')[0]);
  console.log('\n## result');
  console.log('Coffer.totalAssets  ', before.toString(), '->', after.toString());
  console.log('user shares          =', shares.toString());
  console.log(after > before && shares > 0n ? '\nPASS: live deposit landed, shares minted.' : '\nFAIL: state did not move as expected.');
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
