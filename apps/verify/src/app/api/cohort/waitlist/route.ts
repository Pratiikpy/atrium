/**
 * Cohort waitlist: a real signup list backed by Upstash Redis.
 *
 * Honesty contract: the count returned is the REAL number of unique signups
 * (SCARD of the email set), never seeded with a fake base. If it is zero, it
 * returns zero. The set dedupes by normalised email so the same address cannot
 * inflate the number.
 *
 * Write spam is bounded by the global write rate-limit in middleware.ts
 * (per-IP). POST stores the email and returns the new count; GET returns the
 * current count for the public counter.
 *
 * When Upstash env is unset (local dev), both handlers degrade honestly:
 * GET returns { available: false }, POST returns 503, so the UI shows an honest
 * "waitlist temporarily unavailable" state rather than a fake success.
 */
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const EMAIL_SET = 'cohort:waitlist:emails';
// RFC-pragmatic email check: something@something.tld, no spaces, sane length.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET() {
  if (!redis) {
    return NextResponse.json({ available: false, count: null });
  }
  try {
    const count = await redis.scard(EMAIL_SET);
    return NextResponse.json({ available: true, count });
  } catch {
    return NextResponse.json({ available: false, count: null });
  }
}

export async function POST(req: NextRequest) {
  if (!redis) {
    return NextResponse.json(
      { ok: false, error: 'unavailable', detail: 'Waitlist store not configured.' },
      { status: 503 },
    );
  }

  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request', detail: 'Expected JSON { email }.' }, { status: 400 });
  }

  const normalised = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalised || normalised.length > 254 || !EMAIL_RE.test(normalised)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_email', detail: 'Enter a valid email address.' },
      { status: 422 },
    );
  }

  try {
    // SADD returns 1 if newly added, 0 if already present (already on the list).
    const added = await redis.sadd(EMAIL_SET, normalised);
    const count = await redis.scard(EMAIL_SET);
    return NextResponse.json({ ok: true, alreadyJoined: added === 0, count });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'store_failed', detail: 'Could not save right now, try again.' },
      { status: 502 },
    );
  }
}
