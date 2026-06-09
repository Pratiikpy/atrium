#!/usr/bin/env node
/**
 * Idempotent local-env setup for Atrium.
 *
 * Fills the gitignored `.env` (scripts/services) and `apps/verify/.env.local`
 * (the Next app) with:
 *   - Group A: freshly generated internal secrets (session + internal + cron),
 *     written once and shared across both files so cross-service auth matches.
 *   - Group B: public, known values (RPCs, token + contract addresses, URLs)
 *     read from deployments/arbitrum_sepolia.json where possible.
 *   - Provided third-party secrets passed via the runtime env (NEVER hardcoded
 *     here, so this script is safe to commit): SETUP_ETHERSCAN_KEY,
 *     SETUP_UPSTASH_URL, SETUP_UPSTASH_TOKEN.
 *
 * Upsert rule: a key with a non-empty value is left untouched; an absent key or
 * an empty `KEY=` is filled. A small force-set (SCRIBE_URL) is always updated
 * so a stale subgraph version cannot linger.
 *
 * Prints only key names + their source (generated/provided/public/skipped),
 * never values. Re-runnable.
 *
 * Usage (PowerShell):
 *   $env:SETUP_ETHERSCAN_KEY="..."; $env:SETUP_UPSTASH_URL="..."; \
 *   $env:SETUP_UPSTASH_TOKEN="..."; node scripts/setup-local-env.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_ENV = resolve(REPO, '.env');
const APP_ENV = resolve(REPO, 'apps/verify/.env.local');
const gen = () => randomBytes(32).toString('hex');

// --- Group A: generated once, identical in both files (cross-service auth) ---
const A = {
  ATRIUM_INTERNAL_KEY: gen(),
  NOTIFIER_INTERNAL_KEY: gen(),
  CRON_SECRET: gen(),
  ATRIUM_SESSION_SECRET: gen(),
};

// --- Provided third-party secrets (from runtime env, never hardcoded) ---
const ETHERSCAN = (process.env.SETUP_ETHERSCAN_KEY ?? '').trim();
const UPSTASH_URL = (process.env.SETUP_UPSTASH_URL ?? '').trim();
const UPSTASH_TOKEN = (process.env.SETUP_UPSTASH_TOKEN ?? '').trim();

// --- Group B: public, known values ---
const USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';
const DEPLOYER = '0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42';
const ARB_RPC = 'https://arbitrum-sepolia.publicnode.com';
const RH_RPC = 'https://rpc.testnet.chain.robinhood.com';
const SCRIBE = 'https://api.studio.thegraph.com/query/1753863/atrium-arbitrum-sepolia/v0.0.15';
const SITE = 'https://useatrium.me';
const RH_USDC = '0x67713074650Ad05c832C781101Ac447Cb847522E';
const LINK_ARB = '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E'; // Chainlink LINK, Arb Sepolia

// EDICT + existing deployer key, read from on-disk artifacts at runtime
let EDICT = '';
try {
  const dep = JSON.parse(await readFile(resolve(REPO, 'deployments/arbitrum_sepolia.json'), 'utf8')).contracts;
  EDICT = dep?.edict?.address ?? dep?.['edict']?.address ?? '';
} catch { /* leave empty */ }

async function readEnv(path) {
  try { return await readFile(path, 'utf8'); } catch { return ''; }
}
function currentValue(content, key) {
  const m = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}
function upsert(content, key, value, { force = false } = {}) {
  if (value === '' || value == null) return { content, status: 'skip-empty' };
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) {
    const cur = currentValue(content, key);
    if (!force && cur !== '') return { content, status: 'kept' };
    return { content: content.replace(re, `${key}=${value}`), status: force ? 'forced' : 'filled' };
  }
  return { content: content.replace(/\s*$/, '') + `\n${key}=${value}\n`, status: 'added' };
}

async function apply(path, pairs) {
  let content = await readEnv(path);
  const deployerKey = currentValue(content, 'DEPLOYER_PRIVATE_KEY') ?? '';
  const log = [];
  for (const [key, value, opts] of pairs) {
    const v = value === '__DEPLOYER_KEY__' ? deployerKey : value;
    const r = upsert(content, key, v, opts);
    content = r.content;
    log.push(`  ${r.status.padEnd(10)} ${key}`);
  }
  await writeFile(path, content);
  return log;
}

// --- root .env (scripts + services) ---
const ROOT = [
  ['ARBISCAN_API_KEY', ETHERSCAN], ['ETHERSCAN_API_KEY', ETHERSCAN],
  ['ARBITRUM_SEPOLIA_RPC', ARB_RPC], ['RH_CHAIN_RPC', RH_RPC],
  ['UPSTASH_REDIS_REST_URL', UPSTASH_URL], ['UPSTASH_REDIS_REST_TOKEN', UPSTASH_TOKEN],
  ['ATRIUM_KV_REST_URL', UPSTASH_URL], ['ATRIUM_KV_REST_TOKEN', UPSTASH_TOKEN],
  ['ATRIUM_INTERNAL_KEY', A.ATRIUM_INTERNAL_KEY], ['NOTIFIER_INTERNAL_KEY', A.NOTIFIER_INTERNAL_KEY],
  ['CRON_SECRET', A.CRON_SECRET], ['ATRIUM_SESSION_SECRET', A.ATRIUM_SESSION_SECRET],
  ['SCRIBE_URL', SCRIBE, { force: true }], ['NEXT_PUBLIC_SCRIBE_URL', SCRIBE, { force: true }],
  ['NEXT_PUBLIC_USDC_ADDRESS', USDC], ['CODEX_USDC_ADDRESS', USDC],
  ['CODEX_PAY_TO_ADDRESS', DEPLOYER], ['CODEX_MIN_PAYMENT_USDC_WEI', '1000000'],
  ['EDICT_CONTRACT_ADDR', EDICT], ['DEMO_WALLET_ADDRESS', DEPLOYER],
  ['PRAETOR_MULTISIG_ADDRESS', DEPLOYER], ['PRAETOR_MULTISIG_KEY', '__DEPLOYER_KEY__'],
  ['CHAOS_PRIVATE_KEY', '__DEPLOYER_KEY__'],
  ['AGENT_AUGUR_ADDRESS', DEPLOYER], ['AGENT_HARUSPEX_ADDRESS', DEPLOYER], ['AGENT_AUSPEX_ADDRESS', DEPLOYER],
  ['NOTIFIER_FROM_BLOCK', '0'],
];

// --- apps/verify/.env.local (the Next app) ---
const APP = [
  ['NEXT_PUBLIC_SCRIBE_URL', SCRIBE, { force: true }], ['SCRIBE_URL', SCRIBE, { force: true }],
  ['NEXT_PUBLIC_USDC_ADDRESS', USDC],
  ['NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC', ARB_RPC], ['ARBITRUM_SEPOLIA_RPC', ARB_RPC],
  ['RH_CHAIN_RPC', RH_RPC], ['RH_CHAIN_USDC', RH_USDC], ['ARB_SEPOLIA_LINK', LINK_ARB],
  ['NEXT_PUBLIC_SITE_URL', SITE],
  ['UPSTASH_REDIS_REST_URL', UPSTASH_URL], ['UPSTASH_REDIS_REST_TOKEN', UPSTASH_TOKEN],
  ['ATRIUM_KV_REST_URL', UPSTASH_URL], ['ATRIUM_KV_REST_TOKEN', UPSTASH_TOKEN],
  ['NEXT_PUBLIC_SENTRY_DSN', process.env.SETUP_SENTRY_DSN ?? ''],
  ['SENTRY_DSN', process.env.SETUP_SENTRY_DSN ?? ''],
  ['SENTRY_ORG', 'amityonline'], ['SENTRY_PROJECT', 'atrium-verify'], ['SENTRY_ENVIRONMENT', 'development'],
  ['ATRIUM_INTERNAL_KEY', A.ATRIUM_INTERNAL_KEY], ['NOTIFIER_INTERNAL_KEY', A.NOTIFIER_INTERNAL_KEY],
  ['CRON_SECRET', A.CRON_SECRET], ['ATRIUM_SESSION_SECRET', A.ATRIUM_SESSION_SECRET],
  ['DEMO_WALLET_ADDRESS', DEPLOYER], ['NEXT_PUBLIC_ATRIUM_ADMIN_WALLETS', DEPLOYER],
  ['EDICT_CONTRACT_ADDR', EDICT],
];

const rootLog = await apply(ROOT_ENV, ROOT);
const appLog = await apply(APP_ENV, APP);
console.log('## root .env'); console.log(rootLog.join('\n'));
console.log('\n## apps/verify/.env.local'); console.log(appLog.join('\n'));
console.log('\nGroup A secrets generated fresh + written to both files (values not printed).');
console.log('Provided secrets present:',
  `etherscan=${ETHERSCAN ? 'yes' : 'NO'} upstash=${UPSTASH_URL && UPSTASH_TOKEN ? 'yes' : 'NO'} sentry=${process.env.SETUP_SENTRY_DSN ? 'yes' : 'in-root-already'}`);
console.log('EDICT_CONTRACT_ADDR from deployments:', EDICT || '(not found, left empty)');
