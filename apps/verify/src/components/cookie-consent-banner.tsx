'use client';

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'atrium_consent_v1';
const CONSENT_TIMESTAMP_KEY = 'atrium_consent_ts';
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

type Categories = { essential: boolean; analytics: boolean; marketing: boolean };

function readConsent(): Categories | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const ts = localStorage.getItem(CONSENT_TIMESTAMP_KEY);
    if (ts && Date.now() - Number(ts) > TWELVE_MONTHS_MS) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CONSENT_TIMESTAMP_KEY);
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeConsent(c: Categories) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  localStorage.setItem(CONSENT_TIMESTAMP_KEY, String(Date.now()));
  window.dispatchEvent(new Event('atrium-consent-change'));
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    if (!readConsent()) setVisible(true);
  }, []);

  const save = useCallback((c: Categories) => {
    writeConsent(c);
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Privacy choices"
      className="fixed bottom-4 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-lg border border-divider bg-parchment p-5 shadow-lg"
    >
      <h2 className="font-display text-lg text-ink">Privacy choices</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Atrium uses essential cookies for the service to work. We also offer optional
        analytics (SimpleAnalytics, no personal IDs) and crash reporting (Sentry, scrubbed
        of wallet addresses).
      </p>

      {customize && (
        <div className="mt-4 space-y-3 border-t border-divider pt-3">
          <label className="flex items-center gap-3 text-sm text-ink-soft">
            <input type="checkbox" checked disabled className="size-4 accent-ink" />
            <span>Essential <span className="text-muted">(always on)</span></span>
          </label>
          <label className="flex items-center gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              className="size-4 accent-ink"
            />
            Analytics &amp; crash reporting
          </label>
          <label className="flex items-center gap-3 text-sm text-ink-soft">
            <input type="checkbox" checked={false} disabled className="size-4 accent-ink" />
            <span>Marketing <span className="text-muted">(none today)</span></span>
          </label>
          <button
            onClick={() => save({ essential: true, analytics, marketing: false })}
            className="mt-2 h-[44px] w-full rounded-md bg-ink text-sm font-medium text-bg"
          >
            Save preferences
          </button>
        </div>
      )}

      {!customize && (
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => save({ essential: true, analytics: true, marketing: false })}
            className="h-[44px] w-full rounded-md bg-ink text-sm font-medium text-bg"
          >
            Accept all
          </button>
          <button
            onClick={() => save({ essential: true, analytics: false, marketing: false })}
            className="h-[44px] w-full rounded-md border border-divider bg-bg text-sm font-medium text-ink"
          >
            Reject non-essential
          </button>
          <button
            onClick={() => setCustomize(true)}
            className="mt-1 text-sm text-muted underline underline-offset-2 hover:text-ink"
          >
            Customize
          </button>
        </div>
      )}
    </div>
  );
}
