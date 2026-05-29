#!/usr/bin/env node
/**
 * build-aave-fill-envelope.mjs — construct + sign the EIP-712 intent + action
 * Sigil envelopes for a real venue-2 (Aave Horizon) trade-fill through
 * AtriumRouter.open_position_via_adapter, and flat-encode them the way the
 * Stylus Plinth/Sigil contracts decode them.
 *
 * WHY THIS EXISTS
 *   Through the Router, Plinth.resolve_owner reads the position owner from the
 *   intent envelope (intent_sigil[12..32]) AFTER Sigil.validate_action passes.
 *   With EMPTY sigils the owner resolves to the Router itself, not the user, so
 *   the app's current empty-sigil open (use-open-position.ts) records the
 *   position under the wrong account. A correct fill needs a real signed
 *   intent+action pair. For a self-directed open the user is its own agent
 *   (owner == agent), so a single key signs both envelopes.
 *
 * VERIFICATION
 *   Every hash here is computed byte-for-byte the way contracts/sigil/src/
 *   eip712.rs does; the flat encoders mirror encode_intent/encode_action in
 *   contracts/sigil/src/tests.rs. `--selfcheck` prints the SAME values the Rust
 *   test `prints_eip712_reference_for_aave_fill_crosscheck` prints for identical
 *   fixed inputs — diff them to prove the JS signer is wire-compatible with the
 *   on-chain decoder (the WW-1 tripwire). `--build` additionally checks each
 *   signature recovers the signing address before emitting the envelopes.
 *
 * USAGE
 *   node build-aave-fill-envelope.mjs selfcheck
 *   node build-aave-fill-envelope.mjs build   # needs E2E_PRIVATE_KEY in env
 *
 *   The `build` output (intent_sigil, action_sigil, venue_payload, router
 *   calldata) is what the T+48h driver submits via cast once the three timelock
 *   ops (#337 Coffer->Router, set_instrument_risk, addInstrument) have executed.
 */
import {
  keccak256,
  toBytes,
  concat,
  pad,
  numberToHex,
  recoverAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ---- canonical constants (match deployments/arbitrum_sepolia.json) ----------
const CHAIN_ID = 421614n;
const SIGIL = '0xc9933ebe7dc8c4849a1720b2e5b33e381442c873';
const AAVE_VENUE_ID = 2;
const INSTRUMENT = keccak256(toBytes('USDC-LEND')); // 0x128570b1...

const DOMAIN_TYPE_STRING =
  'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
const INTENT_TYPE_STRING =
  'IntentSigil(address owner,address agent,bytes32[] venues_allowed,bytes32[] instruments_allowed,uint256 max_notional_per_action_wei,uint256 max_total_open_notional_wei,uint32 max_actions_per_24h,uint256 expires_at,uint256 nonce,uint64 agent_revocation_nonce_at_signing)';
const ACTION_TYPE_STRING =
  'ActionSigil(bytes32 intent_hash,uint8 venue_id,bytes32 instrument_id,int256 notional_signed,uint256 submitted_at,uint256 action_nonce)';

const DOMAIN_TYPEHASH = keccak256(toBytes(DOMAIN_TYPE_STRING));
const INTENT_TYPEHASH = keccak256(toBytes(INTENT_TYPE_STRING));
const ACTION_TYPEHASH = keccak256(toBytes(ACTION_TYPE_STRING));

const MASK_256 = (1n << 256n) - 1n;

// ---- word helpers (32-byte big-endian, matching the Rust to_be_bytes::<32>) -
const word = (v) => pad(numberToHex(BigInt(v) & MASK_256), { size: 32 });
const addrWord = (a) => pad(a.toLowerCase(), { size: 32 }); // address right-aligned
const venueWord = (id) => pad(numberToHex(BigInt(id)), { size: 32 }); // byte at index 31
const int256Word = (v) => pad(numberToHex(((BigInt(v) % (1n << 256n)) + (1n << 256n)) % (1n << 256n)), { size: 32 });

// ---- EIP-712 (mirrors contracts/sigil/src/eip712.rs exactly) ----------------
function domainSeparator() {
  return keccak256(
    concat([
      DOMAIN_TYPEHASH,
      keccak256(toBytes('AtriumSigil')),
      keccak256(toBytes('1')),
      word(CHAIN_ID),
      addrWord(SIGIL),
    ]),
  );
}

function hashIntent(intent) {
  const venuesHash = keccak256(concat(intent.venues_allowed.map(venueWord)));
  const instrumentsHash = keccak256(concat(intent.instruments_allowed)); // each already 32-byte hex
  return keccak256(
    concat([
      INTENT_TYPEHASH,
      addrWord(intent.owner),
      addrWord(intent.agent),
      venuesHash,
      instrumentsHash,
      word(intent.max_notional_per_action_wei),
      word(intent.max_total_open_notional_wei),
      word(intent.max_actions_per_24h),
      word(intent.expires_at),
      word(intent.nonce),
      word(intent.agent_revocation_nonce_at_signing),
    ]),
  );
}

function hashAction(action) {
  return keccak256(
    concat([
      ACTION_TYPEHASH,
      action.intent_hash,
      venueWord(action.venue_id),
      action.instrument_id,
      int256Word(action.notional_signed),
      word(action.submitted_at),
      word(action.action_nonce),
    ]),
  );
}

const finalDigest = (domainSep, structHash) =>
  keccak256(concat(['0x1901', domainSep, structHash]));

// ---- flat envelope encoders (mirror encode_intent/encode_action in tests.rs)-
function encodeIntent(intent, sig) {
  const venues = concat(intent.venues_allowed.map(venueWord));
  const instruments = concat(intent.instruments_allowed);
  return concat([
    addrWord(intent.owner),
    addrWord(intent.agent),
    word(intent.max_notional_per_action_wei),
    word(intent.max_total_open_notional_wei),
    word(intent.max_actions_per_24h),
    word(intent.expires_at),
    word(intent.nonce),
    word(intent.agent_revocation_nonce_at_signing),
    word(intent.venues_allowed.length),
    venues,
    word(intent.instruments_allowed.length),
    instruments,
    sig.r,
    sig.s,
    numberToHex(sig.v, { size: 1 }),
  ]);
}

function encodeAction(action, sig) {
  return concat([
    action.intent_hash,
    venueWord(action.venue_id),
    action.instrument_id,
    int256Word(action.notional_signed),
    word(action.submitted_at),
    word(action.action_nonce),
    sig.r,
    sig.s,
    numberToHex(sig.v, { size: 1 }),
  ]);
}

function splitSig(sig) {
  // sig is a 0x-prefixed 65-byte hex (r||s||v).
  return {
    r: ('0x' + sig.slice(2, 66)),
    s: ('0x' + sig.slice(66, 130)),
    v: parseInt(sig.slice(130, 132), 16),
  };
}

const DUMMY_SIG = { r: '0x' + '11'.repeat(32), s: '0x' + '22'.repeat(32), v: 27 };

function fixedIntentAction(owner, agent) {
  const intent = {
    owner,
    agent,
    venues_allowed: [AAVE_VENUE_ID],
    instruments_allowed: [INSTRUMENT],
    max_notional_per_action_wei: 1_000_000_000n,
    max_total_open_notional_wei: 1_000_000_000n,
    max_actions_per_24h: 10,
    expires_at: 2_000_000_000n,
    nonce: 1n,
    agent_revocation_nonce_at_signing: 0n,
  };
  const intentStruct = hashIntent(intent);
  const action = {
    intent_hash: intentStruct,
    venue_id: AAVE_VENUE_ID,
    instrument_id: INSTRUMENT,
    notional_signed: 1_000_000n, // +1 USDC long
    submitted_at: 1_780_000_000n,
    action_nonce: 1n,
  };
  return { intent, intentStruct, action };
}

async function selfcheck() {
  // Identical fixed inputs to the Rust crosscheck test (anvil[0] addr).
  const owner = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const { intent, intentStruct, action } = fixedIntentAction(owner, owner);
  const ds = domainSeparator();
  const intentDigest = finalDigest(ds, intentStruct);
  const actionStruct = hashAction(action);
  const actionDigest = finalDigest(ds, actionStruct);
  const intentEnv = encodeIntent(intent, DUMMY_SIG);
  const actionEnv = encodeAction(action, DUMMY_SIG);
  console.log('XCHECK domain_sep    ' + ds);
  console.log('XCHECK intent_struct ' + intentStruct);
  console.log('XCHECK intent_digest ' + intentDigest);
  console.log('XCHECK action_struct ' + actionStruct);
  console.log('XCHECK action_digest ' + actionDigest);
  console.log('XCHECK intent_env    ' + intentEnv);
  console.log('XCHECK action_env    ' + actionEnv);
}

async function build() {
  const pk = process.env.E2E_PRIVATE_KEY;
  if (!pk) throw new Error('set E2E_PRIVATE_KEY (throwaway testnet key)');
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : '0x' + pk);
  const user = account.address;
  const { intent, intentStruct, action } = fixedIntentAction(user, user);

  const ds = domainSeparator();
  const intentDigest = finalDigest(ds, intentStruct);
  const actionDigest = finalDigest(ds, hashAction(action));

  const intentSig = splitSig(await account.sign({ hash: intentDigest }));
  const actionSig = splitSig(await account.sign({ hash: actionDigest }));

  // Verify each signature recovers the signer before emitting (fail loud).
  const recIntent = await recoverAddress({ hash: intentDigest, signature: rebuild(intentSig) });
  const recAction = await recoverAddress({ hash: actionDigest, signature: rebuild(actionSig) });
  if (recIntent.toLowerCase() !== user.toLowerCase()) throw new Error('intent sig recovery != user');
  if (recAction.toLowerCase() !== user.toLowerCase()) throw new Error('action sig recovery != user');

  const intentEnv = encodeIntent(intent, intentSig);
  const actionEnv = encodeAction(action, actionSig);

  console.log(JSON.stringify({
    user,
    venue_id: AAVE_VENUE_ID,
    instrument_id: INSTRUMENT,
    notional_signed: action.notional_signed.toString(),
    intent_sigil: intentEnv,
    action_sigil: actionEnv,
    venue_payload: '0x', // v1.1 adapter reads originator from the Router param
    note: 'pass to AtriumRouter.open_position_via_adapter(venue_id, instrument_id, notional_signed, action_sigil, intent_sigil, venue_payload) from `user` after #337 + set_instrument_risk + addInstrument execute',
  }, null, 2));
}

function rebuild(sig) {
  const v = sig.v.toString(16).padStart(2, '0');
  return (sig.r + sig.s.slice(2) + v);
}

const mode = process.argv[2] ?? 'selfcheck';
(mode === 'build' ? build() : selfcheck()).catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
