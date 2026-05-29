import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Audit fix (#77): the authenticated-bridge gate for the chaos write routes.
 *
 * The chaos inject/restore routes sign real on-chain pauses. On testnet they
 * are a public judge-facing demo gated by the strict Origin allowlist + per-IP
 * rate limit (a browser button cannot safely carry a shared secret). For a
 * hardened / mainnet posture, set CHAOS_DRILL_KEY: when it is set, these routes
 * additionally REQUIRE `Authorization: Bearer <CHAOS_DRILL_KEY>` and 401 on a
 * missing/mismatched token, so the on-chain levers are reachable only by an
 * authenticated ops caller (CLI/server), not anyone with a valid Origin. When
 * CHAOS_DRILL_KEY is unset, this is a no-op (testnet demo path unchanged).
 *
 * Constant-time HMAC-digest compare (same primitive as the notifications Bearer
 * check, audit #78) so the comparison never leaks the secret's length.
 *
 * Returns a 401 NextResponse when locked-down and the Bearer is bad; null when
 * the check passes or no drill key is configured.
 */
export function requireChaosBearer(req: Request): NextResponse | null {
  const expected = process.env.CHAOS_DRILL_KEY;
  if (!expected) return null; // demo mode: Origin + rate-limit only
  const header = req.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!presented || !constantTimeEqual(presented, expected)) {
    return NextResponse.json(
      { error: 'unauthorized', detail: 'Chaos drill is locked down; a valid CHAOS_DRILL_KEY bearer token is required.' },
      { status: 401 },
    );
  }
  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const salt = 'atrium-chaos-drill';
  const da = createHmac('sha256', salt).update(a).digest();
  const db = createHmac('sha256', salt).update(b).digest();
  return timingSafeEqual(da, db);
}
