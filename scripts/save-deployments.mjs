#!/usr/bin/env node
/**
 * Read forge broadcast log and write deployments/<network>.json in the
 * shape `apps/verify/src/lib/deployments-registry.ts` expects.
 *
 * Idempotent — merges with any existing registry; never overwrites a slug
 * that's already present unless the new entry has a non-zero address.
 *
 * Usage: node scripts/save-deployments.mjs <chainId>
 *        e.g. node scripts/save-deployments.mjs 421614
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const CHAIN_TO_NETWORK = {
  421614: 'arbitrum_sepolia',
  42161: 'arbitrum_one',
  11155111: 'ethereum_sepolia',
};

/**
 * Map Solidity contractName (PascalCase) to the kebab-case slug the UI
 * looks up. Keep this list aligned with the slugs in apps/verify.
 */
const NAME_TO_SLUG = {
  PraetorTimelock: 'praetor-timelock',
  PorticoRegistry: 'portico-registry',
  LanternAttestor: 'lantern-attestor',
  Curator: 'curator',
  Edict: 'edict',
  ResearchAttestation: 'research-attestation',
  StoaBlackScholes: 'stoa',
  Aqueduct: 'aqueduct',
  AqueductReceiver: 'aqueduct-receiver',
  AqueductClaimback: 'aqueduct-claimback',
  AtriumRouter: 'atrium-router',
  PosternKillSwitch: 'postern-kill-switch',
  PosternKeyRegistry: 'postern-key-registry',
  Rostrum: 'rostrum',
  Faucet: 'faucet',
  // Stylus contracts deployed via `cargo stylus deploy`, not forge — so the
  // mapping below isn't actually consumed by this script for them. Kept here
  // for documentation: every slug in deployments/*.json should appear here
  // so the verify-app's lookup never silently 404s.
  // coffer, sigil, vigil, plinth, plinth-math, plinth-oracle: written by
  // cargo-stylus deploy output, recorded manually after each Stylus deploy.
};

// Optional secondary mirror — the verify-app's static asset path. Keeping
// this in sync prevents the "frontend shows zeros while chain has the
// contract" footgun. See deployments-registry.ts audit U-40 comment.
const FRONTEND_MIRROR = ['apps', 'verify', 'public', 'deployments'];

const chainId = Number(process.argv[2] || 421614);
const network = CHAIN_TO_NETWORK[chainId];
if (!network) {
  console.error(`unknown chain id ${chainId}`);
  process.exit(1);
}

const REPO_ROOT = process.cwd();
const BROADCAST = join(REPO_ROOT, 'broadcast', 'Deploy.s.sol', String(chainId), 'run-latest.json');
const REGISTRY_DIR = join(REPO_ROOT, 'deployments');
const REGISTRY_FILE = join(REGISTRY_DIR, `${network}.json`);

if (!existsSync(BROADCAST)) {
  console.error(`broadcast file missing: ${BROADCAST}`);
  process.exit(1);
}

const broadcast = JSON.parse(await readFile(BROADCAST, 'utf8'));

// Build slug -> {address, tx, block} from broadcast.
const fresh = {};
for (const tx of broadcast.transactions ?? []) {
  if (tx.transactionType !== 'CREATE') continue;
  const slug = NAME_TO_SLUG[tx.contractName];
  if (!slug) {
    console.warn(`no slug mapping for contract ${tx.contractName}`);
    continue;
  }
  fresh[slug] = {
    address: tx.contractAddress,
    tx: tx.hash,
  };
}

// Receipts carry block numbers. Match by tx hash.
for (const r of broadcast.receipts ?? []) {
  const slug = Object.keys(fresh).find((k) => fresh[k].tx?.toLowerCase() === r.transactionHash?.toLowerCase());
  if (!slug) continue;
  fresh[slug].block = parseInt(r.blockNumber, 16);
}

// Merge with existing registry if present (idempotent).
let existing = { network, chainId, contracts: {} };
if (existsSync(REGISTRY_FILE)) {
  try {
    existing = JSON.parse(await readFile(REGISTRY_FILE, 'utf8'));
    existing.contracts ??= {};
  } catch {
    // bad JSON — overwrite
  }
}

const merged = {
  network,
  chainId,
  contracts: {
    ...existing.contracts,
    ...fresh,
  },
  lastUpdated: new Date().toISOString(),
};

await mkdir(REGISTRY_DIR, { recursive: true });
await writeFile(REGISTRY_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');

// Mirror to the frontend's static-asset path so the deployed verify-app
// stays in sync after each Forge broadcast.
const MIRROR_FILE = join(REPO_ROOT, ...FRONTEND_MIRROR, `${network}.json`);
if (existsSync(join(REPO_ROOT, ...FRONTEND_MIRROR))) {
  await writeFile(MIRROR_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`mirrored to ${MIRROR_FILE}`);
}

console.log(`wrote ${REGISTRY_FILE}`);
console.log(`contracts:`);
for (const [slug, entry] of Object.entries(merged.contracts)) {
  console.log(`  ${slug.padEnd(24)} ${entry.address}  block ${entry.block ?? '?'}`);
}
