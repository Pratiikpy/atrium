'use client';

import { useResearchAttestation } from '@/lib/scribe';

type Mode = 'baseline' | 'atrium';

/**
 * Renders a live number sourced from on-chain ResearchAttestation. If the
 * source has not committed a number yet, shows the placeholder.
 *
 * Per database conventions: never invent a number, never show aspirational
 * data as live. Audit D-26: the baseline number was previously hardcoded
 * to $2M; now both sides come from the attestation feed.
 */
export function LiveQuote({
  sourceLabel,
  placeholder,
  mode = 'atrium',
}: {
  sourceLabel: string;
  placeholder: string;
  mode?: Mode;
}) {
  const { data, isLoading, error } = useResearchAttestation();

  if (isLoading) {
    return <span className="skeleton inline-block h-10 w-40" aria-label="loading" />;
  }

  // Audit PP-3 fix: prior code accepted `data?.collateralDeltaBps` alone as
  // "ready". But `baselineUsd` is the second required number — the
  // ResearchAttestation contract event doesn't carry it (only ipfsHash +
  // tradesCount + collateralDeltaBps + notebookUrl). Without baselineUsd, the
  // atrium-savings math evaluates to `0 * (1 - savedPercent) = 0` and both
  // panels render `$0`. Now: treat missing baselineUsd as "pending" and show
  // the placeholder, since baseline must come from an off-chain notebook
  // fetch we haven't wired yet (human_left.md item to track).
  if (error || data?.collateralDeltaBps == null || data?.baselineUsd == null) {
    return (
      <span title={`Source: ${sourceLabel} (not yet committed)`} className="text-ink-soft">
        {placeholder}
      </span>
    );
  }

  // Iteration 30 audit fix: refuse to render synthetic-pairs attestations
  // as live numbers. The on-chain ResearchAttestation contract doesn't
  // carry the honesty flag; useResearchAttestation pulls it from the
  // IPFS-pinned JSON behind ipfsHash. If isPublishable is false (or the
  // IPFS gateway couldn't confirm it), surface that explicitly rather
  // than rendering the synthetic figure. Per internal rules "Never invent a
  // number" — a synthetic-pairs backtest's savings figure is structurally
  // wrong by 5-10x, so silently rendering it would inflate Atrium's
  // claimed performance on the landing-page hook.
  if (data.isPublishable === false) {
    return (
      <span
        title={`Source: ${sourceLabel} — synthetic backtest (${data.dataMode ?? 'unknown'}); honest mode pending real-trades archive`}
        className="text-ink-soft"
      >
        {placeholder}
      </span>
    );
  }

  // Baseline = the "isolated margin" figure published with the attestation
  // (off-chain, parsed from the notebook). Atrium savings/loss = baseline
  // × (1 − deltaBps/10_000). Both numbers come from the same attestation
  // row to avoid drift.
  const baseline = data.baselineUsd;
  if (mode === 'baseline') {
    return (
      <span title={`Source: ResearchAttestation row, ipfs ${data.ipfsHash.slice(0, 12)}…`}>
        ${baseline.toLocaleString('en-US', { maximumFractionDigits: 0 })}
      </span>
    );
  }
  // Audit PP-1 fix: prior code did `Math.abs(deltaBps)` which destroyed the
  // sign. A LOSS backtest (deltaBps < 0) would display as if Atrium saved
  // money — exactly inverted from reality. Sign matters: positive bps = atrium
  // requires less collateral, negative bps = atrium requires more.
  const fraction = data.collateralDeltaBps / 10_000;
  const atrium = Math.max(0, baseline * (1 - fraction));
  return (
    <span title={`Source: ResearchAttestation row, ipfs ${data.ipfsHash.slice(0, 12)}…`}>
      ${atrium.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    </span>
  );
}
