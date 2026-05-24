import { NextRequest, NextResponse } from 'next/server';

/**
 * Mobile-UA rewrite — sends phone-sized clients to the dedicated mobile
 * landing / app shell from `desing/Mobile Landing.html` + `Mobile App.html`.
 *
 * Why a middleware not a CSS media query: the mobile design is a different
 * page (OLED-dark, iPhone status bar, glass tab bar) — not a responsive
 * restyle of the desktop landing. Serving both as one bundle would mean
 * shipping ~2 MB to every visitor; instead we serve the right page from
 * the start.
 *
 * Override hooks:
 *   - `?desktop=1` on `/`  → forces desktop landing for QA
 *   - `?mobile=1`  on `/`  → forces mobile landing for QA
 *   - Direct `/mobile` and `/mobile/app` always work regardless of UA
 *
 * UA detection: we treat any UA that includes Android/iPhone/iPad/iPod/
 * Mobile as small-screen. False positives (e.g. iPad Pro reporting
 * desktop) fall through to the desktop landing — acceptable; tablet
 * users can hit `/mobile` directly if they prefer.
 */

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile|BlackBerry/i;

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // QA escape hatches first — explicit overrides win over UA.
  if (searchParams.get('desktop') === '1' || searchParams.get('mobile') === '0') {
    return NextResponse.next();
  }

  const ua = req.headers.get('user-agent') ?? '';
  const isMobile =
    searchParams.get('mobile') === '1' || MOBILE_UA.test(ua);

  if (!isMobile) return NextResponse.next();

  // `/` → mobile landing
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = '/mobile-landing.html';
    return NextResponse.rewrite(url);
  }

  // Any `/app/*` route → mobile app shell. The mobile-app.html handles
  // its own internal navigation between Home/Trade/Move/Agents/More via
  // tab buttons, so we don't need to preserve the sub-path. Querystring
  // (e.g. `?tab=trade`) is preserved so a deep-link is still possible.
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    const url = req.nextUrl.clone();
    url.pathname = '/mobile-app.html';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

// Run on the two routes we actually rewrite. Anything else (verify, lantern,
// docs, brand, etc.) passes through untouched — those pages have their own
// React-side responsive treatment.
export const config = {
  matcher: ['/', '/app', '/app/:path*'],
};
