'use client';

import { useEffect, useState } from 'react';

const PRESETS = [0.05, 0.10, 0.50] as const;
const STORAGE_KEY = 'atrium.slippage';

/**
 * Slippage tolerance dropdown: 0.05% / 0.10% / 0.50% / Custom.
 * Persists user choice in localStorage scoped to wallet.
 */
export function SlippageSelect({
  value,
  onChange,
  walletAddress,
}: {
  value: number;
  onChange: (v: number) => void;
  walletAddress?: string | null;
}) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Load persisted value
  useEffect(() => {
    const key = walletAddress ? `${STORAGE_KEY}:${walletAddress}` : STORAGE_KEY;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const v = parseFloat(stored);
        if (isFinite(v) && v > 0) onChange(v);
      }
    } catch { /* ignore */ }
  }, [walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  function select(v: number) {
    onChange(v);
    setShowCustom(false);
    persist(v);
  }

  function applyCustom() {
    const v = parseFloat(custom);
    if (isFinite(v) && v > 0 && v < 50) {
      onChange(v);
      persist(v);
    }
  }

  function persist(v: number) {
    const key = walletAddress ? `${STORAGE_KEY}:${walletAddress}` : STORAGE_KEY;
    try { localStorage.setItem(key, String(v)); } catch { /* ignore */ }
  }

  return (
    <div className="flex items-center gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => select(p)}
          className={
            'rounded px-2 py-0.5 text-[11px] font-mono transition-colors ' +
            (value === p && !showCustom
              ? 'bg-ink text-parchment'
              : 'bg-parchment-soft text-muted hover:text-ink')
          }
        >
          {p.toFixed(2)}%
        </button>
      ))}
      {showCustom ? (
        <input
          type="text"
          inputMode="decimal"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))}
          onBlur={applyCustom}
          onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
          placeholder="0.00"
          /* n=23: a placeholder is not an accessible name (it disappears on
             input and many AT ignore it). Give the lone custom-slippage input a
             real accessible name like every other amount input in the app. */
          aria-label="Custom slippage tolerance (%)"
          className="w-14 rounded border border-divider bg-parchment-light px-1.5 py-0.5 text-[11px] font-mono text-ink focus:outline-none"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className={
            'rounded px-2 py-0.5 text-[11px] font-mono transition-colors ' +
            (!(PRESETS as readonly number[]).includes(value)
              ? 'bg-ink text-parchment'
              : 'bg-parchment-soft text-muted hover:text-ink')
          }
        >
          {!(PRESETS as readonly number[]).includes(value) ? `${value.toFixed(2)}%` : 'Custom'}
        </button>
      )}
    </div>
  );
}
