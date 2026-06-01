import { NextRequest, NextResponse } from 'next/server';
import { ratelimitReadPerIp, ratelimitWritePerIp } from '@/lib/rate-limit';

/**
 * Middleware, Phase 3 hardened.
 *
 * 1. Rate limiting on /api/* routes via Upstash (skipped if env not set).
 *    Method-aware: reads get a generous per-IP bucket, writes a tight one.
 *    See lib/rate-limit.ts for why (read-heavy polling dashboard + shared
 *    demo IPs must not throttle themselves, but write spam still must).
 * 2. Mobile-UA rewrite for the landing page.
 */

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile|BlackBerry/i;

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // --- Rate limiting for API routes (method-aware) ---
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

  // --- Mobile UA rewrite (landing page only) ---
  if (pathname !== '/') return NextResponse.next();

  // QA escape hatches
  if (searchParams.get('desktop') === '1' || searchParams.get('mobile') === '0') {
    return NextResponse.next();
  }

  const ua = req.headers.get('user-agent') ?? '';
  const isMobile = searchParams.get('mobile') === '1' || MOBILE_UA.test(ua);

  if (!isMobile) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/mobile-landing.html';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/', '/api/:path*'],
};
