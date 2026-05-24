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

  // `/` -> mobile landing
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = '/mobile-landing.html';
    return NextResponse.rewrite(url);
  }

  // Audit 2026-05-24 (Auditor B C-4) Path B fix: prior middleware
  // rewrote every /app/* hit from a mobile UA to /mobile-app.html, a
  // static decorative mockup that doesn't connect a wallet or transact.
  // The React /app/* tree is already responsive (AppShell hides the
  // sidebar on small viewports, swaps to the mobile nav, and scales
  // grids via `lg:grid-cols-2`), so mobile users get the live app on
  // the same routes desktop users use. The static mockup stays
  // available at /mobile/app for design-preview parity until a
  // dedicated mobile React port lands.
  return NextResponse.next();
}

// Run only on `/`. /app/* falls through to the responsive React tree.
export const config = {
  matcher: ['/'],
};
