import { NextRequest, NextResponse } from 'next/server';
import { VENUES } from '@/lib/venues';

export const dynamic = 'force-dynamic';

// Mirror contracts/sigil/src/eip712.rs MAX_VENUES = 8. The current
// canonical VENUES list is 7; the contract decoder rejects anything > 8
// even before the cap check runs, so client and server must reject too.
const SIGIL_MAX_VENUES = 8;
const ZERO_ADDR = '0x' + '0'.repeat(40);
const VALID_VENUE_IDS = new Set(VENUES.map((v) => v.id));

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
    // Phase theta audit follow-up (2026-05-25): IntentSigil mandates are
    // off-chain by design — the Sigil contract has no `validateIntent` or
    // `issueIntent` function; only `validateAction` runs on-chain at
    // execution time (when the agent takes an action that consumes the
    // mandate). So the correct semantic for a server-side mandate
    // creation flow is: "envelope built, signature validated, you hold
    // the envelope". No on-chain tx is needed for issuance.
    //
    // Pre-fix this returned `ok: false` with a confusing "Codex storage
    // lights up Month 1 W2" message — implying the flow was incomplete.
    // The flow IS complete for Year-1: the client now has a signed
    // envelope it can hand to its agent directly. Codex's optional
    // mandate registry is a discoverability layer, not a prerequisite.
    return NextResponse.json({
      ok: true,
      mandate: {
        agent: body.agent,
        perActionCapUsdc: body.perActionCapUsdc,
        totalOpenCapUsdc: body.totalOpenCapUsdc,
        actionsPerDay: body.actionsPerDay,
        expiresDays: body.expiresDays,
        venueAllowlist: body.venueAllowlist,
        intentHash: body.intentHash,
        signature: body.signature,
      },
      detail:
        'Mandate signed. IntentSigil envelopes are off-chain in Year-1; hand the signed envelope to your agent so it can attach the signature to its first action on chain (Sigil.validateAction will verify it then).',
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
