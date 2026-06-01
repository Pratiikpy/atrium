/**
 * Consent gate, Phase 3 hardening + Phase 10 cookie banner integration.
 *
 * Reads/writes localStorage `atrium_consent_v1` (JSON of categories → boolean).
 * SSR-safe: returns false when window is undefined.
 *
 * The cookie-consent-banner.tsx component writes to the same key and dispatches
 * a 'atrium-consent-change' event on window so Sentry/analytics can re-check.
 */

const STORAGE_KEY = 'atrium_consent_v1';

type Category = 'analytics' | 'marketing';

function readStore(): Record<Category, boolean> {
  if (typeof window === 'undefined') return { analytics: false, marketing: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { analytics: false, marketing: false };
    return JSON.parse(raw) as Record<Category, boolean>;
  } catch {
    return { analytics: false, marketing: false };
  }
}

function writeStore(store: Record<Category, boolean>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function hasConsent(category: Category): boolean {
  return readStore()[category] ?? false;
}

export function grantConsent(category: Category): void {
  const store = readStore();
  store[category] = true;
  writeStore(store);
}

export function revokeConsent(category: Category): void {
  const store = readStore();
  store[category] = false;
  writeStore(store);
}

export function resetConsent(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('atrium_consent_ts');
  window.dispatchEvent(new Event('atrium-consent-change'));
}
