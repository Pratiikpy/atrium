// TEMP devnode repro: build a Sigil intent+action envelope for a LOCAL domain
// (chainId + verifyingContract + key from env), so validateAction can be driven
// directly on a Nitro devnode to trace the exact revert. Mirrors
// build-aave-fill-envelope.mjs encoding 1:1. Safe to delete after diagnosis.
import { keccak256, toBytes, concat, pad, numberToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverAddress } from 'viem';

const CHAIN_ID = BigInt(process.env.L_CHAIN_ID);
const SIGIL = process.env.L_SIGIL.toLowerCase();
const KEY = process.env.L_KEY.startsWith('0x') ? process.env.L_KEY : '0x' + process.env.L_KEY;
const AAVE_VENUE_ID = 2;
const INSTRUMENT = keccak256(toBytes('USDC-LEND'));

const INTENT_TYPE = 'IntentSigil(address owner,address agent,bytes32[] venues_allowed,bytes32[] instruments_allowed,uint256 max_notional_per_action_wei,uint256 max_total_open_notional_wei,uint32 max_actions_per_24h,uint256 expires_at,uint256 nonce,uint64 agent_revocation_nonce_at_signing)';
const ACTION_TYPE = 'ActionSigil(bytes32 intent_hash,uint8 venue_id,bytes32 instrument_id,int256 notional_signed,uint256 submitted_at,uint256 action_nonce)';
const DOMAIN_TYPE = 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
const DOMAIN_TH = keccak256(toBytes(DOMAIN_TYPE));
const INTENT_TH = keccak256(toBytes(INTENT_TYPE));
const ACTION_TH = keccak256(toBytes(ACTION_TYPE));
const MASK = (1n << 256n) - 1n;
const word = (v) => pad(numberToHex(BigInt(v) & MASK), { size: 32 });
const addrW = (a) => pad(a.toLowerCase(), { size: 32 });
const venueW = (id) => pad(numberToHex(BigInt(id)), { size: 32 });
const i256W = (v) => pad(numberToHex(((BigInt(v) % (1n << 256n)) + (1n << 256n)) % (1n << 256n)), { size: 32 });

const domainSep = (sigil) => keccak256(concat([DOMAIN_TH, keccak256(toBytes('AtriumSigil')), keccak256(toBytes('1')), word(CHAIN_ID), addrW(sigil)]));
function hashIntent(i) {
  const vh = keccak256(concat(i.venues_allowed.map(venueW)));
  const ih = keccak256(concat(i.instruments_allowed));
  return keccak256(concat([INTENT_TH, addrW(i.owner), addrW(i.agent), vh, ih, word(i.max_notional_per_action_wei), word(i.max_total_open_notional_wei), word(i.max_actions_per_24h), word(i.expires_at), word(i.nonce), word(i.agent_revocation_nonce_at_signing)]));
}
function hashAction(a) {
  return keccak256(concat([ACTION_TH, a.intent_hash, venueW(a.venue_id), a.instrument_id, i256W(a.notional_signed), word(a.submitted_at), word(a.action_nonce)]));
}
const finalDigest = (ds, sh) => keccak256(concat(['0x1901', ds, sh]));
function encodeIntent(i, sig) {
  return concat([addrW(i.owner), addrW(i.agent), word(i.max_notional_per_action_wei), word(i.max_total_open_notional_wei), word(i.max_actions_per_24h), word(i.expires_at), word(i.nonce), word(i.agent_revocation_nonce_at_signing), word(i.venues_allowed.length), concat(i.venues_allowed.map(venueW)), word(i.instruments_allowed.length), concat(i.instruments_allowed), sig.r, sig.s, numberToHex(sig.v, { size: 1 })]);
}
function encodeAction(a, sig) {
  return concat([a.intent_hash, venueW(a.venue_id), a.instrument_id, i256W(a.notional_signed), word(a.submitted_at), word(a.action_nonce), sig.r, sig.s, numberToHex(sig.v, { size: 1 })]);
}
const split = (s) => ({ r: '0x' + s.slice(2, 66), s: '0x' + s.slice(66, 130), v: parseInt(s.slice(130, 132), 16) });
const rebuild = (sig) => sig.r + sig.s.slice(2) + sig.v.toString(16).padStart(2, '0');

const acct = privateKeyToAccount(KEY);
const user = acct.address;
const intent = { owner: user, agent: user, venues_allowed: [AAVE_VENUE_ID], instruments_allowed: [INSTRUMENT], max_notional_per_action_wei: 1_000_000_000n, max_total_open_notional_wei: 1_000_000_000n, max_actions_per_24h: 10, expires_at: 2_000_000_000n, nonce: 1n, agent_revocation_nonce_at_signing: 0n };
const intentStruct = hashIntent(intent);
const action = { intent_hash: intentStruct, venue_id: AAVE_VENUE_ID, instrument_id: INSTRUMENT, notional_signed: 1_000_000n, submitted_at: 1_780_000_000n, action_nonce: 1n };
const ds = domainSep(SIGIL);
const intentDigest = finalDigest(ds, intentStruct);
const actionDigest = finalDigest(ds, hashAction(action));
const intentSig = split(await acct.sign({ hash: intentDigest }));
const actionSig = split(await acct.sign({ hash: actionDigest }));
const recI = await recoverAddress({ hash: intentDigest, signature: rebuild(intentSig) });
const recA = await recoverAddress({ hash: actionDigest, signature: rebuild(actionSig) });
if (recI.toLowerCase() !== user.toLowerCase() || recA.toLowerCase() !== user.toLowerCase()) throw new Error('local sig recovery mismatch');
console.log(JSON.stringify({ user, intent_sigil: encodeIntent(intent, intentSig), action_sigil: encodeAction(action, actionSig) }));
