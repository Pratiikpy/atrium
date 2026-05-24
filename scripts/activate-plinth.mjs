#!/usr/bin/env node
/**
 * One-off: re-run `cargo stylus activate` on the new Plinth address.
 *
 * The 2026-05-24 multi-fragment deploy of Plinth at
 * 0xef31b4b75badc0faf323e3448248585b57a78ecd left only 48 bytes of
 * runtime bytecode at the address. Sigil + Vigil + Coffer (same
 * cargo-stylus 0.10.7, same image, single-fragment) landed full
 * 19-24KB bytecode and logged an explicit "successfully activated"
 * line; Plinth did not. Either activation is needed as a separate
 * step for multi-fragment, or the activation tx silently failed.
 *
 * This script decrypts the deployer key envelope (reusing the same
 * AES-GCM + scrypt path as scripts/redeploy-stylus.mjs and runs the
 * activation explicitly with `cargo stylus activate`. Redacts the
 * private key in stdout to avoid the 2026-05-24 leak pattern.
 */
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDecipheriv, scryptSync } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const KEYDIR = process.env.ATRIUM_KEYDIR ?? 'C:/Users/prate/.atrium';
const RPC = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
const PLINTH = process.argv[2] ?? '0xef31b4b75badc0faf323e3448248585b57a78ecd';
const DOCKER_IMAGE = 'atrium-stylus';

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

function redact(s) {
  return s.replace(/(--private-key(?:-path)?[\s=])(0x[0-9a-fA-F]+|\S+)/g, '$1***REDACTED***')
          .replace(/0x[0-9a-fA-F]{64}/g, '0x***REDACTED***');
}

async function main() {
  const pk = await loadDeployerKey();
  const cmd = 'docker';
  const args = [
    'run', '--rm',
    '-v', `${REPO_ROOT}:/workspace`,
    '-w', '/workspace/contracts/plinth',
    DOCKER_IMAGE,
    'bash', '-c',
    `cargo stylus activate --address ${PLINTH} --endpoint ${RPC} --private-key ${pk} --max-fee-per-gas-gwei 0.1`,
  ];
  console.log(`\n$ ${cmd} ${args.map((a, i) => i === args.length - 1 ? redact(a) : a).join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    console.error(`activate exit ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
