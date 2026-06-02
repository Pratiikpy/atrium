/**
 * Single source of truth for the visible "as of" period stamps shown on the
 * footer, brand kit, and the landing architecture sheets.
 *
 * Launch-review fix: the period was hardcoded as "May 2026" / "2026.05" in five
 * separate files, so once June arrived a public visitor saw a stale past month
 * on the live site. Consolidated here; bump these two lines when the period
 * rolls over (or set NEXT_PUBLIC_BUILD_PERIOD[_SHORT] at build time to derive
 * them from the build date automatically).
 */
export const BUILD_PERIOD = process.env.NEXT_PUBLIC_BUILD_PERIOD ?? 'June 2026';
export const BUILD_PERIOD_SHORT = process.env.NEXT_PUBLIC_BUILD_PERIOD_SHORT ?? '2026.06';
export const APP_VERSION = 'v0.15';
