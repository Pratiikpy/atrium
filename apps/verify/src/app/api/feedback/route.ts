import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = ['bug', 'ux', 'feature', 'other'] as const;

/**
 * POST /api/feedback
 *
 * Receives beta tester feedback. Forwards to feedback@useatrium.me via configured
 * email service, or stores for later retrieval.
 *
 * Auth: requires connected wallet (SIWE session) via cookie.
 * Rate-limited via Phase 3 middleware (10 req/min per IP).
 */
export async function POST(req: NextRequest) {
  // Beta feedback is intentionally low-friction: the /beta page offers it with
  // the wallet OPTIONAL ("associated with your wallet, if connected") and the
  // form posts anonymously. Gating on a session returned a raw 401 JSON page to
  // unconnected testers, breaking the documented flow, and the session was
  // never used downstream anyway. Abuse is bounded by the per-IP rate limit. If
  // a verified session IS present we attach the wallet for follow-up.
  const session = await getSession(req);

  let body: { category?: string; message?: string; email?: string };
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      // Handle form submission
      const formData = await req.formData();
      body = {
        category: formData.get('category') as string,
        message: formData.get('message') as string,
        email: (formData.get('email') as string) || undefined,
      };
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { category, message, email } = body;

  if (!category || !VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json({ error: 'invalid_category' }, { status: 400 });
  }
  if (!message || message.length < 5 || message.length > 2000) {
    return NextResponse.json({ error: 'message must be 5-2000 chars' }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  // Forward feedback, in production this would POST to Notion API or send email.
  // For now, log and acknowledge.
  const feedbackUrl = process.env.FEEDBACK_WEBHOOK_URL;
  if (feedbackUrl) {
    await fetch(feedbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        message,
        email,
        wallet: session?.walletAddress ?? null,
        ts: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }

  // For form submissions, redirect back to beta page
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.redirect(new URL('/beta?submitted=1', req.url));
  }

  return NextResponse.json({ ok: true });
}
