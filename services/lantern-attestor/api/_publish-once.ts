/**
 * One-shot publish cycle for Lantern. Extracted from index.ts so it can be
 * imported by serverless cron handlers (Vercel api/cron.ts) without
 * triggering the local while-loop. The loop wrapper still lives in
 * index.ts for non-serverless hosts (Fly machine, $5 VPS).
 */
import { createPublicClient, createWalletClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

import { buildTree, rootOf } from './_merkle.js';
import { loadSigningKey } from './_signer.js';
import { fetchCofferUsers } from './_scribe.js';
import { buildLeaves } from './_leaves.js';
import { pinTreeToIpfs } from './_ipfs.js';

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

  const users = await fetchCofferUsers({ scribeUrl: SCRIBE_URL });
  if (users.length === 0) {
    console.log('[lantern] no users yet, skipping attestation publish');
    return;
  }

  // P0-3: balance authority is on-chain. Read convertToAssets(balanceOf(user))
  // per user (redeemable value), not the subgraph's net-deposit balanceWei.
  if (!COFFER_ADDRESS) {
    console.error('[lantern] COFFER_ADDRESS not set; cannot build leaves from RPC');
    return;
  }
  const balances = await buildLeaves(users, COFFER_ADDRESS);
  if (balances.length === 0) {
    console.log('[lantern] all balances zero after RPC fanout, skipping');
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

  // Phase zeta.1: emit leafCount + ipfsCid in the on-chain event so the
  // subgraph indexes them and the verify-app's /api/lantern/verify-inclusion
  // route can look up the right Merkle tree without an extra round trip.
  // ipfsCid is "" when the pin failed (network blip, gateway down); the
  // verify-app's CID regex rejects the empty string so the dashboard
  // surfaces "tree not pinned yet" rather than silently using the wrong CID.
  const ipfsCidForEvent = ipfsCid ?? '';
  const leafCountForEvent = BigInt(balances.length);

  const hash = await walletClient.writeContract({
    address: LANTERN_ATTESTOR_ADDRESS,
    abi: LANTERN_ABI,
    functionName: 'publish',
    args: [root, blockNumber, leafCountForEvent, ipfsCidForEvent, signature as `0x${string}`],
  } as never);

  console.log(
    `[lantern] published root=${root} tx=${hash} ipfs=${ipfsCidForEvent || 'none'} leaves=${balances.length}`,
  );
}
