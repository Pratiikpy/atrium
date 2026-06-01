#!/usr/bin/env node
/**
 * Phase beta.2 Stylus redeploy automation.
 *
 * Redeploys Coffer / Sigil / Vigil / Plinth via cargo-stylus 0.10.7 in the
 * `atrium-stylus` docker image, then calls initialize() on the three that
 * need it. Writes new addresses + tx hashes to deployments/arbitrum_sepolia.json
 * and the verify-app mirror.
 *
 * Order (resolves the circular dep):
 *   1. Deploy Coffer (no constructor args)
 *   2. Deploy Sigil (no constructor args)
 *   3. Deploy Vigil (no constructor args)
 *   4. Deploy Plinth with constructor args wiring 1-3 plus oracle/timelock peers
 *   5. initialize() Coffer with USDC + new Plinth
 *   6. initialize() Sigil with new Plinth + erc8004/postern
 *   7. initialize() Vigil with new Plinth + new Coffer
 *
 * Halts on first failure. Records partial state to a checkpoint file so a
 * re-run can resume from the failed step.
 *
 * Usage:
 *   ATRIUM_KEYDIR=/c/Users/prate/.atrium node scripts/redeploy-stylus.mjs [contracts...]
 *
 * Args (optional): subset of {coffer, sigil, vigil, plinth, init-coffer,
 *   init-sigil, init-vigil}. Default: all in order.
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
const MIRROR_PATH = resolve(REPO_ROOT, 'apps/verify/public/deployments/arbitrum_sepolia.json');
const CHECKPOINT_PATH = resolve(REPO_ROOT, '.forge-cache/stylus-redeploy-checkpoint.json');
const DOCKER_IMAGE = 'atrium-stylus';
const MAX_FEE_GWEI = '0.1';

// =============================================================================
// Decrypt deployer key
// =============================================================================
async function loadDeployerKey() {
  const envelopePath = resolve(KEYDIR, 'lantern-key-deployer.json');
  const passphrasePath = resolve(KEYDIR, 'lantern-passphrase.txt');
  const envelope = JSON.parse(await readFile(envelopePath, 'utf8'));
  const passphrase = (await readFile(passphrasePath, 'utf8')).trim();
  if (envelope.kdf !== 'scrypt') throw new Error(`unsupported kdf ${envelope.kdf}`);
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

// =============================================================================
// Registry helpers
// =============================================================================
async function loadRegistry() {
  return JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
}

async function saveRegistry(reg) {
  const json = JSON.stringify(reg, null, 2) + '\n';
  await writeFile(REGISTRY_PATH, json);
  if (existsSync(dirname(MIRROR_PATH))) {
    await writeFile(MIRROR_PATH, json);
  }
}

async function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_PATH)) return {};
  return JSON.parse(await readFile(CHECKPOINT_PATH, 'utf8'));
}

async function saveCheckpoint(cp) {
  await writeFile(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

// =============================================================================
// Shell helpers
// =============================================================================
function redact(args) {
  // Strip any arg following --private-key or --private-key-path so the
  // deployer EOA's key never leaks to stdout / log files / scrollback.
  // Also scans inside concatenated `bash -c "..."` strings, since the
  // docker wrapper passes the entire cargo-stylus invocation as one arg.
  const out = [];
  for (let i = 0; i < args.length; i++) {
    let v = args[i];
    if (typeof v === 'string') {
      v = v.replace(/(--private-key(?:-path)?[\s=])(0x[0-9a-fA-F]+|\S+)/g, '$1***REDACTED***');
      // Last-resort: any 64-hex-chars token preceded by 0x.
      v = v.replace(/0x[0-9a-fA-F]{64}/g, '0x***REDACTED***');
    }
    out.push(v);
    if (args[i] === '--private-key' || args[i] === '--private-key-path') {
      out.push('***REDACTED***');
      i++; // skip the actual key value
    }
  }
  return out;
}

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${redact(args).join(' ')}`);
  const result = spawnSync(cmd, args, {
    stdio: opts.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...opts.env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (opts.captureOutput) {
      process.stderr.write(result.stderr ?? '');
    }
    throw new Error(`exit ${result.status}`);
  }
  return result;
}

function cargoStylus(contractDir, args, env = {}) {
  // Mount repo + map docker `bash -c` to avoid `bash -lc` PATH issue.
  return run('docker', [
    'run', '--rm',
    '-v', `${REPO_ROOT}:/workspace`,
    '-w', `/workspace/${contractDir}`,
    ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    DOCKER_IMAGE,
    'bash', '-c', `cargo stylus ${args.join(' ')}`,
  ], { captureOutput: true });
}

const CAST_BIN = process.env.CAST_BIN ?? (process.platform === 'win32'
  ? 'C:/Users/prate/.foundry/bin/cast.exe'
  : 'cast');

function castSend(to, sig, args, pk) {
  const cmd = ['send', '--rpc-url', RPC, '--private-key', pk, to, sig, ...args];
  return run(CAST_BIN, cmd, { captureOutput: true });
}

// =============================================================================
// Deploy + init steps
// =============================================================================
const STEPS = ['coffer', 'sigil', 'vigil', 'plinth', 'init-coffer', 'init-sigil', 'init-vigil'];

async function deployStylusNoConstructor(name, contractDir, pk) {
  console.log(`\n### Deploying ${name} ###`);
  const result = cargoStylus(contractDir, [
    'deploy',
    '--endpoint', RPC,
    '--private-key', pk,
    '--no-verify',
    '--max-fee-per-gas-gwei', MAX_FEE_GWEI,
  ]);
  process.stdout.write(result.stdout);
  // Combine stdout + stderr (cargo-stylus 0.10 logs to stderr via tracing).
  const combined = (result.stdout ?? '') + '\n' + (result.stderr ?? '');
  // Strip ANSI color codes that the tracing logger leaves in the stream.
  // eslint-disable-next-line no-control-regex
  const clean = combined.replace(/\x1b\[[0-9;]*m/g, '');
  // 0.10 format: "deployed code at address: 0x..."
  // 0.5  format: "deployed contract: 0x..." / "deployed to: 0x..."
  const addrMatch = clean.match(/deployed (?:code at address|contract|to)\s*:?\s*(0x[a-fA-F0-9]{40})/i)
    ?? clean.match(/contract address\s*:?\s*(0x[a-fA-F0-9]{40})/i);
  if (!addrMatch) {
    throw new Error(`failed to parse deployed address from output:\n${clean.slice(-1500)}`);
  }
  const address = addrMatch[1];
  console.log(`-> ${name}: ${address}`);
  const txMatch = clean.match(/(?:deployment tx hash|tx hash|deployment tx)\s*:?\s*(0x[a-fA-F0-9]{64})/i);
  return { address, tx: txMatch?.[1] ?? null };
}

async function deployStylusCtor(name, contractDir, ctorArgs, pk) {
  console.log(`\n### Deploying ${name} (constructor) ###`);
  const result = cargoStylus(contractDir, [
    'deploy',
    '--endpoint', RPC,
    '--private-key', pk,
    '--no-verify',
    '--max-fee-per-gas-gwei', MAX_FEE_GWEI,
    '--constructor-args', ...ctorArgs.map(String),
  ]);
  process.stdout.write(result.stdout);
  const combined = (result.stdout ?? '') + '\n' + (result.stderr ?? '');
  // eslint-disable-next-line no-control-regex
  const clean = combined.replace(/\x1b\[[0-9;]*m/g, '');
  const addrMatch = clean.match(/deployed (?:code at address|contract|to)\s*:?\s*(0x[a-fA-F0-9]{40})/i)
    ?? clean.match(/contract address\s*:?\s*(0x[a-fA-F0-9]{40})/i);
  if (!addrMatch) throw new Error(`failed to parse ${name} address from output:\n${clean.slice(-1500)}`);
  console.log(`-> ${name}: ${addrMatch[1]}`);
  const txMatch = clean.match(/(?:deployment tx hash|tx hash|deployment tx)\s*:?\s*(0x[a-fA-F0-9]{64})/i);
  return { address: addrMatch[1], tx: txMatch?.[1] ?? null };
}

async function deployPlinth(coffer, sigil, vigil, plinthMath, plinthOracle, registry, pk, deployer) {
  console.log(`\n### Deploying Plinth (constructor + multi-fragment factory) ###`);
  // Arbitrum Sepolia well-known oracle addresses per DEPLOY_PLAN.md.
  // Sepolia Pyth runs the mainnet-equity relay (see TDD §13.2 + the
  // 2026-05-24 tripwire on Pyth Sepolia equity-feed status).
  const CHAINLINK_ETH_USD_SEPOLIA = '0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165';
  const PYTH_SEPOLIA = '0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF';
  const args = [
    coffer, vigil, sigil,
    registry['portico-registry'].address,
    registry['chainlink-eth-usd-oracle']?.address ?? CHAINLINK_ETH_USD_SEPOLIA,
    registry['pyth-oracle']?.address ?? PYTH_SEPOLIA,
    deployer,
    registry['praetor-timelock'].address,
    plinthMath,
    plinthOracle,
  ];
  const result = cargoStylus('contracts/plinth', [
    'deploy',
    '--endpoint', RPC,
    '--private-key', pk,
    '--no-verify',
    '--max-fee-per-gas-gwei', MAX_FEE_GWEI,
    '--constructor-args', ...args,
  ]);
  process.stdout.write(result.stdout);
  const combined = (result.stdout ?? '') + '\n' + (result.stderr ?? '');
  // eslint-disable-next-line no-control-regex
  const clean = combined.replace(/\x1b\[[0-9;]*m/g, '');
  const addrMatch = clean.match(/deployed (?:code at address|contract|to)\s*:?\s*(0x[a-fA-F0-9]{40})/i)
    ?? clean.match(/contract address\s*:?\s*(0x[a-fA-F0-9]{40})/i);
  if (!addrMatch) throw new Error(`failed to parse Plinth address from output:\n${clean.slice(-1500)}`);
  const txMatch = clean.match(/(?:deployment tx hash|tx hash|deployment tx)\s*:?\s*(0x[a-fA-F0-9]{64})/i);
  return { address: addrMatch[1], tx: txMatch?.[1] ?? null };
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  const stepsArg = process.argv.slice(2);
  const stepsToRun = stepsArg.length > 0 ? stepsArg : STEPS;
  const invalid = stepsToRun.filter((s) => !STEPS.includes(s));
  if (invalid.length > 0) {
    throw new Error(`unknown steps: ${invalid.join(', ')}\nvalid: ${STEPS.join(', ')}`);
  }

  console.log(`Atrium Stylus redeploy starting`);
  console.log(`Steps: ${stepsToRun.join(', ')}`);
  console.log(`RPC: ${RPC}`);
  console.log(`Image: ${DOCKER_IMAGE}`);

  const { pk, address: deployer } = await loadDeployerKey();
  console.log(`Deployer: ${deployer}`);

  const registry = await loadRegistry();
  const checkpoint = await loadCheckpoint();

  // Pre-flight: confirm USDC address known.
  const usdc = registry.contracts['usdc']?.address ?? '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';
  console.log(`USDC: ${usdc}`);
  const ZERO = '0x0000000000000000000000000000000000000000';
  const timelock = registry.contracts['praetor-timelock'].address;
  const portico = registry.contracts['portico-registry'].address;
  // Year-1 testnet caps: 100k USDC global, 5k USDC per user.
  const depositCap = (100_000n * 10n ** 6n).toString();
  const perUserCap = (5_000n * 10n ** 6n).toString();

  // Step 1: Coffer — #[constructor](asset, plinth, praetor, timelock, deposit_cap, per_user_cap).
  // Plinth is deployed AFTER Coffer (circular dep), so pass the zero placeholder
  // and wire the real Plinth via set_plinth() once it exists (see Step 5).
  if (stepsToRun.includes('coffer') && !checkpoint.coffer?.address) {
    const { address, tx } = await deployStylusCtor('coffer', 'contracts/coffer',
      [usdc, ZERO, deployer, timelock, depositCap, perUserCap], pk);
    checkpoint.coffer = { address, tx, deployed_at: new Date().toISOString() };
    await saveCheckpoint(checkpoint);
  } else if (checkpoint.coffer?.address) {
    console.log(`\ncoffer already deployed in checkpoint: ${checkpoint.coffer.address}`);
  }

  // Step 2: Sigil — still initialize()-based (no #[constructor]); deploy no-arg.
  if (stepsToRun.includes('sigil') && !checkpoint.sigil?.address) {
    const { address, tx } = await deployStylusNoConstructor('sigil', 'contracts/sigil', pk);
    checkpoint.sigil = { address, tx, deployed_at: new Date().toISOString() };
    await saveCheckpoint(checkpoint);
  } else if (checkpoint.sigil?.address) {
    console.log(`\nsigil already deployed in checkpoint: ${checkpoint.sigil.address}`);
  }

  // Step 3: Vigil — #[constructor](plinth, coffer, portico, praetor, timelock).
  // Coffer is already deployed above; plinth is the zero placeholder (set_plinth in Step 7).
  if (stepsToRun.includes('vigil') && !checkpoint.vigil?.address) {
    const cofferAddr = checkpoint.coffer?.address ?? registry.contracts.coffer.address;
    const { address, tx } = await deployStylusCtor('vigil', 'contracts/vigil',
      [ZERO, cofferAddr, portico, deployer, timelock], pk);
    checkpoint.vigil = { address, tx, deployed_at: new Date().toISOString() };
    await saveCheckpoint(checkpoint);
  } else if (checkpoint.vigil?.address) {
    console.log(`\nvigil already deployed in checkpoint: ${checkpoint.vigil.address}`);
  }

  // Step 4: deploy Plinth with new Coffer/Sigil/Vigil addresses.
  if (stepsToRun.includes('plinth')) {
    if (checkpoint.plinth?.address) {
      console.log(`\nplinth already deployed in checkpoint: ${checkpoint.plinth.address}`);
    } else {
      const cofferAddr = checkpoint.coffer?.address ?? registry.contracts.coffer.address;
      const sigilAddr = checkpoint.sigil?.address ?? registry.contracts.sigil.address;
      const vigilAddr = checkpoint.vigil?.address ?? registry.contracts.vigil.address;
      const plinthMath = registry.contracts['plinth-math'].address;
      const plinthOracle = registry.contracts['plinth-oracle'].address;
      const { address, tx } = await deployPlinth(
        cofferAddr, sigilAddr, vigilAddr, plinthMath, plinthOracle,
        registry.contracts, pk, deployer,
      );
      checkpoint.plinth = { address, tx, deployed_at: new Date().toISOString() };
      await saveCheckpoint(checkpoint);
    }
  }

  // Steps 5-7: wire Plinth into the #[constructor] peers via the one-time
  // set_plinth() (they were constructed with a zero plinth to break the
  // coffer<->plinth cycle), and initialize() the still-initialize-based Sigil.
  const plinthAddr = checkpoint.plinth?.address ?? registry.contracts.plinth.address;

  if (stepsToRun.includes('init-coffer') && !checkpoint.coffer?.wired) {
    const cofferAddr = checkpoint.coffer?.address ?? registry.contracts.coffer.address;
    console.log(`\n### set_plinth Coffer @ ${cofferAddr} -> ${plinthAddr} ###`);
    castSend(cofferAddr, 'setPlinth(address)', [plinthAddr], pk);
    checkpoint.coffer.wired = true;
    await saveCheckpoint(checkpoint);
  }

  if (stepsToRun.includes('init-sigil') && !checkpoint.sigil?.initialized) {
    const sigilAddr = checkpoint.sigil?.address ?? registry.contracts.sigil.address;
    // initialize(praetor, praetor_timelock, plinth, erc8004_registry, postern_kill_switch)
    const erc8004 = registry.contracts['erc8004-registry']?.address ?? ZERO;
    const postern = registry.contracts['postern-kill-switch']?.address ?? ZERO;
    console.log(`\n### initialize Sigil @ ${sigilAddr} ###`);
    castSend(sigilAddr, 'initialize(address,address,address,address,address)', [
      deployer, timelock, plinthAddr, erc8004, postern,
    ], pk);
    checkpoint.sigil.initialized = true;
    await saveCheckpoint(checkpoint);
  }

  if (stepsToRun.includes('init-vigil') && !checkpoint.vigil?.wired) {
    const vigilAddr = checkpoint.vigil?.address ?? registry.contracts.vigil.address;
    console.log(`\n### set_plinth Vigil @ ${vigilAddr} -> ${plinthAddr} ###`);
    castSend(vigilAddr, 'setPlinth(address)', [plinthAddr], pk);
    checkpoint.vigil.wired = true;
    await saveCheckpoint(checkpoint);
  }

  // Commit checkpoint into registry on success.
  console.log(`\n### Writing new addresses into deployments registry ###`);
  for (const name of ['coffer', 'sigil', 'vigil', 'plinth']) {
    if (checkpoint[name]?.address) {
      registry.contracts[name] = {
        ...registry.contracts[name],
        address: checkpoint[name].address,
        tx: checkpoint[name].tx ?? registry.contracts[name].tx,
        deployed_at: checkpoint[name].deployed_at,
        note: `Redeployed 2026-05-30 (18 confirmed-critical fix pass). coffer/vigil use #[constructor] + a one-time praetor-gated set_plinth() to break the coffer<->plinth construct cycle; sigil still initialize()-based; plinth via multi-fragment factory (cargo-stylus 0.10.7).`,
      };
    }
  }
  await saveRegistry(registry);

  console.log(`\nAll requested steps complete.`);
  console.log(`Checkpoint: ${CHECKPOINT_PATH}`);
  console.log(`Registry:   ${REGISTRY_PATH}`);
}

main().catch((err) => {
  console.error(`\nFATAL: ${err.message ?? err}`);
  process.exit(1);
});
