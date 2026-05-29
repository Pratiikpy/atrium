#!/usr/bin/env node
/**
 * Scribe health check for CI cron. Exits non-zero if lagBlocks > 200
 * on two consecutive checks (5s apart).
 */

const SCRIBE_URL = process.env.SCRIBE_URL;
const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
const LAG_THRESHOLD = 200;

if (!SCRIBE_URL) {
  console.log('SCRIBE_URL not set, skipping health check');
  process.exit(0);
}

async function checkOnce() {
  const [scribeRes, chainRes] = await Promise.all([
    fetch(SCRIBE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ _meta { block { number } } }' }),
      signal: AbortSignal.timeout(5000),
    }),
    fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: AbortSignal.timeout(5000),
    }),
  ]);
  const scribeJson = await scribeRes.json();
  const chainJson = await chainRes.json();
  const indexedBlock = scribeJson?.data?._meta?.block?.number ?? 0;
  const chainBlock = chainJson?.result ? parseInt(chainJson.result, 16) : 0;
  const lagBlocks = Math.max(0, chainBlock - indexedBlock);
  return { indexedBlock, chainBlock, lagBlocks };
}

async function main() {
  const first = await checkOnce();
  console.log(`Check 1: indexed=${first.indexedBlock} chain=${first.chainBlock} lag=${first.lagBlocks}`);
  if (first.lagBlocks <= LAG_THRESHOLD) {
    console.log('Healthy.');
    process.exit(0);
  }
  // Re-check after 5s
  await new Promise((r) => setTimeout(r, 5000));
  const second = await checkOnce();
  console.log(`Check 2: indexed=${second.indexedBlock} chain=${second.chainBlock} lag=${second.lagBlocks}`);
  if (second.lagBlocks <= LAG_THRESHOLD) {
    console.log('Recovered on second check.');
    process.exit(0);
  }
  console.error(`ALERT: Scribe lag ${second.lagBlocks} > ${LAG_THRESHOLD} on 2 consecutive checks.`);
  process.exit(1);
}

main().catch((err) => {
  console.error('Health check error:', err.message ?? err);
  process.exit(1);
});
