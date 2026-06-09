#!/usr/bin/env node
/**
 * Update subgraph/subgraph.yaml with deployed contract addresses + startBlocks
 * from deployments/<network>.json. Idempotent, only touches data sources
 * whose contract slug is present in the deployments registry.
 *
 * Data sources for not-yet-deployed contracts (Stylus suite) stay at
 * 0x0000…0000 with startBlock 0. The subgraph treats them as inactive,
 * which is the correct honest behaviour.
 *
 * Usage: node scripts/update-subgraph-addresses.mjs [<network>]
 *        (defaults to arbitrum_sepolia)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const network = process.argv[2] ?? 'arbitrum_sepolia';

const REPO_ROOT = process.cwd();
const REGISTRY = join(REPO_ROOT, 'deployments', `${network}.json`);
const SUBGRAPH = join(REPO_ROOT, 'subgraph', 'subgraph.yaml');

// Subgraph data source names → registry slug
const NAME_TO_SLUG = {
  Plinth: 'plinth',
  Vigil: 'vigil',
  Coffer: 'coffer',
  Sigil: 'sigil',
  Aqueduct: 'aqueduct',
  ResearchAttestation: 'research-attestation',
  Edict: 'edict',
  PorticoRegistry: 'portico-registry',
  PraetorTimelock: 'praetor-timelock',
  PosternKillSwitch: 'postern-kill-switch',
  PosternKeyRegistry: 'postern-key-registry',
  LanternAttestor: 'lantern-attestor',
  Rostrum: 'rostrum',
  AtriumRouter: 'atrium-router',
  Curator: 'curator',
};

const registry = JSON.parse(await readFile(REGISTRY, 'utf8'));
const contracts = registry.contracts ?? {};
let yaml = await readFile(SUBGRAPH, 'utf8');

let updates = 0;
for (const [name, slug] of Object.entries(NAME_TO_SLUG)) {
  const entry = contracts[slug];
  if (!entry?.address) continue;
  const addr = entry.address.toLowerCase();
  const startBlock = entry.block ?? 0;

  // Match: name: <Name>\n    network: ...\n    source:\n      address: "0x..."\n      abi: <Name>\n      startBlock: <N>
  // Patch both placeholder and already-nonzero addresses. Pre-fix this only
  // matched 0x000... entries, so a cutover could leave Scribe indexing an old
  // nonzero address forever.
  const blockPattern = new RegExp(
    `(name: ${name}\\n    network: [^\\n]+\\n    source:\\n      address: ")0x[0-9a-fA-F]{40}(")(\\n      abi: ${name}\\n      startBlock: )\\d+(\\n)`,
    'g',
  );
  let matched = false;
  let changed = false;
  const replaced = yaml.replace(
    blockPattern,
    (full, beforeAddress, _oldAddressClose, beforeBlock, afterBlock) => {
      matched = true;
      const next = `${beforeAddress}${addr}"${beforeBlock}${startBlock}${afterBlock}`;
      changed = changed || next !== full;
      return next;
    },
  );
  if (changed) {
    yaml = replaced;
    updates += 1;
    console.log(`  ${name.padEnd(22)} ${addr}  block ${startBlock}`);
  } else if (matched) {
    console.log(`  ${name.padEnd(22)} already current`);
  } else {
    console.warn(`  ${name.padEnd(22)} no match, pattern drifted`);
  }
}

await writeFile(SUBGRAPH, yaml, 'utf8');
console.log(`updated ${updates} data sources in ${SUBGRAPH}`);
