import { NextRequest, NextResponse } from 'next/server';
import { ratelimitReadPerIp, ratelimitWritePerIp } from '@/lib/rate-limit';

/**
 * Middleware, Phase 3 hardened.
 *
 * Rate limiting on /api/* routes via Upstash (skipped if env not set).
 * Method-aware: reads get a generous per-IP bucket, writes a tight one.
 * See lib/rate-limit.ts for why (read-heavy polling dashboard + shared
 * demo IPs must not throttle themselves, but write spam still must).
 *
 * The mobile landing is no longer a separate static page. The React landing
 * (app/page.tsx) is fully responsive and serves every viewport, so the prior
 * mobile-UA rewrite to /mobile-landing.html was removed (it shipped a fake
 * phone status bar and drifted from the real-data React page).
 */

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const limiter = isWrite ? ratelimitWritePerIp : ratelimitReadPerIp;
    if (limiter) {
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        '127.0.0.1';
      const { success, reset } = await limiter.limit(ip);
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return NextResponse.json(
          { error: 'rate_limited', detail: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
