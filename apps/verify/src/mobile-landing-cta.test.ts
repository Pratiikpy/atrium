import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 125-UX8.1 regression. middleware.ts rewrites / to mobile-landing.html for
 * every mobile UA, so its "Open testnet" CTA is the primary entry into the
 * whole product. Pre-fix all three were bare <button>s with no handler/href —
 * dead for 100% of mobile visitors. Lock them as real /app links.
 */
describe('mobile-landing "Open testnet" CTAs', () => {
  const html = readFileSync(path.resolve(process.cwd(), 'public/mobile-landing.html'), 'utf8');

  it('has no dead "Open testnet" <button>', () => {
    expect(html).not.toMatch(/<button[^>]*>\s*Open testnet/);
  });

  it('routes every "Open testnet" CTA to /app via an anchor', () => {
    const appAnchors = [...html.matchAll(/<a href="\/app"[^>]*>\s*Open testnet/g)];
    expect(appAnchors.length).toBe(3);
  });
});
