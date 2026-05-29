'use client';

import { useEffect } from 'react';
import { loadNewRelicBrowser } from '@/lib/new-relic';

/** Loads New Relic browser agent after hydration, gated on consent. */
export function NewRelicLoader() {
  useEffect(() => {
    loadNewRelicBrowser();
    const handler = () => loadNewRelicBrowser();
    window.addEventListener('atrium-consent-change', handler);
    return () => window.removeEventListener('atrium-consent-change', handler);
  }, []);
  return null;
}
