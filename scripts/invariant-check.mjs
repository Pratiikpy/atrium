// On-chain invariant check (QA_TEST_PLAN §11 A2 / §9.2): reads the LIVE Coffer
// (Stylus ERC-4626) via `cast` and asserts the solvency + share<->asset precision
// invariants the protocol must never violate. Evidence = real chain reads, not a
// unit test. Shells out to foundry `cast` (no viem dependency), matching
// scripts/smoke-money-path.mjs, so it runs from anywhere with foundry installed.
//   node scripts/invariant-check.mjs
import { spawnSync } from 'node:child_process';

const RPC = process.env.SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
const COFFER = process.env.COFFER ?? '0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3';
const USDC = process.env.USDC ?? '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';

function cast(args) {
  const r = spawnSync('cast', [...args, '--rpc-url', RPC], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`cast ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  return r.stdout.trim().split(/\s+/)[0];
}
const u = (s) => BigInt(s);

const totalAssets = u(cast(['call', COFFER, 'totalAssets()(uint256)']));
const totalSupply = u(cast(['call', COFFER, 'totalSupply()(uint256)']));
const asset = cast(['call', COFFER, 'asset()(address)']).toLowerCase();
const held = u(cast(['call', USDC, 'balanceOf(address)(uint256)', COFFER]));
const redeemable = u(cast(['call', COFFER, 'convertToAssets(uint256)(uint256)', String(totalSupply)]));
const PROBE = 5_000_000n; // 5 USDC, 6-dec
const probeShares = u(cast(['call', COFFER, 'convertToShares(uint256)(uint256)', String(PROBE)]));
const back = u(cast(['call', COFFER, 'convertToAssets(uint256)(uint256)', String(probeShares)]));
const sharesForZero = u(cast(['call', COFFER, 'convertToShares(uint256)(uint256)', '0']));

console.log(`Coffer ${COFFER}`);
console.log(`  totalAssets=${totalAssets} totalSupply=${totalSupply} usdcHeld=${held} asset=${asset}\n`);

let pass = 0, fail = 0;
const ck = (label, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d ? '  ' + d : ''}`); };

ck('asset() == USDC', asset === USDC.toLowerCase(), asset);
ck('solvency: convertToAssets(totalSupply) <= totalAssets', redeemable <= totalAssets, `${redeemable} <= ${totalAssets}`);
ck('backed: totalAssets <= USDC held by Coffer', totalAssets <= held, `${totalAssets} <= ${held}`);
ck('precision: roundtrip(5 USDC) creates no value', back <= PROBE, `${back} <= ${PROBE}`);
ck('precision: roundtrip loses <= 1 wei (virtual-offset rounding)', PROBE - back <= 1n, `delta=${PROBE - back}`);
ck('virtual-offset: convertToShares(0) == 0', sharesForZero === 0n, `${sharesForZero}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
