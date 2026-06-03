'use client';

import { useEffect, useState } from 'react';

/**
 * Probes whether the tax export endpoint can actually produce a file.
 *
 * The export buttons used to be unconditional `<a download href="/api/tax/export">`
 * links. While the Tablet service is undeployed (no TABLET_URL) the route returns
 * 503 `tablet_pending`, so clicking "Download CSV" handed the user a 503 error blob
 * instead of a CSV (use-everything action-audit 2026-06-03). This hook does a cheap
 * HEAD probe so the buttons can render disabled + honest instead.
 *
 * Returns: null while probing, true if exports are live, false if pending/blocked.
 */
export function useTaxExportReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/tax/export?format=csv', { method: 'HEAD' })
      .then((r) => {
        if (!cancelled) setReady(r.ok);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}
