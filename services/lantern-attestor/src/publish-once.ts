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
import { fetchCofferUsers } from './scribe';
import { pinTreeToIpfs } from './ipfs';
import { checkScribeHealth } from './scribe-health';
import { buildLeaves } from './leaves';
import { heartbeat } from './heartbeat';

// Fail loudly at startup if any required env is missing, otherwise the
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
// IPFS CID, call publish(), and the tx would revert at the EVM
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

/**
 * Resolve contract addresses from the canonical deployment registry when
 * DEPLOYMENT_REGISTRY_URL is set (the self-correcting pattern vigil-keeper
 * uses), falling back to explicit env vars. Makes the cron immune to a
 * redeploy/cutover changing addresses AND to workflow env-var-name drift: the
 * GHA env had been setting LANTERN_CONTRACT_ADDR/COFFER_ADDR while this code
 * reads LANTERN_ATTESTOR_ADDRESS/COFFER_ADDRESS, so requireEnv threw on every
 * 10-min tick and the on-chain root went stale.
 */
async function resolveFromRegistry(): Promise<{ lantern?: string; coffer?: string }> {
  const url = process.env.DEPLOYMENT_REGISTRY_URL;
  if (!url || !isUrl(url)) return {};
  try {
    const r = await fetch(url);
    if (!r.ok) return {};
    const j = (await r.json()) as { contracts?: Record<string, { address?: string }> };
    const c = j.contracts ?? {};
    return { lantern: c['lantern-attestor']?.address, coffer: c['coffer']?.address };
  } catch {
    return {};
  }
}

export async function publishOnce(): Promise<void> {
  const SCRIBE_URL = requireEnv('SCRIBE_URL', isUrl);
  const ARBITRUM_SEPOLIA_RPC = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';

  // Registry-first resolution; env vars (correctly named) are the fallback.
  const reg = await resolveFromRegistry();
  const lanternEnv = process.env.LANTERN_ATTESTOR_ADDRESS;
  const LANTERN_ATTESTOR_ADDRESS = (
    reg.lantern && isAddress(reg.lantern)
      ? reg.lantern
      : lanternEnv && isAddress(lanternEnv)
        ? lanternEnv
        : ''
  ) as `0x${string}`;
  if (!LANTERN_ATTESTOR_ADDRESS) {
    throw new Error(
      'Lantern requires a LanternAttestor address; set DEPLOYMENT_REGISTRY_URL or LANTERN_ATTESTOR_ADDRESS',
    );
  }
  const COFFER_ADDRESS =
    reg.coffer && isAddress(reg.coffer)
      ? reg.coffer
      : process.env.COFFER_ADDRESS && isAddress(process.env.COFFER_ADDRESS)
        ? process.env.COFFER_ADDRESS
        : '';

  const startTs = Date.now();
  console.log(`[lantern] tick start ${new Date(startTs).toISOString()}`);

  // Audit fix (#56): signal liveness (no-ops when HONEYBADGER_HEARTBEAT_URL unset).
  await heartbeat('lantern-attestor');

  // Phase 4 (SD-3): Check Scribe health before fetching balances.
  // If lagBlocks > 50 (~12s), abort, stale tree could miss recent deposits.
  try {
    const health = await checkScribeHealth(SCRIBE_URL);
    if (health.isStale) {
      console.warn(`[lantern] Scribe stale: lag=${health.lagBlocks} blocks. Aborting publish.`);
      return;
    }
  } catch (err) {
    console.warn('[lantern] Scribe health check failed, proceeding cautiously:', err);
  }

  const users = await fetchCofferUsers({ scribeUrl: SCRIBE_URL });
  if (users.length === 0) {
    console.log('[lantern] no users yet, skipping attestation publish');
    return;
  }

  // Phase 6: RPC fanout, every leaf reads convertToAssets(balanceOf(user))
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

  // When IPFS pin failed, pass empty string, the contract stores it
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
