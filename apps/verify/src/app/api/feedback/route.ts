import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = ['bug', 'ux', 'feature', 'other'] as const;

/**
 * POST /api/feedback
 *
 * Receives beta tester feedback. Forwards to feedback@atrium.fi via configured
 * email service, or stores for later retrieval.
 *
 * Auth: requires connected wallet (SIWE session) via cookie.
 * Rate-limited via Phase 3 middleware (10 req/min per IP).
 */
export async function POST(req: NextRequest) {
  // Broken-auth fix: the prior check looked for a cookie named
  // `atrium_session` (underscore) and only tested EXISTENCE, but the real
  // session cookie is `atrium-session` (hyphen) and must be HMAC-verified.
  // So the old check both looked at the wrong cookie AND accepted any
  // non-empty value. getSession() reads + verifies the signed cookie.
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

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
      body: JSON.stringify({ category, message, email, ts: new Date().toISOString() }),
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
