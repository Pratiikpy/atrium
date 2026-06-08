'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VENUES } from '@/lib/venues';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

/**
 * Venue margin comparison drawer (BUILD_PLAN Phase 2, /app/trade).
 *
 * Opened by "See margin on each venue", it fans out the SAME position size
 * across every whitelisted venue and shows each one's initial margin live
 * from Plinth (GET /api/trade/margin-impact), so the user sees how the
 * identical trade costs different margin depending on the venue haircut.
 *
 * Honesty: the endpoint computes each venue's requirement independently
 * (it charges the new position against the account's existing required
 * margin), so these are per-venue *siloed* numbers - accurate to compare
 * side by side. The cross-venue netting that makes them cheaper together
 * is the portfolio number on /app/portfolio; we say so in the footnote and
 * never present the per-venue sum as the portfolio cost. Pending venues
 * render an honest dash, never a fabricated figure.
 */

interface Impact {
  initialMarginUsd: string | null;
  buyingPowerAfterUsd: string | null;
  source: 'plinth' | 'pending';
}

interface Row {
  id: string;
  label: string;
  haircutPct: number;
  impact: Impact;
}

const PRESETS = [
  { label: '$1K', value: '1000' },
  { label: '$10K', value: '10000' },
  { label: '$100K', value: '100000' },
];

async function fetchOne(venue: string, size: string, wallet: string | null): Promise<Impact> {
  try {
    const r = await fetch(
      walletQuery(
        `/api/trade/margin-impact?size=${encodeURIComponent(size)}&venue=${encodeURIComponent(venue)}`,
        wallet,
      ),
    );
    if (!r.ok) throw new Error();
    const d = await r.json();
    return {
      initialMarginUsd: d.initialMarginUsd ?? null,
      buyingPowerAfterUsd: d.buyingPowerAfterUsd ?? null,
      source: d.source === 'plinth' ? 'plinth' : 'pending',
    };
  } catch {
    return { initialMarginUsd: null, buyingPowerAfterUsd: null, source: 'pending' };
  }
}

async function fetchAll(size: string, wallet: string | null): Promise<Row[]> {
  const impacts = await Promise.all(VENUES.map((v) => fetchOne(v.id, size, wallet)));
  return VENUES.map((v, i) => ({
    id: v.id,
    label: v.label,
    haircutPct: v.haircutBps / 100,
    impact: impacts[i],
  }));
}

export function VenueMarginCompare({ size, activeVenue }: { size: string; activeVenue: string }) {
  const [open, setOpen] = useState(false);
  // Seed the drawer's size from the order form when it has a value, else
  // default to the $10K preset so the comparison is meaningful immediately.
  const seeded = size && parseFloat(size) > 0 ? size : '10000';
  const [scenario, setScenario] = useState<string>(seeded);

  useEffect(() => {
    if (open && size && parseFloat(size) > 0) setScenario(size);
  }, [open, size]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-divider bg-parchment px-4 py-2 text-sm font-medium text-ink hover:border-ink/30"
      >
        See margin on each venue
      </button>
      {open && (
        <Drawer scenario={scenario} setScenario={setScenario} activeVenue={activeVenue} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function Drawer({
  scenario,
  setScenario,
  activeVenue,
  onClose,
}: {
  scenario: string;
  setScenario: (s: string) => void;
  activeVenue: string;
  onClose: () => void;
}) {
  const wallet = useScopedWallet();

  // ESC closes the drawer (a11y).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // No wallet -> do NOT fan out 7 wallet-scoped margin-impact fetches that
  // each 401 and log a browser-level console error on a public page
  // (interactive-sweep 2026-06-02). Render the static venue + haircut rows
  // (those are public risk weights) with margin pending until the user connects.
  const noWallet = wallet == null;
  const { data, isLoading } = useQuery({
    queryKey: ['venue-margin-compare', scenario, wallet],
    queryFn: () => fetchAll(scenario, wallet),
    enabled: parseFloat(scenario) > 0 && !noWallet,
  });

  const anyLive = data?.some((r) => r.impact.source === 'plinth') ?? false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="venue-compare-title"
      className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-divider bg-parchment-light p-7 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow">Margin per venue</p>
            <h2 id="venue-compare-title" className="mt-1 font-display text-2xl italic text-ink">
              Same trade, every venue
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-divider bg-parchment px-2.5 py-1 text-sm text-muted hover:text-ink"
          >
            Esc
          </button>
        </header>

        <p className="mt-3 text-sm text-ink-soft">
          The initial margin for a position of this size on each whitelisted venue, read live from
          Plinth. The venue haircut is why the same trade costs more on some venues than others.
        </p>

        {/* Preset scenarios */}
        <div className="mt-5 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted">Size</span>
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setScenario(p.value)}
              className={
                'rounded-full border px-3 py-1 text-xs ' +
                (scenario === p.value
                  ? 'border-ink bg-ink text-parchment'
                  : 'border-divider bg-parchment text-ink-soft hover:border-ink/30')
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-md border border-divider">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 font-medium">Venue</th>
                <th className="px-3 py-2 text-right font-medium">Haircut</th>
                <th className="px-3 py-2 text-right font-medium">Initial margin</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? VENUES.map((v) => (
                    <tr key={v.id} className="border-b border-divider/60 last:border-0">
                      <td className="px-3 py-2.5 text-ink">{v.label}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted">{v.haircutBps / 100}%</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="skeleton inline-block h-3 w-16 rounded" />
                      </td>
                    </tr>
                  ))
                : noWallet
                ? VENUES.map((v) => (
                    <tr key={v.id} className="border-b border-divider/60 last:border-0">
                      <td className="px-3 py-2.5 text-ink">{v.label}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted">{v.haircutBps / 100}%</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted">-</td>
                    </tr>
                  ))
                : (data ?? []).map((r) => (
                    <tr
                      key={r.id}
                      className={
                        'border-b border-divider/60 last:border-0 ' +
                        (r.id === activeVenue ? 'bg-parchment-soft/60' : '')
                      }
                    >
                      <td className="px-3 py-2.5 text-ink">
                        {r.label}
                        {r.id === activeVenue && (
                          <span className="ml-2 rounded-sm bg-ink/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ink-soft">
                            selected
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted">{r.haircutPct}%</td>
                      <td className="px-3 py-2.5 text-right font-mono text-ink">
                        {r.impact.initialMarginUsd ?? '-'}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 rounded-md bg-parchment-soft/60 px-4 py-3 text-[11px] leading-snug text-ink-soft">
          {noWallet
            ? 'Connect a wallet to read live per-venue margin from Plinth. The haircuts shown are the real published risk weights and apply to every account.'
            : anyLive
            ? 'These are per-venue siloed requirements. Open positions on more than one and Plinth nets the correlated risk, so your real portfolio margin is lower than the sum. See it on the portfolio page.'
            : 'Per-venue margin reads are pending for this account. The haircuts shown are the real published risk weights and apply to every account. Live numbers appear once Plinth returns a margin quote.'}
        </p>
      </aside>
    </div>
  );
}
