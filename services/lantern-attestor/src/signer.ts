import { readFile } from 'node:fs/promises';
import { createDecipheriv, scryptSync } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Software signing key.
 *
 * On disk: AES-256-GCM ciphertext keyed by an scrypt-derived passphrase. The
 * scrypt parameters and the salt are stored alongside the ciphertext in a
 * versioned JSON envelope. The plaintext private key never touches disk.
 *
 * Backup: split 3-of-5 via Shamir (offline).
 *
 * Per TDD §13.3 — cloud HSM was rejected (no free tier).
 * Audit C-20 / F-7 fix: the Argon2 verify call was theatre; the key was
 * pulled raw from env. The plaintext-env path is removed. The signer now
 * actually decrypts.
 */
interface KeyEnvelope {
  version: 1;
  kdf: 'scrypt';
  scrypt_N: number;
  scrypt_r: number;
  scrypt_p: number;
  salt_hex: string;
  iv_hex: string;
  auth_tag_hex: string;
  ciphertext_hex: string;
}

// Audit I-9 fix: minimum scrypt parameters per `security.md` and OWASP 2025.
// A tampered envelope could otherwise set N=2^10 to make brute force trivial.
const MIN_SCRYPT_N = 1 << 17; // 131072
const MIN_SCRYPT_R = 8;
const MIN_SCRYPT_P = 1;

export async function loadSigningKey() {
  const path = process.env.LANTERN_KEY_PATH;
  const passphrase = process.env.LANTERN_KEY_PASSPHRASE;
  if (!path || !passphrase) {
    throw new Error('LANTERN_KEY_PATH and LANTERN_KEY_PASSPHRASE must be set');
  }
  // Audit I-9 fix: refuse to load a key envelope from inside the repo tree.
  // A misconfigured deploy with LANTERN_KEY_PATH=./local.key would otherwise
  // be one `git add .` away from leaking. realpath check catches symlinks.
  const realpath = await (await import('node:fs/promises')).realpath(path);
  const repoRoot = await (await import('node:fs/promises'))
    .realpath(new URL('../../..', import.meta.url).pathname)
    .catch(() => undefined);
  if (repoRoot && realpath.startsWith(repoRoot)) {
    throw new Error(`LANTERN_KEY_PATH (${realpath}) is inside the repo tree — refusing to load`);
  }

  const envelopeJson = await readFile(path, 'utf8');
  const envelope = JSON.parse(envelopeJson) as KeyEnvelope;
  if (envelope.version !== 1) throw new Error(`unsupported key envelope v${envelope.version}`);
  if (envelope.kdf !== 'scrypt') throw new Error(`unsupported kdf ${envelope.kdf}`);
  // Audit I-9 fix: enforce minimum scrypt parameters from the envelope.
  if (envelope.scrypt_N < MIN_SCRYPT_N) {
    throw new Error(`scrypt N=${envelope.scrypt_N} below minimum ${MIN_SCRYPT_N}`);
  }
  if (envelope.scrypt_r < MIN_SCRYPT_R) {
    throw new Error(`scrypt r=${envelope.scrypt_r} below minimum ${MIN_SCRYPT_R}`);
  }
  if (envelope.scrypt_p < MIN_SCRYPT_P) {
    throw new Error(`scrypt p=${envelope.scrypt_p} below minimum ${MIN_SCRYPT_P}`);
  }

  const salt = Buffer.from(envelope.salt_hex, 'hex');
  const iv = Buffer.from(envelope.iv_hex, 'hex');
  const authTag = Buffer.from(envelope.auth_tag_hex, 'hex');
  const ciphertext = Buffer.from(envelope.ciphertext_hex, 'hex');

  // Derive AES-256 key from the passphrase using scrypt with the envelope's params.
  const derivedKey = scryptSync(
    passphrase,
    salt,
    32,
    { N: envelope.scrypt_N, r: envelope.scrypt_r, p: envelope.scrypt_p, maxmem: 256 * 1024 * 1024 }
  );

  const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  let plain: Buffer;
  try {
    plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    // Authentication failed → wrong passphrase or tampered ciphertext.
    throw new Error('passphrase did not match or key file tampered');
  }
  const privateKeyHex = ('0x' + plain.toString('hex')) as `0x${string}`;
  // Wipe the derived key from memory best-effort.
  derivedKey.fill(0);
  plain.fill(0);
  return privateKeyToAccount(privateKeyHex);
}
