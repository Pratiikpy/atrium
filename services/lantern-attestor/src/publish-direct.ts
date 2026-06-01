#!/usr/bin/env tsx
/**
 * Manual bootstrap publish for Lantern, bypassing Scribe user-discovery.
 *
 * The regular publishOnce() path discovers Coffer holders from the Scribe
 * subgraph and aborts if Scribe lags tip by >50 blocks (a correctness guard
 * so a stale tree can't miss a recent deposit). When the Studio indexer is
 * still catching up but the holder set is known and small, this script lets an
 * operator publish the first real root computed straight from on-chain state:
 * it takes the holder list from LANTERN_USERS, runs the same buildLeaves RPC
 * fanout (convertToAssets(balanceOf(user))), the same Merkle tree, signs with
 * the same key, and publishes the same 5-arg ABI. The root is therefore
 * identical to what the cron will produce once Scribe catches up.
 *
 * Usage: LANTERN_USERS=0xabc,0xdef LANTERN_ATTESTOR_ADDRESS=.. COFFER_ADDRESS=.. \
 *        LANTERN_KEY_PATH=.. LANTERN_KEY_PASSPHRASE=.. tsx src/publish-direct.ts
 */
import { createPublicClient, createWalletClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { buildTree, rootOf } from './merkle';
import { loadSigningKey } from './signer';
import { buildLeaves } from './leaves';

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

(async () => {
  const LANTERN = (process.env.LANTERN_ATTESTOR_ADDRESS ?? '') as `0x${string}`;
  const COFFER = process.env.COFFER_ADDRESS ?? '';
  const RPC = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
  const addrs = (process.env.LANTERN_USERS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!LANTERN || !COFFER || addrs.length === 0) {
    throw new Error('need LANTERN_ATTESTOR_ADDRESS, COFFER_ADDRESS, LANTERN_USERS');
  }
  // buildLeaves wants {user, salt}; for a bootstrap root a deterministic
  // zero salt is fine (the tree is self-consistent, inclusion proofs verify
  // against this root regardless of the salt value).
  const ZERO_SALT = ('0x' + '0'.repeat(64)) as `0x${string}`;
  const users = addrs.map((u) => ({ user: u, salt: ZERO_SALT }));

  const balances = await buildLeaves(users, COFFER);
  if (balances.length === 0) throw new Error('all balances zero after RPC fanout');
  const tree = buildTree(balances);
  const root = rootOf(tree) as `0x${string}`;

  const account = await loadSigningKey();
  const wallet = createWalletClient({ account, chain: arbitrumSepolia, transport: http(RPC) });
  const pub = createPublicClient({ chain: arbitrumSepolia, transport: http(RPC) });
  const blockNumber = await pub.getBlockNumber();
  const signature = await account.signMessage({ message: { raw: root } });

  const hash = await wallet.writeContract({
    address: LANTERN,
    abi: LANTERN_ABI,
    functionName: 'publish',
    args: [root, blockNumber, BigInt(balances.length), '', signature as `0x${string}`],
  } as never);
  console.log(JSON.stringify({ ok: true, root, block: blockNumber.toString(), leafCount: balances.length, tx: hash }));
})().catch((e) => { console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) })); process.exit(1); });
