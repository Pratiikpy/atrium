'use client';

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';

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

/**
 * Cookie consent.
 *
 * Launch-review fix: this used to be a 380px floating card pinned bottom-right,
 * which OVERLAPPED load-bearing content on every screen (the kill switch, the
 * Trade margin panel, the Reserves Merkle diagram, mobile action buttons). It
 * is now a full-width bar docked to the very bottom edge, and it reserves its
 * own height as body padding-bottom so the last row of page content scrolls
 * clear of it instead of hiding behind it. One-time: once a choice is saved it
 * never renders again (localStorage, 12-month TTL).
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!readConsent()) setVisible(true);
  }, []);

  // Reserve space equal to the bar's height so it never sits on top of content.
  // Re-measures when the customize panel expands/collapses (height changes).
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!visible) {
      document.body.style.paddingBottom = '';
      root.style.removeProperty('--consent-h');
      return;
    }
    const h = barRef.current?.offsetHeight ?? 0;
    // Body padding reflows normal-flow content above the bar. The --consent-h
    // var lets OUT-of-flow elements (the fixed app sidebar's wallet card, the
    // PWA install prompt) also lift clear of the bar instead of overlapping it.
    document.body.style.paddingBottom = h ? `${h}px` : '';
    if (h) root.style.setProperty('--consent-h', `${h}px`);
    else root.style.removeProperty('--consent-h');
    return () => {
      document.body.style.paddingBottom = '';
      root.style.removeProperty('--consent-h');
    };
  }, [visible, customize]);

  const save = useCallback((c: Categories) => {
    writeConsent(c);
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={barRef}
      role="dialog"
      aria-label="Privacy choices"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-divider bg-parchment shadow-[0_-6px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h2 className="font-display text-base italic text-ink">Privacy choices</h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
            Atrium uses essential cookies to run. Optional analytics (SimpleAnalytics, no personal
            IDs) and crash reporting (Sentry, wallet addresses scrubbed) stay off until you allow
            them.
          </p>

          {customize && (
            <div className="mt-3 flex flex-col gap-2 border-t border-divider pt-3 sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                <input type="checkbox" checked disabled className="size-4 accent-ink" />
                <span>Essential <span className="text-muted">(always on)</span></span>
              </label>
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="size-4 accent-ink"
                />
                Analytics &amp; crash reporting
              </label>
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                <input type="checkbox" checked={false} disabled className="size-4 accent-ink" />
                <span>Marketing <span className="text-muted">(none today)</span></span>
              </label>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {customize ? (
            <button
              onClick={() => save({ essential: true, analytics, marketing: false })}
              className="h-[40px] rounded-md bg-ink px-4 text-sm font-medium text-bg"
            >
              Save preferences
            </button>
          ) : (
            <>
              <button
                onClick={() => setCustomize(true)}
                className="h-[40px] rounded-md px-3 text-sm text-muted underline underline-offset-2 hover:text-ink"
              >
                Customize
              </button>
              <button
                onClick={() => save({ essential: true, analytics: false, marketing: false })}
                className="h-[40px] rounded-md border border-divider bg-bg px-4 text-sm font-medium text-ink"
              >
                Reject non-essential
              </button>
              <button
                onClick={() => save({ essential: true, analytics: true, marketing: false })}
                className="h-[40px] rounded-md bg-ink px-4 text-sm font-medium text-bg"
              >
                Accept all
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
