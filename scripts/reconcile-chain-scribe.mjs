#!/usr/bin/env node
/**
 * QA_TEST_PLAN §12 / Gate B1: standing subgraph <-> chain reconciler.
 *
 * The cutover-drift class bit twice: a subgraph indexing address B while the app
 * points at A "looks live" and is silently wrong. check-scribe-health.mjs guards
 * block-lag (freshness); this guards VALUE + MANIFEST agreement:
 *
 *   1. Freshness: Scribe _meta.block within LAG of chain tip, no indexing errors.
 *   2. Lantern value: Scribe's latest LanternAttestation.root == on-chain
 *      latest_root (proves the indexer's data matches the contract, not just keeps
 *      up).
 *   3. Manifest integrity: EVERY address the subgraph manifest indexes is also
 *      present in deployments/arbitrum_sepolia.json AND the web-bundle mirror
 *      (apps/verify/public/deployments/...), and has non-empty on-chain code. A
 *      subgraph pointed at a dead/old address fails here.
 *
 * Exit non-zero on any drift so this can gate CI. Reads chain via `cast`.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const LAG = Number(process.env.RECONCILE_LAG_THRESHOLD ?? 250);
const RPC =
  (process.env.ARBITRUM_SEPOLIA_RPC_URL || process.env.ARBITRUM_SEPOLIA_RPC || '').trim();
const SCRIBE = (process.env.SCRIBE_URL || process.env.NEXT_PUBLIC_SCRIBE_URL || '').trim();
const LANTERN = '0xF0B90b94C0B8a52c545768bFf06a3932c67d5888';

if (!RPC || !SCRIBE) {
  console.log('RPC or SCRIBE_URL not set, skipping reconcile (set both to run).');
  process.exit(0);
}

const fails = [];
const ok = (m) => console.log(`PASS  ${m}`);
const bad = (m) => { console.error(`FAIL  ${m}`); fails.push(m); };

// execFile (no shell): args pass directly to cast, so hex addresses / RPC URL
// cannot inject shell metacharacters. RPC is appended as its own argument.
const cast = (args) =>
  execFileSync('cast', [...args, '--rpc-url', RPC], { encoding: 'utf8' }).trim();
async function scribe(query) {
  const r = await fetch(SCRIBE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

// 1. Freshness
const meta = await scribe('{ _meta { block { number } hasIndexingErrors } }');
const indexed = meta._meta.block.number;
const tip = Number(cast(['block-number']));
const lag = Math.max(0, tip - indexed);
if (meta._meta.hasIndexingErrors) bad('subgraph hasIndexingErrors=true');
else ok('subgraph hasIndexingErrors=false');
if (lag <= LAG) ok(`freshness: lag ${lag} <= ${LAG} (indexed ${indexed}, tip ${tip})`);
else bad(`freshness: lag ${lag} > ${LAG} (indexed ${indexed}, tip ${tip})`);

// 2. Lantern value reconciliation
try {
  const onchain = cast(['call', LANTERN, 'latest_root()(bytes32)']).toLowerCase();
  const d = await scribe(
    '{ lanternAttestations(first: 1, orderBy: blockNumber, orderDirection: desc) { root } }',
  );
  const scribeRoot = (d.lanternAttestations?.[0]?.root ?? '').toLowerCase();
  if (!scribeRoot) bad('Lantern: no attestation indexed in Scribe yet');
  else if (scribeRoot === onchain) ok(`Lantern root: Scribe == chain (${onchain.slice(0, 18)}...)`);
  else bad(`Lantern root drift: Scribe ${scribeRoot} != chain ${onchain}`);
} catch (e) {
  bad(`Lantern reconcile error: ${e.message}`);
}

// 3. Manifest integrity
const manifest = readFileSync('subgraph/subgraph.yaml', 'utf8');
const manifestAddrs = [...manifest.matchAll(/address:\s*"(0x[0-9a-fA-F]{40})"/g)].map((m) =>
  m[1].toLowerCase(),
);
const rootDeploy = readFileSync('deployments/arbitrum_sepolia.json', 'utf8').toLowerCase();
let webDeploy = '';
try {
  webDeploy = readFileSync('apps/verify/public/deployments/arbitrum_sepolia.json', 'utf8').toLowerCase();
} catch { /* web mirror optional */ }

const uniq = [...new Set(manifestAddrs)];
for (const a of uniq) {
  const inRoot = rootDeploy.includes(a);
  const inWeb = webDeploy ? webDeploy.includes(a) : true;
  const code = cast(['code', a]);
  const hasCode = code && code !== '0x';
  if (inRoot && inWeb && hasCode) ok(`manifest addr present + has code: ${a}`);
  else
    bad(
      `manifest addr ${a}: inRoot=${inRoot} inWeb=${inWeb} hasCode=${hasCode} (drift / dead address)`,
    );
}

console.log(`\n${uniq.length} indexed addresses checked.`);
if (fails.length) {
  console.error(`\nRECONCILE FAILED: ${fails.length} drift(s).`);
  process.exit(1);
}
console.log('\nRECONCILE OK: subgraph, chain, and deployment manifests agree.');
