/**
 * One-shot publish cycle for Lantern. Extracted from index.ts so it can be
 * imported by serverless cron handlers (Vercel api/cron.ts) without
 * triggering the local while-loop. The loop wrapper still lives in
 * index.ts for non-serverless hosts (Fly machine, $5 VPS).
 */
import { createPublicClient, createWalletClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

import { buildTree, rootOf } from './merkle';
import { loadSigningKey } from './signer';
import { fetchCofferBalances } from './scribe';
import { pinTreeToIpfs } from './ipfs';

// Fail loudly at startup if any required env is missing — otherwise the
// service silently produces empty attestations: fetchCofferBalances would
// resolve to [], buildTree → empty root, and the operator gets a happy
// "tick complete" log while no attestation actually reaches the chain.
function requireEnv(name: string, validate?: (v: string) => boolean): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Lantern requires env var ${name}; refusing to start with empty value`);
  }
  if (validate && !validate(v)) {
    throw new Error(`Lantern env var ${name} is malformed`);
  }
  return v;
}
const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
const isUrl = (v: string) => /^https?:\/\/[a-z0-9.\-:]+(\/.*)?$/i.test(v);

// Phase theta audit follow-up (2026-05-25): Phase ζ.1 (task #354)
// extended LanternAttestor.publish to take 5 args (added leafCount +
// ipfsCid) but the off-chain service ABI here was left at the 3-arg
// shape. Every Lantern tick would build the Merkle tree, compute the
// IPFS CID, call publish() — and the tx would revert at the EVM
// dispatch table with 'no matching function' because the selector
// computed from this 3-arg ABI does not match the deployed 5-arg
// selector. Same selector-mismatch class as Sumsub assignTier(2-arg vs
// 3-arg) and vault-withdraw redeem-vs-withdraw. Aligned with
// contracts/lantern-attestor/src/LanternAttestor.sol:60.
const LANTERN_ABI = [
  {
    type: 'function',
    name: 'publish',
    inputs: [
      { name: 'root', type: 'bytes32' },
      { name: 'block_number', type: 'uint256' },
      { name: 'leafCount', type: 'uint256' },
      { name: 'ipfsCid', type: 'string' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export async function publishOnce(): Promise<void> {
  const LANTERN_ATTESTOR_ADDRESS = requireEnv('LANTERN_ATTESTOR_ADDRESS', isAddress) as `0x${string}`;
  const SCRIBE_URL = requireEnv('SCRIBE_URL', isUrl);
  const ARBITRUM_SEPOLIA_RPC = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
  const COFFER_ADDRESS =
    process.env.COFFER_ADDRESS && isAddress(process.env.COFFER_ADDRESS)
      ? process.env.COFFER_ADDRESS
      : '';

  const startTs = Date.now();
  console.log(`[lantern] tick start ${new Date(startTs).toISOString()}`);

  const balances = await fetchCofferBalances({
    scribeUrl: SCRIBE_URL,
    cofferAddress: COFFER_ADDRESS,
  });
  if (balances.length === 0) {
    console.log('[lantern] no balances yet, skipping attestation publish');
    return;
  }

  const tree = buildTree(balances);
  const root = rootOf(tree) as `0x${string}`;

  const ipfsCid = await pinTreeToIpfs(tree).catch((err) => {
    console.warn('[lantern] IPFS pin failed', err);
    return null;
  });

  const account = await loadSigningKey();
  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(ARBITRUM_SEPOLIA_RPC),
  });
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(ARBITRUM_SEPOLIA_RPC),
  });
  const blockNumber = await publicClient.getBlockNumber();
  const signature = await account.signMessage({
    message: { raw: root },
  });

  // When IPFS pin failed, pass empty string — the contract stores it
  // verbatim and the event consumer renders "ipfs:none" downstream.
  // The contract has no constraint on this field; null-as-empty keeps
  // the publish path alive even when the pinning service is degraded.
  const ipfsCidArg = ipfsCid ?? '';
  const leafCountArg = BigInt(balances.length);

  const hash = await walletClient.writeContract({
    address: LANTERN_ATTESTOR_ADDRESS,
    abi: LANTERN_ABI,
    functionName: 'publish',
    args: [root, blockNumber, leafCountArg, ipfsCidArg, signature as `0x${string}`],
  } as never);

  console.log(
    `[lantern] published root=${root} tx=${hash} ipfs=${ipfsCid ?? 'none'} balances=${balances.length}`,
  );
}
