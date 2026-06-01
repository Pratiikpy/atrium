'use client';

import { useState } from 'react';
import { RecentAttestationsTable } from './recent-attestations';

const WINDOWS = ['24h', '7d', '30d'] as const;
type WindowKey = (typeof WINDOWS)[number];

/**
 * Recent-attestations section wrapper. Owns the window tab state so the
 * "24h / 7d / 30d" toggle actually drives the table query, previously
 * these were dead `<span>` elements with no handler (audit U-11).
 */
export function RecentAttestationsSection() {
  const [window, setWindow] = useState<WindowKey>('24h');
  return (
    <>
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl italic text-ink">Recent attestations</h2>
        <div role="tablist" aria-label="Time window" className="flex gap-1 text-xs">
          {WINDOWS.map((w) => {
            const isActive = w === window;
            return (
              <button
                key={w}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setWindow(w)}
                className={
                  'rounded-md px-2 py-1 transition-colors ' +
                  (isActive
                    ? 'bg-ink text-parchment'
                    : 'text-muted hover:text-ink')
                }
              >
                {w}
              </button>
            );
          })}
        </div>
      </header>
      <RecentAttestationsTable window={window} />
    </>
  );
}
