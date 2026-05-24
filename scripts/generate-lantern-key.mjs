#!/usr/bin/env node
/**
 * generate-lantern-key.mjs — one-shot Lantern signing-key bootstrap
 *
 * Generates a fresh secp256k1 key, encrypts it with a user-chosen passphrase
 * (AES-256-GCM keyed by scrypt — same envelope shape that services/lantern-
 * attestor/api/_signer.ts expects), and writes the envelope to a path
 * OUTSIDE the repo tree.
 *
 * The generator NEVER prints the plaintext private key. The plaintext lives
 * in memory only for the encryption call and is wiped immediately after.
 *
 * # Usage
 *
 *   node scripts/generate-lantern-key.mjs \
 *     --out ~/.atrium/lantern-key.json \
 *     --address-out ~/.atrium/lantern-key.address
 *
 *   # Prompts for a passphrase (input is hidden).
 *   # Writes the encrypted envelope to --out and the public ETH address
 *   # to --address-out so you can authorise it on-chain.
 *
 * # After running this
 *
 *  1. Take note of the printed ETH address.
 *  2. Authorise that address as the Lantern signing key on-chain — call
 *     LanternAttestor.setSigner(address) from the deployer wallet.
 *  3. Set the following env vars in Vercel:
 *       LANTERN_KEY_PATH       = /var/task/lantern-key.json (or wherever you upload it)
 *       LANTERN_KEY_PASSPHRASE = the passphrase you chose
 *  4. Make a Shamir 3-of-5 backup of the envelope file (offline, paper or
 *     hardware-storage; do NOT email/SaaS-sync it).
 *
 * # Why this generator and not OpenSSL one-liners
 *
 * The signer in _signer.ts enforces:
 *   - envelope shape (versioned JSON, not raw .pem)
 *   - scrypt parameters above an audit-required floor (N >= 2^17, r >= 8)
 *   - a path-not-in-repo check
 *
 * Hand-rolled OpenSSL output will not load. Use this script.
 */

import {
  randomBytes,
  scryptSync,
  createCipheriv,
} from 'node:crypto';
import { writeFile, mkdir, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, exit } from 'node:process';
import { createInterface } from 'node:readline';
import { privateKeyToAccount } from 'viem/accounts';

// Audit-floor scrypt parameters. Matches _signer.ts minima.
const SCRYPT_N = 1 << 17; // 131072
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;

function parseArgs() {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--out') args.out = argv[++i];
    else if (k === '--address-out') args.addressOut = argv[++i];
    else if (k === '--passphrase') args.passphrase = argv[++i];
    else if (k === '--help' || k === '-h') args.help = true;
  }
  return args;
}

function help() {
  console.log(`generate-lantern-key — bootstrap a Lantern attestation signer

required:
  --out PATH                where to write the encrypted envelope JSON

optional:
  --address-out PATH        also write the public ETH address here
  --passphrase TEXT         supply passphrase as a flag (skip prompt — CI use)
  -h, --help                this message
`);
}

async function promptPassphraseHidden() {
  return new Promise((resolveP, rejectP) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const stdout = process.stdout;
    stdout.write('Choose a passphrase (≥ 20 chars recommended): ');
    // Mute echo by intercepting _writeToOutput.
    const orig = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = (s) => {
      if (s.includes('\n')) orig?.(s);
    };
    rl.once('line', (one) => {
      rl._writeToOutput = orig;
      stdout.write('\nConfirm passphrase: ');
      rl._writeToOutput = (s) => {
        if (s.includes('\n')) orig?.(s);
      };
      rl.once('line', (two) => {
        rl.close();
        process.stdout.write('\n');
        if (one !== two) {
          rejectP(new Error('passphrases did not match'));
        } else if (one.length < 20) {
          rejectP(new Error('passphrase is shorter than 20 characters'));
        } else {
          resolveP(one);
        }
      });
    });
  });
}

async function main() {
  const args = parseArgs();
  if (args.help) return help();
  if (!args.out) {
    console.error('error: --out PATH is required');
    help();
    exit(2);
  }

  // Refuse to write inside the repo tree — same guard the signer enforces.
  const outAbs = resolve(args.out);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = await realpath(resolve(scriptDir, '..'));
  const outDir = await realpath(dirname(outAbs)).catch(() => null);
  if (outDir && outDir.startsWith(repoRoot)) {
    console.error(`error: --out (${outAbs}) is inside the repo tree (${repoRoot}). Choose a path outside, e.g. ~/.atrium/lantern-key.json`);
    exit(3);
  }

  // Acquire the passphrase.
  const passphrase = args.passphrase ?? (await promptPassphraseHidden());

  // Generate the secp256k1 key.
  const privateKey = randomBytes(KEY_LEN); // 32 bytes
  const privateKeyHex = ('0x' + privateKey.toString('hex'));
  const account = privateKeyToAccount(privateKeyHex);

  // Encrypt: AES-256-GCM keyed by scrypt(passphrase, salt).
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const derived = scryptSync(
    passphrase,
    salt,
    32,
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 256 * 1024 * 1024 }
  );
  const cipher = createCipheriv('aes-256-gcm', derived, iv);
  const ciphertext = Buffer.concat([cipher.update(privateKey), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Wipe plaintext fragments.
  privateKey.fill(0);
  derived.fill(0);

  const envelope = {
    version: 1,
    kdf: 'scrypt',
    scrypt_N: SCRYPT_N,
    scrypt_r: SCRYPT_R,
    scrypt_p: SCRYPT_P,
    salt_hex: salt.toString('hex'),
    iv_hex: iv.toString('hex'),
    auth_tag_hex: authTag.toString('hex'),
    ciphertext_hex: ciphertext.toString('hex'),
    public_address: account.address,
    created_at: new Date().toISOString(),
  };

  await mkdir(dirname(outAbs), { recursive: true });
  await writeFile(outAbs, JSON.stringify(envelope, null, 2) + '\n', { mode: 0o600 });
  if (args.addressOut) {
    await writeFile(resolve(args.addressOut), account.address + '\n', { mode: 0o600 });
  }

  console.log('');
  console.log(`encrypted envelope written: ${outAbs}`);
  console.log(`public ETH address:         ${account.address}`);
  console.log('');
  console.log('NEXT STEPS:');
  console.log(`  1) Authorise this address on LanternAttestor:`);
  console.log(`     cast send <LANTERN_ATTESTOR_ADDR> "setSigner(address)" ${account.address}`);
  console.log(`  2) Vercel env vars:`);
  console.log(`     LANTERN_KEY_PATH=${outAbs}    (or path inside your Vercel deploy)`);
  console.log(`     LANTERN_KEY_PASSPHRASE=<the passphrase you just typed>`);
  console.log(`  3) Shamir 3-of-5 backup the envelope file OFFLINE.`);
  console.log('');
}

main().catch((err) => {
  console.error(`generate-lantern-key: ${err.message}`);
  exit(1);
});
