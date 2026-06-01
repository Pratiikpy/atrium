#!/usr/bin/env node
/**
 * scripts/generate-deployment-doc.mjs
 * Generates docs/deployment.md from deployments/arbitrum_sepolia.json.
 * Run: node scripts/generate-deployment-doc.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const registry = JSON.parse(readFileSync(resolve(root, 'deployments/arbitrum_sepolia.json'), 'utf8'));

const ARBISCAN = 'https://sepolia.arbiscan.io';

function status(entry) {
  if (entry.note && /deprecated/i.test(entry.note)) return '🔴 deprecated';
  if (entry.block || entry.deployed_at) return '🟢 live';
  return '🟡 pending';
}

function sourcifyLink(entry, name) {
  if (!entry.address) return '-';
  // Stylus WASM contracts are not yet supported by Sourcify
  if (/^(plinth|coffer|sigil|vigil|plinth-math|plinth-oracle)$/.test(name)) {
    return '⚠️ Stylus';
  }
  return `[✓](https://sourcify.dev/#/lookup/${entry.address}?chainId=421614)`;
}

function categorize(name) {
  if (/^(plinth|coffer|sigil|vigil|plinth-math|plinth-oracle)$/.test(name)) return 'Stylus contracts';
  if (/^adapter-/.test(name)) return 'Portico adapters';
  if (/^aqueduct/.test(name)) return 'Aqueduct family';
  if (/^postern/.test(name)) return 'Postern family';
  if (/^(lantern|mock-aave)/.test(name)) return 'Lantern + test infrastructure';
  if (/^faucet/.test(name)) return 'Faucet + utility';
  return 'Solidity core';
}

const categories = {};
for (const [name, entry] of Object.entries(registry.contracts)) {
  const cat = categorize(name);
  if (!categories[cat]) categories[cat] = [];
  categories[cat].push({ name, ...entry });
}

const lines = [];
lines.push('# Deployment registry, Arbitrum Sepolia');
lines.push('');
lines.push('> This file is generated from `deployments/arbitrum_sepolia.json` by `scripts/generate-deployment-doc.mjs`. Do not edit by hand.');
lines.push('');
lines.push(`| Field | Value |`);
lines.push(`|-------|-------|`);
lines.push(`| Network | Arbitrum Sepolia |`);
lines.push(`| Chain ID | ${registry.chainId} |`);
lines.push(`| RPC | \`https://arbitrum-sepolia.publicnode.com\` |`);
lines.push(`| Last updated | ${registry.lastUpdated} |`);
lines.push('');

const ORDER = ['Stylus contracts', 'Solidity core', 'Portico adapters', 'Aqueduct family', 'Postern family', 'Lantern + test infrastructure', 'Faucet + utility'];

for (const cat of ORDER) {
  const entries = categories[cat];
  if (!entries || entries.length === 0) continue;
  lines.push(`## ${cat}`);
  lines.push('');
  lines.push('| Name | Address | Tx | Block | Kind | Version | Status | Sourcify | Notes |');
  lines.push('|------|---------|-----|-------|------|---------|--------|----------|-------|');
  for (const e of entries) {
    const addr = e.address ? `[\`${e.address.slice(0, 10)}…\`](${ARBISCAN}/address/${e.address})` : '-';
    const tx = e.tx ? `[\`${e.tx.slice(0, 10)}…\`](${ARBISCAN}/tx/${e.tx})` : '-';
    const block = e.block ?? '-';
    const kind = e.kind ?? '-';
    const version = e.version ?? '-';
    const st = status(e);
    const srcfy = sourcifyLink(e, e.name);
    const note = (e.note || '').replace(/\|/g, '·').slice(0, 80) + ((e.note || '').length > 80 ? '…' : '');
    lines.push(`| ${e.name} | ${addr} | ${tx} | ${block} | ${kind} | ${version} | ${st} | ${srcfy} | ${note} |`);
  }
  lines.push('');
}

lines.push('---');
lines.push('');
lines.push('### Sourcify verification');
lines.push('');
lines.push('Solidity contracts are verified on [Sourcify](https://sourcify.dev) (full match). Stylus WASM contracts (Plinth, Coffer, Sigil, Vigil, Plinth-Math, Plinth-Oracle) are not yet supported by Sourcify, verification is done via `cargo stylus verify` against the Arbitrum Stylus verifier.');
lines.push('');
lines.push('---');
lines.push('');
lines.push(`Generated at ${new Date().toISOString().slice(0, 19)}Z from \`deployments/arbitrum_sepolia.json\`.`);

writeFileSync(resolve(root, 'docs/deployment.md'), lines.join('\n'), 'utf8');
console.log('✓ docs/deployment.md regenerated');
