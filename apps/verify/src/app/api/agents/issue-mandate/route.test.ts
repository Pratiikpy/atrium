import { describe, it, expect } from 'vitest';
import { POST } from './route';

/**
 * Locks the audit R-2 + S-4 fixes for the IntentSigil issuance endpoint.
 *
 * Audit R-2: zero-address agent + over-cap venue allowlist + invalid venue
 *            ids were silently accepted; the route now rejects every one
 *            with a specific error string client AND server-side.
 *
 * Audit S-4: prior response echoed the full agent address + full payload.
 *            A probe could harvest user-supplied wallets from server logs
 *            or response bodies. The response now echoes counts + a masked
 *            agent digest only.
 *
 * These rules ship now (Sigil isn't deployed yet), but the validation
 * surface is the gate every future caller hits. Locking it at the unit-
 * test layer means a refactor can't widen the gates without breaking CI.
 */

const ZERO_ADDR = '0x' + '0'.repeat(40);
const VALID_AGENT = '0x' + 'a'.repeat(40);

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/agents/issue-mandate', {
    method: 'POST',
    // Phase-3 CSRF gate: the route requires an allowlisted Origin on this
    // mutation route (localhost:3000 is allowed). The authenticated session
    // is satisfied by the global DEMO_WALLET_ADDRESS in vitest.setup.ts.
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    agent: VALID_AGENT,
    perActionCapUsdc: 50,
    totalOpenCapUsdc: 500,
    actionsPerDay: 24,
    expiresDays: 14,
    venueAllowlist: ['hyperliquid', 'aave-horizon'],
    ...overrides,
  };
}

describe('POST /api/agents/issue-mandate — Phase-3 CSRF origin gate', () => {
  it('rejects a request with no Origin header (403)', async () => {
    const req = new Request('http://localhost/api/agents/issue-mandate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('origin_not_allowed');
  });

  it('rejects a request from a disallowed Origin (403)', async () => {
    const req = new Request('http://localhost/api/agents/issue-mandate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: JSON.stringify(validBody()),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('origin_not_allowed');
  });
});

describe('POST /api/agents/issue-mandate — input validation', () => {
  it('rejects a non-JSON body', async () => {
    const req = new Request('http://localhost/api/agents/issue-mandate', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
      body: 'not-json',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('bad_request_body');
  });

  it('rejects a missing agent', async () => {
    const res = await POST(makeRequest(validBody({ agent: undefined })) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/agent.*0x-prefixed/i);
  });

  it('rejects a malformed agent (no 0x prefix)', async () => {
    const res = await POST(makeRequest(validBody({ agent: 'a'.repeat(40) })) as never);
    expect(res.status).toBe(400);
  });

  it('rejects a malformed agent (wrong hex length)', async () => {
    const res = await POST(makeRequest(validBody({ agent: '0x' + 'a'.repeat(38) })) as never);
    expect(res.status).toBe(400);
  });

  it('rejects the zero-address agent (audit R-2)', async () => {
    // Critical security gate: the zero address as agent would brick mandate
    // revocation because Sigil's revokeAllOnBehalfOf takes (user, agent) as
    // two-arg lookup keys. A zero agent makes the revoke a no-op.
    const res = await POST(makeRequest(validBody({ agent: ZERO_ADDR })) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/zero address/i);
    expect(json.error).toMatch(/brick.*revocation/i);
  });

  it('rejects per-action cap = 0 or negative', async () => {
    expect((await (await POST(makeRequest(validBody({ perActionCapUsdc: 0 })) as never)).json()).error).toMatch(
      /per-action cap/i,
    );
    expect((await (await POST(makeRequest(validBody({ perActionCapUsdc: -5 })) as never)).json()).error).toMatch(
      /per-action cap/i,
    );
  });

  it('rejects total open cap = 0 or negative', async () => {
    const res = await POST(makeRequest(validBody({ totalOpenCapUsdc: 0 })) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/total open cap/i);
  });

  it('rejects when total open cap < per-action cap (invariant)', async () => {
    // The total open cap is the ceiling on outstanding position notional —
    // it must be ≥ the per-action cap or a single allowed trade would
    // breach it on entry.
    const res = await POST(
      makeRequest(validBody({ perActionCapUsdc: 100, totalOpenCapUsdc: 50 })) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/total open cap must be ≥|>= per-action/i);
  });

  it('rejects actions-per-day outside [1, 1000]', async () => {
    expect((await POST(makeRequest(validBody({ actionsPerDay: 0 })) as never)).status).toBe(400);
    expect((await POST(makeRequest(validBody({ actionsPerDay: 1001 })) as never)).status).toBe(400);
    // Negative values must reject too (paranoia).
    expect((await POST(makeRequest(validBody({ actionsPerDay: -1 })) as never)).status).toBe(400);
  });

  it('rejects expires-days outside [1, 365]', async () => {
    expect((await POST(makeRequest(validBody({ expiresDays: 0 })) as never)).status).toBe(400);
    expect((await POST(makeRequest(validBody({ expiresDays: 366 })) as never)).status).toBe(400);
  });

  it('rejects an empty venueAllowlist', async () => {
    const res = await POST(makeRequest(validBody({ venueAllowlist: [] })) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least one venue/i);
  });

  it('rejects a venueAllowlist longer than SIGIL_MAX_VENUES (8)', async () => {
    // The contract's `Sigil.eip712.rs` decoder hardcodes MAX_VENUES = 8.
    // Client+server reject earlier so users see the error immediately.
    const tooMany = Array.from({ length: 9 }, () => 'hyperliquid'); // intentionally 9
    const res = await POST(makeRequest(validBody({ venueAllowlist: tooMany })) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cannot exceed 8/i);
  });

  it('rejects unknown venue ids in the allowlist', async () => {
    // Audit R-2: must reject venues NOT in the canonical VENUES list. A
    // hostile caller could pass "metamask-perp" and the server would just
    // store it without recognising the typo.
    const res = await POST(
      makeRequest(validBody({ venueAllowlist: ['hyperliquid', 'imaginary-venue'] })) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/unknown venue id.*imaginary-venue/i);
  });
});

describe('POST /api/agents/issue-mandate — pending-state response (audit S-4)', () => {
  it('valid payload (no signature) returns ok:false with sign-via-wagmi guidance', async () => {
    // Phase theta audit follow-up (2026-05-25): the legacy "Sigil contract
    // not deployed" copy was a lie — Sigil IS deployed. Updated copy
    // explains that the signed envelope completes issuance (IntentSigil
    // mandates are off-chain by design; only validateAction runs on-chain
    // at execution time).
    const res = await POST(makeRequest(validBody()) as never);
    // 200 — request was well-formed; ok=false because the client hasn't
    // signed yet (wagmi EIP-712 signing happens client-side).
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/sign with your wallet/i);
    // Honesty: response names wagmi EIP-712 as the completion path.
    expect(json.error).toMatch(/EIP-712/i);
  });

  it('response does NOT echo the full agent address (audit S-4)', async () => {
    // Audit S-4: prior code returned `accepted: { agent: <full address> }`,
    // letting a probe harvest agent addresses from server logs. Now only a
    // masked digest is returned.
    const res = await POST(makeRequest(validBody()) as never);
    const json = await res.json();
    const responseStr = JSON.stringify(json);

    // Full address must NOT appear in the response.
    expect(responseStr).not.toContain(VALID_AGENT);

    // Masked digest must appear: "0x{first 8 chars}…{last 4 chars}".
    expect(json.accepted.agentDigest).toMatch(/^0x[a-fA-F0-9]+…[a-fA-F0-9]{4}$/);
  });

  it('response echoes counts only, not the full venueAllowlist array', async () => {
    const allowlist = ['hyperliquid', 'aave-horizon', 'pendle-v2'];
    const res = await POST(makeRequest(validBody({ venueAllowlist: allowlist })) as never);
    const json = await res.json();

    // Count is preserved (useful for the UI confirmation).
    expect(json.accepted.venueCount).toBe(3);

    // But the actual venue ids must NOT be echoed.
    const responseStr = JSON.stringify(json);
    expect(responseStr).not.toContain('"hyperliquid"');
    expect(responseStr).not.toContain('"aave-horizon"');
  });

  it('response preserves numeric caps so the UI can show a confirmation', async () => {
    const res = await POST(
      makeRequest(validBody({ perActionCapUsdc: 75, totalOpenCapUsdc: 1500, actionsPerDay: 50, expiresDays: 30 })) as never,
    );
    const json = await res.json();
    expect(json.accepted.perActionCapUsdc).toBe(75);
    expect(json.accepted.totalOpenCapUsdc).toBe(1500);
    expect(json.accepted.actionsPerDay).toBe(50);
    expect(json.accepted.expiresDays).toBe(30);
  });
});
