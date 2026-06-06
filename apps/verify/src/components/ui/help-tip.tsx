'use client';

import { useState } from 'react';

const TERMS: Record<string, string> = {
  margin: 'Collateral deposited to cover potential losses on leveraged positions.',
  liquidation: 'Forced closure of positions when margin falls below the maintenance threshold.',
  'buying power':
    'How much new position you can open right now, given your collateral and what is already committed. Plinth nets risk across venues, so this is usually larger than any single venue would allow.',
  'total collateral':
    'The value of everything in your Atrium vault that backs your positions, summed across every live venue.',
  'open notional':
    'The combined face value of all your open positions, including leverage. Not the cash at risk; that is your margin.',
  'p&l 24h':
    'Your profit or loss over the last 24 hours, shown as a dollar amount and as a percent of your collateral.',
  notional: 'The total face value of a position, including leverage.',
  leverage: 'Multiplier on your collateral, higher leverage means larger positions but faster liquidation.',
  'maintenance margin': 'Minimum collateral required to keep a position open before liquidation triggers.',
  'initial margin': 'Collateral required to open a new position.',
  'liquidation buffer':
    'How far your collateral can fall before Vigil starts unwinding positions. The bigger the buffer, the safer you are.',
  hedging: 'Holding offsetting positions to reduce net directional exposure.',
  'basis trade': 'Simultaneously long spot and short futures to capture the funding rate spread.',
  slippage: 'Difference between expected and actual execution price due to market movement or thin liquidity.',
};

/**
 * Inline tooltip for financial concepts. Renders a `?` icon that shows
 * a one-sentence explanation on hover/focus.
 */
export function HelpTip({ term }: { term: string }) {
  const [open, setOpen] = useState(false);
  const explanation = TERMS[term.toLowerCase()];
  if (!explanation) return null;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`What is ${term}?`}
        className="inline-flex size-4 items-center justify-center rounded-full border border-divider text-[9px] text-muted hover:border-ink/40 hover:text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
        tabIndex={0}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-md border border-divider bg-parchment px-3 py-2 text-[11px] font-normal normal-case tracking-normal leading-[1.5] text-ink shadow-md"
        >
          {explanation}
        </span>
      )}
    </span>
  );
}
