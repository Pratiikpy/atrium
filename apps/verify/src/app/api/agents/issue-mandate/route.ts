import { NextRequest, NextResponse } from 'next/server';
import { VENUES } from '@/lib/venues';
import { getSession } from '@/lib/auth-session';
import { buildSigilTypedData, type IntentSigilEnvelope } from '@/lib/sigil-typed-data';
import { instrumentIdsForVenues } from '@/lib/instruments';
import { loadContractAddress } from '@/lib/deployments-registry';

export const dynamic = 'force-dynamic';

// --- Origin allowlist (Phase 3 CSRF hardening) ---
const ALLOWED_ORIGINS = [
  'https://verify.atrium.fi',
  'https://atrium.fi',
  'http://localhost:3000',
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false; // mutation routes require Origin
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  const regex = process.env.ATRIUM_ALLOWED_PREVIEW_REGEX;
  if (regex) {
    try { return new RegExp(regex).test(origin); } catch { /* invalid regex */ }
  }
  return false;
}

// Mirror contracts/sigil/src/eip712.rs MAX_VENUES = 8. The current
// canonical VENUES list is 7; the contract decoder rejects anything > 8
// even before the cap check runs, so client and server must reject too.
const SIGIL_MAX_VENUES = 8;
const ZERO_ADDR = '0x' + '0'.repeat(40);
const VALID_VENUE_IDS = new Set(VENUES.map((v) => v.id));
// Atrium runs on Arbitrum Sepolia. The server recomputes the EIP-712 hash
// against this chainId only — a signature produced for any other chain
// fails recovery and is rejected (we never accept cross-chain mandates).
const ARB_SEPOLIA_CHAIN_ID = 421614;
const USDC_DECIMALS = 6;

interface MandateRequest {
  agent?: string;
  perActionCapUsdc?: number;
  totalOpenCapUsdc?: number;
  actionsPerDay?: number;
  expiresDays?: number;
  venueAllowlist?: string[];
  // Audit U-17: client now signs EIP-712 via wagmi and posts the
  // signature + intentHash alongside the envelope. Storage (Codex)
  // accepts this pair so future agent actions can look the envelope up
  // by hash. Both fields are optional during the transition: legacy
  // clients (server-side smoke tests, the agents/issue-mandate route
  // tests) post without signing and still get validation feedback.
  signature?: string;
  intentHash?: string;
  // Signed-only values the server needs to reproduce the EXACT EIP-712 struct
  // the wallet signed. Everything else is derived server-side from the
  // validated form fields above, which forces the signature to bind to them.
  // Decimal strings; required whenever signature + intentHash are present.
  expiresAt?: string;
  nonce?: string;
}

/**
 * Issue a new IntentSigil mandate. Wave-O+ scaffold:
 *   - Validates the request shape.
 *   - Builds the EIP-712 envelope.
 *   - When Postern is wired, signs via the user's session key and sends to
 *     Sigil.issueIntent.
 *   - Returns { ok, txHash } on success or { ok: false, error } honestly.
 *
 * Audit P-11 fix: previously the New-mandate button was dead. Now the
 * server-side endpoint exists with a clear pending-state response when
 * Sigil isn't deployed yet.
 */
export async function POST(req: NextRequest) {
  // Phase 3: Origin allowlist (CSRF protection for mutation route)
  if (!isOriginAllowed(req.headers.get('origin'))) {
    return NextResponse.json({ ok: false, error: 'origin_not_allowed' }, { status: 403 });
  }

  // Phase 3: Require authenticated session
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: MandateRequest;
  try {
    body = (await req.json()) as MandateRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request_body' }, { status: 400 });
  }

  // Validation. Audit R-2 fix: zero-address agent + venue allowlist
  // bounds + venue membership now enforced both client and server-side.
  if (!body.agent || !/^0x[0-9a-fA-F]{40}$/.test(body.agent)) {
    return NextResponse.json({ ok: false, error: 'agent must be 0x-prefixed 40-hex' }, { status: 400 });
  }
  if (body.agent.toLowerCase() === ZERO_ADDR) {
    return NextResponse.json({ ok: false, error: 'agent cannot be the zero address — this would brick mandate revocation' }, { status: 400 });
  }
  if (!body.perActionCapUsdc || body.perActionCapUsdc <= 0) {
    return NextResponse.json({ ok: false, error: 'per-action cap must be > 0' }, { status: 400 });
  }
  if (!body.totalOpenCapUsdc || body.totalOpenCapUsdc <= 0) {
    return NextResponse.json({ ok: false, error: 'total open cap must be > 0' }, { status: 400 });
  }
  if (body.totalOpenCapUsdc < body.perActionCapUsdc) {
    return NextResponse.json({ ok: false, error: 'total open cap must be ≥ per-action cap' }, { status: 400 });
  }
  if (!body.actionsPerDay || body.actionsPerDay <= 0 || body.actionsPerDay > 1000) {
    return NextResponse.json({ ok: false, error: 'actions-per-day must be 1..1000' }, { status: 400 });
  }
  if (!body.expiresDays || body.expiresDays <= 0 || body.expiresDays > 365) {
    return NextResponse.json({ ok: false, error: 'expires-days must be 1..365' }, { status: 400 });
  }
  if (!body.venueAllowlist || body.venueAllowlist.length === 0) {
    return NextResponse.json({ ok: false, error: 'at least one venue must be allowed' }, { status: 400 });
  }
  if (body.venueAllowlist.length > SIGIL_MAX_VENUES) {
    return NextResponse.json(
      { ok: false, error: `venue allowlist cannot exceed ${SIGIL_MAX_VENUES} (Sigil decoder limit)` },
      { status: 400 }
    );
  }
  for (const v of body.venueAllowlist) {
    if (!VALID_VENUE_IDS.has(v)) {
      return NextResponse.json({ ok: false, error: `unknown venue id: ${v}` }, { status: 400 });
    }
  }

  // If the client signed via wagmi, validate the signature + hash shape
  // at the boundary. Storage of the envelope is Codex's job (Postern
  // session-key registry) and lights up Month 1 W2.
  if (body.signature !== undefined && body.intentHash !== undefined) {
    if (!/^0x[0-9a-fA-F]{130}$/.test(body.signature)) {
      return NextResponse.json(
        { ok: false, error: 'signature must be 0x + 65-byte hex (130 chars)' },
        { status: 400 },
      );
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(body.intentHash)) {
      return NextResponse.json(
        { ok: false, error: 'intentHash must be 0x + 32-byte hex (64 chars)' },
        { status: 400 },
      );
    }

    // The signed-only values (expiresAt, nonce) are required to reproduce the
    // exact struct the wallet signed. Everything else is derived from the
    // validated form fields above.
    if (!body.expiresAt || !/^\d+$/.test(body.expiresAt)) {
      return NextResponse.json({ ok: false, error: 'expiresAt must be a unix-seconds decimal string' }, { status: 400 });
    }
    if (!body.nonce || !/^\d+$/.test(body.nonce)) {
      return NextResponse.json({ ok: false, error: 'nonce must be a decimal string' }, { status: 400 });
    }
    const expiresAtSec = BigInt(body.expiresAt);
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (expiresAtSec <= nowSec) {
      return NextResponse.json({ ok: false, error: 'mandate already expired' }, { status: 400 });
    }
    if (expiresAtSec > nowSec + 366n * 86_400n) {
      return NextResponse.json({ ok: false, error: 'expiry exceeds 366 days' }, { status: 400 });
    }

    // 2026-05-29 security review (signature-binding): DO NOT trust the
    // client-supplied intentHash. The pre-fix code recovered the signer from
    // `body.intentHash` directly, so a caller could submit arbitrary mandate
    // fields alongside a signature over an UNRELATED hash and still pass — the
    // signature was never bound to the mandate being created.
    //
    // Now: recompute the EIP-712 struct hash server-side from the validated
    // mandate fields + the canonical domain (Arbitrum Sepolia chainId + the
    // deployed Sigil address), using the same builder the client + the Stylus
    // contract use. Recover the signer from the RECOMPUTED hash. Reject if the
    // client's intentHash differs (tampered fields) or the signer is not the
    // session wallet. On-chain Sigil.validate_action remains the authoritative
    // gate at action time; this endpoint must not vouch for a mandate it did
    // not actually verify.
    const sigilAddress = await loadContractAddress('sigil');
    if (!sigilAddress) {
      return NextResponse.json(
        { ok: false, error: 'sigil_not_deployed', detail: 'Cannot verify the signature until Sigil is in the deployment registry.' },
        { status: 503 },
      );
    }

    let recomputedHash: `0x${string}`;
    let recovered: string;
    try {
      const { hashTypedData, recoverTypedDataAddress, parseUnits } = await import('viem');
      const envelope: IntentSigilEnvelope = {
        owner: session.walletAddress as `0x${string}`,
        agent: body.agent as `0x${string}`,
        venuesAllowedIds: body.venueAllowlist!,
        // 062-FE7 fix: derive the instrument allowlist from the venues the
        // same way the client does (lib/instruments), so the server-recomputed
        // hash matches the client's signed hash. An empty list here would both
        // mismatch the client signature AND (on-chain) make every agent action
        // fail Sigil.caps_respected.
        instrumentsAllowed: instrumentIdsForVenues(body.venueAllowlist!),
        maxNotionalPerActionWei: parseUnits(String(body.perActionCapUsdc), USDC_DECIMALS),
        maxTotalOpenNotionalWei: parseUnits(String(body.totalOpenCapUsdc), USDC_DECIMALS),
        maxActionsPer24h: Math.min(body.actionsPerDay!, 0xffffffff),
        expiresAt: expiresAtSec,
        nonce: BigInt(body.nonce),
        agentRevocationNonceAtSigning: 0n,
      };
      const typedData = buildSigilTypedData(envelope, ARB_SEPOLIA_CHAIN_ID, sigilAddress as `0x${string}`);
      recomputedHash = hashTypedData(typedData);
      recovered = await recoverTypedDataAddress({
        ...typedData,
        signature: body.signature as `0x${string}`,
      });
    } catch {
      return NextResponse.json({ ok: false, error: 'signature_recovery_failed' }, { status: 400 });
    }

    if (recomputedHash.toLowerCase() !== body.intentHash.toLowerCase()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'intent_hash_mismatch',
          detail: 'Submitted intentHash does not match the mandate fields. The signature is not bound to this mandate.',
        },
        { status: 403 },
      );
    }
    if (recovered.toLowerCase() !== session.walletAddress.toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: 'signature_wallet_mismatch', detail: 'Recovered signer does not match session wallet' },
        { status: 403 },
      );
    }

    // Verified: the signature binds to exactly these fields, signed by the
    // session wallet. IntentSigil mandates are off-chain in Year-1 (Sigil has
    // no issueIntent; only validate_action runs on-chain at execution time),
    // so issuance is complete here: the client holds a server-verified signed
    // envelope to hand to its agent.
    return NextResponse.json({
      ok: true,
      mandate: {
        agent: body.agent,
        perActionCapUsdc: body.perActionCapUsdc,
        totalOpenCapUsdc: body.totalOpenCapUsdc,
        actionsPerDay: body.actionsPerDay,
        expiresDays: body.expiresDays,
        venueAllowlist: body.venueAllowlist,
        intentHash: recomputedHash,
        signature: body.signature,
      },
      detail:
        'Mandate signed and server-verified (signature bound to these exact fields). IntentSigil envelopes are off-chain in Year-1; hand the signed envelope to your agent so it can attach the signature to its first action on chain (Sigil.validateAction is the authoritative gate).',
    });
  }

  // Legacy path (no signature posted) — kept for the smoke tests and any
  // pre-wagmi client.
  // Audit S-4 fix: previously echoed the full validated payload including
  // the agent address. Probes would have their inputs preserved in server
  // logs + response body. We now echo only the request shape (counts),
  // not the user-supplied values.
  //
  // Phase theta audit follow-up (2026-05-25): pre-fix the message said
  // "Sigil contract not deployed yet" — but Sigil IS deployed. The
  // correct framing: the envelope is valid; the client needs to sign it
  // via wagmi to complete issuance. Updated copy below.
  return NextResponse.json({
    ok: false,
    error:
      'Envelope shape validated. Sign with your wallet to complete issuance (wagmi EIP-712 path); the IntentSigil mandate is stored locally and only hits chain on first agent action.',
    accepted: {
      perActionCapUsdc: body.perActionCapUsdc,
      totalOpenCapUsdc: body.totalOpenCapUsdc,
      actionsPerDay: body.actionsPerDay,
      expiresDays: body.expiresDays,
      venueCount: body.venueAllowlist!.length,
      agentDigest: body.agent!.slice(0, 10) + '…' + body.agent!.slice(-4),
    },
  });
}
