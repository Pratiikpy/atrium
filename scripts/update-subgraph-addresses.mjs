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
  // We patch address + startBlock by anchoring on the unique `name: <Name>` line that's followed within a few
  // lines by `address:` and `startBlock:` lines. Per-name source blocks are unique so this is unambiguous.
  const blockPattern = new RegExp(
    `(name: ${name}\\n    network: [^\\n]+\\n    source:\\n      address: ")0x0+(")(\\n      abi: ${name}\\n      startBlock: )0(\\n)`,
    'g',
  );
  const replaced = yaml.replace(blockPattern, `$1${addr}$2$3${startBlock}$4`);
  if (replaced !== yaml) {
    yaml = replaced;
    updates += 1;
    console.log(`  ${name.padEnd(22)} ${addr}  block ${startBlock}`);
  } else {
    console.warn(`  ${name.padEnd(22)} no match, pattern drifted or already updated`);
  }
}

await writeFile(SUBGRAPH, yaml, 'utf8');
console.log(`updated ${updates} data sources in ${SUBGRAPH}`);
