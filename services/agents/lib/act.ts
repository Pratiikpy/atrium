/**
 * Agent action module: build + agent-sign an ActionSigil and submit it through
 * AtriumRouter.open_position_via_adapter, so a reference agent really trades
 * inside a user's mandate instead of logging `would-act-on`.
 *
 * The EIP-712 encoding here is a line-for-line port of the Spike-B envelope
 * builder (qa-evidence/agentic/build-agent-envelope.mjs), which is itself
 * proven byte-for-byte against contracts/sigil/src/eip712.rs (selfcheck +
 * independent `cast keccak`). The ONLY new part is doing it from the cron
 * agent with viem, against the live Sigil + Router.
 *
 * HONESTY GATE: this only runs when the agent is fully configured, a session
 * private key AND a stored user-signed intent envelope for the mandate. Absent
 * either, the agent stays the honest `would-act-on` log (see augur.ts). It
 * never fabricates a trade, and it self-verifies the agent signature recovers
 * to the agent address before broadcasting (a bad sign throws, no tx).
 *
 * First-run mandate source: for the initial real mandate the signed intent
 * envelope is supplied via AGENT_<NAME>_MANDATE (JSON), exactly as Spike-B did
 * with an on-disk envelope. Persisting every user mandate at issue-time for
 * fully-autonomous pickup is a deliberate follow-up that touches the
 * SIWE-gated mandate route; it is intentionally NOT done blind here.
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  toBytes,
  concat,
  pad,
  numberToHex,
  recoverAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const CHAIN_ID = BigInt(process.env.ATRIUM_CHAIN_ID ?? '421614');
const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL ?? 'https://arbitrum-sepolia.publicnode.com';
const ROUTER = (process.env.ATRIUM_ROUTER_ADDRESS ?? '0xE3E3bdc0B7FC9eC93fb0d6190A98ec1717B0B562') as `0x${string}`;
const SIGIL = (process.env.ATRIUM_SIGIL_ADDRESS ?? '0x517afac9b39C01c0Cf044b335742C95960959cdc').toLowerCase();

const ACTION_TYPE =
  'ActionSigil(bytes32 intent_hash,uint8 venue_id,bytes32 instrument_id,int256 notional_signed,uint256 submitted_at,uint256 action_nonce)';
const DOMAIN_TYPE = 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
const ACTION_TH = keccak256(toBytes(ACTION_TYPE));
const DOMAIN_TH = keccak256(toBytes(DOMAIN_TYPE));
const MASK = (1n << 256n) - 1n;
const word = (v: bigint | number) => pad(numberToHex(BigInt(v) & MASK), { size: 32 });
const addrW = (a: string) => pad(a.toLowerCase() as `0x${string}`, { size: 32 });
const venueW = (id: number) => pad(numberToHex(BigInt(id)), { size: 32 });
const i256W = (v: bigint) => pad(numberToHex(((v % (1n << 256n)) + (1n << 256n)) % (1n << 256n)), { size: 32 });

function domainSep(sigil: string): `0x${string}` {
  return keccak256(
    concat([DOMAIN_TH, keccak256(toBytes('AtriumSigil')), keccak256(toBytes('1')), word(CHAIN_ID), addrW(sigil)]),
  );
}
function hashAction(a: {
  intent_hash: `0x${string}`;
  venue_id: number;
  instrument_id: `0x${string}`;
  notional_signed: bigint;
  submitted_at: bigint;
  action_nonce: bigint;
}): `0x${string}` {
  return keccak256(
    concat([
      ACTION_TH,
      a.intent_hash,
      venueW(a.venue_id),
      a.instrument_id,
      i256W(a.notional_signed),
      word(a.submitted_at),
      word(a.action_nonce),
    ]),
  );
}
const finalDigest = (ds: `0x${string}`, sh: `0x${string}`) => keccak256(concat(['0x1901', ds, sh]));
const split = (s: string) => ({ r: ('0x' + s.slice(2, 66)) as `0x${string}`, s: ('0x' + s.slice(66, 130)) as `0x${string}`, v: parseInt(s.slice(130, 132), 16) });
const rebuild = (sig: { r: string; s: string; v: number }) => (sig.r + sig.s.slice(2) + sig.v.toString(16).padStart(2, '0')) as `0x${string}`;
function encodeAction(a: { intent_hash: `0x${string}`; venue_id: number; instrument_id: `0x${string}`; notional_signed: bigint; submitted_at: bigint; action_nonce: bigint }, sig: { r: `0x${string}`; s: `0x${string}`; v: number }): `0x${string}` {
  return concat([a.intent_hash, venueW(a.venue_id), a.instrument_id, i256W(a.notional_signed), word(a.submitted_at), word(a.action_nonce), sig.r, sig.s, numberToHex(sig.v, { size: 1 })]);
}

/** A user-signed mandate the agent may act inside. Supplied via env (first run). */
export interface StoredMandate {
  intent_hash: `0x${string}`;
  intent_sigil: `0x${string}`; // the full user-signed intent envelope bytes
  venue_id: number;
  instrument_id: `0x${string}`;
  max_notional_per_action_wei: string; // decimal string, 1e6 USDC scale
}

/** Load the agent's configured mandate from env, or null (then agent stays honest stub). */
export function loadMandate(agentEnvPrefix: string): StoredMandate | null {
  const raw = process.env[`${agentEnvPrefix}_MANDATE`];
  if (!raw) return null;
  try {
    const m = JSON.parse(raw);
    if (!m.intent_hash || !m.intent_sigil || m.venue_id == null || !m.instrument_id || !m.max_notional_per_action_wei) return null;
    return m as StoredMandate;
  } catch {
    return null;
  }
}

export interface ActResult {
  acted: boolean;
  reason?: string;
  txHash?: `0x${string}`;
  notionalWei?: string;
}

/**
 * Build + agent-sign an ActionSigil for `notionalWei` inside `mandate`, then
 * submit it via the Router from the agent wallet. Returns the real tx hash.
 * Throws only on a configuration / signing fault; an on-chain revert (e.g. cap
 * exceeded) is returned with the tx hash and a non-acted reason for the caller
 * to log honestly (a revert is the enforcement working, not a bug).
 */
export async function actOnMandate(
  agentEnvPrefix: string,
  mandate: StoredMandate,
  notionalWei: bigint,
  actionNonce: bigint,
): Promise<ActResult> {
  const pk = process.env[`${agentEnvPrefix}_PRIVATE_KEY`];
  if (!pk) return { acted: false, reason: 'no session key configured' };

  const agent = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`);

  // Respect the mandate's per-action cap client-side so we never knowingly
  // broadcast a doomed over-cap tx (the contract would reject it anyway).
  const cap = BigInt(mandate.max_notional_per_action_wei);
  if (notionalWei > cap) return { acted: false, reason: `notional ${notionalWei} over per-action cap ${cap}` };

  const action = {
    intent_hash: mandate.intent_hash,
    venue_id: mandate.venue_id,
    instrument_id: mandate.instrument_id,
    notional_signed: notionalWei,
    submitted_at: BigInt(Math.floor(Date.now() / 1000)),
    action_nonce: actionNonce,
  };
  const ds = domainSep(SIGIL);
  const actionDigest = finalDigest(ds, hashAction(action));
  const sigHex = await agent.sign({ hash: actionDigest });
  const sig = split(sigHex);

  // Self-check: the signature MUST recover to the agent address, else abort
  // before spending gas (a bad encoding would silently mis-sign otherwise).
  const recovered = await recoverAddress({ hash: actionDigest, signature: rebuild(sig) });
  if (recovered.toLowerCase() !== agent.address.toLowerCase()) {
    throw new Error('action signature recovery != agent address; refusing to broadcast');
  }
  const actionSigil = encodeAction(action, sig);

  const wallet = createWalletClient({ account: agent, transport: http(RPC_URL) });
  const pub = createPublicClient({ transport: http(RPC_URL) });

  const txHash = await wallet.writeContract({
    address: ROUTER,
    abi: [
      {
        type: 'function',
        name: 'open_position_via_adapter',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'venue_id', type: 'uint8' },
          { name: 'instrument_id', type: 'bytes32' },
          { name: 'notional_signed', type: 'int256' },
          { name: 'action_sigil', type: 'bytes' },
          { name: 'intent_sigil', type: 'bytes' },
          { name: 'extra', type: 'bytes' },
        ],
        outputs: [],
      },
    ],
    functionName: 'open_position_via_adapter',
    args: [mandate.venue_id, mandate.instrument_id, notionalWei, actionSigil, mandate.intent_sigil, '0x'],
    chain: null,
  });

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash }).catch(() => null);
  if (receipt && receipt.status === 'reverted') {
    return { acted: false, reason: 'on-chain revert (enforcement or instrument gate)', txHash, notionalWei: notionalWei.toString() };
  }
  return { acted: true, txHash, notionalWei: notionalWei.toString() };
}
