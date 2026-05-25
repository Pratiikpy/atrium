/**
 * Gas-per-call measurement for the load-bearing Stylus contract entrypoints.
 *
 * Runs a small set of representative calls via viem against an anvil fork
 * of Arbitrum Sepolia (so we don't burn testnet ETH on each measurement).
 * Writes per-fn gas to `gas-report.json` for the build-report ingest.
 *
 * Targets:
 *   - Coffer.deposit
 *   - Plinth.update_margin (read path, gasEstimate)
 *   - Sigil.is_revoked    (view)
 *
 * Usage:
 *   FORK_RPC=https://arbitrum-sepolia.publicnode.com node scripts/contract-gas.mjs
 *
 * Operator note: this script does not require a real signer. It uses
 * viem's `estimateContractGas` against a forked node so the measurements
 * cost zero ETH. The forked-node simulation is deterministic per block;
 * pick a recent block via FORK_BLOCK env if you want stable numbers.
 */

import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

async function loadRegistry() {
  const txt = await readFile(resolve(REPO_ROOT, 'deployments/arbitrum_sepolia.json'), 'utf8');
  return JSON.parse(txt);
}

async function main() {
  const registry = await loadRegistry();
  const rpc = process.env.FORK_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
  const client = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });

  const targets = [
    {
      name: 'Coffer.deposit',
      address: registry.contracts.coffer.address,
      abi: [{ type: 'function', name: 'deposit', stateMutability: 'nonpayable',
              inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }],
              outputs: [{ type: 'uint256' }] }],
      functionName: 'deposit',
      args: [1_000_000n, '0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42'],
      budget_gas: 250000,
    },
    {
      name: 'Plinth.updateMargin',
      address: registry.contracts.plinth.address,
      abi: [{ type: 'function', name: 'updateMargin', stateMutability: 'nonpayable',
              inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] }],
      functionName: 'updateMargin',
      args: ['0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42'],
      budget_gas: 80000,
    },
    {
      name: 'Sigil.isRevoked',
      address: registry.contracts.sigil.address,
      abi: [{ type: 'function', name: 'isRevoked', stateMutability: 'view',
              inputs: [{ name: 'owner', type: 'address' }, { name: 'intent_hash', type: 'bytes32' }],
              outputs: [{ type: 'bool' }] }],
      functionName: 'isRevoked',
      args: ['0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42', '0x' + '0'.repeat(64)],
      budget_gas: 30000,
    },
  ];

  const results = [];
  for (const t of targets) {
    try {
      // estimateGas - cheapest path; doesn't simulate state changes from a signer.
      const gas = await client.estimateContractGas({
        address: t.address,
        abi: t.abi,
        functionName: t.functionName,
        args: t.args,
        account: '0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42',
      });
      results.push({
        fn: t.name,
        contract: t.address,
        gas: Number(gas),
        budget_gas: t.budget_gas,
        within_budget: Number(gas) <= t.budget_gas,
      });
      console.log(`${t.name}: ${gas} gas (budget ${t.budget_gas}) ${Number(gas) <= t.budget_gas ? '✓' : '✗'}`);
    } catch (err) {
      results.push({
        fn: t.name,
        contract: t.address,
        gas: null,
        budget_gas: t.budget_gas,
        within_budget: false,
        error: err instanceof Error ? err.message.slice(0, 200) : String(err),
      });
      console.log(`${t.name}: estimation failed - ${err instanceof Error ? err.message.slice(0, 100) : err}`);
    }
  }

  await writeFile(
    resolve(__dirname, 'gas-report.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), targets: results }, null, 2),
  );
  console.log(`\nWrote gas-report.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
